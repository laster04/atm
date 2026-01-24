import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Leagues from './pages/Leagues';
import LeagueDetail from './pages/LeagueDetail';
import Seasons from './pages/Seasons';
import SeasonDetail from './pages/SeasonDetail';
import TeamDetail from './pages/TeamDetail';
import TeamManagerDashboard from './pages/TeamManagerDashboard';
import Detail from './pages/TeamManagerDashboard/Detail.tsx';
import Admin from './pages/Admin';
import './index.css';
import { Toaster } from "@components/base/toaster.tsx";

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gray-100">
              <Navbar />
              <Toaster />
              <main className="container mx-auto px-2 py-3">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/leagues" element={<Leagues />} />
                  <Route path="/leagues/:id" element={<LeagueDetail />} />
                  <Route path="/seasons" element={<Seasons />} />
                  <Route path="/seasons/:id" element={<SeasonDetail />} />
                  <Route path="/teams/:id" element={<TeamDetail />} />
                  <Route path="/my-teams" element={<TeamManagerDashboard />} />
                  <Route path="/team-management/:id" element={<Detail />} />
                  <Route path="/admin" element={<Admin />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </AuthProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
