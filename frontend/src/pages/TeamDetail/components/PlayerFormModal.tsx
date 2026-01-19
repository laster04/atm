import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { Player } from '@types';

interface PlayerFormData {
  name: string;
  number?: string;
  position?: string;
}

interface PlayerFormModalProps {
  player: Player | null;
  onSubmit: (data: PlayerFormData) => void;
  onClose: () => void;
}

export default function PlayerFormModal({ player, onSubmit, onClose }: PlayerFormModalProps) {
  const { t } = useTranslation();
  const form = useForm<PlayerFormData>({
    defaultValues: {
      name: player?.name || '',
      number: player?.number?.toString() || '',
      position: player?.position || '',
    },
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">
          {player ? t('teamDetail.modal.editPlayer') : t('teamDetail.modal.addPlayer')}
        </h3>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('teamDetail.modal.name')}</label>
            <input
              type="text"
              {...form.register('name', { required: true })}
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('teamDetail.modal.number')}
              </label>
              <input
                type="number"
                {...form.register('number')}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('teamDetail.modal.position')}
              </label>
              <input
                type="text"
                {...form.register('position')}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
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
              {player ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type { PlayerFormData };
