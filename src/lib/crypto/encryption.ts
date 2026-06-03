// ============================================
// FILE: lib/crypto/encryption.ts
// Client-Side End-to-End Encryption Service
// ============================================

import React from "react";

interface EncryptedData {
  iv: string;
  ciphertext: string;
}

interface KeyMaterial {
  salt: Uint8Array;
  version: number;
}

/**
 * Client-side encryption service using Web Crypto API
 * All operations happen in the browser - server never sees plaintext
 */
export class EncryptionService {
  private static readonly ALGORITHM = "AES-GCM";
  private static readonly KEY_LENGTH = 256;
  private static readonly ITERATIONS = 100000; // OWASP recommendation
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;

  /**
   * Generate cryptographically secure salt
   */
  static generateSalt(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
  }

  /**
   * Derive encryption key from user passphrase using PBKDF2
   * @param passphrase - User's encryption passphrase (NOT their login password)
   * @param salt - Salt from user profile
   */
  static async deriveKey(
    passphrase: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
    if (!passphrase || passphrase.length < 8) {
      throw new Error("Passphrase must be at least 8 characters");
    }

    const encoder = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );

    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: this.ITERATIONS,
        hash: "SHA-256",
      },
      passphraseKey,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false, // Not extractable (security)
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Encrypt data using AES-GCM
   * @param data - Plain object to encrypt
   * @param key - CryptoKey from deriveKey()
   */
  static async encrypt(data: any, key: CryptoKey): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv: iv },
      key,
      encoder.encode(JSON.stringify(data)),
    );

    return {
      iv: this.bufferToBase64(iv),
      ciphertext: this.bufferToBase64(encryptedBuffer),
    };
  }

  /**
   * Decrypt ciphertext back to original data
   * @param encrypted - Object with iv and ciphertext
   * @param key - CryptoKey from deriveKey()
   */
  static async decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<any> {
    const iv = this.base64ToBuffer(encrypted.iv);
    const ciphertext = this.base64ToBuffer(encrypted.ciphertext);

    try {
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv },
        key,
        ciphertext,
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decryptedBuffer));
    } catch (error) {
      throw new Error(
        "Decryption failed: Invalid passphrase or corrupted data",
      );
    }
  }

  /**
   * Verify passphrase by attempting to decrypt a test payload
   */
  static async verifyPassphrase(
    passphrase: string,
    salt: Uint8Array,
    testEncrypted: EncryptedData,
  ): Promise<boolean> {
    try {
      const key = await this.deriveKey(passphrase, salt);
      await this.decrypt(testEncrypted, key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rotate encryption key (for periodic security updates)
   * @param oldPassphrase - Current passphrase
   * @param newPassphrase - New passphrase
   * @param oldSalt - Current salt
   * @param encryptedData - Array of encrypted records to re-encrypt
   */
  static async rotateKey(
    oldPassphrase: string,
    newPassphrase: string,
    oldSalt: Uint8Array,
    encryptedData: EncryptedData[],
  ): Promise<{
    newSalt: Uint8Array;
    reEncryptedData: EncryptedData[];
  }> {
    // Derive old key
    const oldKey = await this.deriveKey(oldPassphrase, oldSalt);

    // Generate new salt and derive new key
    const newSalt = this.generateSalt();
    const newKey = await this.deriveKey(newPassphrase, newSalt);

    // Decrypt with old key, re-encrypt with new key
    const reEncryptedData = await Promise.all(
      encryptedData.map(async (encrypted) => {
        const plaintext = await this.decrypt(encrypted, oldKey);
        return this.encrypt(plaintext, newKey);
      }),
    );

    return { newSalt, reEncryptedData };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private static bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private static base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Convert salt to/from base64 for storage
   */
  static saltToBase64(salt: Uint8Array): string {
    return this.bufferToBase64(salt.buffer);
  }

  static base64ToSalt(base64: string): Uint8Array {
    return new Uint8Array(this.base64ToBuffer(base64));
  }

  /**
   * Generate a secure passphrase hint (for password recovery)
   * Uses last 4 characters + asterisks
   */
  static generatePassphraseHint(passphrase: string): string {
    if (passphrase.length < 8) return "****";
    const visibleChars = passphrase.slice(-4);
    return "*".repeat(passphrase.length - 4) + visibleChars;
  }

  /**
   * Estimate key derivation time (for UX loading indicators)
   */
  static async estimateKeyDerivationTime(): Promise<number> {
    const start = performance.now();
    const testSalt = this.generateSalt();
    await this.deriveKey("test-passphrase-12345", testSalt);
    return performance.now() - start;
  }
}

/**
 * React Hook for encryption operations
 * Manages key in memory and provides encrypt/decrypt methods
 */
export function useEncryption() {
  const [key, setKey] = React.useState<CryptoKey | null>(null);
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const unlock = async (passphrase: string, salt: Uint8Array) => {
    try {
      setError(null);
      const derivedKey = await EncryptionService.deriveKey(passphrase, salt);
      setKey(derivedKey);
      setIsUnlocked(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlock");
      return false;
    }
  };

  const lock = () => {
    setKey(null);
    setIsUnlocked(false);
  };

  const encrypt = async (data: any) => {
    if (!key)
      throw new Error("Encryption key not available. Call unlock() first.");
    return EncryptionService.encrypt(data, key);
  };

  const decrypt = async (encrypted: EncryptedData) => {
    if (!key)
      throw new Error("Encryption key not available. Call unlock() first.");
    return EncryptionService.decrypt(encrypted, key);
  };

  return {
    isUnlocked,
    error,
    unlock,
    lock,
    encrypt,
    decrypt,
  };
}

// Export for use in other modules
export default EncryptionService;
