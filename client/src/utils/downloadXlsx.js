import * as XLSX from 'xlsx';

const SHEET_NAME_MAX = 31;

function safeSheetName(name) {
  const raw = String(name || 'Export')
    .replace(/[:\\/?*[\]]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SHEET_NAME_MAX);
  return raw || 'Export';
}

/**
 * Save tabular data as an Excel workbook (.xlsx).
 * @param {string} filename - with or without .xlsx
 * @param {(string|number|boolean|null|undefined)[][]} aoa - rows; first row is usually headers. Empty rows may be [].
 * @param {string} [sheetName]
 */
export function downloadAoAAsXlsx(filename, aoa, sheetName = 'Export') {
  const data = aoa.length
    ? aoa.map((row) => (Array.isArray(row) && row.length ? row : ['']))
    : [['(no data)']];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheetName));
  const out = /\.xlsx$/i.test(filename) ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}
