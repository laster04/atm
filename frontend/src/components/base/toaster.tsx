import { Toaster as Sonner } from 'sonner';

export function Toaster() {
	return (
		<Sonner
			position="top-right"
			expand={true}
			richColors
			closeButton
			toastOptions={{
				style: {
					borderRadius: '8px',
				},
				classNames: {
					toast: 'group toast',
					title: 'text-sm font-medium',
					description: 'text-sm opacity-90',
					actionButton: 'bg-primary text-primary-foreground',
					cancelButton: 'bg-muted text-muted-foreground',
					closeButton: 'bg-background border-border',
				},
			}}
		/>
	);
}
