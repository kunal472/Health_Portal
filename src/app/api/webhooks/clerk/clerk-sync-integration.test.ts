import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { POST } from "./route";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EncryptionService } from "@/lib/crypto/encryption";

// Mock store for next/headers
const mockHeadersStore = new Map<string, string>();

beforeAll(() => {
  // Polyfill Web Crypto in Node.js for PBKDF2/AES-GCM
  if (typeof window !== "undefined" && !window.crypto) {
    const { webcrypto } = require("crypto");
    Object.defineProperty(window, "crypto", {
      value: webcrypto,
      writable: true,
    });
  }

  // Set mock webhook secret
  process.env.CLERK_WEBHOOK_SECRET = "mock_webhook_secret_key";
});

// Mock next/headers
vi.mock("next/headers", () => {
  return {
    headers: vi.fn(() => ({
      get: vi.fn((key: string) => mockHeadersStore.get(key) || null),
    })),
  };
});

const mockVerify = vi.fn();

// Mock Svix Webhook verification
vi.mock("svix", () => {
  return {
    Webhook: class {
      verify = mockVerify;
    },
  };
});

// Mock Database Store
let profilesStore: any[] = [];

// Mock Supabase Server Admin Client
vi.mock("@/lib/supabase/server", () => {
  const fromMock = vi.fn((table) => {
    if (table === "user_profiles") {
      return {
        insert: vi.fn().mockImplementation((payload) => {
          profilesStore.push(payload);
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn().mockImplementation((payload) => {
          return {
            eq: vi.fn().mockImplementation((col, val) => {
              profilesStore = profilesStore.map((profile) => {
                if (profile[col] === val) {
                  return { ...profile, ...payload };
                }
                return profile;
              });
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }),
      };
    }
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

describe("Clerk Webhook Sync Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profilesStore = [];
    mockHeadersStore.clear();

    mockVerify.mockImplementation((body, headers) => {
      // If the signature is "invalid_sig", throw verification error
      if (headers["svix-signature"] === "invalid_sig") {
        throw new Error("Webhook verification failed");
      }
      return JSON.parse(body);
    });
  });

  it("should process user.created webhook event, generate salt and sync to DB", async () => {
    const clerkUserPayload = {
      type: "user.created",
      data: {
        id: "clerk_user_111",
        email_addresses: [
          {
            email_address: "john.doe@example.com",
          },
        ],
        first_name: "John",
        last_name: "Doe",
      },
    };

    // Set headers in the mock store
    mockHeadersStore.set("svix-id", "msg_123");
    mockHeadersStore.set("svix-timestamp", "1234567890");
    mockHeadersStore.set("svix-signature", "v1,valid_signature_hash");

    const req = new Request("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(clerkUserPayload),
    });

    const response = await POST(req);
    const bodyText = await response.text();

    expect(response.status).toBe(200);
    expect(bodyText).toBe("Webhook processed");

    // Verify user profile is stored correctly
    expect(profilesStore.length).toBe(1);
    const createdProfile = profilesStore[0];
    expect(createdProfile.clerk_user_id).toBe("clerk_user_111");
    expect(createdProfile.email).toBe("john.doe@example.com");
    expect(createdProfile.full_name).toBe("John Doe");
    
    // Verify cryptographic salt was generated and is valid base64
    expect(createdProfile.encryption_salt).toBeDefined();
    expect(typeof createdProfile.encryption_salt).toBe("string");
    expect(createdProfile.encryption_salt.length).toBeGreaterThan(10);
    expect(createdProfile.salt_version).toBe(1);
  });

  it("should process user.updated webhook event and update DB", async () => {
    // Seed the store with initial user
    profilesStore.push({
      clerk_user_id: "clerk_user_111",
      email: "john.doe@example.com",
      full_name: "John Doe",
      encryption_salt: "some_mock_salt_base64",
      salt_version: 1,
    });

    const clerkUserUpdatedPayload = {
      type: "user.updated",
      data: {
        id: "clerk_user_111",
        email_addresses: [
          {
            email_address: "john.updated@example.com",
          },
        ],
        first_name: "Johnny",
        last_name: "Doey",
      },
    };

    // Set headers in the mock store
    mockHeadersStore.set("svix-id", "msg_123");
    mockHeadersStore.set("svix-timestamp", "1234567890");
    mockHeadersStore.set("svix-signature", "v1,valid_signature_hash");

    const req = new Request("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(clerkUserUpdatedPayload),
    });

    const response = await POST(req);
    const bodyText = await response.text();

    expect(response.status).toBe(200);
    expect(bodyText).toBe("Webhook processed");

    // Verify user profile updated in database
    expect(profilesStore.length).toBe(1);
    const updatedProfile = profilesStore[0];
    expect(updatedProfile.clerk_user_id).toBe("clerk_user_111");
    expect(updatedProfile.email).toBe("john.updated@example.com");
    expect(updatedProfile.full_name).toBe("Johnny Doey");
    expect(updatedProfile.updated_at).toBeDefined();
  });

  it("should process user.created webhook event with empty names and email address", async () => {
    const clerkUserPayload = {
      type: "user.created",
      data: {
        id: "clerk_user_222",
        email_addresses: [],
        first_name: null,
        last_name: null,
      },
    };

    mockHeadersStore.set("svix-id", "msg_456");
    mockHeadersStore.set("svix-timestamp", "1234567890");
    mockHeadersStore.set("svix-signature", "v1,valid_signature_hash");

    const req = new Request("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(clerkUserPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(profilesStore.length).toBe(1);
    const createdProfile = profilesStore[0];
    expect(createdProfile.clerk_user_id).toBe("clerk_user_222");
    expect(createdProfile.email).toBe("");
    expect(createdProfile.full_name).toBe("");
  });

  it("should process user.updated webhook event with empty names and email address", async () => {
    profilesStore.push({
      clerk_user_id: "clerk_user_222",
      email: "",
      full_name: "",
      encryption_salt: "some_mock_salt_base64",
      salt_version: 1,
    });

    const clerkUserUpdatedPayload = {
      type: "user.updated",
      data: {
        id: "clerk_user_222",
        email_addresses: [],
        first_name: null,
        last_name: null,
      },
    };

    mockHeadersStore.set("svix-id", "msg_456");
    mockHeadersStore.set("svix-timestamp", "1234567890");
    mockHeadersStore.set("svix-signature", "v1,valid_signature_hash");

    const req = new Request("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify(clerkUserUpdatedPayload),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    expect(profilesStore.length).toBe(1);
    const updatedProfile = profilesStore[0];
    expect(updatedProfile.email).toBe("");
    expect(updatedProfile.full_name).toBe("");
  });

  it("should return 400 when missing svix headers", async () => {
    // Do not set svix headers in mockHeadersStore

    const req = new Request("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(req);
    const bodyText = await response.text();

    expect(response.status).toBe(400);
    expect(bodyText).toBe("Missing headers");
  });

  it("should return 400 on invalid signature verification", async () => {
    // Set invalid signature header
    mockHeadersStore.set("svix-id", "msg_123");
    mockHeadersStore.set("svix-timestamp", "1234567890");
    mockHeadersStore.set("svix-signature", "invalid_sig");

    const req = new Request("http://localhost:3000/api/webhooks/clerk", {
      method: "POST",
      body: JSON.stringify({ type: "user.created", data: {} }),
    });

    const response = await POST(req);
    const bodyText = await response.text();

    expect(response.status).toBe(400);
    expect(bodyText).toBe("Invalid signature");
  });
});
