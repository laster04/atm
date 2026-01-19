import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { gameApi } from '../../services/api';
import type { Game } from '../../types';

interface GamesState {
  items: Record<number, Game[]>; // keyed by seasonId
  currentGame: Game | null;
  loading: boolean;
  error: string | null;
}

const initialState: GamesState = {
  items: {},
  currentGame: null,
  loading: false,
  error: null,
};

export const fetchGamesBySeason = createAsyncThunk(
  'games/fetchBySeason',
  async (seasonId: string | number, { rejectWithValue }) => {
    try {
      const response = await gameApi.getBySeason(seasonId);
      return { seasonId: Number(seasonId), games: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch games');
    }
  }
);

export const fetchGameById = createAsyncThunk(
  'games/fetchById',
  async (id: string | number, { rejectWithValue }) => {
    try {
      const response = await gameApi.getById(id);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch game');
    }
  }
);

export const createGame = createAsyncThunk(
  'games/create',
  async ({ seasonId, data }: { seasonId: string | number; data: Partial<Game> }, { rejectWithValue }) => {
    try {
      const response = await gameApi.create(seasonId, data);
      return { seasonId: Number(seasonId), game: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create game');
    }
  }
);

export const updateGame = createAsyncThunk(
  'games/update',
  async ({ id, data }: { id: string | number; data: Partial<Game> }, { rejectWithValue }) => {
    try {
      const response = await gameApi.update(id, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to update game');
    }
  }
);

export const deleteGame = createAsyncThunk(
  'games/delete',
  async ({ id, seasonId }: { id: string | number; seasonId: number }, { rejectWithValue }) => {
    try {
      await gameApi.delete(id);
      return { id: Number(id), seasonId };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to delete game');
    }
  }
);

export const generateSchedule = createAsyncThunk(
  'games/generateSchedule',
  async (
    {
      seasonId,
      data,
    }: {
      seasonId: string | number;
      data: { rounds?: number };
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await gameApi.generateSchedule(seasonId, data);
      return { seasonId: Number(seasonId), games: response.data.games };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to generate schedule');
    }
  }
);

const gamesSlice = createSlice({
  name: 'games',
  initialState,
  reducers: {
    clearCurrentGame: (state) => {
      state.currentGame = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch games by season
      .addCase(fetchGamesBySeason.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGamesBySeason.fulfilled, (state, action) => {
        state.loading = false;
        state.items[action.payload.seasonId] = action.payload.games;
      })
      .addCase(fetchGamesBySeason.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch game by ID
      .addCase(fetchGameById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGameById.fulfilled, (state, action: PayloadAction<Game>) => {
        state.loading = false;
        state.currentGame = action.payload;
      })
      .addCase(fetchGameById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create game
      .addCase(createGame.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createGame.fulfilled, (state, action) => {
        state.loading = false;
        const { seasonId, game } = action.payload;
        if (!state.items[seasonId]) {
          state.items[seasonId] = [];
        }
        state.items[seasonId].push(game);
      })
      .addCase(createGame.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update game
      .addCase(updateGame.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateGame.fulfilled, (state, action: PayloadAction<Game>) => {
        state.loading = false;
        const game = action.payload;
        const seasonGames = state.items[game.seasonId];
        if (seasonGames) {
          const index = seasonGames.findIndex((g) => g.id === game.id);
          if (index >= 0) {
            seasonGames[index] = game;
          }
        }
        if (state.currentGame?.id === game.id) {
          state.currentGame = game;
        }
      })
      .addCase(updateGame.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete game
      .addCase(deleteGame.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteGame.fulfilled, (state, action) => {
        state.loading = false;
        const { id, seasonId } = action.payload;
        if (state.items[seasonId]) {
          state.items[seasonId] = state.items[seasonId].filter((g) => g.id !== id);
        }
        if (state.currentGame?.id === id) {
          state.currentGame = null;
        }
      })
      .addCase(deleteGame.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Generate schedule
      .addCase(generateSchedule.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateSchedule.fulfilled, (state, action) => {
        state.loading = false;
        const { seasonId, games } = action.payload;
        state.items[seasonId] = games;
      })
      .addCase(generateSchedule.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentGame, clearError } = gamesSlice.actions;
export default gamesSlice.reducer;
