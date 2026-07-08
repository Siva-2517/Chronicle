# Chronicle Backend

The backend layer for **Chronicle** is a Node.js Express server that coordinates MongoDB data models, executes background repository ingestion, and communicates with the Python agent service.

---

## 🛠️ Key Technologies
*   **Express**: Framework for REST API endpoints.
*   **Mongoose (MongoDB)**: For database models and text indices.
*   **Octokit/REST**: Official GitHub API client to pull commits, patches, PR details, and comments.
*   **Socket.io**: Broadcasts live progress percentages of git/PR indexing to clients.
*   **Axios**: Communicates with the FastAPI LangGraph agent.

---

## 📂 Codebase Directory
*   `/src/models/`:
    *   `Repo.js` — Stores repository configuration and ingestion status (`pending`, `ingesting`, `completed`, `failed`).
    *   `Commit.js` — Stores SHAs, messages, authors, dates, and diff patches.
    *   `PullRequest.js` — Stores PR descriptions, state, reviews, associated commits, and inline comments.
    *   `DecisionRecord.js` — Stores LangGraph decision summaries, confidence scores, and staleness verdicts.
    *   `ChatSession.js` — Stores session histories, messages, and citations.
*   `/src/services/`:
    *   `github.js` — Octokit integration to list commits, get diffs, fetch PR discussions, and review threads.
    *   `ingestion.js` — Runs background ingestion jobs, paginating through records and emitting progress values over Socket.io rooms.
*   `/src/server.js`: Connects to MongoDB, configures WebSocket rooms, and defines REST endpoints.

---

## 🔌 API Reference

### 1. Repository Management
*   `GET /api/repos` — Returns all connected repositories.
*   `POST /api/repos/connect` — Registers a new repository and triggers background ingestion.
    *   *Body*: `{ "repoUrl": "owner/name" }`
*   `GET /api/repos/:id` — Gets detailed status/metadata for a repository.
*   `DELETE /api/repos/:id` — Disconnects the repo and deletes all related commits, PRs, chat sessions, and decisions.

### 2. Git & PR Metadata
*   `GET /api/repos/:id/commits` — Lists all ingested commits (excluding diffs).
*   `GET /api/repos/:id/commits/:sha` — Returns files changed and git diff patches for a commit.
*   `GET /api/repos/:id/prs` — Lists all ingested Pull Requests.
*   `GET /api/repos/:id/prs/:number` — Returns comments, reviews, and associated commit list for a PR.

### 3. Chat sessions
*   `POST /api/chat/session` — Registers a new chat session for a repository.
    *   *Body*: `{ "repoId": "ObjectID" }`
*   `GET /api/chat/session/:sessionId` — Returns session history logs.
*   `POST /api/chat/session/:sessionId/message` — Dispatches message to Python Agent, appends assistant response + citations, and returns updated session logs.
    *   *Body*: `{ "content": "Why was Y written like this?" }`

### 4. Decision Archaeology
*   `GET /api/repos/:id/decisions` — Lists all cached timelines decisions.
*   `POST /api/repos/:id/extract-decision` — Requests the LangGraph Agent to run extraction on a file path, saves the results, and returns them.
    *   *Body*: `{ "filePath": "src/index.js", "functionName": null }`
