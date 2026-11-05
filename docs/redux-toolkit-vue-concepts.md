# Redux Toolkit and Vue Concepts Used in This Project

This document explains the important state-management and UI concepts used in this project in a simple way, so even a beginner can understand what is happening.

## 1. What is Redux Toolkit?

Redux Toolkit is the modern and easier way to work with Redux in React applications.

Think of it like this:

- A React app has many components.
- Some data is shared among several components.
- Instead of passing that data through many props, we store it in one central place called the store.
- Redux Toolkit makes that process easier and more structured.

In this project, Redux Toolkit is used in the React app to manage repository data such as:

- all repositories
- the currently selected repository
- loading status
- error messages
- ingestion progress

The main files are:

- [frontend/react-app/src/store/index.js](../frontend/react-app/src/store/index.js)
- [frontend/react-app/src/store/repoSlice.js](../frontend/react-app/src/store/repoSlice.js)
- [frontend/react-app/src/App.jsx](../frontend/react-app/src/App.jsx)

---

## 2. Why this project uses Redux Toolkit

The app has many parts that need the same repository information.

For example:

- the list of repos is displayed in the app
- the selected repo must be known across different sections
- ingestion progress updates must be shared to UI screens
- loading and error states need to be visible everywhere

Instead of keeping the same data in multiple local component states, Redux keeps it in one central state store.

This makes the app easier to manage and avoids bugs caused by duplicated state.

---

## 3. Redux Toolkit concept: configureStore

The store is created using `configureStore`.

- File: [frontend/react-app/src/store/index.js](../frontend/react-app/src/store/index.js)

Example conceptually:

- `configureStore` creates the global application state container.
- Inside it, we register reducers.

In this project, the app has a reducer called `repo`:

- `repo: repoReducer`

This means the app state has a `repo` section, and all repo-related values live inside it.

### In simple words

`configureStore` is like creating a central box where all shared app data is stored.

---

## 4. Redux Toolkit concept: createSlice

A slice is a logical section of the app state.

- File: [frontend/react-app/src/store/repoSlice.js](../frontend/react-app/src/store/repoSlice.js)

The project creates a slice named `repo`.

```js
const repoSlice = createSlice({
  name: 'repo',
  initialState,
  reducers: {
    ...
  }
});
```

### What does a slice do?

A slice gives you:

- a state object
- a set of reducer functions
- auto-generated action creators

So instead of writing big Redux boilerplate, we keep the logic together in one place.

---

## 5. Redux Toolkit concept: initialState

`initialState` is the starting value of the slice.

In this project, the repo state starts like this:

- `repos: []`
- `activeRepoId: null`
- `ingestionProgress: {}`
- `loading: false`
- `error: null`

This means when the app loads, the repo state is empty and ready to be filled later.

### In simple words

The initial state is the default value before the app fetches data or user actions happen.

---

## 6. Redux Toolkit concept: reducers

Reducers are functions that decide how state changes.

In this project the reducers are:

- `setRepos`
- `addRepo`
- `setActiveRepoId`
- `updateIngestionProgress`
- `setLoading`
- `setError`
- `deleteRepoInState`

Example:

```js
setLoading: (state, action) => {
  state.loading = action.payload;
};
```

### What this means

- `state` = current state
- `action` = data sent with the action
- reducer updates the state based on that action

This is a very important Redux Toolkit pattern.

### Beginner explanation

A reducer says:

> “When this action happens, change the state in this way.”

---

## 7. Redux Toolkit concept: actions and action creators

When we want to change state, we dispatch an action.

Redux Toolkit automatically creates action creators from the slice.

Examples from this project:

- `setRepos`
- `addRepo`
- `setActiveRepoId`
- `updateIngestionProgress`
- `setLoading`
- `setError`
- `deleteRepoInState`

Example:

```js
dispatch(setLoading(true));
```

This tells Redux: “update the loading status to true.”

### In simple words

Actions are messages that tell the app, “something happened, update the state.”

---

## 8. Redux Toolkit concept: dispatch

Dispatch is how we send an action to the Redux store.

- File: [frontend/react-app/src/App.jsx](../frontend/react-app/src/App.jsx)

Example from the project:

```js
const dispatch = useDispatch();

dispatch(setLoading(true));
dispatch(setRepos(res.data));
dispatch(setError(err.message));
```

### Why this matters

Without dispatch, the Redux state would never change.

### Beginner explanation

`dispatch` is like pressing a button that sends an instruction to the central state manager.

---

## 9. Redux Toolkit concept: useSelector

`useSelector` is used to read data from the Redux store inside a React component.

- File: [frontend/react-app/src/App.jsx](../frontend/react-app/src/App.jsx)

Example:

```js
const { repos, activeRepoId, ingestionProgress } = useSelector(
  (state) => state.repo,
);
```

### What is happening here?

- React asks Redux for the current value of `state.repo`
- the component receives `repos`, `activeRepoId`, and `ingestionProgress`
- whenever the store changes, the component re-renders automatically

### In simple words

`useSelector` is how a component reads data from the global app state.

---

## 10. Redux Toolkit concept: useDispatch

`useDispatch` gives a component the ability to send actions to the store.

Example:

```js
const dispatch = useDispatch();
```

Then the component can do things like:

- start loading
- save repo data
- update the selected repo
- update progress messages
- mark errors

### In simple words

`useDispatch` is the way to trigger state updates from a component.

---

## 11. Project-specific Redux state model

This project uses one main slice called `repo`.

The state shape is:

- `repo.repos`
- `repo.activeRepoId`
- `repo.ingestionProgress`
- `repo.loading`
- `repo.error`

This is a clean structure because all repo-related values stay together in one place.

---

## 12. Redux Toolkit concept: Immer-style mutation

Redux Toolkit uses Immer under the hood.

This means inside reducers you can write code like this:

```js
state.repos = action.payload;
state.activeRepoId = action.payload;
state.ingestionProgress[repoId] = { ... };
```

Even though it looks like direct mutation, Redux Toolkit handles it safely and keeps the state immutable behind the scenes.

### Beginner explanation

You write state updates in a simpler way, and Redux Toolkit makes sure the old state is not changed directly.

---

## 13. Vue concepts used in the project

The project also contains a Vue app, and it uses the Composition API style.

- File: [frontend/vue-app/src/App.vue](../frontend/vue-app/src/App.vue)

---

## 14. Vue concept: script setup

The Vue component uses `script setup`.

This is a modern Vue syntax that makes component code simpler and cleaner.

Example:

```js
<script setup>
import { ref, onMounted } from 'vue'
</script>
```

### In simple words

This tells Vue that the script is part of the component and the code should be treated as the component logic.

---

## 15. Vue concept: ref()

`ref()` is used to create reactive state.

In this project:

- `repoId = ref(null)`
- `decisions = ref([])`
- `loading = ref(true)`
- `error = ref(null)`
- `selectedDecision = ref(null)`

### What does reactive mean?

When the value changes, the UI updates automatically.

Example:

```js
const loading = ref(true);
```

When `loading.value` changes, the template re-renders.

### Beginner explanation

`ref()` is used when a variable should be watched by Vue and displayed in the template.

---

## 16. Vue concept: onMounted()

`onMounted()` runs code after the component is loaded on the page.

In this project, it is used to:

- read the URL parameters
- find the repo ID
- call the API to fetch decisions

Example structure:

```js
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  repoId.value = params.get("repoId");
});
```

### In simple words

This is the Vue equivalent of “do this once when the page/component is ready.”

---

## 17. Vue concept: template reactivity

Vue templates automatically update when reactive variables change.

Examples in this project:

- `v-if="loading"`
- `v-else-if="error"`
- `v-else-if="decisions.length === 0"`
- `{{ error }}`
- `{{ selectedDecision.summary }}`

This means the page updates immediately when data changes.

### Beginner explanation

Vue keeps the UI in sync with the data.

---

## 18. Vue concept: v-if, v-else-if, v-else

These are used for conditional rendering.

Examples:

- show loading spinner when data is being fetched
- show error message when API fails
- show empty-state message when no decisions exist
- show timeline when data is available

### In simple words

These directives decide what should be shown based on a condition.

---

## 19. Vue concept: v-for

`v-for` is used to render a list of items.

Example from the project:

```html
<div v-for="dec in decisions" :key="dec._id"></div>
```

This loops through the `decisions` array and creates UI for each item.

### In simple words

If you have multiple records, `v-for` helps render them one by one.

---

## 20. Vue concept: :key

The `:key` attribute helps Vue identify each item in a list.

Example:

```html
:key="dec._id"
```

### Why it matters

It helps Vue efficiently update the list without confusing items.

---

## 21. Vue concept: @click

`@click` is used to attach click event handlers.

Examples:

- `@click="fetchDecisions"`
- `@click="selectDecision(dec)"`

### In simple words

This is how the user triggers a function when they click a button or item in the UI.

---

## Final summary

If you remember only a few things, remember this:

- Redux Toolkit helps manage shared data in a React app.
- `configureStore` creates the central app store.
- `createSlice` groups related state and logic together.
- `dispatch` sends actions to change state.
- `useSelector` reads state from the store.
- `useDispatch` triggers actions from React components.
- Vue `ref()` makes data reactive.
- `v-if`, `v-else`, and `v-for` help render the UI dynamically.
- Vue templates update automatically when state changes.

This project is a good example of using both React Redux patterns and Vue reactive patterns in a real application.

---

## Quick beginner takeaway

A very simple way to think about it is:

- Redux = shared state manager for React
- slice = a feature-specific section of the state
- action = a message saying what changed
- reducer = logic that updates the state
- Vue = reactive UI framework that updates automatically when data changes
- ref() = reactive data in Vue
- template directives = instructions for rendering UI under conditions and lists

This is enough to understand the project’s architecture without needing deep prior experience.

---

This document was written to be beginner-friendly and practical for freshers working on this project for the first time.
