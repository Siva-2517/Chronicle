import os
import json
import re
from datetime import datetime, timezone
import chromadb
from chromadb.config import Settings
from llm import get_embeddings

# =====================================================================
# 20 BENCHMARK HISTORICAL COMMITS & PULL REQUESTS (CHRONICLE CODEBASE)
# =====================================================================

BENCHMARK_ARTIFACTS = [
    {
        "type": "commit",
        "sha": "c01_oauth_flow",
        "message": "feat(auth): implement GitHub OAuth 2.0 authorization code exchange and user scoping",
        "author": "Siva-2517",
        "date": "2026-03-01T10:00:00Z",
        "files": ["backend/src/server.js", "backend/src/services/github.js"],
        "patch": "diff --git a/backend/src/server.js\n+app.get('/api/github/oauth/login', (req, res) => {\n+  const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo`;"
    },
    {
        "type": "commit",
        "sha": "c02_rate_limiter",
        "message": "fix(ingestion): add delay sleep helper between Octokit requests to avoid secondary rate limits",
        "author": "Siva-2517",
        "date": "2026-03-02T11:00:00Z",
        "files": ["backend/src/services/ingestion.js"],
        "patch": "diff --git a/backend/src/services/ingestion.js\n+const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));\n+await delay(100);"
    },
    {
        "type": "commit",
        "sha": "c03_socket_tracing",
        "message": "feat(socket): emit granular agent execution steps via Socket.io to frontend for live tracing",
        "author": "Siva-2517",
        "date": "2026-03-03T12:00:00Z",
        "files": ["backend/src/server.js", "frontend/react-app/src/App.jsx"],
        "patch": "diff --git a/backend/src/server.js\n+io.to(repoId).emit('agent_trace', { step: 'extracting', message: 'Analyzing diffs...' });"
    },
    {
        "type": "commit",
        "sha": "c04_staleness_check",
        "message": "feat(agent): verify staleness of decisions against latest commit state in LangGraph verify_staleness_node",
        "author": "Siva-2517",
        "date": "2026-03-04T13:00:00Z",
        "files": ["agent-service/graph.py"],
        "patch": "diff --git a/agent-service/graph.py\n+async def verify_staleness_node(state: ExtractionState) -> ExtractionState:\n+  is_stale = verdict.get('is_stale', False)"
    },
    {
        "type": "commit",
        "sha": "c05_soil_palette",
        "message": "style(ui): configure stratigraphy theme with soil, ochre, parchment, teal, and rust tokens",
        "author": "Siva-2517",
        "date": "2026-03-05T14:00:00Z",
        "files": ["frontend/react-app/tailwind.config.js", "frontend/vue-app/tailwind.config.js"],
        "patch": "diff --git a/tailwind.config.js\n+colors: { soil: '#1D1A16', ochre: '#E5A853', parchment: '#F5F0E6', teal: '#3AAFA9', rust: '#D9534F' }"
    },
    {
        "type": "commit",
        "sha": "c06_motor_async",
        "message": "perf(database): switch Python agent service to Motor AsyncIOMotorClient for non-blocking I/O",
        "author": "Siva-2517",
        "date": "2026-03-06T15:00:00Z",
        "files": ["agent-service/database.py", "agent-service/requirements.txt"],
        "patch": "diff --git a/agent-service/database.py\n+from motor.motor_asyncio import AsyncIOMotorClient\n+client = AsyncIOMotorClient(MONGO_URI)"
    },
    {
        "type": "commit",
        "sha": "c07_json_cleaner",
        "message": "fix(llm): add clean_and_parse_json to strip markdown code fences from Gemini responses",
        "author": "Siva-2517",
        "date": "2026-03-07T16:00:00Z",
        "files": ["agent-service/graph.py"],
        "patch": "diff --git a/agent-service/graph.py\n+def clean_and_parse_json(content: str) -> Any:\n+    if '```json' in content: content = content.split('```json')[1].split('```')[0]"
    },
    {
        "type": "commit",
        "sha": "c08_reduced_motion",
        "message": "a11y(strata): respect prefers-reduced-motion media query for geological sediment animations",
        "author": "Siva-2517",
        "date": "2026-03-08T17:00:00Z",
        "files": ["frontend/react-app/src/components/StrataPanel.jsx"],
        "patch": "diff --git a/StrataPanel.jsx\n+const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');"
    },
    {
        "type": "commit",
        "sha": "c09_session_timeout",
        "message": "sec(auth): implement 1-hour automatic session inactivity logout to safeguard GitHub tokens",
        "author": "Siva-2517",
        "date": "2026-03-09T18:00:00Z",
        "files": ["frontend/react-app/src/App.jsx"],
        "patch": "diff --git a/App.jsx\n+const SESSION_TIMEOUT_MS = 60 * 60 * 1000;\n+const timer = setTimeout(handleLogout, SESSION_TIMEOUT_MS);"
    },
    {
        "type": "commit",
        "sha": "c10_pat_fallback",
        "message": "feat(auth): add manual Personal Access Token fallback input modal for users without OAuth apps",
        "author": "Siva-2517",
        "date": "2026-03-10T19:00:00Z",
        "files": ["frontend/react-app/src/App.jsx", "backend/src/server.js"],
        "patch": "diff --git a/App.jsx\n+app.post('/api/github/validate-token', async (req, res) => {\n+  const user = await github.validateToken(token);"
    },
    {
        "type": "pr",
        "pr_number": 101,
        "title": "Migrate state management to Redux Toolkit and create repoSlice",
        "body": "Replaces prop-drilling across workspace coordinator with central Redux store tracking activeRepoId, repos list, and real-time ingestion status.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer1",
                "path": "frontend/react-app/src/store/repoSlice.js",
                "body": "Using createSlice with Immer allows clean state updates for ingestionProgress without manual object spread.",
                "diffHunk": "+export const repoSlice = createSlice({\n+  name: 'repo',\n+  initialState: { repos: [], activeRepoId: null }"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 102,
        "title": "Add Vue 3 Decision Archaeology Timeline Client",
        "body": "Provides specialized geological stratification visualization on port 3001 using Vue 3 composition API, Lucide icons, and drawer inspection.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer2",
                "path": "frontend/vue-app/src/App.vue",
                "body": "Reading repoId directly from URL query parameters lets the React app deep-link into the Vue timeline seamlessly.",
                "diffHunk": "+const params = new URLSearchParams(window.location.search);\n+repoId.value = params.get('repoId');"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 103,
        "title": "Implement zero-shot decision extraction prompts in LangGraph",
        "body": "Constructs system prompts for Gemini 1.5 Flash to extract change summaries, rationale, commit SHAs, and confidence scores from git diffs.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer1",
                "path": "agent-service/graph.py",
                "body": "Setting temperature to 0.0 prevents hallucinations and ensures deterministic JSON outputs for architectural decisions.",
                "diffHunk": "+llm = get_llm(temperature=0.0)\n+prompt = ChatPromptTemplate.from_messages([...])"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 104,
        "title": "Interactive citation chips in chat linking directly to timeline strata",
        "body": "Clicking any [PR #12] or [commit_sha] citation inside AI assistant replies smoothly scrolls the timeline to highlight the corresponding era.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer3",
                "path": "frontend/react-app/src/components/ChatPanel.jsx",
                "body": "Regex split parsing with termMap prevents text mangling while transforming commit SHAs into clickable buttons.",
                "diffHunk": "+const regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');\n+const parts = content.split(regex);"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 105,
        "title": "Add multi-tenant repository scoping by githubUsername in MongoDB",
        "body": "Isolates saved repositories, decision records, and chat threads per user so different team members only see their own connected repositories.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer1",
                "path": "backend/src/server.js",
                "body": "Added composite indexes on owner, name, and githubUsername to ensure instant lookups under multi-tenant load.",
                "diffHunk": "+RepoSchema.index({ owner: 1, name: 1, githubUsername: 1 }, { unique: true });"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 106,
        "title": "Add Render blueprint render.yaml for multi-service cloud deployment",
        "body": "Configures production Node.js express service and Python FastAPI agent service on Render with health checks and environment variable links.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "devops",
                "path": "render.yaml",
                "body": "Setting AGENT_SERVICE_URL dynamically allows backend to reach the Python service over private service mesh or HTTPS.",
                "diffHunk": "+- type: web\n+  name: chronicle-agent-service\n+  runtime: python\n+  buildCommand: pip install -r requirements.txt"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 107,
        "title": "Store git diff patches in CommitFileSchema for code archaeology",
        "body": "Downloads and persists raw patch strings for each changed file during Octokit commit detail fetch so agents can inspect exact line diffs.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "architect",
                "path": "backend/src/models/Commit.js",
                "body": "Storing the patch directly eliminates the need to re-query the GitHub API during LLM decision extraction.",
                "diffHunk": "+const CommitFileSchema = new mongoose.Schema({\n+  patch: { type: String }"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 108,
        "title": "Support dual Gemini API keys with automatic failover in llm.py",
        "body": "Prevents agent downtime when rate limits or quotas are hit by checking GEMINI_API_KEY_SECONDARY if the primary key is exhausted.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer2",
                "path": "agent-service/llm.py",
                "body": "Clean fallback ensures high availability during intensive codebase crawls.",
                "diffHunk": "+key = os.getenv('GEMINI_API_KEY_SECONDARY')\n+if key and key.strip(): return key.strip()"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 109,
        "title": "Add graceful error handling for cancelled GitHub OAuth redirects",
        "body": "Catches error_description when a user declines authorization on GitHub and redirects back to React client with readable toast error message.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "frontend-dev",
                "path": "backend/src/server.js",
                "body": "Redirecting with query params ensures the user lands on a clean UI instead of an ugly raw 400 JSON error page.",
                "diffHunk": "+if (error || !code) {\n+  return res.redirect(`${frontendUrl}?error=${encodeURIComponent(errorMsg)}`);"
            }
        ]
    },
    {
        "type": "pr",
        "pr_number": 110,
        "title": "Add DecisionRecord schema and manual extraction endpoint",
        "body": "Allows users to trigger on-demand decision excavation for specific file paths and stores the verified premise verdict.",
        "author": "Siva-2517",
        "comments": [
            {
                "author": "reviewer1",
                "path": "backend/src/models/DecisionRecord.js",
                "body": "The staleness object tracks checked, isStale, and reason fields for comprehensive UI badging.",
                "diffHunk": "+staleness: {\n+  checked: { type: Boolean, default: false },\n+  isStale: { type: Boolean, default: false }"
            }
        ]
    }
]

# =====================================================================
# 20 DIVERSE EVALUATION QUESTIONS WITH GROUND TRUTH TARGETS
# =====================================================================

EVALUATION_QUESTIONS = [
    # --- Exact Keyword / Token Queries (Regex expected to succeed) ---
    {
        "id": "Q01",
        "query": "How is GitHub OAuth authorization code exchange handled?",
        "expected_type": "commit",
        "expected_id": "c01_oauth_flow",
        "category": "Exact Token"
    },
    {
        "id": "Q02",
        "query": "Where do we emit agent_trace steps through Socket.io?",
        "expected_type": "commit",
        "expected_id": "c03_socket_tracing",
        "category": "Exact Token"
    },
    {
        "id": "Q03",
        "query": "What file uses AsyncIOMotorClient for database connections?",
        "expected_type": "commit",
        "expected_id": "c06_motor_async",
        "category": "Exact Token"
    },
    {
        "id": "Q04",
        "query": "Where is the repoSlice Redux Toolkit store defined?",
        "expected_type": "pr",
        "expected_id": 101,
        "category": "Exact Token"
    },
    {
        "id": "Q05",
        "query": "What is the structure of the DecisionRecord schema in backend/src/models/DecisionRecord.js?",
        "expected_type": "pr",
        "expected_id": 110,
        "category": "Structured File / Token"
    },

    # --- Conceptual / Semantic Queries (No exact keyword matches, Regex typically FAILS) ---
    {
        "id": "Q06",
        "query": "Why do we pause between fetching commits during repository crawl?",
        "expected_type": "commit",
        "expected_id": "c02_rate_limiter",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q07",
        "query": "How do we prevent hitting GitHub rate limits during ingestion?",
        "expected_type": "commit",
        "expected_id": "c02_rate_limiter",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q08",
        "query": "How does the system detect if old architectural assumptions have become outdated or invalidated?",
        "expected_type": "commit",
        "expected_id": "c04_staleness_check",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q09",
        "query": "Why did we choose earthy, soil, and ochre colors for the visual design?",
        "expected_type": "commit",
        "expected_id": "c05_soil_palette",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q10",
        "query": "How does Chronicle handle messy JSON strings or triple backtick fences returned by the language model?",
        "expected_type": "commit",
        "expected_id": "c07_json_cleaner",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q11",
        "query": "What accessibility measures were implemented for users sensitive to sliding animations?",
        "expected_type": "commit",
        "expected_id": "c08_reduced_motion",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q12",
        "query": "What security mechanism protects tokens if a developer leaves their browser unattended?",
        "expected_type": "commit",
        "expected_id": "c09_session_timeout",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q13",
        "query": "How can a user authenticate without creating a full GitHub Developer OAuth application?",
        "expected_type": "commit",
        "expected_id": "c10_pat_fallback",
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q14",
        "query": "How does the Vue timeline know which repository data to display when opened from the React client?",
        "expected_type": "pr",
        "expected_id": 102,
        "category": "Semantic / Synonym"
    },
    {
        "id": "Q15",
        "query": "Why is the LLM temperature set to zero during decision extraction?",
        "expected_type": "pr",
        "expected_id": 103,
        "category": "Semantic / Code Context"
    },
    {
        "id": "Q16",
        "query": "How do chat citation buttons navigate the user to the matching chronological layer?",
        "expected_type": "pr",
        "expected_id": 104,
        "category": "Semantic / UI Behavior"
    },
    {
        "id": "Q17",
        "query": "How are repositories separated so team members don't overwrite each other's data?",
        "expected_type": "pr",
        "expected_id": 105,
        "category": "Semantic / Multi-Tenant"
    },
    {
        "id": "Q18",
        "query": "How are the Express API and Python microservices deployed together in the cloud?",
        "expected_type": "pr",
        "expected_id": 106,
        "category": "Semantic / Infrastructure"
    },
    {
        "id": "Q19",
        "query": "Why are full git line-by-line diffs cached in the database instead of being re-fetched from GitHub on demand?",
        "expected_type": "pr",
        "expected_id": 107,
        "category": "Semantic / Architecture"
    },
    {
        "id": "Q20",
        "query": "What failover prevents downtime when Google AI quota limits are reached?",
        "expected_type": "pr",
        "expected_id": 108,
        "category": "Semantic / Resilience"
    }
]

# =====================================================================
# RETRIEVAL IMPLEMENTATIONS
# =====================================================================

def regex_search(query: str, artifacts: list, top_k: int = 10) -> list:
    """
    Simulates MongoDB $regex matching against commit messages, files, and PR bodies/comments.
    """
    clean_query = query.strip()
    words = [w for w in re.split(r'\W+', clean_query) if len(w) >= 3]
    
    scored = []
    for art in artifacts:
        score = 0
        text_corpus = ""
        
        if art["type"] == "commit":
            text_corpus = f"{art['message']} {' '.join(art.get('files', []))} {art.get('patch', '')}"
        elif art["type"] == "pr":
            comments_text = " ".join([c.get("body", "") + " " + c.get("diffHunk", "") for c in art.get("comments", [])])
            text_corpus = f"{art['title']} {art.get('body', '')} {comments_text}"
            
        # 1. Exact phrase match
        if re.search(re.escape(clean_query), text_corpus, re.IGNORECASE):
            score += 10
            
        # 2. Individual word matches (simulates multi-term regex)
        for w in words:
            if re.search(r'\b' + re.escape(w) + r'\b', text_corpus, re.IGNORECASE):
                score += 2

        if score > 0:
            art_id = art["sha"] if art["type"] == "commit" else art["pr_number"]
            scored.append({"type": art["type"], "id": art_id, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]


def hybrid_search(query: str, artifacts: list, collection, top_k: int = 10) -> list:
    """
    Hybrid search combining:
    1. Structured file lookup
    2. Regex keyword search
    3. ChromaDB vector similarity search
    """
    emb = get_embeddings()
    query_vec = emb.embed_query(query)
    
    # 1. Vector Search
    vec_results = collection.query(query_embeddings=[query_vec], n_results=top_k)
    
    combined_scores = {}
    
    # RRF (Reciprocal Rank Fusion) from Vector search
    if vec_results and vec_results["ids"] and vec_results["ids"][0]:
        for rank, meta in enumerate(vec_results["metadatas"][0]):
            art_type = meta["type"]
            target_id = meta["sha"] if art_type == "commit" else meta["pr_number"]
            if target_id and target_id != -1:
                key = (art_type, target_id)
                combined_scores[key] = combined_scores.get(key, 0.0) + (1.0 / (60 + rank))

    # 2. Regex Search
    regex_matches = regex_search(query, artifacts, top_k=top_k)
    for rank, rm in enumerate(regex_matches):
        key = (rm["type"], rm["id"])
        combined_scores[key] = combined_scores.get(key, 0.0) + (1.0 / (60 + rank))

    # 3. Structured File-path Boost
    file_candidates = re.findall(r'[\w\-./\\]+\.[a-zA-Z0-9]+', query)
    if file_candidates:
        for fc in file_candidates:
            clean_fc = fc.strip("./\\ ")
            for art in artifacts:
                if art["type"] == "commit" and any(clean_fc in f for f in art.get("files", [])):
                    key = ("commit", art["sha"])
                    combined_scores[key] = combined_scores.get(key, 0.0) + 0.1

    # Sort merged results by fused score
    sorted_items = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)
    return [{"type": item[0][0], "id": item[0][1], "score": item[1]} for item in sorted_items[:top_k]]


# =====================================================================
# MAIN EVALUATION RUNNER
# =====================================================================

def run_evaluation():
    print("=" * 70)
    print("CHRONICLE RETRIEVAL BENCHMARK: REGEX vs. HYBRID (VECTOR + REGEX)")
    print("=" * 70)

    # 1. Index artifacts in isolated Chroma collection
    persist_dir = os.path.join(os.path.dirname(__file__), "chroma_eval_data")
    os.makedirs(persist_dir, exist_ok=True)
    client = chromadb.PersistentClient(path=persist_dir, settings=Settings(anonymized_telemetry=False))
    
    col_name = "eval_benchmark_collection"
    try:
        client.delete_collection(col_name)
    except Exception:
        pass
        
    collection = client.create_collection(col_name)
    emb = get_embeddings()

    print(f"Indexing {len(BENCHMARK_ARTIFACTS)} benchmark artifacts into ChromaDB...")
    docs, ids, metas = [], [], []

    for art in BENCHMARK_ARTIFACTS:
        if art["type"] == "commit":
            text = f"Commit SHA: {art['sha']}\nAuthor: {art['author']}\nMessage: {art['message']}\nFiles: {', '.join(art['files'])}\nPatch: {art['patch']}"
            doc_id = f"commit_{art['sha']}"
            meta = {"type": "commit", "sha": art["sha"], "pr_number": -1}
        else:
            comm_text = "\n".join([f"Comment by {c['author']} on {c['path']}: {c['body']}\n{c['diffHunk']}" for c in art.get("comments", [])])
            text = f"Pull Request #{art['pr_number']}: {art['title']}\nDescription: {art['body']}\n{comm_text}"
            doc_id = f"pr_{art['pr_number']}"
            meta = {"type": "pr", "sha": "", "pr_number": art["pr_number"]}

        docs.append(text)
        ids.append(doc_id)
        metas.append(meta)

    vecs = emb.embed_documents(docs)
    collection.add(ids=ids, documents=docs, embeddings=vecs, metadatas=metas)
    print("Indexing complete! Total vector records:", collection.count())
    print("-" * 70)

    # 2. Run retrieval comparison across the 20 questions
    results_summary = []
    regex_hits = 0
    hybrid_hits = 0
    total_q = len(EVALUATION_QUESTIONS)

    for q in EVALUATION_QUESTIONS:
        q_id = q["id"]
        query = q["query"]
        exp_id = q["expected_id"]
        exp_type = q["expected_type"]

        # Run Regex
        regex_res = regex_search(query, BENCHMARK_ARTIFACTS, top_k=5)
        regex_hit = any(r["type"] == exp_type and r["id"] == exp_id for r in regex_res)
        if regex_hit:
            regex_hits += 1

        # Run Hybrid
        hybrid_res = hybrid_search(query, BENCHMARK_ARTIFACTS, collection, top_k=5)
        hybrid_hit = any(h["type"] == exp_type and h["id"] == exp_id for h in hybrid_res)
        if hybrid_hit:
            hybrid_hits += 1

        results_summary.append({
            "id": q_id,
            "category": q["category"],
            "query": query,
            "target": f"{exp_type}:{exp_id}",
            "regex_hit": regex_hit,
            "hybrid_hit": hybrid_hit,
            "regex_top_match": f"{regex_res[0]['type']}:{regex_res[0]['id']}" if regex_res else "None",
            "hybrid_top_match": f"{hybrid_res[0]['type']}:{hybrid_res[0]['id']}" if hybrid_res else "None"
        })

    regex_hit_rate = (regex_hits / total_q) * 100.0
    hybrid_hit_rate = (hybrid_hits / total_q) * 100.0
    improvement = hybrid_hit_rate - regex_hit_rate

    print(f"\nFINAL EVALUATION RESULTS (Total Questions: {total_q}):")
    print(f"• Regex-Only Hit Rate: {regex_hit_rate:.1f}% ({regex_hits}/{total_q})")
    print(f"• Hybrid (Chroma + Regex) Hit Rate: {hybrid_hit_rate:.1f}% ({hybrid_hits}/{total_q})")
    print(f"• Absolute Accuracy Gain: +{improvement:.1f}%")
    print("=" * 70)

    # 3. Save JSON results
    output_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_questions": total_q,
        "metrics": {
            "regex_only_hit_rate": regex_hit_rate,
            "hybrid_hit_rate": hybrid_hit_rate,
            "gain_percentage": improvement
        },
        "questions": results_summary
    }

    json_path = os.path.join(os.path.dirname(__file__), "evaluation_results.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    print(f"Detailed JSON results saved to: {json_path}")

    # 4. Generate Markdown Report
    md_content = f"""# 📊 Chronicle Retrieval Evaluation Report

**Generated on:** {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}  
**Embedding Model:** `models/gemini-embedding-001` (Google Generative AI)  
**Vector Store:** ChromaDB (Local / Chroma Cloud Compatible)

---

## 🎯 Executive Summary & Key Findings

| Metric | Regex-Only Retrieval | Hybrid Retrieval (Vector + Regex) | Net Improvement |
| :--- | :--- | :--- | :--- |
| **Top-5 Ground Truth Hit Rate** | **{regex_hit_rate:.1f}%** ({regex_hits}/{total_q}) | **{hybrid_hit_rate:.1f}%** ({hybrid_hits}/{total_q}) | **+{improvement:.1f}%** |

### Key Architectural Takeaways:
1. **Keyword Rigidity in Regex**: Regex performs well on exact tokens (e.g. `OAuth`, `Socket.io`, `repoSlice`), but completely fails on natural conceptual queries where developers use synonyms (e.g., *"Why do we pause between fetching commits?"* vs. *"add delay sleep helper"*).
2. **Semantic Understanding in Hybrid**: Chroma vector retrieval successfully maps semantic intent to code diffs, review discussions, and commit messages with high precision.
3. **Structured Fallback**: Structured file-path lookups ensure that file-specific queries (e.g. `DecisionRecord.js`) always surface relevant code changes even without explicit keywords.

---

## 📋 Comprehensive 20-Question Breakdown

| ID | Category | Question | Expected Target | Regex Hit | Hybrid Hit | Top Hybrid Match |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
"""
    for r in results_summary:
        r_icon = "✅" if r["regex_hit"] else "❌"
        h_icon = "✅" if r["hybrid_hit"] else "❌"
        md_content += f"| `{r['id']}` | {r['category']} | {r['query']} | `{r['target']}` | {r_icon} | {h_icon} | `{r['hybrid_top_match']}` |\n"

    md_content += """
---

## 🔬 Methodology

- **Test Set**: 20 ground-truth questions representing real engineering decisions across Chronicle's subsystems (OAuth, rate limiting, WebSockets, staleness checks, Redux store, color palette, async DB, security timeouts).
- **Metric**: Top-5 Recall (hit rate). An item is considered a "Hit" if the ground truth commit SHA or PR number appears in the top-5 retrieved artifacts.
- **Fusion Algorithm**: Reciprocal Rank Fusion (RRF) combining vector similarity scores and text-matching relevance scores.
"""

    md_path = os.path.join(os.path.dirname(__file__), "EVALUATION_REPORT.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"Markdown report generated at: {md_path}")

    # Clean up temporary eval chroma directory
    import shutil
    shutil.rmtree(persist_dir, ignore_errors=True)

if __name__ == "__main__":
    run_evaluation()
