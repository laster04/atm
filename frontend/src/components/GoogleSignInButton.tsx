import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { authApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

// The parts of Google Identity Services this button uses.
interface GoogleAccountsId {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiScript: Promise<GoogleAccountsId> | null = null;

/** Loads Google's script once for the whole app. */
const loadGsi = (): Promise<GoogleAccountsId> => {
  gsiScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('GSI missing')));
    script.onerror = () => {
      gsiScript = null;
      reject(new Error('GSI failed to load'));
    };
    document.head.appendChild(script);
  });
  return gsiScript;
};

interface GoogleSignInButtonProps {
  /** Where to go once signed in; defaults to the dashboard. */
  next?: string | null;
  /** The wording on Google's button. */
  text?: 'continue_with' | 'signup_with' | 'signin_with';
}

/**
 * "Continue with Google": signs in, or creates an activated account on the
 * first visit. Shows nothing while the server has no Google client id set.
 */
export default function GoogleSignInButton({ next, text = 'continue_with' }: GoogleSignInButtonProps) {
  const { t, i18n } = useTranslation();
  const { startSession } = useAuth();
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.googleConfig()
      .then((res) => setClientId(res.data.clientId))
      .catch(() => setClientId(null));
  }, []);

  // Google's callback is registered once; it reads the latest props from here.
  const onCredential = useRef<(credential: string) => void>(() => {});
  onCredential.current = async (credential: string) => {
    setError('');
    try {
      const res = await authApi.googleSignIn(credential);
      startSession(res.data);
      navigate(next ?? '/dashboard');
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      setError(status === 403 ? t('auth.google.deactivated') : t('auth.google.failed'));
    }
  };

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGsi()
      .then((gsi) => {
        if (cancelled || !container.current) return;
        gsi.initialize({ client_id: clientId, callback: ({ credential }) => onCredential.current(credential) });
        container.current.replaceChildren();
        gsi.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          locale: i18n.language,
          width: Math.min(400, container.current.offsetWidth || 400),
        });
      })
      .catch(() => {
        if (!cancelled) setError(t('auth.google.failed'));
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, text, i18n.language, t]);

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>}
      <div ref={container} className="flex justify-center min-h-[44px]" />
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">{t('auth.google.or')}</span>
        </div>
      </div>
    </div>
  );
}
