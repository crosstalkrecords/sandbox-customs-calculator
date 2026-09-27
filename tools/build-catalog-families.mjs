import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [csvPath, templatePath, outputPath] = process.argv.slice(2);

if (!csvPath || !templatePath || !outputPath) {
  console.error('Usage: node build-catalog-families.mjs <inventory.csv> <template.js> <output.js>');
  process.exit(1);
}

const SPECIAL_PATTERNS = [
  /colou?r(?:ed)?\s+vinyl/i,
  /transparent\s+(?:red|blue|green|yellow|orange|pink|purple|clear)/i,
  /zoetrope/i,
  /glow[- ]in[- ]th/i,
  /picture\s*disc/i,
  /deluxe/i,
  /expanded/i,
  /anniversary/i,
  /box\s*set/i,
  /boxset/i,
  /audiophile/i,
  /half[- ]speed/i,
  /45\s*rpm\s+series/i,
  /analogue|analog/i,
  /\bmono\b/i,
  /stereo\s+mix/i,
  /indie exclusive/i,
  /limited edition/i,
  /numbered/i
];

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isTrue(value) {
  return ['true', '1', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

function isSpecial(row) {
  const haystack = [
    row.item_title,
    row.release_formats,
    row.listing_options,
    row.listing_categories,
    row.listing_public_comments,
    row.listing_private_comments
  ].filter(Boolean).join(' | ');
  return SPECIAL_PATTERNS.some((pattern) => pattern.test(haystack));
}

function familyKey(row) {
  const artist = normalizeText(row.release_artists_formatted || row.release_artists || 'Unknown artist');
  const title = normalizeText(row.item_title || 'Untitled');
  return `standard|${artist}|${title}`;
}

function familyId(key) {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

const rawCsv = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsv(rawCsv);
const rowsByItem = new Map();

for (const row of rows) {
  const itemId = String(row.item_id || '').trim();
  if (!itemId) continue;
  if (!rowsByItem.has(itemId)) rowsByItem.set(itemId, []);
  rowsByItem.get(itemId).push(row);
}

const eligibleItems = new Map();

for (const [itemId, itemRows] of rowsByItem) {
  const published = itemRows.filter((row) => String(row.listing_status).trim().toLowerCase() === 'published');
  const relevant = published.filter((row) => row.item_type === 'ReleaseItem');
  if (!relevant.length) continue;

  // A public used or special listing makes the release ambiguous at card level,
  // so it stays ungrouped. Private historical listings cannot change the public card.
  if (relevant.some((row) => isTrue(row.listing_second_hand) || isSpecial(row))) continue;

  const standard = relevant.filter((row) => !isTrue(row.listing_second_hand) && !isSpecial(row));
  if (!standard.length) continue;
  const keys = new Set(standard.map(familyKey));
  if (keys.size !== 1) continue;

  eligibleItems.set(itemId, {
    key: [...keys][0],
    stock: standard.reduce((sum, row) => sum + numeric(row.listing_stock_quantity), 0),
    latestPublished: Math.max(...standard.map((row) => timestamp(row.listing_published_date)), 0)
  });
}

const itemIdsByFamily = new Map();
for (const [itemId, metadata] of eligibleItems) {
  if (!itemIdsByFamily.has(metadata.key)) itemIdsByFamily.set(metadata.key, []);
  itemIdsByFamily.get(metadata.key).push(itemId);
}

const releaseToFamily = {};
const canonicalByFamily = {};
let groupedFamilyCount = 0;

for (const [key, itemIds] of itemIdsByFamily) {
  if (itemIds.length < 2) continue;
  const opaqueId = familyId(key);
  groupedFamilyCount += 1;
  const sorted = [...itemIds].sort((left, right) => {
    const a = eligibleItems.get(left);
    const b = eligibleItems.get(right);
    const stockRank = (b.stock > 0) - (a.stock > 0);
    if (stockRank) return stockRank;
    if (b.stock !== a.stock) return b.stock - a.stock;
    if (b.latestPublished !== a.latestPublished) return b.latestPublished - a.latestPublished;
    return numeric(left) - numeric(right);
  });
  canonicalByFamily[opaqueId] = sorted[0];
  for (const itemId of sorted) releaseToFamily[itemId] = opaqueId;
}

// Keep the public payload deliberately minimal: public release IDs mapped to
// opaque family IDs, plus each family's preferred public release ID.
const data = JSON.stringify({ r: releaseToFamily, c: canonicalByFamily });

const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes('__XT_FAMILY_DATA__')) {
  throw new Error('Template is missing __XT_FAMILY_DATA__ placeholder.');
}

const output = template.replace('__XT_FAMILY_DATA__', data);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, 'utf8');
console.log(JSON.stringify({
  output: path.resolve(outputPath),
  sourceRows: rows.length,
  groupedFamilies: groupedFamilyCount,
  groupedReleases: Object.keys(releaseToFamily).length,
  bytes: Buffer.byteLength(output)
}, null, 2));
