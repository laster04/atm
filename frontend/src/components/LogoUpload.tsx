import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@components/base/button';
import TeamCrest from '@/components/public/TeamCrest';
import { fileApi } from '@/services/api';

// Mirrors the server (services/storage/limits.ts); the server is the one that decides.
const MAX_BYTES = 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

interface LogoUploadProps {
	/** The saved or just-uploaded logo URL; empty for none. */
	value: string | null | undefined;
	onChange: (url: string | null) => void;
	/** Shown as initials in the preview while there is no logo. */
	name: string;
	color?: string | null;
	/** Reports an upload in progress, so a form can hold its submit. */
	onBusyChange?: (busy: boolean) => void;
}

/**
 * Picks or drops a logo, uploads it straight away and hands back its URL. The
 * form saves that URL like any other field; the server converts the image to
 * WebP and removes the old file once the save goes through.
 */
export default function LogoUpload({ value, onChange, name, color, onBusyChange }: LogoUploadProps) {
	const { t } = useTranslation();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);

	const setUploading = (state: boolean) => {
		setBusy(state);
		onBusyChange?.(state);
	};

	const upload = async (file: File) => {
		setError(null);
		if (!ACCEPTED.includes(file.type)) {
			setError(t('files.errors.FILE_TYPE_NOT_ALLOWED'));
			return;
		}
		if (file.size > MAX_BYTES) {
			setError(t('files.errors.FILE_TOO_LARGE'));
			return;
		}
		setUploading(true);
		try {
			const res = await fileApi.uploadLogo(file);
			onChange(res.data.url);
		} catch (err) {
			const code = isAxiosError(err) ? err.response?.data?.code : undefined;
			setError(t(code === 'FILE_TOO_LARGE' || code === 'FILE_TYPE_NOT_ALLOWED' ? `files.errors.${code}` : 'files.errors.failed'));
		} finally {
			setUploading(false);
			if (input.current) input.current.value = '';
		}
	};

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setDragging(false);
		const file = event.dataTransfer.files[0];
		if (file) void upload(file);
	};

	return (
		<div className="space-y-2">
			<div
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				className={`flex items-center gap-4 rounded-lg border border-dashed p-3 ${dragging ? 'border-primary bg-muted' : 'border-border'}`}
			>
				<TeamCrest team={{ name: name || '?', logo: value || null, primaryColor: color ?? null }} size={56} />
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
							{busy ? <Loader2 className="animate-spin" /> : <ImageUp />}
							{busy ? t('files.uploading') : value ? t('files.replace') : t('files.upload')}
						</Button>
						{value && !busy && (
							<Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
								<Trash2 />
								{t('files.remove')}
							</Button>
						)}
					</div>
					<p className="text-xs text-muted-foreground">{t('files.logoHint')}</p>
				</div>
				<input
					ref={input}
					type="file"
					accept={ACCEPTED.join(',')}
					className="hidden"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) void upload(file);
					}}
				/>
			</div>
			{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
