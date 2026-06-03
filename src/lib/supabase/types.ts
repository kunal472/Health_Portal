export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          date_of_birth: string | null;
          encryption_salt: string;
          salt_version: number;
          notification_preferences: Json;
          timezone: string;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          encryption_salt: string;
          salt_version?: number;
          notification_preferences?: Json;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          encryption_salt?: string;
          salt_version?: number;
          notification_preferences?: Json;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
      };
      time_slots: {
        Row: {
          id: string;
          doctor_id: string;
          doctor_name: string;
          slot_date: string;
          slot_time: string;
          duration_minutes: number;
          is_booked: boolean;
          booked_by: string | null;
          booked_at: string | null;
          confirmed: boolean;
          slot_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          doctor_name: string;
          slot_date: string;
          slot_time: string;
          duration_minutes?: number;
          is_booked?: boolean;
          booked_by?: string | null;
          booked_at?: string | null;
          confirmed?: boolean;
          slot_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          doctor_id?: string;
          doctor_name?: string;
          slot_date?: string;
          slot_time?: string;
          duration_minutes?: number;
          is_booked?: boolean;
          booked_by?: string | null;
          booked_at?: string | null;
          confirmed?: boolean;
          slot_type?: string;
          created_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          time_slot_id: string;
          appointment_type: string;
          status: string;
          encrypted_iv: string | null;
          encrypted_notes: string | null;
          daily_room_url: string | null;
          daily_recording_url: string | null;
          call_duration_seconds: number | null;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          time_slot_id: string;
          appointment_type: string;
          status?: string;
          encrypted_iv?: string | null;
          encrypted_notes?: string | null;
          daily_room_url?: string | null;
          daily_recording_url?: string | null;
          call_duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          time_slot_id?: string;
          appointment_type?: string;
          status?: string;
          encrypted_iv?: string | null;
          encrypted_notes?: string | null;
          daily_room_url?: string | null;
          daily_recording_url?: string | null;
          call_duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
      };
      medical_records: {
        Row: {
          id: string;
          patient_id: string;
          encrypted_iv: string;
          encrypted_data: string;
          record_type: string;
          record_date: string;
          provider_name: string | null;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          encrypted_iv: string;
          encrypted_data: string;
          record_type: string;
          record_date: string;
          provider_name?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          encrypted_iv?: string;
          encrypted_data?: string;
          record_type?: string;
          record_date?: string;
          provider_name?: string | null;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      prescriptions: {
        Row: {
          id: string;
          patient_id: string;
          appointment_id: string | null;
          medication_name: string;
          dosage: string;
          frequency: string;
          duration_days: number;
          schedule: Json;
          instructions: string | null;
          warnings: string | null;
          start_date: string;
          end_date: string;
          is_active: boolean;
          prescribed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          appointment_id?: string | null;
          medication_name: string;
          dosage: string;
          frequency: string;
          duration_days: number;
          schedule: Json;
          instructions?: string | null;
          warnings?: string | null;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          prescribed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          appointment_id?: string | null;
          medication_name?: string;
          dosage?: string;
          frequency?: string;
          duration_days?: number;
          schedule?: Json;
          instructions?: string | null;
          warnings?: string | null;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          prescribed_by?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          event_type: string;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          actor_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          actor_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          // Audit logs are immutable
        };
      };
    };
    Functions: {
      book_appointment: {
        Args: {
          p_time_slot_id: string;
          p_patient_id: string;
          p_appointment_type: string;
        };
        Returns: Json;
      };
    };
  };
}
