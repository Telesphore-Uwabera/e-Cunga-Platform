import { readFileSync } from 'fs';
import { Parser } from 'acorn';

try {
  const code = readFileSync('server/src/routes/workspace.routes.js', 'utf8');
  console.log('Reading workspace.routes.js successful, parsing...');
  Parser.parse(code, { ecmaVersion: 2024, sourceType: 'module' });
  console.log('SUCCESS: No syntax errors found in workspace.routes.js!');
} catch (err) {
  console.error('SYNTAX ERROR DETECTED:', err.message);
  if (err.loc) {
    console.error(`At line ${err.loc.line}, column ${err.loc.column}`);
  }
}
