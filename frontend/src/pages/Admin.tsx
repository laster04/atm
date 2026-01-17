import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { seasonApi, teamApi, gameApi } from '../services/api';
import type { Season, Team } from '../types';
import { AxiosError } from 'axios';

interface SeasonFormData {
  name?: string;
  sportType?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface TeamFormData {
  name?: string;
}

type ModalType = 'season' | 'team' | null;

export default function Admin() {
  const { isAdmin } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<ModalType>(null);
  const [formData, setFormData] = useState<SeasonFormData | TeamFormData>({});
  const [error, setError] = useState('');

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      teamApi.getBySeason(selectedSeason.id)
        .then(res => setTeams(res.data))
        .catch(err => console.error(err));
    }
  }, [selectedSeason]);

  const loadSeasons = () => {
    seasonApi.getAll()
      .then(res => {
        setSeasons(res.data);
        if (res.data.length > 0 && !selectedSeason) {
          setSelectedSeason(res.data[0]);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  if (!isAdmin()) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-gray-600 mt-2">You need admin privileges to access this page.</p>
      </div>
    );
  }

  const handleCreateSeason = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await seasonApi.create(formData as SeasonFormData);
      loadSeasons();
      setShowModal(null);
      setFormData({});
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to create season');
    }
  };

  const handleCreateTeam = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!selectedSeason) return;
      await teamApi.create(selectedSeason.id, formData as TeamFormData);
      const res = await teamApi.getBySeason(selectedSeason.id);
      setTeams(res.data);
      setShowModal(null);
      setFormData({});
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to create team');
    }
  };

  const handleGenerateSchedule = async () => {
    if (!selectedSeason) return;
    setError('');
    try {
      const result = await gameApi.generateSchedule(selectedSeason.id, {
        startDate: selectedSeason.startDate,
        intervalDays: 7,
        doubleRoundRobin: true
      });
      alert(result.data.message);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to generate schedule');
    }
  };

  const handleDeleteSeason = async (id: number) => {
    if (!confirm('Are you sure? This will delete all teams and games in this season.')) return;
    try {
      await seasonApi.delete(id);
      loadSeasons();
      if (selectedSeason?.id === id) {
        setSelectedSeason(null);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to delete season');
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (!confirm('Are you sure? This will delete all players and game data for this team.')) return;
    try {
      await teamApi.delete(id);
      if (selectedSeason) {
        const res = await teamApi.getBySeason(selectedSeason.id);
        setTeams(res.data);
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || 'Failed to delete team');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        Loading...
      </div>
    );
  }

  const seasonFormData = formData as SeasonFormData;
  const teamFormData = formData as TeamFormData;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Seasons</h2>
              <button
                onClick={() => {
                  setFormData({ status: 'DRAFT' });
                  setShowModal('season');
                }}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {seasons.map(season => (
                <div
                  key={season.id}
                  className={`p-3 rounded cursor-pointer flex justify-between items-center ${
                    selectedSeason?.id === season.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedSeason(season)}
                >
                  <div>
                    <div className="font-medium">{season.name}</div>
                    <div className="text-sm text-gray-500">{season.sportType}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSeason(season.id);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {seasons.length === 0 && (
                <p className="text-gray-500 text-center py-4">No seasons yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedSeason ? (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  Teams in {selectedSeason.name}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFormData({});
                      setShowModal('team');
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    + Add Team
                  </button>
                  <button
                    onClick={handleGenerateSchedule}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    disabled={teams.length < 2}
                  >
                    Generate Schedule
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {teams.map(team => (
                  <div
                    key={team.id}
                    className="p-3 bg-gray-50 rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-500">
                        {team._count?.players} players
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {teams.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No teams yet</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a season to manage teams
            </div>
          )}
        </div>
      </div>

      {showModal === 'season' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Season</h3>
            <form onSubmit={handleCreateSeason}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={seasonFormData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Sport Type</label>
                <input
                  type="text"
                  value={seasonFormData.sportType || ''}
                  onChange={(e) => setFormData({ ...formData, sportType: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., Football, Basketball"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={seasonFormData.startDate || ''}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={seasonFormData.endDate || ''}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={seasonFormData.status || 'DRAFT'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal === 'team' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Team</h3>
            <form onSubmit={handleCreateTeam}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Team Name</label>
                <input
                  type="text"
                  value={teamFormData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
