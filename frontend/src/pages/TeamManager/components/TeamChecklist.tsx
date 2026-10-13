import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { inviteApi, teamEventApi } from '@/services/api';
import SetupChecklist, { type SetupStep } from '@/components/SetupChecklist';
import { invitesByTarget, managerState } from '@/components/invite/inviteState';
import type { ManagerInvite, Player, Team } from '@types';

type SkippableStep = 'look' | 'accounts' | 'training';

interface TeamChecklistProps {
	team: Team;
	players: Player[];
	/** The colour picked this visit, which the team object does not know yet. */
	color: string | null | undefined;
	onTabChange: (tab: 'settings' | 'events') => void;
}

/** Per team and browser: steps the manager chose to leave, e.g. no trainings. */
const skipKey = (teamId: string) => `atm.teamChecklist.skip.${teamId}`;

function readSkips(teamId: string): SkippableStep[] {
	try {
		return JSON.parse(localStorage.getItem(skipKey(teamId)) ?? '[]') as SkippableStep[];
	} catch {
		return [];
	}
}

/**
 * A new team manager's first steps, on the screen they will use every week.
 * Every step ticks from the team's own data; the optional ones can be skipped.
 */
export default function TeamChecklist({ team, players, color, onTabChange }: TeamChecklistProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const [skips, setSkips] = useState(() => readSkips(team.id));
	const [loaded, setLoaded] = useState<{ eventCount: number; invites: ManagerInvite[] } | null>(null);

	useEffect(() => {
		let cancelled = false;
		// Without either answer its step simply stays open.
		Promise.all([
			teamEventApi.getByTeam(team.id).then((res) => res.data.length).catch(() => 0),
			inviteApi.getForTeamPlayers(team.id).then((res) => res.data).catch(() => [] as ManagerInvite[]),
		]).then(([eventCount, invites]) => !cancelled && setLoaded({ eventCount, invites }));
		return () => { cancelled = true; };
	}, [team.id]);

	// Until both answer, the next step could jump; show nothing yet.
	if (!loaded) return null;
	const { eventCount } = loaded;

	const skip = (id: SkippableStep) => () => {
		const next = [...skips, id];
		try {
			localStorage.setItem(skipKey(team.id), JSON.stringify(next));
		} catch {
			// Private mode: the skip lasts until the page is left.
		}
		setSkips(next);
	};

	// Where each player stands: joined, invited (expired invites count as asked:
	// the player card offers the resend), or still to invite.
	const inviteFor = invitesByTarget(loaded.invites, 'playerId');
	const tally = { ACTIVE: 0, INVITED: 0, EXPIRED: 0, NONE: 0 };
	let uninvited: Player | undefined;
	for (const p of players) {
		const state = managerState(p.userId, inviteFor.get(p.id));
		tally[state] += 1;
		if (state === 'NONE' && !uninvited) uninvited = p;
	}
	const asked = tally.ACTIVE + tally.INVITED + tally.EXPIRED;

	const steps: SetupStep[] = [
		{
			id: 'look',
			title: t('teamChecklist.steps.look.title'),
			status: color || team.logo
				? t('teamChecklist.steps.look.set')
				: t('teamChecklist.steps.look.default'),
			body: t('teamChecklist.steps.look.body'),
			action: t('teamChecklist.steps.look.action'),
			run: () => onTabChange('settings'),
			done: !!color || !!team.logo || skips.includes('look'),
			skip: { label: t('teamChecklist.steps.look.skip'), run: skip('look') },
		},
		{
			id: 'roster',
			title: t('teamChecklist.steps.roster.title'),
			status: players.length > 0
				? t('teamChecklist.steps.roster.status', { count: players.length })
				: t('teamChecklist.steps.roster.none'),
			body: t('teamChecklist.steps.roster.body'),
			action: t('teamChecklist.steps.roster.action'),
			run: () => navigate(`/team-management/${team.id}/player/new`),
			done: players.length > 0,
		},
		{
			id: 'accounts',
			title: t('teamChecklist.steps.accounts.title'),
			status: t('teamChecklist.steps.accounts.status', {
				joined: tally.ACTIVE,
				invited: tally.INVITED + tally.EXPIRED,
				missing: tally.NONE,
			}),
			body: t('teamChecklist.steps.accounts.body'),
			action: uninvited
				? t('teamChecklist.steps.accounts.action', { name: uninvited.name })
				: t('teamChecklist.steps.accounts.actionAny'),
			// The invitation lives on the player's own page; open it there for the
			// first player nobody has asked yet.
			run: () => navigate(uninvited
				? `/team-management/${team.id}/player/${uninvited.id}?invite=1`
				: `/team-management/${team.id}/player/new`),
			done: (players.length > 0 && !uninvited) || skips.includes('accounts'),
			skip: {
				label: asked > 0
					? t('teamChecklist.steps.accounts.skipRest')
					: t('teamChecklist.steps.accounts.skip'),
				run: skip('accounts'),
			},
		},
		{
			id: 'training',
			title: t('teamChecklist.steps.training.title'),
			status: eventCount > 0
				? t('teamChecklist.steps.training.status', { count: eventCount })
				: t('teamChecklist.steps.training.none'),
			body: t('teamChecklist.steps.training.body'),
			action: t('teamChecklist.steps.training.action'),
			run: () => onTabChange('events'),
			done: eventCount > 0 || skips.includes('training'),
			skip: { label: t('teamChecklist.steps.training.skip'), run: skip('training') },
		},
	];

	return (
		<SetupChecklist
			steps={steps}
			title={t('teamChecklist.title')}
			accent={color || '#003E7E'}
			guide={{ to: '/docs/zacinate-jako-manazer-tymu', label: t('teamChecklist.guide') }}
		/>
	);
}
