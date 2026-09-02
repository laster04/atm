import { useAuth } from '@/context/AuthContext';
import SpotlightTour, { type TourStep } from './SpotlightTour';

const STEPS: TourStep[] = [
  { target: 'dashboard-title', titleKey: 'onboarding.steps.welcome.title', bodyKey: 'onboarding.steps.welcome.body' },
  { target: 'nav-menu', titleKey: 'onboarding.steps.navMenu.title', bodyKey: 'onboarding.steps.navMenu.body' },
  { target: 'my-teams-section', titleKey: 'onboarding.steps.myTeams.title', bodyKey: 'onboarding.steps.myTeams.body' },
  { target: 'active-seasons-section', titleKey: 'onboarding.steps.activeSeasons.title', bodyKey: 'onboarding.steps.activeSeasons.body' },
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
