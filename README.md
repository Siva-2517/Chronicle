# Chronicle — AI Code Decision Archaeology Tool

Chronicle is an AI-powered agentic systems tool designed to explain **why** code was written the way it was. By analyzing commit histories, diff patches, pull request reviews, and developer discussions, Chronicle uncovers the "tribal knowledge" of a repository, answers questions with direct citations, and identifies when past decisions have become stale.

---

## 🚀 One-Line Pitch
An AI agent that explains *why* code in a GitHub repo was written the way it was—tracing commit history and PR discussions to give cited answers, and flagging when the original reasoning is now outdated.

---

## 🛠️ Tech Stack

### Frontend (Polyglot UI)
*   **React App (`/frontend/react-app`)**: Built with React 18 + Vite, state managed via **Redux Toolkit**. Handles repository select panel, live ingestion monitoring, and the decision chat interface.
*   **Vue App (`/frontend/vue-app`)**: Built with Vue 3 + Vite. Renders the interactive **Decision Timeline** cards and side details drawers. Embedded seamlessly inside the React app via `iframe` on port `3001`.
*   **Styling**: Styled with **Tailwind CSS v3** for a sleek, glassmorphic dark theme.

### Backend (Orchestration Layer)
*   **Node.js & Express (`/backend`)**: Manages the API routes, Mongo schemas, and schedules background tasks.
*   **Octokit/REST**: Standard paginated GitHub API integrations to pull repo histories.
*   **Socket.io**: Establishes websocket connections to stream granular progress logs live to the React UI.
*   **MongoDB & Mongoose**: Stores repositories, commits, pull requests, chat sessions, and decision records.

### Agent / AI Layer (Python microservice)
*   **FastAPI (`/agent-service`)**: Exposes REST endpoints to trigger agents.
*   **LangGraph**: Orchestrates a 4-agent state pipeline:
    1.  `retrieve_data_node` — Queries MongoDB to extract commits/PR discussions related to the target file.
    2.  `extract_decisions_node` — Invokes **Gemini 2.5 Flash** to analyze modifications and comments to compile decision summaries.
    3.  `verify_staleness_node` — Compares the decision's premise against subsequent commits to verify if it has been deprecated.
    4.  `save_decisions_node` — Upserts the decision records back to MongoDB.
*   **Google Gemini API**: Utilizes `gemini-2.5-flash` for reasoning/chat synthesis and `text-embedding-004` for semantic representation.

---

## 📂 Monorepo Structure

```
Chronicle/
├── backend/                  # Node/Express API & Ingestion Pipeline
│   ├── src/
│   │   ├── models/           # Mongoose schemas (Repo, Commit, PullRequest, etc.)
│   │   ├── services/         # GitHub API fetching & background ingestion
│   │   └── server.js         # API server entrypoint
│   └── package.json
├── agent-service/            # FastAPI Python LangGraph Agent
│   ├── database.py           # Async Motor MongoDB connection
│   ├── llm.py                # LangChain Gemini setup & API key fallback
│   ├── graph.py              # LangGraph pipelines (Extraction & Chat RAG)
│   ├── main.py               # FastAPI server entrypoint
│   └── requirements.txt
├── frontend/
│   ├── react-app/            # React 18 + Vite + Redux Toolkit Client (Port 3000)
│   └── vue-app/              # Vue 3 + Vite Decision Timeline Client (Port 3001)
└── package.json              # Monorepo root config
```

---

## ⚙️ Setup & Configuration

Ensure you have **Node.js (v18+)**, **Python (v3.10+)**, and a local **MongoDB** server running (default port `27017`).

### 1. Environment Configurations
Create `.env` files in both folders using the templates provided:

#### Node Backend (`/backend/.env`)
```ini
PORT=5000
MONGO_URI=mongodb://localhost:27017/chronicle
GITHUB_TOKEN=ghp_yourGitHubPersonalAccessToken
AGENT_SERVICE_URL=http://localhost:8000
```

#### Python Agent (`/agent-service/.env`)
```ini
MONGO_URI=mongodb://localhost:27017/chronicle
GEMINI_API_KEY=AIzaSyPrimaryGeminiKey
GEMINI_API_KEY_SECONDARY=AIzaSyBackupGeminiKey
```

### 2. Install Dependencies
At the root folder (`d:\Chronicle`), install all Node dependencies with:
```bash
npm run install:all
```
Set up the Python virtual environment and dependencies:
```bash
cd agent-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

---

## 🏃 Running the Application

### Step 1: Start the Python Agent
In your python-service terminal:
```bash
cd agent-service
.\venv\Scripts\activate
python main.py
```
*Runs FastAPI on `http://localhost:8000`.*

### Step 2: Start backend & frontends
In a separate terminal at the root directory:
```bash
npm run dev
```
*Concurrently launches:*
*   Express API: `http://localhost:5000`
*   React App: `http://localhost:3000`
*   Vue App: `http://localhost:3001`

Open **`http://localhost:3000`** in Chrome to start archaeology!
