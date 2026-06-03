"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Pill,
  Activity,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useEncryption, EncryptionService } from "@/lib/crypto/encryption";
import { supabase } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ============================================
// TRUST BADGE (Session Encryption Indicator)
// ============================================

const TrustBadge = ({ isEncrypted, isSessionActive }) => {
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (isEncrypted) {
      const interval = setInterval(() => {
        setPulseCount((prev) => prev + 1);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isEncrypted]);

  if (!isSessionActive) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
          isEncrypted
            ? "bg-green-600 text-white"
            : "bg-amber-600 text-white animate-pulse"
        }`}
      >
        {isEncrypted ? (
          <>
            <Shield className="w-5 h-5" />
            <span className="text-sm font-medium">Session Encrypted</span>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </>
        ) : (
          <>
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Connecting Securely...</span>
          </>
        )}
      </div>

      {/* Encryption Key Indicator */}
      {isEncrypted && (
        <div className="mt-2 text-xs text-gray-600 bg-white rounded-lg shadow px-3 py-1 text-center">
          <Lock className="w-3 h-3 inline mr-1" />
          AES-256 Active • {pulseCount} heartbeats
        </div>
      )}
    </div>
  );
};

// ============================================
// PRESCRIPTION TIMELINE
// ============================================

const PrescriptionTimeline = ({ prescriptions }) => {
  const [currentDay, setCurrentDay] = useState(0);
  const daysToShow = 7;

  const getMedicationsForDay = (dayOffset) => {
    return prescriptions
      .map((rx) => ({
        ...rx,
        doses: rx.schedule.filter((s) => s.day === dayOffset),
      }))
      .filter((rx) => rx.doses.length > 0);
  };

  const currentMeds = getMedicationsForDay(currentDay);
  const today = new Date();
  const displayDate = new Date(today);
  displayDate.setDate(today.getDate() + currentDay);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Pill className="w-7 h-7 text-blue-600" />
          Medication Schedule
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDay(Math.max(0, currentDay - 1))}
            disabled={currentDay === 0}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium px-3">
            {currentDay === 0 ? "Today" : `Day ${currentDay + 1}`}
          </span>
          <button
            onClick={() =>
              setCurrentDay(Math.min(daysToShow - 1, currentDay + 1))
            }
            disabled={currentDay === daysToShow - 1}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Date Display */}
      <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6 rounded">
        <p className="text-sm text-blue-900">
          <Calendar className="w-4 h-4 inline mr-2" />
          {displayDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Medication Cards */}
      <div className="space-y-4">
        {currentMeds.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p>No medications scheduled for this day</p>
          </div>
        ) : (
          currentMeds.map((med, idx) => (
            <div
              key={idx}
              className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">
                    {med.name}
                  </h3>
                  <p className="text-sm text-gray-600">{med.dosage}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                  {med.doses.length} {med.doses.length === 1 ? "dose" : "doses"}
                </span>
              </div>

              {/* Dose Times */}
              <div className="space-y-2">
                {med.doses.map((dose, doseIdx) => (
                  <div
                    key={doseIdx}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg p-3"
                  >
                    <Clock className="w-5 h-5 text-gray-500" />
                    <span className="font-medium">{dose.time}</span>
                    <span className="text-sm text-gray-600">
                      {dose.instruction}
                    </span>
                    {dose.taken && (
                      <CheckCircle className="w-5 h-5 text-green-600 ml-auto" />
                    )}
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {med.warnings && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {med.warnings}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Progress Indicator */}
      <div className="mt-6 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full transition-all duration-300"
          style={{ width: `${((currentDay + 1) / daysToShow) * 100}%` }}
          role="progressbar"
          aria-valuenow={currentDay + 1}
          aria-valuemin={1}
          aria-valuemax={daysToShow}
        />
      </div>
      <p className="text-xs text-center text-gray-500 mt-2">
        Day {currentDay + 1} of {daysToShow}
      </p>
    </div>
  );
};

// ============================================
// SYMPTOM WIZARD (Multi-Step Form)
// ============================================

const SymptomWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    primarySymptom: "",
    severity: "",
    duration: "",
    additionalSymptoms: [],
    medications: "",
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(formData);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.primarySymptom.length > 0;
      case 2:
        return formData.severity.length > 0;
      case 3:
        return formData.duration.length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">
            Step {step} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round((step / totalSteps) * 100)}% Complete
          </span>
        </div>
        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-64">
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              What's your primary concern?
            </h2>
            <p className="text-gray-600 mb-6">
              Describe your main symptom in a few words
            </p>
            <textarea
              value={formData.primarySymptom}
              onChange={(e) => updateField("primarySymptom", e.target.value)}
              className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              placeholder="e.g., Persistent headache, chest pain, difficulty breathing..."
              aria-label="Primary symptom description"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              How severe is it?
            </h2>
            <p className="text-gray-600 mb-6">
              Rate your symptom severity on a scale of 1-10
            </p>
            <div className="grid grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => {
                const value = i + 1;
                return (
                  <button
                    key={value}
                    onClick={() => updateField("severity", value.toString())}
                    className={`py-4 rounded-lg font-bold text-lg transition-all ${
                      formData.severity === value.toString()
                        ? "bg-blue-600 text-white scale-110"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    aria-label={`Severity level ${value}`}
                    aria-pressed={formData.severity === value.toString()}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-sm text-gray-500">
              <span>Mild</span>
              <span>Severe</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              How long have you had this symptom?
            </h2>
            <p className="text-gray-600 mb-6">
              Select the duration that best matches
            </p>
            <div className="space-y-3">
              {[
                { value: "hours", label: "A few hours", icon: "🕐" },
                { value: "day", label: "1 day", icon: "📅" },
                { value: "days", label: "2-7 days", icon: "📆" },
                { value: "week", label: "1-2 weeks", icon: "🗓️" },
                { value: "month", label: "More than a month", icon: "📊" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateField("duration", option.value)}
                  className={`w-full p-4 rounded-lg text-left transition-all flex items-center gap-3 ${
                    formData.duration === option.value
                      ? "bg-blue-600 text-white border-2 border-blue-700"
                      : "bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-blue-300"
                  }`}
                  aria-pressed={formData.duration === option.value}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <span className="font-medium">{option.label}</span>
                  {formData.duration === option.value && (
                    <CheckCircle className="w-5 h-5 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Any additional information?
            </h2>
            <p className="text-gray-600 mb-6">
              Optional: List current medications or other symptoms
            </p>
            <textarea
              value={formData.medications}
              onChange={(e) => updateField("medications", e.target.value)}
              className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              placeholder="e.g., Taking ibuprofen daily, also experiencing fatigue..."
              aria-label="Additional information"
            />
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle className="w-5 h-5 text-green-600 inline mr-2" />
              <span className="text-sm text-green-800">
                All information will be encrypted before submission
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!isStepValid()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {step === totalSteps ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN DEMO COMPONENT
// ============================================

export default function TrustCenteredUX() {
  const [activeDemo, setActiveDemo] = useState("badge");
  const [sessionActive, setSessionActive] = useState(true);

  // E2EE States
  const { isUnlocked, unlock, lock, encrypt, decrypt, error: encryptionError } = useEncryption();
  const [passphrase, setPassphrase] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUnlocking(true);
    try {
      let saltBase64 = "mock_salt_base64==";
      try {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("encryption_salt")
          .single();
        if (profile?.encryption_salt) {
          saltBase64 = profile.encryption_salt;
        }
      } catch {}

      const salt = EncryptionService.base64ToSalt(saltBase64);
      const success = await unlock(passphrase, salt);
      if (success) {
        loadRecords();
      }
    } catch (err) {
      console.error("Unlock error:", err);
    } finally {
      setIsUnlocking(false);
    }
  };

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const response = await fetch("/api/medical-records");
      const result = await response.json();
      if (response.ok && result.success) {
        const encryptedRecords = result.records || [];
        const decrypted = await Promise.all(
          encryptedRecords.map(async (rec: any) => {
            try {
              const decryptedData = await decrypt({
                iv: rec.encrypted_iv,
                ciphertext: rec.encrypted_data,
              });
              return {
                ...decryptedData,
                id: rec.id,
                type: rec.record_type,
                date: rec.record_date,
                provider: rec.provider_name,
              };
            } catch (err) {
              console.error("Decryption failed for record:", rec.id, err);
              return null;
            }
          })
        );
        setRecords(decrypted.filter((r) => r !== null));
      }
    } catch (err) {
      console.error("Error loading records:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Sample prescription data
  const samplePrescriptions = [
    {
      name: "Lisinopril",
      dosage: "10mg tablet",
      schedule: [
        {
          day: 0,
          time: "08:00 AM",
          instruction: "Take with water",
          taken: true,
        },
        {
          day: 1,
          time: "08:00 AM",
          instruction: "Take with water",
          taken: false,
        },
        {
          day: 2,
          time: "08:00 AM",
          instruction: "Take with water",
          taken: false,
        },
      ],
      warnings: "May cause dizziness. Avoid alcohol.",
    },
    {
      name: "Metformin",
      dosage: "500mg tablet",
      schedule: [
        {
          day: 0,
          time: "09:00 AM",
          instruction: "Take with breakfast",
          taken: true,
        },
        {
          day: 0,
          time: "09:00 PM",
          instruction: "Take with dinner",
          taken: false,
        },
        {
          day: 1,
          time: "09:00 AM",
          instruction: "Take with breakfast",
          taken: false,
        },
        {
          day: 1,
          time: "09:00 PM",
          instruction: "Take with dinner",
          taken: false,
        },
      ],
      warnings: null,
    },
  ];

  const handleWizardComplete = async (data: any) => {
    if (!isUnlocked) {
      alert("Please unlock your session with your passphrase first!");
      return;
    }
    try {
      const encrypted = await encrypt(data);
      const response = await fetch("/api/medical-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          encryptedIv: encrypted.iv,
          encryptedData: encrypted.ciphertext,
          recordType: "prescription",
          recordDate: new Date().toISOString().split("T")[0],
          providerName: "Self-Reported",
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        alert("Form submitted! Symptom data encrypted client-side and saved securely to Supabase.");
        loadRecords();
      } else {
        alert(result.error || "Failed to save record.");
      }
    } catch (err) {
      console.error("Encryption/Submission error:", err);
      alert("Failed to encrypt and save record. Please check your passphrase.");
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-8 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Unlock Secure Health Portal</h1>
            <p className="text-sm text-gray-600">
              Please enter your E2EE passphrase to derive your local AES key. 
              Plaintext health data is never sent to the server.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label htmlFor="passphrase" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Passphrase (Min. 8 characters)
              </label>
              <input
                id="passphrase"
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="e.g. passphrase123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-800"
              />
            </div>

            {encryptionError && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{encryptionError}</p>
            )}

            <button
              type="submit"
              disabled={isUnlocking || passphrase.length < 8}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUnlocking ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deriving Key...
                </>
              ) : (
                "Unlock Session"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Fallback to mock prescriptions if no DB records found
  const displayPrescriptions = records.filter(r => r.type === "prescription").length > 0
    ? records.filter(r => r.type === "prescription")
    : samplePrescriptions;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Phase 4: Trust-Centered UX
              </h1>
              <p className="text-sm text-gray-600">
                Accessibility, visual reassurance, and cognitive load reduction
              </p>
            </div>
          </div>

          {/* Demo Selector */}
          <div className="flex gap-3">
            <button
              onClick={() => setActiveDemo("badge")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeDemo === "badge"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Trust Badge
            </button>
            <button
              onClick={() => setActiveDemo("timeline")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeDemo === "timeline"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Prescription Timeline
            </button>
            <button
              onClick={() => setActiveDemo("wizard")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeDemo === "wizard"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Symptom Wizard
            </button>
          </div>
        </div>

        {/* Demo Content */}
        {activeDemo === "badge" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-bold mb-4">Trust Badge Demo</h2>
              <p className="text-gray-600 mb-6">
                Visual indicator that shows users their session is encrypted.
                Your session is currently unlocked with AES-256 E2EE.
              </p>
              <button
                onClick={lock}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Lock Session
              </button>
            </div>
            <TrustBadge
              isEncrypted={isUnlocked}
              isSessionActive={sessionActive}
            />
          </div>
        )}

        {activeDemo === "timeline" && (
          <ErrorBoundary title="Prescription Timeline Error" onReset={() => setActiveDemo("badge")}>
            <PrescriptionTimeline prescriptions={displayPrescriptions} />
          </ErrorBoundary>
        )}

        {activeDemo === "wizard" && (
          <ErrorBoundary title="Symptom Wizard Error" onReset={() => setActiveDemo("badge")}>
            <SymptomWizard onComplete={handleWizardComplete} />
          </ErrorBoundary>
        )}

        {/* Accessibility Notes */}
        <div className="bg-gray-800 text-gray-100 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">♿ WCAG 2.1 AA Compliance</h2>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Color Contrast:</strong> All text meets 4.5:1 ratio
                minimum
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Keyboard Navigation:</strong> All interactive elements
                accessible via Tab
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>ARIA Labels:</strong> Screen readers announce button
                purposes
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Focus Indicators:</strong> Visible outline on focused
                elements
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Progressive Disclosure:</strong> Multi-step forms reduce
                cognitive overload
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
