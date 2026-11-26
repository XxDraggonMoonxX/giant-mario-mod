const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'games');
fs.mkdirSync(dir, { recursive: true });

const list = fs.readdirSync(dir)
  .filter(file => file !== 'list.json' && fs.statSync(path.join(dir, file)).isFile())
  .map(file => ({ file, size: fs.statSync(path.join(dir, file)).size }));

fs.writeFileSync(path.join(dir, 'list.json'), JSON.stringify(list, null, 2));
console.log(`games/list.json now lists ${list.length} file${list.length === 1 ? '' : 's'}:`);
for (const item of list) console.log('  ' + item.file);
