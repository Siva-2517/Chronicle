import json
from typing import TypedDict, List, Optional, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.messages import SystemMessage, HumanMessage

def clean_and_parse_json(content: str) -> Any:
    """
    Cleans markdown code blocks (e.g. ```json ... ```) from LLM responses
    and parses the inner JSON.
    """
    content = content.strip()
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0].strip()
    elif "```JSON" in content:
        content = content.split("```JSON")[1].split("```")[0].strip()
    elif "```" in content:
        parts = content.split("```")
        if len(parts) >= 3:
            content = parts[1].strip()
    else:
        # Find first '{' and last '}' to strip any surrounding conversational text
        start_idx = content.find('{')
        end_idx = content.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = content[start_idx:end_idx+1].strip()
    return json.loads(content)

from database import get_commits_for_file, get_prs_for_commits, get_collection, get_all_commits, get_all_prs
from llm import get_llm

# ==========================================
# 1. DECISION-EXTRACTION PIPELINE
# ==========================================

class ExtractionState(TypedDict):
    repo_id: str
    file_path: str
    function_name: Optional[str]
    commits: List[Dict[str, Any]]
    pull_requests: List[Dict[str, Any]]
    extracted_decisions: List[Dict[str, Any]]
    verified_decisions: List[Dict[str, Any]]
    errors: List[str]

async def retrieve_data_node(state: ExtractionState) -> ExtractionState:
    """
    Node 1: Pulls commits and PRs from MongoDB for the target file
    """
    repo_id = state["repo_id"]
    file_path = state["file_path"]
    
    try:
        # Retrieve all commits affecting the file
        commits = await get_commits_for_file(repo_id, file_path)
        shas = [c["sha"] for c in commits]
        
        # Retrieve PRs associated with those commits
        prs = await get_prs_for_commits(repo_id, shas)
        
        state["commits"] = commits
        state["pull_requests"] = prs
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"Data retrieval failed: {str(e)}"]
        state["commits"] = []
        state["pull_requests"] = []
        
    return state

async def extract_decisions_node(state: ExtractionState) -> ExtractionState:
    """
    Node 2: Runs LLM to extract decision records from the commit diffs and discussions
    """
    commits = state.get("commits", [])
    prs = state.get("pull_requests", [])
    file_path = state["file_path"]
    
    if not commits:
        state["extracted_decisions"] = []
        return state

    # Format the context for the LLM
    context_str = f"File: {file_path}\n\n--- Commits affecting this file ---\n"
    for c in commits:
        context_str += f"Commit SHA: {c['sha']}\n"
        context_str += f"Author: {c.get('author', {}).get('name', 'Unknown')}\n"
        context_str += f"Date: {c.get('author', {}).get('date', '')}\n"
        context_str += f"Message: {c['message']}\n"
        
        # Add files diff/patches if present
        for f in c.get("files", []):
            if f["filename"] == file_path and f.get("patch"):
                context_str += f"Diff Patch:\n{f['patch']}\n"
        context_str += "---------------------------------\n"
        
    if prs:
        context_str += "\n--- Associated Pull Requests & Discussions ---\n"
        for pr in prs:
            context_str += f"PR #{pr.get('number', 'unknown')}: {pr.get('title', '')}\n"
            context_str += f"State: {pr.get('state', '')} | Merged: {'Yes' if pr.get('mergedAt') else 'No'}\n"
            context_str += f"Description: {pr.get('body', '')}\n"
            
            # Comments
            if pr.get("comments"):
                context_str += "Discussion:\n"
                for comm in pr.get("comments", []):
                    path_str = f" (on file {comm.get('path')})" if comm.get("path") else ""
                    context_str += f"  - {comm.get('author', 'unknown')}{path_str}: {comm.get('body', '')}\n"
            context_str += "---------------------------------\n"

    # Call LLM
    try:
        llm = get_llm(temperature=0.0)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert AI Code Archaeologist and Systems Architect. Your job is to analyze the commit history, diffs, and pull request discussions to extract key changes, decisions, and their rationale.
            
Analyze the history for the file and identify any key changes (such as initial creation, formatting fixes, link updates, bug fixes, features added, or workarounds). For each change, extract the developer's intent and reason.

For each change/decision, extract:
1. `summary`: A description of the change and the intent/reason behind it.
2. `commit_sha`: The commit SHA that introduced this change.
3. `pr_number`: The associated PR number, if any (or null).
4. `premise`: The core premise/assumption/reason behind the change (e.g. 'Link was outdated', 'Aligning code structure', 'Avoiding library X').
5. `confidence_score`: A float from 0.0 to 1.0 indicating how clearly the reasoning is stated in the logs.

Output a JSON array of these objects. Do not include any markdown format tags other than the JSON itself.
Format:
[
  {{
    "summary": "...",
    "commit_sha": "...",
    "pr_number": 123,
    "premise": "...",
    "confidence_score": 0.9
  }}
]
If no changes are found, return an empty array []."""),
            ("human", "Here is the history for the file:\n\n{context}")
        ])
        
        chain = prompt | llm
        response = await chain.ainvoke({"context": context_str})
        
        try:
            decisions = clean_and_parse_json(response.content)
            state["extracted_decisions"] = decisions
        except Exception as json_err:
            print(f"Failed to parse decisions JSON: {json_err}. Raw content: {response.content}")
            state["extracted_decisions"] = []
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"Decision extraction failed: {str(e)}"]
        state["extracted_decisions"] = []
        
    return state

async def verify_staleness_node(state: ExtractionState) -> ExtractionState:
    """
    Node 3: Verifies whether the decisions extracted are still valid or have become stale.
    In a real workspace we'd check current code, here we verify the current state in MongoDB 
    (e.g., has a later commit overwritten or removed the change, or is the premise still active).
    """
    decisions = state.get("extracted_decisions", [])
    commits = state.get("commits", [])
    
    if not decisions or not commits:
        state["verified_decisions"] = decisions
        return state
        
    verified = []
    
    # Sort commits by date descending to get the latest state
    latest_commits = sorted(commits, key=lambda x: x.get("author", {}).get("date", ""), reverse=True)
    latest_sha = latest_commits[0]["sha"] if latest_commits else ""
    
    for dec in decisions:
        dec_sha = dec.get("commit_sha")
        
        # Simple heuristic: If the decision was introduced in an old commit,
        # let's ask LLM if the premise holds given the latest commit's state.
        is_stale = False
        reason = ""
        
        # Only verify if we have a latest commit which is different from decision commit
        if latest_sha and dec_sha and latest_sha != dec_sha:
            try:
                # Ask LLM if the premise is still valid based on the progression
                llm = get_llm(temperature=0.0)
                prompt = ChatPromptTemplate.from_messages([
                    ("system", """You are a Code Decision Verifier.
                    We have extracted an engineering decision made in commit {dec_sha}:
                    Decision: {summary}
                    Premise: {premise}
                    
                    The latest state of the file is represented by commit {latest_sha}:
                    Latest commit message: {latest_msg}
                    
                    Analyze if the original decision/premise has been superseded, reverted, or if it is still active.
                    Output a JSON object with fields:
                    1. `is_stale`: boolean (true if the decision has been undone, replaced, or is no longer relevant)
                    2. `reason`: string (explanation of why it is or isn't stale)
                    """),
                    ("human", "Please verify.")
                ])
                
                chain = prompt | llm
                res = await chain.ainvoke({
                    "dec_sha": dec_sha,
                    "summary": dec["summary"],
                    "premise": dec["premise"],
                    "latest_sha": latest_sha,
                    "latest_msg": latest_commits[0]["message"]
                })
                
                try:
                    verdict = clean_and_parse_json(res.content)
                    is_stale = verdict.get("is_stale", False)
                    reason = verdict.get("reason", "")
                except Exception as json_err:
                    print(f"Failed to parse staleness JSON: {json_err}. Raw content: {res.content}")
                    is_stale = False
                    reason = "Could not verify automatically (JSON parse error)."
            except Exception as e:
                print(f"Staleness check failed for commit {dec_sha}: {str(e)}")
                is_stale = False
                reason = "Could not verify automatically."
                
        dec["staleness"] = {
            "checked": True,
            "isStale": is_stale,
            "reason": reason
        }
        verified.append(dec)
        
    state["verified_decisions"] = verified
    return state

async def save_decisions_node(state: ExtractionState) -> ExtractionState:
    """
    Node 4: Saves the verified decision records back into MongoDB
    """
    repo_id = state["repo_id"]
    file_path = state["file_path"]
    function_name = state["function_name"]
    decisions = state.get("verified_decisions", [])
    
    if not decisions:
        return state
        
    db_col = get_collection("decisionrecords")
    
    for dec in decisions:
        # Save or update decision records in DB
        await db_col.update_one(
            {
                "repoId": ObjectId(repo_id),
                "filePath": file_path,
                "commitSha": dec.get("commit_sha"),
            },
            {
                "$set": {
                    "repoId": ObjectId(repo_id),
                    "filePath": file_path,
                    "functionName": function_name,
                    "commitSha": dec.get("commit_sha"),
                    "prNumber": dec.get("pr_number"),
                    "summary": dec["summary"],
                    "staleness": dec["staleness"],
                    "updatedAt": datetime.now(timezone.utc)
                }
            },
            upsert=True
        )
        
    return state


# Build the extraction graph
extraction_builder = StateGraph(ExtractionState)
extraction_builder.add_node("retrieve_data", retrieve_data_node)
extraction_builder.add_node("extract_decisions", extract_decisions_node)
extraction_builder.add_node("verify_staleness", verify_staleness_node)
extraction_builder.add_node("save_decisions", save_decisions_node)

extraction_builder.set_entry_point("retrieve_data")
extraction_builder.add_edge("retrieve_data", "extract_decisions")
extraction_builder.add_edge("extract_decisions", "verify_staleness")
extraction_builder.add_edge("verify_staleness", "save_decisions")
extraction_builder.add_edge("save_decisions", END)

extraction_workflow = extraction_builder.compile()


# ==========================================
# 2. CHAT / SYNTHESIS PIPELINE
# ==========================================

class ChatState(TypedDict):
    repo_id: str
    message: str
    history: List[Dict[str, str]]
    commits: List[Dict[str, Any]]
    pull_requests: List[Dict[str, Any]]
    decisions: List[Dict[str, Any]]
    answer: str
    citations: List[Dict[str, Any]]
    errors: List[str]

async def retrieve_chat_context_node(state: ChatState) -> ChatState:
    """
    Node 1: Searches database for commits, PRs, and decisions matching user's query keywords
    """
    repo_id = state["repo_id"]
    query = state["message"]
    
    try:
        # Simple text search / regex matches in MongoDB for MVP
        commits_col = get_collection("commits")
        prs_col = get_collection("pullrequests")
        decisions_col = get_collection("decisionrecords")
        
        # Search commits
        commit_cursor = commits_col.find({
            "repoId": ObjectId(repo_id),
            "$or": [
                {"message": {"$regex": query, "$options": "i"}},
                {"files.filename": {"$regex": query, "$options": "i"}}
            ]
        })
        commits = await commit_cursor.to_list(length=10)
        
        # Search PRs
        pr_cursor = prs_col.find({
            "repoId": ObjectId(repo_id),
            "$or": [
                {"title": {"$regex": query, "$options": "i"}},
                {"body": {"$regex": query, "$options": "i"}},
                {"comments.body": {"$regex": query, "$options": "i"}}
            ]
        })
        prs = await pr_cursor.to_list(length=10)
        
        # Search decisions
        dec_cursor = decisions_col.find({
            "repoId": ObjectId(repo_id),
            "summary": {"$regex": query, "$options": "i"}
        })
        decisions = await dec_cursor.to_list(length=10)
        
        # If we got nothing, fallback to fetching recent commits/PRs
        if not commits and not prs:
            commits = await get_all_commits(repo_id)
            prs = await get_all_prs(repo_id)
            
        state["commits"] = commits[:15]
        state["pull_requests"] = prs[:15]
        state["decisions"] = decisions
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"Context search failed: {str(e)}"]
        state["commits"] = []
        state["pull_requests"] = []
        state["decisions"] = []
        
    return state

async def synthesize_answer_node(state: ChatState) -> ChatState:
    """
    Node 2: Core Synthesis Agent that formulates the reply using the context, citation list, and LLM
    """
    query = state["message"]
    commits = state.get("commits", [])
    prs = state.get("pull_requests", [])
    decisions = state.get("decisions", [])
    
    # Construct context
    context = ""
    if decisions:
        context += "--- Extracted Code Decisions ---\n"
        for d in decisions:
            context += f"- File: {d['filePath']} | Decision: {d['summary']}\n"
            if d.get("commitSha"):
                context += f"  Commit: {d['commitSha']}\n"
            if d.get("prNumber"):
                context += f"  PR: #{d['prNumber']}\n"
            if d.get("staleness", {}).get("isStale"):
                context += f"  [STALE PREMISE] {d['staleness']['reason']}\n"
            context += "\n"
            
    if commits:
        context += "--- Relevant Commits ---\n"
        for c in commits:
            context += f"Commit: {c['sha']}\n"
            context += f"Message: {c['message']}\n"
            context += f"Author: {c.get('author', {}).get('name', '')} | Date: {c.get('author', {}).get('date', '')}\n"
            context += "Files changed:\n"
            for f in c.get("files", [])[:3]: # limit list
                context += f"  - {f.get('filename', 'unknown')} ({f.get('status', 'unknown')})\n"
            context += "\n"
            
    if prs:
        context += "--- Relevant Pull Requests ---\n"
        for pr in prs:
            context += f"PR #{pr.get('number', 'unknown')}: {pr.get('title', '')}\n"
            context += f"Description: {pr.get('body', '')}\n"
            if pr.get("comments"):
                context += "Comments:\n"
                for comm in pr.get("comments", [])[:3]: # limit list
                    context += f"  - {comm.get('author', 'unknown')}: {comm.get('body', '')}\n"
            context += "\n"

    try:
        llm = get_llm(temperature=0.2)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are Chronicle AI, an expert AI Code Archaeologist. Your purpose is to explain why code was written the way it was, using commit history and PR discussions.
            
Using the provided historical context, answer the user's question.

CRITICAL INSTRUCTIONS:
1. Explain the CAUSAL history behind the code (e.g. 'This was changed because of a bug in library X, discussed in PR #...').
2. Always cite specific commits (SHA) and Pull Requests (#number) in the text when referring to code changes.
3. If the context contains a decision that is flagged as [STALE PREMISE], make sure to warn the user about it.
4. Output your response as a JSON object containing:
   - `answer`: The markdown-formatted response string.
   - `citations`: A JSON array of citation objects used.
   
Format of JSON output:
{{
  "answer": "Your markdown answer citing [commit_sha] and PR #...",
  "citations": [
    {{
      "type": "commit",
      "sha": "full_sha_here",
      "title": "commit message summary",
      "url": "optional_html_url"
    }},
    {{
      "type": "pr",
      "number": 123,
      "title": "PR title",
      "url": "optional_html_url"
    }}
  ]
}}"""),
            ("human", "Question: {query}\n\nContext:\n{context}")
        ])
        
        chain = prompt | llm
        response = await chain.ainvoke({"query": query, "context": context})
        
        try:
            result = clean_and_parse_json(response.content)
            state["answer"] = result.get("answer", "")
            state["citations"] = result.get("citations", [])
        except Exception as json_err:
            print(f"Failed to parse chatbot response as JSON: {json_err}. Raw content: {response.content}")
            state["answer"] = response.content
            state["citations"] = []
    except Exception as e:
        state["errors"] = state.get("errors", []) + [f"Answer synthesis failed: {str(e)}"]
        state["answer"] = f"Failed to synthesize answer: {str(e)}"
        state["citations"] = []
        
    return state


# Build the chat graph
chat_builder = StateGraph(ChatState)
chat_builder.add_node("retrieve_context", retrieve_chat_context_node)
chat_builder.add_node("synthesize_answer", synthesize_answer_node)

chat_builder.set_entry_point("retrieve_context")
chat_builder.add_edge("retrieve_context", "synthesize_answer")
chat_builder.add_edge("synthesize_answer", END)

chat_workflow = chat_builder.compile()
