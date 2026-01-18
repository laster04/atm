import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';

interface LoginFormData {
  email: string;
  password: string;
}

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit } = useForm<LoginFormData>();
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    setLoading(true);

    try {
      await login(data.email, data.password);
      navigate('/');
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('auth.login.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">{t('auth.login.title')}</h1>

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">{t('auth.login.email')}</label>
            <input
              type="email"
              {...register('email', { required: true })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2">{t('auth.login.password')}</label>
            <input
              type="password"
              {...register('password', { required: true })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('auth.login.submitting') : t('auth.login.submit')}
          </button>
        </form>

        <p className="text-center mt-4 text-gray-600">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            {t('auth.login.registerLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
