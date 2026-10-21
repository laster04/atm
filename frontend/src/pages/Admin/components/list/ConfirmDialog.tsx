import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/base/dialog';
import { cn } from '@/components/utils';

interface ConfirmDialogProps {
	title: string;
	description: string;
	confirmLabel: string;
	/** Ask for a reason that goes into the audit log; `required` blocks an empty one. */
	reason?: 'optional' | 'required';
	tone?: 'danger' | 'default';
	onConfirm: (reason: string) => Promise<void>;
	onClose: () => void;
}

/** Every bulk or irreversible admin action goes through this, never `window.confirm`. */
export default function ConfirmDialog({
	title, description, confirmLabel, reason, tone = 'default', onConfirm, onClose,
}: ConfirmDialogProps) {
	const { t } = useTranslation();
	const [text, setText] = useState('');
	const [busy, setBusy] = useState(false);
	const blocked = reason === 'required' && text.trim() === '';

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (blocked) return;
		setBusy(true);
		try {
			await onConfirm(text.trim());
			onClose();
		} catch {
			// The caller has told the user what went wrong; the dialog stays open to retry.
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form onSubmit={submit} className="flex flex-col gap-4">
					{reason && (
						<label className="flex flex-col gap-1.5 text-sm font-semibold">
							{reason === 'required' ? t('adminShell.confirm.reasonRequired') : t('adminShell.confirm.reasonOptional')}
							<textarea
								value={text}
								onChange={(event) => setText(event.target.value)}
								maxLength={500}
								rows={3}
								autoFocus
								className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal"
							/>
							<span className="text-xs font-normal text-muted-foreground">{t('adminShell.confirm.reasonHint')}</span>
						</label>
					)}
					<div className="flex flex-wrap justify-end gap-2">
						<button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-lg border border-border px-4 text-sm font-bold">
							{t('common.cancel')}
						</button>
						<button
							type="submit"
							disabled={busy || blocked}
							className={cn(
								'flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50',
								tone === 'danger' ? 'bg-[#DC2626]' : 'bg-[#0F172A]'
							)}
						>
							{busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
							{confirmLabel}
						</button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
