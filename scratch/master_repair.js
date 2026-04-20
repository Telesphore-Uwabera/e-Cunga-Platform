const fs = require('fs');
const path = require('path');

const currentPath = 'client/src/i18n/translations.jsx';
const backupPath = 'client/src/i18n/translations_backup.jsx';

const currentContent = fs.readFileSync(currentPath, 'utf8');
const backupContent = fs.readFileSync(backupPath, 'utf8');

function clean(str) {
    if (!str) return '';
    // Replace ALL weird characters that might be trademarks, smart quotes, etc with a simple apostrophe or space
    return str.replace(/[^\x00-\x7F]/g, "'")
              .replace(/''/g, "'") // fix double quote
              .replace(/Supaviseri/g, 'Umugenzuzi')
              .split('Umubarezi w\'imari').join('Ushinzwe imari')
              .split('Umutunzi').join('Umutanga-bikoresho');
}

function parseBetter(source) {
    const result = {};
    const categories = source.match(/[a-zA-Z0-9]+:\s*\{[\s\S]*?\}(?=\s*,\s*\n|\s*\n\s*\})/g);
    if (!categories) return result;

    categories.forEach(catStr => {
        const catNameMatch = catStr.match(/^([a-zA-Z0-9]+):/);
        if (!catNameMatch) return;
        const catName = catNameMatch[1];
        result[catName] = {};

        // Match "key: 'value'," but handle internal apostrophes by looking ahead for a comma and newline
        const entries = catStr.matchAll(/([a-zA-Z0-9]+):\s*'(.*?)',?\s*(?=\r?\n)/g);
        for (const entry of entries) {
            result[catName][entry[1]] = entry[2];
        }
    });
    return result;
}

const engMatch = currentContent.match(/const eng = (\{[\s\S]*?\});/);
const engObj = parseBetter(engMatch[1]);
const kinyObj = parseBetter(currentContent.split('const kiny =')[1]);
const backupObj = parseBetter(backupContent.split('const kiny =')[1]);

let newKiny = 'const kiny = {\n';
for (const cat in engObj) {
    newKiny += `  ${cat}: {\n`;
    for (const key in engObj[cat]) {
        let val = '';
        if (kinyObj[cat] && kinyObj[cat][key] && kinyObj[cat][key].trim().length > 3) {
            // Use current if it looks long enough
            val = kinyObj[cat][key];
        } else if (backupObj[cat] && backupObj[cat][key]) {
            // Use backup if current is missing or too short
            val = backupObj[cat][key];
        } else {
            // Fallback to English
            val = engObj[cat][key];
        }
        
        const cleanedVal = clean(val).replace(/'/g, "\\'");
        newKiny += `    ${key}: '${cleanedVal}',\n`;
    }
    newKiny += '  },\n';
}
newKiny += '};';

const finalContent = currentContent.replace(/const kiny = \{[\s\S]*?\};/, newKiny);
fs.writeFileSync(currentPath, finalContent, 'utf8');
console.log('Repaired Kinyarwanda translations: fixed characters, restored missing/truncated strings, and synchronized with English.');
