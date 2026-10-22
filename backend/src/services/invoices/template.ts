import { createRequire } from 'module';
import PDFDocument from 'pdfkit';
import { APP_TIME_ZONE } from '../../utils/time.js';

/**
 * What a tax document says and how it looks, kept apart from the logic that
 * issues it: the accountant of Conesoft s.r.o. confirms the wording before
 * launch, and a change here needs no change anywhere else. Czech and English
 * side by side, since customers from Slovakia and Austria read it too.
 */

/** The supplier, from ARES (IČO 24359114) on 22 October 2026. */
export const ISSUER = {
  name: 'Conesoft s.r.o.',
  address: ['Horní Žďár 112', '377 01 Jindřichův Hradec', 'Česká republika'],
  ico: '24359114',
  dic: 'CZ24359114',
  register: {
    cs: 'Zapsáno v obchodním rejstříku vedeném Krajským soudem v Českých Budějovicích, oddíl C, vložka 36120.',
    en: 'Registered in the Commercial Register kept by the Regional Court in České Budějovice, section C, entry 36120.',
  },
};

export type DocumentKind = 'SIMPLIFIED' | 'FULL';

/** Everything printed on a document, stored with it so it renders the same at any time. */
export interface DocumentContent {
  number: string;
  kind: DocumentKind;
  /** ISO instants; printed as Prague calendar days. */
  issuedAt: string;
  taxPointAt: string;
  issuer: typeof ISSUER;
  /** Only on a full document (celek B6). */
  customer: { name: string; address: string[]; ico?: string | null; dic?: string | null } | null;
  currency: 'CZK' | 'EUR';
  lines: {
    description: { cs: string; en: string };
    /** Minor units. */
    gross: number;
    base: number;
    vat: number;
    vatRateBp: number;
  }[];
  totals: { gross: number; base: number; vat: number };
  vatMode: 'DOMESTIC' | 'REVERSE_CHARGE' | 'OSS';
  payment: { variableSymbol: number; account: string | null };
}

const LABELS = {
  title: {
    SIMPLIFIED: { cs: 'Zjednodušený daňový doklad', en: 'Simplified tax document' },
    FULL: { cs: 'Daňový doklad – faktura', en: 'Tax document – invoice' },
  },
  number: { cs: 'Číslo dokladu', en: 'Document no.' },
  supplier: { cs: 'Dodavatel', en: 'Supplier' },
  customer: { cs: 'Odběratel', en: 'Customer' },
  ico: { cs: 'IČO', en: 'Company ID' },
  dic: { cs: 'DIČ', en: 'VAT ID' },
  issued: { cs: 'Datum vystavení', en: 'Date of issue' },
  taxPoint: { cs: 'Datum uskutečnění zdanitelného plnění', en: 'Date of taxable supply' },
  method: { cs: 'Způsob úhrady', en: 'Payment method' },
  transfer: { cs: 'Bankovní převod', en: 'Bank transfer' },
  variableSymbol: { cs: 'Variabilní symbol', en: 'Payment reference' },
  account: { cs: 'Účet', en: 'Account' },
  item: { cs: 'Položka', en: 'Item' },
  base: { cs: 'Základ', en: 'Net' },
  rate: { cs: 'Sazba', en: 'Rate' },
  vat: { cs: 'DPH', en: 'VAT' },
  total: { cs: 'Celkem', en: 'Total' },
  totalWithVat: { cs: 'Celkem s DPH', en: 'Total incl. VAT' },
  paid: { cs: 'Uhrazeno převodem. Neplaťte, doklad slouží jako potvrzení platby.', en: 'Paid by bank transfer. Do not pay; this document confirms the payment.' },
  reverseCharge: { cs: 'Daň odvede zákazník (přenesení daňové povinnosti).', en: 'Reverse charge: VAT to be accounted for by the customer.' },
};

const both = (label: { cs: string; en: string }) => `${label.cs} / ${label.en}`;

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('cs-CZ', { timeZone: APP_TIME_ZONE, day: 'numeric', month: 'numeric', year: 'numeric' });

export const formatAmount = (minor: number, currency: 'CZK' | 'EUR') =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);

const percent = (bp: number) => `${(bp / 100).toLocaleString('cs-CZ')} %`;

const require = createRequire(import.meta.url);
const FONT = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

const INK = '#111827';
const MUTED = '#4B5563';
const RULE = '#D1D5DB';

/** The document as an A4 PDF. */
export function renderTaxDocument(content: DocumentContent): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 48,
    info: {
      Title: `${content.issuer.name} ${content.number}`,
      Author: content.issuer.name,
      // Fixed to the issue, so rendering again gives the same document.
      CreationDate: new Date(content.issuedAt),
    },
  });
  doc.registerFont('regular', FONT);
  doc.registerFont('bold', FONT_BOLD);
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const money = (minor: number) => formatAmount(minor, content.currency);

  // Title and number
  doc.font('bold').fontSize(18).fillColor(INK).text(LABELS.title[content.kind].cs, left, 48);
  doc.font('regular').fontSize(11).fillColor(MUTED).text(LABELS.title[content.kind].en);
  doc.font('regular').fontSize(9).fillColor(MUTED).text(both(LABELS.number), left, 48, { width, align: 'right' });
  doc.font('bold').fontSize(16).fillColor(INK).text(content.number, { width, align: 'right' });

  // Supplier, customer and dates
  const top = 120;
  const column = (width - 24) / 2;
  const party = (x: number, heading: string, lines: string[]) => {
    doc.font('bold').fontSize(9).fillColor(MUTED).text(heading.toUpperCase(), x, top, { width: column });
    doc.moveDown(0.3);
    lines.forEach((line, i) => doc.font(i === 0 ? 'bold' : 'regular').fontSize(10).fillColor(INK).text(line, x, undefined, { width: column }));
  };
  party(left, both(LABELS.supplier), [
    content.issuer.name,
    ...content.issuer.address,
    `${both(LABELS.ico)}: ${content.issuer.ico}`,
    `${both(LABELS.dic)}: ${content.issuer.dic}`,
  ]);
  const supplierBottom = doc.y;

  const right = left + column + 24;
  if (content.customer) {
    party(right, both(LABELS.customer), [
      content.customer.name,
      ...content.customer.address,
      ...(content.customer.ico ? [`${both(LABELS.ico)}: ${content.customer.ico}`] : []),
      ...(content.customer.dic ? [`${both(LABELS.dic)}: ${content.customer.dic}`] : []),
    ]);
  }
  const facts: [string, string][] = [
    [both(LABELS.issued), day(content.issuedAt)],
    [both(LABELS.taxPoint), day(content.taxPointAt)],
    [both(LABELS.method), both(LABELS.transfer)],
    [both(LABELS.variableSymbol), String(content.payment.variableSymbol)],
    ...(content.payment.account ? [[both(LABELS.account), content.payment.account] as [string, string]] : []),
  ];
  doc.y = content.customer ? doc.y + 12 : top;
  for (const [label, value] of facts) {
    doc.font('regular').fontSize(8).fillColor(MUTED).text(label, right, undefined, { width: column });
    doc.font('bold').fontSize(10).fillColor(INK).text(value, right, undefined, { width: column });
    doc.moveDown(0.3);
  }

  // Lines
  let y = Math.max(doc.y, supplierBottom) + 24;
  const cols = [
    { label: both(LABELS.item), width: width - 3 * 76 - 56, align: 'left' as const },
    { label: both(LABELS.base), width: 76, align: 'right' as const },
    { label: both(LABELS.rate), width: 56, align: 'right' as const },
    { label: both(LABELS.vat), width: 76, align: 'right' as const },
    { label: both(LABELS.total), width: 76, align: 'right' as const },
  ];
  const row = (values: string[], font: 'regular' | 'bold', size: number, color = INK) => {
    let x = left;
    const heights = values.map((value, i) => doc.font(font).fontSize(size).heightOfString(value, { width: cols[i].width - 6 }));
    values.forEach((value, i) => {
      doc.font(font).fontSize(size).fillColor(color).text(value, x + (i === 0 ? 0 : 6), y, { width: cols[i].width - 6, align: cols[i].align });
      x += cols[i].width;
    });
    y += Math.max(...heights) + 8;
  };
  const rule = () => {
    doc.moveTo(left, y - 4).lineTo(left + width, y - 4).strokeColor(RULE).lineWidth(0.75).stroke();
  };

  row(cols.map((col) => col.label), 'regular', 8, MUTED);
  rule();
  for (const line of content.lines) {
    row([`${line.description.cs}\n${line.description.en}`, money(line.base), percent(line.vatRateBp), money(line.vat), money(line.gross)], 'regular', 10);
  }
  rule();

  // Totals
  const totals: [string, string, boolean][] = [
    [both(LABELS.base), money(content.totals.base), false],
    [`${both(LABELS.vat)} ${percent(content.lines[0]?.vatRateBp ?? 0)}`, money(content.totals.vat), false],
    [both(LABELS.totalWithVat), money(content.totals.gross), true],
  ];
  y += 4;
  for (const [label, value, strong] of totals) {
    doc.font(strong ? 'bold' : 'regular').fontSize(strong ? 12 : 10).fillColor(INK);
    doc.text(label, left, y, { width: width - 120, align: 'right' });
    doc.text(value, left + width - 120, y, { width: 120, align: 'right' });
    y = doc.y + 6;
  }

  // Notes and footer
  y += 18;
  doc.font('regular').fontSize(9).fillColor(INK);
  if (content.vatMode === 'REVERSE_CHARGE') {
    doc.text(both(LABELS.reverseCharge), left, y, { width });
    y = doc.y + 6;
  }
  doc.text(LABELS.paid.cs, left, y, { width });
  doc.fillColor(MUTED).text(LABELS.paid.en, { width });

  const footer = doc.page.height - doc.page.margins.bottom - 28;
  doc.font('regular').fontSize(7.5).fillColor(MUTED)
    .text(`${content.issuer.register.cs} ${content.issuer.register.en}`, left, footer, { width, align: 'center' });

  doc.end();
  return finished;
}
