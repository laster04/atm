import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronRight, LifeBuoy, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { RELEASES, hasUnreadUpdates, updatesLocale } from '@/content/updates';
import { Panel } from '@/components/public';

/** The newest release note, which used to hide behind a dot in the header menu. */
export function WhatsNewCard() {
	const { t, i18n } = useTranslation();
	const { user } = useAuth();
	const latest = [...RELEASES].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))[0];
	if (!latest) return null;
	const content = latest.content[updatesLocale(i18n.language)];
	const unread = hasUnreadUpdates(user?.updatesSeenAt);

	return (
		<Panel
			title={
				<span className="flex items-center gap-2">
					<Sparkles className="size-4 text-brand-text" aria-hidden />
					{t('dashboard.whatsNew.title')}
					{unread && (
						<span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink">
							{t('dashboard.whatsNew.new')}
						</span>
					)}
				</span>
			}
		>
			<div className="flex flex-col gap-2">
				<h3 className="text-[15px] font-semibold leading-snug">{content.title}</h3>
				<p className="text-[13.5px] leading-relaxed text-muted-foreground">{content.summary}</p>
				<div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
					<Link to="/updates" className="text-[13px] font-semibold text-primary hover:underline">{t('dashboard.whatsNew.all')}</Link>
					{latest.docs[0] && (
						<Link to={`/docs/${latest.docs[0]}`} className="text-[13px] font-semibold text-primary hover:underline">
							{t('public.updates.readGuide')}
						</Link>
					)}
				</div>
			</div>
		</Panel>
	);
}

const HELP_LINKS = [
	{ to: '/docs/rychly-start', key: 'quickStart', icon: BookOpen },
	{ to: '/docs/prihlasky-tymu', key: 'registrations', icon: BookOpen },
	{ to: '/docs', key: 'all', icon: LifeBuoy },
	{ to: '/contact', key: 'contact', icon: Mail },
];

/** Help, which used to be a header menu item. */
export function HelpCard() {
	const { t } = useTranslation();
	return (
		<Panel title={t('dashboard.help.title')} flush>
			<ul className="divide-y divide-border">
				{HELP_LINKS.map(({ to, key, icon: Icon }) => (
					<li key={key}>
						<Link to={to} className="flex min-h-11 items-center gap-3 px-5 py-2.5 text-[14px] font-medium hover:bg-muted/60">
							<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							<span className="flex-1">{t(`dashboard.help.${key}`)}</span>
							<ChevronRight className="size-4 text-muted-foreground" aria-hidden />
						</Link>
					</li>
				))}
			</ul>
		</Panel>
	);
}
