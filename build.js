const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building React components...');
try {
  execSync('npm run build:components', { stdio: 'inherit' });
} catch (err) {
  console.error('Vite build failed:', err.message || err);
  process.exit(1);
}

console.log('Creating clean dist directory...');
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// Only copy from public/ — root duplicates removed
const foldersToCopy = [
  'dist-components',
  'public'
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Skipped directory (not found): ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying assets from public/ and dist-components/...');
for (const folder of foldersToCopy) {
  const src = path.join(__dirname, folder);
  const dest = path.join(distDir, folder);
  if (fs.existsSync(src)) {
    copyDir(src, dest);
    console.log(`Copied directory: ${folder}`);
  } else {
    console.warn(`Skipped directory (not found): ${folder}`);
  }
}

console.log('Static build ready in dist/ folder!');
