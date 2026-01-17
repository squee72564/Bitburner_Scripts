const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const BASE_API =
  'https://api.github.com/repos/bitburner-official/bitburner-src/contents/markdown?ref=stable';
const RAW_BASE =
  'https://raw.githubusercontent.com/bitburner-official/bitburner-src/stable/markdown';

function fetch(url) {
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
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Request failed (${res.statusCode}): ${url}`));
              return;
            }
            resolve(data);
          });
        },
      )
      .on('error', reject);
  });
}

async function fetchJson(url) {
  const text = await fetch(url);
  return JSON.parse(text);
}

async function fetchText(url) {
  return fetch(url);
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

  const items = await fetchJson(BASE_API);
  const markdownFiles = items
    .filter((item) => item.type === 'file' && item.name.endsWith('.md'))
    .map((item) => item.name);

  for (const [index, name] of markdownFiles.entries()) {
    console.log(`Downloading ${index + 1}/${markdownFiles.length}: ${name}`);
    const text = await fetchText(`${RAW_BASE}/${name}`);
    fs.writeFileSync(path.join(targetDir, name), text, 'utf-8');
  }

  const indexText = await fetchText(`${RAW_BASE}/bitburner.ns.md`);
  const index = buildIndex(indexText);
  fs.writeFileSync(path.join(targetDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');

  fs.writeFileSync(
    path.join(targetDir, 'README.txt'),
    [
      'Bitburner Netscript docs subset.',
      'Source: https://github.com/bitburner-official/bitburner-src (stable).',
      'Files included: bitburner.ns.md and bitburner.ns.*.md',
    ].join('\n') + '\n',
    'utf-8',
  );

  console.log(`Synced ${markdownFiles.length} files.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
