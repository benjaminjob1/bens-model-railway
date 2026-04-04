const fs = require('fs');
const path = require('path');

const file = 'src/components/InteractiveTrain.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

// Find FACTORIES line
let factoryLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim().startsWith('const FACTORIES = [')) {
    factoryLine = i;
    break;
  }
}

if (factoryLine === -1) {
  console.error('FACTORIES not found');
  process.exit(1);
}

console.log(`FACTORIES at line ${factoryLine + 1}`);

// Header: lines 0-13
// Layouts: lines 14 to factoryLine-1
// Rest: factoryLine onwards

const newLayouts = fs.readFileSync('src/components/InteractiveTrain.layouts.txt', 'utf8');
const newLayoutLines = newLayoutLinesFn(newLayouts);

function newLayoutLinesFn(text) {
  return text.split('\n');
}

const newLines = [
  ...lines.slice(0, 14),
  ...newLayoutLines,
  ...lines.slice(factoryLine)
];

const newContent = newLines.join('\n');
fs.writeFileSync(file, newContent);
console.log(`Done! ${newLines.length} lines`);
