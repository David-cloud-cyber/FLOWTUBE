const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building React components...');
try {
  execSync('npx vite build --config vite.config.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('Vite build failed:', err);
  process.exit(1);
}

console.log('Creating clean dist directory...');
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Files to copy from root to dist
const filesToCopy = [
  'index.html',
  'support.js',
  'huggyflow-logo.png',
  'favicon.svg',
  'Huggy flow.dc.html',
  'HuggyFlow Cream.dc.html',
  'image-slot.js'
];

// Folders to copy
const foldersToCopy = [
  'dist-components',
  'public'
];

// Helper to copy folder recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying static assets...');
for (const file of filesToCopy) {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file}`);
  }
}

for (const folder of foldersToCopy) {
  const src = path.join(__dirname, folder);
  const dest = path.join(distDir, folder);
  if (fs.existsSync(src)) {
    copyDir(src, dest);
    console.log(`Copied directory ${folder}`);
  }
}

console.log('Static build ready in dist/ folder!');
