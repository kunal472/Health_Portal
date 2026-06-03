"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Video,
  User,
  Check,
  AlertCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ============================================
// SIMULATED AUTHENTICATION
// ============================================

const mockUser = {
  id: "user_2abc123",
  email: "patient@example.com",
  fullName: "John Doe",
  encryptionSalt: "mock_salt_base64==",
};

// ============================================
// TRUST BADGE COMPONENT
// ============================================

const TrustBadge = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
      <Shield className="w-5 h-5" />
      <span className="text-sm font-medium">Session Encrypted</span>
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
    </div>
  );
};

// ============================================
// BOOKING STEP COMPONENTS
// ============================================

const StepIndicator = ({ currentStep, totalSteps }) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-gray-500">
          {Math.round((currentStep / totalSteps) * 100)}% Complete
        </span>
      </div>
      <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
};

const SelectDateStep = ({ onNext, selectedDate, setSelectedDate }) => {
  const dates = [
    { value: "2026-02-05", label: "Wednesday, Feb 5" },
    { value: "2026-02-06", label: "Thursday, Feb 6" },
    { value: "2026-02-07", label: "Friday, Feb 7" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Select a Date</h2>
        <p className="text-gray-600">Choose your preferred appointment date</p>
      </div>

      <div className="grid gap-3">
        {dates.map((date) => (
          <button
            key={date.value}
            onClick={() => setSelectedDate(date.value)}
            className={`p-4 rounded-lg text-left transition-all flex items-center gap-3 ${
              selectedDate === date.value
                ? "bg-blue-600 text-white border-2 border-blue-700"
                : "bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-blue-300"
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">{date.label}</span>
            {selectedDate === date.value && (
              <Check className="w-5 h-5 ml-auto" />
            )}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        disabled={!selectedDate}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        Continue
      </button>
    </div>
  );
};

const SelectTimeSlotStep = ({
  onNext,
  selectedDate,
  selectedSlot,
  setSelectedSlot,
}) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSlots();
  }, [selectedDate]);

  const loadSlots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("time_slots")
        .select("*")
        .eq("is_booked", false)
        .eq("slot_date", selectedDate);

      if (error) throw error;

      const mappedSlots = (data || []).map((slot) => ({
        id: slot.id,
        doctorId: slot.doctor_id,
        doctorName: slot.doctor_name,
        specialty: slot.slot_type || "General Consultation",
        date: slot.slot_date,
        time: slot.slot_time.substring(0, 5),
        isBooked: slot.is_booked,
      }));
      setSlots(mappedSlots);
    } catch (err) {
      console.error("Error loading slots:", err);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Select Time & Doctor
        </h2>
        <p className="text-gray-600">Choose an available time slot</p>
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => setSelectedSlot(slot)}
            className={`p-4 rounded-lg text-left transition-all ${
              selectedSlot?.id === slot.id
                ? "bg-blue-600 text-white border-2 border-blue-700"
                : "bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-blue-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span className="font-bold">{slot.time}</span>
              </div>
              {selectedSlot?.id === slot.id && <Check className="w-5 h-5" />}
            </div>
            <div className="flex items-center gap-2 text-sm opacity-90">
              <User className="w-4 h-4" />
              <span>
                {slot.doctorName} • {slot.specialty}
              </span>
            </div>
          </button>
        ))}
      </div>

      {slots.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-amber-500" />
          <p>No available slots for this date</p>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={!selectedSlot}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        Continue
      </button>
    </div>
  );
};

const SelectTypeStep = ({ onNext, appointmentType, setAppointmentType }) => {
  const types = [
    {
      value: "video",
      label: "Video Consultation",
      icon: Video,
      description: "Meet with your doctor online",
    },
    {
      value: "in-person",
      label: "In-Person Visit",
      icon: User,
      description: "Visit the clinic in person",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Appointment Type
        </h2>
        <p className="text-gray-600">How would you like to meet?</p>
      </div>

      <div className="grid gap-3">
        {types.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.value}
              onClick={() => setAppointmentType(type.value)}
              className={`p-6 rounded-lg text-left transition-all ${
                appointmentType === type.value
                  ? "bg-blue-600 text-white border-2 border-blue-700"
                  : "bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-blue-300"
              }`}
            >
              <div className="flex items-start gap-4">
                <Icon className="w-8 h-8" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{type.label}</h3>
                  <p
                    className={`text-sm ${
                      appointmentType === type.value
                        ? "opacity-90"
                        : "text-gray-600"
                    }`}
                  >
                    {type.description}
                  </p>
                </div>
                {appointmentType === type.value && (
                  <Check className="w-6 h-6" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onNext}
        disabled={!appointmentType}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        Continue
      </button>
    </div>
  );
};

const ConfirmationStep = ({
  selectedDate,
  selectedSlot,
  appointmentType,
  onConfirm,
  loading,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Confirm Your Appointment
        </h2>
        <p className="text-gray-600">Please review your appointment details</p>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Date</p>
            <p className="font-medium">
              {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Time</p>
            <p className="font-medium">{selectedSlot.time}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Doctor</p>
            <p className="font-medium">{selectedSlot.doctorName}</p>
            <p className="text-sm text-gray-500">{selectedSlot.specialty}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-blue-600" />
          <div>
            <p className="text-sm text-gray-600">Type</p>
            <p className="font-medium capitalize">
              {appointmentType.replace("-", " ")}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-1">Your data is protected</p>
            <p>
              All appointment details will be encrypted end-to-end before
              storage.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onConfirm}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Booking...
          </>
        ) : (
          "Confirm Appointment"
        )}
      </button>
    </div>
  );
};

// ============================================
// MAIN BOOKING COMPONENT
// ============================================

export default function AppointmentBooking() {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [appointmentType, setAppointmentType] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [appointmentResult, setAppointmentResult] = useState(null);

  const totalSteps = 4;

  const handleConfirm = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeSlotId: selectedSlot.id,
          appointmentType: appointmentType,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setAppointmentResult({
          appointmentId: result.appointmentId,
          roomUrl: result.roomUrl,
        });
        setShowSuccess(true);
      } else {
        alert(result.error || "Booking failed. Please try again.");
      }
    } catch (error) {
      console.error("Booking error:", error);
      alert("Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetBooking = () => {
    setStep(1);
    setSelectedDate("");
    setSelectedSlot(null);
    setAppointmentType("");
    setShowSuccess(false);
    setAppointmentResult(null);
  };

  if (showSuccess && appointmentResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 p-8 flex items-center justify-center">
        <TrustBadge isVisible={true} />
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Appointment Confirmed!
            </h2>
            <p className="text-gray-600">
              Your appointment has been successfully booked
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Appointment ID:</span>
              <span className="font-mono font-medium">
                {appointmentResult.appointmentId}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">
                {new Date(selectedDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{selectedSlot.time}</span>
            </div>
            {appointmentType === "video" && (
              <div className="pt-2 border-t">
                <p className="text-xs text-gray-600 mb-1">Video Room:</p>
                <p className="text-xs font-mono bg-white p-2 rounded break-all">
                  {appointmentResult.roomUrl}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              onClick={resetBooking}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Book Another Appointment
            </button>
            <button
              onClick={() => alert("Navigate to appointments page")}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              View My Appointments
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-8">
      <TrustBadge isVisible={step > 1} />

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Book an Appointment
            </h1>
            <p className="text-gray-600">
              Schedule a consultation with our healthcare professionals
            </p>
          </div>

          <StepIndicator currentStep={step} totalSteps={totalSteps} />

          <ErrorBoundary title="Booking Wizard Error" onReset={() => setStep(1)}>
            {step === 1 && (
              <SelectDateStep
                onNext={() => setStep(2)}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            )}

            {step === 2 && (
              <SelectTimeSlotStep
                onNext={() => setStep(3)}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                setSelectedSlot={setSelectedSlot}
              />
            )}

            {step === 3 && (
              <SelectTypeStep
                onNext={() => setStep(4)}
                appointmentType={appointmentType}
                setAppointmentType={setAppointmentType}
              />
            )}

            {step === 4 && (
              <ConfirmationStep
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                appointmentType={appointmentType}
                onConfirm={handleConfirm}
                loading={loading}
              />
            )}
          </ErrorBoundary>

          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="mt-4 text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
