# Thevi Spinner — Lucky Spin Offer Management

A mobile-first Lucky Spin web app built with Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion and Lucide icons. The backend stores data in JSON files on the server.

- **Public site (`/`)**: one permanent link that always shows the currently active spinner. A visitor registers with name and Sri Lankan mobile number, spins once, and gets a server-confirmed result they can share on WhatsApp.
- **Admin (`/admin`)**: create, publish, pause, duplicate and archive spinners; manage offers (images, weights, quantities, order); set sounds and animation; monitor participants and winners; export CSV reports.

## Quick start

```bash
npm install
cp .env.example .env.local      # then edit ADMIN_PASSWORD and SESSION_SECRET
npm run dev                     # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

On first run the JSON files in `data/` are created from the demo data in `data/seed/`. The demo has one active spinner and one completed spinner with history. The first admin account is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` the first time you log in. After that, change the password under **Admin → Settings**.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev / production build / production server |
| `npm test` | Vitest: phone validation, weighted selection, concurrency and one-spin rules against a temporary database |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | Reset runtime data to the demo data (keeps `admin.json`) |
| `npm run backup` | Copy all JSON files and uploads to `backups/<timestamp>/` |

## How "one person, one spin" is enforced

All of these checks run on the server:

1. **Identity**: the mobile number is normalized to `+947XXXXXXXX`, so `0771234567`, `77 123 4567` and `+94771234567` count as the same person. The repository enforces a unique `(spinnerId, mobile)` constraint.
2. **Registration** (`POST /api/users/register`) checks, inside one serialized transaction, that the spinner is active and open, that the slot limit has not been reached, and that the number has not already been used. It then issues a random **participant token**. The browser receives it only as an `httpOnly` cookie, and the server stores only its SHA-256 hash.
3. **Spin** (`POST /api/spins`) checks everything again inside a transaction: valid token, spinner active and not paused, within dates, participant inside the first `maxParticipants`, and no existing result. The server then picks the offer with `crypto.randomInt`, using the weights and remaining quantities. It decrements the quantity, saves the immutable result (unique `(spinnerId, userId)`), and only then returns it. The wheel animates to the segment the server chose.
4. **Double clicks and extra tabs**: a second spin request with the same token gets the same stored result back (`replay: true`). It never creates a second result.
5. **Other devices**: a second device has no token. Registering the same number there either fails with *already participated* or, if the person never spun, lets them continue the same single registration.

`localStorage`, cookies and IP addresses are never treated as identity. Rate limiting (per IP, in memory) only slows down abuse.

> **Limitation:** a mobile number does not prove that two different numbers belong to two different people. The `verified` field on participants and the separate register and spin steps are there so OTP verification can be added later. That would mean sending an OTP at registration and requiring `verified` before a spin.

## Data storage

`lib/database/jsonDatabase.ts` handles the JSON files:

- **Serialized writes**: an in-process FIFO mutex plus a `data/.lock` lock file, which also covers multiple Node workers on one disk.
- **Atomic writes**: write a temp file, `fsync`, then `rename`.
- **Transactions**: changes are buffered and written only if the callback succeeds. If it throws, nothing is written.

Business logic only talks to the repositories in `lib/database/repositories.ts` through `withRepos()` (read-write transaction) and `readRepos()` (read snapshot). To move to PostgreSQL, implement the same repository methods over a SQL transaction (`SELECT … FOR UPDATE`, real `UNIQUE` constraints) and swap those two functions. The services do not need to change.

`data/` is outside `public/` and is never served. Uploaded images and sounds go to `DATA_DIR/uploads` and are served by `app/uploads/[file]/route.ts`. Uploads are checked for file type (magic bytes, so the content must match the extension) and size: images up to 2 MB, audio up to 5 MB. SVG is not accepted.

## Project layout

```
app/
  page.tsx                     public landing + spin flow
  admin/login                  admin sign in
  admin/(panel)/…              dashboard, spinners, spinners/create, spinners/[id], winners, participants, settings
  api/spinners, users, spins   public APIs
  api/admin/…                  admin APIs (all wrapped in adminRoute → session + same-origin check)
  uploads/[file]               serves uploaded media
components/user                LuckyWheel, RegistrationForm, WinningResult, CampaignCard, SpinExperience
components/admin               AdminShell, DashboardStats, Charts, SpinnerForm, OfferManager, SpinnerSettingsPanel, SpinnerAnalytics, ParticipantTable, WinnerTable
components/shared              ConfirmDialog, Modal, Loading, Footer
lib/database                   jsonDatabase (locking, atomic IO), repositories (seam for PostgreSQL)
lib/spin                       weightedSelection (CSPRNG), spinService (register / spin / check)
lib/services                   spinnerService, reportService (dashboard, analytics, CSV), uploadService
lib/auth                       scrypt passwords, HMAC-signed admin session cookie
lib/validation                 zod schemas, Sri Lankan phone normalization
data/seed                      demo data (runtime data/*.json is gitignored)
types/                         Spinner, Offer, Participant, SpinResult, AppSettings
```

## API

Public: `GET /api/spinners/active`, `GET /api/spinners/:id`, `POST /api/users/register`, `POST /api/spins`, `GET /api/spins/check?spinnerId=…[&mobile=…]`, `GET /api/settings`.

Admin (session cookie required):

- Auth: `POST /api/admin/auth/login`, `/logout`, `/password`
- `GET /api/admin/dashboard`
- Spinners: `GET|POST /api/admin/spinners`, `GET|PUT|DELETE /api/admin/spinners/:id`, `POST …/:id/publish`, `POST …/:id/state` (`pause|resume|deactivate|archive|reopen`), `POST …/:id/duplicate`, `GET …/:id/preview`
- Offers: `GET|POST …/:id/offers`, `PUT|DELETE …/:id/offers/:offerId`, `POST …/:id/offers/reorder`
- Participants and results: `GET /api/admin/users`, `GET /api/admin/winners` (filters: `q, spinnerId, offerId, status, from, to`), `PATCH /api/admin/results/:id` (mark redeemed)
- Reports: `GET /api/admin/reports?spinnerId=…`, `GET /api/admin/reports/export?type=participants|winners|spinner`
- Settings and uploads: `GET|PUT /api/admin/settings`, `POST /api/admin/uploads`

## Deployment notes

- Set `SESSION_SECRET` (32+ random characters) and a strong `ADMIN_PASSWORD`. The app will not start admin sessions in production without `SESSION_SECRET`.
- Point `DATA_DIR` at **persistent** storage, such as a mounted volume. Don't use the build directory or an ephemeral container filesystem.
- Run a **single instance**. The JSON store and the in-memory rate limiter are per server. For multiple instances or serverless, move to PostgreSQL and a shared rate limiter such as Redis.
- Serve over HTTPS. Cookies are `Secure` in production.
- Schedule `npm run backup` and copy the backups off the server.
