
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Three ways to provide credentials (checked in this order) so this works
// whether the person pasted a service account JSON file, put the JSON
// directly in .env, or is running on a host that already has Google
// credentials configured. Only the first one is needed for local use.
//
//   1) FIREBASE_SERVICE_ACCOUNT_PATH  -> path to a serviceAccountKey.json file
//   2) FIREBASE_SERVICE_ACCOUNT_JSON  -> the entire JSON key pasted as one line
//   3) GOOGLE_APPLICATION_CREDENTIALS (standard Google env var, if already set)
function loadServiceAccount() {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv && jsonEnv.trim()) {
    try {
      return JSON.parse(jsonEnv);
    } catch (err) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON in .env is not valid JSON. Paste the full contents of your serviceAccountKey.json file as a single line.');
    }
  }

  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
  const resolved = path.isAbsolute(pathEnv) ? pathEnv : path.resolve(__dirname, '../../', pathEnv);
  if (fs.existsSync(resolved)) {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  return null;
}

let db = null;

function initFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    throw new Error(
      'No Firebase credentials found. Place your downloaded serviceAccountKey.json file in the backend/ ' +
      'folder (same folder as package.json), or see FIREBASE_SETUP.md.'
    );
  }

  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

module.exports = { admin, initFirebase, getDb: () => db };


