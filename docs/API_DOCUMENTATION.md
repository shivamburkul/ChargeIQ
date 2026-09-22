# API Documentation

Base URL (local dev): `http://localhost:5000/api`

All authenticated routes expect `Authorization: Bearer <JWT>`, obtained from
`/auth/login`, `/auth/admin-login`, or `/auth/register`. Roles are `user`
(EV driver), `owner` (station owner), and `admin`.

## Health check

`GET /api/health` → `{ status: "ok" }`

---

## Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create a driver or owner account. Body: `{ name, email, password, role }` |
| POST | `/login` | — | Driver/owner login. Body: `{ email, password }` → `{ token, user }` |
| POST | `/admin-login` | — | Admin login (separate endpoint so the admin flow can be locked down independently) |
| GET | `/me` | ✅ | Current user's profile |
| PUT | `/me` | ✅ | Update profile fields |

## Vehicles — `/api/vehicles`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/catalog` | — | Reference catalog of 24 real EV models (specs, battery, connector) |
| GET | `/` | ✅ | List the current user's vehicles |
| POST | `/` | ✅ | Add a vehicle |
| PUT | `/:id` | ✅ | Update a vehicle |
| DELETE | `/:id` | ✅ | Remove a vehicle |
| PATCH | `/:id/default` | ✅ | Mark a vehicle as the default one |

## Stations — `/api/stations`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | List/search stations (query filters: connector, price, distance, etc.) |
| GET | `/search/nlp` | — | Natural-language search, e.g. `?query=fast CCS2 under 12 with cafe` |
| POST | `/recommend` | ✅ | Explainable recommendation ranking for a given vehicle |
| GET | `/compare` | — | Compare stations by id: `?ids=1,2,3` |
| GET | `/:id` | — | Station details |
| GET | `/owner/mine` | ✅ owner/admin | Stations owned by the current user |
| GET | `/owner/bookings` | ✅ owner/admin | Bookings across the owner's stations |
| GET | `/owner/bookings/:bookingId/invoice` | ✅ owner/admin | Download a booking's invoice PDF |
| POST | `/` | ✅ owner/admin | Create a station (starts as `approvalStatus: 'pending'` unless created by an admin) |
| PUT | `/:id` | ✅ owner/admin | Update a station |
| DELETE | `/:id` | ✅ owner/admin | Delete a station |
| GET | `/:id/analytics` | ✅ owner/admin | Revenue/usage analytics for one station |

## Bookings — `/api/bookings` (all require auth)

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create a booking. Reserves the slot and sets status `pending_payment` — see [Payments](#payments--apipayments) |
| GET | `/` | List the current user's bookings |
| GET | `/:id` | Booking details |
| POST | `/:id/start` | Start a charging session (only when `confirmed`) |
| POST | `/:id/cancel` | Cancel a booking, releases the slot |
| POST | `/:id/reschedule` | Move a `confirmed` booking to a new slot time |
| GET | `/:id/progress` | Live session progress (polled by the frontend) |
| GET | `/:id/invoice` | Download the PDF invoice (only once `completed`) |

## Payments — `/api/payments` (all require auth)

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create a payment intent for a `pending_payment` booking. Body: `{ bookingId }` → `{ payment }` |
| GET | `/:id` | Get a payment's status |
| GET | `/booking/:bookingId` | Get the successful payment for a booking (used for receipts) |
| POST | `/:id/confirm` | Submit demo card details and settle the payment. Body: `{ cardNumber, cardName, expiry, cvv }` → `{ payment, booking, block }` on success, `402` with `{ message }` on decline |

See [README § Payments & blockchain ledger](../README.md#payments--blockchain-ledger) for the full flow and test card numbers.

## Blockchain ledger — `/api/blockchain` (all require auth)

| Method | Path | Description |
|---|---|---|
| GET | `/chain` | Full ledger (every block) |
| GET | `/verify` | Re-verifies every block's hash and chain links → `{ valid, blockCount }` or `{ valid: false, brokenAtIndex, reason }` |
| GET | `/booking/:bookingId` | Block(s) tied to one booking |

## Reviews — `/api/reviews`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/station/:stationId` | — | Reviews for a station |
| POST | `/` | ✅ | Add a review (requires a completed booking at that station) |
| DELETE | `/:id` | ✅ | Remove your own review |

## Notifications — `/api/notifications` (all require auth)

| Method | Path | Description |
|---|---|---|
| GET | `/` | List notifications |
| PATCH | `/:id/read` | Mark one as read |
| PATCH | `/read-all` | Mark all as read |

## Planner — `/api/planner`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | ✅ | Compute a charging plan (energy needed, duration, cost) for a vehicle + station + target battery % |

## Admin — `/api/admin` (all require admin role)

| Method | Path | Description |
|---|---|---|
| GET | `/overview` | Platform-wide stats: users, stations, bookings, revenue, successful payments, blockchain block count |
| GET | `/users` | List all users |
| DELETE | `/users/:id` | Deactivate/remove a user |
| GET | `/stations` | List all stations (includes `approvalStatus`, `sourceLabel`) |
| PATCH | `/stations/:id/toggle` | Activate/deactivate a station |
| PATCH | `/stations/:id/approve` | Approve a pending owner-submitted station |
| GET | `/bookings` | List all bookings platform-wide |
| GET | `/activity` | Recent activity feed |

---

## Error format

Errors return a JSON body with a `message` field, and sometimes `error` with
more detail in non-production runs:

```json
{ "message": "Booking not found." }
```

HTTP status codes follow convention: `400` validation error, `401`
unauthenticated, `403` wrong role, `402` payment declined, `404` not found,
`500` unexpected server error.
