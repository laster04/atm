import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { leagueApi } from '../../services/api';
import type { League } from '../../types';

interface LeaguesState {
  items: League[];
  currentLeague: League | null;
  myLeagues: League[];
  loading: boolean;
  error: string | null;
}

const initialState: LeaguesState = {
  items: [],
  currentLeague: null,
  myLeagues: [],
  loading: false,
  error: null,
};

export const fetchLeagues = createAsyncThunk(
  'leagues/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await leagueApi.getAll();
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch leagues');
    }
  }
);

export const fetchMyLeagues = createAsyncThunk(
  'leagues/fetchMy',
  async (_, { rejectWithValue }) => {
    try {
      const response = await leagueApi.getMyLeagues();
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch my leagues');
    }
  }
);

export const fetchLeagueById = createAsyncThunk(
  'leagues/fetchById',
  async (id: string | number, { rejectWithValue }) => {
    try {
      const response = await leagueApi.getById(id);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch league');
    }
  }
);

export const createLeague = createAsyncThunk(
  'leagues/create',
  async (data: Partial<League>, { rejectWithValue }) => {
    try {
      const response = await leagueApi.create(data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create league');
    }
  }
);

export const updateLeague = createAsyncThunk(
  'leagues/update',
  async ({ id, data }: { id: string | number; data: Partial<League> }, { rejectWithValue }) => {
    try {
      const response = await leagueApi.update(id, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to update league');
    }
  }
);

export const deleteLeague = createAsyncThunk(
  'leagues/delete',
  async (id: string | number, { rejectWithValue }) => {
    try {
      await leagueApi.delete(id);
      return Number(id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to delete league');
    }
  }
);

const leaguesSlice = createSlice({
  name: 'leagues',
  initialState,
  reducers: {
    clearCurrentLeague: (state) => {
      state.currentLeague = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all leagues
      .addCase(fetchLeagues.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeagues.fulfilled, (state, action: PayloadAction<League[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchLeagues.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch my leagues
      .addCase(fetchMyLeagues.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyLeagues.fulfilled, (state, action: PayloadAction<League[]>) => {
        state.loading = false;
        state.myLeagues = action.payload;
      })
      .addCase(fetchMyLeagues.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch league by ID
      .addCase(fetchLeagueById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLeagueById.fulfilled, (state, action: PayloadAction<League>) => {
        state.loading = false;
        state.currentLeague = action.payload;
        const index = state.items.findIndex((l) => l.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      .addCase(fetchLeagueById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create league
      .addCase(createLeague.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createLeague.fulfilled, (state, action: PayloadAction<League>) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createLeague.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update league
      .addCase(updateLeague.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateLeague.fulfilled, (state, action: PayloadAction<League>) => {
        state.loading = false;
        const index = state.items.findIndex((l) => l.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
        if (state.currentLeague?.id === action.payload.id) {
          state.currentLeague = action.payload;
        }
      })
      .addCase(updateLeague.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete league
      .addCase(deleteLeague.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteLeague.fulfilled, (state, action: PayloadAction<number>) => {
        state.loading = false;
        state.items = state.items.filter((l) => l.id !== action.payload);
        if (state.currentLeague?.id === action.payload) {
          state.currentLeague = null;
        }
      })
      .addCase(deleteLeague.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentLeague, clearError } = leaguesSlice.actions;
export default leaguesSlice.reducer;
