import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { AxiosError } from 'axios';
import { leagueApi } from '@/services/api';
import type { League } from '@types';

interface InviteLeagueManagerFormData {
  email: string;
  name: string;
  locale: string;
}

interface InviteLeagueManagerModalProps {
  leagueId: number;
  onSuccess: (league: League) => void;
  onClose: () => void;
}

export default function InviteLeagueManagerModal({ leagueId, onSuccess, onClose }: InviteLeagueManagerModalProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm<InviteLeagueManagerFormData>({
    defaultValues: { email: '', name: '', locale: i18n.language === 'cs' ? 'cs' : 'en' },
  });

  const handleSubmit = async (data: InviteLeagueManagerFormData) => {
    setError('');
    setLoading(true);
    try {
      const res = await leagueApi.inviteManager(leagueId, data);
      onSuccess(res.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('admin.tabs.league.inviteManager.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">
          {t('admin.tabs.league.inviteManager.title')}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('admin.tabs.league.inviteManager.description')}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('admin.tabs.league.inviteManager.nameLabel')}
            </label>
            <input
              type="text"
              {...form.register('name', { required: true })}
              className="w-full px-3 py-2 border rounded"
              placeholder={t('admin.tabs.league.inviteManager.namePlaceholder')}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('admin.tabs.league.inviteManager.emailLabel')}
            </label>
            <input
              type="email"
              {...form.register('email', { required: true })}
              className="w-full px-3 py-2 border rounded"
              placeholder={t('admin.tabs.league.inviteManager.emailPlaceholder')}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('admin.tabs.league.inviteManager.languageLabel')}
            </label>
            <select
              {...form.register('locale', { required: true })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="cs">{t('admin.tabs.league.inviteManager.languageCs')}</option>
              <option value="en">{t('admin.tabs.league.inviteManager.languageEn')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? t('admin.tabs.league.inviteManager.sending') : t('admin.tabs.league.inviteManager.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
