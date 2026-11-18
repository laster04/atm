import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Renders article inline markup: `**bold**`, `` `code` `` and `{ui:i18n.key}`, the latter as
 * the control's current label so an article always names the button the way
 * the app does.
 */
export default function RichText({ text }: { text: string }) {
	const { t } = useTranslation();
	const parts = text.split(/(\{ui:[\w.-]+\}|\*\*.+?\*\*|`[^`]+`)/g);

	return (
		<>
			{parts.map((part, index) => {
				const ui = /^\{ui:([\w.-]+)\}$/.exec(part);
				if (ui) {
					return (
						<strong key={index} className="font-semibold text-foreground">
							{t(ui[1])}
						</strong>
					);
				}
				const bold = /^\*\*(.+)\*\*$/.exec(part);
				if (bold) {
					return (
						<strong key={index} className="font-semibold text-foreground">
							{bold[1]}
						</strong>
					);
				}
				const code = /^`([^`]+)`$/.exec(part);
				if (code) {
					return (
						<code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
							{code[1]}
						</code>
					);
				}
				return <Fragment key={index}>{part}</Fragment>;
			})}
		</>
	);
}
