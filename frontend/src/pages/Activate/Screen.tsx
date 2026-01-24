import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/base/card';
import { Button } from '@/components/base/button';

type ActivationStatus = 'loading' | 'success' | 'error';

export default function ActivateScreen() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ActivationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useDocumentTitle([t('activate.title', 'Account Activation')]);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage(t('activate.invalidToken', 'Invalid activation link'));
      return;
    }

    const activateAccount = async () => {
      try {
        await authApi.activateAccount(token);
        setStatus('success');
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(
          error.response?.data?.error || t('activate.failed', 'Account activation failed')
        );
      }
    };

    activateAccount();
  }, [token, t]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t('activate.title', 'Account Activation')}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === 'loading' && (
            <div className="py-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">
                {t('activate.activating', 'Activating your account...')}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="mt-4 text-lg font-semibold text-green-700">
                {t('activate.success', 'Account Activated!')}
              </h3>
              <p className="mt-2 text-muted-foreground">
                {t('activate.successMessage', 'Your account has been successfully activated. You can now log in.')}
              </p>
              <Button className="mt-6" onClick={() => navigate('/login')}>
                {t('activate.goToLogin', 'Go to Login')}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-8">
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <h3 className="mt-4 text-lg font-semibold text-red-700">
                {t('activate.error', 'Activation Failed')}
              </h3>
              <p className="mt-2 text-muted-foreground">{errorMessage}</p>
              <div className="mt-6 space-y-2">
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    {t('activate.goToLogin', 'Go to Login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="ghost" className="w-full">
                    {t('activate.registerAgain', 'Register Again')}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
