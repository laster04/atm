import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { teamApi } from '../../services/api';
import type { Team } from '../../types';

interface TeamsState {
  items: Record<number, Team[]>; // keyed by seasonId
  currentTeam: Team | null;
  myTeams: Team[];
  loading: boolean;
  error: string | null;
}

const initialState: TeamsState = {
  items: {},
  currentTeam: null,
  myTeams: [],
  loading: false,
  error: null,
};

export const fetchTeamsBySeason = createAsyncThunk(
  'teams/fetchBySeason',
  async (seasonId: string | number, { rejectWithValue }) => {
    try {
      const response = await teamApi.getBySeason(seasonId);
      return { seasonId: Number(seasonId), teams: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch teams');
    }
  }
);

export const fetchMyTeams = createAsyncThunk(
  'teams/fetchMy',
  async (_, { rejectWithValue }) => {
    try {
      const response = await teamApi.getMyTeams();
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch my teams');
    }
  }
);

export const fetchTeamById = createAsyncThunk(
  'teams/fetchById',
  async (id: string | number, { rejectWithValue }) => {
    try {
      const response = await teamApi.getById(id);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch team');
    }
  }
);

export const createTeam = createAsyncThunk(
  'teams/create',
  async ({ seasonId, data }: { seasonId: string | number; data: Partial<Team> }, { rejectWithValue }) => {
    try {
      const response = await teamApi.create(seasonId, data);
      return { seasonId: Number(seasonId), team: response.data };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to create team');
    }
  }
);

export const updateTeam = createAsyncThunk(
  'teams/update',
  async ({ id, data }: { id: string | number; data: Partial<Team> }, { rejectWithValue }) => {
    try {
      const response = await teamApi.update(id, data);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to update team');
    }
  }
);

export const deleteTeam = createAsyncThunk(
  'teams/delete',
  async ({ id, seasonId }: { id: string | number; seasonId: number }, { rejectWithValue }) => {
    try {
      await teamApi.delete(id);
      return { id: Number(id), seasonId };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || 'Failed to delete team');
    }
  }
);

const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    clearCurrentTeam: (state) => {
      state.currentTeam = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch teams by season
      .addCase(fetchTeamsBySeason.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeamsBySeason.fulfilled, (state, action) => {
        state.loading = false;
        state.items[action.payload.seasonId] = action.payload.teams;
      })
      .addCase(fetchTeamsBySeason.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch my teams
      .addCase(fetchMyTeams.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyTeams.fulfilled, (state, action: PayloadAction<Team[]>) => {
        state.loading = false;
        state.myTeams = action.payload;
      })
      .addCase(fetchMyTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch team by ID
      .addCase(fetchTeamById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeamById.fulfilled, (state, action: PayloadAction<Team>) => {
        state.loading = false;
        state.currentTeam = action.payload;
      })
      .addCase(fetchTeamById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create team
      .addCase(createTeam.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTeam.fulfilled, (state, action) => {
        state.loading = false;
        const { seasonId, team } = action.payload;
        if (!state.items[seasonId]) {
          state.items[seasonId] = [];
        }
        state.items[seasonId].push(team);
      })
      .addCase(createTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update team
      .addCase(updateTeam.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTeam.fulfilled, (state, action: PayloadAction<Team>) => {
        state.loading = false;
        const team = action.payload;
        const seasonTeams = state.items[team.seasonId];
        if (seasonTeams) {
          const index = seasonTeams.findIndex((t) => t.id === team.id);
          if (index >= 0) {
            seasonTeams[index] = team;
          }
        }
        if (state.currentTeam?.id === team.id) {
          state.currentTeam = team;
        }
        const myIndex = state.myTeams.findIndex((t) => t.id === team.id);
        if (myIndex >= 0) {
          state.myTeams[myIndex] = team;
        }
      })
      .addCase(updateTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete team
      .addCase(deleteTeam.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        state.loading = false;
        const { id, seasonId } = action.payload;
        if (state.items[seasonId]) {
          state.items[seasonId] = state.items[seasonId].filter((t) => t.id !== id);
        }
        state.myTeams = state.myTeams.filter((t) => t.id !== id);
        if (state.currentTeam?.id === id) {
          state.currentTeam = null;
        }
      })
      .addCase(deleteTeam.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCurrentTeam, clearError } = teamsSlice.actions;
export default teamsSlice.reducer;
