// ============================================
// FILE: app/api/appointments/route.ts
// Appointments API - GET (list) & POST (create)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    // Authenticate user via Clerk
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch appointments from Supabase
    const { data: appointments, error } = await supabaseAdmin
      .from("appointments")
      .select(
        `
        *,
        time_slots (
          slot_date,
          slot_time,
          doctor_name
        )
      `,
      )
      .eq("patient_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Log access to audit trail
    await supabaseAdmin.from("audit_logs").insert({
      event_type: "appointment",
      action: "list",
      actor_id: userId,
      ip_address: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      appointments: appointments || [],
    });
  } catch (error) {
    console.error("Get appointments error:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { timeSlotId, appointmentType } = body;

    if (!timeSlotId || !appointmentType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Use atomic RPC function to prevent double-booking
    const { data, error } = await supabaseAdmin.rpc("book_appointment", {
      p_time_slot_id: timeSlotId,
      p_patient_id: userId,
      p_appointment_type: appointmentType,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      appointment_id?: string;
      error?: string;
    };

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Booking failed" },
        { status: 409 },
      );
    }

    // If video appointment, create Daily.co room
    let roomUrl = null;
    if (appointmentType === "video") {
      const roomResponse = await createDailyRoom(
        result.appointment_id!,
        userId,
      );
      roomUrl = roomResponse.roomUrl;

      // Update appointment with room URL
      await supabaseAdmin
        .from("appointments")
        .update({ daily_room_url: roomUrl })
        .eq("id", result.appointment_id);
    }

    return NextResponse.json({
      success: true,
      appointmentId: result.appointment_id,
      roomUrl,
    });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 },
    );
  }
}
