import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold">
            Sport Scheduler
          </Link>

          <div className="flex items-center space-x-4">
            <Link to="/seasons" className="hover:text-blue-200">
              Seasons
            </Link>

            {user ? (
              <>
                {isAdmin() && (
                  <Link to="/admin" className="hover:text-blue-200">
                    Admin
                  </Link>
                )}
                <span className="text-blue-200">
                  {user.name}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hover:text-blue-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
