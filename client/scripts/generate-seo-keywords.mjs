/**
 * Builds ~1000 English + ~1000 Kinyarwanda keywords for <meta name="keywords">.
 * Exported for Vite transformIndexHtml; run directly to dump a debug file.
 *
 * Note: Google and other major engines largely ignore meta keywords; this is
 * mainly for smaller crawlers / legacy tools. Prefer strong titles, descriptions,
 * and page content for real SEO.
 */
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function uniq(arr) {
  return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
}

const enPrefixes = [
  'e-Cunga',
  'eCunga',
  'ecunga',
  'cloud',
  'digital',
  'online',
  'web',
  'enterprise',
  'healthcare',
  'hospital',
  'pharmacy',
  'clinical',
  'medical',
  'Rwanda',
  'East Africa',
  'Kigali',
  'EAC',
  'SaaS',
  'B2B',
  'automated',
  'real-time',
  'centralized',
  'multi-site',
  'tenant',
  'role-based',
  'audit-ready',
  'compliance',
  'GS1',
  'cold chain',
  'temperature',
  'batch',
  'lot',
  'serial',
  'FIFO',
  'FEFO',
  'perpetual',
  'periodic',
  'just-in-time',
  'vendor-managed',
  'two-way',
  'three-way',
  'four-way',
  'procure-to-pay',
  'order-to-cash',
  'source-to-pay',
  'plan-to-produce',
  'integrated',
  'unified',
  'collaborative',
  'demand-driven',
  'forecast-based',
  'data-driven',
  'AI-assisted',
  'alert-driven',
  'workflow',
  'approval',
  'exception',
  'mobile-friendly',
  'secure',
  'encrypted',
];

const enCores = [
  'inventory',
  'stock',
  'warehouse',
  'storeroom',
  'supply chain',
  'logistics',
  'distribution',
  'fulfillment',
  'procurement',
  'sourcing',
  'purchasing',
  'vendor',
  'supplier',
  'buyer',
  'contract',
  'catalog',
  'SKU',
  'item master',
  'product',
  'material',
  'consumable',
  'reagent',
  'PPE',
  'consumables',
  'requisition',
  'purchase order',
  'goods receipt',
  'GRN',
  'invoice',
  'proforma',
  'payment',
  'finance',
  'budget',
  'cost center',
  'stocktake',
  'cycle count',
  'adjustment',
  'transfer',
  'allocation',
  'reservation',
  'pick list',
  'pack slip',
  'shipment',
  'delivery',
  'lead time',
  'safety stock',
  'reorder point',
  'EOQ',
  'MRP',
  'DRP',
  'ATP',
  'available to promise',
  'stockout',
  'overstock',
  'slow mover',
  'expiry',
  'expiration',
  'near expiry',
  'recall',
  'quarantine',
  'quality control',
  'traceability',
  'serialization',
  'barcode',
  'QR',
  'RFID',
  'labeling',
  'returns',
  'RMA',
  'disposal',
  'donation',
  'destruction',
  'compliance reporting',
  'dashboard',
  'analytics',
  'KPI',
  'turnover',
  'fill rate',
  'OTIF',
  'service level',
  'portal',
  'workspace',
  'tenant settings',
  'user roles',
  'RBAC',
  'notifications',
  'alerts',
  'messaging',
  'documents',
  'attachments',
  'audit trail',
  'activity log',
  'supervisor',
  'clerk',
  'accountant',
  'supplier portal',
  'stock visibility',
  'inventory accuracy',
  'demand planning',
  'replenishment',
  'min max',
  'par level',
  'bin location',
  'shelf life',
  'UOM',
  'unit of measure',
  'conversion',
  'kitting',
  'BOM',
  'assembly',
  'disassembly',
  'consignment',
  'VMI',
  'cross-dock',
  'hub',
  'spoke',
  'last mile',
  'reverse logistics',
  'sustainability',
  'waste reduction',
  'stock management software',
  'inventory system',
  'supply chain platform',
  'healthcare logistics',
  'medical inventory',
  'pharmacy stock control',
  'hospital supply room',
  'Africa supply chain',
  'Rwanda logistics tech',
];

const enSuffixes = [
  'software',
  'system',
  'platform',
  'solution',
  'tool',
  'suite',
  'module',
  'app',
  'application',
  'dashboard',
  'reporting',
  'automation',
  'optimization',
  'visibility',
  'control',
  'governance',
  'workflow',
  'integration',
  'API',
  'best practices',
  'for hospitals',
  'for pharmacies',
  'for clinics',
  'for suppliers',
  'for distributors',
  'for NGOs',
  'for public health',
  'in Rwanda',
  'in East Africa',
  '2025',
  '2026',
];

function buildEnglishKeywords() {
  const enExtra = [];
  for (const p of enPrefixes) {
    for (const c of enCores) {
      enExtra.push(`${p} ${c}`);
      if (enExtra.length >= 1200) break;
    }
    if (enExtra.length >= 1200) break;
  }
  for (const c of enCores) {
    for (const s of enSuffixes) {
      enExtra.push(`${c} ${s}`);
      if (enExtra.length >= 2200) break;
    }
    if (enExtra.length >= 2200) break;
  }

  const enAll = uniq([
    ...enCores,
    ...enPrefixes,
    ...enSuffixes,
    'e-Cunga Portal',
    'ecunga.com',
    'stock and supply chain management',
    'inventory control platform',
    'automated inventory',
    'supplier workflow',
    'stock visibility',
    'inventory approvals',
    ...enExtra,
  ]);

  let enKeywords = enAll.slice(0, Math.max(1000, enAll.length));
  while (enKeywords.length < 1000) {
    enKeywords.push(`inventory supply chain term ${enKeywords.length + 1}`);
  }
  return uniq(enKeywords).slice(0, 1000);
}

const rwPrefixes = [
  'e-Cunga',
  'porotali',
  'sisitemu',
  'ikoranabuhanga',
  'serivisi zikoranabuhanga',
  'mu Rwanda',
  'muri EAC',
  'Kigali',
  'ubuvuzi',
  'ibitaro',
  'farumasi',
  'kliniki',
  'ubufasha',
  'kugenzura',
  'kuri interineti',
  'mu gihe nyacyo',
  'ubwiyunge',
  'umutekano',
  'raporo',
  'amakuru',
  'ubuyobozi',
  'abakozi',
  'abatumizi',
  'abatanga bikoresho',
  'abagura',
  'imari',
  'kwishyura',
  'fagitire',
  'ubwiyemezi',
  'ubufasha bwa AI',
];

const rwCores = [
  'ububiko',
  'ibicuruzwa',
  'ibikoresho',
  'ibintu',
  'ibyari mu bubiko',
  'gucunga ububiko',
  'kugenzura ububiko',
  'kugenzura umutungo',
  'ububiko bwibitaro',
  'ububiko bwa farumasi',
  'gusaba ibikoresho',
  'gutanga ibikoresho',
  'kohereza',
  'kwakira',
  'ubwiyunge bwibikoresho',
  'umurongo wibikoresho',
  'ubwiyunge nabotunzi',
  'abagurisha',
  'ubwiyunge bwimari',
  'raporo zububiko',
  'gukuraho ibyarenze igihe',
  'kugenzura itariki',
  'ubwoko bwibicuruzwa',
  'ubwinshi',
  'ingano',
  'ibiciro',
  'ubwiyemezi bwishyura',
  'ubwiyemezi bwa proforma',
  'ubwishyu',
  'ubwiyunge bwabakozi',
  'uburenganzira',
  'uruhare',
  'amabwiriza',
  'gusuzuma',
  'gusubiramo ububiko',
  'kohereza raporo',
  'amatangazo',
  'ubwiyunge bwikigo',
  'ikirango cyikigo',
  'indangantego',
  'umwirondoro',
  'kwinjira',
  'gusohoka',
  'ububiko bwuzuye',
  'kubura ibicuruzwa',
  'guteza imbere serivisi',
  'gufasha abarwayi',
  'imiti',
  'ibikoresho byubuvuzi',
  'ibikoresho byisuku',
  'ubushakashatsi',
  'ubwiyunge nikoranabuhanga',
  'porotali yububiko',
  'porotali yabatumizi',
  'porotali yabotunzi',
  'gucunga umutungo',
  'gucunga ibyacuruzwa',
  'ubwiyunge bwimari nububiko',
  'gukurikirana ibikoresho',
  'gukurikirana ishyirwa ryibicuruzwa',
  'ubwiyunge bwibyiciro',
  'ubwiyunge bwibikorwa',
  'ubwiyunge bwibyiciro byakazi',
  'gusaba uburenganzira',
  'kwemeza',
  'gusuzuma ibyakozwe',
  'ubwiyunge bwibyandiko',
  'ubwiyunge bwibaruwa',
  'kumenya umubare wibicuruzwa',
  'kumenya aho bibera',
  'gutunganya ububiko',
  'gutezimbere umutekano wibicuruzwa',
  'kugabanya ubusabane',
  'kongera umusaruro wubuvuzi',
  'ubwiyunge bwibigo',
  'ubwiyunge bwibitaro',
  'ubwiyunge bwimiryango',
  'serivisi zububiko',
  'serivisi zubwiyunge',
  'ubwiyunge bwibyiciro byimari',
  'ubwiyunge bwibyiciro byubuvuzi',
  'gucunga ibyiciro',
  'gucunga ibyiciro byububiko',
  'gucunga ibyiciro byubwiyunge',
  'gucunga ibyiciro byubuvuzi',
  'gucunga ibyiciro byimari',
  'gucunga ibyiciro byabakozi',
  'gucunga ibyiciro byabatumizi',
  'gucunga ibyiciro byabotunzi',
  'gucunga ibyiciro byabagurisha',
  'gucunga ibyiciro byabagura',
  'ubwiyunge bwibikoresho bya serivisi',
  'ubwiyunge bwibikoresho bya leta',
  'ubwiyunge bwibikoresho bya Leta',
  'ubwiyunge bwibikoresho bya NGO',
  'ubwiyunge bwibikoresho bya serivisi zubuvuzi',
  'gukora ku mugaragaro',
  'gukora ku murima',
  'ubwiyunge bwibikoresho bya koperative',
  'ubwiyunge bwibikoresho bya sosiyete',
  'ubwiyunge bwibikoresho bya kompanyi',
  'ubwiyunge bwibikoresho bya serivisi zitandukanye',
  'ubwiyunge bwibikoresho bya serivisi zubuvuzi mu Rwanda',
  'ubwiyunge bwibikoresho bya serivisi zubuvuzi muri EAC',
  'ubwiyunge bwibikoresho bya serivisi zubuvuzi muri Afrika',
];

const rwSuffixes = uniq([
  'mu Rwanda',
  'muri EAC',
  'muri Afrika',
  'ku isi',
  'kuri porotali',
  'muri sisitemu',
  'muri porotali ya e-Cunga',
  'muri sisitemu ya e-Cunga',
  'kuri interineti',
  'mu gihe nyacyo',
  'binyuze mu porotali',
  'binyuze mu sisitemu',
  'kugira ububiko bwiza',
  'kugira serivisi nziza',
  'kugira raporo nziza',
  'kugira umutekano',
  'kugira uburenganzira',
  'kugira amakuru',
  'kugira ubwiyunge',
  'kugira ubufasha',
  'kugira ubwiyemezi',
  'kugira ubwishyu',
  'kugira fagitire',
  'kugira ubwiyunge bwimari',
  'kugira ubwiyunge bwububiko',
  'kugira ubwiyunge bwibikoresho',
  'kugira ubwiyunge bwibicuruzwa',
  'kugira ubwiyunge bwibintu',
  'kugira ubwiyunge bwibikoresho byubuvuzi',
  'kugira ubwiyunge bwibikoresho bya farumasi',
  'kugira ubwiyunge bwibikoresho byibitaro',
  'kugira ubwiyunge bwibikoresho bya kliniki',
  'kugira ubwiyunge bwibikoresho bya serivisi zitandukanye',
  'kugira ubwiyunge bwibikoresho bya serivisi zubuvuzi',
  'kugira ubwiyunge bwibikoresho bya serivisi zubuvuzi mu Rwanda',
  'kugira ubwiyunge bwibikoresho bya serivisi zubuvuzi muri EAC',
  'kugira ubwiyunge bwibikoresho bya serivisi zubuvuzi muri Afrika',
  'kugira ubwiyunge bwibikoresho bya serivisi zubuvuzi ku isi',
  'kugira ubwiyunge bwibikoresho bya serivisi zubuvuzi ku murima',
]);

function buildKinyarwandaKeywords() {
  const rwExtra = [];
  for (const p of rwPrefixes) {
    for (const c of rwCores) {
      rwExtra.push(`${p} ${c}`);
      if (rwExtra.length >= 1300) break;
    }
    if (rwExtra.length >= 1300) break;
  }
  for (const c of rwCores) {
    for (const s of rwSuffixes) {
      rwExtra.push(`${c} ${s}`);
      if (rwExtra.length >= 2600) break;
    }
    if (rwExtra.length >= 2600) break;
  }

  const places = ['mu Rwanda', 'muri EAC', 'muri Kigali', 'muri Afrika', 'ku isi', 'mu mujyi wubuvuzi'];
  const roles = ['abakozi', 'abayobozi', 'abatumizi', 'abotunzi', 'abagura', 'abagurisha'];
  for (const pl of places) {
    for (const r of roles) {
      rwExtra.push(`ububiko nubwiyunge ${r} ${pl}`);
    }
  }

  const rwAll = uniq([
    ...rwCores,
    ...rwPrefixes,
    ...rwSuffixes,
    'porotali e-Cunga',
    'gucunga ububiko nubwiyunge bwibikoresho',
    'gucunga stock',
    'supply chain mu Rwanda',
    'ububiko nigitangaza',
    'ubwiyunge bwibicuruzwa mu Rwanda',
    ...rwExtra,
  ]);

  let rwKeywords = uniq(rwAll);
  let n = 0;
  while (rwKeywords.length < 1000) {
    n += 1;
    rwKeywords.push(`ububiko porotali e-Cunga ${n}`);
  }
  return rwKeywords.slice(0, 1000);
}

/** Comma-separated keywords (~2000 terms) safe for HTML attribute after escaping. */
export function getSeoKeywordsMetaContent() {
  const en = buildEnglishKeywords();
  const rw = buildKinyarwandaKeywords();
  return [...en, ...rw].join(', ');
}

export function escapeSeoKeywordsForHtmlAttr(raw) {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

const __filename = fileURLToPath(import.meta.url);
const isMain = resolve(process.argv[1] || '') === __filename;

if (isMain) {
  const content = getSeoKeywordsMetaContent();
  const outPath = join(__dirname, '..', 'seo-keywords.generated.txt');
  writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath} (${content.length} chars)`);
}
