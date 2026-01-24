import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { CheckCircle, XCircle, KeyRound } from 'lucide-react';
import { authApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/base/card';
import { Button } from '@/components/base/button';
import { Input } from '@/components/base/input';
import { Label } from '@/components/base/label';
import { AxiosError } from 'axios';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordScreen() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch } = useForm<ResetPasswordFormData>();
  const password = watch('password');

  useDocumentTitle([t('auth.resetPassword.title', 'Reset Password')]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError('');

    if (data.password !== data.confirmPassword) {
      setError(t('auth.resetPassword.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (data.password.length < 6) {
      setError(t('auth.resetPassword.passwordTooShort', 'Password must be at least 6 characters'));
      return;
    }

    setLoading(true);

    try {
      await authApi.resetPassword(token!, data.password);
      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('auth.resetPassword.failed', 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <XCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-red-700 mb-2">
              {t('auth.resetPassword.invalidLink', 'Invalid Reset Link')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t('auth.resetPassword.invalidLinkMessage', 'This password reset link is invalid or has expired.')}
            </p>
            <Link to="/forgot-password">
              <Button>{t('auth.resetPassword.requestNew', 'Request New Link')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.resetPassword.successTitle', 'Password Reset!')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <p className="text-gray-700 mb-4">
              {t('auth.resetPassword.successMessage', 'Your password has been successfully reset. You can now log in with your new password.')}
            </p>
            <Button className="w-full" onClick={() => navigate('/login')}>
              {t('auth.resetPassword.goToLogin', 'Go to Login')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('auth.resetPassword.title', 'Reset Password')}</CardTitle>
          <CardDescription>
            {t('auth.resetPassword.description', 'Enter your new password below')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.resetPassword.newPassword', 'New Password')}</Label>
              <Input
                id="password"
                type="password"
                {...register('password', { required: true, minLength: 6 })}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.resetPassword.confirmPassword', 'Confirm Password')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword', {
                  required: true,
                  validate: (value) => value === password || t('auth.resetPassword.passwordMismatch', 'Passwords do not match'),
                })}
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t('auth.resetPassword.resetting', 'Resetting...')
                : t('auth.resetPassword.submit', 'Reset Password')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
