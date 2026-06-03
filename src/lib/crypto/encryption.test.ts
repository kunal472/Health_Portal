import { describe, it, expect, beforeAll } from "vitest";
import { EncryptionService, useEncryption } from "./encryption";
import { renderHook, act } from "@testing-library/react";

beforeAll(() => {
  // Polyfill Web Crypto in Node.js environment for Vitest jsdom
  if (typeof window !== "undefined" && !window.crypto) {
    const { webcrypto } = require("crypto");
    Object.defineProperty(window, "crypto", {
      value: webcrypto,
      writable: true,
    });
  }
});

describe("EncryptionService", () => {
  const PASSPHRASE = "secure_test_passphrase_12345";
  const TEST_DATA = { symptoms: "cough", diagnosis: "common cold", severity: "mild" };

  it("should generate a 16-byte salt", () => {
    const salt = EncryptionService.generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(16);
  });

  it("should convert salt to base64 and back", () => {
    const salt = EncryptionService.generateSalt();
    const base64 = EncryptionService.saltToBase64(salt);
    expect(typeof base64).toBe("string");

    const decoded = EncryptionService.base64ToSalt(base64);
    expect(decoded).toEqual(salt);
  });

  it("should derive a CryptoKey from a passphrase and salt", async () => {
    const salt = EncryptionService.generateSalt();
    const key = await EncryptionService.deriveKey(PASSPHRASE, salt);
    expect(key.type).toBe("secret");
    expect(key.algorithm.name).toBe("AES-GCM");
  });

  it("should fail to derive a key if the passphrase is too short", async () => {
    const salt = EncryptionService.generateSalt();
    await expect(EncryptionService.deriveKey("short", salt)).rejects.toThrow(
      "Passphrase must be at least 8 characters"
    );
  });

  it("should encrypt and decrypt a JSON payload", async () => {
    const salt = EncryptionService.generateSalt();
    const key = await EncryptionService.deriveKey(PASSPHRASE, salt);

    const encrypted = await EncryptionService.encrypt(TEST_DATA, key);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();

    const decrypted = await EncryptionService.decrypt(encrypted, key);
    expect(decrypted).toEqual(TEST_DATA);
  });

  it("should verify a passphrase correctly", async () => {
    const salt = EncryptionService.generateSalt();
    const key = await EncryptionService.deriveKey(PASSPHRASE, salt);
    const encrypted = await EncryptionService.encrypt(TEST_DATA, key);

    const isValid = await EncryptionService.verifyPassphrase(PASSPHRASE, salt, encrypted);
    expect(isValid).toBe(true);

    const isInvalid = await EncryptionService.verifyPassphrase("wrong_passphrase", salt, encrypted);
    expect(isInvalid).toBe(false);
  });

  it("should rotate keys correctly", async () => {
    const oldSalt = EncryptionService.generateSalt();
    const oldKey = await EncryptionService.deriveKey(PASSPHRASE, oldSalt);
    const encryptedRecord = await EncryptionService.encrypt(TEST_DATA, oldKey);

    const newPassphrase = "brand_new_passphrase_98765";
    const { newSalt, reEncryptedData } = await EncryptionService.rotateKey(
      PASSPHRASE,
      newPassphrase,
      oldSalt,
      [encryptedRecord]
    );

    expect(newSalt).toBeInstanceOf(Uint8Array);
    expect(newSalt).not.toEqual(oldSalt);
    expect(reEncryptedData.length).toBe(1);

    const newKey = await EncryptionService.deriveKey(newPassphrase, newSalt);
    const decrypted = await EncryptionService.decrypt(reEncryptedData[0], newKey);
    expect(decrypted).toEqual(TEST_DATA);
  });

  it("should generate a masked passphrase hint", () => {
    const hint = EncryptionService.generatePassphraseHint(PASSPHRASE);
    expect(hint).toContain("2345");
    expect(hint.startsWith("*")).toBe(true);

    const shortHint = EncryptionService.generatePassphraseHint("short");
    expect(shortHint).toBe("****");
  });

  it("should estimate key derivation performance", async () => {
    const time = await EncryptionService.estimateKeyDerivationTime();
    expect(typeof time).toBe("number");
    expect(time).toBeGreaterThanOrEqual(0);
  });
});

describe("useEncryption Hook", () => {
  const PASSPHRASE = "secure_test_passphrase_12345";

  it("should initialize as locked", () => {
    const { result } = renderHook(() => useEncryption());
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should unlock and encrypt/decrypt data successfully", async () => {
    const { result } = renderHook(() => useEncryption());
    const salt = EncryptionService.generateSalt();

    let success;
    await act(async () => {
      success = await result.current.unlock(PASSPHRASE, salt);
    });

    expect(success).toBe(true);
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.error).toBeNull();

    const data = { message: "hello E2EE" };
    let encrypted: any;
    await act(async () => {
      encrypted = await result.current.encrypt(data);
    });

    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();

    let decrypted;
    await act(async () => {
      decrypted = await result.current.decrypt(encrypted);
    });

    expect(decrypted).toEqual(data);

    // Lock the session
    act(() => {
      result.current.lock();
    });
    expect(result.current.isUnlocked).toBe(false);
  });

  it("should set error state if unlock fails", async () => {
    const { result } = renderHook(() => useEncryption());
    const salt = EncryptionService.generateSalt();

    let success;
    await act(async () => {
      success = await result.current.unlock("", salt);
    });

    expect(success).toBe(false);
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.error).toBe("Passphrase must be at least 8 characters");
  });

  it("should handle non-Error exceptions in unlock", async () => {
    const originalDeriveKey = EncryptionService.deriveKey;
    EncryptionService.deriveKey = vi.fn().mockRejectedValue("non-error-string");

    const { result } = renderHook(() => useEncryption());
    const salt = EncryptionService.generateSalt();

    let success;
    await act(async () => {
      success = await result.current.unlock("some_passphrase", salt);
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("Failed to unlock");

    // Restore original method
    EncryptionService.deriveKey = originalDeriveKey;
  });

  it("should throw error if encrypt is called before unlock", async () => {
    const { result } = renderHook(() => useEncryption());
    await expect(result.current.encrypt({ message: "test" })).rejects.toThrow(
      "Encryption key not available. Call unlock() first."
    );
  });

  it("should throw error if decrypt is called before unlock", async () => {
    const { result } = renderHook(() => useEncryption());
    await expect(result.current.decrypt({ iv: "iv", ciphertext: "cipher" })).rejects.toThrow(
      "Encryption key not available. Call unlock() first."
    );
  });
});
