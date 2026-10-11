import { readFileSync, writeFileSync, readdirSync } from 'fs';

const indexPath = './dist/index.html';
let content = readFileSync(indexPath, 'utf8');

// Find actual asset filenames
const assets = readdirSync('./dist/assets');
const jsFile = assets.find(f => f.endsWith('.js'));
const cssFile = assets.find(f => f.endsWith('.css'));

// Replace paths with GitHub Pages paths
if (jsFile) {
  content = content.replace(/src="\/assets\/[^"]+"/g, `src="/CalmDesk/assets/${jsFile}"`);
}
if (cssFile) {
  content = content.replace(/href="\/assets\/[^"]+"/g, `href="/CalmDesk/assets/${cssFile}"`);
}

writeFileSync(indexPath, content);
console.log('✓ Fixed asset paths in dist/index.html');
