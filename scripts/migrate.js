#!/usr/bin/env node
/**
 * Migration script: Extract individual RFC JSON files from the
 * existing rfcs-*.js bundle files.
 *
 * Usage: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'site', 'data');
const RFCS_DIR = path.join(DATA_DIR, 'rfcs');
const BUNDLE_FILES = ['rfcs-1.js', 'rfcs-2.js', 'rfcs-3.js', 'rfcs-4.js'];

// Create mock window for loading existing data files
global.window = { RFC_DATA: [] };

// Load each existing data file
for (const file of BUNDLE_FILES) {
  const filePath = path.join(DATA_DIR, file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading ${file}...`);
    const code = fs.readFileSync(filePath, 'utf-8');
    // Execute in the global context so window.RFC_DATA.push() works
    const fn = new Function(code);
    fn();
  }
}

const allRfcs = global.window.RFC_DATA;
console.log(`\nLoaded ${allRfcs.length} RFCs total`);

// De-duplicate: keep last occurrence (which is the featured version if any)
const seen = new Map();
for (const rfc of allRfcs) {
  // If we already have a featured version, don't overwrite with basic
  if (seen.has(rfc.number)) {
    const existing = seen.get(rfc.number);
    if (existing.featured && !rfc.featured) continue;
  }
  seen.set(rfc.number, rfc);
}

const uniqueRfcs = Array.from(seen.values());
console.log(`${uniqueRfcs.length} unique RFCs after deduplication`);

// Create output directory
if (!fs.existsSync(RFCS_DIR)) {
  fs.mkdirSync(RFCS_DIR, { recursive: true });
}

// Write each RFC as individual JSON file
let featuredCount = 0;
let basicCount = 0;

for (const rfc of uniqueRfcs) {
  const paddedNum = String(rfc.number).padStart(4, '0');
  const outPath = path.join(RFCS_DIR, `${paddedNum}.json`);
  fs.writeFileSync(outPath, JSON.stringify(rfc, null, 2) + '\n');

  if (rfc.featured) {
    featuredCount++;
  } else {
    basicCount++;
  }
}

console.log(`\nWrote ${uniqueRfcs.length} individual RFC files to ${RFCS_DIR}/`);
console.log(`  Featured: ${featuredCount}`);
console.log(`  Basic: ${basicCount}`);

// Remove old bundle files
for (const file of BUNDLE_FILES) {
  const filePath = path.join(DATA_DIR, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Removed old ${file}`);
  }
}

console.log('\nMigration complete! Run "node scripts/build.js" to generate the bundle.');
