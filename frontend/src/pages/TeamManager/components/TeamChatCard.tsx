import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { teamApi } from '@/services/api';
import { Card, CardTitle, CardHeader, CardDescription, CardContent } from '@/components/base/card';
import { Label } from '@/components/base/label';
import { Input } from '@/components/base/input';

interface TeamChatCardProps {
	teamId: string;
	initialUrl: string | null | undefined;
}

/**
 * The team keeps talking where it already talks: the manager pastes the group's
 * invite link and every player gets a button to it on their dashboard.
 */
export default function TeamChatCard({ teamId, initialUrl }: TeamChatCardProps) {
	const { t } = useTranslation();
	const [saved, setSaved] = useState(initialUrl ?? '');
	const [value, setValue] = useState(initialUrl ?? '');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		setSaved(initialUrl ?? '');
		setValue(initialUrl ?? '');
	}, [initialUrl]);

	const save = async (next: string) => {
		setError('');
		if (next.trim() !== '' && !next.trim().startsWith('https://')) {
			setError(t('teamManagement.chat.invalid'));
			return;
		}
		setSaving(true);
		try {
			const res = await teamApi.update(teamId, { chatUrl: next.trim() || null });
			setSaved(res.data.chatUrl ?? '');
			setValue(res.data.chatUrl ?? '');
			toast.success(t(res.data.chatUrl ? 'teamManagement.chat.saved' : 'teamManagement.chat.removed'));
		} catch (err) {
			const axiosError = err as AxiosError<{ error: string }>;
			setError(axiosError.response?.status === 400 ? t('teamManagement.chat.invalid') : t('teamManagement.chat.saveError'));
		} finally {
			setSaving(false);
		}
	};

	const dirty = value.trim() !== saved;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<MessageCircle className="size-5 text-primary" aria-hidden />
					<div>
						<CardTitle>{t('teamManagement.chat.title')}</CardTitle>
						<CardDescription>{t('teamManagement.chat.description')}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						void save(value);
					}}
				>
					<Label htmlFor="team-chat-url">{t('teamManagement.chat.label')}</Label>
					<Input
						id="team-chat-url"
						type="url"
						inputMode="url"
						value={value}
						onChange={(e) => setValue(e.target.value)}
						placeholder="https://chat.whatsapp.com/..."
						maxLength={500}
					/>
					<p className="text-xs text-muted-foreground">{t('teamManagement.chat.privacy')}</p>
					{error && <p className="text-sm text-red-600">{error}</p>}
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={!dirty || saving}
							className="h-11 flex-1 rounded-[10px] bg-primary text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
						>
							{t('teamManagement.chat.save')}
						</button>
						{saved && (
							<button
								type="button"
								disabled={saving}
								onClick={() => void save('')}
								className="h-11 rounded-[10px] border border-border px-4 text-[14.5px] font-semibold disabled:opacity-50"
							>
								{t('teamManagement.chat.remove')}
							</button>
						)}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
