# Design Decisions & Assumptions

Honest documentation of the trade-offs made in this project — useful for a
project report or viva, where "why did you do it this way?" is a fair
question to be asked.

## Database: Firebase Firestore, not a SQL database

Firestore was chosen over a traditional SQL database (Postgres/MySQL) for
three practical reasons for a student project: **zero local setup** (no
database server to install, configure, or keep running), a **generous free
tier** that comfortably covers a project's worth of usage, and **built-in
real-time sync**, which the station cache (`services/stationCache.js`)
takes advantage of to keep every connected instance's in-memory station
list live without a manual refresh/polling loop.

The trade-off: Firestore is a document database, not relational, so there
are no foreign-key constraints or JOINs at the database level. This project
compensates with a thin model layer (`models/firestoreModel.js`) that gives
each collection a Sequelize-like API (`findByPk`, `findOne`, `findAll`,
`.save()`, `.destroy()`) so the rest of the codebase reads like it's talking
to a relational ORM, and referential integrity (e.g. "does this vehicleId
actually belong to this user?") is checked explicitly in controllers.

## "AI" features are rule-based and explainable, not black-box ML

The recommendation engine (`services/recommendationService.js`) is a
transparent, weighted multi-factor scorer (distance, price, rating,
availability, charging speed, connector match) rather than a trained model.
This was a deliberate choice, not a shortcut:

1. **No historical interaction data exists yet.** A learned ranking model
   needs real booking/click history to train on; a brand-new platform has
   none. Training on synthetic data would just re-encode whatever bias was
   put into the synthetic generator.
2. **Explainability matters for trust in this domain.** Drivers can see
   *why* a station was ranked highly (e.g. "2.1 km away, ₹2 cheaper per
   kWh, DC Fast matches your car"), which a black-box model can't easily
   give without a separate explainability layer.
3. It's a legitimate, real-world technique — many production recommender
   systems still use weighted scoring for exactly these reasons, especially
   in the cold-start phase before enough usage data accumulates.

The natural-language search (`services/nlpSearchService.js`) is similarly a
rule-based keyword/pattern parser rather than an LLM call, so it works
fully offline with zero API cost or latency.

## Charging time & cost formula

`services/chargingPlannerService.js` computes energy needed as
`batteryCapacityKwh * (targetPercent - startPercent) / 100`, then duration
as `energyNeeded / effectivePower`, where `effectivePower` is
`min(vehicle.maxChargeKw, station.maxPowerKw) * 0.9`. The `0.9` factor is a
documented, simplifying assumption for real-world charging losses
(inverter/battery-management inefficiency); it is not simulating the
non-linear charge curve real batteries have (fast 0→80%, slower 80→100%),
which was considered out of scope for this project's purpose (giving a
driver a reasonable estimate, not a battery-engineering simulation).

## Payments: a demo gateway, not a real one

See the README's [Payments & blockchain ledger](../README.md#payments--blockchain-ledger)
section for the full explanation — in short, the brief required a
*properly implemented* payment flow that *never charges real money*, which
a real gateway's test mode still complicates (API keys, dashboards,
webhooks to configure). A self-built gateway that reproduces the same
validation and failure/success shape as a real one satisfies both
constraints with no external dependency.

## Blockchain: a real hash chain, not a public network

The ledger (`services/blockchainService.js`) is a genuine SHA-256
proof-of-work chain — not a simulation that just prints fake-looking
hashes. Each block's hash is a real function of its contents and the
previous block's hash, and `verifyChain()` genuinely re-derives and checks
every block. What it deliberately is **not**: a distributed/public network
like Ethereum, with multiple independent nodes reaching consensus. Running
an actual node of a public chain, or paying gas fees, is incompatible with
"must stay free" — so this project implements the cryptographic and
data-structure core of a blockchain (which is what's usually being assessed
in a project brief like this) without the distributed-consensus
infrastructure around it.

## Station approval: prevents unverified listings

Any authenticated `owner` can submit a station, so without a review step
anyone could list a fake or incorrect station a driver might actually drive
to. New owner-submitted stations are created `approvalStatus: 'pending'`
and excluded from driver-facing search until an admin approves them.
Dataset-imported stations are auto-approved since they come from a
public dataset (OpenChargeMap) rather than an unverified individual.

## Security model

- Passwords are hashed with bcrypt, never stored in plaintext.
- Auth uses stateless JWTs (`middleware/auth.js`), checked on every
  protected route; role-based guards (`requireRole`) gate owner/admin-only
  endpoints.
- The Firebase Admin SDK key (`serviceAccountKey.json`) is a secret and is
  excluded from version control via `.gitignore` — see the README's
  security note.
- Payment card details are validated and then **immediately discarded** —
  nothing resembling a card number is ever persisted, only a masked last-4
  and a generated transaction id, mirroring how real gateways (correctly)
  never let a merchant's own database touch raw card data (PCI-DSS scope
  reduction).

## Known simplifications / future scope

See the README's [Future scope](../README.md#future-scope) section.
