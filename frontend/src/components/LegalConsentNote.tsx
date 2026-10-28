import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';

/**
 * The line under sign-up (form or Google) that ties a new account to the
 * terms of service and points to the privacy policy. Opens them in a new tab
 * so a half-filled form survives.
 */
export default function LegalConsentNote({ className = '' }: { className?: string }) {
	const link = 'font-semibold text-blue-600 hover:underline';
	return (
		<p className={`text-xs leading-relaxed text-gray-600 ${className}`}>
			<Trans
				i18nKey="legal.signupNote"
				components={{
					terms: <Link to="/terms" target="_blank" className={link} />,
					privacy: <Link to="/privacy" target="_blank" className={link} />,
				}}
			/>
		</p>
	);
}
