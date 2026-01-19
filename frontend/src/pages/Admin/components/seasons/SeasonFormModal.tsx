import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { SeasonStatus } from '@types';

interface SeasonFormData {
  name: string;
  sportType: string;
  startDate: string;
  endDate: string;
  status: SeasonStatus;
}

interface SeasonFormModalProps {
  onSubmit: (data: SeasonFormData) => void;
  onClose: () => void;
}

export default function SeasonFormModal({ onSubmit, onClose }: SeasonFormModalProps) {
  const { t } = useTranslation();
  const form = useForm<SeasonFormData>({
    defaultValues: { status: 'DRAFT' },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{t('admin.modal.createSeason')}</h3>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('admin.modal.name')}</label>
            <input
              type="text"
              {...form.register('name', { required: true })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('admin.modal.sportType')}</label>
            <input
              type="text"
              {...form.register('sportType', { required: true })}
              className="w-full px-3 py-2 border rounded"
              placeholder={t('admin.modal.sportTypePlaceholder')}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.modal.startDate')}</label>
              <input
                type="date"
                {...form.register('startDate', { required: true })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.modal.endDate')}</label>
              <input
                type="date"
                {...form.register('endDate', { required: true })}
                className="w-full px-3 py-2 border rounded"
                required
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('admin.modal.status')}</label>
            <select {...form.register('status')} className="w-full px-3 py-2 border rounded">
              <option value="DRAFT">{t('seasons.status.DRAFT')}</option>
              <option value="ACTIVE">{t('seasons.status.ACTIVE')}</option>
              <option value="COMPLETED">{t('seasons.status.COMPLETED')}</option>
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
              {t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type { SeasonFormData };
