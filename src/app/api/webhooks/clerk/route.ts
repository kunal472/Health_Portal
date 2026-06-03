// ============================================
// FILE: app/api/webhooks/clerk/route.ts
// Sync Clerk users to Supabase
// ============================================

import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EncryptionService } from "@/lib/crypto/encryption";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

  const headerPayload = headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Handle user.created event
  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    // Generate encryption salt for new user
    const salt = EncryptionService.generateSalt();
    const saltBase64 = EncryptionService.saltToBase64(salt);

    await supabaseAdmin.from("user_profiles").insert({
      clerk_user_id: id,
      email: email_addresses[0]?.email_address || "",
      full_name: `${first_name || ""} ${last_name || ""}`.trim(),
      encryption_salt: saltBase64,
      salt_version: 1,
    });

    console.log(`Created user profile for ${id}`);
  }

  // Handle user.updated event
  if (evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    await supabaseAdmin
      .from("user_profiles")
      .update({
        email: email_addresses[0]?.email_address || "",
        full_name: `${first_name || ""} ${last_name || ""}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", id);
  }

  return new Response("Webhook processed", { status: 200 });
}
