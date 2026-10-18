/**
 * Where to go after signing in or activating: a page that sent the user away
 * (a season application) passes ?next=. Only paths inside the app are
 * followed, never another site; the backend applies the same rule.
 */
export function safeNextPath(value: string | null | undefined): string | null {
	return typeof value === 'string' && value.length <= 300 && /^\/(?![/\\])\S*$/.test(value) ? value : null;
}

/** `path?next=…` when there is somewhere to come back to. */
export function withNext(path: string, next: string | null): string {
	return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
