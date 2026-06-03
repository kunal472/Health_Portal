import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { EncryptionService } from "@/lib/crypto/encryption";
import { supabaseAdmin } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs";
import { NextRequest } from "next/server";

beforeAll(() => {
  // Polyfill Web Crypto in Node.js for PBKDF2/AES-GCM
  if (typeof window !== "undefined" && !window.crypto) {
    const { webcrypto } = require("crypto");
    Object.defineProperty(window, "crypto", {
      value: webcrypto,
      writable: true,
    });
  }
});

// Mock Clerk Auth
vi.mock("@clerk/nextjs", () => {
  return {
    auth: vi.fn(() => ({ userId: "patient_user_123" })),
  };
});

// Mock Supabase Server Admin Client
let databaseRecordStore: any = null;

vi.mock("@/lib/supabase/server", () => {
  const selectMock = vi.fn().mockReturnThis();
  const eqMock = vi.fn().mockReturnThis();
  const isMock = vi.fn().mockReturnThis();
  const orderMock = vi.fn().mockImplementation(() => {
    return Promise.resolve({ data: databaseRecordStore ? [databaseRecordStore] : [], error: null });
  });

  const insertMock = vi.fn().mockImplementation((payload) => {
    databaseRecordStore = {
      id: "inserted_record_uuid",
      patient_id: "patient_user_123",
      encrypted_iv: payload.encrypted_iv,
      encrypted_data: payload.encrypted_data,
      record_type: payload.record_type,
      record_date: payload.record_date,
      provider_name: payload.provider_name,
      revoked_at: null,
    };
    return {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: databaseRecordStore, error: null }),
      }),
    };
  });

  const fromMock = vi.fn((table) => {
    if (table === "medical_records") {
      return {
        select: selectMock,
        eq: eqMock,
        is: isMock,
        order: orderMock,
        insert: insertMock,
      };
    }
    // Audit logs table mock
    return {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return {
    supabaseAdmin: {
      from: fromMock,
    },
  };
});

describe("E2EE Medical Records Pipeline Integration", () => {
  const PASSPHRASE = "super_secure_patient_passphrase";
  const PLAINTEXT_RECORD = {
    medication_name: "Lisinopril",
    dosage: "10mg daily",
    instructions: "Take with breakfast",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    databaseRecordStore = null;
    vi.mocked(auth).mockReturnValue({ userId: "patient_user_123" } as any);
  });

  it("should encrypt record, transmit via POST, retrieve via GET, and decrypt successfully", async () => {
    // 1. Client-Side Encryption
    const salt = EncryptionService.generateSalt();
    const key = await EncryptionService.deriveKey(PASSPHRASE, salt);
    const encrypted = await EncryptionService.encrypt(PLAINTEXT_RECORD, key);

    // 2. Server-Side POST Insertion
    const postPayload = {
      encryptedIv: encrypted.iv,
      encryptedData: encrypted.ciphertext,
      recordType: "prescription",
      recordDate: "2026-06-03",
      providerName: "Dr. Sarah Johnson",
    };

    const postReq = new NextRequest("http://localhost:3000/api/medical-records", {
      method: "POST",
      body: JSON.stringify(postPayload),
    });

    const postRes = await POST(postReq);
    const postBody = await postRes.json();

    expect(postRes.status).toBe(200);
    expect(postBody.success).toBe(true);
    expect(postBody.recordId).toBe("inserted_record_uuid");
    expect(databaseRecordStore).toBeDefined();
    expect(databaseRecordStore.encrypted_data).toBe(encrypted.ciphertext);

    // 3. Server-Side GET Retrieval
    const getReq = new NextRequest("http://localhost:3000/api/medical-records");
    const getRes = await GET(getReq);
    const getBody = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getBody.success).toBe(true);
    expect(getBody.records.length).toBe(1);

    const retrievedRecord = getBody.records[0];
    expect(retrievedRecord.encrypted_data).toBe(encrypted.ciphertext);
    expect(retrievedRecord.encrypted_iv).toBe(encrypted.iv);

    // 4. Client-Side Decryption
    const decryptedData = await EncryptionService.decrypt(
      {
        iv: retrievedRecord.encrypted_iv,
        ciphertext: retrievedRecord.encrypted_data,
      },
      key
    );

    expect(decryptedData).toEqual(PLAINTEXT_RECORD);
    expect(decryptedData.medication_name).toBe("Lisinopril");
  });
});
