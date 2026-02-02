const fs = require('fs');
const path = require('path');

const root = process.cwd();

// 1) קבל שם פרויקט מה-argv, ברירת מחדל: site
const project = process.argv[2] || 'site';

// 2) חשב נתיבים לפי הפרויקט
const srcDir = path.join(root, 'apps', project, 'src');
const outDir = path.join(root, 'dist', 'apps', project);

function mustExist(p, hint) {
  if (!fs.existsSync(p)) {
    console.error('❌ Missing:', p);
    if (hint) console.error('   ', hint);
    process.exit(1);
  }
}

mustExist(srcDir, `Create it with: mkdir -p apps/${project}/src`);

fs.mkdirSync(outDir, { recursive: true });

const files = ['index.html', 'privacy.html', 'terms.html'];

for (const f of files) {
  const from = path.join(srcDir, f);
  mustExist(from, `Put ${f} in apps/${project}/src/`);
  const to = path.join(outDir, f);
  fs.copyFileSync(from, to);
}

console.log('✅ site built to:', outDir);
console.log('✅ files:', files.join(', '));
