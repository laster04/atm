import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import type { PlanName } from '@types';

interface PlanLimitBody {
	code?: string;
	plan?: PlanName;
	limit?: number | null;
	pending?: { plan: PlanName } | null;
}

const planLimitBody = (err: unknown): PlanLimitBody | null => {
	if (!isAxiosError<PlanLimitBody>(err)) return null;
	const body = err.response?.data;
	return err.response?.status === 409 && body?.code === 'PLAN_LIMIT' && body.plan ? body : null;
};

/** Whether the server refused because the tournament's plan has no place left (409 PLAN_LIMIT). */
export const isPlanLimit = (err: unknown): boolean => planLimitBody(err) !== null;

/**
 * The message for a refusal because the tournament's plan has no place left,
 * or null for any other error. With a plan already paid for and waiting, it
 * says the place opens once the payment is confirmed.
 */
export function planLimitMessage(err: unknown, t: TFunction): string | null {
	const body = planLimitBody(err);
	if (!body) return null;
	if (body.pending) return t('plans.limitPending', { plan: t(`plans.names.${body.pending.plan}`) });
	return t('plans.limitReached', { plan: t(`plans.names.${body.plan}`), limit: body.limit });
}
