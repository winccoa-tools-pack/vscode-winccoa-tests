/* eslint-env node */
/* global console, process */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function todayIsoDate() {
  const d = new Date();
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseArgs(argv) {
  const args = new Set(argv);
  const getValue = (flag) => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return undefined;
    return argv[idx + 1];
  };

  return {
    write: args.has('--write'),
    fromTag: getValue('--from-tag'),
    date: getValue('--date'),
  };
}

function getStableTags() {
  // Only stable SemVer tags like v2.3.1 (no suffix)
  const out = runGit(['tag', '--list', 'v[0-9]*.[0-9]*.[0-9]*', '--sort=version:refname']);
  return out ? out.split(/\r?\n/).map((t) => t.trim()).filter(Boolean) : [];
}

function getCommitSubjects(range) {
  const args = ['log', '--no-decorate', '--pretty=%s'];
  if (range) args.push(range);
  const out = runGit(args);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isNoiseSubject(subject) {
  if (subject.startsWith('Merge ')) return true;
  if (subject.startsWith('chore(release):')) return true;
  return false;
}

function categorize(subject) {
  // Conventional commits: type(scope)!: subject
  const match = /^(?<type>[a-z]+)(\([^\r\n()]+\))?(!)?:\s+(?<msg>.+)$/.exec(subject);
  const type = match?.groups?.type;
  const msg = match?.groups?.msg ?? subject;

  switch (type) {
    case 'feat':
      return { section: 'Added', text: msg };
    case 'fix':
      return { section: 'Fixed', text: msg };
    case 'perf':
    case 'refactor':
      return { section: 'Changed', text: msg };
    case 'docs':
    case 'build':
    case 'ci':
    case 'test':
    case 'style':
    case 'chore':
    case 'revert':
    case 'deps':
    case 'deps-dev':
      return { section: 'Changed', text: msg };
    default:
      return { section: 'Changed', text: subject };
  }
}

function renderEntry({ version, date, itemsBySection }) {
  const sectionsOrder = ['Added', 'Fixed', 'Changed'];
  const lines = [];

  lines.push(`## [${version}] - ${date}`);
  lines.push('');

  let any = false;
  for (const section of sectionsOrder) {
    const items = itemsBySection.get(section) ?? [];
    if (items.length === 0) continue;
    any = true;
    lines.push(`### ${section}`);
    lines.push('');
    for (const item of items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  if (!any) {
    lines.push('### Changed');
    lines.push('');
    lines.push('- Maintenance release');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function insertIntoChangelog(changelogContent, entryMarkdown) {
  const firstHeadingIdx = changelogContent.indexOf('\n## [');
  if (firstHeadingIdx === -1) {
    return `${changelogContent.trimEnd()}\n\n${entryMarkdown}\n`;
  }

  const before = changelogContent.slice(0, firstHeadingIdx + 1); // keep leading newline
  const after = changelogContent.slice(firstHeadingIdx + 1);
  return `${before}${entryMarkdown}\n\n${after}`;
}

const { write, fromTag, date: dateArg } = parseArgs(process.argv.slice(2));

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
const alreadyExists = changelog.includes(expectedHeadingPrefix);

let startTag = fromTag;
if (!startTag) {
  const stableTags = getStableTags().filter((t) => t !== `v${version}`);
  startTag = stableTags.length > 0 ? stableTags[stableTags.length - 1] : undefined;
}

const range = startTag ? `${startTag}..HEAD` : undefined;
const subjects = getCommitSubjects(range)
  .filter((s) => !isNoiseSubject(s));

const itemsBySection = new Map([
  ['Added', []],
  ['Fixed', []],
  ['Changed', []],
]);

for (const subject of subjects) {
  const { section, text } = categorize(subject);
  itemsBySection.get(section)?.push(text);
}

const entry = renderEntry({ version, date: dateArg ?? todayIsoDate(), itemsBySection });

process.stdout.write(entry + '\n');

if (!write) {
  process.exit(0);
}

if (alreadyExists) {
  console.error(`CHANGELOG already contains heading for v${version}; skipping write.`);
  process.exit(0);
}

const updated = insertIntoChangelog(changelog, entry);
fs.writeFileSync(changelogPath, updated, 'utf8');
console.error(`✅ Inserted changelog entry for v${version} into CHANGELOG.md`);
