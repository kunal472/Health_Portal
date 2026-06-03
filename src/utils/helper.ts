
// ============================================
// HELPER FUNCTIONS
// ============================================

async function createDailyRoom(appointmentId: string, patientId: string) {
  const DAILY_API_KEY = process.env.DAILY_API_KEY!;
  const DAILY_DOMAIN = process.env.DAILY_DOMAIN!;

  const response = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: `consult-${appointmentId}`,
      privacy: "private",
      properties: {
        enable_screenshare: true,
        enable_chat: false,
        enable_knocking: true,
        enable_recording: "cloud",
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        max_participants: 2,
      },
    }),
  });

  const room = await response.json();

  // Generate patient token
  const tokenResponse = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: room.name,
        user_name: patientId,
        is_owner: false,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  });

  const { token } = await tokenResponse.json();

  // Save session to database
  await supabaseAdmin.from("telehealth_sessions").insert({
    appointment_id: appointmentId,
    room_name: room.name,
    room_url: room.url,
    patient_token: token,
    doctor_token: "", // Generated separately for doctor
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });

  return { roomUrl: room.url, token };
}
