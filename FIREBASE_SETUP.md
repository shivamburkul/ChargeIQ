# Firebase Setup

This project stores all data in Firebase Firestore (a free-tier cloud
database). You need your own Firebase project so the app has somewhere to
write data — takes about 2 minutes.

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with any Google account.
2. Click **Add project**, give it any name (e.g. `chargeiq-ev-platform`), and finish the wizard (Google Analytics is not needed — you can disable it).

## 2. Enable Firestore

1. In the left sidebar, open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (the backend authenticates with an admin key, so security rules don't need to allow public access).
4. Pick any region close to you and confirm.

## 3. Generate a service account key

1. Click the ⚙️ gear icon next to **Project Overview** → **Project settings**.
2. Open the **Service accounts** tab.
3. Click **Generate new private key** → confirm. A `.json` file downloads.
4. Rename that file to `serviceAccountKey.json` and place it at:
   ```
   backend/serviceAccountKey.json
   ```
   (There's already a `backend/serviceAccountKey.example.json` in this repo showing the expected shape — don't commit your real one; it's already listed in `.gitignore`.)

That's it — no env vars are required for this default setup. `backend/src/config/firebase.js` automatically looks for `backend/serviceAccountKey.json` if no `FIREBASE_SERVICE_ACCOUNT_*` environment variable is set.

## Alternative: no local file (env var instead)

If you'd rather not have a JSON file on disk (e.g. deploying to a host where you can only set environment variables), open your downloaded key file, copy its entire contents onto a single line, and set it in `backend/.env`:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...", ...}
```

## Verifying it worked

Start the backend (`npm run dev` inside `backend/`). You should see:

```
Connected to Firebase Firestore.
Smart EV Charging Platform API running on http://localhost:5000
```

If instead you see an error mentioning `serviceAccountKey.json` or `Could not load the default credentials`, double-check the file is at exactly `backend/serviceAccountKey.json` and is valid JSON (open it in a text editor — it should *not* be empty or truncated).

## Firestore security rules (optional but recommended before going live)

Since the backend uses the Admin SDK (which bypasses security rules entirely), the default "production mode" rules are fine for this project as-is — the frontend never talks to Firestore directly, only through this backend's REST API. If you ever add direct client-side Firestore access, lock it down with proper rules first.
