import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { adminApi } from '@/services/api';
import type { PricingOverview } from '@types';
import ConfirmDialog from '../list/ConfirmDialog';
import { formatMoney } from './money';
import { Card } from './shared';

/** The OSS switch and the year's count of EU sales without a VAT ID against 10 000 €. */
export default function OssCard({ oss, canEdit, onChanged }: { oss: PricingOverview['oss']; canEdit: boolean; onChanged: () => void }) {
	const { t, i18n } = useTranslation();
	const [confirming, setConfirming] = useState(false);
	const share = Math.min(100, Math.round((oss.totalEurCents / oss.limitEurCents) * 100));
	const barColour = oss.level === 'EXCEEDED' ? '#DC2626' : oss.level === 'WARNING' ? '#F59E0B' : '#38BDF8';

	const toggle = async (reason: string) => {
		try {
			await adminApi.setOss(!oss.enabled, reason);
			toast.success(t(oss.enabled ? 'adminShell.pricing.ossSwitchedOff' : 'adminShell.pricing.ossSwitchedOn'));
			onChanged();
		} catch (error) {
			toast.error((error as AxiosError<{ error?: string }>).response?.data?.error ?? t('adminShell.pricing.saveError'));
			throw error;
		}
	};

	return (
		<Card
			title={t('adminShell.pricing.oss')}
			action={
				<button
					type="button"
					role="switch"
					aria-checked={oss.enabled}
					aria-label={t('adminShell.pricing.oss')}
					disabled={!canEdit}
					onClick={() => setConfirming(true)}
					className="h-8 rounded-full border border-border px-3 text-[13px] font-bold disabled:cursor-not-allowed"
					style={{ backgroundColor: oss.enabled ? '#DCFCE7' : '#E2E8F0', color: oss.enabled ? '#14532D' : '#0F172A' }}
				>
					{oss.enabled ? t('adminShell.pricing.on') : t('adminShell.pricing.off')}
				</button>
			}
		>
			<div className="flex flex-col gap-3 px-4 py-3.5">
				<p className="text-[13px] leading-snug text-muted-foreground">
					{oss.enabled ? t('adminShell.pricing.ossOnHint') : t('adminShell.pricing.ossOffHint')}
				</p>
				<div className="flex flex-col gap-1.5">
					<div className="flex justify-between gap-2 text-[13px] font-semibold">
						<span>{t('adminShell.pricing.ossCounter', { year: oss.year })}</span>
						<span className="tabular-nums">
							{t('adminShell.pricing.ossOf', {
								total: formatMoney(oss.totalEurCents, 'EUR', i18n.language),
								limit: formatMoney(oss.limitEurCents, 'EUR', i18n.language),
							})}
						</span>
					</div>
					<div role="progressbar" aria-valuenow={share} aria-valuemin={0} aria-valuemax={100} aria-label={t('adminShell.pricing.ossCounter', { year: oss.year })} className="h-2.5 overflow-hidden rounded-full bg-[#E2E8F0]">
						<div className="h-full" style={{ width: `${share}%`, backgroundColor: barColour }} />
					</div>
					<span className="text-[12.5px] text-muted-foreground">
						{oss.tracked ? t('adminShell.pricing.ossAlerts') : t('adminShell.pricing.ossNotTracked')}
					</span>
				</div>
			</div>

			{confirming && (
				<ConfirmDialog
					title={oss.enabled ? t('adminShell.pricing.ossOffTitle') : t('adminShell.pricing.ossOnTitle')}
					description={oss.enabled ? t('adminShell.pricing.ossOffConfirm') : t('adminShell.pricing.ossOnConfirm')}
					confirmLabel={oss.enabled ? t('adminShell.pricing.switchOff') : t('adminShell.pricing.switchOn')}
					reason="required"
					onConfirm={toggle}
					onClose={() => setConfirming(false)}
				/>
			)}
		</Card>
	);
}
