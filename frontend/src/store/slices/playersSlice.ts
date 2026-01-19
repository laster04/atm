import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { playerApi } from '../../services/api';
import type { Player } from '../../types';

interface PlayersState {
  items: Record<number, Player[]>; // keyed by teamId
  currentPlayer: Player | null;
  loading: boolean;
  error: string | null;
}

const initialState: PlayersState = {
  items: {},
  currentPlayer: null,
  loading: false,
  error: null,
};

export const fetchPlayersByTeam = createAsyncThunk(
  'players/fetchByTeam',
  async (teamId: string | number, { rejectWithValue }) => {
    try {
      const response = await playerApi.getByTeam(teamId);
      return { teamId: Number(teamId), players: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch players');
    }
  }
);

export const fetchPlayerById = createAsyncThunk(
  'players/fetchById',
  async (id: string | number, { rejectWithValue }) => {
    try {
      const response = await playerApi.getById(id);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch player');
    }
  }
);

export const createPlayer = createAsyncThunk(
  'players/create',
  async ({ teamId, data }: { teamId: string | number; data: Partial<Player> }, { rejectWithValue }) => {
    try {
      const response = await playerApi.create(teamId, data);
      return { teamId: Number(teamId), player: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create player');
    }
  }
);

export const updatePlayer = createAsyncThunk(
  'players/update',
  async ({ id, data }: { id: string | number; data: Partial<Player> }, { rejectWithValue }) => {
    try {
      const response = await playerApi.update(id, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to update player');
    }
  }
);

export const deletePlayer = createAsyncThunk(
  'players/delete',
  async ({ id, teamId }: { id: string | number; teamId: number }, { rejectWithValue }) => {
    try {
      await playerApi.delete(id);
      return { id: Number(id), teamId };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to delete player');
    }
  }
);

const playersSlice = createSlice({
  name: 'players',
  initialState,
  reducers: {
    clearCurrentPlayer: (state) => {
      state.currentPlayer = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch players by team
      .addCase(fetchPlayersByTeam.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlayersByTeam.fulfilled, (state, action) => {
        state.loading = false;
        state.items[action.payload.teamId] = action.payload.players;
      })
      .addCase(fetchPlayersByTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch player by ID
      .addCase(fetchPlayerById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlayerById.fulfilled, (state, action: PayloadAction<Player>) => {
        state.loading = false;
        state.currentPlayer = action.payload;
      })
      .addCase(fetchPlayerById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create player
      .addCase(createPlayer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPlayer.fulfilled, (state, action) => {
        state.loading = false;
        const { teamId, player } = action.payload;
        if (!state.items[teamId]) {
          state.items[teamId] = [];
        }
        state.items[teamId].push(player);
      })
      .addCase(createPlayer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update player
      .addCase(updatePlayer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updatePlayer.fulfilled, (state, action: PayloadAction<Player>) => {
        state.loading = false;
        const player = action.payload;
        const teamPlayers = state.items[player.teamId];
        if (teamPlayers) {
          const index = teamPlayers.findIndex((p) => p.id === player.id);
          if (index >= 0) {
            teamPlayers[index] = player;
          }
        }
        if (state.currentPlayer?.id === player.id) {
          state.currentPlayer = player;
        }
      })
      .addCase(updatePlayer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete player
      .addCase(deletePlayer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deletePlayer.fulfilled, (state, action) => {
        state.loading = false;
        const { id, teamId } = action.payload;
        if (state.items[teamId]) {
          state.items[teamId] = state.items[teamId].filter((p) => p.id !== id);
        }
        if (state.currentPlayer?.id === id) {
          state.currentPlayer = null;
        }
      })
      .addCase(deletePlayer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentPlayer, clearError } = playersSlice.actions;
export default playersSlice.reducer;
