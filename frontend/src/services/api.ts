import axios from 'axios';
import type { User, Season, Team, Player, Game, Standing } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ user: User; token: string }>('/auth/login', data),
  getMe: () => api.get<{ user: User }>('/auth/me'),
  updateProfile: (data: { name?: string; password?: string }) =>
    api.put<{ user: User }>('/auth/profile', data),
  getUsers: (filters?: { role?: string; name?: string; active?: boolean }) =>
    api.get<User[]>('/auth/users', { params: filters }),
  createUser: (data: { email: string; password: string; name: string; role?: string; active?: boolean }) =>
    api.post<User>('/auth/users', data),
  updateUser: (id: number, data: { email?: string; password?: string; name?: string; role?: string; active?: boolean }) =>
    api.put<User>(`/auth/users/${id}`, data),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}`)
};

export const seasonApi = {
  getAll: () => api.get<Season[]>('/seasons'),
  getMySeasons: () => api.get<Season[]>('/seasons/my'),
  getById: (id: string | number) => api.get<Season>(`/seasons/${id}`),
  create: (data: Partial<Season>) => api.post<Season>('/seasons', data),
  update: (id: string | number, data: Partial<Season>) => api.put<Season>(`/seasons/${id}`, data),
  delete: (id: string | number) => api.delete(`/seasons/${id}`),
  getStandings: (id: string | number) => api.get<Standing[]>(`/seasons/${id}/standings`)
};

export const teamApi = {
  getMyTeams: () => api.get<Team[]>('/teams/my'),
  getBySeason: (seasonId: string | number) => api.get<Team[]>(`/teams/season/${seasonId}`),
  getById: (id: string | number) => api.get<Team>(`/teams/${id}`),
  create: (seasonId: string | number, data: Partial<Team>) =>
    api.post<Team>(`/teams/season/${seasonId}`, data),
  update: (id: string | number, data: Partial<Team>) => api.put<Team>(`/teams/${id}`, data),
  delete: (id: string | number) => api.delete(`/teams/${id}`)
};

export const playerApi = {
  getByTeam: (teamId: string | number) => api.get<Player[]>(`/players/team/${teamId}`),
  getById: (id: string | number) => api.get<Player>(`/players/${id}`),
  create: (teamId: string | number, data: Partial<Player>) =>
    api.post<Player>(`/players/team/${teamId}`, data),
  update: (id: string | number, data: Partial<Player>) => api.put<Player>(`/players/${id}`, data),
  delete: (id: string | number) => api.delete(`/players/${id}`)
};

export const gameApi = {
  getBySeason: (seasonId: string | number) => api.get<Game[]>(`/games/season/${seasonId}`),
  getById: (id: string | number) => api.get<Game>(`/games/${id}`),
  create: (seasonId: string | number, data: Partial<Game>) =>
    api.post<Game>(`/games/season/${seasonId}`, data),
  update: (id: string | number, data: Partial<Game>) => api.put<Game>(`/games/${id}`, data),
  delete: (id: string | number) => api.delete(`/games/${id}`),
  generateSchedule: (
    seasonId: string | number,
    data: { startDate?: string; intervalDays?: number; doubleRoundRobin?: boolean }
  ) => api.post<{ message: string; games: Game[] }>(`/games/season/${seasonId}/generate`, data)
};

export default api;
