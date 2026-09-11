import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../services/api';
import { Role } from '@types';
import type { User, AuthContextType } from '@types';

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
        return;
      }
      authApi.getMe()
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await authApi.register({ email, password, name });
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const completeOnboarding = async () => {
    const res = await authApi.completeOnboarding();
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const completeTeamTour = async () => {
    const res = await authApi.completeTeamTour();
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  // These describe what the user actually manages, not a role they were given.
  // One account can be several of them at once - running a league and managing a
  // team are separate relations. The server re-checks every request; these only
  // decide what the UI offers.
  const isAdmin = () => user?.role === Role.ADMIN;
  const isSeasonManager = () => isAdmin() || (user?.manages?.leagues ?? 0) > 0;
  const isTeamManager = () => isAdmin() || (user?.manages?.teams ?? 0) > 0;
  const isTournamentManager = () => isAdmin() || (user?.manages?.series ?? 0) > 0;
  const canManageTeam = (teamManagerId?: string | null) =>
    isAdmin() || user?.id === teamManagerId || (user?.manages?.leagues ?? 0) > 0;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      completeOnboarding,
      completeTeamTour,
      isAdmin,
      isSeasonManager,
      isTeamManager,
      isTournamentManager,
      canManageTeam
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
