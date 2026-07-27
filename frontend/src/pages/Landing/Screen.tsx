import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@components/base/button';
import { Card, CardContent } from '@components/base/card';
import ApplicationInfoSection from '@/pages/Home/components/ApplicationInfoSection';
import { Trophy, ArrowRight, Users, Calendar, BarChart3 } from 'lucide-react';
import logoImage from '@/assets/logo-full.png';

export default function LandingScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();

  useDocumentTitle(['Amateur Team Manager']);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoImage} alt="ATM" className="h-9" />
            <span className="font-semibold text-lg hidden sm:block">Amateur Team Manager</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/tournaments">
              <Button variant="ghost" size="sm">{t('landing.nav.tournaments')}</Button>
            </Link>
            <Link to="/seasons">
              <Button variant="ghost" size="sm">{t('landing.nav.seasons')}</Button>
            </Link>
            {user ? (
              <Link to="/dashboard">
                <Button size="sm">{t('landing.nav.dashboard')} <ArrowRight className="size-4 ml-1" /></Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm">{t('landing.nav.signIn')}</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">{t('landing.nav.getStarted')}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Trophy className="size-4" />
            {t('landing.tagline')}
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
            {t('landing.hero.title').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
          </h1>
          <p className="text-xl text-gray-600 mb-10 leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {user ? (
              <Link to="/dashboard">
                <Button size="lg" className="gap-2">
                  {t('landing.hero.ctaDashboard')} <ArrowRight className="size-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/register">
                  <Button size="lg" className="gap-2">
                    {t('landing.hero.ctaStarted')} <ArrowRight className="size-5" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline">{t('landing.hero.ctaSignIn')}</Button>
                </Link>
              </>
            )}
            <Link to="/tournaments">
              <Button size="lg" variant="ghost" className="gap-2">
                {t('landing.hero.ctaTournaments')} <Trophy className="size-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-8 text-center max-w-xl mx-auto">
            <div>
              <Users className="size-6 text-primary mx-auto mb-2" />
              <div className="font-bold text-2xl">{t('landing.stats.teams')}</div>
              <div className="text-sm text-muted-foreground">{t('landing.stats.teamsLabel')}</div>
            </div>
            <div>
              <Calendar className="size-6 text-primary mx-auto mb-2" />
              <div className="font-bold text-2xl">{t('landing.stats.schedules')}</div>
              <div className="text-sm text-muted-foreground">{t('landing.stats.schedulesLabel')}</div>
            </div>
            <div>
              <BarChart3 className="size-6 text-primary mx-auto mb-2" />
              <div className="font-bold text-2xl">{t('landing.stats.stats')}</div>
              <div className="text-sm text-muted-foreground">{t('landing.stats.statsLabel')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <ApplicationInfoSection />
      </section>

      {/* Tournament CTA */}
      <section className="container mx-auto px-4 pb-20">
        <Card className="bg-primary text-primary-foreground overflow-hidden">
          <CardContent className="pt-10 pb-10 text-center">
            <Trophy className="size-12 mx-auto mb-4 opacity-90" />
            <h2 className="text-3xl font-bold mb-3">{t('landing.tournamentCta.title')}</h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
              {t('landing.tournamentCta.description')}
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link to="/tournaments">
                <Button size="lg" variant="secondary" className="gap-2">
                  {t('landing.tournamentCta.explore')} <ArrowRight className="size-5" />
                </Button>
              </Link>
              {!user && (
                <Link to="/register?role=TOURNAMENT_MANAGER">
                  <Button size="lg" variant="outline" className="gap-2 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10">
                    {t('landing.tournamentCta.register')}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {t('landing.footer')}
        </div>
      </footer>
    </div>
  );
}
