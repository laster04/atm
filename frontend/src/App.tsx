import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import { PublicLayout } from './components/public';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Activate from './pages/Activate';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Leagues from './pages/Leagues';
import LeagueDetail from './pages/LeagueDetail';
import Seasons from './pages/Seasons';
import SeasonDetail from './pages/SeasonDetail';
import TeamDetail from './pages/TeamDetail';
import PlayerDetail from './pages/PlayerDetail';
import { TeamManagerLayout, TeamManagerIndex, MyTeamsPage, TeamDetailPage, GameStatsPage, TeamManagerPlayerDetailPage } from './pages/TeamManager';
import { SeasonManagerLayout, SeasonManagerIndex, MySeasonsPage, SeasonManagePage } from './pages/SeasonManager';
import Teams from './pages/Teams';
import Players from './pages/Players';
import Games from './pages/Games';
import Stats from './pages/Stats';
import About from './pages/About';
import Tournaments from './pages/Tournaments';
import TournamentSeriesDetail from './pages/Tournaments/SeriesDetail';
import TournamentDetail from './pages/TournamentDetail';
import { AdminLayout, AdminIndex, UsersPage, LeaguesPage, SeasonsPage, MorePage, PlayersPage, PlayerDetailPage, GamesPage } from './pages/Admin';
import { TournamentManagementLayout, TournamentManagementIndex, SeriesListPage, SeriesDetailPage, TournamentManagePage } from './pages/TournamentManagement';
import GameStatistic from "@/pages/Admin/components/games/GameStatistic.tsx";
import './index.css';
import { Toaster } from "@components/base/toaster.tsx";

/**
 * The signed-in utility pages — dashboard, sign-in, registration — keep the
 * original navbar. The public part has its own shell (PublicLayout) and the
 * manager shells bring their own chrome, so neither is wrapped here.
 */
function AccountShell() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-2 py-3">
        <Outlet />
      </main>
    </div>
  );
}

function AppContent() {
  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Public part: readable signed out, one header and footer for all. */}
        <Route element={<PublicLayout />}>
          <Route path="/leagues" element={<Leagues />} />
          <Route path="/leagues/:id" element={<LeagueDetail />} />
          <Route path="/seasons" element={<Seasons />} />
          <Route path="/season-detail/:id" element={<SeasonDetail />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<TeamDetail />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/games" element={<Games />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/about" element={<About />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:id" element={<TournamentSeriesDetail />} />
          <Route path="/tournament/:id" element={<TournamentDetail />} />
        </Route>

        <Route element={<AccountShell />}>
          <Route path="/dashboard" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/activate/:token" element={<Activate />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Route>

        <Route path="/team-management" element={<TeamManagerLayout />}>
          <Route index element={<TeamManagerIndex />} />
          <Route path="my-teams" element={<MyTeamsPage />} />
          <Route path=":id" element={<TeamDetailPage />} />
          <Route path=":id/game/:gameId" element={<GameStatsPage />} />
          <Route path=":id/player/:playerId" element={<TeamManagerPlayerDetailPage />} />
          <Route path="game-statistic/:id" element={<GameStatistic />} />
        </Route>
        <Route path="/season-management" element={<SeasonManagerLayout />}>
          <Route index element={<SeasonManagerIndex />} />
          <Route path="my-seasons" element={<MySeasonsPage />} />
          <Route path=":id" element={<SeasonManagePage />} />
        </Route>
        <Route path="/tournament-management" element={<TournamentManagementLayout />}>
          <Route index element={<TournamentManagementIndex />} />
          <Route path="series" element={<SeriesListPage />} />
          <Route path="series/:id" element={<SeriesDetailPage />} />
          <Route path="tournament/:id" element={<TournamentManagePage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminIndex />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="leagues" element={<LeaguesPage />} />
          <Route path="seasons" element={<SeasonsPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:id" element={<PlayerDetailPage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="more" element={<MorePage />} />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </AuthProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
