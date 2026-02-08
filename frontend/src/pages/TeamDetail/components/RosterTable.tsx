import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardTitle, CardHeader } from "@/components/base/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/base/table";
import type { Player, TopScorer } from '@types';

interface RosterTableProps {
	topScorers: TopScorer[];
	players: Player[];
}

export default function RosterTable({
										topScorers,
										players,
									}: RosterTableProps) {
	const { t } = useTranslation();
	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>{t('teamDetail.roster', { count: players.length })}</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('seasonDetail.playersStats.player')}</TableHead>
								<TableHead
									className="text-center">{t('seasonDetail.playersStats.gamesPlayed')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.playersStats.goals')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.playersStats.assists')}</TableHead>
								<TableHead className="text-center">{t('seasonDetail.playersStats.points')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{topScorers.map((topScorer) => (
								<TableRow key={topScorer.player.id}
								>
									<TableCell>
										<Link to={`/players/${topScorer.player.id}`}
											  className="flex items-center gap-2 ">
											{topScorer.player.number && (
												<span className="text-md">#{topScorer.player.number}</span>
											)}
											<span className="font-medium">{topScorer.player.name}</span>
										</Link>
									</TableCell>
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
		</>

	);
}
