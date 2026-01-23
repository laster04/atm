import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext.tsx';
import { AxiosError } from 'axios';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register: registerField, handleSubmit, watch } = useForm<RegisterFormData>();
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      await register(data.email, data.password, data.name);
      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('auth.register.failed'));
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
