import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanStatus, TournamentPlan } from '@types';
import { adminApi, tournamentApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { formatSeasonDate } from '@/utils/date';
import { Button } from '@components/base/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/base/dialog';
import UpgradeDialog from './UpgradeDialog';

const PLANS: TournamentPlan[] = ['FREE', 'TOURNAMENT', 'TOURNAMENT_PLUS'];
/** Matches the server's RENEWAL_DAYS: how long before the end a year can be renewed. */
const RENEWAL_DAYS = 30;

interface PlanChipProps {
  tournamentId: string;
  /** Teams on the page now, so the count follows additions without a reload. */
  teams: number;
  /** Raised each time something hit the plan's limit: opens the offer, or the payment waiting. */
  offerSignal?: number;
}

/**
 * The tournament's plan and how full it is, with the way to a bigger one:
 * the offer, then the QR payment while ATM waits for the money. An admin can
 * also set the plan by hand.
 */
export default function PlanChip({ tournamentId, teams, offerSignal = 0 }: PlanChipProps) {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<TournamentPlan>('FREE');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    tournamentApi.getPlan(tournamentId).then((res) => setStatus(res.data)).catch(() => setStatus(null));
  }, [tournamentId]);

  useEffect(load, [load]);
  useEffect(() => {
    if (offerSignal > 0) setUpgrading(true);
  }, [offerSignal]);

  if (!status) return null;

  const until = status.organizerUntil && formatSeasonDate(status.organizerUntil, i18n.language);
  const name = until ? t('plans.organizerUntil', { date: until }) : t(`plans.names.${status.plan}`);
  const full = status.limit !== null && teams >= status.limit;
  // The Organizer year is renewed in its last days; the dialog says when the offer is not there yet.
  const renewal = status.plan === 'ORGANIZER' && status.organizerUntil !== null
    && new Date(status.organizerUntil).getTime() - Date.now() <= RENEWAL_DAYS * 24 * 60 * 60 * 1000;
  const canUpgrade = renewal || (status.plan !== 'ORGANIZER' && status.ownPlan !== 'TOURNAMENT_PLUS');

  const openEdit = () => {
    setPlan(status.ownPlan);
    setReason('');
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await adminApi.setTournamentPlan(tournamentId, plan, reason.trim());
      load();
      setEditing(false);
    } catch {
      setError(t('plans.changeError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span
        className={`text-xs rounded px-2 py-0.5 border ${full ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-muted text-muted-foreground'}`}
        title={status.plan === 'ORGANIZER' ? t('plans.organizerNote') : undefined}
      >
        {status.limit === null
          ? t('plans.usageUnlimited', { plan: name, count: teams })
          : t('plans.usage', { plan: name, teams, limit: status.limit })}
      </span>
      {status.payment ? (
        <button type="button" onClick={() => setUpgrading(true)} className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline">
          {t('plans.awaitingPayment', { plan: t(`plans.names.${status.payment.plan}`) })}
        </button>
      ) : canUpgrade && (
        <button type="button" onClick={() => setUpgrading(true)} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
          {renewal ? t('plans.renew') : t('plans.upgrade')}
        </button>
      )}
      {isAdmin() && (
        <button type="button" onClick={openEdit} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          {t('plans.change')}
        </button>
      )}

      <UpgradeDialog
        tournamentId={tournamentId}
        open={upgrading}
        onOpenChange={setUpgrading}
        payment={status.payment}
        onChanged={load}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('plans.changeTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium block">
              {t('plans.label')}
              <select
                className="mt-1 w-full px-3 py-2 border rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                value={plan}
                onChange={(e) => setPlan(e.target.value as TournamentPlan)}
              >
                {PLANS.map((p) => <option key={p} value={p}>{t(`plans.names.${p}`)}</option>)}
              </select>
            </label>
            {status.plan === 'ORGANIZER' && <p className="text-xs text-muted-foreground">{t('plans.organizerNote')}</p>}
            <label className="text-sm font-medium block">
              {t('plans.reason')}
              <input
                className="mt-1 w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">{t('plans.changeHint')}</p>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>{t('plans.cancel')}</Button>
              <Button onClick={() => void save()} disabled={saving || plan === status.ownPlan}>{t('plans.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
