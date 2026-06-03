
// ============================================
// FILE: app/api/medical-records/route.ts
// Medical Records API with E2EE
// ============================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch encrypted records
    const { data: records, error } = await supabaseAdmin
      .from("medical_records")
      .select("*")
      .eq("patient_id", userId)
      .is("revoked_at", null) // Exclude revoked records
      .order("record_date", { ascending: false });

    if (error) throw error;

    // Log access
    await supabaseAdmin.from("audit_logs").insert({
      event_type: "record_access",
      action: "list",
      actor_id: userId,
      metadata: { record_count: records?.length || 0 },
    });

    return NextResponse.json({
      success: true,
      records: records || [], // Client will decrypt these
    });
  } catch (error) {
    console.error("Get records error:", error);
    return NextResponse.json(
      { error: "Failed to fetch records" },
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
    const { encryptedIv, encryptedData, recordType, recordDate, providerName } =
      body;

    if (!encryptedIv || !encryptedData || !recordType || !recordDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Insert encrypted record
    const { data, error } = await supabaseAdmin
      .from("medical_records")
      .insert({
        patient_id: userId,
        encrypted_iv: encryptedIv,
        encrypted_data: encryptedData,
        record_type: recordType,
        record_date: recordDate,
        provider_name: providerName,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      event_type: "record_access",
      action: "create",
      resource_type: "medical_record",
      resource_id: data.id,
      actor_id: userId,
    });

    return NextResponse.json({
      success: true,
      recordId: data.id,
    });
  } catch (error) {
    console.error("Create record error:", error);
    return NextResponse.json(
      { error: "Failed to create record" },
      { status: 500 },
    );
  }
}

// Emergency revoke endpoint (kill-switch)
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const recordId = searchParams.get("id");

    if (recordId) {
      // Revoke specific record
      await supabaseAdmin
        .from("medical_records")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", recordId)
        .eq("patient_id", userId);
    } else {
      // Revoke all records (emergency kill-switch)
      await supabaseAdmin
        .from("medical_records")
        .update({ revoked_at: new Date().toISOString() })
        .eq("patient_id", userId)
        .is("revoked_at", null);
    }

    await supabaseAdmin.from("audit_logs").insert({
      event_type: "record_access",
      action: "revoke",
      resource_id: recordId,
      actor_id: userId,
      metadata: { emergency: !recordId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke record error:", error);
    return NextResponse.json(
      { error: "Failed to revoke record" },
      { status: 500 },
    );
  }
}
