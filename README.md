# e-CUNGA Platform

`e-CUNGA` is an AI-driven inventory and procurement workflow platform built to coordinate stock control, approvals, finance, and supplier fulfilment inside one shared system.

## Overview

The platform connects the full operational chain:

- `Clerk` registers stock, tracks usage, and submits material requests
- `Supervisor` reviews requests, monitors locations, and oversees workflow health
- `Accountant` validates proformas, processes payments, and tracks supplier transactions
- `Admin` manages users, company settings, analytics, and notifications
- `Supplier` receives approved requisitions, submits proformas, and uploads delivery and final invoice documents

## Tech Stack

- `React` + `Vite` frontend
- `React Router` for role-based app navigation
- `Node.js` + `Express` backend
- `MongoDB / Mongoose` ready backend structure
- Demo-friendly in-memory workflow and authentication store for local development

## Project Structure

```text
.
|-- client/   # React frontend
|-- server/   # Express API
|-- package.json
```

## Getting Started

### Install dependencies

```bash
npm install
```

### Run the project in development

```bash
npm run dev
```

This starts:

- the frontend with Vite
- the backend server on port `5001`

### Build the frontend

```bash
npm run build
```

### Start the backend only

```bash
npm run start
```

## Available Scripts

- `npm run dev` - run client and server together
- `npm run dev:client` - run only the frontend
- `npm run dev:server` - run only the backend
- `npm run build` - build the frontend for production
- `npm run start` - start the backend server

## Workflow Model

The current implementation follows a universal platform flow:

1. Clerk records stock activity and submits a requisition.
2. Supervisor reviews and approves or rejects the request.
3. Supplier receives approved work and submits a proforma.
4. Accountant approves the proforma and marks payment.
5. Supplier uploads delivery note and final invoice.
6. Admin tracks the full process through reporting and notifications.

## Current Status

This repository contains the working platform UI, role-based dashboards, and a local mock workflow layer that allows the product flow to be demonstrated without requiring a fully provisioned production backend.
