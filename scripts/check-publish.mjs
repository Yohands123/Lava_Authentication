import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

// Validate the actual Git publication, without reading ignored study datasets.
const root = process.cwd();
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];
const forbidden = /(^|\/)(\.dev\.vars(?:\..*)?|\.env(?:\..*)?|\.wrangler|node_modules|dist|\.venv|private|raw|normalized|__pycache__)(\/|$)|\.(?:pem|key|pfx|p12|sqlite|db|csv|parquet|jsonl|tar\.gz|zip)$/i;
for (const file of files) if (forbidden.test(file)) failures.push(`Excluded/private path would be published: ${file}`);
const credentials = [
  ['private key', /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['provider token', /(?:sk-(?:proj-|live-)?[A-Za-z0-9_-]{25,}|xox[baprs]-[A-Za-z0-9-]{20,})/],
  ['credential URL', /https?:\/\/[^\s/:]+:[^\s/@]{8,}@/],
];
let scannedTextFiles = 0;
for (const file of files) {
  const bytes = await readFile(file);
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8'); scannedTextFiles++;
  for (const [kind, pattern] of credentials) if (pattern.test(text)) failures.push(`${kind} pattern requires review: ${file}`);
  if (file.endsWith('.json')) {
    try { JSON.parse(text); } catch { failures.push(`Invalid UTF-8 JSON: ${file}`); }
  }
}

const withoutFences = text => text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
const slug = text => text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '').replace(/ /g, '-');
async function anchors(file) {
  const text = withoutFences(await readFile(file, 'utf8'));
  const ids = new Set([...text.matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["']/g)].map(m => m[1]));
  const counts = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)) {
    const base = slug(match[1]), count = counts.get(base) ?? 0;
    counts.set(base, count + 1); ids.add(base + (count ? `-${count}` : ''));
  }
  return ids;
}
async function exactPath(file) {
  const name = relative(root, file);
  if (name.startsWith('..' + sep) || isAbsolute(name)) return false;
  let current = root;
  for (const part of name.split(sep)) {
    if (!(await readdir(current)).includes(part)) return false;
    current = resolve(current, part);
  }
  return true;
}
let checkedLinks = 0;
for (const file of files.filter(f => f.endsWith('.md'))) {
  const text = withoutFences(await readFile(file, 'utf8'));
  const links = [...text.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+["'][^)]*)?\)/g)].map(m => m[1]);
  links.push(...[...text.matchAll(/<(?:img|a)\b[^>]*\b(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]));
  for (let link of links) {
    if (/^(?:https?:|mailto:|data:)/i.test(link)) continue;
    link = link.replace(/^<|>$/g, '');
    const [path, fragment] = link.split('#');
    const target = path ? resolve(dirname(resolve(root, file)), decodeURIComponent(path)) : resolve(root, file);
    checkedLinks++;
    try {
      if (!await exactPath(target)) throw new Error('missing file or case mismatch');
      if (fragment && target.endsWith('.md') && !(await anchors(target)).has(decodeURIComponent(fragment))) throw new Error('missing heading/anchor');
    } catch (error) { failures.push(`${file}: ${link}: ${error.message}`); }
  }
}
const required = ['docs/media/clear-the-ring.png', 'docs/media/ring-cleared.png',
  ...['clear-390', 'flag-390', 'block-390', 'after-landing-desktop', 'after-stir-desktop', 'real-clear-desktop'].map(n => `docs/media/lavaguard/${n}.png`)];
for (const file of required) {
  try {
    if (!files.includes(file)) throw new Error('not included in publication');
    const png = await readFile(file);
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || !png.readUInt32BE(16) || !png.readUInt32BE(20)) throw new Error('invalid PNG');
  } catch (error) { failures.push(`${file}: ${error.message}`); }
}
console.log(JSON.stringify({ filesReviewed: files.length, scannedTextFiles, localLinksChecked: checkedLinks, requiredScreenshots: required.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
