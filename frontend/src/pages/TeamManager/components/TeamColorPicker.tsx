import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { toast } from 'sonner';
import { teamApi } from '@/services/api';
import { Card, CardTitle, CardHeader, CardDescription, CardContent } from "@/components/base/card";
import { Label } from "@/components/base/label";
import { Input } from "@/components/base/input";

interface TeamColorPickerProps {
	teamId: number;
	teamName: string;
	initialColor: string | null | undefined;
	points?: number;
	onColorChange?: (color: string) => void;
}

export default function TeamColorPicker({
	teamId,
	teamName,
	initialColor,
	points,
	onColorChange
}: TeamColorPickerProps) {
	const { t } = useTranslation();
	const [localColor, setLocalColor] = useState<string | null | undefined>(initialColor);
	const colorSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setLocalColor(initialColor);
	}, [initialColor]);

	useEffect(() => {
		return () => {
			if (colorSaveTimeoutRef.current) {
				clearTimeout(colorSaveTimeoutRef.current);
			}
		};
	}, []);

	const handleColorChange = (color: string) => {
		setLocalColor(color);
		onColorChange?.(color);

		if (colorSaveTimeoutRef.current) {
			clearTimeout(colorSaveTimeoutRef.current);
		}

		colorSaveTimeoutRef.current = setTimeout(async () => {
			await teamApi.update(teamId, { primaryColor: color });
			toast.success(t('teamManagement.toast.colorUpdated', { name: teamName }));
		}, 500);
	};

	const colorPresets = [
		{ key: 'blue', color: '#003E7E' },
		{ key: 'red', color: '#C8102E' },
		{ key: 'gold', color: '#FFB81C' },
		{ key: 'green', color: '#006847' },
		{ key: 'purple', color: '#552583' },
		{ key: 'orange', color: '#F74902' },
		{ key: 'navy', color: '#041E42' },
		{ key: 'teal', color: '#007A7A' },
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<Palette className="size-5 text-primary"/>
					<div>
						<CardTitle>{t('teamManagement.branding.title')}</CardTitle>
						<CardDescription>{t('teamManagement.branding.description', { name: teamName })}</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-3">
					<Label htmlFor="team-color">{t('teamManagement.branding.primaryColor')}</Label>
					<div className="flex items-center gap-3">
						<Input
							id="team-color"
							type="color"
							value={localColor ?? '#000000'}
							onChange={(e) => handleColorChange(e.target.value)}
							className="w-24 h-12 cursor-pointer"
						/>
						<div className="flex-1">
							<Input
								type="text"
								value={localColor ?? ''}
								onChange={(e) => handleColorChange(e.target.value)}
								className="font-mono"
								placeholder="#000000"
							/>
						</div>
					</div>

					{/* Color Presets */}
					<div>
						<Label className="text-xs mb-2 block">{t('teamManagement.branding.quickPresets')}</Label>
						<div className="grid grid-cols-4 gap-2">
							{colorPresets.map((preset) => (
								<button
									key={preset.key}
									onClick={() => handleColorChange(preset.color)}
									className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:bg-accent active:scale-95 transition-all"
								>
									<div
										className="size-10 rounded-full border-2 border-white shadow-md"
										style={{ backgroundColor: preset.color }}
									/>
									<span className="text-xs"> {t(`teamManagement.branding.colors.${preset.key}`)} </span>
								</button>
							))}
						</div>
					</div>
				</div>
				<div className="rounded-lg">
					<div className="text-xs font-medium mb-2">
						{t('teamManagement.branding.livePreview')}
					</div>
					<div className="border rounded-lg p-4 space-y-3">
						<div className="text-xs text-muted-foreground mb-2">
							{t('teamManagement.branding.standingsRow')}
						</div>
						<div
							className="flex items-center gap-3 p-2 rounded"
							style={{ backgroundColor: `${localColor ?? ''}15` }}
						>
							<div
								className="size-3 rounded-full"
								style={{ backgroundColor: localColor ?? undefined }}
							/>
							<span className="text-sm font-medium">{teamName}</span>
							<span className="text-sm ml-auto">{points} pts</span>
						</div>

						<div className="text-xs text-muted-foreground mb-2 mt-4">
							{t('teamManagement.branding.gameCard')}
						</div>
						<div className="border rounded p-2 space-y-1">
							<div className="flex items-center gap-2">
								<div
									className="size-2 rounded-full"
									style={{ backgroundColor: localColor ?? undefined }}
								/>
								<span className="text-sm font-medium">{teamName}</span>
							</div>
							<div className="text-xs text-muted-foreground">
								{t('teamManagement.branding.vsOpponent')}
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
