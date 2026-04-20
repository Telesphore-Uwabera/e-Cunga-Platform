const fs = require('fs');
const path = 'c:/Users/uwabe/Desktop/e-Cunga-Platform/client/src/i18n/translations.jsx';

let content = fs.readFileSync(path, 'utf8');

// Replace the "email-¦" pattern (placeholder ellipsis) 
content = content.split('email-\u00a6').join('email...');
content = content.split('invoices-same').join('invoices - same');
content = content.split('only-other').join('only. Other');

// Replace standalone ¦ (broken ellipsis)
content = content.split('-\u00a6').join('...');
content = content.split('\u00a6').join('...');

// Replace em-dash artifacts
content = content.split('\u00e2\u0080\u0094').join(' - ');
content = content.split('\u2014').join(' - ');

// Fix any remaining curly quotes to straight ones
content = content.split('\u2018').join("'");
content = content.split('\u2019').join("'");
content = content.split('\u201c').join('"');
content = content.split('\u201d').join('"');

// Fix broken ellipsis
content = content.split('\u2026').join('...');

fs.writeFileSync(path, content, 'utf8');
console.log('Translations fixed successfully.');
