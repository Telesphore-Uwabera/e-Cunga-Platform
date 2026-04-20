const fs = require('fs');
const path = 'c:/Users/uwabe/Desktop/e-Cunga-Platform/client/src/i18n/translations.jsx';

try {
  let content = fs.readFileSync(path, 'utf8');

  // Replace common encoding artifacts with safe ASCII
  // Patterns:
  // â€” or €” -> -
  // â¦ -> ...
  // â€œ or â€ -> "
  // â€™ -> '
  
  // We use regex with Unicode escapes or approximate patterns if necessary
  content = content.replace(/[â€”|€”|â€\w|€\w]+/g, (match) => {
    if (match.includes('â¦') || match.includes('¦')) return '...';
    if (match.includes('â€”') || match.includes('€”')) return ' - ';
    if (match.includes('â€™') || match.includes('’')) return "'";
    if (match.includes('â€œ') || match.includes('â€')) return '"';
    return match;
  });

  // More specific matches for the ones in the screenshot
  content = content.split('â€”').join(' - ');
  content = content.split('€”').join(' - ');
  content = content.split('â¦').join('...');
  
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully sanitized translations.jsx');
} catch (err) {
  console.error('Failed to sanitize file:', err);
  process.exit(1);
}
