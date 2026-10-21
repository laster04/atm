import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListQuery } from '@/services/api';

/** Keys that belong to the detail panel, not to the list query. */
const PANEL_KEYS = ['open'];

/**
 * A list's state lives in the address: page, sort, search and every filter.
 * A link to a filtered list opens the same rows for whoever gets it, and the
 * back button steps through filter changes.
 */
export function useListParams() {
	const [searchParams, setSearchParams] = useSearchParams();

	const query = useMemo(() => {
		const result: ListQuery = {};
		searchParams.forEach((value, key) => {
			if (!PANEL_KEYS.includes(key) && value !== '') result[key] = value;
		});
		return result;
	}, [searchParams]);

	/**
	 * Sets or clears (`null`) several keys at once. Any change other than the
	 * page itself goes back to page one, so a narrower filter never lands on an
	 * empty page five.
	 */
	const update = useCallback(
		(changes: Record<string, string | null>) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				for (const [key, value] of Object.entries(changes)) {
					if (value === null || value === '') next.delete(key);
					else next.set(key, value);
				}
				if (!('page' in changes)) next.delete('page');
				return next;
			}, { replace: true });
		},
		[setSearchParams]
	);

	const openId = searchParams.get('open');

	/** Opens or closes the detail panel, keeping the list exactly as it was. */
	const setOpenId = useCallback(
		(id: string | null) => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (id) next.set('open', id);
				else next.delete('open');
				return next;
			}, { replace: true });
		},
		[setSearchParams]
	);

	return { query, update, openId, setOpenId };
}
