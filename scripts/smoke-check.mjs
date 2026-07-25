import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

const targetArg = process.argv[2];
const target = targetArg === 'firefox' ? 'firefox' : 'chromium';
const rootDir = process.cwd();
const distDir = join(rootDir, 'dist');
const distManifestPath = join(distDir, 'manifest.json');
const sourceManifestPath = join(rootDir, target, 'manifest.json');
const manifestPath = existsSync(distManifestPath) ? distManifestPath : sourceManifestPath;

if (!existsSync(distDir)) {
  throw new Error('dist directory is missing. Run `npm run build` first.');
}

if (!existsSync(manifestPath)) {
  throw new Error(`Could not find a manifest for target ${target}. Looked for ${manifestPath}.`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const problems = [];
const checks = [];

function cleanRelativePath(file) {
  return String(file).replace(/^\.\//, '').replace(/^\//, '');
}

function recordCheck(label, file) {
  checks.push(`- ${label}: ${file}`);
}

function recordProblem(problem) {
  problems.push(`- ${problem}`);
}

function ensureFile(file, label) {
  const relativeFile = cleanRelativePath(file);
  const fullPath = join(distDir, relativeFile);
  if (!existsSync(fullPath)) {
    recordProblem(`${label} is missing from dist (${relativeFile})`);
    return;
  }

  const size = statSync(fullPath).size;
  recordCheck(label, `${relativeFile} (${size} bytes)`);
}

function ensureGlob(resource, label) {
  const normalized = cleanRelativePath(resource);
  const baseDir = normalized.slice(0, -2);
  const fullDir = join(distDir, baseDir);

  if (!existsSync(fullDir)) {
    recordProblem(`${label} directory is missing from dist (${baseDir})`);
    return;
  }

  const entries = readdirSync(fullDir);
  if (entries.length === 0) {
    recordProblem(`${label} directory is empty (${baseDir})`);
    return;
  }

  recordCheck(label, `${baseDir} (${entries.length} files)`);
}

function ensureResource(resource, label) {
  if (resource.endsWith('/*')) {
    ensureGlob(resource, label);
    return;
  }

  ensureFile(resource, label);
}

function ensureIcons(iconSet, label) {
  if (!iconSet || typeof iconSet !== 'object') return;
  for (const [size, file] of Object.entries(iconSet)) {
    ensureResource(file, `${label} ${size}`);
  }
}

if (![2, 3].includes(manifest.manifest_version)) {
  recordProblem(`unsupported manifest_version ${manifest.manifest_version}`);
} else {
  recordCheck('manifest version', String(manifest.manifest_version));
}

if (manifest.background?.service_worker) {
  ensureResource(manifest.background.service_worker, 'background service worker');
}

if (Array.isArray(manifest.background?.scripts)) {
  for (const file of manifest.background.scripts) {
    ensureResource(file, 'background script');
  }
}

if (manifest.options_ui?.page) {
  ensureResource(manifest.options_ui.page, 'options page');
}

ensureIcons(manifest.action?.default_icon, 'action icon');
ensureIcons(manifest.browser_action?.default_icon, 'browser action icon');
ensureIcons(manifest.icons, 'manifest icon');

if (Array.isArray(manifest.content_scripts)) {
  manifest.content_scripts.forEach((entry, index) => {
    for (const js of entry.js || []) {
      ensureResource(js, `content script ${index + 1} JS`);
    }
    for (const css of entry.css || []) {
      ensureResource(css, `content script ${index + 1} CSS`);
    }
  });
}

const webAccessible = manifest.web_accessible_resources;
if (Array.isArray(webAccessible)) {
  if (manifest.manifest_version === 3) {
    webAccessible.forEach((entry, index) => {
      const resources = Array.isArray(entry.resources) ? entry.resources : [];
      resources.forEach((resource) => ensureResource(resource, `web accessible resource ${index + 1}`));
    });
  } else {
    webAccessible.forEach((resource, index) => ensureResource(resource, `web accessible resource ${index + 1}`));
  }
}

const criticalBundles = [
  'background.js',
  'contentScript.js',
  'contentScript.css',
  'contentMain.js',
  'embeddedUI.js',
  'captureDock.js',
  'saveNotificationToast.js',
  'main.js',
  'options.js',
];

criticalBundles.forEach((file) => ensureFile(file, 'critical bundle'));

console.log(`\nExtension smoke report (${target})`);
console.log(`- dist: ${normalize(distDir)}`);
console.log(`- manifest: ${normalize(manifestPath)}${manifestPath === sourceManifestPath ? ' (source manifest fallback)' : ''}`);

for (const check of checks) {
  console.log(check);
}

if (problems.length > 0) {
  console.error('\nSmoke check failed:');
  for (const problem of problems) {
    console.error(problem);
  }
  process.exitCode = 1;
} else {
  console.log('\nSmoke check passed. Dist assets and manifest references are aligned.');
}
