
# ⚡ ChargeIQ — Smart EV Charging Platform

A full-stack web platform for finding, comparing, booking and paying for EV
charging stations — built as a BE (Computer/IT Engineering) major project.

Three user roles are supported end-to-end: **EV Drivers**, **Station
Owners**, and **Platform Admins**, each with their own dashboard.

> **Note on this version:** this build includes a realistic booking
> lifecycle (reserve → arrive → tap "Start charging" → auto-completes, with
> automatic 1-hour expiry if charging is never started), live driving
> directions with real-time location tracking, a nationwide station
> dataset imported from Open Charge Map, a locality-aware recommendation engine, a
> map-based location picker for station owners, and marker-clustered map
> rendering so it stays smooth even with thousands of stations loaded. A
> one-command script can also pull the **complete real OpenChargeMap
> dataset for all of India** if you want live data instead of the bundled
> seed set — see [Datasets used](#datasets-used). See
> [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) for details.

---

## Table of contents

1. [What's included](#whats-included)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Datasets used](#datasets-used)
5. [Prerequisites](#prerequisites)
6. [Installation & running the project](#installation--running-the-project)
7. [Key features explained](#key-features-explained)
8. [Payments & blockchain ledger](#payments--blockchain-ledger)
9. [Station approval workflow](#station-approval-workflow)
10. [API documentation](#api-documentation)
11. [Design decisions & assumptions](#design-decisions--assumptions)
12. [Future scope](#future-scope)
13. [Troubleshooting](#troubleshooting)
14. [Security note before you push this to GitHub](#security-note-before-you-push-this-to-github)
15. [Team](#-team)

---

## What's included

> **Firebase setup:** This project saves all data to Firebase Firestore.
> Before running it, follow [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md) once
> to connect your Firebase project (2-minute setup, plain-language steps).

- **Backend REST API** — Node.js + Express + Firebase Firestore, JWT
  authentication, role-based access control.
- **Frontend web app** — React 18 + Vite + Tailwind CSS, with an interactive
  Leaflet map (street + satellite views), dark/light theme, and animated UI.
- **Explainable AI recommendation engine** — ranks stations for a driver's
  specific vehicle and shows *why* each suggestion was made.
- **Natural-language search** — type a sentence like *"fast CCS2 charger
  under 12 with cafe"* and get filtered results.
- **Charging planner** — physics-based time & cost estimator for any
  vehicle + station combination.
- **Booking engine** — reserve slots, pay via a built-in demo payment
  gateway, simulate live charging-session progress, auto-generate a
  downloadable PDF invoice on completion.
- **Demo payment gateway + blockchain ledger** — every booking must be paid
  for (with fake card details — no real money ever moves) before it is
  confirmed, and every successful payment is mined into a real, from-scratch
  SHA-256 proof-of-work blockchain for a tamper-evident transaction record.
  See [Payments & blockchain ledger](#payments--blockchain-ledger) below.
- **Station approval workflow** — stations added by owners appear to admins
  as "Pending approval" and are hidden from driver search until an admin
  approves them from the Admin Console, preventing anyone from listing an
  unverified station.
- **Reviews & ratings, notifications, owner analytics, admin console.**
- **Theme backgrounds:** place the light-theme image at
  `frontend/public/images/light-bg.jpg` and the dark-theme image at
  `frontend/public/images/dark-bg.jpg`. The app scales and blurs both
  images responsively and crossfades between them when the theme changes.
- **A pre-seeded charging-station dataset** spanning every state and union
  territory and a **24-model real-world EV specs catalog** — the app works
  fully offline, no API keys required. A companion script can pull the full
  real OpenChargeMap dataset for all of India if you want live data instead
  (free, optional, see below).
- **Marker-clustered map rendering** so the map stays smooth with hundreds
  or thousands of stations loaded at once, plus paginated results so the
  list view never has to render everything in one go.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Framer Motion, React-Leaflet, Recharts |
| Backend | Node.js, Express |
| Database | Firebase Firestore (cloud, real-time) |
| Auth | JWT (JSON Web Tokens), bcrypt password hashing |
| PDF generation | PDFKit |
| Payments | Self-built demo gateway (ChargeIQ DemoPay) — card-shaped validation, test decline card, zero real transactions |
| Blockchain | Self-built SHA-256 proof-of-work ledger, persisted in Firestore |
| Maps | Leaflet with OpenStreetMap (street) + Esri World Imagery (satellite) tiles — both free, no API key |

No paid API keys, no external database server, and no cloud account are
required to run this project.

---

## Project structure

```
ev-platform/
├── backend/
│   ├── src/
│   │   ├── config/firebase.js        # Firebase Admin SDK connection
│   │   ├── services/stationCache.js  # In-memory, real-time-synced station cache
│   │   ├── models/                   # User, Vehicle, Station, Booking, Review, Notification, Invoice
│   │   ├── controllers/              # Route handler logic
│   │   ├── routes/                   # Express route definitions
│   │   ├── middleware/auth.js        # JWT auth + role guard
│   │   ├── services/
│   │   │   ├── recommendationService.js   # Explainable AI ranking engine
│   │   │   ├── nlpSearchService.js        # Natural-language query parser
│   │   │   ├── chargingPlannerService.js  # Time/cost estimator
│   │   │   ├── invoiceService.js          # PDF invoice generator
│   │   │   ├── paymentService.js          # Demo payment gateway (card validation, test cards)
│   │   │   └── blockchainService.js       # Self-built SHA-256 proof-of-work ledger
│   │   ├── seed/
│   │   │   ├── evModels.json         # Real-world EV specs catalog (24 models)
│   │   │   ├── stations.json         # Bundled seed dataset
│   │   │   ├── generateStations.js   # Script that built stations.json
│   │   │   ├── fetchOpenChargeMap.js # Pulls the REAL, complete OpenChargeMap dataset for all of India
│   │   │   └── runSeed.js            # Populates the database
│   │   ├── app.js / server.js
│   ├── invoices/                     # Generated PDF invoices land here
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                      # Axios client + endpoint functions
│   │   ├── context/                  # Auth + Theme React contexts
│   │   ├── components/               # Navbar, MapView, StationCard, BookingModal, PaymentModal, etc.
│   │   ├── pages/                    # One file per route/screen
│   │   └── hooks/useGeolocation.js
│   ├── index.html
│   └── package.json
├── docs/
│   ├── API_DOCUMENTATION.md
│   ├── ER_DIAGRAM.md
│   └── DESIGN_DECISIONS.md
└── README.md   (this file)
```

---

## Datasets used

### 1. EV vehicle specs catalog — `backend/src/seed/evModels.json`
24 real, currently-sold EV models (Tata Nexon EV, MG ZS EV, Hyundai Ioniq 5,
Tesla Model 3/Y, BYD Atto 3, Kia EV6, and more) with their publicly published
battery capacity, range, connector type and max charging speed. Used to
auto-fill specs when a driver adds a vehicle to their garage.

### 2. Charging station dataset — `backend/src/seed/stations.json`
**A large bundled charging-station dataset** spanning every state and union
territory, sourced from Open Charge Map and stored at real coordinates.
Station names, exact coordinates, connector types, pricing and slot counts
are normalized for the app, and the next section explains how to refresh it
from OpenChargeMap.

> Regenerate this dataset any time with:
> ```
> cd backend && node src/seed/generateStations.js   # regenerates stations.json
> npm run seed                                       # loads it into the database
> ```

### 3. Getting the REAL, complete OpenChargeMap dataset for all of India
[OpenChargeMap](https://openchargemap.org) is a free, crowdsourced, public
database of real-world EV charging locations worldwide, and this project
includes a script that pulls **every station it can find for India** - not
just one city - and replaces the seed dataset with it.

**How it works:** India is split into a grid of ~110 geographic tiles, each
queried separately (so no single request's result limit can silently cut
off a dense area), with automatic subdivision if any tile still looks full,
automatic retry/backoff if you get rate-limited, and de-duplication across
tiles. This is the same architecture you'd want for genuinely "download the
whole country" jobs against any tiled public API, not a shortcut.

**Step 1 — get a free API key (~1 minute, strongly recommended):**
A nationwide pull is 100+ requests; without a key you'll likely hit
OpenChargeMap's rate limit partway through and the script will just go
slower (it backs off and retries automatically, so it still finishes, just
takes longer). With a free key it's much faster and more reliable:
1. Register at <https://openchargemap.org/site/loginprovider/register>
2. Create an app key at <https://openchargemap.org/site/profile/applications>
   (any name/description is fine)
3. Copy the generated key

**Step 2 — add it to your `.env`:**
```
# backend/.env
OPENCHARGEMAP_API_KEY=paste_your_key_here
```

**Step 3 — run the fetch (requires internet access on this machine):**
```bash
cd backend
npm run fetch:opencharge   # takes a few minutes; prints progress tile-by-tile
npm run seed                # loads the freshly fetched real data into the database
```

The script prints a running total and a final breakdown by state/UT so you
can see coverage as it completes. It also works **without** a key (just
slower/more retries) if you'd rather not sign up.

This step is **entirely optional** — the project runs completely offline
out of the box with the bundled 2,340-station dataset. Run this only if you
specifically want live, real station data instead of the generated demo
set.

---

## Prerequisites

- **Node.js 18+** and **npm 9+** ([download](https://nodejs.org))
- No database server, no Docker, no paid API keys needed.

Check your versions:
```bash
node -v
npm -v
```

---

## Installation & running the project

### 1. Unzip the project and open a terminal in the root folder

### 2. Set up and start the backend

```bash
cd backend
npm install
cp .env.example .env      # (on Windows: copy .env.example .env)
npm run seed               # creates the seeded admin account (only if one doesn't exist yet)
npm run seed:stations       # loads the ~2,000 station dataset into Firestore
npm run dev                 # starts the API on http://localhost:5000 and the LAN
```

You should see:
```
Database connected and synced.
Smart EV Charging Platform API running on http://localhost:5000
```

Leave this terminal running, and open a **second terminal** for the frontend.

### 3. Set up and start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** on the development PC, or
**http://YOUR-PC-IP:5173** (for example, `http://192.168.1.34:5173`) on another
device connected to the same Wi-Fi/network. The frontend automatically
proxies `/api/*` requests to the backend on port 5000 (configured in
`vite.config.js`), so no extra setup is needed.

### 4. Log in

Register a new account as an **EV Driver** or **Station Owner**, or use the seeded admin account created by the seed script.

### 5. (Optional) Production build

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
npm run preview    # serve the production build locally
```

---

<!-- Demo accounts and seeded demo users have been removed. The seed script now only creates the platform admin account. Register users through the app or import real station data as needed. -->

---

## Key features explained

- **Smart recommendations** (`services/recommendationService.js`) — a
  transparent, multi-factor weighted scoring system (distance, availability,
  price, rating, charging speed, connector match) that explains *why* each
  station was recommended in plain English. See
  [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) for the full
  rationale on why this approach was chosen over a black-box ML model.
- **Describe-what-you-need search** (`services/nlpSearchService.js`) — a
  rule-based keyword/pattern parser that turns free text into structured
  filters (connector type, price ceiling, charger speed, amenities, radius).
- **Charging planner** (`services/chargingPlannerService.js`) — computes
  energy needed, duration and cost using real charging-power formulas with
  a documented 90% efficiency assumption. Drivers can declare the actual
  battery level their car is at when booking, rather than trusting a
  possibly stale garage record.
- **Live charging status bar** — fills from the vehicle's actual starting
  charge (not from zero), marks the target percentage as a line on the bar,
  and shows a live estimated time remaining to reach that target.
- **Live directions & route tracking** — get a driving route from your
  current location to any station (via the free OpenStreetMap OSRM routing
  service) and optionally start live tracking, which follows your real
  browser location and automatically refreshes the route/ETA as you move.
- **Session simulation** — since no physical hardware is attached, booking
  progress is simulated by comparing the current time against the booked
  slot window; this is recalculated on every progress poll (both on the
  booking detail page and the driver dashboard) and finalized automatically
  once the slot ends.
- **PDF invoices** — generated with PDFKit the moment a session completes,
  downloaded as an authenticated request (not a plain link) so it works
  correctly with token-based auth.
- **Live owner & admin views** — the Owner Dashboard polls for new bookings
  and slot changes every few seconds, and shows a real driver/vehicle/slot
  history table for every station you own. The Admin Console polls platform
  stats and shows enriched booking records with real driver and station
  names.

---

## Payments & blockchain ledger

This was built to satisfy a specific brief: **implement a real payment
gateway and a real blockchain, but never move real money**, since this is
an academic project.

**How a booking gets paid for:**
1. Reserving a slot creates the booking with status `pending_payment` and
   holds the slot for 20 minutes.
2. The booking screen opens **ChargeIQ DemoPay**, a self-built checkout form
   (card number, name, expiry, CVV). It runs real client- and server-side
   card validation (format + a genuine Luhn checksum + expiry check) but
   never contacts any real bank, network, or third party — see
   `backend/src/services/paymentService.js`.
   - Card `4242 4242 4242 4242` (any name/future expiry/CVV) → always succeeds.
   - Card `4000 0000 0000 0002` → always **declines**, so the failure/retry
     path can be demoed too (this mirrors the well-known Stripe/Razorpay
     test-card convention).
3. On success, the payment is recorded **and a new block is mined and
   appended to an append-only blockchain** (`backend/src/services/blockchainService.js`):
   - Each block stores an index, timestamp, the transaction payload, the
     previous block's hash, a nonce, and its own SHA-256 hash.
   - The nonce is found by genuine proof-of-work (repeatedly hashing until
     the hash starts with 3 leading zero hex digits) — the same core idea
     real blockchains use, just with a low difficulty so it stays instant.
   - Changing any past block's data changes its hash, which breaks every
     link after it — this is what makes the chain tamper-evident.
4. Only *then* does the booking move to `confirmed` and the slot becomes
   guaranteed. If payment is never completed, the booking auto-cancels and
   the slot is released back to the station.
5. The invoice PDF, the booking detail page, and the Admin Console all show
   the resulting transaction ID and block hash. The Admin Console also has
   a **"Verify ledger"** button that independently re-derives every block's
   hash and checks the hash-chain links — a genuine integrity check, not a
   cosmetic badge.

This is intentionally not wired to Stripe/Razorpay or a real blockchain
network (Ethereum, etc.) — the brief was "implement it properly, but it
must stay free and must never charge real money," which a real gateway
cannot guarantee in a shared/demo environment.

---

## Station approval workflow

Anyone can *submit* a station as an owner, but a station only appears in
driver search once an admin approves it:

- New owner-submitted stations are created with `approvalStatus: 'pending'`
  and are excluded from public search/map results.
- The Owner Dashboard shows a **"Pending approval"** badge on the station
  until then.
- The Admin Console → Stations tab lists every pending station with who
  submitted it, and an **Approve** action. Stations imported from the
  bundled/OpenChargeMap dataset are auto-approved (labelled "Imported
  public dataset" in the admin view) since there's no owner to review them
  against.

---

See [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) for the full
list of REST endpoints, request/response shapes and auth requirements.

Quick health check once the backend is running:
```bash
curl http://localhost:5000/api/health
```

---

## Design decisions & assumptions

See [`docs/DESIGN_DECISIONS.md`](docs/DESIGN_DECISIONS.md) — useful for your
project report/viva. It documents the original database trade-off discussion (this project now runs on Firebase Firestore - see FIREBASE_SETUP.md),
why the "AI" features are rule-based and explainable rather than black-box
ML, the charging-time formula and its simplifying assumptions, and the
security model.

## ER Diagram

See [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md) for the entity-relationship
diagram (Mermaid format — renders directly on GitHub, or paste into
https://mermaid.live).

---

## Future scope

Documented honestly rather than overstated, for anyone extending this project:

- **Real-time slot availability via WebSockets** instead of polling.
- **A real payment gateway** (Razorpay/Stripe live or test mode) as a
  drop-in replacement for the demo gateway, for an actual production
  deployment that needs to move real money.
- **A public/permissioned blockchain network** (or a managed ledger service)
  instead of the self-hosted hash chain, if verifiable-by-outsiders proof
  becomes a requirement.
- **A learned ranking model** trained on real booking/click data once the
  platform has enough usage history — the current rule-based recommender
  was a deliberate choice given there is no historical interaction data yet
  (see Design Decisions doc).
- **Route-based trip planning** (multi-stop charging along a driving route)
  using a routing API such as OSRM.
- **Push notifications / SMS** via a provider like Twilio or Firebase Cloud
  Messaging for booking reminders.
- **Multi-instance deployment at scale**, since the in-memory station
  cache currently assumes a single running backend process.

---

## Troubleshooting

**`EADDRINUSE` on port 5000 or 5173** — another process is already using
the port. Stop it, or change `PORT` in `backend/.env` (and the proxy target
in `frontend/vite.config.js` to match).

**Blank map / map tiles not loading** — the map uses free OpenStreetMap and
Esri tile servers, which require internet access. The rest of the app works
fully offline; only the map imagery needs a connection.

**"No slots available" when booking** — the seeded dataset randomizes
available slots per station; try a different station from the search
results, or edit `availableSlots` in `backend/src/seed/stations.json` and
re-run `npm run seed`.

**Login says "Invalid or expired token"** — your browser's local storage
has a stale token from a previous database reset. Log out and log back in
(or clear site data for `localhost:5173`).

**Want a completely fresh database** — run `npm run seed` again from the
`backend` folder; it drops and recreates all tables and reloads demo data.

## Security note before you push this to GitHub

`backend/serviceAccountKey.json` contains a **real Firebase private key**.
This repo's `.gitignore` already excludes it, but double check before your
first push:

```bash
git status   # serviceAccountKey.json should NOT appear as a tracked/staged file
```

- `backend/serviceAccountKey.example.json` is a safe placeholder — that one
  is fine to commit.
- If you ever *do* accidentally commit the real key, rotate it immediately
  from Firebase Console → Project Settings → Service Accounts → Manage
  service account permissions → generate a new key, and delete the old one.
- Likewise, never commit a real `backend/.env` — only `backend/.env.example`.

---

## 👥 Team

This project was built as a 3rd Year University Team Project by:

| Name | GitHub | Role |
|---|---|---|
| Pranav Gajanan Dighade | [@dighadepranav](https://github.com/dighadepranav) | Leader |
| Ajay Bhanwarlal Chaudhary | [@ajay262628](https://github.com/ajay262628) | Member 1 |
| Shivam Gajanan Burkul | [@shivamburkul](https://github.com/shivamburkul) | Member 2 |
| Faiz Ishaque Chauhan | [@faizchauhan18-creator](https://github.com/faizchauhan18-creator) | Member 3 |

**Project title:** Smart EV Charging Optimization and Reservation Platform

