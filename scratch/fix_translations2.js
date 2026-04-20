const fs = require('fs');
const path = 'c:/Users/uwabe/Desktop/e-Cunga-Platform/client/src/i18n/translations.jsx';

let content = fs.readFileSync(path, 'utf8');

// Fix specific broken strings found in current file
const fixes = [
  // Team page text issues
  ["'Name or email-...'", "'Search by name or email...'"],
  ["invoices-same controls as Team", "invoices. Same controls as Team"],
  ["company only-other tenants are invisible", "company only. Other tenants are not visible"],

  // Kinyarwanda section - same patterns
  ["'Izina cyangwa email-...'", "'Shakisha amazina cyangwa imeyili...'"],
  ["'Izina cyangwa imeyili-...'", "'Shakisha amazina cyangwa imeyili...'"],
];

let changed = 0;
for (const [from, to] of fixes) {
  if (content.includes(from)) {
    content = content.split(from).join(to);
    changed++;
    console.log('Fixed:', from.substring(0, 40));
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log(`Done. ${changed} fixes applied.`);
