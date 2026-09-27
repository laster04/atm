import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * A back action for screens reached from more than one place.
 *
 * With an in-app page behind it, it steps back through history, so the screen
 * that opened this one is where the user lands - with its own state intact.
 * Opened straight from a link there is nothing behind, and stepping back would
 * leave the app, so it replaces this page with `fallback` instead.
 *
 * Child screens must use it too when they return: pushing the parent's URL
 * again would leave the child behind it, and the parent's back would then walk
 * straight back into the child.
 */
export function useGoBack(fallback: string) {
	const navigate = useNavigate();
	return useCallback(() => {
		// React Router keeps the position in its history stack on history.state.
		const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
		if (index > 0) navigate(-1);
		else navigate(fallback, { replace: true });
	}, [navigate, fallback]);
}
