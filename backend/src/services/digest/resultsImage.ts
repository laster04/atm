import { readFileSync } from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { RoundSummary } from './roundSummary.js';

/**
 * The results as a picture, for a league manager to drop into a team chat.
 *
 * Drawn on the server so it looks the same whatever phone shares it: satori lays
 * out the card as SVG with the app's own font, resvg turns it into a PNG. The
 * card is 1080 wide - a phone screen at full resolution - and as tall as its
 * content, so a long weekend is not squeezed and a short one is not padded.
 */

const WIDTH = 1080;
const NAVY = '#0F172A';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';
const SOFT = '#F1F5F9';
const FALLBACK_DOT = '#CBD5E1';

const MAX_RESULTS = 10;
const MAX_TABLE_ROWS = 8;
const MAX_SCORERS = 3;

// Layout heights, used to size the canvas to its content.
const HEADER_H = 250;
const SECTION_GAP = 44;
const LABEL_H = 44;
const RESULT_ROW_H = 84;
const TABLE_ROW_H = 58;
const SCORER_ROW_H = 58;
const MORE_H = 48;
const FOOTER_H = 110;
const PADDING = 56;

const FONT_DIR = path.resolve(process.cwd(), 'assets/fonts');

type Weight = 400 | 600 | 700 | 800;
let fonts: { name: string; data: Buffer; weight: Weight; style: 'normal' }[] | null = null;

/** Read once and kept: every render needs the same four files. */
const loadFonts = () => {
  if (!fonts) {
    fonts = ([400, 600, 700, 800] as Weight[]).map((weight) => ({
      name: 'Inter',
      data: readFileSync(path.join(FONT_DIR, `Inter-${weight}.ttf`)),
      weight,
      style: 'normal' as const,
    }));
  }
  return fonts;
};

type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[] };
}
type Child = Node | string | null | false;

/** A satori element without JSX, so the backend needs no React tooling. */
const h = (style: Style, ...children: Child[]): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: children.filter((c) => c !== null && c !== false) },
});

const TEXTS = {
  cs: {
    results: 'Výsledky',
    table: 'Tabulka',
    topScorers: 'Nejlepší střelci',
    notConfirmed: 'nepotvrzeno',
    round: (n: number) => `${n}. kolo`,
    more: (n: number) => `a ${n} dalších`,
    played: 'Z',
    points: 'B',
  },
  en: {
    results: 'Results',
    table: 'Table',
    topScorers: 'Top scorers',
    notConfirmed: 'not confirmed',
    round: (n: number) => `Round ${n}`,
    more: (n: number) => `and ${n} more`,
    played: 'P',
    points: 'Pts',
  },
};

/** "19. 9." or "19. 9. – 21. 9.", in the app's zone, from the games' dates. */
const dateRange = (dates: Date[], locale: 'cs' | 'en'): string | null => {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const format = (date: Date) =>
    new Intl.DateTimeFormat(locale === 'cs' ? 'cs-CZ' : 'en-GB', {
      day: 'numeric',
      month: locale === 'cs' ? 'numeric' : 'short',
      timeZone: 'Europe/Prague',
    }).format(date);
  const first = format(sorted[0]);
  const last = format(sorted[sorted.length - 1]);
  return first === last ? first : `${first} – ${last}`;
};

// Outlined, so a white team colour still shows on the white card.
const dot = (color: string | null, size = 18): Node =>
  h({
    width: size,
    height: size,
    borderRadius: size,
    backgroundColor: color || FALLBACK_DOT,
    border: '2px solid rgba(15,23,42,0.12)',
    flexShrink: 0,
  });

const sectionLabel = (text: string): Node =>
  h(
    { height: LABEL_H, alignItems: 'center', fontSize: 24, fontWeight: 700, letterSpacing: 2, color: MUTED },
    text.toUpperCase()
  );

const card = (...rows: Child[]): Node =>
  h(
    { flexDirection: 'column', border: `2px solid ${BORDER}`, borderRadius: 24, overflow: 'hidden' },
    ...rows
  );

export const renderResultsImage = async (
  summary: RoundSummary,
  locale: 'cs' | 'en' = 'cs'
): Promise<Buffer> => {
  const t = TEXTS[locale];

  const results = summary.results.slice(0, MAX_RESULTS);
  const hiddenResults = summary.results.length - results.length;
  const table = summary.standings.slice(0, MAX_TABLE_ROWS);
  const scorers = summary.topScorers.slice(0, MAX_SCORERS);

  const subtitle = [
    summary.round !== null ? t.round(summary.round) : t.results,
    dateRange(
      summary.results.flatMap((r) => (r.playedOn ? [new Date(r.playedOn)] : [])),
      locale
    ),
  ]
    .filter(Boolean)
    .join('  ·  ');

  const header = h(
    {
      height: HEADER_H,
      flexDirection: 'column',
      justifyContent: 'center',
      padding: `0 ${PADDING}px`,
      backgroundColor: NAVY,
      color: '#FFFFFF',
    },
    h({ fontSize: 26, fontWeight: 600, letterSpacing: 2, color: 'rgba(255,255,255,0.7)' }, summary.leagueName.toUpperCase()),
    h({ fontSize: 60, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }, summary.seasonName),
    h({ fontSize: 30, fontWeight: 600, marginTop: 14, color: 'rgba(255,255,255,0.85)' }, subtitle)
  );

  const resultRow = (r: RoundSummary['results'][number], index: number): Node =>
    h(
      {
        height: RESULT_ROW_H,
        alignItems: 'center',
        padding: '0 28px',
        borderTop: index === 0 ? 'none' : `2px solid ${BORDER}`,
      },
      h(
        { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 14, minWidth: 0 },
        h({ fontSize: 32, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, r.homeTeam),
        dot(r.homeColor)
      ),
      h(
        { width: 190, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
        h(
          { fontSize: 44, fontWeight: 800, color: TEXT, lineHeight: 1 },
          r.homeScore !== null && r.awayScore !== null ? `${r.homeScore} : ${r.awayScore}` : '–'
        ),
        !r.confirmed && h({ fontSize: 18, fontWeight: 600, color: MUTED, marginTop: 4 }, t.notConfirmed)
      ),
      h(
        { flex: 1, alignItems: 'center', gap: 14, minWidth: 0 },
        dot(r.awayColor),
        h({ fontSize: 32, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, r.awayTeam)
      )
    );

  const tableHead = h(
    { height: TABLE_ROW_H, alignItems: 'center', padding: '0 28px', backgroundColor: SOFT, fontSize: 22, fontWeight: 700, color: MUTED },
    h({ width: 52 }, '#'),
    h({ flex: 1 }, ''),
    h({ width: 80, justifyContent: 'center' }, t.played),
    h({ width: 90, justifyContent: 'flex-end' }, t.points)
  );

  const tableRow = (row: RoundSummary['standings'][number]): Node =>
    h(
      { height: TABLE_ROW_H, alignItems: 'center', padding: '0 28px', borderTop: `2px solid ${BORDER}`, fontSize: 28 },
      h({ width: 52, color: MUTED, fontWeight: 600 }, String(row.rank)),
      h(
        { flex: 1, alignItems: 'center', gap: 14, minWidth: 0 },
        dot(row.color, 14),
        h({ fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, row.team)
      ),
      h({ width: 80, justifyContent: 'center', color: MUTED }, String(row.played)),
      h({ width: 90, justifyContent: 'flex-end', fontWeight: 800, color: TEXT }, String(row.points))
    );

  const scorerRow = (scorer: RoundSummary['topScorers'][number], index: number): Node =>
    h(
      {
        height: SCORER_ROW_H,
        alignItems: 'center',
        padding: '0 28px',
        borderTop: index === 0 ? 'none' : `2px solid ${BORDER}`,
        fontSize: 28,
      },
      h({ flex: 1, fontWeight: 600, color: TEXT, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, scorer.name),
      h({ color: MUTED, marginLeft: 16, overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 360 }, scorer.team),
      h({ width: 120, justifyContent: 'flex-end', color: MUTED }, `${scorer.goals}+${scorer.assists}`),
      h({ width: 90, justifyContent: 'flex-end', fontWeight: 800, color: TEXT }, String(scorer.points))
    );

  const footer = h(
    {
      height: FOOTER_H,
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${PADDING}px`,
      borderTop: `2px solid ${BORDER}`,
      fontSize: 24,
      color: MUTED,
    },
    h({ fontWeight: 800, color: NAVY, fontSize: 30, letterSpacing: 1 }, 'ATM'),
    h({}, 'atm-online.cz')
  );

  const body = h(
    { flexDirection: 'column', padding: `${SECTION_GAP}px ${PADDING}px 0` },
    sectionLabel(t.results),
    card(...results.map(resultRow)),
    hiddenResults > 0 &&
      h({ height: MORE_H, alignItems: 'center', justifyContent: 'center', fontSize: 24, color: MUTED }, t.more(hiddenResults)),
    h({ height: SECTION_GAP }),
    sectionLabel(t.table),
    card(tableHead, ...table.map(tableRow)),
    scorers.length > 0 && h({ height: SECTION_GAP }),
    scorers.length > 0 && sectionLabel(t.topScorers),
    scorers.length > 0 && card(...scorers.map(scorerRow)),
    h({ height: SECTION_GAP })
  );

  // Every block has a fixed height, so the canvas can be sized exactly.
  const height =
    HEADER_H +
    SECTION_GAP +
    LABEL_H + results.length * RESULT_ROW_H + 4 +
    (hiddenResults > 0 ? MORE_H : 0) +
    SECTION_GAP +
    LABEL_H + (table.length + 1) * TABLE_ROW_H + 4 +
    (scorers.length > 0 ? SECTION_GAP + LABEL_H + scorers.length * SCORER_ROW_H + 4 : 0) +
    SECTION_GAP +
    FOOTER_H;

  const root = h(
    { width: WIDTH, height, flexDirection: 'column', backgroundColor: '#FFFFFF', fontFamily: 'Inter' },
    header,
    body,
    h({ flex: 1 }),
    footer
  );

  // satori's element type is React's; this plain tree is what it walks anyway.
  const svg = await satori(root as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height,
    fonts: loadFonts(),
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
};
