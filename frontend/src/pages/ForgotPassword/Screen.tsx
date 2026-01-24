import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react';
import { authApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/base/card';
import { Button } from '@/components/base/button';
import { Input } from '@/components/base/input';
import { Label } from '@/components/base/label';
import { AxiosError } from 'axios';

interface ForgotPasswordFormData {
  email: string;
}

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit } = useForm<ForgotPasswordFormData>();

  useDocumentTitle([t('auth.forgotPassword.title', 'Forgot Password')]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('auth.forgotPassword.failed', 'Failed to process request'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>{t('auth.forgotPassword.emailSent', 'Check Your Email')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <Mail className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-gray-700">
                {t('auth.forgotPassword.emailSentTo', 'If an account exists, we sent a reset link to:')}
              </p>
              <p className="font-semibold text-blue-600 mt-1">{submittedEmail}</p>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {t('auth.forgotPassword.checkSpam', "Don't see the email? Check your spam folder.")}
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('auth.forgotPassword.backToLogin', 'Back to Login')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t('auth.forgotPassword.title', 'Forgot Password')}</CardTitle>
          <CardDescription>
            {t('auth.forgotPassword.description', "Enter your email and we'll send you a reset link")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.forgotPassword.email', 'Email')}</Label>
              <Input
                id="email"
                type="email"
                {...register('email', { required: true })}
                placeholder="you@example.com"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t('auth.forgotPassword.sending', 'Sending...')
                : t('auth.forgotPassword.submit', 'Send Reset Link')}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">
              <ArrowLeft className="h-4 w-4 inline mr-1" />
              {t('auth.forgotPassword.backToLogin', 'Back to Login')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
