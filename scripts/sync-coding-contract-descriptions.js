const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ts = require('typescript');

const TARBALL_URL = 'https://api.github.com/repos/bitburner-official/bitburner-src/tarball/stable';
const execFileAsync = promisify(execFile);

function downloadToFile(url, filePath) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'bitburner-contracts-sync',
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

function buildEnumMap(definitionsPath) {
  const text = fs.readFileSync(definitionsPath, 'utf-8');
  const enumStart = text.indexOf('declare enum CodingContractName');
  if (enumStart === -1) {
    throw new Error('Failed to locate CodingContractName enum.');
  }
  const enumBody = text.slice(enumStart, text.indexOf('}', enumStart));
  const map = new Map();
  const lineRe = /([A-Za-z0-9_]+)\s*=\s*'([^']+)'/g;
  let match;
  while ((match = lineRe.exec(enumBody)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

function indentLines(text, indent) {
  const pad = ' '.repeat(indent);
  return text
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n');
}

function getPropertyNameText(node, source) {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  return node.getText(source);
}

function extractContractsFromFile(filePath, enumMap) {
  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const entries = [];
  const helperStatements = [];
  const helperNames = new Set();

  function maybeAddEntry(keyName, valueNode) {
    if (!keyName || !ts.isObjectLiteralExpression(valueNode)) {
      return;
    }
    let difficultyText = null;
    let descText = null;
    let descIsMethod = false;
    let answerText = null;
    let solverText = null;
    let answerIsMethod = false;
    let solverIsMethod = false;

    for (const prop of valueNode.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const nameText = getPropertyNameText(prop.name, source);
        if (nameText === 'difficulty') {
          difficultyText = prop.initializer.getText(source);
        } else if (nameText === 'desc') {
          descText = `desc: ${prop.initializer.getText(source)}`;
        } else if (nameText === 'getAnswer') {
          answerText = `getAnswer: ${prop.initializer.getText(source)}`;
        } else if (nameText === 'solver') {
          solverText = `solver: ${prop.initializer.getText(source)}`;
        }
      } else if (ts.isMethodDeclaration(prop)) {
        const nameText = getPropertyNameText(prop.name, source);
        if (nameText === 'desc') {
          descText = prop.getText(source);
          descIsMethod = true;
        } else if (nameText === 'getAnswer') {
          answerText = prop.getText(source);
          answerIsMethod = true;
        } else if (nameText === 'solver') {
          solverText = prop.getText(source);
          solverIsMethod = true;
        }
      }
    }

    if (!difficultyText || !descText) {
      return;
    }

    entries.push({
      name: keyName,
      difficultyText,
      descText,
      descIsMethod,
      answerText,
      solverText,
      answerIsMethod,
      solverIsMethod,
    });
  }

  function getEnumKeyName(node) {
    if (!ts.isComputedPropertyName(node)) {
      return null;
    }
    const expr = node.expression;
    if (ts.isPropertyAccessExpression(expr)) {
      if (expr.expression.getText(source) !== 'CodingContractName') {
        return null;
      }
      const member = expr.name.text;
      return enumMap.get(member) ?? member;
    }
    if (ts.isElementAccessExpression(expr)) {
      const target = expr.expression.getText(source);
      const arg = expr.argumentExpression;
      if (target !== 'CodingContractName' || !arg) {
        return null;
      }
      if (ts.isStringLiteral(arg)) {
        return enumMap.get(arg.text) ?? arg.text;
      }
    }
    return null;
  }

  function objectContainsContractKeys(objectLiteral) {
    for (const prop of objectLiteral.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const keyName = getEnumKeyName(prop.name);
      if (keyName) return true;
    }
    return false;
  }

  function collectHelpers() {
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportAssignment(statement)) {
        continue;
      }
      if (ts.isVariableStatement(statement)) {
        if (
          statement.declarationList.declarations.some(
            (decl) =>
              decl.initializer &&
              ts.isObjectLiteralExpression(decl.initializer) &&
              objectContainsContractKeys(decl.initializer),
          )
        ) {
          continue;
        }
        const names = [];
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            names.push(decl.name.text);
          }
        }
        if (names.length === 0) {
          continue;
        }
        if (names.every((name) => helperNames.has(name))) {
          continue;
        }
        names.forEach((name) => helperNames.add(name));
        helperStatements.push(statement.getText(source));
        continue;
      }
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        const name = statement.name.text;
        if (helperNames.has(name)) continue;
        helperNames.add(name);
        helperStatements.push(statement.getText(source));
        continue;
      }
      if (
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isEnumDeclaration(statement)
      ) {
        helperStatements.push(statement.getText(source));
      }
    }
  }

  function visit(node) {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
          continue;
        }
        for (const prop of declaration.initializer.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const keyName = getEnumKeyName(prop.name);
          maybeAddEntry(keyName, prop.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  collectHelpers();
  return { entries, helperStatements };
}

function buildModuleOutput(entries, helpers, exportName) {
  const lines = [];
  lines.push('/* eslint-disable */');
  lines.push('// @ts-nocheck');
  lines.push('export type CodingContractDescription = {');
  lines.push('  difficulty: number;');
  lines.push('  desc: (...args: any[]) => string;');
  lines.push('  getAnswer?: (...args: any[]) => any;');
  lines.push('  solver?: (...args: any[]) => boolean;');
  lines.push('};');
  lines.push('');
  lines.push('function exceptionAlert(_err: Error): void {}');
  lines.push('');
  for (const helper of helpers) {
    lines.push(helper);
    lines.push('');
  }
  lines.push(`export const ${exportName}: Record<string, CodingContractDescription> = {`);

  const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of sorted) {
    lines.push(`  ${JSON.stringify(entry.name)}: {`);
    lines.push(`    difficulty: ${entry.difficultyText},`);
    lines.push(indentLines(entry.descText + ',', 4));
    if (entry.answerText) {
      lines.push(indentLines(entry.answerText + ',', 4));
    }
    if (entry.solverText) {
      lines.push(indentLines(entry.solverText + ',', 4));
    }
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const definitionsPath = path.join(repoRoot, 'NetscriptDefinitions.d.ts');
  const enumMap = buildEnumMap(definitionsPath);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitburner-contracts-'));
  const tarPath = path.join(tempDir, 'bitburner-src.tar.gz');
  const contractsDir = path.join(tempDir, 'contracts');

  console.log('Downloading tarball...');
  await downloadToFile(TARBALL_URL, tarPath);

  console.log('Extracting contract sources...');
  await execFileAsync('tar', [
    '-xzf',
    tarPath,
    '-C',
    tempDir,
    '--strip-components=3',
    '--wildcards',
    '*/src/CodingContract/contracts/*.ts',
  ]);

  if (!fs.existsSync(contractsDir)) {
    throw new Error('Failed to extract contract sources.');
  }

  const modules = [];
  for (const file of fs.readdirSync(contractsDir)) {
    if (!file.endsWith('.ts')) continue;
    const filePath = path.join(contractsDir, file);
    const { entries: fileEntries, helperStatements: fileHelpers } = extractContractsFromFile(
      filePath,
      enumMap,
    );
    if (fileEntries.length === 0) {
      continue;
    }
    const baseName = path.basename(file, '.ts');
    const exportName = `CODING_CONTRACT_DESCRIPTIONS_${baseName.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
    const moduleText = buildModuleOutput(fileEntries, fileHelpers, exportName);
    modules.push({ baseName, exportName, moduleText });
  }

  const outputDir = path.join(repoRoot, 'bitburner', 'lib', 'coding-contracts');
  fs.mkdirSync(outputDir, { recursive: true });
  const descriptionsDir = path.join(outputDir, 'descriptions');
  fs.mkdirSync(descriptionsDir, { recursive: true });

  for (const mod of modules) {
    fs.writeFileSync(path.join(descriptionsDir, `${mod.baseName}.ts`), mod.moduleText, 'utf-8');
  }

  const indexLines = [];
  indexLines.push('/* eslint-disable */');
  indexLines.push('// @ts-nocheck');
  indexLines.push('export type CodingContractDescription = {');
  indexLines.push('  difficulty: number;');
  indexLines.push('  desc: (...args: any[]) => string;');
  indexLines.push('  getAnswer?: (...args: any[]) => any;');
  indexLines.push('  solver?: (...args: any[]) => boolean;');
  indexLines.push('};');
  for (const mod of modules) {
    indexLines.push(
      `import { ${mod.exportName} } from '/lib/coding-contracts/descriptions/${mod.baseName}';`,
    );
  }
  indexLines.push('');
  indexLines.push(
    'export const CODING_CONTRACT_DESCRIPTIONS: Record<string, CodingContractDescription> = {',
  );
  for (const mod of modules) {
    indexLines.push(`  ...${mod.exportName},`);
  }
  indexLines.push('};');
  indexLines.push('');
  fs.writeFileSync(path.join(outputDir, 'descriptions.ts'), indexLines.join('\n'), 'utf-8');

  const totalEntries = modules.reduce((sum, mod) => {
    const count = (mod.moduleText.match(/difficulty:/g) || []).length;
    return sum + count;
  }, 0);
  console.log(`Wrote ${totalEntries} contract descriptions in ${modules.length} modules.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
