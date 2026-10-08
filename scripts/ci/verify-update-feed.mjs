#!/usr/bin/env node
/**
 * Fetches latest-mac.yml from the public desktop-latest release and validates it.
 */
const FEED_BASE =
  process.env.FLEXHUBS_UPDATE_FEED_URL?.trim() ||
  'https://github.com/rutuja0711/flexhubs/releases/download/desktop-latest';
const METADATA_URL = `${FEED_BASE.replace(/\/$/, '')}/latest-mac.yml`;

async function main() {
  const response = await fetch(METADATA_URL, { redirect: 'follow' });
  if (!response.ok) {
    console.error(`Failed to fetch ${METADATA_URL}: HTTP ${response.status}`);
    process.exit(1);
  }

  const text = await response.text();
  const versionMatch = text.match(/^version:\s*(.+)$/m);
  const pathMatch = text.match(/^path:\s*(.+)$/m);
  const shaMatch = text.match(/^sha512:\s*(.+)$/m);

  if (!versionMatch || !pathMatch || !shaMatch) {
    console.error('latest-mac.yml is missing version, path, or sha512');
    process.exit(1);
  }

  const version = versionMatch[1].trim();
  const assetName = pathMatch[1].trim();
  const assetUrl = `${FEED_BASE.replace(/\/$/, '')}/${assetName}`;

  const assetResponse = await fetch(assetUrl, { method: 'HEAD', redirect: 'follow' });
  if (!assetResponse.ok) {
    console.error(`Update zip not reachable: ${assetUrl} (HTTP ${assetResponse.status})`);
    process.exit(1);
  }

  console.log('Update feed OK');
  console.log(`  metadata: ${METADATA_URL}`);
  console.log(`  version:  ${version}`);
  console.log(`  asset:    ${assetUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
