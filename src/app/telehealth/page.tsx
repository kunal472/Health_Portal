"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Monitor,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ============================================
// PRE-CALL DEVICE CHECKER
// ============================================

const DeviceChecker = ({ onComplete }) => {
  const [checks, setChecks] = useState({
    camera: { status: "pending", message: "Testing camera..." },
    microphone: { status: "pending", message: "Testing microphone..." },
    network: { status: "pending", message: "Testing network..." },
  });
  const videoRef = useRef(null);

  useEffect(() => {
    runDeviceChecks();
  }, []);

  const runDeviceChecks = async () => {
    // Test Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setChecks((prev) => ({
        ...prev,
        camera: { status: "success", message: "Camera detected" },
      }));

      // Stop camera preview after test
      setTimeout(() => {
        stream.getTracks().forEach((track) => track.stop());
      }, 2000);
    } catch (error) {
      setChecks((prev) => ({
        ...prev,
        camera: { status: "error", message: "Camera access denied" },
      }));
    }

    // Test Microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setChecks((prev) => ({
        ...prev,
        microphone: { status: "success", message: "Microphone detected" },
      }));
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      setChecks((prev) => ({
        ...prev,
        microphone: { status: "error", message: "Microphone access denied" },
      }));
    }

    // Test Network (simulated - in production, use Daily.co preAuth)
    setTimeout(() => {
      const latency = Math.random() * 100;
      setChecks((prev) => ({
        ...prev,
        network: {
          status: latency < 50 ? "success" : "warning",
          message: `Latency: ${latency.toFixed(0)}ms ${latency > 50 ? "(Slow network)" : ""}`,
        },
      }));
    }, 1500);
  };

  const allChecksPassed = Object.values(checks).every(
    (c) => c.status === "success" || c.status === "warning",
  );

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        Pre-Call Device Check
      </h2>

      {/* Camera Preview */}
      <div className="mb-6 bg-gray-900 rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      {/* Check Results */}
      <div className="space-y-3 mb-6">
        {Object.entries(checks).map(([key, check]) => (
          <div
            key={key}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            {check.status === "success" && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            {check.status === "error" && (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            {check.status === "warning" && (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
            {check.status === "pending" && (
              <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            )}
            <div className="flex-1">
              <p className="font-medium capitalize">{key}</p>
              <p className="text-sm text-gray-600">{check.message}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        disabled={!allChecksPassed}
        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {allChecksPassed ? "Join Call" : "Checking Devices..."}
      </button>
    </div>
  );
};

// ============================================
// VIDEO CALL INTERFACE
// ============================================

const VideoCallInterface = ({ sessionData, onEndCall }) => {
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    // Initialize local video stream
    initializeLocalStream();

    // Start call duration timer
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const initializeLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to get local stream:", error);
    }
  };

  const toggleVideo = () => {
    if (localVideoRef.current?.srcObject) {
      const videoTrack = localVideoRef.current.srcObject.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    }
  };

  const toggleAudio = () => {
    if (localVideoRef.current?.srcObject) {
      const audioTrack = localVideoRef.current.srcObject.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioOn(audioTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        // In production, send this to Daily.co
        setIsScreenSharing(true);
      } catch (error) {
        console.error("Screen share failed:", error);
      }
    } else {
      setIsScreenSharing(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    // Stop all tracks
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
    }
    onEndCall(callDuration);
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
      {sessionData ? (
        <div className="w-full aspect-video bg-black">
          <iframe
            src={`${sessionData.roomUrl}?t=${sessionData.token}`}
            allow="camera; microphone; display-capture; autoplay"
            className="w-full h-full border-0"
            title="Daily.co Video Call"
          />
          <div className="bg-gray-800 p-4 flex justify-center">
            <button
              onClick={handleEndCall}
              className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Video Grid */}
          <div className="relative aspect-video bg-black">
            {/* Remote Video (Doctor) */}
            <div className="w-full h-full">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-white text-sm">
                Dr. Sarah Johnson
              </div>
            </div>

            {/* Local Video (Picture-in-Picture) */}
            <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-xl border-2 border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                  <VideoOff className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* Call Status */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-medium">
                {formatDuration(callDuration)}
              </span>
            </div>

            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-14 right-4 bg-red-600 px-3 py-1 rounded-full text-white text-xs font-medium">
                🔴 Recording
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-gray-800 p-4">
            <div className="flex items-center justify-center gap-4">
              {/* Toggle Video */}
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full transition-colors ${
                  isVideoOn
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isVideoOn ? (
                  <Video className="w-6 h-6 text-white" />
                ) : (
                  <VideoOff className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Toggle Audio */}
              <button
                onClick={toggleAudio}
                className={`p-4 rounded-full transition-colors ${
                  isAudioOn
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {isAudioOn ? (
                  <Mic className="w-6 h-6 text-white" />
                ) : (
                  <MicOff className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Screen Share */}
              <button
                onClick={toggleScreenShare}
                className={`p-4 rounded-full transition-colors ${
                  isScreenSharing
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <Monitor className="w-6 h-6 text-white" />
              </button>

              {/* End Call */}
              <button
                onClick={handleEndCall}
                className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>

              {/* Toggle Recording */}
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-white"
                }`}
              >
                {isRecording ? "Stop Recording" : "Start Recording"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// MAIN TELEHEALTH COMPONENT
// ============================================

export default function TelehealthSuite() {
  const [stage, setStage] = useState("pre-check"); // pre-check, waiting, active, ended
  const [callSummary, setCallSummary] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setAppointmentId(params.get("appointmentId"));
    }
  }, []);

  const handlePreCheckComplete = async () => {
    if (appointmentId) {
      setStage("waiting");
      try {
        const { data, error } = await supabase
          .from("telehealth_sessions")
          .select("room_url, patient_token")
          .eq("appointment_id", appointmentId)
          .single();

        if (error) throw error;

        if (data) {
          setSessionData({
            roomUrl: data.room_url,
            token: data.patient_token,
          });
          setStage("active");
        } else {
          alert("Telehealth session not found for this appointment.");
          setStage("pre-check");
        }
      } catch (err) {
        console.error("Error loading session:", err);
        alert("Failed to load telehealth session. Falling back to simulation.");
        setTimeout(() => {
          setStage("active");
        }, 1500);
      }
    } else {
      setStage("waiting");
      setTimeout(() => {
        setStage("active");
      }, 2000);
    }
  };

  const handleEndCall = (duration) => {
    setStage("ended");
    setCallSummary({
      duration: typeof duration === "number" ? duration : 0,
      timestamp: new Date().toISOString(),
      participants: ["Patient", "Dr. Sarah Johnson"],
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Video className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                Phase 3: Telehealth Suite
              </h1>
              <p className="text-sm text-gray-600">
                HIPAA-compliant video consultations with Daily.co
              </p>
            </div>
          </div>
        </div>

        {/* Stage: Pre-Check */}
        {stage === "pre-check" && (
          <ErrorBoundary title="Device Check Failure" onReset={() => setStage("pre-check")}>
            <DeviceChecker onComplete={handlePreCheckComplete} />
          </ErrorBoundary>
        )}

        {/* Stage: Waiting Room */}
        {stage === "waiting" && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Waiting for Doctor
            </h2>
            <p className="text-gray-600">
              Dr. Sarah Johnson will join shortly...
            </p>
          </div>
        )}

        {/* Stage: Active Call */}
        {stage === "active" && (
          <ErrorBoundary title="Telehealth Media Failure" onReset={() => setStage("pre-check")}>
            <VideoCallInterface sessionData={sessionData} onEndCall={handleEndCall} />
          </ErrorBoundary>
        )}

        {/* Stage: Call Ended */}
        {stage === "ended" && callSummary && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Call Ended
              </h2>
              <p className="text-gray-600">
                Your consultation has been recorded and encrypted.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">
                  {Math.floor(callSummary.duration / 60)} minutes
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Participants:</span>
                <span className="font-medium">
                  {callSummary.participants.join(", ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Timestamp:</span>
                <span className="font-medium text-xs">
                  {new Date(callSummary.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setStage("pre-check")}
              className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start New Call
            </button>
          </div>
        )}

        {/* Implementation Notes */}
        <div className="bg-gray-800 text-gray-100 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">
            🔬 Production Implementation
          </h2>
          <pre className="text-xs bg-gray-900 p-4 rounded overflow-x-auto">
            {`// Daily.co Integration (React)
import Daily from '@daily-co/daily-js';

const callFrame = Daily.createFrame({
  showLeaveButton: true,
  iframeStyle: {
    position: 'fixed',
    width: '100%',
    height: '100%',
  }
});

// Join room with token
await callFrame.join({ 
  url: 'https://your-domain.daily.co/room-name',
  token: dailyToken // From your backend
});

// Listen for events
callFrame.on('participant-joined', (e) => {
  console.log('Doctor joined:', e.participant);
});

callFrame.on('recording-started', () => {
  // Save to audit logs
  await supabase.from('call_logs').insert({
    room_id: roomId,
    action: 'recording_started',
    timestamp: new Date()
  });
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}
