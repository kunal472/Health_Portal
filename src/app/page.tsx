'use client'
import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
} from "lucide-react";

// ============================================
// SCHEDULING ENGINE (Simulated)
// ============================================

class SchedulingEngine {
  constructor() {
    // Simulated database (in production, this is PostgreSQL)
    this.slots = [
      {
        id: "slot_1",
        time: "09:00 AM",
        doctor: "Dr. Smith",
        booked: false,
        lockedBy: null,
      },
      {
        id: "slot_2",
        time: "10:00 AM",
        doctor: "Dr. Smith",
        booked: false,
        lockedBy: null,
      },
      {
        id: "slot_3",
        time: "11:00 AM",
        doctor: "Dr. Smith",
        booked: false,
        lockedBy: null,
      },
      {
        id: "slot_4",
        time: "02:00 PM",
        doctor: "Dr. Jones",
        booked: false,
        lockedBy: null,
      },
    ];
    this.bookingLog = [];
  }

  // Simulate network delay
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * ATOMIC BOOKING (simulates PostgreSQL FOR UPDATE)
   * This is what happens in the Postgres RPC function
   */
  async bookSlot(slotId, patientName, transactionId) {
    // Log attempt
    this.bookingLog.push({
      time: new Date().toISOString(),
      transaction: transactionId,
      patient: patientName,
      action: "ATTEMPT",
      slotId,
    });

    // Simulate database latency
    await this.delay(Math.random() * 500);

    // CRITICAL SECTION: Row-level lock simulation
    const slot = this.slots.find((s) => s.id === slotId);

    if (!slot) {
      this.bookingLog.push({
        time: new Date().toISOString(),
        transaction: transactionId,
        patient: patientName,
        action: "ERROR",
        reason: "Slot not found",
      });
      return { success: false, error: "Slot not found" };
    }

    // CHECK: Is slot already booked or locked by another transaction?
    if (slot.booked || (slot.lockedBy && slot.lockedBy !== transactionId)) {
      this.bookingLog.push({
        time: new Date().toISOString(),
        transaction: transactionId,
        patient: patientName,
        action: "CONFLICT",
        reason: "Slot already booked",
      });
      return { success: false, error: "Slot already booked" };
    }

    // LOCK: Acquire row lock (FOR UPDATE)
    slot.lockedBy = transactionId;
    this.bookingLog.push({
      time: new Date().toISOString(),
      transaction: transactionId,
      patient: patientName,
      action: "LOCKED",
    });

    // Simulate processing time
    await this.delay(200);

    // COMMIT: Mark as booked
    slot.booked = true;
    slot.bookedBy = patientName;
    slot.lockedBy = null;

    this.bookingLog.push({
      time: new Date().toISOString(),
      transaction: transactionId,
      patient: patientName,
      action: "SUCCESS",
    });

    return { success: true, slot };
  }

  getAvailableSlots() {
    return this.slots.filter((s) => !s.booked);
  }

  getBookingLog() {
    return [...this.bookingLog];
  }

  reset() {
    this.slots.forEach((slot) => {
      slot.booked = false;
      slot.bookedBy = null;
      slot.lockedBy = null;
    });
    this.bookingLog = [];
  }
}

// ============================================
// INTERACTIVE DEMO
// ============================================

export default function SchedulingDemo() {
  const [engine] = useState(() => new SchedulingEngine());
  const [slots, setSlots] = useState(engine.getAvailableSlots());
  const [log, setLog] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  const refreshState = () => {
    setSlots(engine.getAvailableSlots());
    setLog(engine.getBookingLog());
  };

  // Simulate concurrent booking attempts (RACE CONDITION TEST)
  const simulateConcurrentBooking = async () => {
    setIsSimulating(true);

    const slotId = "slot_2"; // Both users want 10:00 AM
    const patient1 = "Alice Johnson";
    const patient2 = "Bob Williams";

    // CONCURRENT REQUESTS (simulates two browser windows)
    const [result1, result2] = await Promise.all([
      engine.bookSlot(slotId, patient1, "txn_001"),
      engine.bookSlot(slotId, patient2, "txn_002"),
    ]);

    refreshState();
    setIsSimulating(false);

    // Show results
    alert(
      `Booking Results:\n\n` +
        `${patient1}: ${result1.success ? "✅ SUCCESS" : "❌ CONFLICT"}\n` +
        `${patient2}: ${result2.success ? "✅ SUCCESS" : "❌ CONFLICT"}\n\n` +
        `Only ONE booking should succeed!`,
    );
  };

  const manualBook = async (slotId) => {
    setIsSimulating(true);
    await engine.bookSlot(slotId, "Manual User", `txn_${Date.now()}`);
    refreshState();
    setIsSimulating(false);
  };

  const handleReset = () => {
    engine.reset();
    refreshState();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Phase 2: Atomic Scheduling Engine
            </h1>
          </div>

          <div className="bg-purple-50 border-l-4 border-purple-600 p-4 mb-6">
            <p className="text-sm text-purple-900">
              <strong>How it works:</strong> When two users click "Book"
              simultaneously, PostgreSQL's{" "}
              <code className="bg-purple-100 px-1 rounded">FOR UPDATE</code>{" "}
              lock ensures only ONE transaction succeeds. The other receives a
              "Conflict" error.
            </p>
          </div>

          {/* Control Panel */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={simulateConcurrentBooking}
              disabled={isSimulating || slots.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Users className="w-5 h-5" />
              Simulate Concurrent Booking
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Reset Demo
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Available Slots */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-green-600" />
              Available Slots
            </h2>

            {slots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-amber-500" />
                <p>All slots booked! Click Reset to try again.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">
                          {slot.time}
                        </p>
                        <p className="text-sm text-gray-600">{slot.doctor}</p>
                      </div>
                      <button
                        onClick={() => manualBook(slot.id)}
                        disabled={isSimulating}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transaction Log */}
          <div className="bg-gray-900 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📋 Transaction Log
            </h2>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {log.length === 0 ? (
                <p className="text-gray-400 text-sm italic">
                  No transactions yet
                </p>
              ) : (
                log.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg text-sm font-mono ${
                      entry.action === "SUCCESS"
                        ? "bg-green-900 text-green-100"
                        : entry.action === "CONFLICT"
                          ? "bg-red-900 text-red-100"
                          : entry.action === "LOCKED"
                            ? "bg-yellow-900 text-yellow-100"
                            : "bg-gray-800 text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {entry.action === "SUCCESS" && (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {entry.action === "CONFLICT" && (
                        <XCircle className="w-4 h-4" />
                      )}
                      {entry.action === "LOCKED" && (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      <span className="font-bold">{entry.action}</span>
                    </div>
                    <p className="text-xs">Patient: {entry.patient}</p>
                    <p className="text-xs">Transaction: {entry.transaction}</p>
                    {entry.reason && (
                      <p className="text-xs mt-1 italic">
                        Reason: {entry.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Implementation Details */}
        <div className="bg-gray-800 text-gray-100 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">
            🔬 PostgreSQL Implementation
          </h2>
          <pre className="text-xs bg-gray-900 p-4 rounded overflow-x-auto">
            {`-- Postgres RPC Function (book_appointment)
CREATE OR REPLACE FUNCTION book_appointment(
  slot_id UUID,
  patient_id TEXT
) RETURNS JSON AS $$
DECLARE
  slot RECORD;
BEGIN
  -- ATOMIC: Lock the row for this transaction
  SELECT * INTO slot
  FROM time_slots
  WHERE id = slot_id
  FOR UPDATE; -- ⚡ CRITICAL: Prevents race conditions

  -- Check availability
  IF slot.booked = true THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Slot already booked'
    );
  END IF;

  -- Update slot
  UPDATE time_slots
  SET booked = true,
      booked_by = patient_id,
      booked_at = NOW()
  WHERE id = slot_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;`}
          </pre>
        </div>
      </div>
    </div>
  );
}
