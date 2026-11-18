import zlib from 'zlib';

/**
 * Reads the first sheet of an XLSX file, or a CSV file, into rows of cell
 * values. Written on Node's own zlib instead of a spreadsheet library: an
 * uploaded file is untrusted, and all we need is the plain grid of one sheet.
 *
 * Cells come back as strings, numbers (dates and times stay Excel serial
 * numbers) or null; formulas give their cached value.
 */

export type Cell = string | number | null;

export class SpreadsheetError extends Error {
  constructor(public readonly code: 'NOT_A_SPREADSHEET' | 'TOO_LARGE' | 'EMPTY', message: string) {
    super(message);
  }
}

/** Uncompressed sizes past this are refused (a 1 MB upload never needs more). */
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 5000;

interface ZipEntry { name: string; method: number; compressedSize: number; size: number; offset: number }

/** The entries of a ZIP archive from its central directory. */
function zipEntries(buffer: Buffer): Map<string, ZipEntry> {
  // End of central directory: signature 0x06054b50, within the last 64 kB + 22 bytes.
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new SpreadsheetError('NOT_A_SPREADSHEET', 'Not an XLSX file');
  const count = buffer.readUInt16LE(end + 10);
  let pointer = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, ZipEntry>();
  for (let i = 0; i < count; i++) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) {
      throw new SpreadsheetError('NOT_A_SPREADSHEET', 'Damaged XLSX file');
    }
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const size = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const offset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength);
    entries.set(name, { name, method, compressedSize, size, offset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readEntry(buffer: Buffer, entry: ZipEntry): string {
  if (entry.size > MAX_ENTRY_BYTES) throw new SpreadsheetError('TOO_LARGE', 'The spreadsheet is too large');
  const header = entry.offset;
  if (header + 30 > buffer.length || buffer.readUInt32LE(header) !== 0x04034b50) {
    throw new SpreadsheetError('NOT_A_SPREADSHEET', 'Damaged XLSX file');
  }
  const start = header + 30 + buffer.readUInt16LE(header + 26) + buffer.readUInt16LE(header + 28);
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.toString('utf8');
  if (entry.method === 8) {
    return zlib.inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES }).toString('utf8');
  }
  throw new SpreadsheetError('NOT_A_SPREADSHEET', 'Unsupported compression in the XLSX file');
}

const decodeXml = (value: string) => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&amp;/g, '&');

/** All the <t> text runs inside a fragment, joined. */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');

/** "C12" → column index 2. */
const columnOf = (reference: string) => {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? 'A';
  return [...letters].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
};

function readXlsx(buffer: Buffer): Cell[][] {
  const entries = zipEntries(buffer);
  const entry = (name: string) => entries.get(name);
  const shared: string[] = [];
  const sharedEntry = entry('xl/sharedStrings.xml');
  if (sharedEntry) {
    for (const match of readEntry(buffer, sharedEntry).matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(match[1]));
  }

  // The first sheet in the workbook's order, through its relationship.
  const workbook = entry('xl/workbook.xml');
  const rels = entry('xl/_rels/workbook.xml.rels');
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (workbook && rels) {
    const firstId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(readEntry(buffer, workbook))?.[1];
    const relsXml = readEntry(buffer, rels);
    const target = firstId
      ? [...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((tag) => tag.includes(`Id="${firstId}"`))
      : undefined;
    const path = target ? /Target="([^"]+)"/.exec(target)?.[1] : undefined;
    if (path) sheetPath = path.startsWith('/') ? path.slice(1) : `xl/${path}`;
  }
  const sheet = entry(sheetPath);
  if (!sheet) throw new SpreadsheetError('NOT_A_SPREADSHEET', 'The XLSX file has no sheet');

  const rows: Cell[][] = [];
  for (const rowMatch of readEntry(buffer, sheet).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= MAX_ROWS) throw new SpreadsheetError('TOO_LARGE', 'The spreadsheet has too many rows');
    const row: Cell[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cell[1];
      const body = cell[2] ?? '';
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? null;
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' || type === 'e') value = raw !== undefined ? decodeXml(raw) : null;
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (raw !== undefined) value = Number(raw);
      row[reference ? columnOf(reference) : row.length] = value;
    }
    rows.push(Array.from(row, (value) => value ?? null));
  }
  return rows;
}

/** A CSV with ; or , as separator (whichever the header uses more), quotes as in RFC 4180. */
function readCsv(text: string): Cell[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(field.trim() || null); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim() || null);
      rows.push(row);
      if (rows.length > MAX_ROWS) throw new SpreadsheetError('TOO_LARGE', 'The file has too many rows');
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field.trim() || null); rows.push(row); }
  return rows;
}

/** The rows of an uploaded XLSX or CSV file; empty rows are dropped. */
export function readSpreadsheet(buffer: Buffer): Cell[][] {
  const isZip = buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
  // A CSV saved by Czech Excel is often Windows-1250, not UTF-8.
  const decoded = isZip ? '' : buffer.toString('utf8');
  const csvText = !isZip && decoded.includes('\uFFFD') ? new TextDecoder('windows-1250').decode(buffer) : decoded;
  const rows = isZip ? readXlsx(buffer) : readCsv(csvText);
  const filled = rows.filter((row) => row.some((cell) => cell !== null && String(cell).trim() !== ''));
  if (filled.length === 0) throw new SpreadsheetError('EMPTY', 'The file is empty');
  return filled;
}
