/* eslint-env node */
/* global console, process */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const packageJsonPath = path.join(repoRoot, 'package.json');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

if (!fs.existsSync(packageJsonPath)) {
  console.error(`::error::Missing package.json at ${packageJsonPath}`);
  process.exit(1);
}

if (!fs.existsSync(changelogPath)) {
  console.error(`::error::Missing CHANGELOG.md at ${changelogPath}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = String(pkg.version || '').trim();

if (!version) {
  console.error('::error::package.json does not contain a valid "version" field');
  process.exit(1);
}

const changelog = fs.readFileSync(changelogPath, 'utf8');
const expectedHeadingPrefix = `## [${version}] - `;

if (!changelog.includes(expectedHeadingPrefix)) {
  console.error('::error::Release notes missing in CHANGELOG.md');
  console.error(`Expected CHANGELOG.md to contain a heading like: ${expectedHeadingPrefix}YYYY-MM-DD`);
  process.exit(1);
}

console.log(`✅ CHANGELOG.md contains release heading for v${version}`);
