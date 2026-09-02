import { useAuth } from '@/context/AuthContext';
import SpotlightTour, { type TourStep } from '@/components/SpotlightTour';

const STEPS: TourStep[] = [
  { target: 'team-tab-overview', titleKey: 'teamTour.steps.overview.title', bodyKey: 'teamTour.steps.overview.body' },
  { target: 'team-tab-roster', titleKey: 'teamTour.steps.roster.title', bodyKey: 'teamTour.steps.roster.body' },
  { target: 'team-tab-schedule', titleKey: 'teamTour.steps.schedule.title', bodyKey: 'teamTour.steps.schedule.body' },
  { target: 'team-tab-settings', titleKey: 'teamTour.steps.settings.title', bodyKey: 'teamTour.steps.settings.body' },
];

export default function TeamManagerTour() {
  const { user, completeTeamTour } = useAuth();

  const eligible = !!user && !user.teamTourCompletedAt;

  return (
    <SpotlightTour
      steps={STEPS}
      eligible={eligible}
      onFinish={() => completeTeamTour().catch((err) => console.error(err))}
    />
  );
}
