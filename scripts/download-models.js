/**
 * Download @imgly/background-removal models for local bundling
 * Run this script before build to bundle models locally
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public', 'models');

// Get the version from the installed package
async function getPackageVersion() {
  const pkgPath = join(__dirname, '..', 'node_modules', '@imgly', 'background-removal', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

// Base URL pattern for the CDN
function getBaseUrl(version) {
  return `https://staticimgly.com/@imgly/background-removal-data/${version}/dist`;
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const dir = dirname(destPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(destPath, Buffer.from(buffer));
  return buffer.byteLength;
}

async function main() {
  console.log('Downloading background removal models...');

  const version = await getPackageVersion();
  const baseUrl = getBaseUrl(version);

  console.log(`Package version: ${version}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Target directory: ${PUBLIC_DIR}`);

  if (!existsSync(PUBLIC_DIR)) {
    mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  // Download resources.json first
  console.log('\nDownloading resources.json...');
  const resourcesUrl = `${baseUrl}/resources.json`;
  const resourcesPath = join(PUBLIC_DIR, 'resources.json');

  try {
    await downloadFile(resourcesUrl, resourcesPath);
    console.log('  ✓ resources.json');
  } catch (error) {
    console.error(`  ✗ Failed to download resources.json: ${error.message}`);
    process.exit(1);
  }

  // Parse resources.json to get all chunks
  const resources = JSON.parse(readFileSync(resourcesPath, 'utf-8'));
  const allChunks = new Set();

  for (const [path, resource] of Object.entries(resources)) {
    if (resource.chunks) {
      for (const chunk of resource.chunks) {
        allChunks.add(chunk.hash);
      }
    }
  }

  console.log(`\nFound ${allChunks.size} chunks to download...`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let totalBytes = 0;

  for (const hash of allChunks) {
    // Chunks are directly in the dist folder, not in a chunks subfolder
    const chunkUrl = `${baseUrl}/${hash}`;
    const chunkPath = join(PUBLIC_DIR, hash);

    if (existsSync(chunkPath)) {
      console.log(`  ⊘ ${hash.substring(0, 16)}... (exists)`);
      skipped++;
      continue;
    }

    try {
      const size = await downloadFile(chunkUrl, chunkPath);
      totalBytes += size;
      downloaded++;
      console.log(`  ✓ ${hash.substring(0, 16)}... (${(size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error) {
      failed++;
      console.error(`  ✗ ${hash.substring(0, 16)}... (${error.message})`);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Downloaded: ${downloaded} new chunks`);
  console.log(`Skipped: ${skipped} existing chunks`);
  console.log(`Total new size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  if (failed > 0) {
    console.log(`Failed: ${failed} chunks`);
  }
  console.log('Model download complete!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
