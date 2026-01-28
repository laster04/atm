import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardTitle, CardHeader } from "@/components/base/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/base/table";
import type { TopScorer } from '@/services/api';

interface PlayersStatsTableProps {
	topScorers: TopScorer[];
}

export default function PlayersStatsTable({ topScorers }: PlayersStatsTableProps) {
	const { t } = useTranslation();

	if (topScorers.length === 0) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-center text-muted-foreground">
						{t('seasonDetail.playersStats.noStats')}
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('seasonDetail.playersStats.title')}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12">{t('seasonDetail.playersStats.rank')}</TableHead>
							<TableHead>{t('seasonDetail.playersStats.player')}</TableHead>
							<TableHead className="text-center">{t('seasonDetail.playersStats.team')}</TableHead>
							<TableHead className="text-center">{t('seasonDetail.playersStats.gamesPlayed')}</TableHead>
							<TableHead className="text-center">{t('seasonDetail.playersStats.goals')}</TableHead>
							<TableHead className="text-center">{t('seasonDetail.playersStats.assists')}</TableHead>
							<TableHead className="text-center">{t('seasonDetail.playersStats.points')}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{topScorers.map((topScorer, index) => (
							<TableRow key={topScorer.player.id}>
								<TableCell className="text-center font-medium">
									{index < 3 ? (
										<span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
											index === 0 ? 'bg-yellow-400 text-yellow-900' :
											index === 1 ? 'bg-gray-300 text-gray-700' :
											'bg-amber-600 text-amber-100'
										}`}>
											{index + 1}
										</span>
									) : (
										index + 1
									)}
								</TableCell>
								<TableCell>
									<Link to={`/players/${topScorer.player.id}`} className="flex items-center gap-2 hover:text-blue-600">
										<span className="font-medium">{topScorer.player.name}</span>
										{topScorer.player.number && (
											<span className="text-xs text-muted-foreground">#{topScorer.player.number}</span>
										)}
									</Link>
								</TableCell>
								<TableCell className="text-center">{topScorer.player.team?.name || '-'}</TableCell>
								<TableCell className="text-center">{topScorer.gamesPlayed}</TableCell>
								<TableCell className="text-center">{topScorer.goals}</TableCell>
								<TableCell className="text-center">{topScorer.assists}</TableCell>
								<TableCell className="text-center font-bold">{topScorer.points}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
