import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  repos: [],
  activeRepoId: null,
  ingestionProgress: {}, // key: repoId, value: { step, message, current, total }
  loading: false,
  error: null,
};

const repoSlice = createSlice({
  name: 'repo',
  initialState,
  reducers: {
    setRepos: (state, action) => {
      state.repos = action.payload;
    },
    addRepo: (state, action) => {
      if (!state.repos.some(r => r._id === action.payload._id)) {
        state.repos.unshift(action.payload);
      }
    },
    setActiveRepoId: (state, action) => {
      state.activeRepoId = action.payload;
    },
    updateIngestionProgress: (state, action) => {
      const { repoId, step, message, current, total } = action.payload;
      state.ingestionProgress[repoId] = { repoId, step, message, current, total };
      
      const repo = state.repos.find(r => r._id === repoId);
      if (repo) {
        if (step === 'completed') {
          repo.ingestionStatus = 'completed';
        } else if (step === 'failed') {
          repo.ingestionStatus = 'failed';
        } else if (step === 'started' || step.startsWith('fetching_') || step.startsWith('ingesting_')) {
          repo.ingestionStatus = 'ingesting';
        }
      }
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    deleteRepoInState: (state, action) => {
      state.repos = state.repos.filter(r => r._id !== action.payload);
      if (state.activeRepoId === action.payload) {
        state.activeRepoId = null;
      }
      delete state.ingestionProgress[action.payload];
    }
  },
});

export const {
  setRepos,
  addRepo,
  setActiveRepoId,
  updateIngestionProgress,
  setLoading,
  setError,
  deleteRepoInState
} = repoSlice.actions;

export default repoSlice.reducer;
