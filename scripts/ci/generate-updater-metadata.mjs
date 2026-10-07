#!/usr/bin/env node
/**
 * Writes latest-mac.yml or latest.yml for electron-updater (GitHub release provider).
 * Asset file names in the YAML must match files uploaded to the same release tag.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(`Usage:
  node scripts/ci/generate-updater-metadata.mjs --platform mac|win --artifact <path> [--publish-name <filename>] [--out-dir <dir>]
`);
  process.exit(1);
}

function readArg(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const platform = readArg('platform');
const artifactPath = readArg('artifact');
const publishName = readArg('publish-name');
const outDir = readArg('out-dir');

if (!platform || !artifactPath || (platform !== 'mac' && platform !== 'win')) {
  usage();
}

const resolvedArtifact = path.resolve(artifactPath);
if (!fs.existsSync(resolvedArtifact)) {
  console.error(`Artifact not found: ${resolvedArtifact}`);
  process.exit(1);
}

const pkgPath = path.resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

const buffer = fs.readFileSync(resolvedArtifact);
const sha512 = crypto.createHash('sha512').update(buffer).digest('base64');
const size = buffer.length;
const fileName = publishName || path.basename(resolvedArtifact);
const releaseDate = new Date().toISOString();
const channelFile = platform === 'mac' ? 'latest-mac.yml' : 'latest.yml';

const yaml = [
  `version: ${version}`,
  'files:',
  `  - url: ${fileName}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${fileName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${releaseDate}'`,
  '',
].join('\n');

const destinationDir = path.resolve(outDir || path.dirname(resolvedArtifact));
fs.mkdirSync(destinationDir, { recursive: true });
const metadataPath = path.join(destinationDir, channelFile);
fs.writeFileSync(metadataPath, yaml, 'utf8');

console.log(`Wrote ${metadataPath}`);
console.log(`  version=${version} asset=${fileName} size=${size}`);
