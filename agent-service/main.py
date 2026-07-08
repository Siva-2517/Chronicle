import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from graph import extraction_workflow, chat_workflow

app = FastAPI(title="Chronicle Agent Service", version="1.0.0")

# CORS middleware for Node API communications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- PYDANTIC SCHEMAS ---

class DecisionRequest(BaseModel):
    repo_id: str = Field(..., description="MongoDB repo ID")
    file_path: str = Field(..., description="File path relative to repo root")
    function_name: Optional[str] = Field(None, description="Optional target function name")

class ChatRequest(BaseModel):
    repo_id: str = Field(..., description="MongoDB repo ID")
    session_id: str = Field(..., description="MongoDB ChatSession ID")
    message: str = Field(..., description="User question")

# --- ENDPOINTS ---

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Chronicle Agent Service"}

@app.post("/api/agent/extract")
async def extract_decisions(payload: DecisionRequest):
    try:
        # Run LangGraph Extraction Pipeline
        initial_state = {
            "repo_id": payload.repo_id,
            "file_path": payload.file_path,
            "function_name": payload.function_name,
            "commits": [],
            "pull_requests": [],
            "extracted_decisions": [],
            "verified_decisions": [],
            "errors": []
        }
        
        print(f"Triggering decision extraction for repo {payload.repo_id}, file: {payload.file_path}")
        result_state = await extraction_workflow.ainvoke(initial_state)
        
        if result_state.get("errors"):
            print("Extraction warnings/errors:", result_state["errors"])
            
        # Return all verified decisions
        decisions = result_state.get("verified_decisions", [])
        if not decisions:
            return {
                "decisions": [{
                    "summary": "No engineering decisions could be extracted from history for this file.",
                    "commit_sha": "",
                    "pr_number": None,
                    "staleness": {"checked": True, "isStale": False, "reason": "No decisions extracted"}
                }]
            }
            
        return {"decisions": decisions}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent service error during extraction: {str(e)}")

@app.post("/api/agent/chat")
async def chat_with_agent(payload: ChatRequest):
    try:
        # Run LangGraph Chat Synthesis Pipeline
        initial_state = {
            "repo_id": payload.repo_id,
            "message": payload.message,
            "history": [],
            "commits": [],
            "pull_requests": [],
            "decisions": [],
            "answer": "",
            "citations": [],
            "errors": []
        }
        
        print(f"Triggering chat synthesis for session {payload.session_id}, query: {payload.message}")
        result_state = await chat_workflow.ainvoke(initial_state)
        
        if result_state.get("errors"):
            print("Chat synthesis warnings/errors:", result_state["errors"])
            
        return {
            "response": result_state.get("answer", "I couldn't synthesize an answer."),
            "citations": result_state.get("citations", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent service error during chat synthesis: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
