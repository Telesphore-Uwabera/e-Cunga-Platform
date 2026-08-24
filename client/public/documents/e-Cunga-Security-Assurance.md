# e-Cunga Portal — Security Assurance

> **Last updated:** August 2026 · **Applies to:** e-Cunga Portal marketing site and authenticated workspaces at ecunga.com

---

## 1. Overview

e-Cunga Portal is a digital procurement and inventory platform used by hospitals, clinics, businesses, and suppliers. This document explains the security measures we apply to protect your account, workspace data, and communications.

We implement reasonable, industry-standard safeguards appropriate to our service.

---

## 2. Why you can trust e-Cunga with your data

e-Cunga is built so your organisation's data stays private and accessible only to the right people. We use multiple layers of protection together — not a single switch — so that stealing or exposing user data is difficult for attackers and accidental cross-company access is blocked by design.

- **Encrypted connections:** Sign-in, stock, invoices, and messages travel over HTTPS with SSL certificates, so data in transit is not sent in plain text.
- **No readable passwords:** Your password is hashed with bcrypt before storage. Even we cannot recover your original password from our database.
- **Verified on every request:** The API checks your session token and reloads your account from the database before serving workspace data. Deactivated accounts are rejected immediately.
- **Strict workspace boundaries:** Your company's records are tagged and filtered by organisation on the server. Users in one workspace cannot query another workspace's stock, requisitions, or invoices.
- **Least-privilege access:** Roles and permission keys limit what each user can view or change — a clerk, accountant, supplier, or supervisor only reaches the areas their job requires.
- **Safe file handling:** Uploaded documents are type- and size-checked on the client and server, and attached only within workflows your role is allowed to manage.
- **Traceability:** Important actions are logged so administrators can review who changed stock, approved requests, or updated accounts.
- **Secure recovery:** Password reset links use one-time tokens stored as hashes and expire after one hour; in-app password changes require a verification code sent to your email.

No online system can promise that hacking is impossible, but e-Cunga applies these controls continuously so your data is protected by industry-standard practices and monitored by your organisation's administrators.

---

## 3. Access Control and Authentication

- **Secure sign-in:** User passwords are stored using one-way hashing (bcrypt). Plain-text passwords are never stored.
- **Session tokens:** After sign-in, the platform issues signed JSON Web Tokens (JWT) that expire after seven days. API requests require a valid token.
- **Role-based access:** Each user is assigned a role (admin, supervisor, clerk, accountant, or supplier). Routes and actions are restricted to authorized roles.
- **Granular permissions:** Workspace features (inventory, requisitions, reports, suppliers) are controlled by permission keys aligned with your organisation’s subscription plan.
- **Workspace isolation:** Users belong to a registered company. Data queries are scoped to your organisation so one tenant cannot access another tenant’s records.
- **Account lifecycle:** Invited users may receive one-time activation or temporary passwords and are expected to set a personal password after first sign-in. Inactive accounts can be deactivated by administrators.

Optional sign-in with Google or Microsoft OAuth is supported where configured by your organisation.

---

## 4. Data Protection

- **Transport security:** Production traffic is encrypted with HTTPS using SSL certificates on ecunga.com and our API.
- **Cross-origin controls:** The API accepts requests only from approved origins (including ecunga.com and configured development hosts).
- **Session storage:** Authentication tokens are kept in the browser session and sent only to our API over HTTPS.
- **Database:** Persistent workspace data is stored in MongoDB.
- **Organisation scoping:** Stock, requisitions, invoices, messages, and user records include company identifiers to enforce tenant boundaries on the server.

---

## 5. Infrastructure

- **Frontend:** Static web application hosted on Netlify (ecunga.com).
- **Backend API:** Node.js / Express application hosted on Render.
- **Media uploads:** Documents and images are stored via Cloudinary, with server-side file type and size limits.
- **Email:** Transactional email (invitations, workflow notices, contact confirmations) is sent through Brevo.

We rely on our hosting partners’ physical and network security for data centre protection.

---

## 6. Uploads and Documents

- **Client validation:** Proforma, delivery notes, and final invoices uploaded through the supplier portal are validated as PDF files with a maximum size of 10 MB.
- **Server validation:** The media upload endpoint enforces file type restrictions (images, video, PDF) and a 10 MB maximum upload size.
- **Access to files:** Uploaded document URLs are used within authenticated workflows; suppliers and buyer roles can only attach documents to orders they are permitted to manage.

---

## 7. Monitoring and Audit

- **Activity logging:** Significant actions (profile updates, stock changes, requisition workflow steps, invoice events) are logged with actor and metadata for administrator review.
- **In-app notifications:** Role-based notifications inform users of workflow events; many internal notices are in-app only to reduce email noise.
- **Administrator alerts:** Platform administrators can receive email alerts for new contact inquiries and newsletter subscriptions.

---

## 8. Email and Notification Preferences

Users can control optional email categories from Account settings:

- Weekly workspace digest
- Security alerts (sign-in and account changes)
- Product and maintenance updates
- Order and payment workflow emails (recommended for suppliers)

In-app notifications in the portal continue regardless of email preferences for operational visibility.

---

## 9. Your Responsibilities

To keep your workspace secure, you should:

- Use a strong, unique password and change temporary passwords after first sign-in.
- Never share your password or reuse your e-Cunga password on other sites.
- Sign out on shared or public devices.
- Grant roles and permissions only to people who need them.
- Report suspected unauthorized access to your administrator and to e-Cunga support promptly.

See also our Acceptable Use Policy and Terms and Conditions on the website.

---

## 10. Incident Reporting

If you suspect a security issue, unauthorized access, or a vulnerability in e-Cunga Portal:

- **Email:** hello.ecunga@gmail.com
- **Phone / WhatsApp:** +250 781 975 074
- **Website:** https://ecunga.com/contact

We will review reports in good faith and take reasonable steps to investigate and remediate confirmed issues.

---

## 11. Policy Updates

We may update this Security Assurance document as our platform and practices evolve. The current version is published at https://ecunga.com/security. Material changes will be reflected on that page.

---

## 12. Governing Law

This document is provided for transparency and user assurance in connection with services governed under the laws of the **Republic of Rwanda**, consistent with our Terms and Conditions.

---

## 13. Contact

**e-Cunga Portal**  
Email: hello.ecunga@gmail.com  
Phone: +250 781 975 074  
Website: www.ecunga.com  

Empowering Digital Procurement & Inventory Solutions
