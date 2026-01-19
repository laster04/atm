import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Seasons from './pages/Seasons';
import SeasonDetail from './pages/SeasonDetail';
import TeamDetail from './pages/TeamDetail';
import TeamManagerDashboard from './pages/TeamManagerDashboard';
import Admin from './pages/Admin';
import './index.css';

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gray-100">
              <Navbar />
              <main className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/seasons" element={<Seasons />} />
                  <Route path="/seasons/:id" element={<SeasonDetail />} />
                  <Route path="/teams/:id" element={<TeamDetail />} />
                  <Route path="/my-teams" element={<TeamManagerDashboard />} />
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
