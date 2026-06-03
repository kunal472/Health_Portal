# Smart-Clinic Health Portal 🛡️

A secure, HIPAA-compliant patient and telehealth portal featuring end-to-end encryption (E2EE), real-time video consultations, atomic appointment scheduling, and trust-centered UX.

---

## 🌟 Key Features

*   **End-to-End Encryption (E2EE):** Patient medical records and sensitive appointment notes are encrypted directly in the user's browser using AES-GCM-256. The server only sees ciphertext.
*   **Atomic Scheduling System:** Atomic booking of appointments utilizing custom database transactional stored procedures (RPCs) to completely prevent race conditions and double-booking.
*   **Telehealth Suite:** High-quality, HIPAA-compliant video calls powered by Daily.co, with pre-call device checking (camera, microphone, latency) and recording capabilities.
*   **Clerk Syncing Webhook:** Custom backend webhook synchronizing Clerk authentication profiles to Postgres user profiles, automatically provisioning cryptographic parameters (salts) for PBKDF2 key derivation.
*   **Trust-Centered UX:** Accessible UI implementing WCAG 2.1 AA guidelines, a session encryption trust badge indicator, prescription schedule timeline, and a progressive-disclosure symptom wizard to lower cognitive load.

---

## 🛠️ Tech Stack

*   **Frontend Framework:** Next.js (App Router, TypeScript, React 19)
*   **Styling & UI:** Tailwind CSS v4, Lucide React
*   **Database & API:** Supabase (PostgreSQL with Row Level Security, RPCs)
*   **Authentication:** Clerk
*   **Video Infrastructure:** Daily.co WebRTC API
*   **Cryptography:** Web Crypto API (AES-GCM, PBKDF2)

---

## 🏗️ Project Architecture & Layout

For a detailed breakdown of the cryptographic mechanisms, database policies, and network flows, see [ARCHITECTURE.md](file:///d:/projects/Health_Portal/ARCHITECTURE.md).

```text
├── schema.sql                 # Complete database schema (Supabase/PostgreSQL)
├── src/
│   ├── app/                   # Next.js App Router Pages & API Routes
│   │   ├── api/               # Server-side API Endpoints
│   │   │   ├── appointments   # GET & POST endpoints for booking
│   │   │   ├── medical-records# GET, POST, & DELETE (Revoke) endpoints
│   │   │   └── webhooks/clerk # Clerk webhook listener for user syncing
│   │   ├── telehealth/        # Pre-call check & Video Call Suite (Phase 3)
│   │   ├── ui/                # Trust-Centered UX & Schedule Timeline (Phase 4)
│   │   ├── globals.css        # Global CSS stylesheet
│   │   ├── layout.tsx         # Root Layout
│   │   └── page.tsx           # Appointment Booking Wizard UI (Phase 2)
│   ├── lib/                   # Shared Client & Server utilities
│   │   ├── crypto/            # Client-side Web Cryptography Service (E2EE)
│   │   └── supabase/          # Supabase Browser and Admin clients
│   ├── utils/
│   │   └── helper.ts          # Server-side video room creators
│   └── middleware.ts          # Clerk route protection middleware
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have Node.js installed (v18+ recommended) and a package manager like npm, yarn, or pnpm.

### 2. Environment Setup
Create a `.env.local` file in the root directory based on [.env.example](file:///d:/projects/Health_Portal/.env.example):

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Daily.co Telehealth
DAILY_API_KEY=your_daily_api_key
DAILY_DOMAIN=your_daily_domain
```

### 3. Database Initialization
1. Spin up a new PostgreSQL database on [Supabase](https://supabase.com).
2. Execute the DDL script in [schema.sql](file:///d:/projects/Health_Portal/schema.sql) using the Supabase SQL Editor. This will configure the tables, default Row Level Security (RLS) policies, indexes, and custom RPC functions.

### 4. Installation & Local Development
Install dependencies and run the server locally:

```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the portal.

---

## 🧪 Commands & Scripts

*   `npm run dev` - Starts the development server.
*   `npm run build` - Builds the application for production.
*   `npm run lint` - Runs ESLint to check for code quality and syntax errors.
*   `npx supabase gen types typescript --project-id your-project-id > src/lib/supabase/types.ts` - Regenerates TypeScript definitions from your active Supabase database schema.

---

## ⚠️ Challenges & Limitations
To review compile-time issues, architectural trade-offs, and critical gaps in this codebase, see the [HARDSHIP.md](file:///d:/projects/Health_Portal/HARDSHIP.md) document.
