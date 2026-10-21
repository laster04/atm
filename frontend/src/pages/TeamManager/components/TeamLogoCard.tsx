import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'lucide-react';
import { toast } from 'sonner';
import { teamApi } from '@/services/api';
import { Card, CardTitle, CardHeader, CardDescription, CardContent } from '@/components/base/card';
import LogoUpload from '@/components/LogoUpload';

interface TeamLogoCardProps {
	teamId: string;
	teamName: string;
	color: string | null | undefined;
	initialLogo: string | null | undefined;
	onLogoChange?: (logo: string | null) => void;
}

/** The team's crest: saved as soon as it is uploaded or removed, like the colour. */
export default function TeamLogoCard({ teamId, teamName, color, initialLogo, onLogoChange }: TeamLogoCardProps) {
	const { t } = useTranslation();
	const [logo, setLogo] = useState(initialLogo ?? null);

	useEffect(() => setLogo(initialLogo ?? null), [initialLogo]);

	const save = async (next: string | null) => {
		const previous = logo;
		setLogo(next);
		try {
			const res = await teamApi.update(teamId, { logo: next });
			setLogo(res.data.logo ?? null);
			onLogoChange?.(res.data.logo ?? null);
			toast.success(t(res.data.logo ? 'teamManagement.logo.saved' : 'teamManagement.logo.removed'));
		} catch {
			setLogo(previous);
			toast.error(t('teamManagement.logo.saveError'));
		}
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Image className="size-5 text-primary" aria-hidden />
					<div>
						<CardTitle>{t('teamManagement.logo.title')}</CardTitle>
						<CardDescription>{t('teamManagement.logo.description')}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<LogoUpload
					value={logo}
					onChange={(url) => void save(url)}
					name={teamName}
					color={color}
				/>
			</CardContent>
		</Card>
	);
}
