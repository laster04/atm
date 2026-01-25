import { Card, CardContent } from "@/components/base/card";
import { useTranslation } from "react-i18next";
import { Calendar, Clock } from 'lucide-react';
import { formatDateShort, formatGameTime, isToday, isBeforeToday, isAfterToday } from '@/utils/date';

import type { Game } from "@types";

export enum FilterTimeEnum {
	TODAY = 'today',
	UPCOMING = 'upcoming',
	RECENT = 'recent'
}

interface GameScheduleProps {
	filter?: FilterTimeEnum;
	games: Game[];
}

export function GameSchedule({ filter = FilterTimeEnum.RECENT, games }: GameScheduleProps) {
	const { t, i18n } = useTranslation();
	let filteredGames: Game[] = [];

	if (filter === FilterTimeEnum.TODAY) {
		filteredGames = games.filter((game) => isToday(game.date));
	} else if (filter === FilterTimeEnum.UPCOMING) {
		filteredGames = games.filter((game) => isAfterToday(game.date));
	} else if (filter === FilterTimeEnum.RECENT) {
		filteredGames = games.filter((game) => isBeforeToday(game.date)).reverse();
	}

	return (
		<div className="space-y-4">
			{filteredGames.length === 0 ? (
				<Card>
					<CardContent className="pt-6">
						<p className="text-center text-muted-foreground">No games {filter}</p>
					</CardContent>
				</Card>
			) : (
				filteredGames.map((game) => (
					<Card key={game.id}>
						<CardContent className="pt-6">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4 flex-1">
									<div className="flex items-center gap-1 text-sm text-muted-foreground">
										<Calendar className="size-4"/>
										<span>{game.date && formatDateShort(game.date, i18n.language)}</span>
										<Clock className="size-4 ml-2"/>
										<span>{game.date && formatGameTime(game.date, i18n.language)}</span>
									</div>
								</div>
							</div>

							<div className="text-sm sm:text-xl mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 ">
								<div className="text-right">
									<div className="flex items-center justify-end gap-2 mb-1">
										<div
											className="size-4 rounded-full border-2 border-white shadow-sm"
											style={{ backgroundColor: game.awayTeam?.primaryColor || '#808080' }}
										/>
										<span className="font-medium"> {game.awayTeam?.name}</span>
									</div>
								</div>

								<div className="flex items-center gap-3 px-4">
									{game.status === 'SCHEDULED' ? (
										<span className="text-2xl font-medium text-muted-foreground"> vs </span>
									) : (
										<>
											<span className="text-sm sm:text-3xl font-medium">{game.awayScore}</span>
											<span className="text-sm sm:text-xl text-muted-foreground">-</span>
											<span className="text-sm sm:text-3xl font-medium">{game.homeScore}</span>
										</>
									)}
								</div>

								<div className="text-left">
									<div className="flex items-center gap-2 mb-1">
										<div
											className="size-4 rounded-full border-2 border-white shadow-sm"
											style={{ backgroundColor: game.homeTeam?.primaryColor ?? '#808080' }}
										/>
										<span className="font-medium"> {game.homeTeam?.name}</span>
									</div>
								</div>
							</div>

							<div className="mt-4 flex items-center justify-center  gap-4">
								<span className="text-sm text-gray-500">{game.round && ` ${t('seasonDetail.schedule.round', { round: game.round })}`}</span>
							</div>
						</CardContent>
					</Card>
				))
			)}
		</div>
	);
}
