#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const [binDir, extensionName, version, extId, codeBin, testWorkspace] = process.argv.slice(2);
const counterFile = path.join(binDir, '.local_build_counter');

console.log('========================================');
console.log('Starting Local Test Setup...');
console.log('========================================\n');

// [1/5] Create counter
console.log('[1/5] Creating local build counter...');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

let count = 0;
if (fs.existsSync(counterFile)) {
  count = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10) || 0;
}
count++;
fs.writeFileSync(counterFile, count.toString(), 'utf8');

const localVsix = path.join(binDir, `${extensionName}-${version}-local-${count}.vsix`);

// [2/5] Package
console.log(`[2/5] Packaging to ${localVsix}...`);
console.log('Updating version badge in README.md...');
let readme = fs.readFileSync('README.md', 'utf8');
readme = readme.replace(/!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]*\)/, 
  `![Version](https://img.shields.io/badge/version-${version}.local.${count}-blue.svg)`);
fs.writeFileSync('README.md', readme);

console.log('Backing up package.json...');
const pkgBackup = fs.readFileSync('package.json', 'utf8');
const pkg = JSON.parse(pkgBackup);
const originalDisplayName = pkg.displayName;

console.log('Modifying displayName for local build...');
pkg.displayName = `${originalDisplayName} [LOCAL-${count}]`;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

try {
  execSync(`npx vsce package -o "${localVsix}"`, { stdio: 'inherit' });
} catch (error) {
  console.error('Packaging failed!');
  fs.writeFileSync('package.json', pkgBackup);
  readme = readme.replace(/!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]*\)/, 
    `![Version](https://img.shields.io/badge/version-${version}-blue.svg)`);
  fs.writeFileSync('README.md', readme);
  process.exit(1);
}

console.log('Restoring package.json...');
fs.writeFileSync('package.json', pkgBackup);

console.log('Restoring README.md...');
readme = readme.replace(/!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]*\)/, 
  `![Version](https://img.shields.io/badge/version-${version}-blue.svg)`);
fs.writeFileSync('README.md', readme);

// [3/5] Uninstall
console.log('\n[3/5] Uninstalling existing extension...');
try {
  execSync(`${codeBin} --uninstall-extension ${extId}`, { stdio: 'pipe' });
} catch {
  console.log('Extension not installed or already removed');
}

// [4/5] Install
console.log('\n[4/5] Installing new extension...');
execSync(`${codeBin} --install-extension "${localVsix}" --force`, { stdio: 'inherit' });

// [5/5] Open
console.log('\n[5/5] Opening VS Code...');
execSync(`${codeBin} "${testWorkspace}"`, { stdio: 'inherit', detached: true });

console.log('\n✅ Test setup complete!');
