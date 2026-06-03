import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { supabaseAdmin } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs";
import { NextRequest } from "next/server";

beforeAll(() => {
  // Polyfill Web Crypto in Node.js for any crypto helper usages
  if (typeof window !== "undefined" && !window.crypto) {
    const { webcrypto } = require("crypto");
    Object.defineProperty(window, "crypto", {
      value: webcrypto,
      writable: true,
    });
  }
  
  // Set up mock env variables for Daily.co
  process.env.DAILY_API_KEY = "mock_daily_api_key";
  process.env.DAILY_DOMAIN = "mock_daily_domain";
});

// Mock Clerk Auth
vi.mock("@clerk/nextjs", () => {
  return {
    auth: vi.fn(() => ({ userId: "patient_user_789" })),
  };
});

// Mock Database Stores
let appointmentsStore: any[] = [];
let sessionsStore: any[] = [];
let auditLogsStore: any[] = [];
let mockAppointmentsError: any = null;

// Mock Supabase Server Admin Client
vi.mock("@/lib/supabase/server", () => {
  const fromMock = vi.fn((table) => {
    if (table === "appointments") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col, val) => {
          if (mockAppointmentsError) {
            return {
              order: vi.fn().mockResolvedValue({ data: null, error: mockAppointmentsError }),
            };
          }
          const filtered = appointmentsStore.filter((item) => item[col] === val);
          return {
            order: vi.fn().mockResolvedValue({ data: filtered, error: null }),
          };
        }),
        update: vi.fn().mockImplementation((updatePayload) => {
          return {
            eq: vi.fn().mockImplementation((col, val) => {
              appointmentsStore = appointmentsStore.map((item) => {
                if (item[col] === val) {
                  return { ...item, ...updatePayload };
                }
                return item;
              });
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }),
      };
    }

    if (table === "telehealth_sessions") {
      return {
        insert: vi.fn().mockImplementation((payload) => {
          sessionsStore.push(payload);
          return Promise.resolve({ data: null, error: null });
        }),
      };
    }

    if (table === "audit_logs") {
      return {
        insert: vi.fn().mockImplementation((payload) => {
          auditLogsStore.push(payload);
          return Promise.resolve({ data: null, error: null });
        }),
      };
    }

    // Default mock response
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  const rpcMock = vi.fn();

  return {
    supabaseAdmin: {
      from: fromMock,
      rpc: rpcMock,
    },
  };
});

describe("Appointments Booking Pipeline Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appointmentsStore = [
      {
        id: "existing_appointment_1",
        patient_id: "patient_user_789",
        time_slot_id: "slot_1",
        appointment_type: "video",
        daily_room_url: "https://mock_daily_domain.daily.co/consult-existing_appointment_1",
        created_at: "2026-06-01T12:00:00Z",
        time_slots: {
          slot_date: "2026-06-05",
          slot_time: "10:00 AM",
          doctor_name: "Dr. Gregory House",
        },
      },
    ];
    sessionsStore = [];
    auditLogsStore = [];
    mockAppointmentsError = null;
    vi.mocked(auth).mockReturnValue({ userId: "patient_user_789" } as any);
    
    // Clear global fetch mock if any
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should fetch patient appointments on GET and record audit log", async () => {
    const req = new NextRequest("http://localhost:3000/api/appointments", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "Mozilla/5.0 TestBrowser",
      },
    });

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.appointments).toBeDefined();
    expect(body.appointments.length).toBe(1);
    expect(body.appointments[0].id).toBe("existing_appointment_1");
    expect(body.appointments[0].time_slots.doctor_name).toBe("Dr. Gregory House");

    // Verify audit logs
    expect(auditLogsStore.length).toBe(1);
    expect(auditLogsStore[0]).toEqual(
      expect.objectContaining({
        event_type: "appointment",
        action: "list",
        actor_id: "patient_user_789",
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0 TestBrowser",
      })
    );
  });

  it("should return 500 on GET if database query fails", async () => {
    mockAppointmentsError = new Error("Database query failed");

    const req = new NextRequest("http://localhost:3000/api/appointments");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to fetch appointments");
  });

  it("should return 401 on GET if unauthorized", async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);
    const req = new NextRequest("http://localhost:3000/api/appointments");
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("should successfully book a video appointment, create Daily.co room, provision tokens, and update DB", async () => {
    // 1. Mock DB RPC return for successful book_appointment
    const newAppointmentId = "new_video_appointment_uuid";
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: {
        success: true,
        appointment_id: newAppointmentId,
      },
      error: null,
    });

    // 2. Mock Daily.co rooms and meeting-tokens API calls
    const mockDailyRoomUrl = `https://mock_daily_domain.daily.co/consult-${newAppointmentId}`;
    const mockRoomName = `consult-${newAppointmentId}`;
    const mockPatientToken = "patient_webrtc_session_token_12345";

    const fetchMock = vi.fn().mockImplementation((url, options) => {
      if (url === "https://api.daily.co/v1/rooms") {
        return Promise.resolve({
          json: () => Promise.resolve({
            name: mockRoomName,
            url: mockDailyRoomUrl,
          }),
        });
      }
      if (url === "https://api.daily.co/v1/meeting-tokens") {
        return Promise.resolve({
          json: () => Promise.resolve({
            token: mockPatientToken,
          }),
        });
      }
      return Promise.reject(new Error("Unknown fetch endpoint: " + url));
    });
    vi.stubGlobal("fetch", fetchMock);

    // Add empty placeholder record to store, so update works
    appointmentsStore.push({
      id: newAppointmentId,
      patient_id: "patient_user_789",
      time_slot_id: "slot_2",
      appointment_type: "video",
      daily_room_url: null,
      created_at: "2026-06-03T18:00:00Z",
    });

    // 3. Trigger POST Booking
    const req = new NextRequest("http://localhost:3000/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        timeSlotId: "slot_2",
        appointmentType: "video",
      }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.appointmentId).toBe(newAppointmentId);
    expect(body.roomUrl).toBe(mockDailyRoomUrl);

    // Verify Daily.co fetch endpoints called
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.daily.co/v1/rooms",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer mock_daily_api_key",
        }),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.daily.co/v1/meeting-tokens",
      expect.objectContaining({
        method: "POST",
      })
    );

    // Verify telehealth_sessions contains correct room metadata & patient token
    expect(sessionsStore.length).toBe(1);
    expect(sessionsStore[0]).toEqual(
      expect.objectContaining({
        appointment_id: newAppointmentId,
        room_name: mockRoomName,
        room_url: mockDailyRoomUrl,
        patient_token: mockPatientToken,
      })
    );

    // Verify appointment was updated with daily_room_url
    const updatedAppt = appointmentsStore.find((a) => a.id === newAppointmentId);
    expect(updatedAppt).toBeDefined();
    expect(updatedAppt.daily_room_url).toBe(mockDailyRoomUrl);
  });

  it("should return 500 on POST if database RPC throws error", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: null,
      error: new Error("Database booking RPC failed"),
    });

    const req = new NextRequest("http://localhost:3000/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        timeSlotId: "slot_failed",
        appointmentType: "video",
      }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to create appointment");
  });

  it("should successfully book a physical appointment without creating WebRTC session", async () => {
    const newAppointmentId = "new_physical_appointment_uuid";
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: {
        success: true,
        appointment_id: newAppointmentId,
      },
      error: null,
    });

    appointmentsStore.push({
      id: newAppointmentId,
      patient_id: "patient_user_789",
      time_slot_id: "slot_3",
      appointment_type: "in-person",
      daily_room_url: null,
      created_at: "2026-06-03T18:00:00Z",
    });

    const req = new NextRequest("http://localhost:3000/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        timeSlotId: "slot_3",
        appointmentType: "in-person",
      }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.appointmentId).toBe(newAppointmentId);
    expect(body.roomUrl).toBeNull();

    // Verify no telehealth session or daily.co rooms created
    expect(sessionsStore.length).toBe(0);
  });

  it("should return 409 conflict when booking fails at database level (double booking)", async () => {
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({
      data: {
        success: false,
        error: "This time slot is already booked",
      },
      error: null,
    });

    const req = new NextRequest("http://localhost:3000/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        timeSlotId: "slot_already_booked",
        appointmentType: "video",
      }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("This time slot is already booked");
  });

  it("should return 400 when missing required fields on POST", async () => {
    const req = new NextRequest("http://localhost:3000/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        timeSlotId: "",
        appointmentType: "video",
      }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing required fields");
  });

  it("should return 401 on POST if unauthorized", async () => {
    vi.mocked(auth).mockReturnValue({ userId: null } as any);
    const req = new NextRequest("http://localhost:3000/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        timeSlotId: "slot_2",
        appointmentType: "video",
      }),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });
});
