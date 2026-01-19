import { useTranslation } from 'react-i18next';
import RegisterForm from './components/RegisterForm';

export default function RegisterScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">{t('auth.register.title')}</h1>
        <RegisterForm />
      </div>
    </div>
  );
}
