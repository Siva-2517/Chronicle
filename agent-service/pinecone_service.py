import os
import time
import asyncio
from typing import List, Dict, Any, Optional
from bson import ObjectId

from database import get_collection
from llm import get_embeddings

try:
    from pinecone import Pinecone, ServerlessSpec
    PINECONE_AVAILABLE = True
except ImportError:
    PINECONE_AVAILABLE = False

_pinecone_client = None
_pinecone_index = None

INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "chronicle")
DIMENSION = 768  # Standard for gemini-embedding-001 / text-embedding-004

def is_pinecone_available() -> bool:
    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    return bool(api_key and PINECONE_AVAILABLE)

def get_pinecone_index():
    """
    Initializes and returns the Pinecone Index instance.
    Automatically creates the serverless index if it doesn't exist.
    """
    global _pinecone_client, _pinecone_index
    if _pinecone_index is not None:
        return _pinecone_index

    api_key = os.getenv("PINECONE_API_KEY", "").strip()
    if not api_key:
        return None

    if not PINECONE_AVAILABLE:
        print("Warning: pinecone-client is not installed. Install with `pip install pinecone`.")
        return None

    _pinecone_client = Pinecone(api_key=api_key)
    existing_indexes = [idx.name for idx in _pinecone_client.list_indexes()]

    if INDEX_NAME not in existing_indexes:
        cloud = os.getenv("PINECONE_CLOUD", "aws")
        region = os.getenv("PINECONE_REGION", "us-east-1")
        print(f"Creating Pinecone serverless index '{INDEX_NAME}' (cloud={cloud}, region={region}, dim={DIMENSION})...")
        _pinecone_client.create_index(
            name=INDEX_NAME,
            dimension=DIMENSION,
            metric="cosine",
            spec=ServerlessSpec(cloud=cloud, region=region)
        )
        # Wait for index readiness
        for _ in range(30):
            desc = _pinecone_client.describe_index(INDEX_NAME)
            status = getattr(desc, "status", {})
            ready = status.get("ready", False) if isinstance(status, dict) else getattr(status, "ready", False)
            if ready:
                break
            time.sleep(1)

    _pinecone_index = _pinecone_client.Index(INDEX_NAME)
    return _pinecone_index

async def index_repository_artifacts_pinecone(repo_id: str) -> Dict[str, Any]:
    """
    Extracts and embeds commit messages with diff patches, PR bodies, and review comments
    for a given repository and upserts them into Pinecone under namespace `repo_id`.
    """
    index = get_pinecone_index()
    if index is None:
        return {"status": "error", "message": "Pinecone is not configured or unavailable"}

    commits_col = get_collection("commits")
    prs_col = get_collection("pullrequests")

    commits_cursor = commits_col.find({"repoId": ObjectId(repo_id)})
    commits = await commits_cursor.to_list(length=300)

    prs_cursor = prs_col.find({"repoId": ObjectId(repo_id)})
    prs = await prs_cursor.to_list(length=200)

    ids = []
    documents = []
    metadatas = []

    # 1. Index Commits
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
            "author": author_name[:100],
            "text": doc_text[:2000]
        })

    # 2. Index Pull Requests & Review Comments
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
            "title": title[:200],
            "text": pr_doc_text[:2000]
        })

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
                "path": c_path[:100],
                "text": comm_doc_text[:2000]
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

    emb = get_embeddings()

    # Batch upsert in chunks of 50 to avoid network payload limits
    batch_size = 50
    for i in range(0, len(documents), batch_size):
        b_ids = ids[i : i + batch_size]
        b_docs = documents[i : i + batch_size]
        b_metas = metadatas[i : i + batch_size]

        # Run embedding generation without blocking async event loop
        b_embeddings = await asyncio.to_thread(emb.embed_documents, b_docs)

        vectors = []
        for v_id, v_val, v_meta in zip(b_ids, b_embeddings, b_metas):
            vectors.append({
                "id": v_id,
                "values": v_val,
                "metadata": v_meta
            })

        # Upsert into Pinecone under namespace = repo_id
        await asyncio.to_thread(index.upsert, vectors=vectors, namespace=str(repo_id))

    return {
        "status": "ok",
        "provider": "pinecone",
        "repo_id": repo_id,
        "indexed_commits": len(commits),
        "indexed_prs": len(prs),
        "indexed_comments": comment_count,
        "total_vectors": len(documents)
    }

def query_vector_artifacts_pinecone(repo_id: str, query: str, n_results: int = 10) -> List[Dict[str, Any]]:
    """
    Performs semantic vector search in Pinecone for the given repository.
    """
    index = get_pinecone_index()
    if index is None:
        return []

    try:
        emb = get_embeddings()
        query_vector = emb.embed_query(query)

        # Query isolated namespace for this repo
        res = index.query(
            vector=query_vector,
            top_k=n_results,
            namespace=str(repo_id),
            include_metadata=True
        )

        matched_items = []
        matches = getattr(res, "matches", []) or (res.get("matches", []) if isinstance(res, dict) else [])
        for m in matches:
            m_id = getattr(m, "id", "") if not isinstance(m, dict) else m.get("id", "")
            m_score = getattr(m, "score", 0.0) if not isinstance(m, dict) else m.get("score", 0.0)
            m_meta = getattr(m, "metadata", {}) if not isinstance(m, dict) else m.get("metadata", {})
            m_doc = m_meta.get("text", "") if isinstance(m_meta, dict) else ""

            matched_items.append({
                "id": m_id,
                "document": m_doc,
                "metadata": m_meta,
                "distance": m_score
            })

        return matched_items
    except Exception as e:
        print(f"Pinecone vector search query failed: {e}")
        return []

