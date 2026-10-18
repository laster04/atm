import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../../context/AuthContext';
import { safeNextPath, withNext } from '@/utils/nextPath';
import { normalizeEmail } from '../../../utils/email';
import { AxiosError } from 'axios';
import { Button } from '@components/base/button';
import { Input } from '@components/base/input';
import { Label } from '@components/base/label';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit } = useForm<LoginFormData>();
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Where to go after signing in: a page that sent the user here (a season
  // application) passes ?next=. Only paths inside the app are followed.
  const [searchParams] = useSearchParams();
  const afterLogin = safeNextPath(searchParams.get('next')) ?? '/dashboard';

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setLoading(true);

    try {
      await login(normalizeEmail(data.email), data.password);
      navigate(afterLogin);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('auth.login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.login.email')}</Label>
            <Input
              id="email"
              type="email"
              {...register('email', { required: true })}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.login.password')}</Label>
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                {t('auth.login.forgotPassword', 'Forgot password?')}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password', { required: true })}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </div>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t('auth.login.noAccount')}{' '}
            <Link to={withNext('/register', safeNextPath(searchParams.get('next')))} className="text-blue-600 hover:underline">
              {t('auth.login.registerLink')}
            </Link>
          </span>
        </div>
      </div>
    </>
  );
}
