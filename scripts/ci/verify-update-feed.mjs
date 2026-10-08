#!/usr/bin/env node
/**
 * Fetches latest-mac.yml from the public desktop-latest release and validates it.
 */
const FEED_BASE =
  process.env.FLEXHUBS_UPDATE_FEED_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/download/desktop-latest';
const METADATA_URL = `${FEED_BASE.replace(/\/$/, '')}/latest-mac.yml`;

function verifyYamlText(text, label) {
  const versionMatch = text.match(/^version:\s*(.+)$/m);
  const pathMatch = text.match(/^path:\s*(.+)$/m);
  const shaMatch = text.match(/^sha512:\s*(.+)$/m);

  if (!versionMatch || !pathMatch || !shaMatch) {
    console.error(`${label} is missing version, path, or sha512`);
    process.exit(1);
  }

  console.log('Update metadata OK');
  console.log(`  source:   ${label}`);
  console.log(`  version:  ${versionMatch[1].trim()}`);
  console.log(`  asset:    ${pathMatch[1].trim()}`);
}

async function main() {
  const localPath = process.argv.includes('--local')
    ? process.argv[process.argv.indexOf('--local') + 1]
    : null;

  if (localPath) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const resolved = path.resolve(localPath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    verifyYamlText(fs.readFileSync(resolved, 'utf8'), resolved);
    console.log('');
    console.log(
      'Note: This only checks your local yml. Installed apps still need a PUBLIC URL (see below).',
    );
    return;
  }

  const response = await fetch(METADATA_URL, { redirect: 'follow' });
  if (!response.ok) {
    console.error(`Failed to fetch ${METADATA_URL}: HTTP ${response.status}`);
    console.error('');
    console.error('Common causes:');
    console.error('  • GitHub repo is PRIVATE — release files are not public; auto-update will 404 for users.');
    console.error('    Fix: make the repo public, or host latest-mac.yml + zip on a public URL.');
    console.error('  • Release is still a DRAFT, or tag is not exactly desktop-latest.');
    console.error('  • latest-mac.yml was not uploaded to that release.');
    console.error('');
    console.error('Test in a private/incognito browser (not logged into GitHub):');
    console.error(`  ${METADATA_URL}`);
    console.error('');
    console.error('Validate local build output instead:');
    console.error('  node scripts/ci/verify-update-feed.mjs --local out/release/latest-mac.yml');
    process.exit(1);
  }

  const text = await response.text();
  verifyYamlText(text, METADATA_URL);

  const pathMatch = text.match(/^path:\s*(.+)$/m);
  const assetName = pathMatch[1].trim();
  const assetUrl = `${FEED_BASE.replace(/\/$/, '')}/${assetName}`;

  const assetResponse = await fetch(assetUrl, { method: 'HEAD', redirect: 'follow' });
  if (!assetResponse.ok) {
    console.error(`Update zip not reachable: ${assetUrl} (HTTP ${assetResponse.status})`);
    process.exit(1);
  }

  console.log(`  zip URL:  ${assetUrl}`);

  if (process.argv.includes('--verify-sha512')) {
    const crypto = await import('node:crypto');
    const shaMatch = text.match(/^sha512:\s*(.+)$/m);
    if (!shaMatch) {
      console.error('latest-mac.yml is missing sha512');
      process.exit(1);
    }
    const expectedSha512 = shaMatch[1].trim();
    console.log('');
    console.log('Verifying asset sha512 (full download)...');
    const bodyResponse = await fetch(assetUrl, { redirect: 'follow' });
    if (!bodyResponse.ok) {
      console.error(`Failed to download asset: HTTP ${bodyResponse.status}`);
      process.exit(1);
    }
    const buffer = Buffer.from(await bodyResponse.arrayBuffer());
    const actualSha512 = crypto.createHash('sha512').update(buffer).digest('base64');
    if (actualSha512 !== expectedSha512) {
      console.error('sha512 mismatch — latest-mac.yml does not match the uploaded zip.');
      console.error(`  expected: ${expectedSha512}`);
      console.error(`  actual:   ${actualSha512}`);
      process.exit(1);
    }
    console.log(`  sha512:   OK (${buffer.length} bytes)`);
  }

  console.log('');
  console.log('Update feed OK (public download works).');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
