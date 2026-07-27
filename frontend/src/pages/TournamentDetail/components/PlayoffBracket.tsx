import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { TournamentGame } from '@types';

const PHASE_ORDER = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'BRONZE', 'FINAL'];

interface PlayoffBracketProps {
  games: TournamentGame[];
}

// Before the group stage finishes, a slot may only carry a seed number
// (e.g. "1st place") rather than a resolved team.
function sideLabel(team: { name: string } | null | undefined, seed: number | null | undefined, t: TFunction): string {
  if (team) return team.name;
  if (seed != null) return t('tm.common.seed', { n: seed });
  return t('tm.common.tbd');
}

function GameCard({ game, t }: { game: TournamentGame; t: TFunction }) {
  const isCompleted = game.status === 'COMPLETED';
  const homeWon = isCompleted && game.homeScore != null && game.awayScore != null && game.homeScore > game.awayScore;
  const awayWon = isCompleted && game.homeScore != null && game.awayScore != null && game.awayScore > game.homeScore;

  return (
    <div className="border rounded-lg overflow-hidden text-sm w-48 bg-white shadow-sm">
      <div className={`flex items-center justify-between px-2 py-1.5 border-b ${homeWon ? 'bg-green-50' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {game.homeTeam?.primaryColor && (
            <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: game.homeTeam.primaryColor }} />
          )}
          <span className={`truncate ${homeWon ? 'font-bold' : ''}`}>
            {sideLabel(game.homeTeam, game.homeSeed, t)}
          </span>
        </div>
        {isCompleted && <span className={`ml-2 font-bold flex-shrink-0 ${homeWon ? 'text-green-700' : ''}`}>{game.homeScore}</span>}
      </div>
      <div className={`flex items-center justify-between px-2 py-1.5 ${awayWon ? 'bg-green-50' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {game.awayTeam?.primaryColor && (
            <div className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: game.awayTeam.primaryColor }} />
          )}
          <span className={`truncate ${awayWon ? 'font-bold' : ''}`}>
            {sideLabel(game.awayTeam, game.awaySeed, t)}
          </span>
        </div>
        {isCompleted && <span className={`ml-2 font-bold flex-shrink-0 ${awayWon ? 'text-green-700' : ''}`}>{game.awayScore}</span>}
      </div>
      {game.date && (
        <div className="px-2 py-1 text-xs text-muted-foreground border-t bg-muted/30">
          {new Date(game.date).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

export default function PlayoffBracket({ games }: PlayoffBracketProps) {
  const { t } = useTranslation();
  const playoffGames = games.filter(g => g.phase !== 'GROUP');
  if (playoffGames.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('tournamentDetail.playoff.empty')}</p>;
  }

  const byPhase = PHASE_ORDER.reduce<Record<string, TournamentGame[]>>((acc, phase) => {
    const phaseGames = playoffGames.filter(g => g.phase === phase);
    if (phaseGames.length > 0) acc[phase] = phaseGames;
    return acc;
  }, {});

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 min-w-max pb-4">
        {Object.entries(byPhase).map(([phase, phaseGames]) => (
          <div key={phase} className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-center text-muted-foreground">
              {t(`tournamentDetail.playoff.phases.${phase}`, phase)}
            </h4>
            <div className="flex flex-col gap-4 justify-around flex-1">
              {phaseGames
                .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0))
                .map(game => <GameCard key={game.id} game={game} t={t} />)
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
