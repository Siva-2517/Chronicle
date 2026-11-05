import os
import asyncio
from typing import List, Dict, Any, Optional
from bson import ObjectId
import chromadb
from chromadb.config import Settings

from database import get_collection
from llm import get_embeddings
from pinecone_service import (
    is_pinecone_available,
    index_repository_artifacts_pinecone,
    query_vector_artifacts_pinecone
)

COLLECTION_NAME = "chronicle_artifacts"
_chroma_client = None

def get_chroma_client():
    """
    Returns an initialized ChromaDB client.
    Connects to Chroma Cloud if CHROMA_API_KEY and CHROMA_TENANT are configured;
    otherwise falls back to local persistent storage in ./chroma_data.
    """
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    api_key = os.getenv("CHROMA_API_KEY")
    tenant = os.getenv("CHROMA_TENANT")
    database = os.getenv("CHROMA_DATABASE", "default_database")

    if api_key and api_key.strip() and tenant and tenant.strip():
        print(f"Connecting to Chroma Cloud (tenant: {tenant}, database: {database})...")
        _chroma_client = chromadb.CloudClient(
            tenant=tenant.strip(),
            database=database.strip(),
            api_key=api_key.strip(),
        )
    else:
        persist_dir = os.path.join(os.path.dirname(__file__), "chroma_data")
        os.makedirs(persist_dir, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=persist_dir,
            settings=Settings(anonymized_telemetry=False)
        )

    return _chroma_client

def get_artifact_collection():
    """
    Retrieves or creates the unified Chroma collection for Chronicle artifacts.
    """
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"description": "Chronicle code decisions, commits, PRs, and review comments"}
    )

async def index_repository_artifacts(repo_id: str) -> Dict[str, Any]:
    """
    Embeds commit messages with diff patches, PR bodies, and review comments
    for a given repository into Pinecone (if PINECONE_API_KEY is configured)
    or local persistent ChromaDB.
    """
    if is_pinecone_available():
        print(f"Routing vector indexing for repo {repo_id} to Pinecone Cloud...")
        return await index_repository_artifacts_pinecone(repo_id)

    commits_col = get_collection("commits")
    prs_col = get_collection("pullrequests")

    commits_cursor = commits_col.find({"repoId": ObjectId(repo_id)})
    commits = await commits_cursor.to_list(length=300)

    prs_cursor = prs_col.find({"repoId": ObjectId(repo_id)})
    prs = await prs_cursor.to_list(length=200)

    ids = []
    documents = []
    metadatas = []

    # 1. Index Commits (messages + touched files + diff patches)
    for c in commits:
        sha = c.get("sha", "")
        if not sha:
            continue

        message = c.get("message", "").strip()
        author_name = c.get("author", {}).get("name", "Unknown")
        date_str = str(c.get("author", {}).get("date", ""))

        doc_parts = [
            f"Commit SHA: {sha}",
            f"Author: {author_name} | Date: {date_str}",
            f"Message: {message}",
            "Files changed:"
        ]

        files = c.get("files", [])
        for f in files:
            fname = f.get("filename", "")
            status = f.get("status", "modified")
            adds = f.get("additions", 0)
            dels = f.get("deletions", 0)
            doc_parts.append(f"  - {fname} ({status}, +{adds}/-{dels})")
            patch = f.get("patch", "")
            if patch:
                # Include patch snippet (up to 800 chars per file to stay within embedding window)
                doc_parts.append(f"    Diff patch snippet:\n{patch[:800]}")

        doc_text = "\n".join(doc_parts)
        doc_id = f"commit_{repo_id}_{sha}"

        ids.append(doc_id)
        documents.append(doc_text)
        metadatas.append({
            "repo_id": str(repo_id),
            "type": "commit",
            "sha": sha,
            "pr_number": -1,
            "message": message[:200],
            "author": author_name[:100]
        })

    # 2. Index Pull Requests (titles + bodies) and Review Comments
    comment_count = 0
    for pr in prs:
        number = pr.get("number")
        if number is None:
            continue

        title = pr.get("title", "").strip()
        body = pr.get("body", "").strip()
        state = pr.get("state", "open")
        merged = "Yes" if pr.get("mergedAt") else "No"
        assoc_commits = ", ".join(pr.get("associatedCommits", []))

        pr_doc_parts = [
            f"Pull Request #{number}: {title}",
            f"Status: {state} | Merged: {merged}",
            f"Description:\n{body}"
        ]
        if assoc_commits:
            pr_doc_parts.append(f"Associated Commits: {assoc_commits}")

        pr_doc_text = "\n".join(pr_doc_parts)
        pr_doc_id = f"pr_{repo_id}_{number}"

        ids.append(pr_doc_id)
        documents.append(pr_doc_text)
        metadatas.append({
            "repo_id": str(repo_id),
            "type": "pr_body",
            "sha": "",
            "pr_number": int(number),
            "title": title[:200]
        })

        # 3. Index Review Comments
        comments = pr.get("comments", [])
        for idx, comm in enumerate(comments):
            c_author = comm.get("author", "Unknown")
            c_body = comm.get("body", "").strip()
            c_path = comm.get("path", "")
            c_diff = comm.get("diffHunk", "")

            comm_parts = [
                f"PR #{number} Review Comment on file {c_path} by {c_author}:",
                f"Comment: {c_body}"
            ]
            if c_diff:
                comm_parts.append(f"Code diff context:\n{c_diff[:600]}")

            comm_doc_text = "\n".join(comm_parts)
            comm_doc_id = f"pr_comm_{repo_id}_{number}_{idx}"

            ids.append(comm_doc_id)
            documents.append(comm_doc_text)
            metadatas.append({
                "repo_id": str(repo_id),
                "type": "review_comment",
                "sha": "",
                "pr_number": int(number),
                "author": c_author[:100],
                "path": c_path[:100]
            })
            comment_count += 1

    if not documents:
        return {
            "status": "empty",
            "message": "No commits or PRs found to index",
            "indexed_commits": 0,
            "indexed_prs": 0,
            "indexed_comments": 0,
            "total_vectors": 0
        }

    # Embed and upsert in batches of 40
    emb = get_embeddings()
    collection = get_artifact_collection()

    batch_size = 40
    for i in range(0, len(documents), batch_size):
        b_ids = ids[i : i + batch_size]
        b_docs = documents[i : i + batch_size]
        b_metas = metadatas[i : i + batch_size]

        b_embeddings = await asyncio.to_thread(emb.embed_documents, b_docs)
        await asyncio.to_thread(
            collection.upsert,
            ids=b_ids,
            documents=b_docs,
            embeddings=b_embeddings,
            metadatas=b_metas
        )

    return {
        "status": "ok",
        "provider": "chromadb",
        "repo_id": repo_id,
        "indexed_commits": len(commits),
        "indexed_prs": len(prs),
        "indexed_comments": comment_count,
        "total_vectors": len(documents)
    }

def query_vector_artifacts(repo_id: str, query: str, n_results: int = 10) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search over commits, PRs, and review comments in Pinecone
    (if configured) or ChromaDB.
    """
    if is_pinecone_available():
        return query_vector_artifacts_pinecone(repo_id=repo_id, query=query, n_results=n_results)

    collection = get_artifact_collection()
    count = collection.count()
    if count == 0:
        return []

    try:
        emb = get_embeddings()
        query_vector = emb.embed_query(query)

        results = collection.query(
            query_embeddings=[query_vector],
            n_results=min(n_results, count),
            where={"repo_id": str(repo_id)}
        )

        matched_items = []
        if results and results.get("ids") and results["ids"][0]:
            for idx in range(len(results["ids"][0])):
                matched_items.append({
                    "id": results["ids"][0][idx],
                    "document": results["documents"][0][idx] if results.get("documents") else "",
                    "metadata": results["metadatas"][0][idx] if results.get("metadatas") else {},
                    "distance": results["distances"][0][idx] if results.get("distances") else 0.0
                })

        return matched_items
    except Exception as e:
        print(f"Chroma vector search query failed: {e}")
        return []
