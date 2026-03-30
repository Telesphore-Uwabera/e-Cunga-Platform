# e-CUNGA Platform

`e-CUNGA` is a prototype inventory and procurement workflow for healthcare-style operations: stock with min/max and expiry, requisitions, supervisor approval, supplier proformas, accountant payment, and document closure.

## Overview

The product story on the frontend:

- **Clerk** maintains stock, logs consumption, requests materials, tracks expiry, and follows invoices tied to requisitions.
- **Supervisor** sees stock and usage summaries, approves requests, monitors invoices/documents, and exports reports.
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
| **Menu**: company branding, logout, notifications, messages, **ENG / KINY** | **Partial** | **Logout**, **notifications**, **messages**, **ENG/KINY**, theme toggle: **AppShell**. **Supplier** gets **company-style** sidebar title; other roles show **e-CUNGA** + user (not full co-brand on every role). |
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

- **React** + **Vite** frontend  
- **React Router** for marketing auth routes and `/app/:role/:segment`  
- **Node.js** + **Express** backend (`server/`)  
- **Demo auth** in memory for register/login (`demoAuthStore`)  
- **Client mock portal** (`mockPortal.js` + `localStorage`) drives most **in-app** workflow demos without requiring MongoDB for UI walkthroughs  

## Project structure

```text
.
|-- client/                 # React frontend
|   |-- src/layouts/       # AppShell, MainLayout, workspace quick rail (workspaceRail.js)
|   |-- src/pages/app/      # Role dashboards (clerk, supervisor, accountant, supplier, admin)
|   `-- src/data/mockPortal.js
|-- server/                 # Express API
`-- package.json
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
- API on port **5001** (see `client` env / `vite` proxy if configured)

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

## Demo credentials

Password for all seeded accounts: **`Demo@1234`**

| Role | Email |
|------|--------|
| Admin | `admin@ecunga.com` |
| Clerk | `clerk.one@ecunga.com` |
| Supervisor | `supervisor@ecunga.com` |
| Accountant | `accountant@ecunga.com` |
| Supplier | `supplier@ecunga.com` |

**New registration:** creates a real **admin** user in the demo auth store. The **rich inventory/requisition UI** still loads **mock portal data** from the browser (`localStorage`) unless you integrate API persistence—so new tenants see the **same seeded workspace** until the backend and client state are wired together.

## Current status (honest summary)

- **Frontend prototype:** Role dashboards, navigation, bilingual shell (**ENG / KINY**), quick **context rail** per page, supplier redesign, and most **functional flows** work end-to-end on **mock data**.  
- **Gaps to tighten:** (1) **Weekly** supervisor usage = add **date filters** on consumptions. (2) Clerk analytics chart = drive from **real time-bucketed** consumption. (3) **Visual spec** — optional realignment if the product must match a sky-blue-first brief instead of the **theme.css** palette above. (4) **Co-brand** sidebar for all roles if required like supplier. (5) **Register → isolated tenant data** needs API + persistence instead of shared mock seed only.

This README reflects the **frontend** as built; production hardening (auth, multi-tenant data, real file uploads) is out of scope for the current demo layer unless you extend the server and replace `mockPortal` with live APIs.
