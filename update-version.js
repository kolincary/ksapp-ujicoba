#!/usr/bin/env node

/**
 * Auto Version Updater
 * 
 * This script automatically updates version.json before each build/deploy.
 * Add this to your package.json build script:
 * 
 * "scripts": {
 *   "prebuild": "node update-version.js",
 *   "build": "vite build"
 * }
 * 
 * Or for Netlify, add to netlify.toml:
 * [build]
 *   command = "node update-version.js && npm run build"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, 'public', 'version.json');

try {
    // Read current version
    const currentVersion = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));

    // Increment patch version (1.0.1 -> 1.0.2)
    const versionParts = currentVersion.version.split('.');
    versionParts[2] = parseInt(versionParts[2]) + 1;
    const newVersion = versionParts.join('.');

    // Update with new version and timestamp
    const updatedVersion = {
        version: newVersion,
        build_timestamp: new Date().toISOString()
    };

    // Write back to file
    fs.writeFileSync(versionFilePath, JSON.stringify(updatedVersion, null, 2) + '\n');

    console.log(`✅ Version updated: ${currentVersion.version} → ${newVersion}`);
    console.log(`📅 Build timestamp: ${updatedVersion.build_timestamp}`);
} catch (error) {
    console.error('❌ Failed to update version:', error);
    process.exit(1);
}
