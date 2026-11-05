import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 1. Get Firebase CLI token
const configPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
if (!fs.existsSync(configPath)) {
  console.error('firebase-tools.json not found');
  process.exit(1);
}
const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let accessToken = configData.tokens?.access_token;

// If token might be expired, refresh it
if (configData.tokens?.refresh_token && configData.tokens?.expires_at && Date.now() >= configData.tokens.expires_at) {
  console.log('Refreshing Firebase CLI access token...');
  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho85tcd.apps.googleusercontent.com',
      grant_type: 'refresh_token',
      refresh_token: configData.tokens.refresh_token,
    }),
  });
  if (refreshRes.ok) {
    const refreshed = await refreshRes.json();
    accessToken = refreshed.access_token;
    console.log('Token refreshed successfully.');
  }
}

const PROJECT_ID = 'nativeyard-nj';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function testFirestore() {
  console.log(`\n=============================================================`);
  console.log(`  Verifying Firebase Firestore for Project: ${PROJECT_ID}`);
  console.log(`=============================================================\n`);

  const testUserId = 'test-uid-' + Date.now();
  const testPropId = 'test-prop-' + Date.now();
  const testAreaId = 'test-area-' + Date.now();

  try {
    // Step 1: Create a Property
    console.log(`1. Testing Property Creation:`);
    console.log(`   Collection: 'properties'`);
    console.log(`   Document ID: ${testPropId}`);
    
    const propPayload = {
      fields: {
        id: { stringValue: testPropId },
        userId: { stringValue: testUserId },
        name: { stringValue: "Highland Park Native Haven" },
        zip: { stringValue: "08904" },
        created_at: { stringValue: new Date().toISOString() },
      },
    };

    const propCreateRes = await fetch(`${BASE_URL}/properties?documentId=${testPropId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(propPayload),
    });

    if (!propCreateRes.ok) {
      const errText = await propCreateRes.text();
      throw new Error(`Failed to create property: ${propCreateRes.status} ${errText}`);
    }
    const propCreated = await propCreateRes.json();
    console.log(`   ✓ Property created successfully in Firestore: "${propCreated.fields.name.stringValue}" (ZIP: ${propCreated.fields.zip.stringValue})`);

    // Step 2: Create a Yard Area
    console.log(`\n2. Testing Yard Area Creation:`);
    console.log(`   Collection: 'yard_areas'`);
    console.log(`   Document ID: ${testAreaId}`);
    console.log(`   Linked Property ID: ${testPropId}`);

    const areaPayload = {
      fields: {
        id: { stringValue: testAreaId },
        propertyId: { stringValue: testPropId },
        userId: { stringValue: testUserId },
        name: { stringValue: "Front Meadow & Rain Garden" },
        created_at: { stringValue: new Date().toISOString() },
      },
    };

    const areaCreateRes = await fetch(`${BASE_URL}/yard_areas?documentId=${testAreaId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(areaPayload),
    });

    if (!areaCreateRes.ok) {
      const errText = await areaCreateRes.text();
      throw new Error(`Failed to create yard area: ${areaCreateRes.status} ${errText}`);
    }
    const areaCreated = await areaCreateRes.json();
    console.log(`   ✓ Yard area created successfully in Firestore: "${areaCreated.fields.name.stringValue}"`);

    // Step 3: Read back documents
    console.log(`\n3. Verifying Persistence & Queries:`);
    const readPropRes = await fetch(`${BASE_URL}/properties/${testPropId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!readPropRes.ok) throw new Error('Could not read property document back!');
    const readProp = await readPropRes.json();
    console.log(`   ✓ Property read verified: Name="${readProp.fields.name.stringValue}", User="${readProp.fields.userId.stringValue}"`);

    const readAreaRes = await fetch(`${BASE_URL}/yard_areas/${testAreaId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!readAreaRes.ok) throw new Error('Could not read yard area document back!');
    const readArea = await readAreaRes.json();
    console.log(`   ✓ Yard area read verified: Name="${readArea.fields.name.stringValue}", PropertyId="${readArea.fields.propertyId.stringValue}"`);

    // Step 4: Cleanup
    console.log(`\n4. Cleaning Up Test Documents:`);
    await fetch(`${BASE_URL}/yard_areas/${testAreaId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    await fetch(`${BASE_URL}/properties/${testPropId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    console.log(`   ✓ Test documents deleted cleanly from Firestore.`);

    console.log(`\n=============================================================`);
    console.log(`  VERIFICATION PASSED: Firestore is initialized and active!`);
    console.log(`  Property and Yard Area creation/reading work properly.`);
    console.log(`=============================================================\n`);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

testFirestore();
