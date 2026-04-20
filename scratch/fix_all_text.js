const fs = require('fs');
const filePath = 'client/src/i18n/translations.jsx';

// Read as buffer to preserve exact bytes
let c = fs.readFileSync(filePath, 'utf8');

// The pattern is: '-' + \u0080 (U+0080 PAD character, bytes 0xC2 0x80 in UTF-8) + '...'
// This invisible control character was inserted during a bad encoding conversion
const BAD_ELLIPSIS = '-\u0080...';  // dash + PAD char + ellipsis
const GOOD_ELLIPSIS = '...';        // clean ellipsis

let count = 0;
while (c.includes(BAD_ELLIPSIS)) {
  c = c.replace(BAD_ELLIPSIS, GOOD_ELLIPSIS);
  count++;
}

// Also fix "- Back to home" style
const badBackHome = "': '- Back";
const goodBackHome = "': 'Back";
while (c.includes(badBackHome)) {
  c = c.replace(badBackHome, goodBackHome);
  count++;
}

// Fix any remaining -\u0080 sequences
const BAD_DASH_PAD = '-\u0080';
while (c.includes(BAD_DASH_PAD)) {
  c = c.replace(BAD_DASH_PAD, '');
  count++;
}

fs.writeFileSync(filePath, c, 'utf8');
console.log(`Done. ${count} invisible-character artifacts removed.`);

// Verify
const remaining = (c.match(/\u0080/g) || []).length;
console.log(`Remaining U+0080 chars in file: ${remaining}`);
