# Chronicle React Client

The React application handles the dashboard, repository select panel, real-time ingestion status indicators, and the Decision Chat (RAG) assistant.

---

## 🛠️ Key Technologies
*   **React 19**: Frontend UI framework.
*   **Vite**: Fast development build runner.
*   **Redux Toolkit**: Manages repository arrays, selected IDs, loading states, and live ingestion updates.
*   **Socket.io-Client**: Connects to the Express backend to receive live progress feeds.
*   **Lucide React**: Clean icons.
*   **Tailwind CSS v3**: Glassmorphic dark styling.

---

## 📂 Features

### 1. Dashboard Sidebar
*   Allows pasting a GitHub URL or `owner/repo` string to connect.
*   Shows a list of all active repositories, styled with status badges (`Pending`, `Ingesting`, `Completed`, `Failed`).
*   Listens to live Socket.io progress feeds and displays a progress bar when a repo is in the `Ingesting` state.

### 2. Decision Chat Tab
*   Facilitates sending queries to the Python RAG agent.
*   Displays messages in a chat log.
*   Parses **Citations** returned by the agent. Each citation renders as a link pointing to the specific commit SHA or PR number that explains the decision.

### 3. Decision timeline Tab (Vite Vue Embed)
*   Integrates the Vue 3 application into the React workspace using a responsive `iframe` pointing to `http://localhost:3001/?repoId=<activeRepoId>`. This allows the two frontends to communicate seamlessly via URL parameters.

### 4. Target Extraction Sidebar
*   Enables entering a file path (e.g. `index.html`) to trigger the LangGraph agent service to extract historical decision records for the timeline view.
