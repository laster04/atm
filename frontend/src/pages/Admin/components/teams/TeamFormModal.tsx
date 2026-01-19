import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { User } from '@types';

interface TeamFormData {
  name: string;
  managerId?: string;
}

interface TeamFormModalProps {
  teamManagers: User[];
  onSubmit: (data: TeamFormData) => void;
  onClose: () => void;
}

export default function TeamFormModal({ teamManagers, onSubmit, onClose }: TeamFormModalProps) {
  const { t } = useTranslation();
  const form = useForm<TeamFormData>();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{t('admin.modal.addTeam')}</h3>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('admin.modal.teamName')}</label>
            <input
              type="text"
              {...form.register('name', { required: true })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('admin.modal.manager')}</label>
            <select {...form.register('managerId')} className="w-full px-3 py-2 border rounded">
              <option value="">{t('admin.modal.noManager')}</option>
              {teamManagers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {t('admin.modal.addTeam')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type { TeamFormData };
