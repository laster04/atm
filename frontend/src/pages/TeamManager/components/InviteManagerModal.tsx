import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { AxiosError } from 'axios';
import { teamApi } from '@/services/api';
import type { Team } from '@types';

interface InviteManagerFormData {
  email: string;
  name: string;
}

interface InviteManagerModalProps {
  teamId: number;
  onSuccess: (team: Team) => void;
  onClose: () => void;
}

export default function InviteManagerModal({ teamId, onSuccess, onClose }: InviteManagerModalProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const form = useForm<InviteManagerFormData>({
    defaultValues: { email: '', name: '' },
  });

  const handleSubmit = async (data: InviteManagerFormData) => {
    setError('');
    setLoading(true);
    try {
      const res = await teamApi.inviteManager(teamId, { ...data, locale: i18n.language });
      onSuccess(res.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || t('teamDetail.inviteManager.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-2">
          {t('teamDetail.inviteManager.title')}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('teamDetail.inviteManager.description')}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('teamDetail.inviteManager.nameLabel')}
            </label>
            <input
              type="text"
              {...form.register('name', { required: true })}
              className="w-full px-3 py-2 border rounded"
              placeholder={t('teamDetail.inviteManager.namePlaceholder')}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {t('teamDetail.inviteManager.emailLabel')}
            </label>
            <input
              type="email"
              {...form.register('email', { required: true })}
              className="w-full px-3 py-2 border rounded"
              placeholder={t('teamDetail.inviteManager.emailPlaceholder')}
              required
            />
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
              {loading ? t('teamDetail.inviteManager.sending') : t('teamDetail.inviteManager.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
