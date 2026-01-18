import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Seasons from './pages/Seasons';
import SeasonDetail from './pages/SeasonDetail';
import TeamDetail from './pages/TeamDetail';
import Admin from './pages/Admin';
import MyTeams from './pages/MyTeams';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-100">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/seasons" element={<Seasons />} />
            <Route path="/seasons/:id" element={<SeasonDetail />} />
            <Route path="/teams/:id" element={<TeamDetail />} />
            <Route path="/my-teams" element={<MyTeams />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
