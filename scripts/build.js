const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const version = require(path.join(root, 'package.json')).version;
const entriesToCopy = [
  'index.html',
  'services.html',
  'materials.html',
  'questions.html',
  'exams.html',
  'student.html',
  'parent.html',
  'reviews.html',
  'teacher-login.html',
  'privacy.html',
  'terms.html',
  'assets',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'teacher.webmanifest',
  'service-worker.js',
  'firebase-messaging-sw.js',
  'offline.html'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const entry of entriesToCopy) {
  copyRecursive(path.join(root, entry), path.join(dist, entry));
}

const assetDir = path.join(dist, 'assets');
const cssBundle = ['site.css','v55.css','v56.css'].map(file=>fs.readFileSync(path.join(assetDir,file),'utf8')).join('\n');
fs.writeFileSync(path.join(assetDir,'site.bundle.css'),cssBundle);
const publicBundle = ['app.js','v53-upgrades.js','v56-fixes.js'].map(file=>fs.readFileSync(path.join(assetDir,file),'utf8')).join('\n;\n');
const adminBundle = ['app.js','admin.js','v53-upgrades.js','v55-admin.js','v56-fixes.js'].map(file=>fs.readFileSync(path.join(assetDir,file),'utf8')).join('\n;\n');
fs.writeFileSync(path.join(assetDir,'public.bundle.js'),publicBundle);
fs.writeFileSync(path.join(assetDir,'admin.bundle.js'),adminBundle);

for (const file of fs.readdirSync(dist).filter(name => name.endsWith('.html'))) {
  const target = path.join(dist, file);
  let html = fs.readFileSync(target, 'utf8').replace(/(\?v=)[0-9.]+/g, `$1${version}`);
  html=html
    .replace(/<link[^>]+href=["']assets\/(?:site|v55|v56)\.css[^"']*["'][^>]*>\s*/g,'')
    .replace('</head>',`<link href="assets/site.bundle.css?v=${version}" rel="stylesheet"></head>`);
  const bundle=file==='teacher-login.html'?'admin.bundle.js':'public.bundle.js';
  html=html.replace(/<script defer src=["']assets\/(?:app|admin|v53-upgrades|v55-admin|v56-fixes)\.js[^"']*["']><\/script>\s*/g,'');
  if(!['offline.html'].includes(file))html=html.replace('</body>',`<script defer src="assets/${bundle}?v=${version}"></script></body>`);
  fs.writeFileSync(target, html);
}

console.log(`Vercel build ready: static files copied to dist/ (v${version})`);
