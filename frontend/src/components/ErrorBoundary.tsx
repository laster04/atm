import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@components/base/button';

interface BoundaryProps {
	children: ReactNode;
	fallback: (reset: () => void) => ReactNode;
	resetKey: string;
}

interface BoundaryState {
	error: Error | null;
	resetKey: string;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
	state: BoundaryState = { error: null, resetKey: this.props.resetKey };

	static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
		return { error };
	}

	// Navigating elsewhere clears the error, so the rest of the app stays usable.
	static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
		return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('Page crashed:', error, info.componentStack);
	}

	reset = () => this.setState({ error: null });

	render() {
		return this.state.error ? this.props.fallback(this.reset) : this.props.children;
	}
}

function Fallback({ onRetry }: { onRetry: () => void }) {
	const { t } = useTranslation();

	return (
		<div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center">
			<AlertTriangle className="size-10 text-destructive" aria-hidden />
			<h2 className="text-lg font-semibold">{t('errorBoundary.title')}</h2>
			<p className="text-sm text-muted-foreground">{t('errorBoundary.description')}</p>
			<div className="mt-2 flex flex-wrap justify-center gap-2">
				<Button onClick={onRetry}>{t('errorBoundary.retry')}</Button>
				<Button variant="outline" asChild>
					<Link to="/dashboard">{t('errorBoundary.backToDashboard')}</Link>
				</Button>
			</div>
		</div>
	);
}

/**
 * Catches a crash inside one page so the surrounding shell (header, navigation)
 * stays on screen instead of the whole app going blank.
 */
export default function ErrorBoundary({ children }: { children: ReactNode }) {
	const { pathname } = useLocation();

	return (
		<Boundary resetKey={pathname} fallback={(reset) => <Fallback onRetry={reset} />}>
			{children}
		</Boundary>
	);
}
