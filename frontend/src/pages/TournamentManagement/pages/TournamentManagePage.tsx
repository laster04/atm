import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  tournamentApi, tournamentTeamApi, tournamentPlayerApi,
  tournamentGroupApi, tournamentGameApi, tournamentPlayoffApi,
} from '@/services/api';
import type {
  Tournament, TournamentTeam, TournamentPlayer,
  TournamentGroup, TournamentGame, TournamentStatus, TournamentGamePhase,
} from '@types';
import { Button } from '@components/base/button';
import { Badge } from '@components/base/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/base/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import { Checkbox } from '@components/base/checkbox';
import {
  Plus, Pencil, Trash2, Users, ChevronDown, ChevronRight,
  Trophy, RefreshCw,
} from 'lucide-react';

// ── helpers ─────────────────────────────────────────────────

const STATUS_OPTIONS: TournamentStatus[] = ['DRAFT', 'REGISTRATION', 'GROUP_STAGE', 'PLAYOFF', 'COMPLETED'];
const PHASE_OPTIONS: TournamentGamePhase[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'BRONZE', 'FINAL'];
const PHASE_LABELS: Record<TournamentGamePhase, string> = {
  GROUP: 'Group', ROUND_OF_16: 'Round of 16', QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final', BRONZE: 'Bronze', FINAL: 'Final',
};

// ── sub-components ───────────────────────────────────────────

function formatGameDateTime(date: string | null | undefined, locale: string): string | null {
  if (!date) return null;
  return new Date(date).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

// Before the group stage finishes, a playoff slot may only carry a seed
// number (e.g. "1st place") rather than a resolved team.
function playoffSideLabel(team: { name: string } | null | undefined, seed: number | null | undefined, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (team) return team.name;
  if (seed != null) return t('tm.common.seed', { n: seed });
  return t('tm.common.tbd');
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">{label}</label>
      {children}
    </div>
  );
}
const inp = 'w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary';
const sel = inp + ' bg-white';

// ── main component ───────────────────────────────────────────

export default function TournamentManagePage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  // ── state ──────────────────────────────────────────────────
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [groups, setGroups] = useState<TournamentGroup[]>([]);
  const [groupGames, setGroupGames] = useState<TournamentGame[]>([]);
  const [playoffGames, setPlayoffGames] = useState<TournamentGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // team players expand state
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Record<number, TournamentPlayer[]>>({});

  // modals
  const [teamModal, setTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', country: '', primaryColor: '', logo: '' });

  const [playerModal, setPlayerModal] = useState(false);
  const [playerTeamId, setPlayerTeamId] = useState<number | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<TournamentPlayer | null>(null);
  const [playerForm, setPlayerForm] = useState({ name: '', number: '', position: '', bornYear: '' });

  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TournamentGroup | null>(null);
  const [groupName, setGroupName] = useState('');

  const [assignModal, setAssignModal] = useState(false);
  const [assignGroupId, setAssignGroupId] = useState<number | null>(null);
  const [assignTeamIds, setAssignTeamIds] = useState<number[]>([]);

  const [scheduleModal, setScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    startDate: '', startTime: '08:00', endTime: '18:00', slotDurationMinutes: '30', locations: '', minRestGames: '1',
  });

  const [resultModal, setResultModal] = useState(false);
  const [editingGame, setEditingGame] = useState<TournamentGame | null>(null);
  const [gameForm, setGameForm] = useState({ homeScore: '', awayScore: '', date: '', location: '', status: 'COMPLETED' });

  const [playoffModal, setPlayoffModal] = useState(false);
  const [editingPlayoff, setEditingPlayoff] = useState<TournamentGame | null>(null);
  const [playoffForm, setPlayoffForm] = useState({
    phase: 'QUARTER_FINAL' as TournamentGamePhase,
    homeTeamId: '', awayTeamId: '', bracketSlot: '',
    homeScore: '', awayScore: '', date: '', status: 'SCHEDULED',
  });

  const [generatePlayoffModal, setGeneratePlayoffModal] = useState(false);
  const [playoffGenForm, setPlayoffGenForm] = useState({
    qualifiersPerGroup: '1', startTime: '10:00', slotDurationMinutes: '40', location: '',
  });

  const [saving, setSaving] = useState(false);

  // ── load ───────────────────────────────────────────────────
  const load = async () => {
    if (!id) return;
    try {
      const [tRes, teamsRes, groupsRes, allGames] = await Promise.all([
        tournamentApi.getById(id),
        tournamentTeamApi.getByTournament(id),
        tournamentGroupApi.getByTournament(id),
        tournamentGameApi.getByTournament(id),
      ]);
      setTournament(tRes.data);
      setTeams(teamsRes.data);
      setGroups(groupsRes.data);
      setGroupGames(allGames.data.filter(g => g.phase === 'GROUP'));
      setPlayoffGames(allGames.data.filter(g => g.phase !== 'GROUP'));
    } catch {
      setError(t('tm.tournament.errors.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // ── expand team players ────────────────────────────────────
  const toggleTeam = async (teamId: number) => {
    if (expandedTeam === teamId) { setExpandedTeam(null); return; }
    setExpandedTeam(teamId);
    if (!teamPlayers[teamId]) {
      const res = await tournamentPlayerApi.getByTeam(teamId);
      setTeamPlayers(prev => ({ ...prev, [teamId]: res.data }));
    }
  };

  const refreshPlayers = async (teamId: number) => {
    const res = await tournamentPlayerApi.getByTeam(teamId);
    setTeamPlayers(prev => ({ ...prev, [teamId]: res.data }));
  };

  // ── team CRUD ──────────────────────────────────────────────
  const openTeamCreate = () => { setEditingTeam(null); setTeamForm({ name: '', country: '', primaryColor: '', logo: '' }); setTeamModal(true); };
  const openTeamEdit = (t: TournamentTeam) => { setEditingTeam(t); setTeamForm({ name: t.name, country: t.country ?? '', primaryColor: t.primaryColor ?? '', logo: t.logo ?? '' }); setTeamModal(true); };

  const saveTeam = async () => {
    if (!teamForm.name || !id) return;
    setSaving(true); setError('');
    try {
      const payload = { name: teamForm.name, country: teamForm.country || undefined, primaryColor: teamForm.primaryColor || undefined, logo: teamForm.logo || undefined };
      if (editingTeam) {
        const res = await tournamentTeamApi.update(editingTeam.id, payload);
        setTeams(prev => prev.map(t => t.id === editingTeam.id ? res.data : t));
      } else {
        const res = await tournamentTeamApi.create(id, payload);
        setTeams(prev => [...prev, res.data]);
      }
      setTeamModal(false);
    } catch { setError(t('tm.tournament.teams.errors.save')); }
    finally { setSaving(false); }
  };

  const deleteTeam = async (tid: number) => {
    if (!confirm(t('tm.tournament.teams.deleteConfirm'))) return;
    try { await tournamentTeamApi.delete(tid); setTeams(prev => prev.filter(t => t.id !== tid)); }
    catch { setError(t('tm.tournament.teams.errors.delete')); }
  };

  // ── player CRUD ────────────────────────────────────────────
  const openPlayerCreate = (teamId: number) => { setEditingPlayer(null); setPlayerTeamId(teamId); setPlayerForm({ name: '', number: '', position: '', bornYear: '' }); setPlayerModal(true); };
  const openPlayerEdit = (p: TournamentPlayer) => { setEditingPlayer(p); setPlayerTeamId(p.teamId); setPlayerForm({ name: p.name, number: p.number?.toString() ?? '', position: p.position ?? '', bornYear: p.bornYear?.toString() ?? '' }); setPlayerModal(true); };

  const savePlayer = async () => {
    if (!playerForm.name || !playerTeamId) return;
    setSaving(true); setError('');
    try {
      const payload = { name: playerForm.name, number: playerForm.number ? parseInt(playerForm.number) : undefined, position: playerForm.position || undefined, bornYear: playerForm.bornYear ? parseInt(playerForm.bornYear) : undefined };
      if (editingPlayer) {
        const res = await tournamentPlayerApi.update(editingPlayer.id, payload);
        setTeamPlayers(prev => ({ ...prev, [playerTeamId]: (prev[playerTeamId] ?? []).map(p => p.id === editingPlayer.id ? res.data : p) }));
      } else {
        const res = await tournamentPlayerApi.create(playerTeamId, payload);
        setTeamPlayers(prev => ({ ...prev, [playerTeamId]: [...(prev[playerTeamId] ?? []), res.data] }));
      }
      setPlayerModal(false);
    } catch { setError(t('tm.tournament.players.errors.save')); }
    finally { setSaving(false); }
  };

  const deletePlayer = async (playerId: number, teamId: number) => {
    if (!confirm(t('tm.tournament.players.deleteConfirm'))) return;
    try { await tournamentPlayerApi.delete(playerId); await refreshPlayers(teamId); }
    catch { setError(t('tm.tournament.players.errors.delete')); }
  };

  // ── group CRUD ─────────────────────────────────────────────
  const openGroupCreate = () => { setEditingGroup(null); setGroupName(''); setGroupModal(true); };
  const openGroupEdit = (g: TournamentGroup) => { setEditingGroup(g); setGroupName(g.name); setGroupModal(true); };

  const saveGroup = async () => {
    if (!groupName || !id) return;
    setSaving(true); setError('');
    try {
      if (editingGroup) {
        const res = await tournamentGroupApi.update(editingGroup.id, { name: groupName });
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? res.data : g));
      } else {
        const res = await tournamentGroupApi.create(id, { name: groupName });
        setGroups(prev => [...prev, res.data]);
      }
      setGroupModal(false);
    } catch { setError(t('tm.tournament.groups.errors.save')); }
    finally { setSaving(false); }
  };

  const deleteGroup = async (gid: number) => {
    if (!confirm(t('tm.tournament.groups.deleteConfirm'))) return;
    try { await tournamentGroupApi.delete(gid); setGroups(prev => prev.filter(g => g.id !== gid)); }
    catch { setError(t('tm.tournament.groups.errors.delete')); }
  };

  const openScheduleModal = () => {
    setScheduleForm({ startDate: '', startTime: '08:00', endTime: '18:00', slotDurationMinutes: '30', locations: '', minRestGames: '1' });
    setScheduleModal(true);
  };

  const submitSchedule = async () => {
    if (!id) return;
    const locations = scheduleForm.locations.split(',').map(l => l.trim()).filter(Boolean);
    setSaving(true); setError('');
    try {
      await tournamentGroupApi.generateTournamentSchedule(id, {
        startDate: scheduleForm.startDate,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
        slotDurationMinutes: parseInt(scheduleForm.slotDurationMinutes),
        locations,
        minRestGames: parseInt(scheduleForm.minRestGames) || 0,
      });
      setScheduleModal(false);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('tm.tournament.groups.errors.generate'));
    }
    finally { setSaving(false); }
  };

  const deleteTournamentSchedule = async () => {
    if (!id || !confirm(t('tm.tournament.groups.deleteScheduleConfirm'))) return;
    setSaving(true); setError('');
    try {
      await tournamentGroupApi.deleteTournamentSchedule(id);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('tm.tournament.groups.errors.deleteSchedule'));
    }
    finally { setSaving(false); }
  };

  // ── assign teams to group ──────────────────────────────────
  const openAssign = (gid: number) => { setAssignGroupId(gid); setAssignTeamIds([]); setAssignModal(true); };

  const toggleAssignTeam = (tid: number) => {
    setAssignTeamIds(prev => prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]);
  };

  const saveAssign = async () => {
    if (!assignGroupId || assignTeamIds.length === 0) return;
    setSaving(true); setError('');
    try {
      let res;
      for (const tid of assignTeamIds) {
        res = await tournamentGroupApi.assignTeam(assignGroupId, tid);
      }
      if (res) setGroups(prev => prev.map(g => g.id === assignGroupId ? res!.data : g));
      setAssignModal(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('tm.tournament.groups.errors.assign'));
    }
    finally { setSaving(false); }
  };

  const removeFromGroup = async (gid: number, tid: number) => {
    try {
      await tournamentGroupApi.removeTeam(gid, tid);
      setGroups(prev => prev.map(g => g.id === gid ? { ...g, teams: g.teams?.filter(t => t.team.id !== tid) } : g));
    } catch { setError(t('tm.tournament.groups.errors.remove')); }
  };

  // ── game result ────────────────────────────────────────────
  const openResult = (g: TournamentGame) => {
    setEditingGame(g);
    setGameForm({ homeScore: g.homeScore?.toString() ?? '', awayScore: g.awayScore?.toString() ?? '', date: g.date ? g.date.slice(0, 10) : '', location: g.location ?? '', status: g.status });
    setResultModal(true);
  };

  const saveResult = async () => {
    if (!editingGame) return;
    setSaving(true); setError('');
    try {
      const res = await tournamentGameApi.update(editingGame.id, {
        homeScore: gameForm.homeScore !== '' ? parseInt(gameForm.homeScore) : null,
        awayScore: gameForm.awayScore !== '' ? parseInt(gameForm.awayScore) : null,
        date: gameForm.date || undefined,
        location: gameForm.location || undefined,
        status: gameForm.status as TournamentGame['status'],
      });
      setGroupGames(prev => prev.map(g => g.id === editingGame.id ? res.data : g));
      setResultModal(false);
    } catch { setError(t('tm.tournament.results.errors.save')); }
    finally { setSaving(false); }
  };

  // ── playoff game ───────────────────────────────────────────
  const openPlayoffCreate = () => {
    setEditingPlayoff(null);
    setPlayoffForm({ phase: 'QUARTER_FINAL', homeTeamId: '', awayTeamId: '', bracketSlot: '', homeScore: '', awayScore: '', date: '', status: 'SCHEDULED' });
    setPlayoffModal(true);
  };

  const openPlayoffEdit = (g: TournamentGame) => {
    setEditingPlayoff(g);
    setPlayoffForm({
      phase: g.phase, homeTeamId: g.homeTeamId?.toString() ?? '', awayTeamId: g.awayTeamId?.toString() ?? '',
      bracketSlot: g.bracketSlot?.toString() ?? '', homeScore: g.homeScore?.toString() ?? '',
      awayScore: g.awayScore?.toString() ?? '', date: g.date ? g.date.slice(0, 10) : '', status: g.status,
    });
    setPlayoffModal(true);
  };

  const savePlayoff = async () => {
    if (!id) return;
    setSaving(true); setError('');
    try {
      const payload = {
        phase: playoffForm.phase,
        homeTeamId: playoffForm.homeTeamId ? parseInt(playoffForm.homeTeamId) : null,
        awayTeamId: playoffForm.awayTeamId ? parseInt(playoffForm.awayTeamId) : null,
        bracketSlot: playoffForm.bracketSlot ? parseInt(playoffForm.bracketSlot) : null,
        homeScore: playoffForm.homeScore !== '' ? parseInt(playoffForm.homeScore) : null,
        awayScore: playoffForm.awayScore !== '' ? parseInt(playoffForm.awayScore) : null,
        date: playoffForm.date || undefined,
        status: playoffForm.status as TournamentGame['status'],
      };
      if (editingPlayoff) {
        const res = await tournamentGameApi.update(editingPlayoff.id, payload);
        setPlayoffGames(prev => prev.map(g => g.id === editingPlayoff.id ? res.data : g));
      } else {
        const res = await tournamentGameApi.create(id, payload);
        setPlayoffGames(prev => [...prev, res.data]);
      }
      setPlayoffModal(false);
    } catch { setError(t('tm.tournament.playoff.errors.save')); }
    finally { setSaving(false); }
  };

  const deletePlayoff = async (gid: number) => {
    if (!confirm(t('tm.tournament.playoff.deleteConfirm'))) return;
    try { await tournamentGameApi.delete(gid); setPlayoffGames(prev => prev.filter(g => g.id !== gid)); }
    catch { setError(t('tm.tournament.playoff.errors.delete')); }
  };

  // ── playoff auto-generation ────────────────────────────────
  const openGeneratePlayoffs = () => {
    setPlayoffGenForm({ qualifiersPerGroup: '1', startTime: '10:00', slotDurationMinutes: '40', location: '' });
    setGeneratePlayoffModal(true);
  };

  const submitGeneratePlayoffs = async () => {
    if (!id) return;
    setSaving(true); setError('');
    try {
      await tournamentPlayoffApi.generate(id, {
        qualifiersPerGroup: parseInt(playoffGenForm.qualifiersPerGroup),
        startTime: playoffGenForm.startTime,
        slotDurationMinutes: parseInt(playoffGenForm.slotDurationMinutes),
        location: playoffGenForm.location || undefined,
      });
      setGeneratePlayoffModal(false);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('tm.tournament.playoff.errors.generate'));
    }
    finally { setSaving(false); }
  };

  const deleteAllPlayoffs = async () => {
    if (!id || !confirm(t('tm.tournament.playoff.deletePlayoffsConfirm'))) return;
    setSaving(true); setError('');
    try {
      await tournamentPlayoffApi.deleteAll(id);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? t('tm.tournament.playoff.errors.deletePlayoffs'));
    }
    finally { setSaving(false); }
  };

  // ── tournament status update ───────────────────────────────
  const updateStatus = async (status: TournamentStatus) => {
    if (!id || !tournament) return;
    try {
      const res = await tournamentApi.update(id, { status });
      setTournament(res.data);
    } catch { setError(t('tm.tournament.playoff.errors.updateStatus')); }
  };

  // ── render ─────────────────────────────────────────────────
  if (loading) return <div className="text-center text-muted-foreground py-8">{t('tm.common.loading')}</div>;
  if (!tournament) return <div className="text-center text-red-500 py-8">{t('tm.tournament.notFound')}</div>;

  const seriesId = tournament.seriesId;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <Link to="/tournament-management/series" className="hover:text-foreground">{t('tm.common.series')}</Link>
        <span>/</span>
        <Link to={`/tournament-management/series/${seriesId}`} className="hover:text-foreground">
          {tournament.series?.name ?? t('tm.common.series')}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{tournament.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-violet-100 flex items-center justify-center">
            <Trophy className="size-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{tournament.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {tournament.year && <span className="text-sm text-muted-foreground">{tournament.year}</span>}
              <select
                className="text-xs border rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={tournament.status}
                onChange={e => updateStatus(e.target.value as TournamentStatus)}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(`tm.tournamentStatus.${s}`, s)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <Link to={`/tournament/${tournament.id}`} target="_blank">
          <Button variant="outline" size="sm">{t('tm.common.viewPublic')}</Button>
        </Link>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 text-sm">{error}</div>}

      {/* Tabs */}
      <Tabs defaultValue="teams">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="teams">{t('tm.tournament.tabs.teams')} ({teams.length})</TabsTrigger>
          <TabsTrigger value="groups">{t('tm.tournament.tabs.groups')} ({groups.length})</TabsTrigger>
          <TabsTrigger value="results">{t('tm.tournament.tabs.results')} ({groupGames.length})</TabsTrigger>
          <TabsTrigger value="playoff">{t('tm.tournament.tabs.playoff')} ({playoffGames.length})</TabsTrigger>
        </TabsList>

        {/* ── TEAMS ─────────────────────────────────────────── */}
        <TabsContent value="teams" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={openTeamCreate} size="sm" className="gap-1"><Plus className="size-4" /> {t('tm.tournament.teams.addButton')}</Button>
          </div>
          {teams.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg">{t('tm.tournament.teams.empty')}</div>
          ) : (
            <div className="divide-y border rounded-lg">
              {teams.map(team => (
                <div key={team.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    {team.primaryColor ? (
                      <div className="size-8 rounded-full shrink-0" style={{ backgroundColor: team.primaryColor }} />
                    ) : (
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <button className="flex-1 text-left min-w-0" onClick={() => toggleTeam(team.id)}>
                      <div className="font-medium">{team.name}</div>
                      {team.country && <div className="text-xs text-muted-foreground">{team.country}</div>}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => openPlayerCreate(team.id)} title={t('tm.tournament.teams.addPlayerTitle')}><Plus className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openTeamEdit(team)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteTeam(team.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-4" /></Button>
                      <button onClick={() => toggleTeam(team.id)} className="p-1 text-muted-foreground">
                        {expandedTeam === team.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </div>
                  </div>
                  {expandedTeam === team.id && (
                    <div className="bg-muted/30 px-6 pb-3">
                      {(teamPlayers[team.id] ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">{t('tm.tournament.teams.noPlayers')}</p>
                      ) : (
                        <table className="w-full text-sm mt-2">
                          <thead><tr className="text-muted-foreground text-xs"><th className="text-left py-1 w-8">{t('tm.tournament.teams.table.number')}</th><th className="text-left py-1">{t('tm.tournament.teams.table.name')}</th><th className="text-left py-1">{t('tm.tournament.teams.table.position')}</th><th className="text-left py-1">{t('tm.tournament.teams.table.born')}</th><th /></tr></thead>
                          <tbody>
                            {(teamPlayers[team.id] ?? []).map(p => (
                              <tr key={p.id} className="border-t border-muted">
                                <td className="py-1.5 text-muted-foreground">{p.number ?? '-'}</td>
                                <td className="py-1.5 font-medium">{p.name}</td>
                                <td className="py-1.5 text-muted-foreground">{p.position ?? '-'}</td>
                                <td className="py-1.5 text-muted-foreground">{p.bornYear ?? '-'}</td>
                                <td className="py-1.5 text-right">
                                  <Button variant="ghost" size="sm" onClick={() => openPlayerEdit(p)}><Pencil className="size-3" /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => deletePlayer(p.id, team.id)} className="text-red-500"><Trash2 className="size-3" /></Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── GROUPS ────────────────────────────────────────── */}
        <TabsContent value="groups" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            {groupGames.length === 0 ? (
              <Button variant="outline" size="sm" className="gap-1" onClick={openScheduleModal} disabled={saving}>
                <RefreshCw className="size-3" /> {t('tm.tournament.groups.generateSchedule')}
              </Button>
            ) : tournament?.status === 'DRAFT' ? (
              <Button variant="outline" size="sm" className="gap-1 text-red-500" onClick={deleteTournamentSchedule} disabled={saving}>
                <Trash2 className="size-3" /> {t('tm.tournament.groups.deleteSchedule')}
              </Button>
            ) : null}
            <Button onClick={openGroupCreate} size="sm" className="gap-1"><Plus className="size-4" /> {t('tm.tournament.groups.addButton')}</Button>
          </div>
          {groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg">{t('tm.tournament.groups.empty')}</div>
          ) : (
            <div className="space-y-3">
              {groups.map(g => (
                <div key={g.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">Group {g.name}</h3>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => openAssign(g.id)}>
                        <Plus className="size-3" /> {t('tm.tournament.groups.assignTeam')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openGroupEdit(g)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteGroup(g.id)} className="text-red-500"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                  {(!g.teams || g.teams.length === 0) ? (
                    <p className="text-sm text-muted-foreground">{t('tm.tournament.groups.noTeams')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {g.teams.map(({ team }) => (
                        <div key={team.id} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm">
                          {team.primaryColor && <div className="size-3 rounded-full" style={{ backgroundColor: team.primaryColor }} />}
                          <span>{team.name}</span>
                          <button onClick={() => removeFromGroup(g.id, team.id)} className="ml-1 text-muted-foreground hover:text-red-500 leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── RESULTS ───────────────────────────────────────── */}
        <TabsContent value="results" className="mt-4 space-y-2">
          {groupGames.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg">
              {t('tm.tournament.results.empty')}
            </div>
          ) : (
            <div className="divide-y border rounded-lg">
              {groupGames.map(game => {
                const when = formatGameDateTime(game.date, i18n.language);
                return (
                  <div key={game.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      {(when || game.location) && (
                        <div className="text-xs text-muted-foreground mb-1">
                          {when}{when && game.location && ' · '}{game.location}
                        </div>
                      )}
                      <div className="grid grid-cols-3 items-center gap-2">
                        <span className="text-right font-medium text-sm">{game.homeTeam?.name ?? t('tm.common.tbd')}</span>
                        <div className="text-center">
                          {game.status === 'COMPLETED' ? (
                            <span className="font-bold">{game.homeScore} – {game.awayScore}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">vs</span>
                          )}
                          {game.group && <div className="text-xs text-muted-foreground">Grp {game.group.name}</div>}
                        </div>
                        <span className="font-medium text-sm">{game.awayTeam?.name ?? t('tm.common.tbd')}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Badge variant={game.status === 'COMPLETED' ? 'secondary' : 'outline'} className="text-xs mr-2">
                        {game.status}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => openResult(game)}><Pencil className="size-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── PLAYOFF ───────────────────────────────────────── */}
        <TabsContent value="playoff" className="mt-4 space-y-3">
          <div className="flex justify-end gap-2">
            {playoffGames.length === 0 ? (
              <Button variant="outline" size="sm" className="gap-1" onClick={openGeneratePlayoffs} disabled={saving}>
                <RefreshCw className="size-3" /> {t('tm.tournament.playoff.generatePlayoffs')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1 text-red-500" onClick={deleteAllPlayoffs} disabled={saving}>
                <Trash2 className="size-3" /> {t('tm.tournament.playoff.deletePlayoffs')}
              </Button>
            )}
            <Button onClick={openPlayoffCreate} size="sm" className="gap-1"><Plus className="size-4" /> {t('tm.tournament.playoff.addButton')}</Button>
          </div>
          {playoffGames.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-lg">{t('tm.tournament.playoff.empty')}</div>
          ) : (
            <div className="space-y-2">
              {PHASE_OPTIONS.filter(ph => playoffGames.some(g => g.phase === ph)).map(phase => (
                <div key={phase}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">{PHASE_LABELS[phase]}</h3>
                  <div className="divide-y border rounded-lg">
                    {playoffGames.filter(g => g.phase === phase).sort((a, b) => (a.bracketSlot ?? 99) - (b.bracketSlot ?? 99)).map(game => {
                      const when = formatGameDateTime(game.date, i18n.language);
                      return (
                      <div key={game.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1">
                          {(when || game.location) && (
                            <div className="text-xs text-muted-foreground mb-1">
                              {when}{when && game.location && ' · '}{game.location}
                            </div>
                          )}
                          <div className="grid grid-cols-3 items-center gap-2">
                            <span className="text-right font-medium text-sm">{playoffSideLabel(game.homeTeam, game.homeSeed, t)}</span>
                            <div className="text-center">
                              {game.status === 'COMPLETED' ? (
                                <span className="font-bold">{game.homeScore} – {game.awayScore}</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">vs</span>
                              )}
                            </div>
                            <span className="font-medium text-sm">{playoffSideLabel(game.awayTeam, game.awaySeed, t)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={game.status === 'COMPLETED' ? 'secondary' : 'outline'} className="text-xs">{game.status}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => openPlayoffEdit(game)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deletePlayoff(game.id)} className="text-red-500"><Trash2 className="size-4" /></Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── MODALS ──────────────────────────────────────────── */}

      {/* Team modal */}
      <Dialog open={teamModal} onOpenChange={setTeamModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTeam ? t('tm.tournament.teams.modal.editTitle') : t('tm.tournament.teams.modal.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label={`${t('tm.fields.name')} *`}><input className={inp} value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="Team name" /></Field>
            <Field label={t('tm.fields.country')}><input className={inp} value={teamForm.country} onChange={e => setTeamForm(f => ({ ...f, country: e.target.value }))} placeholder="Czech Republic" /></Field>
            <Field label={t('tm.fields.primaryColor')}><input type="color" className="h-9 px-1 border rounded w-full" value={teamForm.primaryColor || '#3b82f6'} onChange={e => setTeamForm(f => ({ ...f, primaryColor: e.target.value }))} /></Field>
            <Field label={t('tm.fields.logoUrl')}><input className={inp} value={teamForm.logo} onChange={e => setTeamForm(f => ({ ...f, logo: e.target.value }))} placeholder="https://..." /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTeamModal(false)}>{t('tm.common.cancel')}</Button>
              <Button onClick={saveTeam} disabled={saving || !teamForm.name}>{saving ? t('tm.common.saving') : t('tm.common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player modal */}
      <Dialog open={playerModal} onOpenChange={setPlayerModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPlayer ? t('tm.tournament.players.modal.editTitle') : t('tm.tournament.players.modal.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label={`${t('tm.fields.name')} *`}><input className={inp} value={playerForm.name} onChange={e => setPlayerForm(f => ({ ...f, name: e.target.value }))} placeholder="Player name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.fields.number')}><input type="number" className={inp} value={playerForm.number} onChange={e => setPlayerForm(f => ({ ...f, number: e.target.value }))} placeholder="10" /></Field>
              <Field label={t('tm.fields.bornYear')}><input type="number" className={inp} value={playerForm.bornYear} onChange={e => setPlayerForm(f => ({ ...f, bornYear: e.target.value }))} placeholder="1995" /></Field>
            </div>
            <Field label={t('tm.fields.position')}><input className={inp} value={playerForm.position} onChange={e => setPlayerForm(f => ({ ...f, position: e.target.value }))} placeholder="Forward / Defence / Goalie" /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPlayerModal(false)}>{t('tm.common.cancel')}</Button>
              <Button onClick={savePlayer} disabled={saving || !playerForm.name}>{saving ? t('tm.common.saving') : t('tm.common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group modal */}
      <Dialog open={groupModal} onOpenChange={setGroupModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGroup ? t('tm.tournament.groups.modal.editTitle') : t('tm.tournament.groups.modal.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label={`${t('tm.fields.groupName')} *`}><input className={inp} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="A" /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGroupModal(false)}>{t('tm.common.cancel')}</Button>
              <Button onClick={saveGroup} disabled={saving || !groupName}>{saving ? t('tm.common.saving') : t('tm.common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign team modal */}
      <Dialog open={assignModal} onOpenChange={setAssignModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tm.tournament.groups.modal.assignTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label={t('tm.fields.team')}>
              {(() => {
                const assignedIds = new Set(groups.flatMap(g => g.teams?.map(gt => gt.team.id) ?? []));
                const available = teams.filter(tm => !assignedIds.has(tm.id));
                if (available.length === 0) {
                  return <p className="text-sm text-muted-foreground">{t('tm.tournament.groups.noAvailableTeams')}</p>;
                }
                return (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {available.map(tm => (
                      <label key={tm.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={assignTeamIds.includes(tm.id)}
                          onCheckedChange={() => toggleAssignTeam(tm.id)}
                        />
                        {tm.name}
                      </label>
                    ))}
                  </div>
                );
              })()}
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAssignModal(false)}>{t('tm.common.cancel')}</Button>
              <Button onClick={saveAssign} disabled={saving || assignTeamIds.length === 0}>{saving ? t('tm.common.saving') : t('tm.common.assign')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate schedule modal */}
      <Dialog open={scheduleModal} onOpenChange={setScheduleModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tm.tournament.groups.modal.scheduleTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.tournament.groups.schedule.startDate')}>
                <input type="date" className={inp} value={scheduleForm.startDate}
                  onChange={e => setScheduleForm(f => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label={t('tm.tournament.groups.schedule.startTime')}>
                <input type="time" className={inp} value={scheduleForm.startTime}
                  onChange={e => setScheduleForm(f => ({ ...f, startTime: e.target.value }))} />
              </Field>
              <Field label={t('tm.tournament.groups.schedule.endTime')}>
                <input type="time" className={inp} value={scheduleForm.endTime}
                  onChange={e => setScheduleForm(f => ({ ...f, endTime: e.target.value }))} />
              </Field>
              <Field label={t('tm.tournament.groups.schedule.slotDuration')}>
                <input type="number" min={1} className={inp} value={scheduleForm.slotDurationMinutes}
                  onChange={e => setScheduleForm(f => ({ ...f, slotDurationMinutes: e.target.value }))} />
              </Field>
              <Field label={t('tm.tournament.groups.schedule.minRestGames')}>
                <input type="number" min={0} className={inp} value={scheduleForm.minRestGames}
                  onChange={e => setScheduleForm(f => ({ ...f, minRestGames: e.target.value }))} />
              </Field>
            </div>
            <Field label={t('tm.tournament.groups.schedule.locations')}>
              <input type="text" className={inp} value={scheduleForm.locations}
                placeholder={t('tm.tournament.groups.schedule.locationsPlaceholder')}
                onChange={e => setScheduleForm(f => ({ ...f, locations: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setScheduleModal(false)}>{t('tm.common.cancel')}</Button>
              <Button
                onClick={submitSchedule}
                disabled={saving || !scheduleForm.startDate || !scheduleForm.startTime || !scheduleForm.endTime || !scheduleForm.locations.trim()}
              >
                {saving ? t('tm.common.saving') : t('tm.tournament.groups.generateSchedule')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate playoffs modal */}
      <Dialog open={generatePlayoffModal} onOpenChange={setGeneratePlayoffModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tm.tournament.playoff.modal.generateTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Field label={t('tm.tournament.playoff.form.qualifiersPerGroup')}>
              <input type="number" min={1} className={inp} value={playoffGenForm.qualifiersPerGroup}
                onChange={e => setPlayoffGenForm(f => ({ ...f, qualifiersPerGroup: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.tournament.playoff.form.startTime')}>
                <input type="time" className={inp} value={playoffGenForm.startTime}
                  onChange={e => setPlayoffGenForm(f => ({ ...f, startTime: e.target.value }))} />
              </Field>
              <Field label={t('tm.tournament.playoff.form.slotDuration')}>
                <input type="number" min={1} className={inp} value={playoffGenForm.slotDurationMinutes}
                  onChange={e => setPlayoffGenForm(f => ({ ...f, slotDurationMinutes: e.target.value }))} />
              </Field>
            </div>
            <Field label={t('tm.tournament.playoff.form.location')}>
              <input className={inp} value={playoffGenForm.location}
                onChange={e => setPlayoffGenForm(f => ({ ...f, location: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setGeneratePlayoffModal(false)}>{t('tm.common.cancel')}</Button>
              <Button
                onClick={submitGeneratePlayoffs}
                disabled={saving || !playoffGenForm.startTime}
              >
                {saving ? t('tm.common.saving') : t('tm.tournament.playoff.generatePlayoffs')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game result modal */}
      <Dialog open={resultModal} onOpenChange={setResultModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tm.tournament.results.modal.title')}</DialogTitle></DialogHeader>
          {editingGame && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between text-sm font-medium bg-muted/50 rounded p-3">
                <span>{editingGame.homeTeam?.name ?? t('tm.common.home')}</span>
                <span className="text-muted-foreground">vs</span>
                <span>{editingGame.awayTeam?.name ?? t('tm.common.away')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('tm.fields.homeScore')}><input type="number" min={0} className={inp} value={gameForm.homeScore} onChange={e => setGameForm(f => ({ ...f, homeScore: e.target.value }))} /></Field>
                <Field label={t('tm.fields.awayScore')}><input type="number" min={0} className={inp} value={gameForm.awayScore} onChange={e => setGameForm(f => ({ ...f, awayScore: e.target.value }))} /></Field>
              </div>
              <Field label={t('tm.fields.status')}>
                <select className={sel} value={gameForm.status} onChange={e => setGameForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="SCHEDULED">{t('tm.status.SCHEDULED')}</option>
                  <option value="IN_PROGRESS">{t('tm.status.IN_PROGRESS')}</option>
                  <option value="COMPLETED">{t('tm.status.COMPLETED')}</option>
                  <option value="POSTPONED">{t('tm.status.POSTPONED')}</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('tm.fields.date')}><input type="date" className={inp} value={gameForm.date} onChange={e => setGameForm(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label={t('tm.fields.location')}><input className={inp} value={gameForm.location} onChange={e => setGameForm(f => ({ ...f, location: e.target.value }))} /></Field>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setResultModal(false)}>{t('tm.common.cancel')}</Button>
                <Button onClick={saveResult} disabled={saving}>{saving ? t('tm.common.saving') : t('tm.common.save')}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Playoff game modal */}
      <Dialog open={playoffModal} onOpenChange={setPlayoffModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingPlayoff ? t('tm.tournament.playoff.modal.editTitle') : t('tm.tournament.playoff.modal.createTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.fields.phase')}>
                <select className={sel} value={playoffForm.phase} onChange={e => setPlayoffForm(f => ({ ...f, phase: e.target.value as TournamentGamePhase }))}>
                  {PHASE_OPTIONS.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
                </select>
              </Field>
              <Field label={t('tm.fields.bracketSlot')}>
                <input type="number" min={1} className={inp} value={playoffForm.bracketSlot} onChange={e => setPlayoffForm(f => ({ ...f, bracketSlot: e.target.value }))} placeholder="1" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.fields.homeTeam')}>
                <select className={sel} value={playoffForm.homeTeamId} onChange={e => setPlayoffForm(f => ({ ...f, homeTeamId: e.target.value }))}>
                  <option value="">{t('tm.common.tbd')}</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label={t('tm.fields.awayTeam')}>
                <select className={sel} value={playoffForm.awayTeamId} onChange={e => setPlayoffForm(f => ({ ...f, awayTeamId: e.target.value }))}>
                  <option value="">{t('tm.common.tbd')}</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            {(!playoffForm.homeTeamId || !playoffForm.awayTeamId) && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {t('tm.tournament.playoff.teamsUnknownHint')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.fields.homeScore')}>
                <input type="number" min={0} className={inp} value={playoffForm.homeScore}
                  disabled={!playoffForm.homeTeamId || !playoffForm.awayTeamId}
                  onChange={e => setPlayoffForm(f => ({ ...f, homeScore: e.target.value }))} />
              </Field>
              <Field label={t('tm.fields.awayScore')}>
                <input type="number" min={0} className={inp} value={playoffForm.awayScore}
                  disabled={!playoffForm.homeTeamId || !playoffForm.awayTeamId}
                  onChange={e => setPlayoffForm(f => ({ ...f, awayScore: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('tm.fields.date')}><input type="date" className={inp} value={playoffForm.date} onChange={e => setPlayoffForm(f => ({ ...f, date: e.target.value }))} /></Field>
              <Field label={t('tm.fields.status')}>
                <select className={sel} value={playoffForm.status} onChange={e => setPlayoffForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="SCHEDULED">{t('tm.status.SCHEDULED')}</option>
                  <option value="IN_PROGRESS">{t('tm.status.IN_PROGRESS')}</option>
                  <option value="COMPLETED" disabled={!playoffForm.homeTeamId || !playoffForm.awayTeamId}>{t('tm.status.COMPLETED')}</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPlayoffModal(false)}>{t('tm.common.cancel')}</Button>
              <Button onClick={savePlayoff} disabled={saving}>{saving ? t('tm.common.saving') : t('tm.common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
