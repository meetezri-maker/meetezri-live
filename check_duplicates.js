const fs = require('fs');
const content = fs.readFileSync('apps/web/src/lib/api.ts', 'utf8');
const lines = content.split('\n');

const keyMap = {}; // indent -> list of keys

lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

  // Match property definitions like "key: value" or "async method() {"
  const match = line.match(/^(\s*)(\w+):/); // Matches "  key:"
  const asyncMatch = line.match(/^(\s*)async\s+(\w+)\(/); // Matches "  async method("
  
  if (match) {
    const indent = match[1].length;
    const key = match[2];
    checkDuplicate(indent, key, i + 1);
  } else if (asyncMatch) {
    const indent = asyncMatch[1].length;
    const key = asyncMatch[2];
    checkDuplicate(indent, key, i + 1);
  }
});

function checkDuplicate(indent, key, lineNum) {
    if (!keyMap[indent]) keyMap[indent] = [];
    
    // Simple heuristic: if we see the same key at the same indentation level
    // It *might* be a duplicate. But different objects can have same keys.
    // However, in `api.ts`, the structure is `export const api = { ... }`.
    // Most methods are unique.
    // Let's print potential duplicates and I'll verify manually.
    
    if (keyMap[indent].includes(key)) {
        console.log(`Potential duplicate: "${key}" at line ${lineNum} (indent ${indent})`);
    }
    keyMap[indent].push(key);
}
