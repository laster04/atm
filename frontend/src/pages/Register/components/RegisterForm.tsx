import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { authApi } from '@/services/api';
import { AxiosError } from 'axios';
import { CheckCircle, Mail, Trophy } from 'lucide-react';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [searchParams] = useSearchParams();

  const { register: registerField, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>();
  const { t } = useTranslation();

  const SELF_REGISTERABLE_ROLES = ['TOURNAMENT_MANAGER'];
  const requestedRole = searchParams.get('role') ?? '';
  const role = SELF_REGISTERABLE_ROLES.includes(requestedRole) ? requestedRole : undefined;

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    setLoading(true);

    try {
      await authApi.register({ email: data.email, password: data.password, name: data.name, role });
      setRegisteredEmail(data.email);
      setSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('auth.register.failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-green-700 mb-2">
          {t('auth.register.success', 'Registration Successful!')}
        </h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <Mail className="h-6 w-6 mx-auto text-blue-500 mb-2" />
          <p className="text-gray-700">
            {t('auth.register.checkEmail', 'We have sent an activation link to:')}
          </p>
          <p className="font-semibold text-blue-600 mt-1">{registeredEmail}</p>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {t('auth.register.activationNote', 'Please check your email and click the activation link to complete your registration.')}
        </p>
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.register.loginLink', 'Go to Login')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {role === 'TOURNAMENT_MANAGER' && (
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-3 rounded-lg mb-4 text-sm font-medium">
          <Trophy className="size-4 shrink-0" />
          Registering as Tournament Manager
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">{t('auth.register.name')}</label>
          <input
            type="text"
            {...registerField('name', { required: 'Name is required' })}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">{t('auth.register.email')}</label>
          <input
            type="email"
            {...registerField('email', { required: 'Email is required' })}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-500' : ''}`}
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">{t('auth.register.password')}</label>
          <input
            type="password"
            {...registerField('password', {
              required: 'Password is required',
              minLength: { value: 6, message: t('auth.register.passwordTooShort') },
            })}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : ''}`}
          />
          {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">{t('auth.register.confirmPassword')}</label>
          <input
            type="password"
            {...registerField('confirmPassword', {
              required: 'Please confirm your password',
              validate: (value) => value === password || t('auth.register.passwordMismatch'),
            })}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.confirmPassword ? 'border-red-500' : ''}`}
          />
          {errors.confirmPassword && <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? t('auth.register.submitting') : t('auth.register.submit')}
        </button>
      </form>

      <p className="text-center mt-4 text-gray-600">
        {t('auth.register.hasAccount')}{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </>
  );
}
