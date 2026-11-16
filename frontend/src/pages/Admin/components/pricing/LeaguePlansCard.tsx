import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi } from '@/services/api';
import ConfirmDialog from '../list/ConfirmDialog';
import { Card } from './shared';

/**
 * The League plan paywall. Off, every new season is free; on, an organiser's
 * second season or league waits for the plan. Seasons already created keep
 * their cover either way.
 */
export default function LeaguePlansCard({ enabled, canEdit, onChanged }: { enabled: boolean; canEdit: boolean; onChanged: () => void }) {
	const { t } = useTranslation();
	const [confirming, setConfirming] = useState(false);

	const toggle = async (reason: string) => {
		try {
			await adminApi.setLeaguePlans(!enabled, reason);
			toast.success(t(enabled ? 'adminShell.pricing.leaguePlans.switchedOff' : 'adminShell.pricing.leaguePlans.switchedOn'));
			onChanged();
		} catch (error) {
			toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('adminShell.pricing.saveError'));
			throw error;
		}
	};

	return (
		<Card
			title={t('adminShell.pricing.leaguePlans.title')}
			action={
				<button
					type="button"
					role="switch"
					aria-checked={enabled}
					aria-label={t('adminShell.pricing.leaguePlans.title')}
					disabled={!canEdit}
					onClick={() => setConfirming(true)}
					className="h-8 rounded-full border border-border px-3 text-[13px] font-bold disabled:cursor-not-allowed"
					style={{ backgroundColor: enabled ? '#DCFCE7' : '#E2E8F0', color: enabled ? '#14532D' : '#0F172A' }}
				>
					{enabled ? t('adminShell.pricing.on') : t('adminShell.pricing.off')}
				</button>
			}
		>
			<p className="px-4 py-3.5 text-[13px] leading-snug text-muted-foreground">
				{enabled ? t('adminShell.pricing.leaguePlans.onHint') : t('adminShell.pricing.leaguePlans.offHint')}
			</p>

			{confirming && (
				<ConfirmDialog
					title={enabled ? t('adminShell.pricing.leaguePlans.offTitle') : t('adminShell.pricing.leaguePlans.onTitle')}
					description={enabled ? t('adminShell.pricing.leaguePlans.offConfirm') : t('adminShell.pricing.leaguePlans.onConfirm')}
					confirmLabel={enabled ? t('adminShell.pricing.switchOff') : t('adminShell.pricing.switchOn')}
					reason="required"
					onConfirm={toggle}
					onClose={() => setConfirming(false)}
				/>
			)}
		</Card>
	);
}
