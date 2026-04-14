# e-Cunga Portal

`e-Cunga` is a prototype inventory and procurement workflow for healthcare-style operations: stock with min/max and expiry, requisitions, supervisor approval, supplier proformas, accountant payment, and document closure.

### Development focus

The **React client** is the primary product surface today: full role-based portals, bilingual shell, and end-to-end flows driven by **`mockPortal.js`** (browser state). **Backend work is now the main engineering track**: grow the Express API, persist multi-tenant domain data (inventory, requisitions, approvals, billing), and replace mock calls with real endpoints via the shared **`api/client.js`** helper.

## Overview

The product story on the frontend:

- **Clerk** maintains stock, logs consumption, requests materials, tracks expiry, and follows invoices tied to requisitions.
- **Supervisor** sees stock and usage summaries, approves requests, monitors invoices/documents, and exports reports. For **their company workspace**, they **invite and manage** registered **clerks**, **accountants**, and **suppliers** (activate / deactivate); **admin** and **supervisor** accounts are not editable from this screen (see **Team** in the supervisor nav and `server/src/routes/workspace.routes.js`).
- **Accountant** reviews proformas, approves or rejects, marks payment (which notifies the supplier in the mock layer).
- **Supplier** submits proformas, sees approved/rejected proformas, fulfils with delivery note + official final invoice, and views history.
- **Admin** manages users (within a seat limit), company settings, RBAC view, analytics, notifications center, and help.

## Entry points (portal description)

| Requirement | Status | Notes |
|-------------|--------|--------|
| **Register your company** and **Log in** | **Yes** | Marketing site: header has **Sign In** + **Get Started** (`/login`, `/register`). Hero calls out **Register your company**, **Log in**, and **Book Demo**. Register form ends with a **Sign in** link. |
| After register → full **company dashboard** | **Yes (admin)** | `POST /auth/register` creates the first user as **`admin`** (`server/src/lib/demoAuthStore.js`). They land on `/app/admin/dashboard`. |
| Register **stock items** with **min / max** and **expiration** | **Yes (demo)** | Seed data and clerk **Inventory** flows use `minThreshold`, `maxThreshold`, `expiryDate`. Clerks can add stock via the mock portal (`addStockItem`). |
| **Team up to 10** (clerk, supervisor, accountant, supplier) | **Yes (enforced in UI)** | `company.usersLimit` is **10** in the mock portal; **User management** blocks invites past the limit. |
| **Unique dashboard per role** | **Yes** | Routes under `/app/:role/:segment` with role-specific nav and pages (`RoleDashboard.jsx`, `NAV_BY_ROLE` in `client/src/constants/rbac.js`). |

## Role feature checklist (frontend)

### Supervisor

| Requirement | Status | Where / notes |
|-------------|--------|----------------|
| Current stock with **numbers and units** (kg, bottles, …) | **Yes** | **Inventory** (`SupervisorVisibility`) and dashboard KPIs use `quantity` + `unit` from `stockItems`. |
| Summary of **each inventory clerk** (lab / ward style) | **Yes** | **Dashboard** → “Inventory Clerk Dashboard Access” cards (location, items, units, low stock, pending). |
| **Invoices & supporting documents** from finance angle | **Yes** | **Monitoring** + finance card on dashboard; invoice list tied to `mockPortal` invoices. |
| **Weekly top 10** most used items | **Partial** | UI section exists and lists **top 10 by total consumption** in mock data; labels say “weekly” but values are **not calendar-filtered to the current week** yet. |
| **Weekly latest** used items | **Partial** | Shows **latest consumption events** (not strictly “this week” only). |
| **Downloadable monthly report** (per clerk) | **Yes** | **Dashboard** → “Download Monthly Report” builds a **CSV** (`supervisor-monthly-clerk-report.csv`). |
| **Clerks, accountants, suppliers** under the company account | **Yes** | **Team** (`SupervisorTeam`): invite **clerk / accountant / supplier**, optional email OTP onboarding; **Activate / Deactivate** those roles. Same **companyId** as the supervisor; cannot toggle **admin** or **supervisor** users (`workspace.routes.js`). |
| **Menu**: company branding, logout, notifications, messages, **ENG / KINY** | **Partial** | **Logout**, **notifications**, **messages**, **ENG/KINY**, theme toggle: **AppShell**. **Supplier** gets **company-style** sidebar title; other roles show **e-Cunga** + user (not full co-brand on every role). |
| **Footer** | **Yes** | In-app **AppShell** footer: portal log line, user, support window. Marketing **MainLayout** footer on public pages. |

### Inventory clerk

| Requirement | Status | Where / notes |
|-------------|--------|----------------|
| **Total requested materials per month** | **Yes** | **Dashboard** stats: current month’s request count and line quantities (`monthlyRequests`, `monthlyRequestedMaterials`). |
| **List of materials in stock** | **Yes** | **Inventory list**. |
| **Add / bill material consumed** (same day) | **Yes** | **Stock operations** + **Usage** (`ClerkRequests`, `ClerkUsage`, consumptions in mock portal). |
| **Near expiry (~1 month)** | **Yes** | **Expiry tracking** (`ClerkExpiry`) surfaces items in a forward window. |
| **Proforma and final invoice** per request journey | **Yes** | **Billing items** (`ClerkDocuments`) ties into shared invoice/requisition mock state. |
| **Graph: materials vs time**, day / week granularity | **Partial** | **Analytics** (`ClerkAlerts`): **day / week** toggles and chart **copy** match the spec; plotted series is still **illustrative** (not a full per-material time-series from live aggregates). |
| Menu + **footer** as above | **Yes** | Same shell; footer on app layout. |

### Accountant

| Requirement | Status | Where / notes |
|-------------|--------|----------------|
| Approved vs **rejected / pending** materials | **Yes** | **Pending requests**, **Invoice management** with approve/reject (`accountantReviewInvoice`). |
| **Accepted proforma** queue | **Yes** | Workflow states `proformaApproved`, payment step. |
| **Payment / agree** and **pay invoice** | **Yes** | **Payment processing** (`markInvoicePaid`). |
| **Notify supplier** on pay | **Yes** | Mock layer adds supplier **notification** + **message** on pay (`mockPortal.js`). |

### Supplier

| Requirement | Status | Where / notes |
|-------------|--------|----------------|
| **Approved proforma** | **Yes** | Dedicated **Approved proformas** page. |
| **Rejected proforma** | **Yes** | **Rejected proformas** page + seed examples. |
| **History of supplied materials** | **Yes** | **Supply history** with lines + document names. |
| **Official invoice** attachment | **Yes** | **Delivery & official invoice** (delivery note + final invoice). |
| Menu (co-brand, logout, notifications, messages, ENG/KINY) | **Yes** | **Supplier** sidebar branding + AppShell chrome. |

## Visual standards

Design tokens live in `client/src/theme.css`. **Light** is the default; **dark** applies when the document root has `data-ec-theme="dark"` (see `client/src/utils/documentTheme.js`).

### Colors in use (light theme, `:root`)

| Token | Value | Typical use |
|--------|--------|-------------|
| `--ec-primary` | `#692751` | Links, primary accent (plum / burgundy) |
| `--ec-primary-light` | `#3a6280` | Secondary accent (slate blue) |
| `--ec-primary-dark` | `#121c2a` | Deep navy for strong chrome |
| `--ec-bg-soft` | `#eff4ff` | Page / app background (soft blue-white) |
| `--ec-surface` | `#ffffff` | Cards, main panels |
| `--ec-surface-soft` | `#f7f9fd` | Softer panels |
| `--ec-surface-strong` | `#121c2a` | Sidebar / dark bars (with inverse text) |
| `--ec-text` | `#514349` | Body text |
| `--ec-muted` | `#83737a` | Secondary text |
| `--ec-border` | `#d5c1c9` | Borders, dividers |
| `--ec-footer-bg` | `#121c2a` | Footer background |
| `--ec-on-primary` | `#ffffff` | Text on primary-colored controls |
| `--ec-gradient-hero` | `#121c2a` | Hero / gradient start |
| `--ec-gradient-cta` | `#692751` | Gradient / CTA emphasis |

### Colors in use (dark theme, `data-ec-theme="dark"`)

| Token | Value | Notes |
|--------|--------|--------|
| `--ec-primary` | `#d5c1c9` | Lighter accent on dark surfaces |
| `--ec-primary-light` | `#8ab1cf` | Cool highlight |
| `--ec-bg-soft` | `#0d1724` | App background |
| `--ec-surface` | `#121c2a` | Main surfaces |
| `--ec-surface-soft` | `#162233` | Elevated / nested surfaces |
| `--ec-surface-strong` | `#09111c` | Strongest chrome |
| `--ec-text` | `#eff4ff` | Primary text |
| `--ec-muted` | `#bdaeb5` | Muted text |
| `--ec-border` | `#3a4a5a` | Borders |
| `--ec-footer-bg` | `#09111c` | Footer |
| `--ec-on-primary` | `#09111c` | Text on light primary in dark mode |
| `--ec-gradient-cta` | `#2b1830` | CTA / gradient accent |

### Spec vs build (layout & original brief)

| Spec | Current build |
|------|----------------|
| **Sky blue, white, gray** as main palette | The UI uses the **token set above**: **plum** primary (`#692751`), **navy** strong surfaces (`#121c2a`), **soft blue-white** page wash (`#eff4ff`), and **slate blue** secondary (`#3a6280`). That differs from a sky-blue-first brand palette; changing it would be a token + component pass. |
| Clear **header / body / footer** | **Public site**: `MainLayout` header + main + footer. **App**: `AppShell` top bar + content grid + footer. |
| Clear **font sizes** | Typography scales via shared CSS modules and `theme.css`; body copy is kept readable on dashboard cards and tables. |

**Summary:** Layout is organised and consistent; **colors** are defined by `theme.css` as documented in the tables above.

## Technical stack

| Layer | Technology | Notes |
|--------|------------|--------|
| **Frontend** | React, Vite, React Router | Marketing + `/app/:role/:segment` portal |
| **Backend** | Node.js, Express, Mongoose (optional) | `server/` — auth always; team / activity / invoices when DB is connected |
| **Auth (today)** | JWT + in-memory or Mongo-backed users | `demoAuthStore` when not fully on DB; expand as persistence lands |
| **In-app data (today)** | `mockPortal.js` + `localStorage` | **Target:** same domain entities served by APIs and consumed through `client/src/api/client.js` |

## Backend (`server/`)

The API boots in one of two modes (see `GET /api/health`):

- **Demo mode** — No `MONGODB_URI`: auth routes still run; `/api/team`, `/api/activity`, and `/api/invoices` return **503** with a clear message.
- **Database mode** — Valid `MONGODB_URI`: Mongoose connects and the above routes are mounted.

**Atlas / collections:** With MongoDB connected, **`POST /api/database/sync`** creates each model’s collection (if missing) and runs **`syncIndexes()`** on all schemas. Call it as an **admin** (Bearer JWT), or send header **`X-Database-Setup-Key`** when **`DATABASE_SETUP_KEY`** is set in `.env`. **`GET /api/database/status`** lists collection names. Optional **`SYNC_DB_ON_START=true`** runs the same sync on server boot (see `server/.env.example`).

**Layout today:**

```text
server/src/
|-- app.js              # Express app, CORS, DB gate for routes
|-- index.js            # HTTP listener
|-- lib/                # authToken.js, demoAuthStore.js
|-- middleware/         # auth.js
|-- models/             # Company, User, stock, requisitions, invoices, portal, …
|-- routes/             # auth, database, portal, stock, requisitions, …
`-- services/           # activity, portalState, databaseCollections, …
```

**Suggested backend milestones (in rough order):**

1. **Environment** — Document `.env` (`MONGODB_URI`, JWT secret, port); verify `npm run dev:server` + health check.
2. **Tenancy** — Company/workspace model; tie users and future collections to a tenant id; align with “register company → admin” from the product story.
3. **Domain APIs** — Inventory, requisitions, consumptions, proformas, payments, notifications—mirror the shapes and flows already modeled in `mockPortal.js`.
4. **Client integration** — Replace or gate mock reads/writes behind `apiFetch`; keep mocks for offline demos if useful.
5. **Hardening** — Validation, rate limits, file uploads for documents, production logging and error contracts.

## Project structure (monorepo)

```text
.
|-- client/                      # React frontend (Vite)
|   |-- src/api/client.js        # fetch wrapper, Bearer token, /api prefix
|   |-- src/layouts/             # AppShell, MainLayout, workspaceRail.js
|   |-- src/pages/app/           # Role dashboards
|   `-- src/data/mockPortal.js   # Prototype state (to be superseded by APIs)
|-- server/                      # Express API
`-- package.json                 # workspaces: client, server; dev runs both
```

## Getting started

### Install

```bash
npm install
```

### Development (client + server)

```bash
npm run dev
```

- Vite dev server (e.g. `http://localhost:5173`)  
- API on port **5000** (set `PORT` in `server/.env`; Vite proxies `/api` — optional `client/.env` with `VITE_API_URL=http://localhost:5000`)  
- For **database-backed** routes, set `MONGODB_URI` in `server/.env` and confirm `GET /api/health` reports `mode: "database"`.

### Build frontend

```bash
npm run build
```

### Backend only

```bash
npm run start
```

## Scripts

- `npm run dev` — client + server  
- `npm run dev:client` — frontend only  
- `npm run dev:server` — API only  
- `npm run build` — production build of the client  
- `npm run start` — start the server  

## Workflow model (data story)

1. Clerk creates/updates stock and submits a **requisition**.  
2. Supervisor **approves** or **rejects** → supplier queue opens on approve.  
3. Supplier submits **proforma**.  
4. Accountant **approves/rejects** proforma; on approve, **payment** can be recorded.  
5. Supplier attaches **delivery note** and **final invoice** → workflow **closed**.  
6. Admin monitors users, settings, reports, and **notifications center**.

## Production deploy (Netlify + Render)

### Live URLs

- **Frontend (Netlify):** [https://ecunga.netlify.app/](https://ecunga.netlify.app/)
- **API (Render):** [https://e-cunga-platform.onrender.com](https://e-cunga-platform.onrender.com)

### Render (API)

1. Create a **Web Service** (or use **Blueprint** with root `render.yaml`).
2. **Root directory:** `server`
3. **Build command:** `npm install`
4. **Start command:** `npm start`
5. **Health check path:** `/api/health`

**Environment variables (Render dashboard):**

| Variable | Required | Notes |
|----------|----------|--------|
| `MONGODB_URI` | Strongly recommended | Atlas or other MongoDB connection string |
| `JWT_SECRET` | Yes (production) | Long random string |
| `PORT` | No | Render sets this automatically |
| `CLIENT_URL` | Recommended | `https://ecunga.netlify.app` (no trailing slash) — CORS / links |
| `CLOUDINARY_*` | Optional | Chat / media uploads |
| `AUTO_SEED_DEMO_IF_EMPTY` | Optional | `true` seeds demo users when DB is empty |
| `DEMO_PASSWORD`, `DEMO_EMAIL_*` | Optional | Match seed / demo logins |

Use the Render service URL above for **`VITE_API_URL`** on Netlify. Free tier **spins down** when idle; the first request after idle may be slow.

### Netlify (SPA)

1. **New site from Git** → this repository.
2. **Base directory:** `client` (root `netlify.toml` sets `base = "client"`.)
3. **Build command:** `npm run build` · **Publish directory:** `dist` (relative to `client`)

**Required build environment:**

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://e-cunga-platform.onrender.com` |

No trailing slash — baked into the JS bundle at build time. **`NODE_VERSION`** `20` is set in `netlify.toml`.

### Smoke test

1. Open `https://e-cunga-platform.onrender.com/api/health` — expect JSON with `ok: true`.
2. Open the Netlify URL → log in; the browser network tab should call the Render API host, not `/api` on Netlify.

### Production vs local env

- **Production:** Netlify **`VITE_API_URL`** → Render API origin; Render **`CLIENT_URL`** → Netlify site.
- **Local:** API on port **5000**, optional `client/.env` with `VITE_API_URL=http://localhost:5000` (see `client/.env.example`); Vite proxies `/api` during `npm run dev`.

## Demo credentials

Do **not** commit real secrets. Copy **`server/.env.example`** to **`server/.env`** and set:

- **`DEMO_PASSWORD`** — shared password for all demo accounts  
- **`DEMO_EMAIL_ADMIN`**, **`DEMO_EMAIL_CLERK_ONE`**, **`DEMO_EMAIL_CLERK_TWO`**, **`DEMO_EMAIL_SUPERVISOR`**, **`DEMO_EMAIL_ACCOUNTANT`**, **`DEMO_EMAIL_SUPPLIER`** — optional overrides (defaults match the former built-in demo list)

With the API running, **`GET /api/auth/demo-credentials`** returns the configured password and account emails (for local tooling / login prefill). The login page loads these defaults when the endpoint is reachable.

When **`MONGODB_URI`** is set, login checks **MongoDB users**, not the in-memory demo store. Use **`SEED_DEMO_WORKSPACE=true`** once, or **`AUTO_SEED_DEMO_IF_EMPTY=true`** (see `server/.env.example`) so a new Atlas database gets demo accounts and **`admin@ecunga.com`** + **`DEMO_PASSWORD`** work.

**New registration:** creates an **admin** user via the server auth path used in demo; until tenant-scoped APIs back the portal, the **inventory and workflow UI** may still show **shared mock seed** data from `localStorage`. Backend work should make **per-company data** the default.

## Current status (honest summary)

- **Frontend:** Mature **prototype** — role dashboards, **ENG / KINY**, context rail, and flows on **mock data**; some metrics (e.g. “weekly” usage) are still **not calendar-strict** until backed by real aggregates.  
- **Backend:** **Active development area** — Express + optional **MongoDB**; auth and a small set of routes exist; **most portal behavior is not persisted on the server yet**. Priority is **tenant model + domain APIs + client wiring** so `mockPortal` becomes optional.  
- **Product polish (can run in parallel):** supervisor weekly filters, clerk charts from real buckets, optional palette vs `theme.css`, co-brand parity across roles.

This README is written for contributors **starting or extending the backend** while the client remains the reference for domain behavior until APIs are complete.
