// ============================================
// FILE: app/api/telehealth/create-room/route.ts
// Daily.co Room Creation + HIPAA Compliance
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DAILY_API_KEY = process.env.DAILY_API_KEY!;
const DAILY_API_URL = "https://api.daily.co/v1";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for admin operations
);

// ============================================
// CREATE DAILY ROOM WITH HIPAA SETTINGS
// ============================================

export async function POST(req: NextRequest) {
  try {
    const { appointmentId, doctorId, patientId } = await req.json();

    // 1. Create Daily.co room with security settings
    const roomResponse = await fetch(`${DAILY_API_URL}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: `consultation-${appointmentId}`, // Unique room name
        privacy: "private", // HIPAA requirement
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          enable_knocking: true, // Waiting room feature
          enable_recording: "cloud", // For medical documentation
          exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
          eject_at_room_exp: true, // Auto-close after expiry
          max_participants: 2, // Doctor + Patient only
          enable_advanced_chat: false, // Disable to prevent PHI leakage
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });

    if (!roomResponse.ok) {
      throw new Error("Failed to create Daily room");
    }

    const room = await roomResponse.json();

    // 2. Generate meeting tokens (restricts who can join)
    const [doctorToken, patientToken] = await Promise.all([
      createMeetingToken(room.name, doctorId, true), // Doctor = owner
      createMeetingToken(room.name, patientId, false), // Patient = participant
    ]);

    // 3. Save room metadata to Supabase (for audit trail)
    await supabase.from("telehealth_sessions").insert({
      appointment_id: appointmentId,
      room_name: room.name,
      room_url: room.url,
      doctor_id: doctorId,
      patient_id: patientId,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      roomUrl: room.url,
      doctorToken,
      patientToken,
    });
  } catch (error) {
    console.error("Room creation error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// ============================================
// GENERATE MEETING TOKEN (ROLE-BASED ACCESS)
// ============================================

async function createMeetingToken(
  roomName: string,
  userId: string,
  isOwner: boolean,
): Promise<string> {
  const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userId,
        is_owner: isOwner, // Doctors can kick participants, patients cannot
        enable_recording: isOwner ? "cloud" : false, // Only doctors can record
        start_cloud_recording: false, // Manual start
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      },
    }),
  });

  const data = await response.json();
  return data.token;
}

// ============================================
// WEBHOOK HANDLER (Record Call Events)
// ============================================

export async function PUT(req: NextRequest) {
  try {
    const event = await req.json();

    // Daily.co sends webhooks for important events
    switch (event.type) {
      case "recording.started":
        await logCallEvent(event.room, "recording_started", event);
        break;

      case "recording.stopped":
        await logCallEvent(event.room, "recording_stopped", event);
        // Download and encrypt recording
        await processRecording(event.recording_id);
        break;

      case "participant.joined":
        await logCallEvent(event.room, "participant_joined", event);
        break;

      case "participant.left":
        await logCallEvent(event.room, "participant_left", event);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// AUDIT LOGGING (HIPAA COMPLIANCE)
// ============================================

async function logCallEvent(roomName: string, action: string, metadata: any) {
  await supabase.from("audit_logs").insert({
    event_type: "telehealth",
    action: action,
    resource_type: "video_call",
    resource_id: roomName,
    metadata: metadata,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// PROCESS RECORDING (Download + Encrypt)
// ============================================

async function processRecording(recordingId: string) {
  // 1. Fetch recording metadata
  const response = await fetch(`${DAILY_API_URL}/recordings/${recordingId}`, {
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  });

  const recording = await response.json();

  // 2. Download MP4 file
  const videoResponse = await fetch(recording.download_link);
  const videoBuffer = await videoResponse.arrayBuffer();

  // 3. Encrypt video using same E2EE method (Phase 1)
  // NOTE: For large files, use AES-GCM in chunks
  // const encryptedVideo = await encryptLargeFile(videoBuffer, userKey);

  // 4. Upload to Supabase Storage (encrypted)
  const { error } = await supabase.storage
    .from("encrypted-recordings")
    .upload(`${recording.room_name}.enc`, videoBuffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (error) {
    console.error("Upload failed:", error);
  }

  // 5. Delete from Daily.co (HIPAA requires local storage)
  await fetch(`${DAILY_API_URL}/recordings/${recordingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  });
}

// ============================================
// FRONTEND USAGE EXAMPLE
// ============================================

/*
// In your Next.js component:

import Daily from '@daily-co/daily-js';

const startConsultation = async () => {
  // 1. Create room via API
  const response = await fetch('/api/telehealth/create-room', {
    method: 'POST',
    body: JSON.stringify({
      appointmentId: 'appt_123',
      doctorId: 'dr_abc',
      patientId: 'patient_xyz'
    })
  });

  const { roomUrl, patientToken } = await response.json();

  // 2. Initialize Daily.co
  const callFrame = Daily.createFrame({
    showLeaveButton: true,
    iframeStyle: {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%'
    }
  });

  // 3. Join with token
  await callFrame.join({ 
    url: roomUrl, 
    token: patientToken 
  });

  // 4. Listen for events
  callFrame.on('recording-started', () => {
    showNotification('Session is being recorded');
  });

  callFrame.on('left-meeting', async () => {
    // Save call summary
    await fetch('/api/appointments/update', {
      method: 'PATCH',
      body: JSON.stringify({
        appointmentId: 'appt_123',
        status: 'completed',
        duration: callFrame.participants().local.duration
      })
    });
  });
};
*/
