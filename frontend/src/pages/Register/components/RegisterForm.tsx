import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { authApi } from '@/services/api';
import { AxiosError } from 'axios';
import { CheckCircle, Mail } from 'lucide-react';

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

  const { register: registerField, handleSubmit, watch } = useForm<RegisterFormData>();
  const { t } = useTranslation();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    setError('');

    if (data.password !== data.confirmPassword) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }

    if (data.password.length < 6) {
      setError(t('auth.register.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await authApi.register({ email: data.email, password: data.password, name: data.name });
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
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">{t('auth.register.name')}</label>
          <input
            type="text"
            {...registerField('name', { required: true })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">{t('auth.register.email')}</label>
          <input
            type="email"
            {...registerField('email', { required: true })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">{t('auth.register.password')}</label>
          <input
            type="password"
            {...registerField('password', { required: true, minLength: 6 })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">{t('auth.register.confirmPassword')}</label>
          <input
            type="password"
            {...registerField('confirmPassword', {
              required: true,
              validate: (value) => value === password || t('auth.register.passwordMismatch'),
            })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
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
