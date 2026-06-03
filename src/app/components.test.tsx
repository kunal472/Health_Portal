import { describe, it, expect, vi, beforeAll } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TrustCenteredUX from "./ui/page";

beforeAll(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, records: [] }),
  } as any);
});

// Mock Supabase Client
vi.mock("@/lib/supabase/client", () => {
  const fromMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { encryption_salt: "salt_base64" }, error: null }),
  });

  return {
    supabase: {
      from: fromMock,
    },
  };
});

// Mock E2EE hook
let mockIsUnlocked = false;
const unlockMock = vi.fn().mockImplementation(async () => {
  mockIsUnlocked = true;
  return true;
});
const encryptMock = vi.fn().mockResolvedValue({ iv: "iv_base64", ciphertext: "cipher_base64" });
const decryptMock = vi.fn().mockResolvedValue({ name: "Lisinopril", dosage: "10mg tablet", schedule: [] });

vi.mock("@/lib/crypto/encryption", () => {
  return {
    EncryptionService: {
      base64ToSalt: vi.fn().mockReturnValue(new Uint8Array(16)),
    },
    useEncryption: () => ({
      isUnlocked: mockIsUnlocked,
      unlock: unlockMock,
      lock: vi.fn(),
      encrypt: encryptMock,
      decrypt: decryptMock,
      error: null,
    }),
  };
});

describe("TrustCenteredUX page components", () => {
  it("should render E2EE Passphrase Unlock Gate initially when locked", () => {
    mockIsUnlocked = false;
    render(<TrustCenteredUX />);

    expect(screen.getByText("Unlock Secure Health Portal")).toBeDefined();
    expect(screen.getByPlaceholderText("e.g. passphrase123")).toBeDefined();
  });

  it("should unlock the session and load the secure dashboard when passphrase is correct", async () => {
    mockIsUnlocked = false;
    render(<TrustCenteredUX />);

    const input = screen.getByPlaceholderText("e.g. passphrase123");
    const submitBtn = screen.getByText("Unlock Session");

    fireEvent.change(input, { target: { value: "mysecretpassphrase" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(unlockMock).toHaveBeenCalledWith("mysecretpassphrase", expect.any(Uint8Array));
      expect(screen.queryByText("Unlock Secure Health Portal")).toBeNull();
      expect(screen.getByText("Phase 4: Trust-Centered UX")).toBeDefined();
    });
  });

  it("should navigate tabs and display Trust Badge content when unlocked", async () => {
    mockIsUnlocked = true;
    render(<TrustCenteredUX />);

    // Renders header and tabs
    expect(screen.getByText("Phase 4: Trust-Centered UX")).toBeDefined();

    // Verify timeline tab renders
    const timelineTab = screen.getByText("Prescription Timeline");
    fireEvent.click(timelineTab);
    expect(screen.getByText("Medication Schedule")).toBeDefined();

    // Verify wizard tab renders
    const wizardTab = screen.getByText("Symptom Wizard");
    fireEvent.click(wizardTab);
    expect(screen.getByText("What's your primary concern?")).toBeDefined();
  });
});
