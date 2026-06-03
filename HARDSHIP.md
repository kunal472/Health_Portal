# Project Hardships & Technical Gaps: Smart-Clinic Health Portal ⚠️

This document analyzes the compilation issues, technical debt, mock limitations, and security/compliance hurdles identified in the Health Portal codebase, outlining what is required to make this system production-ready.

---

## 🚨 1. Compilation & Import Gaps in API Routes (RESOLVED)

> [!NOTE]
> The missing imports and export declarations detailed in this section have been resolved in the codebase.

The backend API routes initially contained several critical import omissions that prevented the Next.js project from building or running in production:

### A. Missing `createDailyRoom` Import in Appointments API
In [appointments/route.ts](file:///d:/projects/Health_Portal/src/app/api/appointments/route.ts#L100-L103), the endpoint calls `createDailyRoom` when an appointment is of type `video`:
```typescript
const roomResponse = await createDailyRoom(
  result.appointment_id!,
  userId,
);
```
However, `createDailyRoom` is defined in [helper.ts](file:///d:/projects/Health_Portal/src/utils/helper.ts) but is **never exported** from that file, nor is it **imported** in `appointments/route.ts`. 

*   **Impact:** Runtime crash or TypeScript compilation failure (`Cannot find name 'createDailyRoom'`).
*   **Resolution:** Export `createDailyRoom` from `src/utils/helper.ts` and add `import { createDailyRoom } from "@/utils/helper";` to `src/app/api/appointments/route.ts`.

### B. Missing Imports in Medical Records API
The file [medical-records/route.ts](file:///d:/projects/Health_Portal/src/app/api/medical-records/route.ts) implements complete `GET`, `POST`, and `DELETE` handlers. However, its imports block is incomplete:
```typescript
import { NextRequest, NextResponse } from "next/server";
// MISSING: import { auth } from "@clerk/nextjs";
// MISSING: import { supabaseAdmin } from "@/lib/supabase/server";
```
*   **Impact:** Immediate compilation failure because `auth()` (lines 11, 49, 106) and `supabaseAdmin` (lines 17, 27, 66, 82, 116, 130) are referenced but undefined.
*   **Resolution:** Add the missing import statements.

### C. Missing `supabaseAdmin` Import in Helper Utilities
In [helper.ts](file:///d:/projects/Health_Portal/src/utils/helper.ts#L52), the function `createDailyRoom` attempts to write the telehealth session metadata directly to the database:
```typescript
await supabaseAdmin.from("telehealth_sessions").insert({...});
```
However, `supabaseAdmin` is never imported in `helper.ts`.
*   **Impact:** Compilation failure (`Cannot find name 'supabaseAdmin'`).
*   **Resolution:** Add `import { supabaseAdmin } from "@/lib/supabase/server";` at the top of `src/utils/helper.ts`.

---

## 🔌 2. Mock State vs. API Disconnect

The frontend UI pages are completely disconnected from the actual backend API routes:
*   [page.tsx](file:///d:/projects/Health_Portal/src/app/page.tsx) uses a local `MockAPI` class and `mockTimeSlots` array. It does not fetch actual doctor slots or push bookings to `/api/appointments`.
*   [telehealth/page.tsx](file:///d:/projects/Health_Portal/src/app/telehealth/page.tsx) uses simulated user media and delays instead of loading the actual Daily iframe frame and passing the `patient_token` fetched from `/api/appointments`.
*   [ui/page.tsx](file:///d:/projects/Health_Portal/src/app/ui/page.tsx) uses static arrays for prescriptions and outputs generic alert messages rather than fetching data from `/api/medical-records` and decrypting it.

*   **Impact:** The application behaves as an interactive design demo rather than a functional database-backed client portal.
*   **Resolution:** Refactor components to replace mock calls with browser `fetch` requests pointing to the Next.js API endpoints, utilizing the `useEncryption` hook to encrypt/decrypt payloads on the fly.

---

## 🔒 3. Cryptographic Key Management & UX Hardships

Client-side E2EE introduces a classic security vs. user experience conflict:

### A. Key Loss on Page Refresh
The `useEncryption` hook ([encryption.ts](file:///d:/projects/Health_Portal/src/lib/crypto/encryption.ts#L227-L270)) keeps the derived `CryptoKey` in React component state (`key`).
*   **The Issue:** If a user reloads the browser, refreshes the tab, or navigates away, the React state is wiped. The user is instantly "locked out" of their medical records and must re-type their E2EE passphrase to re-derive the key.
*   **The Security Hardship:** 
    *   If we store the passphrase or derived key in `localStorage` or `sessionStorage` to maintain session persistence, we expose the key to **XSS (Cross-Site Scripting) vulnerability**. Any malicious third-party script or npm package dependency running in the client context could read the key and leak it.
    *   If we maintain it strictly in-memory (React state), the security posture is high, but the UX is extremely cumbersome.

### B. Single-Threaded Key Derivation (Blocking UI Thread)
PBKDF2 with 100,000 iterations is computationally heavy by design.
*   **The Issue:** Running `window.crypto.subtle.deriveKey` in the main JavaScript execution thread freezes the browser UI for a split second (especially on lower-end mobile phones).
*   **Resolution:** Offload key derivation and encrypt/decrypt heavy operations to a browser **Web Worker** to run cryptography tasks asynchronously on a background thread.

### C. Secure Context Requirement
The Web Crypto API is restricted by browsers to **Secure Contexts** (`https://` or `localhost`).
*   **The Issue:** If developer staging environments or local networks use raw IP addresses (e.g. `http://192.168.1.50:3000` for testing on a physical phone), `window.crypto.subtle` will be `undefined`, crashing the app.

---

## ⚕️ 4. HIPAA & Integration Compliance Obstacles

Achieving true HIPAA compliance requires operational contracts and configurations beyond code:

1.  **Business Associate Agreements (BAAs):**
    *   **Clerk, Supabase, and Daily.co** will handle Protected Health Information (PHI) or metadata linked to it. The organization must sign BAAs with these vendors. 
    *   Supabase and Clerk only offer BAAs on custom Enterprise contracts, which is a major financial hurdle for early-stage or boot-strapped healthcare applications.
2.  **Telemetry and Log Exposure:**
    *   Next.js API logs (Vercel, AWS CloudWatch) and Supabase console logs must be monitored to ensure no plaintext health information is accidently logged via `console.error(error)` during API failures.
3.  **Video Stream Storage:**
    *   Daily.co recordings (`daily_recording_url` in the database) are stored by default on Daily's cloud assets. If cloud recording is enabled, the stored recordings represent PHI and must be encrypted at rest, securely transferred to the healthcare provider's private S3 bucket, and deleted from Daily's servers immediately.

---

## 📦 5. Dead Code, Dead Exports & Duplicate Config Leakage

Running structural dependency analysis (e.g. `npx fallow`) reveals additional structural hardships regarding unused files, dead exports, and code duplication.

### A. 100% Dead File (`client.ts`)
*   **The Issue:** The file `src/lib/supabase/client.ts` is never imported or utilized by any active file in the project. 
*   **Reason:** The Next.js API routes and backend helpers import `supabaseAdmin` exclusively from `src/lib/supabase/server.ts`, and the client-side pages rely on mocked services rather than establishing actual connection sessions.

### B. Unused E2EE Cryptography Hook
*   **The Issue:** The React hook `useEncryption` inside [encryption.ts](file:///d:/projects/Health_Portal/src/lib/crypto/encryption.ts) is exported but **never imported** by any UI component.
*   **UX Implication:** All client-side encryption flows displayed on the scheduling page and symptom wizard are mock animations. The actual encryption hook designed to manage browser-memory cryptography keys is inactive.

### C. Client/Server Code Contamination & Secret Leaks
*   **The Issue:** The server client file `src/lib/supabase/server.ts` contains a duplicate block of the client-side configuration code, including `supabase` client and browser authentication sync methods (`setSupabaseAuth`, `clearSupabaseAuth`).
*   **The Risk:** In Next.js, importing client-side libraries on the server or server-side keys on the client poses a risk of leaking secrets. By defining `supabaseAdmin` (using `SUPABASE_SERVICE_ROLE_KEY`) and browser-bound clients in the same file, the probability of bundling server keys into client code increases.
*   **Resolution:** 
    *   Delete the dead file `src/lib/supabase/client.ts` or connect it to the pages.
    *   Separate the client-side Supabase client and server-side Supabase admin client into distinct files, using the `server-only` directive on the server configuration.
    *   Extract the inline, duplicated `Database` TypeScript interfaces into a separate shared file `src/lib/supabase/types.ts` to keep the codebase DRY.
