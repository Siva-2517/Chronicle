# Chronicle Vue Timeline Client

The Vue application renders the interactive **Decision Archaeology Timeline** loaded inside the React workspace.

---

## 🛠️ Key Technologies
*   **Vue 3**: Composition API (`<script setup>`).
*   **Vite**: Fast development build runner.
*   **Axios**: Queries decisions and metadata directly from the Node backend on port `5000`.
*   **Lucide Vue Next**: Timeline icons.
*   **Tailwind CSS v3**: Tailwind styling matching the core dark theme.

---

## 📂 Features

### 1. URL Query Parsing
On mounting, the application parses the URL search parameters to locate the repository ID:
```javascript
const params = new URLSearchParams(window.location.search);
repoId.value = params.get('repoId');
```
It then fetches decisions matching that ID from: `http://localhost:5000/api/repos/<repoId>/decisions`.

### 2. Vertical Interactive Timeline
*   Renders a vertical line on the left with dots representing chronological decisions.
*   Shows a badge detailing the status of the decision: **Validated** (green check) vs. **Stale** (red warn/obsolete).
*   Displays the summary, file path, commit SHA, and PR number on each timeline card.

### 3. Context & Staleness Drawer
Clicking a card opens the right details sidebar:
*   Displays the full filename and target function.
*   Shows a prominent **Staleness Verification** card:
    *   *If Validated*: Green card indicating the original choice is still active.
    *   *If Stale*: Red card highlighting the reason why subsequent commits invalidated or replaced the change.
