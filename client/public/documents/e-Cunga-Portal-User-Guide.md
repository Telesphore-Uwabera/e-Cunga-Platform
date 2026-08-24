# e-Cunga Portal — Complete User Guide

> **Version:** 2026 · **Languages:** English / Kinyarwanda · **Support:** Sun–Fri, 8 am–6 pm

---

## Table of Contents

1. [What is e-Cunga Portal?](#1-what-is-e-cunga-portal)
2. [Visiting the Site for the First Time](#2-visiting-the-site-for-the-first-time)
3. [Registration & Account Activation](#3-registration--account-activation)
4. [Signing In](#4-signing-in)
5. [The Portal Shell — Common to All Roles](#5-the-portal-shell--common-to-all-roles)
6. [Inventory Clerk](#6-inventory-clerk)
7. [Supervisor](#7-supervisor)
8. [Accountant](#8-accountant)
9. [Supplier](#9-supplier)
10. [Cross-Role Workflow — Full Procurement Lifecycle](#10-cross-role-workflow--full-procurement-lifecycle)
11. [Cunga AI Insights](#11-cunga-ai-insights)
12. [Messaging & Notifications](#12-messaging--notifications)
13. [Account Settings & Profile](#13-account-settings--profile)
14. [Language Switching](#14-language-switching)
15. [Pricing Plans](#15-pricing-plans)
16. [Troubleshooting & Support](#16-troubleshooting--support)
17. [Auto Requisition](#17-auto-requisition)
18. [Auto Notifications](#18-auto-notifications)
19. [Min/Max Logic](#19-minmax-logic)
20. [AI Recommendations](#20-ai-recommendations)
21. [Internationalisation (i18n)](#21-internationalisation-i18n)

---

## 1. What is e-Cunga Portal?

e-Cunga Portal is a cloud-based inventory and procurement management system built for
hospitals, clinics, hotels, retail chains, government institutions, and any organisation that
needs to control stock and manage supplier relationships in one place.

**Five roles work together in one workspace:**

| Role | Responsibility |
|---|---|
| **Inventory Clerk** | Registers stock, records usage, raises requisitions |
| **Supervisor** | Approves requests, monitors inventory, manages team |
| **Accountant** | Handles proforma invoices, processes payments |
| **Supplier** | Receives orders, submits proformas, manages catalog |
| **Admin** | Manages users, roles, company settings |

Every action — from raising a stock request to paying a supplier invoice — is tracked,
timestamped, and visible to the right people. The portal supports both **English** and
**Kinyarwanda**.

---

## 2. Visiting the Site for the First Time

### Public Landing Page — ecunga.com

When you open the website without signing in, you land on the **public home page**.
It contains:

- **Hero section** — explains what the portal does; two call-to-action buttons:
  - **"Register your company"** — starts company registration
  - **"Log in"** — goes to the sign-in page
- **Live workspace preview panel** — shows a real-time snapshot of tracked items,
  pending approvals, and supplier actions from the demo workspace.
- **Features section** — explains the four pillars: Track stock, Clear roles,
  Simple reports, Connect with suppliers.
- **Sectors section** — filter cards for Healthcare, Hospitality, Retail, and
  Government / Institutions showing how each sector uses the portal.
- **Plans & Pricing** — Essential and Professional plan pricing in RWF.
- **Navigation bar** — links to Home, About Us, Sectors, Pricing, Contact.

### Other Public Pages

| Page | URL | Content |
|---|---|---|
| Pricing | /pricing | Monthly / annual plan comparison |
| Contact | /contact | Support form and office hours |
| Privacy Policy | /privacy | Data handling and GDPR statement |
| Terms of Service | /terms | Platform usage rules |
| Cookie Policy | /cookies | Cookie types and consent |

---

## 3. Registration & Account Activation

### 3a. Company Registration (Admin / Workspace Owner)

The person who registers a company becomes the **first Admin** of that workspace.

1. Click **"Register your company"** on the home page or go to **/register**.
2. Fill in the registration form:
   - Company / institution name
   - Industry (Healthcare, Hotel/Hospitality, Retail, Industry/Manufacturing,
     Agribusiness, Government/NGO, Laboratory, Other)
   - First name and last name
   - Your position in the company
   - Work email address
   - Phone number
   - Password (minimum 8 characters)
   - Confirm password
   - Logo upload (optional — stored on Cloudinary)
   - Tick: *"I agree to the Terms & Regulations"*
3. Click **"Create account"**.
4. You see a confirmation: *"Registration sent — You can sign in after an admin
   approves your company."*
5. An e-Cunga platform administrator reviews your application. Once approved,
   all users in your company are activated and can sign in.

> **Note:** Company registrations are reviewed manually by the e-Cunga operations
> team. You will receive an email when your company is approved.

### 3b. Invited Users — Clerks, Accountants, Suppliers

These roles do not self-register. They are **invited by a Supervisor or Admin**:

1. The Supervisor/Admin sends an invitation from the portal.
2. The invited user receives an email with a **6-digit activation code**.
3. The user opens **/activate-account** (link is in the email).
4. They enter the 6-digit code and choose a password.
5. They click **"Save password and finish"**.
6. They can now sign in immediately.

> If the code expires, click **"Send code again"** on the activation page.

### 3c. Supplier Self-Registration

Suppliers can also register independently:

1. They fill in the same registration form, selecting their company type as
   a supplier.
2. Their registration goes into **"pending"** status.
3. A Supervisor or platform Admin approves them from the **New Companies** panel.
4. Once approved, the supplier can sign in.

---

## 4. Signing In

Go to **/login** or click **"Log in"** from the home page.

### Email & Password Login

1. Enter your **work email address**.
2. Enter your **password**.
3. Optionally tick **"Keep me logged in for 30 days"** — this keeps the session
   active on your browser.
4. Click **"Login"**.

### Google / Microsoft SSO

Click the **Google** or **Microsoft** button under "OR CONTINUE WITH". You are
redirected to the provider's sign-in page. On return, you land directly in your
workspace dashboard.

### After Login

The portal reads your role from the server and redirects you to your role's home:

- Clerk → `/app/clerk/dashboard`
- Supervisor → `/app/supervisor/dashboard`
- Accountant → `/app/accountant/dashboard`
- Supplier → `/app/supplier/dashboard`
- Admin → `/app/admin/dashboard`

### Forgotten Password

1. Click **"Forgot password?"** on the login page.
2. Enter your email address and click **"Send Reset Link"**.
3. Check your email for the reset link.
4. Open the link, enter a new password (min 8 characters), confirm it.
5. Click **"Reset Password"**. You are redirected to sign in.

### Common Login Errors

| Message | Cause | Fix |
|---|---|---|
| "Sign-in failed. Check your email and password." | Wrong credentials | Try again or reset password |
| "Your company is not approved yet." | Pending registration | Wait for admin approval email |
| "Use the code in your email." | Invited user, not activated | Open /activate-account |

---

## 5. The Portal Shell — Common to All Roles

After signing in, every user sees the same outer shell regardless of role.

### Top Bar

| Element | Purpose |
|---|---|
| **e-Cunga logo** | Goes back to your dashboard |
| **Global search** | Search stock items, orders, bills, and people across the workspace |
| **Moon/Sun icon** | Toggle Light / Dark / System theme |
| **Bell icon** | Notification center — workspace and system alerts |
| **Chat bubble** | Portal messaging hub — internal team messages |
| **"Cunga AI" button** | Opens the live AI insight panel for your role |
| **ENG / KINY** | Language switcher — switch between English and Kinyarwanda |
| **Avatar / name** | Account menu: My profile, Account settings, Sign out |

### Left Sidebar Navigation

The sidebar shows only the pages relevant to your role. Every role has a
**Dashboard** as the first item. The sidebar is collapsible on smaller screens.

### Context Panel (Right Rail)

Many pages show a context panel on the right side with:
- Page eyebrow and title
- Key metrics chips
- Related pages shortcuts
- Cunga AI insight card
- Help text for the current page

---

## 6. Inventory Clerk

The Inventory Clerk is the frontline user of the portal. They manage physical stock,
record consumption, and raise purchase requests.

**Navigation menu:** Dashboard · Inventory list · Expiry tracking · Request materials ·
Reports · Record usage · Full Inventory Movement · Settings

---

### 6.1 Dashboard

The clerk dashboard gives an at-a-glance status of the workspace:

- **Stock summary cards** — total SKUs, items below minimum threshold, items
  expiring within 30 days, total quantity on hand.
- **Cunga AI stock guidance** — AI-generated, role-scoped advice based on live
  stock data. Highlights low-stock items by name, expiry pressure, and suggests
  requisitions to raise today.
- **Recent activity feed** — latest stock changes and usage events.
- **Quick actions** — "Add item", "Request materials", "Record usage".
- **Requisition status summary** — how many of your requests are pending, approved,
  rejected, or closed.

---

### 6.2 Inventory List

This is the full catalogue of stock items visible to the clerk based on their
assigned **location** and **department**.

**What you can do:**

- **Search** by item name, SKU, category, or subcategory.
- **Filter** by category, location, stock status (All / Low stock / Overstock /
  In stock).
- **View item details** — name, SKU, quantity, minimum threshold, maximum threshold,
  unit, location, expiry date, batch number, category, department.
- **Add a new item** — fill in name, SKU, category, subcategory, unit, initial
  quantity, min/max thresholds, location, expiry date, batch number.
- **Edit item** — request a quantity/threshold change. This creates a
  **Stock Edit Request** that needs supervisor approval.
- **Record consumption** directly from the item card.
- **Export** the full stock list to Excel.

> **Low stock alert:** Items at or below their minimum threshold are highlighted
> in red. The Cunga AI insight names these items specifically.

---

### 6.3 Expiry Tracking

Shows all stock items that have an expiry date, sorted by urgency.

- **Critical (red)** — already expired.
- **Warning (orange)** — expiring within 7 days.
- **Attention (yellow)** — expiring within 30 days.
- **Safe (green)** — expiring after 30 days.

**Actions:**
- Filter by expiry urgency level.
- Export expiry report to Excel.
- Navigate to the item to update stock or raise a requisition.

> Regularly checking this page prevents waste and ensures compliance in
> healthcare and food-service environments.

---

### 6.4 Request Materials (Requisitions)

This is where the clerk creates **purchase requisitions** — formal requests for
the organisation to procure items from a supplier.

#### Creating a Requisition

1. Click **"New requisition"** or **"Request materials"**.
2. Fill in:
   - **Title** — descriptive name for the request.
   - **Location** — the warehouse or department this is for.
   - **Requesting department** — cost centre.
   - **Priority** — Low / Normal / High / Critical.
   - **Justification** — reason for the request.
   - **Line items** — add one row per item:
     - Description (item name)
     - Quantity needed
     - Unit (pieces, kg, litres, etc.)
     - Estimated unit cost (RWF)
3. Click **"Submit"**.

The requisition moves to status **"Submitted"** and appears in the Supervisor's
approval queue.

#### Requisition Statuses (what the clerk sees)

| Status | Meaning |
|---|---|
| Draft | Saved but not yet submitted |
| Submitted | Sent to supervisor for review |
| Approved (External) | Supervisor approved, finding a supplier |
| Sent to Supplier | Supervisor forwarded to a supplier |
| Proforma Awaiting Clerk | Supplier sent a proforma — your review needed |
| Proforma Received | Proforma acknowledged |
| Proforma Approved | Proforma accepted, waiting for delivery |
| Delivery Note Attached | Items delivered, note uploaded |
| Final Invoice Received | Supplier's final invoice received |
| Paid | Payment processed |
| Partially Paid | Part of the invoice was paid |
| Credit Purchase | Purchased on credit |
| Closed | Process complete |
| Rejected | Request was declined |
| Cancelled | Request was cancelled |

#### Editing a Draft

Requisitions in **Draft** status can be edited fully. Click the pencil icon
to reopen the edit modal. Once submitted, only the supervisor can act on it.

#### Viewing Requisition History

All your submitted requisitions appear in a list with filters by status, date,
and keyword. Click any row to view the full detail, including supervisor notes,
supplier name, and attached documents (proforma PDF, delivery note, final invoice).

---

### 6.5 Reports

The clerk reports page gives a deep analytics view of your own stock and usage.

**Period filter:** 7 days · 30 days · 90 days · All time · Custom date range

**Sections:**

- **Consumption trend chart** — SVG line chart of how much stock you consumed
  over time. Toggle between daily and weekly granularity.
- **Usage by item** — searchable ranked table of items by total quantity consumed.
- **Requisition stats** — your personal approval rate, total requests, approved,
  rejected, pending counts.
- **Anomaly alerts** — auto-detected issues: stockouts, low stock, expiring items,
  unusually high consumption spikes.
- **Inventory Movement** — search by product name or SKU to see every IN and OUT
  event for that item in the selected period. Clickable product cards show net
  flow at a glance.
- **Consumption history** — full table of all your recorded consumptions.
- **Top 20 most used items by month** — ranked table filterable by calendar month.
- **Stock prediction** — estimated days remaining for each item based on
  last-30-day consumption velocity.
- **Export** — Excel download of consumption history, movement report, top items,
  and PDF analytics report.

---

### 6.6 Record Usage

Used to log that stock was consumed or used in operations.

1. Click **"Record usage"** or select it from the nav.
2. Search for the item by name or SKU.
3. Enter:
   - Quantity consumed
   - Purpose / reason
   - Date (defaults to today)
4. Click **"Record"**.

The item's on-hand quantity is reduced immediately. The event appears in your
consumption history and feeds the reports page.

**Consumption kinds:**
- **Usage** — standard operational use.
- **Bill** — chargeable consumption tied to a billing event.
- **General** — any other reduction.

---

### 6.7 Full Inventory Movement (Documents)

This page shows the **complete movement ledger** for all stock items you have
access to — every addition, consumption, adjustment, and transfer recorded in
the system with timestamps and clerk names.

- Filter by item, date range, movement type, location.
- Download the full ledger as Excel.

---

### 6.8 Settings

Personal settings for the clerk:

- **Profile** — update full name, phone, job title, department, location.
- **Password** — change your password.
- **Notification preferences** — choose what email alerts you receive.
- **Theme** — Light / Dark / System (also accessible from the top bar avatar).

---

## 7. Supervisor

The Supervisor oversees the entire inventory and procurement workflow. They approve
requests, monitor stock, manage team members, and connect with suppliers.

**Navigation menu:** Dashboard · Clerks · Accountants · Suppliers · Marketplace ·
Inventory · Pending Approval · Monitoring · Reports · Team · Company settings

---

### 7.1 Dashboard

The supervisor dashboard is the command centre:

- **KPI strip** — inventory value, total SKUs, open requisitions, active invoices,
  workflow efficiency percentage.
- **Approval queue summary** — count of requests waiting for action, colour-coded
  by priority (Critical · High · Normal · Low).
- **Cunga AI insight card** — AI guidance focused on approval bottlenecks, critical
  priority requests, pending stock edit requests, and team activity trend.
- **Invoice trend chart** — 6-month rolling line chart of invoice values processed.
- **Category breakdown donut** — top product categories by SKU count.
- **Recent notifications** — latest alerts from clerks, suppliers, and the system.

---

### 7.2 Clerks

View and manage all clerk accounts in the workspace:

- See each clerk's name, email, location, department, last active date.
- **Invite a new clerk** — enter email, name, role, location, department;
  an activation email is sent automatically.
- **Deactivate / reactivate** a clerk account.
- View a clerk's requisition activity and stock history.
- Send a message to a clerk directly from this page.

---

### 7.3 Accountants

Same management view as Clerks but filtered to accountant role accounts:

- Invite new accountants via email.
- View accountant activity.
- Deactivate / reactivate accounts.

---

### 7.4 Suppliers

Manage the list of supplier accounts connected to your workspace:

- View each supplier's name, company, contact email, phone, catalog item count.
- **Invite a new supplier** — supplier receives activation email with a 6-digit code.
- View all requisitions linked to each supplier.
- See invoice history per supplier.
- Send a direct message to a supplier.
- **Deactivate** a supplier to stop receiving requests from them.

---

### 7.5 Marketplace (Supplier Directory)

Browse and discover verified suppliers across the e-Cunga ecosystem:

- Filter by product category, location, industry.
- View supplier profiles — company name, catalog, contact details.
- **Connect** with a new supplier — sends them an invitation to link to your workspace.
- Compare pricing across multiple suppliers for the same category.

> Access to the Marketplace requires the `suppliers:all` permission. The Admin
> can grant this in Roles & access.

---

### 7.6 Inventory (Visibility)

Full read-only view of all stock items across every location and department
in the company:

- Filter by category, warehouse/location, stock status (Low / Out / In stock),
  and item name/SKU search.
- See current quantity, minimum/maximum thresholds, expiry date, last updated.
- **Export** the full inventory list to Excel.
- **Approve or reject stock edit requests** raised by clerks.

---

### 7.7 Pending Approval (Requests)

This is the main daily workflow page for the supervisor.

#### Reviewing a Requisition

1. Requisitions in **"Submitted"** status appear in the queue.
2. Click a row to open the full detail.
3. Review: title, requesting clerk, location, department, priority, justification,
   line items with estimated costs, total estimated value.
4. Choose an action:
   - **Approve** — moves the requisition forward to find a supplier.
   - **Reject** — enter a rejection note; the clerk is notified.
   - **Forward to Supplier** — select a supplier from your list and send
     the requisition as an RFQ (Request for Quotation). Status becomes
     **"Sent to Supplier"**.

#### After Forwarding to Supplier

- Supplier submits a **proforma invoice**.
- Status becomes **"Proforma Received"**.
- Supervisor reviews the proforma and either:
  - **Approves** it (forwarded to Accountant for payment processing).
  - **Rejects** it (supplier is notified).

#### Filtering

Filter the approval queue by:
- Status (Submitted / Proforma Received / Sent to Supplier / etc.)
- Priority (Critical / High / Normal / Low)
- Warehouse / location
- Requesting clerk
- Date range

---

### 7.8 Monitoring (Invoices)

Live dashboard of all invoices in the system:

- Filter by status, supplier, date, amount range.
- See total pipeline value, paid/closed totals, overdue invoices.
- Click any invoice to view attached documents:
  proforma PDF, delivery note, final invoice file.
- **Mark as received** when goods arrive.
- View payment status in real time.

---

### 7.9 Reports

Comprehensive company-wide analytics.

**Period filter:** Last 30 days · Quarterly · Yearly · Custom date range (with
From / To date pickers)

**Sections:**

- **KPI strip** — inventory value, SKU count, requisition count, invoice count,
  workflow efficiency.
- **Invoice trend chart** — 6-month SVG line chart with hover tooltip.
- **Category donut** — top 5 product categories with percentage breakdown.
- **Waste & loss panel** — Damaged, Expired, Missing, Other signals with
  bar chart and donut.
- **Inventory Movement** — company-wide product movement search. Type a product
  name or SKU to see every IN (delivered via requisition) and OUT (consumed)
  event in the selected period. Product summary cards show net flow.
- **Requisition summary** — total, approved, rejected, pending counts; approval
  rate; average approval time in days.
- **Clerk performance table** — approval rate, total requisitions, average amount
  per clerk, sortable.
- **Supplier relationship report** — total requisitions per supplier, approval and
  rejection rates, total spend.
- **Export Excel** — full intelligence report with all sections.
- **Export PDF** — printable supervisor report.
- **Schedule weekly** — downloads a `.ics` calendar file for a recurring Monday
  8 am weekly review.

---

### 7.10 Team

Overview of all active users in the workspace:

- List of all clerks, accountants, suppliers in one view.
- Filter by role, location, active/inactive.
- Quick link to send a message to any team member.
- See last active date for each user.

---

### 7.11 Company Settings

Configure workspace-wide settings:

- **Company profile** — name, logo, address, tax ID, legal name, currency,
  language default.
- **Branding** — upload company logo (used on emails, PDFs, and the portal header).
- **Policies** — set default approval policies, budget limits, notification rules.

---

## 8. Accountant

The Accountant manages all financial documents — proforma invoices, final invoices,
partial payments, credit purchases, and reporting. They do not raise requisitions
but sit at the payment gate of every procurement cycle.

**Navigation menu:** Dashboard · Proforma invoices · Invoice management ·
Payment processing · Suppliers · Marketplace · Reports · Settings

---

### 8.1 Dashboard

- **Financial KPI strip** — total open invoice value, paid/closed totals,
  outstanding balance, payment rate percentage.
- **Overdue invoice alert** — count of invoices past their due date, shown in red.
- **Cunga AI guidance** — AI insight focused on overdue invoices, partially-paid
  follow-ups, proforma pipeline value, and what to prioritise today.
- **Quick actions** — navigate to proforma approvals, payment processing.

---

### 8.2 Proforma Invoices (Approvals)

When a supplier submits a proforma in response to a requisition, it lands here.

#### Reviewing a Proforma

1. Proformas in **"Proforma Received"** or **"Proforma Awaiting Clerk"** appear.
2. Click a row to open the full detail panel.
3. View:
   - Linked requisition title and requesting clerk.
   - Supplier name and contact.
   - Proforma PDF (click to preview or download).
   - Line items, unit prices, total amount in RWF.
   - Due date and payment deadline.
4. Choose an action:
   - **Approve proforma** — moves to "Proforma Approved"; supplier is notified.
   - **Reject proforma** — enter a note; supplier receives rejection notification.

#### After Proforma Approval

The process moves to delivery. Once goods are delivered and a delivery note is
uploaded, a final invoice arrives for payment.

---

### 8.3 Invoice Management

Full list of all invoices in the system — proforma and final — with powerful
filtering.

**Filters:**
- **Status** — All / Paid / Pending / Partial / Credit Purchase / Rejected
- **Transaction type** — Proforma / Final
- **Branch / location** — filter by requesting department or warehouse
- **Vendor search** — search by supplier name, transaction ID, or reference
- **Date range** — From / To date pickers with quick period buttons:
  Today · 7 days · 30 days · This month · Quarter · Year · Custom

**Invoice table columns:**
Transaction ID · Supplier · Branch · Amount (RWF) · Amount Paid · Balance Due ·
Payment Method · Due Date · Date

**Row-level actions:**
- **View document** — open attached proforma PDF, delivery note, or final invoice.
- **Record partial payment** — enter an amount and it is deducted from the balance.
- **Mark as paid** — when full payment is confirmed.

**Summary cards at the top:**
Clicking a card (Paid / Unpaid / Partial / Credit) drills into that specific
subset of invoices in the date range.

---

### 8.4 Payment Processing

Dedicated workflow for processing outstanding payments.

1. Find the invoice in the list (sorted: overdue first, then by due date).
2. Review: supplier, amount, balance due, due date.
3. Select **payment channel**:
   - Bank transfer
   - Mobile money
   - Cash
   - Cheque
   - Credit card
   - Other
4. Enter amount paid and upload payment proof (optional).
5. Click **"Process payment"**.

**Partial payments** reduce the balance due. The status changes to
**"Partially Paid"**. When fully paid the status becomes **"Paid"**.

**Credit purchases** — some invoices are purchased on credit.
Track them in the Credit Purchase tab until the balance is cleared.

---

### 8.5 Suppliers

View all suppliers connected to the workspace:

- Supplier name, company, email, phone, open invoice count.
- Click a supplier to see their full invoice history with your organisation.
- Send a message to a supplier directly from this page.

---

### 8.6 Marketplace

Same supplier directory available to supervisors — browse and discover new
verified suppliers by category.

---

### 8.7 Reports

Full financial reporting with all filters.

**Period presets:** Today · 7 days · 30 days · This month · Quarter · Year · Custom
(clicking a preset auto-fills the From/To date pickers)

**Sections:**

- **Summary KPI cards** — Paid total, Unpaid total, Partial balance, Credit balance
  (across all invoices, not date-filtered). Clicking a card shows a drill-down table.
- **Status donut chart** — Paid / Partial / Credit / Pending / Rejected slice
  breakdown as a visual chart with a legend.
- **Type breakdown** — top 5 invoice types by amount as a horizontal legend.
- **Outstanding vs MTD paid** — visual bar showing what percentage is still owed.
- **Vendor report table** — all invoices matching the current filters, paged,
  with all columns visible.
- **Inventory Movement section** — search by product name or SKU to see every
  IN/OUT movement for that item in the selected period, including which requisitions
  brought items in and which consumption events took them out.
- **Financial summary** — total invoices, total/paid/pending/rejected amounts,
  payment rate percentage.
- **Monthly breakdown** — month-by-month table of invoice totals, paid amounts,
  pending amounts, and invoice count.
- **Payment tracking** — all pending and partially-paid invoices sorted by urgency,
  with inline partial-payment action.

**Export options:**
- Download paid invoices (Excel)
- Download unpaid invoices (Excel)
- Download partial payments (Excel)
- Download credit purchases (Excel)
- Download financial summary (Excel)
- Download monthly report (Excel)
- Download payment tracking (Excel)

---

### 8.8 Settings

Same personal settings as other roles — profile, password, notification preferences.

---

## 9. Supplier

The Supplier is an external company that receives purchase orders, submits pricing
(proforma invoices), delivers goods, and gets paid through the portal. Everything
happens in one workspace — no email attachments needed.

**Navigation menu:** Dashboard · Supervisors · Request & Proformas · Invoice ·
Products · Reports · Delivery · Payments · Settings

---

### 9.1 Dashboard

- **Open request summary** — count of incoming RFQs and open proformas.
- **Invoice KPI strip** — total open invoice value, paid invoices, pending items.
- **Cunga AI insight** — AI guidance on stalled invoices, catalog footprint advice,
  and suggested actions.
- **Recent activity** — latest messages and order updates from your buyer contacts.

---

### 9.2 Supervisors

A list of all Supervisors in the organisations that have connected with you:

- Supervisor name, company, email.
- Send a direct message to initiate or follow up on an order.
- View the requisition history with each supervisor.

---

### 9.3 Request & Proformas (Inbox)

This is the core working page for the supplier.

#### Receiving a Request

When a Supervisor forwards a requisition to you, it appears here with status
**"Sent to Supplier"**.

1. Click the request to open the full detail.
2. Review: title, items needed (description, quantity, unit), requesting location,
   estimated budget, and any supervisor notes.

#### Submitting a Proforma

1. Click **"Submit proforma"** on the request.
2. Fill in:
   - Reference number
   - Total amount (RWF)
   - Currency
   - Line items with your unit prices
   - Due date / payment deadline
   - Upload your **proforma PDF** (required)
   - Notes
3. Click **"Send proforma"**.

The proforma lands in the Accountant's approval queue. The request status
updates to **"Proforma Received"**.

#### After Proforma Approval

- Status becomes **"Proforma Approved"**.
- You prepare and deliver the goods.
- You upload the **delivery note** once items are delivered.
- You then submit the **final invoice**.

---

### 9.4 Invoice (Documents)

All invoices linked to your delivered orders:

- View each invoice: reference, status, amount, amount paid, balance due,
  due date, payment deadline, payment channel.
- **Upload final invoice** — attach your official invoice PDF.
- **Upload delivery note** — confirm goods were delivered.
- Track payment progress: Pending → Partially Paid → Paid.

**Invoice statuses:**

| Status | Meaning |
|---|---|
| Draft | Not yet submitted |
| Sent | Invoice submitted to buyer |
| Proforma Received | Buyer received your proforma |
| Proforma Approved | Proforma approved — proceed to deliver |
| Delivery Note Attached | Delivery confirmed |
| Final Invoice Received | Final invoice received by buyer |
| Partially Paid | Partial payment made |
| Credit Purchase | Sold on credit |
| Paid | Full payment received |
| Closed | Process complete |
| Rejected | Invoice rejected by buyer |

---

### 9.5 Products (Catalog)

Your product catalog is what buyers see when browsing the Marketplace.

#### Adding a Product

1. Go to **Products** → click **"Add product"**.
2. Fill in:
   - Product name
   - Category (e.g., Medical Supplies, Office Equipment, Food & Beverage)
   - Unit (pieces, kg, litres, boxes, etc.)
   - Unit price (RWF)
   - Description
   - Product images (uploaded to Cloudinary)
   - Availability status
3. Click **"Save product"**.

#### Editing a Product

Click the pencil icon on any product card. Update price, description, or images.
Changes are reflected in the Marketplace immediately.

#### Catalog Management Tips

- Keep product names clear and specific — buyers search the directory.
- Update prices regularly to stay competitive.
- Add high-quality images — catalog items with images get more inquiries.
- Cunga AI surfaces tips on which categories are in demand based on recent
  requisition patterns from buyers.

---

### 9.6 Reports

Full performance analytics for your supplier account.

**Period filter:** 1 day · 7 days · 30 days · 90 days · 1 year · Custom date range

**Sections:**

- **KPI strip** — total requests received, total invoices, total invoice value,
  approved requests count, pending requests count.
- **Request volume chart** — daily bar/line chart of incoming requests over the
  selected period.
- **Invoice status donut** — Paid / Approved / Draft / Rejected value breakdown
  as a visual chart with amounts.
- **Invoice details table** — all invoices in the selected period, with search
  bar (filter by reference, item name, or requisition title) and status filter
  dropdown. Shows: Reference, Status, Amount, Paid, Balance, Method, Due Date, Date.
  Overdue rows are highlighted in red; rows due within 7 days in amber.
- **Export Excel** — full supplier performance report with request table and
  invoice table.
- **Export PDF** — printable performance report.

---

### 9.7 Delivery

Manage physical delivery of goods:

- See all orders in **"Proforma Approved"** or **"Delivery Note Attached"** status.
- Upload delivery note PDF for each order.
- Mark items as dispatched.
- Cunga AI surfaces corridor consolidation opportunities (when multiple orders
  go to the same buyer location) to reduce delivery costs.

---

### 9.8 Payments

Track and reconcile all payments received:

- Full list of paid and partially-paid invoices.
- See payment channel (bank transfer, mobile money, cash, etc.).
- View payment proof uploaded by the accountant.
- Download payment records as Excel.

---

### 9.9 Settings

- **Portal profile** — supplier identity, company name, logo, contact details,
  industry, address.
- **Password** — change your sign-in password.
- **Notification preferences** — email alerts for new requests, proforma approvals,
  payments received.

---

## 10. Cross-Role Workflow — Full Procurement Lifecycle

This section shows how all four roles work together from a stock need to payment.

```
CLERK           SUPERVISOR          SUPPLIER          ACCOUNTANT
  │                  │                  │                  │
  │ 1. Identifies    │                  │                  │
  │    low stock     │                  │                  │
  │                  │                  │                  │
  │ 2. Creates ──────►                  │                  │
  │    Requisition   │ 3. Reviews       │                  │
  │    (Submitted)   │    request       │                  │
  │                  │                  │                  │
  │ ◄── Notified ────│ 4. Approves &    │                  │
  │    (Approved)    │    forwards ─────►                  │
  │                  │    (Sent to      │ 5. Receives RFQ  │
  │                  │     Supplier)    │    Reviews items  │
  │                  │                  │                  │
  │                  │ ◄── Notified ────│ 6. Submits       │
  │                  │    (Proforma     │    Proforma PDF   │
  │                  │     Received)    │    (Proforma      │
  │                  │                  │     Received)    │
  │                  │                  │                  │
  │                  │ 7. Reviews       │                  │
  │                  │    Proforma      │                  │
  │                  │                  │                  │
  │                  │                  │ ◄── Forwarded ───│
  │                  │ 8. Approves ─────────────────────►  │
  │                  │    Proforma      │                  │ 9. Accountant
  │                  │                  │ ◄── Notified ────│    approves
  │                  │                  │    (Approved)    │    proforma
  │                  │                  │                  │
  │                  │                  │ 10. Delivers     │
  │                  │                  │     goods        │
  │                  │                  │     Uploads      │
  │                  │                  │     delivery     │
  │                  │                  │     note         │
  │                  │                  │                  │
  │ ◄── Notified ────│ ◄── Notified ────│ 11. Submits      │
  │    (Delivery     │    (Delivery     │     final        │
  │     Received)    │     Confirmed)   │     invoice PDF  │
  │                  │                  │                  │
  │                  │                  │ ◄── Payment ─────│ 12. Accountant
  │                  │                  │     Processed    │     processes
  │                  │                  │     (Paid)       │     payment
  │                  │                  │                  │
  │                  │ ◄── Closed ──────────────────────────
  │                  │    (Closed)      │                  │
```

### Step-by-step Summary

| Step | Who | Action | Portal status |
|---|---|---|---|
| 1 | Clerk | Spots low-stock item on dashboard or inventory list | — |
| 2 | Clerk | Creates and submits a requisition with line items | **Submitted** |
| 3 | Supervisor | Reviews the request, checks priority and budget | — |
| 4 | Supervisor | Approves and forwards to a supplier | **Sent to Supplier** |
| 5 | Supplier | Receives the RFQ in their inbox | — |
| 6 | Supplier | Uploads proforma invoice PDF with pricing | **Proforma Received** |
| 7 | Supervisor | Reviews proforma pricing and terms | — |
| 8 | Supervisor/Accountant | Approves the proforma | **Proforma Approved** |
| 9 | Supplier | Prepares and delivers goods | — |
| 10 | Supplier | Uploads delivery note PDF | **Delivery Note Attached** |
| 11 | Supplier | Submits final official invoice PDF | **Final Invoice Received** |
| 12 | Accountant | Processes payment (full or partial) | **Paid / Partially Paid** |
| 13 | Supervisor | Confirms and closes the cycle | **Closed** |

Every step sends an **in-app notification** and optionally an **email alert** to
the relevant parties. All documents stay attached to the requisition and are
available for audit at any time.

---

## 11. Cunga AI Insights

Every role has a **Cunga AI** insight card embedded in their dashboard and
key pages. The AI reads live data from the database and generates role-specific,
actionable guidance.

### How it works

1. Click the **"✦ Cunga AI"** button in the top bar, or look for the Cunga AI
   card on your dashboard.
2. The portal calls the AI service with a snapshot of your live workspace data.
3. Within a few seconds, the insight appears as structured sections with
   specific numbers from your actual data.

### What each role gets

| Role | AI focuses on |
|---|---|
| Clerk | Low-stock items by name, expiry within 7 days, consumption velocity changes, requisitions to raise |
| Supervisor | Approval queue depth, critical-priority requests blocking the team, pending stock edits, activity trend |
| Accountant | Overdue invoice count + total value, partially-paid follow-ups, proforma pipeline value, payment priority |
| Supplier | Open and stalled invoices, catalog footprint, next recommended actions |

### Controls

- **Refresh** — generates a fresh insight from the latest data.
- **Copy ⎘** — copies the full insight text to clipboard.
- **Metrics bar** — shows a live snapshot: SKU count, low-stock %, requisition
  totals, overdue invoice count (red badge when overdue), items expiring within
  7 days (amber badge).
- Results are **cached for 3 minutes** to avoid redundant calls. The cache hint
  says *"Updated within the last few minutes."*

---

## 12. Messaging & Notifications

### Portal Messaging

Every role has access to the **Messages** hub (chat bubble icon in the top bar).

- **Send a message** to any team member or supplier in your workspace.
- **Message threads** keep conversation history organised.
- Attach a reference (requisition ID, invoice number) to a message.
- New messages appear as a badge on the chat icon.

### Notifications

The **bell icon** in the top bar opens your notification center.

Notifications are sent for:
- New requisition submitted (Supervisor)
- Requisition approved / rejected (Clerk)
- Proforma received (Supervisor / Accountant)
- Proforma approved / rejected (Supplier)
- Delivery note uploaded (Supervisor / Accountant)
- Payment processed (Supplier)
- Low stock alert (Clerk)
- New user invited (Admin)
- Stock edit request submitted (Supervisor)
- Stock edit approved / rejected (Clerk)

Notifications are colour-coded:
- 🟢 **Info** — routine updates
- 🟡 **Attention** — items needing your review
- 🔴 **Important** — urgent actions required

---

## 13. Account Settings & Profile

Accessible from the **avatar menu** (top right) → **"My profile"** or
**"Account settings"**.

### My Profile

- Update full name, phone, job title, time zone.
- View your role and organisation.
- Email is read-only (managed by Admin).
- Click **"Save profile"** to apply changes.

### Account Settings

- **Appearance & language** — Light / Dark / System theme; ENG / KINY language.
- **Password** — current password → new password → confirm → "Update password".
- **Email & alert preferences**:
  - Weekly workspace digest (summary of stock, requests, highlights for your role)
  - Security alerts (sign-in issues, password changes)
  - Product & maintenance updates
- **Active session** — shows your current sign-in. Click "Sign out" to end it.
- **Security checklist** — tips for password hygiene and account safety. For a full overview of platform security measures, see the [Security Assurance](https://ecunga.com/security) page or download the PDF from that page.

---

## 14. Language Switching

The portal supports **English** and **Kinyarwanda** throughout the entire interface
— navigation, buttons, labels, error messages, AI insights, and notifications.

1. Look for **ENG** and **KINY** in the top bar.
2. Click **KINY** to switch to Kinyarwanda.
3. Click **ENG** to switch back to English.

The language preference is applied instantly without a page reload and is remembered
across sessions on the same browser.

---

## 15. Pricing Plans

e-Cunga Portal offers three plans to match different organisation sizes and needs.
Pricing is in **Rwandan Francs (RWF)**. You can switch between **monthly** and
**annual** billing — annual billing saves **20%**.

Visit **ecunga.com/pricing** to compare plans interactively.

---

### Plan Overview

| | **Essential** | **Professional** | **Enterprise** |
|---|---|---|---|
| **Monthly price** | 40,000 RWF/month | 80,000 RWF/month | Custom |
| **Annual price** | 384,000 RWF/year | 768,000 RWF/year | Custom |
| **Annual saving** | 96,000 RWF | 192,000 RWF | Negotiated |
| **Best for** | Single location or one warehouse team | Multi-location institutions with deeper workflow needs | Large-scale enterprise or government |
| **Most popular** | — | ✓ | — |

---

### Essential Plan — 40,000 RWF / month

*For one location or one warehouse team getting started with digital stock control.*

**What is included:**

- ✅ Up to 250 inventory items (SKUs)
- ✅ Access to verified suppliers via the Marketplace
- ✅ Smart email notifications (stock alerts, requisition updates, approvals)
- ✅ Role-based access for core staff (Clerk, Supervisor, Accountant, Supplier)
- ✅ Stock registration and low-stock alerts
- ✅ Requisition-to-supplier workflow (raise → approve → deliver → pay)
- ✅ Expiry tracking and consumption recording
- ✅ Basic reports and inventory movement history
- ✅ Onboarding and reporting setup support

**Limits:**
- Up to **10 users** across all roles
- Up to **200 SKUs** in the active inventory
- Single-location workspace

**How to get started:**
Click **"Get Started Now"** on the Essential card at ecunga.com/pricing,
which takes you to the registration form with the Essential plan pre-selected.

---

### Professional Plan — 80,000 RWF / month ⭐ Most Popular

*For multi-location institutions, hospitals, hotels, and growing businesses that
need advanced workflows, deeper analytics, and broader team access.*

**Everything in Essential, plus:**

- ✅ Optimized supplier recommendations by cost — compare multiple quotes in one view
- ✅ Advanced product registration — batch numbers, department assignments,
  subcategories, multi-warehouse tracking
- ✅ Email **and SMS** notifications for critical events
- ✅ Full access & integrations — API access, data export, advanced RBAC
- ✅ Full requisition-to-supplier workflow with proforma, delivery note,
  final invoice, and payment tracking
- ✅ Advanced analytics and reporting — Cunga AI insights, trend charts,
  clerk performance, supplier relationship reports
- ✅ Broader rollout across operations and finance teams
- ✅ Guided setup for roles, warehouses, approval routes, and reporting
- ✅ Inventory Movement tracking per product with full export
- ✅ Multi-location inventory visibility for supervisors
- ✅ Weekly schedule exports (.ics calendar integration)

**Limits:**
- Up to **unlimited users** (contact sales for very large teams)
- Up to the contracted SKU ceiling (configured at onboarding)
- Multi-location / multi-department support

**Annual billing:**
At 768,000 RWF/year (vs 960,000 RWF monthly), you save **192,000 RWF** per year.

**How to get started:**
Click **"Get Started Now"** on the Professional card at ecunga.com/pricing.

---

### Enterprise Plan — Custom Pricing

*For large organisations, government bodies, or institutions requiring dedicated
support, custom development, and private deployment.*

**Everything in Professional, plus:**

- ✅ Dedicated support manager — a named point of contact for your organisation
- ✅ Custom feature development — build workflows specific to your operations
- ✅ SLA (Service Level Agreement) — guaranteed response and uptime commitments
- ✅ Private instance — your data on a dedicated server environment
- ✅ Single Sign-On (SSO) integration — connect your existing identity provider
  (Google Workspace, Microsoft Entra, etc.)
- ✅ RBAC+ — extended role and permission configuration beyond standard roles
- ✅ Custom reporting and data pipelines
- ✅ Volume pricing for very large user counts
- ✅ Guided onboarding for multiple departments simultaneously

**Pricing:** Quoted based on team size, number of locations, and required
customisations. Contact the sales team for a tailored proposal.

**How to get started:**
Click **"Contact Sales"** on the Enterprise card, which takes you to the
Contact page at ecunga.com/contact.

---

### Monthly vs Annual Billing

| | Monthly | Annual | You save |
|---|---|---|---|
| Essential | 40,000 RWF/mo (480,000/yr) | 384,000 RWF/yr | **96,000 RWF** |
| Professional | 80,000 RWF/mo (960,000/yr) | 768,000 RWF/yr | **192,000 RWF** |

Annual billing is charged as a single upfront payment at the start of the year.
Monthly billing is charged on the same date each month.

Toggle between **Monthly** and **Annual** on the pricing page to see the price
difference instantly.

---

### Choosing the Right Plan

| Your situation | Recommended plan |
|---|---|
| One warehouse, small team, first time going digital | **Essential** |
| Hospital or clinic with multiple departments | **Professional** |
| Hotel with housekeeping, maintenance, and F&B | **Professional** |
| Retail chain with multiple branches | **Professional** |
| Government institution or NGO | **Professional** or **Enterprise** |
| Large organisation needing custom development or SSO | **Enterprise** |
| Not sure yet | Start with **Essential**, upgrade anytime |

---

### Frequently Asked Questions

**Can I switch plans anytime?**
Yes. You can upgrade from Essential to Professional as your inventory operations
grow. The e-Cunga team will help migrate your workflows smoothly without data loss.

**Do you offer custom onboarding?**
Yes. Professional and Enterprise rollouts include guided setup for roles,
warehouses, approval routes, and reporting needs. A dedicated onboarding session
is scheduled at contract start.

**Is there a free trial?**
Essential includes a free trial period. Click **"Start Free Trial"** on the
pricing page to begin without entering payment details.

**What happens if I exceed my SKU limit?**
You will be notified when approaching your limit. The portal will prompt you to
upgrade your plan or archive inactive items.

**Are prices inclusive of VAT?**
Prices shown are in RWF before applicable taxes. Your invoice will show the
final amount including any applicable VAT.

**What currencies do you support?**
Invoices inside the portal use **RWF (Rwandan Francs)** by default.
Enterprise plans can be configured for multi-currency environments.

---

### How to Subscribe

1. Go to **ecunga.com/pricing**.
2. Choose **Monthly** or **Annual** billing.
3. Click **"Get Started Now"** on your chosen plan.
4. You are taken to the registration page with the plan pre-selected.
5. Complete registration (company details, admin account).
6. Your workspace is activated once the e-Cunga team approves your registration.
7. For Enterprise, click **"Contact Sales"** and the team will prepare a
   custom proposal within 2 business hours.

---

## 16. Troubleshooting & Support

### Common Issues

| Issue | Solution |
|---|---|
| Can't sign in | Check email/password; use "Forgot password?" if unsure |
| "Company not approved" | Your registration is pending — wait for approval email |
| Activation code expired | Click "Send code again" on the activation page |
| Page shows "Route not found" | Refresh or navigate back to dashboard |
| AI insight not loading | Check your internet connection; click Refresh |
| Can't see a supplier in the list | Ask your Supervisor to invite the supplier |
| PDF won't open | Check your browser's PDF viewer; try downloading |
| Stock item won't update | Your edit request is pending supervisor approval |
| Proforma not appearing | Confirm the supplier uploaded a PDF file |
| Invoice shows wrong amount | Contact the supplier to resubmit the proforma |

### Getting Help

- **Help Center** — available from the left nav (Admin) or avatar menu → Help.
- **Contact form** — visit ecunga.com/contact.
- **Email** — hello.ecunga@gmail.com
- **Support hours** — Sunday to Friday, 8 am – 6 pm (East Africa Time)

---

*This guide covers the e-Cunga Portal as of 2026. Screenshots and feature details
may vary slightly depending on your organisation's plan and configuration.*

*e-Cunga Portal — Track stock, approvals, and supplier steps in one place.*

---

## 17. Auto Requisition

### What is Auto Requisition?

Auto Requisition is the portal's built-in procurement automation engine. When stock
levels fall to or below their configured minimum threshold, the system automatically
creates a purchase requisition on behalf of the organisation — no human action needed.

This feature is available on the **Professional** plan and above, and must be enabled
per workspace by a Supervisor or Admin.

---

### How to Enable It

1. Go to **Roles & access** (Admin) or **Company settings** (Supervisor).
2. In the **Permissions** panel, locate **"Auto-Requisitioning (AI)"**
   (permission key: `requisitions:auto`).
3. Toggle it on for the Supervisor role.
4. Once enabled, the system begins monitoring all stock items on its schedule.

---

### How It Works — Step by Step

#### Phase 1: Draft Generation (14th and day-before-last of each month, 02:00 AM)

The scheduler runs `runBatchAutoRequisitions()` automatically:

1. **Scans all stock items** across the entire workspace looking for items where:
   - `quantity ≤ minThreshold` (at or below minimum), OR
   - `quantity = 0` (completely out of stock)

2. **Groups items by company and owner** — each company gets one batch
   requisition, not one per item. This keeps the approval queue clean.

3. **Checks for duplicates** — the system reads all current requisitions with
   status `submitted` or `approved`. Any item already in an open request is
   excluded from the new batch to avoid double-ordering.

4. **Calculates the order quantity** using the Min/Max logic:
   - If `maxThreshold > 0`: order quantity = `maxThreshold − currentQuantity`
   - If no max threshold is set: order quantity = `minThreshold` (bring back
     to minimum) or at least 1 unit

5. **Creates a draft requisition** with:
   - Title: `"Auto restock: Batch [Month Year]"` (e.g. "Auto restock: Batch Jun 2026")
   - Status: **Draft**
   - Priority: **High**
   - Supervisor note: `"Automated batch requisition for N low-stock items."`
   - All qualifying items listed as line items with calculated quantities

6. **Notifies the Clerk** via an in-app message:
   > *"An auto-requisition draft for N items has been generated. Please review,
   > edit, or submit it. If left alone, it will auto-submit tomorrow."*

#### Phase 2: Auto-Submit (15th and last day of each month, 02:00 AM)

The scheduler runs `autoSubmitDrafts()`:

1. **Finds all draft requisitions** with the `"Auto restock:"` title prefix.

2. **Checks for recent manual activity** — if the clerk submitted a manual
   requisition within the last **48 hours**, the auto-draft is automatically
   **cancelled**. This prevents duplicate orders when the clerk is already on top
   of the situation. The clerk receives a message: *"Your auto-requisition draft
   was cancelled because you recently submitted a manual request."*

3. **If no manual requisition was found**, the draft is automatically promoted to
   **"Submitted"** status and enters the Supervisor's approval queue.

4. **Notifies the Supervisor** with both an in-app notification and a message:
   > *"[Title] is in the approval queue."*

---

### What the Clerk Sees

- A new requisition titled `"Auto restock: Batch [Month]"` appears in their
  **Request materials** list with status **Draft**.
- An in-app message alerts them it was created.
- They can **review and edit** the draft before it auto-submits:
  adjust quantities, add or remove items, or change the priority.
- If they submit a manual request within 48 hours, the auto-draft is cancelled.

---

### What the Supervisor Sees

- On the 15th or last day of the month, a new requisition titled
  `"Auto restock: Batch [Month]"` with status **Submitted** appears in
  **Pending Approval** with **High** priority.
- An in-app notification and message both fire.
- The supervisor reviews, approves, and forwards to a supplier as normal.

---

### Schedule Summary

| Date | Time | Action |
|---|---|---|
| 14th of month | 02:00 AM | Draft auto-requisitions created for all low-stock items |
| Day-before-last of month | 02:00 AM | Draft auto-requisitions created (end-of-month check) |
| 15th of month | 02:00 AM | Drafts auto-submitted to supervisor (or cancelled if manual req exists) |
| Last day of month | 02:00 AM | Same as 15th — end-of-month auto-submit |

> The scheduler checks once per hour. All times are server time (East Africa Time).

---

### Prerequisites

| Requirement | Where to configure |
|---|---|
| `requisitions:auto` permission enabled | Admin → Roles & access |
| Stock items have `minThreshold` set | Clerk/Supervisor → Inventory list → Edit item |
| At least one active Supervisor in the workspace | Admin → User management |
| At least one active Clerk in scope | Supervisor → Clerks |

---

## 18. Auto Notifications

### Overview

e-Cunga Portal sends automatic notifications at every key step of the procurement
and stock management lifecycle. Notifications appear **in-app** (bell icon, top bar)
and optionally via **email**, depending on each user's preferences.

---

### Notification Types

#### 🟢 Stock Notifications (Clerk & Supervisor)

| Trigger | Who receives it | Severity |
|---|---|---|
| New stock item added to the register | Clerk (owner) | Info (neutral) |
| Item quantity falls to or below `minThreshold` | Clerks with access to that item + Supervisor | ⚠️ Warning |
| Item quantity updated and still below threshold | Clerks with access to that item | ⚠️ Warning |
| Stock item permanently deleted | Clerk (owner) + Supervisor | ⚠️ Warning |
| Expiry date within 1–30 days | Owning clerk + all Supervisors | ⚠️ Warning |
| Stock edit request submitted by clerk | Supervisor | ⚠️ Warning |
| Stock edit request approved / rejected | Clerk who submitted it | Info / Warning |

**Expiry notification de-duplication:** The system checks if the same
expiry alert was sent in the last 48 hours. If yes, it skips the notification
to prevent alert fatigue.

**Low-stock email:** When quantity drops to or below `minThreshold`, a formatted
email is sent to all clerks who have access to that item, listing the item name,
current quantity, and minimum threshold in a table layout.

---

#### 📋 Requisition Notifications

| Trigger | Who receives it | Severity |
|---|---|---|
| Requisition submitted by clerk | Supervisor | ⚠️ Warning |
| Requisition approved by supervisor | Clerk | 🟢 Info |
| Requisition rejected by supervisor | Clerk | 🔴 Important |
| Requisition forwarded to supplier | Supplier | 🟢 Info |
| Auto-requisition draft created | Clerk | 🟢 Info |
| Auto-draft cancelled (manual req found) | Clerk | 🟢 Info |
| Auto-draft submitted to supervisor | Supervisor | ⚠️ Warning |

---

#### 💳 Invoice & Payment Notifications

| Trigger | Who receives it | Severity |
|---|---|---|
| Proforma invoice submitted by supplier | Supervisor + Accountant | ⚠️ Warning |
| Proforma approved | Supplier | 🟢 Info |
| Proforma rejected | Supplier | 🔴 Important |
| Final invoice submitted | Supervisor + Accountant | 🟢 Info |
| Payment processed (full) | Supplier | 🟢 Info |
| Payment deadline 7 days away | Accountant + Supplier | ⚠️ Warning |
| Payment deadline 1 day away | Accountant + Supplier | 🔴 Important |
| External proforma uploaded by clerk | Accountants | 🟢 Info |
| External final invoice uploaded | Accountants | 🟢 Info |
| Full invoice workflow closed | Clerk + Supervisor + Accountants | 🟢 Info |

**Payment reminders** run daily at **08:00 AM** server time. The scheduler fires
exactly at 7 days and 1 day before the `paymentDeadline` field on each invoice.

---

#### 👥 Team / Account Notifications

| Trigger | Who receives it | Severity |
|---|---|---|
| New user invited | The invited user (activation email) | — |
| Account activated | — | — |
| Company registration approved | Company admin | Email |
| Company registration rejected | Company admin | Email |
| New supplier linked to workspace | Supervisor | 🟢 Info |

---

### Notification Delivery Channels

| Channel | When it fires | How to control |
|---|---|---|
| **In-app bell** | All events | Always active — cannot be disabled |
| **In-app message** | Key workflow events (auto-req, approvals) | Always active |
| **Email** | Low stock, expiry, workflow milestones, payment reminders | Per-user preference in Account settings |

#### Managing Email Preferences

1. Click your avatar → **Account settings**.
2. Under **"Email & alerts"**, choose:
   - **Weekly workspace digest** — summary of stock, requests, and highlights.
   - **Security alerts** — sign-in issues, password changes.
   - **Product & maintenance updates** — new features, downtime notices.
   - **Workflow emails** (`notifyWorkflowEmails`) — order and payment step emails.
3. Click **"Save preferences"**.

> Email for workflow events is **on by default** for all users. Disable it if you
> prefer to track everything in-app only.

---

### Notification Severity Colours

| Colour | Severity label | What it means |
|---|---|---|
| 🟢 Green | Info / Neutral | Routine update, no action needed |
| 🟡 Yellow | Attention / Warning | Review recommended soon |
| 🔴 Red | Important | Urgent — action required now |

---

## 19. Min/Max Logic

### What Are Min and Max Thresholds?

Every stock item in the portal has two optional quantity boundaries:

| Field | Label in portal | Purpose |
|---|---|---|
| `minThreshold` | Minimum level | The lowest acceptable quantity. Falling to or below this triggers alerts, low-stock badges, and auto-requisition. |
| `maxThreshold` | Maximum level | The ideal full quantity. Used to calculate how much to reorder. |

---

### Where to Set Them

**When adding a new item (Clerk):**
- Fill in **"Minimum threshold"** and **"Maximum threshold"** on the Add Item form.
- These values define the operating range for that item.

**When editing an existing item:**
- Click the edit icon on any item in the Inventory list.
- A **Stock Edit Request** is created if the change is to `minThreshold` or
  `maxThreshold` (these are restricted fields).
- A Supervisor must approve the change before it takes effect.

**Direct supervisor edit:**
- Supervisors can edit thresholds directly from the Inventory Visibility page
  without creating an edit request.

---

### How Min Threshold Triggers Actions

When `quantity ≤ minThreshold` on any item, the following chain fires:

```
Item quantity updated
        │
        ▼
quantity ≤ minThreshold?
        │
       YES
        │
        ├─► In-app notification sent to clerks with access (Severity: Warning)
        │
        ├─► Low-stock email dispatched to clerks (formatted table with item name,
        │   current qty, min threshold)
        │
        ├─► Item appears in RED on the Inventory list (low-stock badge)
        │
        ├─► Item appears in Cunga AI snapshot as a named low-stock item
        │
        └─► Item queued for next auto-requisition batch (14th / day-before-last)
```

---

### How Max Threshold Drives Reorder Quantity

When the auto-requisition batch runs, the quantity to order is calculated as:

```
If maxThreshold > 0:
  orderQty = maxThreshold − currentQuantity

If maxThreshold = 0 (not set):
  orderQty = max(minThreshold, 1)
```

**Example:**

| Item | Current Qty | Min | Max | Order Qty Calculated |
|---|---|---|---|---|
| Paracetamol 500mg | 8 | 10 | 100 | 100 − 8 = **92 units** |
| Surgical gloves (M) | 0 | 5 | 50 | 50 − 0 = **50 boxes** |
| IV Saline 500ml | 3 | 3 | 0 (not set) | max(3,1) = **3 units** |
| Bandages | 2 | 5 | 0 (not set) | max(5,1) = **5 units** |

This means setting a `maxThreshold` gives you precise, automated reorder quantities.
Items without a max threshold are ordered up to their minimum level.

---

### Stock Status Indicators

| Status | Condition | Display |
|---|---|---|
| **Out of stock** | `quantity = 0` | 🔴 Red badge — "Stockout" |
| **Low stock** | `0 < quantity ≤ minThreshold` | 🟠 Orange badge — "Low Stock" |
| **Overstock** | `quantity > maxThreshold` (when max > 0) | 🔵 Blue badge — "Overstock" |
| **In stock** | `minThreshold < quantity ≤ maxThreshold` | 🟢 Green — normal |

These badges appear on the **Inventory list**, **Dashboard**, and inside
**Cunga AI insight cards**.

---

### Best Practices for Setting Thresholds

| Scenario | Recommended approach |
|---|---|
| Medicine or consumable with critical need | Set min = 2–4 weeks of average use; max = 2–3 months of use |
| Office supplies | Set min = 1 week; max = 1 month |
| Seasonal items | Adjust thresholds manually before season peak; auto-req will adapt |
| Fast-moving items | Keep max close to 2× min to reorder frequently in small batches |
| Slow-moving / expensive items | Keep min low to avoid overstocking; set max conservatively |

Use the **Stock Prediction** section in Clerk Reports (based on last-30-day
consumption velocity) to calibrate min/max values precisely.

---

## 20. AI Recommendations

### Overview

Cunga AI is integrated at multiple points in the portal to surface actionable
recommendations — not just summaries. Each recommendation is derived from live
database data, not generic advice.

---

### 20.1 Role-Scoped Workspace Insights

Available to all roles from the **"✦ Cunga AI"** top-bar button and embedded
dashboard cards. See Section 11 for the full breakdown. Key points:

- Powered by **Google Gemini** (`gemini-1.5-flash` by default).
- Returns **structured JSON sections** with titled headings and bullet points.
- Every percentage and count cited comes from live MongoDB aggregations taken
  at the moment you click Refresh.
- Supports both **English** and **Kinyarwanda** output — the AI writes
  Kinyarwanda when the portal language is set to Kinyarwanda.
- Cached for **3 minutes** per role per company. Cached results show a hint:
  *"Updated within the last few minutes."*
- A **rate-limited** state is handled gracefully: if Gemini returns 429/503,
  the portal shows your metrics data and prompts you to retry in a few minutes.
  The rate-limit cache lasts **10 minutes** to protect quota.

---

### 20.2 Master Catalog Recommendations (Sector-Based)

Available to **Clerks, Supervisors, and Suppliers** when adding or managing
stock items. The portal maintains a **Master Stock Catalog** seeded with
industry-standard items per sector:

- **Healthcare:** medicines, consumables, lab reagents, surgical items
- **Hospitality:** housekeeping supplies, F&B items, maintenance parts
- **Retail:** general merchandise, packaging, supplies
- **Government/Institutions:** office supplies, safety equipment, IT consumables

**How clerks use it:**
1. On the **Inventory list** or **Request materials** page, a recommendation
   panel shows items from the Master Catalog relevant to your company's sector.
2. Search the recommendations by name, category, description, or unit
   (`filterMasterRecommendations` matches against all these fields).
3. Click **"Apply Cunga AI forecast"** to pre-fill a new requisition with
   recommended items and quantities.
4. Items already in your stock are shown with current quantity context.

**How suppliers use it:**
- The Master Catalog shows trending and in-demand items for the supplier's
  sector, helping them decide which products to add to their catalog.
- Cunga AI tips appear alongside each catalog item: *"Save copy and pricing
  before publishing — Cunga AI tips react to category demand signals."*

---

### 20.3 Cunga AI Insight Cards — What Each Role Gets

Each role receives a different AI brief built from their specific data scope:

#### Clerk Insight
Generated from: stock items the clerk can access, their consumptions, and
their requisitions.

Sections typically include:
- **Stock Alerts** — names items below threshold with exact quantity and gap
- **Expiry Pressure** — items expiring within 7 days by name
- **Consumption Velocity** — flags if usage increased vs prior week
- **Actions** — recommends which requisitions to raise today

#### Supervisor Insight
Generated from: company-wide requisitions, invoices, stock, team activity.

Sections typically include:
- **Approval Queue** — how many requests need action, any critical-priority ones
- **Stock Risk** — company-wide low-stock % and expiry count
- **Financial Pipeline** — open invoice value, overdue count
- **Team Activity** — trend vs prior week, pending stock edit requests

#### Accountant Insight
Generated from: all company invoices, payment status, proforma pipeline.

Sections typically include:
- **Overdue Invoices** — count and total value past due date (highlighted red)
- **Partial Payments** — invoices needing follow-up
- **Proforma Pipeline** — pending approvals and their value
- **Priority Actions** — what to pay, chase, or approve today

#### Supplier Insight
Generated from: the supplier's own invoices and catalog.

Sections typically include:
- **Open Invoices** — how many are stalled vs total
- **Catalog Footprint** — SKU count and category coverage tips
- **Next Actions** — follow up on specific invoice stages

---

### 20.4 AI Security Insight (Admin)

Admins see a **security-focused AI card** that monitors access patterns:

> *"Cunga AI has noticed that users in the 'Clerk' role haven't accessed
> the 'Ledger' module in over 30 days. Consider reviewing their access to
> maintain system hygiene."*

This helps admins right-size permissions and catch inactive accounts.

---

### 20.5 Payment Insight (Accountant Dashboard)

A dedicated AI card on the accountant dashboard focuses on the payment pipeline:
- Total outstanding balance
- Overdue risk in RWF
- Recommended payment order (most overdue first)

---

### 20.6 Delivery Insight (Supplier)

When paid orders are in the delivery queue, Cunga AI surfaces:
- **Corridor consolidation opportunities** — multiple deliveries to the same
  buyer location that could be batched into one trip.
- Estimated savings from consolidation.

> *"When paid orders land in your queue, Cunga AI will surface corridor
> consolidation opportunities and estimated savings here."*

---

### 20.7 How to Dismiss a Recommendation

Every AI card has a **Dismiss** button. Dismissed cards do not reappear until
the data changes enough to trigger a new insight on the next refresh.

---

## 21. Internationalisation (i18n)

### Overview

e-Cunga Portal is built for teams in Rwanda and similar markets. The entire
interface — navigation, forms, buttons, error messages, reports, AI insights,
notifications, and legal documents — is available in two languages:

| Code | Language | Status |
|---|---|---|
| `eng` | English | ✅ Fully available — default |
| `kiny` | Kinyarwanda (Ikinyarwanda) | 🔄 In progress — translations being completed |

---

### How Language Switching Works

The portal uses a React context (`I18nProvider` / `useI18n`) that wraps the
entire application. Every string in the UI comes from a central translation
file (`translations.js`) — nothing is hardcoded.

**Switching language:**
1. Look for **ENG** and **KINY** buttons in the top navigation bar.
2. Click **KINY** to switch to Kinyarwanda.
3. The interface switches instantly — no page reload required.
4. Your preference is saved in `localStorage` under the key `ecunga-language`
   and remembered on your next visit.

**Current behaviour:**
- If you previously saved `kiny` and reload, the portal currently defaults to
  `eng` while the Kinyarwanda translation set is being completed.
- Clicking **KINY** opens a modal explaining that Kinyarwanda is being finalized,
  so you are aware before switching.

---

### What Is Translated

Every part of the portal uses the `t('key')` function:

| Area | Translated |
|---|---|
| Navigation labels (all 5 roles) | ✅ |
| Dashboard labels, cards, KPI strips | ✅ |
| Form fields, placeholders, validation messages | ✅ |
| Button labels and actions | ✅ |
| Status badges (Submitted, Approved, Paid, etc.) | ✅ |
| Error messages and flash notifications | ✅ |
| Report section titles and export labels | ✅ |
| Cunga AI insight output | ✅ (AI writes in the active language) |
| Email notification subjects and bodies | ✅ |
| Legal pages (Privacy Policy, Terms, Cookies) | ✅ |
| Pricing page | ✅ |
| Home/landing page | ✅ |
| Role labels (Inventory clerk, Supervisor, etc.) | ✅ |
| Activity log event labels | ✅ |

---

### How Translations Are Structured

Translations are organised as nested key-value objects:

```
t('nav.clerk.dashboard')        → "Dashboard" / "Dashibodi"
t('shell.logout')               → "Log out" / "Sohoka"
t('auth.loginTitle')            → "Sign in" / "Injira"
t('cungaAi.applyForecast')      → "Apply Cunga AI forecast" / "Koresha itegeko ryigenzura rya Cunga AI"
t('app.activity.stockAutoRequisition') → "An automatic restock suggestion was logged." / "Gusubiza ububiko mu buryo bwikora byanditswe."
```

**Variable interpolation** is supported — translations can include `{placeholders}`:

```
t('listings.showingRange', { from: 1, to: 10, total: 47 })
→ "Showing 1–10 of 47"
```

---

### Cunga AI in Kinyarwanda

When the portal language is set to Kinyarwanda, the AI insight API call
includes `language=kiny`. The Gemini model is instructed:

> *"Write ALL text (section titles and bullet points) in Kinyarwanda.
> Use professional workplace tone."*

The full insight — titles, bullets, and all numbers — is returned in Kinyarwanda.
The metrics footer also uses the `rw-RW` locale for date and number formatting.

---

### Date and Number Formatting

The portal respects the active language for locale-sensitive formatting:

| Language | Locale tag | Example date | Example number |
|---|---|---|---|
| English | `en-US` | Jun 27, 2026 | 1,234,567 |
| Kinyarwanda | `rw-RW` | 27 kamena 2026 | 1 234 567 |

Chart axis labels, timestamps on reports, and the Cunga AI metrics footer
all use the active locale tag.

---

### Adding or Updating Translations

Translations are maintained in:
```
client/src/i18n/translations_temp.js   ← current working file
client/src/i18n/translations.jsx       ← published file
```

The file exports two objects (`eng` and `kiny`) with matching key structures.
To add a new string:
1. Add the English key-value pair under the appropriate section in `eng`.
2. Add the Kinyarwanda equivalent in the matching position in `kiny`.
3. Use `t('your.new.key')` in the component.

The `t()` function falls back to English if a Kinyarwanda key is missing,
so partial translations never cause blank UI elements.

---

*This guide covers the e-Cunga Portal as of 2026. Screenshots and feature details
may vary slightly depending on your organisation's plan and configuration.*

*e-Cunga Portal — Track stock, approvals, and supplier steps in one place.*
