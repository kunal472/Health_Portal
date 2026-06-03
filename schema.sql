-- ============================================
-- SMART-CLINIC DATABASE SCHEMA
-- Run in Supabase SQL Editor
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USER PROFILES (Extends Clerk users)
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  date_of_birth DATE,
  
  -- E2EE Key Management
  encryption_salt TEXT NOT NULL,  -- Base64 salt for PBKDF2
  salt_version INT DEFAULT 1,     -- For key rotation
  
  -- Preferences
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}'::jsonb,
  timezone TEXT DEFAULT 'UTC',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_user_profiles_clerk_id ON user_profiles(clerk_user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================
-- TIME SLOTS (For Atomic Scheduling)
-- ============================================
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  duration_minutes INT DEFAULT 30,
  
  -- Booking Status
  is_booked BOOLEAN DEFAULT FALSE,
  booked_by TEXT REFERENCES user_profiles(clerk_user_id),
  booked_at TIMESTAMPTZ,
  confirmed BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  slot_type TEXT DEFAULT 'consultation', -- consultation, follow-up, urgent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_time_slots_date ON time_slots(slot_date, slot_time);
CREATE INDEX idx_time_slots_doctor ON time_slots(doctor_id, slot_date);
CREATE INDEX idx_time_slots_available ON time_slots(slot_date, is_booked) WHERE is_booked = FALSE;

-- RLS
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available slots"
  ON time_slots FOR SELECT
  USING (is_booked = FALSE OR booked_by = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL REFERENCES user_profiles(clerk_user_id),
  time_slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  
  -- Appointment Details
  appointment_type TEXT NOT NULL, -- video, in-person
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, no-show
  
  -- Encrypted Notes (E2EE)
  encrypted_iv TEXT,
  encrypted_notes TEXT, -- JSON ciphertext: {symptoms, diagnosis, prescription}
  
  -- Video Call
  daily_room_url TEXT,
  daily_recording_url TEXT,
  call_duration_seconds INT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- Indexes
CREATE INDEX idx_appointments_patient ON appointments(patient_id, created_at DESC);
CREATE INDEX idx_appointments_status ON appointments(status);

-- RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appointments"
  ON appointments FOR SELECT
  USING (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create own appointments"
  ON appointments FOR INSERT
  WITH CHECK (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update own appointments"
  ON appointments FOR UPDATE
  USING (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================
-- MEDICAL RECORDS (E2EE)
-- ============================================
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL REFERENCES user_profiles(clerk_user_id),
  
  -- Encrypted Content
  encrypted_iv TEXT NOT NULL,
  encrypted_data TEXT NOT NULL, -- Ciphertext of medical data
  
  -- Unencrypted Metadata (for filtering/searching)
  record_type TEXT NOT NULL, -- lab_result, prescription, diagnosis, note
  record_date DATE NOT NULL,
  provider_name TEXT,
  
  -- Access Control
  revoked_at TIMESTAMPTZ, -- For emergency kill-switch
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_medical_records_patient ON medical_records(patient_id, record_date DESC);
CREATE INDEX idx_medical_records_type ON medical_records(record_type);
CREATE INDEX idx_medical_records_active ON medical_records(patient_id) WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own non-revoked records"
  ON medical_records FOR SELECT
  USING (
    patient_id = current_setting('request.jwt.claims', true)::json->>'sub'
    AND revoked_at IS NULL
  );

CREATE POLICY "Users can create own records"
  ON medical_records FOR INSERT
  WITH CHECK (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can revoke own records"
  ON medical_records FOR UPDATE
  USING (patient_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================
-- PRESCRIPTIONS (Timeline Feature)
-- ============================================
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id TEXT NOT NULL REFERENCES user_profiles(clerk_user_id),
  appointment_id UUID REFERENCES appointments(id),
  
  -- Medication Details
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL, -- e.g., "twice daily", "every 8 hours"
  duration_days INT NOT NULL,
  
  -- Schedule (JSON array of dose times)
  schedule JSONB NOT NULL, -- [{day: 0, time: "09:00", instruction: "with food"}]
  
  -- Instructions
  instructions TEXT,
  warnings TEXT,
  
  -- Status
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  prescribed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id, start_date DESC);
CREATE INDEX idx_prescriptions_active ON prescriptions(patient_id, is_active) WHERE is_active = TRUE;

-- RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prescriptions"
  ON prescriptions FOR SELECT
  USING (patient_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- ============================================
-- TELEHEALTH SESSIONS
-- ============================================
CREATE TABLE telehealth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  
  -- Daily.co Details
  room_name TEXT NOT NULL UNIQUE,
  room_url TEXT NOT NULL,
  doctor_token TEXT NOT NULL,
  patient_token TEXT NOT NULL,
  
  -- Session Status
  status TEXT DEFAULT 'created', -- created, active, ended
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- Recording
  recording_id TEXT,
  encrypted_recording_url TEXT, -- S3/Supabase Storage URL
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX idx_telehealth_appointment ON telehealth_sessions(appointment_id);
CREATE INDEX idx_telehealth_room ON telehealth_sessions(room_name);

-- RLS
ALTER TABLE telehealth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON telehealth_sessions FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments 
      WHERE patient_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- ============================================
-- AUDIT LOGS (HIPAA Compliance)
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event Details
  event_type TEXT NOT NULL, -- auth, appointment, record_access, telehealth
  action TEXT NOT NULL, -- login, view, create, update, delete, export
  
  -- Resource
  resource_type TEXT, -- appointment, medical_record, prescription
  resource_id UUID,
  
  -- Actor
  actor_id TEXT, -- Clerk user ID
  ip_address INET,
  user_agent TEXT,
  
  -- Context
  metadata JSONB, -- Additional event-specific data
  
  -- Timestamp (immutable)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event_type, created_at DESC);

-- Make audit logs append-only (no updates/deletes)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs are append-only"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (actor_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Prevent updates and deletes
CREATE POLICY "No updates allowed"
  ON audit_logs FOR UPDATE
  USING (false);

CREATE POLICY "No deletes allowed"
  ON audit_logs FOR DELETE
  USING (false);

-- ============================================
-- STORED PROCEDURES (RPCs)
-- ============================================

-- Atomic Appointment Booking
CREATE OR REPLACE FUNCTION book_appointment(
  p_time_slot_id UUID,
  p_patient_id TEXT,
  p_appointment_type TEXT
) RETURNS JSON AS $$
DECLARE
  v_slot RECORD;
  v_appointment_id UUID;
BEGIN
  -- Lock the time slot row (prevents race conditions)
  SELECT * INTO v_slot
  FROM time_slots
  WHERE id = p_time_slot_id
  FOR UPDATE;

  -- Check if slot is available
  IF v_slot.is_booked = TRUE THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Slot already booked'
    );
  END IF;

  -- Mark slot as booked
  UPDATE time_slots
  SET 
    is_booked = TRUE,
    booked_by = p_patient_id,
    booked_at = NOW()
  WHERE id = p_time_slot_id;

  -- Create appointment
  INSERT INTO appointments (
    patient_id,
    time_slot_id,
    appointment_type,
    status
  ) VALUES (
    p_patient_id,
    p_time_slot_id,
    p_appointment_type,
    'scheduled'
  )
  RETURNING id INTO v_appointment_id;

  -- Log to audit trail
  INSERT INTO audit_logs (
    event_type,
    action,
    resource_type,
    resource_id,
    actor_id,
    metadata
  ) VALUES (
    'appointment',
    'create',
    'appointment',
    v_appointment_id,
    p_patient_id,
    json_build_object(
      'time_slot_id', p_time_slot_id,
      'appointment_type', p_appointment_type
    )
  );

  RETURN json_build_object(
    'success', true,
    'appointment_id', v_appointment_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();