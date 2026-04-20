const fs = require('fs');
const filePath = 'client/src/i18n/translations.jsx';
let buf = fs.readFileSync(filePath);

// 0x2d = '-', 0xc2 0x86 0xc2 0x90 = invisible Unicode chars U+0086 U+0090
// Pattern: 2d c286 c290 20 (dash + two control chars + space + "Back")
// Replace entire "- [control chars] Back" sequence with just "Back"

// Find and replace the byte pattern: 27 2d c2 86 c2 90 20 (= '- [ctrl][ctrl] Back)
// with: 27 (just the opening quote, then "Back" follows)

let str = buf.toString('binary');

// The problematic sequence as binary string chars
const badSeq = '\x2d\xc2\x86\xc2\x90\x20'; // -[PAD][DCS] 
const goodSeq = '';

let count = 0;
while (str.includes(badSeq)) {
  str = str.replace(badSeq, goodSeq);
  count++;
}

// Also handle same pattern in Kinyarwanda if present
console.log(`Removed ${count} backHome invisible sequences`);

fs.writeFileSync(filePath, Buffer.from(str, 'binary'));

// Verify
const check = fs.readFileSync(filePath, 'utf8');
const line = check.split('\n').find(l => l.includes('backHome'));
console.log('Result:', line ? line.trim() : 'not found');
