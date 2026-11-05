#!/usr/bin/env node

/**
 * Sync secrets from local .env.local directly to Firebase App Hosting / Secret Manager.
 * Reads local credentials securely; NEVER prints or logs secret values.
 *
 * Usage:
 *   node scripts/sync-firebase-secrets.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const envFile = path.join(root, '.env.local');

if (!fs.existsSync(envFile)) {
  console.error('Error: .env.local file not found at', envFile);
  process.exit(1);
}

// Parse .env.local
const config = {};
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) {
    config[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const projectId = config.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'nativeyard-nj';

const SECRETS_TO_SYNC = [
  { envKey: 'GEMINI_API_KEY', secretName: 'geminiApiKey' },
  { envKey: 'PLANTNET_API_KEY', secretName: 'plantnetApiKey' },
];

async function setSecret(secretName, secretValue) {
  return new Promise((resolve, reject) => {
    console.log(`Setting secret "${secretName}" for project "${projectId}"...`);

    const child = spawn(
      'npx',
      [
        '-y',
        'firebase-tools',
        'apphosting:secrets:set',
        secretName,
        '--project',
        projectId,
        '--force',
        '--data-file',
        '-',
      ],
      {
        stdio: ['pipe', 'inherit', 'inherit'],
      }
    );

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });

    // Write secret to stdin and close pipe
    child.stdin.write(secretValue);
    child.stdin.end();
  });
}

async function grantAccess(secretName) {
  return new Promise((resolve) => {
    console.log(`Granting App Hosting access for "${secretName}"...`);
    const child = spawn(
      'npx',
      [
        '-y',
        'firebase-tools',
        'apphosting:secrets:grantaccess',
        secretName,
        '--project',
        projectId,
      ],
      {
        stdio: 'inherit',
      }
    );

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Granted access for ${secretName}`);
      } else {
        console.warn(`Note: grantaccess returned code ${code} (may already be granted).`);
      }
      resolve();
    });
  });
}

async function main() {
  console.log(`\n======================================================`);
  console.log(` Syncing secrets from .env.local to Firebase Project: ${projectId}`);
  console.log(`======================================================\n`);

  for (const { envKey, secretName } of SECRETS_TO_SYNC) {
    const value = config[envKey];
    if (!value) {
      console.warn(`⚠ Skipping ${secretName}: ${envKey} is empty or missing in .env.local`);
      continue;
    }

    try {
      await setSecret(secretName, value);
      console.log(`✓ Secret "${secretName}" updated successfully in Firebase Secret Manager.\n`);
      await grantAccess(secretName);
      console.log('');
    } catch (err) {
      console.error(`✗ Failed to set secret "${secretName}":`, err.message);
      console.error(
        `\nTip: If you are not authenticated with Firebase CLI, run:\n  npx firebase login\n`
      );
      process.exit(1);
    }
  }

  console.log(`All secrets synced successfully to Firebase Secret Manager!\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
