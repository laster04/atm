import { useAuth } from '@/context/AuthContext';
import SpotlightTour, { type TourStep } from './SpotlightTour';

const STEPS: TourStep[] = [
  { target: 'dashboard-title', titleKey: 'onboarding.steps.welcome.title', bodyKey: 'onboarding.steps.welcome.body' },
  { target: 'workspaces', titleKey: 'onboarding.steps.workspaces.title', bodyKey: 'onboarding.steps.workspaces.body' },
  { target: 'my-teams-section', titleKey: 'onboarding.steps.myTeams.title', bodyKey: 'onboarding.steps.myTeams.body' },
  { target: 'open-competitions', titleKey: 'onboarding.steps.openCompetitions.title', bodyKey: 'onboarding.steps.openCompetitions.body' },
];

export default function OnboardingTour() {
  const { user, completeOnboarding } = useAuth();

  const eligible = !!user && !user.onboardingCompletedAt;

  return (
    <SpotlightTour
      steps={STEPS}
      eligible={eligible}
      onFinish={() => completeOnboarding().catch((err) => console.error(err))}
    />
  );
}
