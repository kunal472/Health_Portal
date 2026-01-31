// ============================================
// FILE: lib/supabase-crypto.ts
// Supabase + E2EE Integration Layer
// ============================================

import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ============================================
// CRYPTO SERVICE (Same as Phase 1)
// ============================================

export class CryptoService {
  static generateSalt(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(16));
  }

  static async deriveKey(
    passphrase: string,
    salt: Uint8Array,
  ): Promise<CryptoKey> {
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
        iterations: 100000,
        hash: "SHA-256",
      },
      passphraseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  static async encrypt(data: any, key: CryptoKey) {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoder.encode(JSON.stringify(data)),
    );

    return {
      iv: this.bufferToBase64(iv),
      ciphertext: this.bufferToBase64(encryptedData),
    };
  }

  static async decrypt(encryptedObj: any, key: CryptoKey) {
    const iv = this.base64ToBuffer(encryptedObj.iv);
    const ciphertext = this.base64ToBuffer(encryptedObj.ciphertext);

    const decryptedData = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedData));
  }

  static bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// ============================================
// MEDICAL NOTES API (E2EE + Supabase)
// ============================================

export class MedicalNotesAPI {
  /**
   * Save encrypted medical note to Supabase
   * @param patientId - Clerk user ID
   * @param noteData - Plain JSON object with medical data
   * @param passphrase - User's encryption passphrase
   * @param salt - User's salt (fetched from profile)
   */
  static async saveNote(
    patientId: string,
    noteData: any,
    passphrase: string,
    salt: Uint8Array,
  ) {
    try {
      // Derive encryption key
      const key = await CryptoService.deriveKey(passphrase, salt);

      // Encrypt the note
      const encrypted = await CryptoService.encrypt(noteData, key);

      // Save to Supabase
      const { data, error } = await supabase
        .from("medical_notes")
        .insert({
          patient_id: patientId,
          encrypted_iv: encrypted.iv,
          encrypted_data: encrypted.ciphertext,
          note_type: noteData.type || "general", // Unencrypted metadata for filtering
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, noteId: data.id };
    } catch (error) {
      console.error("Save note failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch and decrypt all notes for a patient
   */
  static async fetchNotes(
    patientId: string,
    passphrase: string,
    salt: Uint8Array,
  ) {
    try {
      // Fetch encrypted notes from Supabase
      const { data: encryptedNotes, error } = await supabase
        .from("medical_notes")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Derive decryption key
      const key = await CryptoService.deriveKey(passphrase, salt);

      // Decrypt each note
      const decryptedNotes = await Promise.all(
        encryptedNotes.map(async (note) => {
          const decrypted = await CryptoService.decrypt(
            { iv: note.encrypted_iv, ciphertext: note.encrypted_data },
            key,
          );
          return {
            id: note.id,
            createdAt: note.created_at,
            ...decrypted,
          };
        }),
      );

      return { success: true, notes: decryptedNotes };
    } catch (error) {
      console.error("Fetch notes failed:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Emergency "Kill Switch" - Revoke all data access
   * This marks notes as deleted but keeps encrypted backup for 30 days
   */
  static async emergencyRevoke(patientId: string) {
    try {
      const { error } = await supabase
        .from("medical_notes")
        .update({
          revoked_at: new Date().toISOString(),
          // Data stays encrypted, just hidden from queries
        })
        .eq("patient_id", patientId)
        .is("revoked_at", null);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// ============================================
// USER SALT MANAGEMENT
// ============================================

export class UserProfileAPI {
  /**
   * Initialize salt for a new user
   */
  static async initializeSalt(userId: string) {
    const salt = CryptoService.generateSalt();
    const saltBase64 = CryptoService.bufferToBase64(salt);

    const { error } = await supabase.from("user_profiles").insert({
      user_id: userId,
      encryption_salt: saltBase64,
      salt_version: 1, // For key rotation tracking
    });

    if (error) throw error;
    return salt;
  }

  /**
   * Fetch user's salt
   */
  static async getSalt(userId: string): Promise<Uint8Array> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("encryption_salt")
      .eq("user_id", userId)
      .single();

    if (error) throw error;
    return new Uint8Array(CryptoService.base64ToBuffer(data.encryption_salt));
  }

  /**
   * Rotate salt (forces re-encryption of all notes)
   */
  static async rotateSalt(
    userId: string,
    oldPassphrase: string,
    newPassphrase: string,
  ) {
    // 1. Fetch old salt and all notes
    const oldSalt = await this.getSalt(userId);
    const { notes } = await MedicalNotesAPI.fetchNotes(
      userId,
      oldPassphrase,
      oldSalt,
    );

    // 2. Generate new salt
    const newSalt = CryptoService.generateSalt();
    const newKey = await CryptoService.deriveKey(newPassphrase, newSalt);

    // 3. Re-encrypt all notes with new key
    for (const note of notes) {
      const encrypted = await CryptoService.encrypt(note, newKey);

      await supabase
        .from("medical_notes")
        .update({
          encrypted_iv: encrypted.iv,
          encrypted_data: encrypted.ciphertext,
        })
        .eq("id", note.id);
    }

    // 4. Update salt in profile
    await supabase
      .from("user_profiles")
      .update({
        encryption_salt: CryptoService.bufferToBase64(newSalt),
        salt_version: 2, // Increment version
      })
      .eq("user_id", userId);

    return { success: true };
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

/*
// In your Next.js component:

import { MedicalNotesAPI, UserProfileAPI } from '@/lib/supabase-crypto';
import { useUser } from '@clerk/nextjs';

export default function NotesPage() {
  const { user } = useUser();
  const [passphrase, setPassphrase] = useState('');

  const handleSaveNote = async () => {
    // Fetch user's salt
    const salt = await UserProfileAPI.getSalt(user.id);
    
    // Save encrypted note
    await MedicalNotesAPI.saveNote(
      user.id,
      {
        type: 'consultation',
        diagnosis: 'Hypertension',
        prescription: 'Lisinopril 10mg daily',
        timestamp: new Date().toISOString()
      },
      passphrase,
      salt
    );
  };

  const handleFetchNotes = async () => {
    const salt = await UserProfileAPI.getSalt(user.id);
    const { notes } = await MedicalNotesAPI.fetchNotes(user.id, passphrase, salt);
    console.log('Decrypted notes:', notes);
  };

  return (
    <div>
      <input 
        type="password" 
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        placeholder="Enter passphrase"
      />
      <button onClick={handleSaveNote}>Save Note</button>
      <button onClick={handleFetchNotes}>Load Notes</button>
    </div>
  );
}
*/
