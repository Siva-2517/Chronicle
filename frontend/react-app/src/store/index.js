import { configureStore } from '@reduxjs/toolkit';
import repoReducer from './repoSlice';

export const store = configureStore({
  reducer: {
    repo: repoReducer,
  },
});
