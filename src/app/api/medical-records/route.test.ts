import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "./route";
import { supabaseAdmin } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs";

// Mock Clerk Auth
vi.mock("@clerk/nextjs", () => {
  return {
    auth: vi.fn(() => ({ userId: "test_user_id" })),
  };
});

// Define variables starting with 'mock' so they can be referenced inside vi.mock
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockIs = vi.fn().mockReturnThis();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

// Mock Supabase Server Admin Client
vi.mock("@/lib/supabase/server", () => {
  const fromMock = vi.fn((table) => {
    if (table === "medical_records") {
      return {
        select: mockSelect,
        eq: mockEq,
        is: mockIs,
        order: mockOrder,
        insert: mockInsert,
        update: mockUpdate,
      };
    }
    // Audit logs inserts
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

describe("Medical Records API endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockReturnValue({ userId: "test_user_id" } as any);

    // Set default mock implementations
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockIs.mockReturnThis();
    mockOrder.mockResolvedValue({ data: [{ id: "record_123", record_type: "prescription" }], error: null });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "record_new" }, error: null }),
      }),
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  it("should fetch active medical records on GET requests", async () => {
    const req = new NextRequest("http://localhost:3000/api/medical-records");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.records).toBeDefined();
    expect(body.records.length).toBe(1);

    expect(supabaseAdmin.from).toHaveBeenCalledWith("medical_records");
  });

  it("should return 500 on GET if database query fails", async () => {
    mockOrder.mockResolvedValue({ data: null, error: new Error("Database query failed") });

    const req = new NextRequest("http://localhost:3000/api/medical-records");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to fetch records");
  });

  it("should save an encrypted medical record on POST requests", async () => {
    const payload = {
      encryptedIv: "iv_base64",
      encryptedData: "ciphertext_base64",
      recordType: "prescription",
      recordDate: "2026-02-05",
      providerName: "Dr. Sarah Johnson",
    };

    const req = new NextRequest("http://localhost:3000/api/medical-records", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.recordId).toBe("record_new");

    expect(supabaseAdmin.from).toHaveBeenCalledWith("medical_records");
  });

  it("should return 500 on POST if database insert fails", async () => {
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("Database insert failed") }),
      }),
    });

    const payload = {
      encryptedIv: "iv_base64",
      encryptedData: "ciphertext_base64",
      recordType: "prescription",
      recordDate: "2026-02-05",
      providerName: "Dr. Sarah Johnson",
    };

    const req = new NextRequest("http://localhost:3000/api/medical-records", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to create record");
  });

  it("should revoke specific record on DELETE requests when ID is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/medical-records?id=record_123", {
      method: "DELETE",
    });

    const response = await DELETE(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(supabaseAdmin.from).toHaveBeenCalledWith("medical_records");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked_at: expect.any(String),
      })
    );
  });

  it("should return 500 on DELETE if database update fails", async () => {
    mockUpdate.mockImplementation(() => {
      throw new Error("Database update failed");
    });

    const req = new NextRequest("http://localhost:3000/api/medical-records?id=record_123", {
      method: "DELETE",
    });

    const response = await DELETE(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to revoke record");
  });

  it("should fail GET if unauthorized", async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);
    const req = new NextRequest("http://localhost:3000/api/medical-records");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should fail POST if unauthorized", async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);
    const req = new NextRequest("http://localhost:3000/api/medical-records", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should fail DELETE if unauthorized", async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);
    const req = new NextRequest("http://localhost:3000/api/medical-records", {
      method: "DELETE",
    });
    const response = await DELETE(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should revoke all records on DELETE if no ID is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/medical-records", {
      method: "DELETE",
    });

    const response = await DELETE(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(supabaseAdmin.from).toHaveBeenCalledWith("medical_records");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked_at: expect.any(String),
      })
    );
  });
});
