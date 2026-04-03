import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const budgets = [
  { label: 'popup main', file: 'main.js', maxBytes: 250 * 1024 },
  { label: 'content script', file: 'contentScript.js', maxBytes: 250 * 1024 },
  { label: 'embedded UI', file: 'embeddedUI.js', maxBytes: 3 * 1024 * 1024 },
  { label: 'background', file: 'background.js', maxBytes: 100 * 1024 },
];

const formatKb = (bytes) => `${(bytes / 1024).toFixed(2)} kB`;
const problems = [];

console.log('\nExtension bundle report');
for (const budget of budgets) {
  const filePath = join(distDir, budget.file);
  const file = readFileSync(filePath);
  const rawBytes = statSync(filePath).size;
  const gzipBytes = gzipSync(file).length;
  const status = rawBytes > budget.maxBytes ? 'OVER' : 'OK';

  console.log(`- ${budget.label}: ${formatKb(rawBytes)} raw / ${formatKb(gzipBytes)} gzip (${status}, budget ${formatKb(budget.maxBytes)})`);

  if (rawBytes > budget.maxBytes) {
    problems.push(`${budget.label} exceeds budget by ${formatKb(rawBytes - budget.maxBytes)}`);
  }
}

if (problems.length > 0) {
  console.warn('\nBundle budget warnings:');
  for (const problem of problems) {
    console.warn(`- ${problem}`);
  }
}