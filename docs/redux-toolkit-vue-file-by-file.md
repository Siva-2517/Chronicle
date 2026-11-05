# File-by-File Explanation of Redux Toolkit and Vue Usage

This document explains the important files in the project, one by one, in a way that a beginner can follow.

---

## 1. [frontend/react-app/src/store/index.js](../frontend/react-app/src/store/index.js)

### What this file does

This file creates the Redux store for the React app.

```js
import { configureStore } from '@reduxjs/toolkit';
import repoReducer from './repoSlice';

export const store = configureStore({
  reducer: {
    repo: repoReducer,
  },
});
```

### Explanation

- `configureStore` is the Redux Toolkit function used to build the central application store.
- `repoReducer` is imported from the slice file.
- The reducer is attached under the name `repo`.

### In simple terms

This file says:

> “Create one shared state container and put all repository-related data under the `repo` section.”

### Why it matters

The app needs a shared place for data like:

- repo list
- selected repo
- loading state
- ingestion status
- errors

Without this file, the app would not have a central state manager.

---

## 2. [frontend/react-app/src/store/repoSlice.js](../frontend/react-app/src/store/repoSlice.js)

### What this file does

This is the main Redux slice for the app. It contains the repository-related state and all actions used to update it.

```js
const initialState = {
  repos: [],
  activeRepoId: null,
  ingestionProgress: {},
  loading: false,
  error: null,
};
```

### State explained

The state contains:

- `repos`: list of repositories
- `activeRepoId`: currently selected repo
- `ingestionProgress`: progress information for a repo
- `loading`: whether a request is in progress
- `error`: current app error message

### Slice definition

```js
const repoSlice = createSlice({
  name: 'repo',
  initialState,
  reducers: {
    ...
  },
});
```

### Reducers inside this slice

The project uses reducers like:

- `setRepos` → replace the repo list
- `addRepo` → add a repo if it is not already present
- `setActiveRepoId` → set currently selected repo
- `updateIngestionProgress` → update progress of repo ingestion
- `setLoading` → show or hide loading state
- `setError` → set the error message
- `deleteRepoInState` → remove a repo from state

### Example reducer

```js
setLoading: (state, action) => {
  state.loading = action.payload;
}
```

### Explanation

- `state` = current repo state
- `action.payload` = value sent with the action
- reducer updates the state based on that value

### Why it matters

This file is the core logic for the repo state. It keeps all repo-related updates in one place instead of spreading them across different components.

---

## 3. [frontend/react-app/src/App.jsx](../frontend/react-app/src/App.jsx)

### What this file does

This is the main React component for the app. It uses Redux state, API calls, socket events, and rendering for the interface.

### Key Redux usage

```js
const dispatch = useDispatch();
const { repos, activeRepoId, ingestionProgress } = useSelector(state => state.repo);
```

### Explanation

- `useDispatch()` gives access to Redux actions
- `useSelector()` reads data from the Redux store

So this component can both:

- read repo data from Redux
- update Redux when buttons or API calls happen

### Example actions in this file

```js
dispatch(setLoading(true));
dispatch(setRepos(res.data));
dispatch(setError(err.message));
dispatch(updateIngestionProgress(data));
```

### What this means in plain English

When the app loads repos, marks loading, handles errors, or updates ingestion progress, it tells Redux to update the shared state.

### Important concepts in this file

#### 1. State from Redux

The component reads global repo state using `useSelector`.

This means the app knows which repos exist and which one is active.

#### 2. Component local state

This file also has local React state like:

- `viewMode`
- `repoUrlInput`
- `chatSession`
- `messages`
- `commits`
- `decisions`
- `highlightedEraId`

This is local UI state, not global app state.

#### 3. API calls

The component fetches data from the backend using `axios`.

Example:

```js
const res = await axios.get(url);
```

These requests are then saved into Redux or local component state.

#### 4. Socket events

The component also listens for real-time updates:

```js
socketRef.current.on('ingestion_progress', (data) => {
  dispatch(updateIngestionProgress(data));
});
```

This is important because ingestion progress is updated as events arrive from the backend.

### Why this file is important

This is the central UI file that connects:

- Redux state
- backend API calls
- socket updates
- React rendering

It is the main bridge between app data and the UI.

---

## 4. [frontend/vue-app/src/App.vue](../frontend/vue-app/src/App.vue)

### What this file does

This is the Vue version of the app screen. It loads repository decisions from the backend and displays them in a timeline UI.

### Top of the file

```js
<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
```

### Explanation

- `script setup` is the modern Vue syntax for component logic
- `ref` is used for reactive variables
- `onMounted` runs when the component is loaded

### Reactive state

```js
const repoId = ref(null)
const decisions = ref([])
const loading = ref(true)
const error = ref(null)
const selectedDecision = ref(null)
```

These variables are reactive, which means:

- when their values change, the UI updates automatically
- Vue watches them and re-renders the page

### `onMounted` usage

```js
onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  repoId.value = params.get('repoId')

  if (repoId.value) {
    fetchDecisions()
  }
})
```

### Explanation

- read the URL query string
- get `repoId`
- if repo ID exists, load related decisions

### API call

```js
async function fetchDecisions() {
  loading.value = true
  error.value = null

  try {
    const res = await axios.get(`${BACKEND_URL}/api/repos/${repoId.value}/decisions`)
    decisions.value = res.data
  } catch (err) {
    error.value = 'Failed to load timeline decisions: ' + (err.response?.data?.error || err.message)
  } finally {
    loading.value = false
  }
}
```

### Explanation

This function:

- starts loading
- clears previous error
- calls backend API
- stores decisions in reactive state
- stops loading when done

### Why this is important

This file shows a good Vue pattern:

- reactive state
- mounted lifecycle
- async API calls
- template-driven rendering

---

## 5. [frontend/vue-app/src/components/HelloWorld.vue](../frontend/vue-app/src/components/HelloWorld.vue)

### What this file does

This is a simple example Vue component showing the basic Composition API pattern.

```js
<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>
```

### Explanation

This shows the simplest Vue reactive pattern:

- `ref(0)` creates a reactive number
- when the button is clicked, the value changes
- the template updates automatically

Example:

```html
<button type="button" class="counter" @click="count++">
  Count is {{ count }}
</button>
```

### Why this file matters

It is a beginner-friendly example of:

- `ref()`
- reactive data
- `@click` event binding
- template interpolation

This is useful for understanding how Vue state connects to UI updates.

---

## 6. Big idea: how React Redux and Vue are different in this project

### React + Redux Toolkit

The React app uses a global store, managed by Redux Toolkit.

It is best for:

- shared application state
- cross-component communication
- centralized logic

### Vue

The Vue app uses local reactive state and template-driven rendering.

It is best for:

- component-local state
- simpler reactive UIs
- direct DOM updates with less boilerplate

---

## 7. Summary

### Redux Toolkit files

- [frontend/react-app/src/store/index.js](../frontend/react-app/src/store/index.js) → creates the store
- [frontend/react-app/src/store/repoSlice.js](../frontend/react-app/src/store/repoSlice.js) → defines state and reducers
- [frontend/react-app/src/App.jsx](../frontend/react-app/src/App.jsx) → reads and updates Redux state

### Vue files

- [frontend/vue-app/src/App.vue](../frontend/vue-app/src/App.vue) → main Vue UI with data fetching and conditional rendering
- [frontend/vue-app/src/components/HelloWorld.vue](../frontend/vue-app/src/components/HelloWorld.vue) → beginner Vue example using `ref()` and `@click`

### Beginner takeaway

- Redux Toolkit is for shared app state in React.
- Vue uses reactive state and templates to update the UI.
- Both patterns are used to keep the app data and UI in sync.

This is enough for a fresher to understand the main architecture of the project.
