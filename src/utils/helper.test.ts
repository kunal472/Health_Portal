import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDailyRoom } from "./helper";
import { supabaseAdmin } from "@/lib/supabase/server";

// Mock the Supabase Admin Client
vi.mock("@/lib/supabase/server", () => {
  const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

  return {
    supabaseAdmin: {
      from: fromMock,
    },
  };
});

describe("createDailyRoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DAILY_API_KEY = "test_daily_key";
    process.env.DAILY_DOMAIN = "test_domain";
  });

  it("should create a room, retrieve a token, and insert session metadata in Supabase", async () => {
    const mockRoomName = "consult-appt_12345";
    const mockRoomUrl = "https://api.daily.co/v1/rooms/consult-appt_12345";
    const mockToken = "meeting_token_abc123";

    // Mock global fetch calls sequentially
    const globalFetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ name: mockRoomName, url: mockRoomUrl }),
      } as any)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ token: mockToken }),
      } as any);

    globalThis.fetch = globalFetchMock;

    const result = await createDailyRoom("appt_12345", "user_patient");

    // Assert fetch calls
    expect(globalFetchMock).toHaveBeenCalledTimes(2);
    expect(globalFetchMock.mock.calls[0][0]).toBe("https://api.daily.co/v1/rooms");
    expect(globalFetchMock.mock.calls[1][0]).toBe("https://api.daily.co/v1/meeting-tokens");

    // Assert supabaseAdmin integration
    expect(supabaseAdmin.from).toHaveBeenCalledWith("telehealth_sessions");
    const insertFn = supabaseAdmin.from("telehealth_sessions").insert;
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        appointment_id: "appt_12345",
        room_name: mockRoomName,
        room_url: mockRoomUrl,
        patient_token: mockToken,
        doctor_token: "",
      })
    );

    // Assert final return payload
    expect(result).toEqual({
      roomUrl: mockRoomUrl,
      token: mockToken,
    });
  });
});
