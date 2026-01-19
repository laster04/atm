import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { seasonApi } from '../../services/api';
import type { Season, Standing } from '../../types';

interface SeasonsState {
  items: Season[];
  currentSeason: Season | null;
  mySeasons: Season[];
  standings: Record<number, Standing[]>;
  loading: boolean;
  error: string | null;
}

const initialState: SeasonsState = {
  items: [],
  currentSeason: null,
  mySeasons: [],
  standings: {},
  loading: false,
  error: null,
};

export const fetchSeasons = createAsyncThunk(
  'seasons/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await seasonApi.getAll();
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch seasons');
    }
  }
);

export const fetchMySeasons = createAsyncThunk(
  'seasons/fetchMy',
  async (_, { rejectWithValue }) => {
    try {
      const response = await seasonApi.getMySeasons();
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch my seasons');
    }
  }
);

export const fetchSeasonById = createAsyncThunk(
  'seasons/fetchById',
  async (id: string | number, { rejectWithValue }) => {
    try {
      const response = await seasonApi.getById(id);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch season');
    }
  }
);

export const fetchStandings = createAsyncThunk(
  'seasons/fetchStandings',
  async (seasonId: string | number, { rejectWithValue }) => {
    try {
      const response = await seasonApi.getStandings(seasonId);
      return { seasonId: Number(seasonId), standings: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch standings');
    }
  }
);

export const createSeason = createAsyncThunk(
  'seasons/create',
  async (data: Partial<Season>, { rejectWithValue }) => {
    try {
      const response = await seasonApi.create(data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create season');
    }
  }
);

export const updateSeason = createAsyncThunk(
  'seasons/update',
  async ({ id, data }: { id: string | number; data: Partial<Season> }, { rejectWithValue }) => {
    try {
      const response = await seasonApi.update(id, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to update season');
    }
  }
);

export const deleteSeason = createAsyncThunk(
  'seasons/delete',
  async (id: string | number, { rejectWithValue }) => {
    try {
      await seasonApi.delete(id);
      return Number(id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to delete season');
    }
  }
);

const seasonsSlice = createSlice({
  name: 'seasons',
  initialState,
  reducers: {
    clearCurrentSeason: (state) => {
      state.currentSeason = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all seasons
      .addCase(fetchSeasons.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSeasons.fulfilled, (state, action: PayloadAction<Season[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchSeasons.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch my seasons
      .addCase(fetchMySeasons.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMySeasons.fulfilled, (state, action: PayloadAction<Season[]>) => {
        state.loading = false;
        state.mySeasons = action.payload;
      })
      .addCase(fetchMySeasons.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch season by ID
      .addCase(fetchSeasonById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSeasonById.fulfilled, (state, action: PayloadAction<Season>) => {
        state.loading = false;
        state.currentSeason = action.payload;
        const index = state.items.findIndex((s) => s.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      .addCase(fetchSeasonById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch standings
      .addCase(fetchStandings.fulfilled, (state, action) => {
        state.standings[action.payload.seasonId] = action.payload.standings;
      })
      // Create season
      .addCase(createSeason.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSeason.fulfilled, (state, action: PayloadAction<Season>) => {
        state.loading = false;
        state.items.push(action.payload);
      })
      .addCase(createSeason.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update season
      .addCase(updateSeason.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateSeason.fulfilled, (state, action: PayloadAction<Season>) => {
        state.loading = false;
        const index = state.items.findIndex((s) => s.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
        if (state.currentSeason?.id === action.payload.id) {
          state.currentSeason = action.payload;
        }
      })
      .addCase(updateSeason.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete season
      .addCase(deleteSeason.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteSeason.fulfilled, (state, action: PayloadAction<number>) => {
        state.loading = false;
        state.items = state.items.filter((s) => s.id !== action.payload);
        if (state.currentSeason?.id === action.payload) {
          state.currentSeason = null;
        }
        delete state.standings[action.payload];
      })
      .addCase(deleteSeason.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentSeason, clearError } = seasonsSlice.actions;
export default seasonsSlice.reducer;
