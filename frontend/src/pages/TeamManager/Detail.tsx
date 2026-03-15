import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	ArrowLeft,
	Home,
	Users,
	BarChart3,
	Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { teamApi, playerApi, seasonApi } from '@/services/api';
import { Button } from '@components/base/button';
import type { Player, Standing, Team } from '@types';
import OverviewTab from './components/OverviewTab';
import RosterTab from './components/RosterTab';
import ScheduleTab from './components/ScheduleTab';
import SettingsTab from './components/SettingsTab';

type TabType = 'overview' | 'roster' | 'schedule' | 'settings';

export default function Detail() {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { isAdmin, canManageTeam } = useAuth();

	const [activeTab, setActiveTab] = useState<TabType>('overview');
	const [team, setTeam] = useState<Team | null>(null);
	const [players, setPlayers] = useState<Player[]>([]);
	const [standing, setStanding] = useState<Standing | undefined>();
	const [loading, setLoading] = useState(false);
	const [localColor, setLocalColor] = useState<string | null | undefined>(null);

	useEffect(() => {
		if (!id) return;
		setLoading(true);
		Promise.all([
			teamApi.getById(id),
			playerApi.getByTeam(id)
		])
			.then(([teamRes, playersRes]) => {
				setTeam(teamRes.data);
				setPlayers(playersRes.data);
				setLocalColor(teamRes.data.primaryColor);
			})
			.catch((err) => console.error(err))
			.finally(() => setLoading(false));
	}, [id]);

	useEffect(() => {
		const fetchData = async () => {
			if (!team || !team.season) return;
			try {
				const standingsRes = await seasonApi.getTeamStanding(team.season.id, team.id);
				setStanding(standingsRes.data);
			} catch (error) {
				console.error('Failed to fetch season data:', error);
			}
		};
		fetchData();
	}, [team]);

	const handleBack = () => {
		if (isAdmin()) {
			navigate('/admin/teams')
		} else {
			navigate('/team-management/my-teams');
		}
	};

	const tabs = [
		{ id: 'overview' as TabType, icon: Home, label: t('teamManagement.pwa.tabs.overview') },
		{ id: 'roster' as TabType, icon: Users, label: t('teamManagement.pwa.tabs.roster') },
		{ id: 'schedule' as TabType, icon: BarChart3, label: t('teamManagement.pwa.tabs.schedule') },
		{ id: 'settings' as TabType, icon: Settings, label: t('teamManagement.pwa.tabs.settings') },
	];

	if (loading && !team) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">{t('teamDetail.loading')}</div>
			</div>
		);
	}

	if (!team) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">{t('teamDetail.notFound')}</div>
			</div>
		);
	}

	const canManage = canManageTeam(team.managerId);

	if (!canManage) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-red-600">{t('myTeams.accessDenied')}</h1>
					<p className="text-gray-600 mt-2">{t('myTeams.noPrivileges')}</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background flex flex-col lg:flex-row">
			{/* Mobile/Tablet Header */}
			<div
				className="sticky top-0 z-10 text-white border-b shadow-md lg:hidden"
				style={{ backgroundColor: localColor || '#003E7E' }}
			>
				<div className="px-4 py-3">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							className="text-white hover:bg-white/20 -ml-2"
							onClick={handleBack}
						>
							<ArrowLeft className="size-5" />
						</Button>
						<div className="flex-1 min-w-0">
							<h1 className="text-lg font-bold truncate">{team.name}</h1>
							{team.season && (
								<p className="text-sm opacity-80 truncate">{team.season.name}</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Desktop Sidebar */}
			<div
				className="hidden lg:flex lg:flex-col lg:w-64 text-white border-r shadow-sm"
				style={{ backgroundColor: localColor || '#003E7E' }}
			>
				<div className="p-6 border-b border-white/20">
					<Button
						variant="ghost"
						size="sm"
						className="text-white hover:bg-white/20 -ml-2 mb-4"
						onClick={handleBack}
					>
						<ArrowLeft className="size-5 mr-2" />
						Back
					</Button>
					<h1 className="text-2xl font-bold">{team.name}</h1>
					{team.season && (
						<p className="text-sm opacity-80 mt-2">{team.season.name}</p>
					)}
				</div>

				{/* Desktop Navigation */}
				<nav className="flex-1 p-4 space-y-2">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
								activeTab === tab.id
									? 'bg-white/20 text-white'
									: 'text-white/80 hover:bg-white/10'
							}`}
						>
							<tab.icon className="size-5" />
							<span className="font-medium">{tab.label}</span>
						</button>
					))}
				</nav>
			</div>

			{/* Main Content */}
			<div className="flex-1 flex flex-col">
				{/* Desktop Header - Visible only on desktop */}
				<div className="hidden lg:block border-b bg-card">
					<div className="px-6 py-4">
						<h2 className="text-xl font-semibold text-foreground">
							{activeTab === 'overview' && 'Overview'}
							{activeTab === 'roster' && 'Team Roster'}
							{activeTab === 'schedule' && 'Schedule'}
							{activeTab === 'settings' && 'Settings'}
						</h2>
					</div>
				</div>

				{/* Content Area */}
				<div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
					{activeTab === 'overview' && (
						<OverviewTab
							team={team}
							standing={standing}
							onTabChange={setActiveTab}
						/>
					)}
					{activeTab === 'roster' && (
						<RosterTab
							players={players}
							teamId={team.id}
							teamColor={localColor}
						/>
					)}
					{activeTab === 'schedule' && (
						<ScheduleTab
							games={team.games || []}
							teamId={team.id}
						/>
					)}
					{activeTab === 'settings' && (
						<SettingsTab
							team={team}
							standing={standing}
							onColorChange={setLocalColor}
							onTeamUpdate={setTeam}
						/>
					)}
				</div>

				{/* Mobile Bottom Navigation */}
				<div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20 lg:hidden">
					<div className="grid grid-cols-4 h-16">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`flex flex-col items-center justify-center gap-1 transition-colors ${
									activeTab === tab.id
										? 'text-primary'
										: 'text-muted-foreground'
								}`}
							>
								<tab.icon className="size-5" />
								<span className="text-xs font-medium">{tab.label}</span>
							</button>
						))}
					</div>
				</div>

				{/* Mobile Content Padding */}
				<div className="h-16 lg:hidden" />
			</div>
		</div>
	);
}
