import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import seasonsReducer from './slices/seasonsSlice';
import teamsReducer from './slices/teamsSlice';
import playersReducer from './slices/playersSlice';
import gamesReducer from './slices/gamesSlice';

const rootReducer = combineReducers({
  seasons: seasonsReducer,
  teams: teamsReducer,
  players: playersReducer,
  games: gamesReducer,
});

const persistConfig = {
  key: 'root',
  version: 1,
  storage,
  whitelist: ['seasons', 'teams', 'players', 'games'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
