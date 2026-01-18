const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const TARBALL_URL = 'https://api.github.com/repos/bitburner-official/bitburner-src/tarball/stable';

const execFileAsync = promisify(execFile);

function downloadToFile(url, filePath) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'bitburner-docs-sync',
            Accept: 'application/vnd.github+json',
          },
        },
        (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            downloadToFile(res.headers.location, filePath).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Request failed (${res.statusCode}): ${url}`));
            res.resume();
            return;
          }
          const fileStream = fs.createWriteStream(filePath);
          res.pipe(fileStream);
          fileStream.on('finish', () => fileStream.close(resolve));
          fileStream.on('error', reject);
        },
      )
      .on('error', reject);
  });
}

function buildIndex(indexText) {
  const linkRe = /\[([^\]]+)\]\((?:\.\/)?(bitburner\.ns\.[^)]+\.md)\)/g;
  const mapping = {};
  let match;
  while ((match = linkRe.exec(indexText)) !== null) {
    const label = match[1].trim();
    const file = match[2].trim();
    if (!mapping[label]) {
      mapping[label] = file;
    }
  }
  const sorted = Object.keys(mapping)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = mapping[key];
      return acc;
    }, {});
  return sorted;
}

async function main() {
  const targetDir = path.join(__dirname, '..', 'docs', 'bitburner');
  fs.mkdirSync(targetDir, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitburner-docs-'));
  const tarPath = path.join(tempDir, 'bitburner-src.tar.gz');

  console.log('Downloading tarball...');
  await downloadToFile(TARBALL_URL, tarPath);

  console.log('Extracting markdown...');
  await execFileAsync('tar', [
    '-xzf',
    tarPath,
    '-C',
    targetDir,
    '--strip-components=2',
    '--wildcards',
    '*/markdown/*',
  ]);

  const indexText = fs.readFileSync(path.join(targetDir, 'bitburner.ns.md'), 'utf-8');
  const index = buildIndex(indexText);
  fs.writeFileSync(path.join(targetDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

  fs.writeFileSync(
    path.join(targetDir, 'README.txt'),
    [
      'Bitburner Netscript docs subset.',
      'Source: https://github.com/bitburner-official/bitburner-src (stable).',
      'Files included: markdown/*.md from the stable tarball.',
    ].join('\n') + '\n',
    'utf-8',
  );

  console.log('Synced markdown files.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
