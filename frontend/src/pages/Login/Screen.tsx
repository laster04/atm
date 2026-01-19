import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/base/card';
import LoginForm from './components/LoginForm';

export default function LoginScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('auth.login.title')}</CardTitle>
          <CardDescription>Sign in to manage your hockey season</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
