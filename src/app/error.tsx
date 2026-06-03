"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, RotateCcw, Home, Terminal, ChevronRight, ChevronDown } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showStack, setShowStack] = useState(false);

  useEffect(() => {
    // Log the error to HIPAA-compliant audit logs or telemetry
    console.error("Next.js root segment error occurred:", error);
  }, [error]);

  const handleReturnHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-zinc-950 to-neutral-950 p-6 font-sans">
      <div className="max-w-xl w-full bg-black/40 backdrop-blur-md border border-red-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center">
          {/* Header Icon */}
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 mb-6 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <AlertCircle className="w-10 h-10 animate-pulse" />
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-bold text-gray-100 tracking-tight mb-2">
            System Consultation Failed
          </h2>
          <p className="text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
            The app encountered an unexpected runtime exception. All E2EE keys and decrypted records remain protected locally in memory.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
            <button
              onClick={() => reset()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold tracking-wide transition-all shadow-lg shadow-red-600/20 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={handleReturnHome}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-gray-200 border border-zinc-700/50 rounded-xl text-sm font-semibold tracking-wide transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Return Home
            </button>
          </div>

          {/* Accordion Toggle for Technical Logs */}
          <div className="w-full border-t border-zinc-800/80 pt-4 text-left">
            <button
              onClick={() => setShowStack(!showStack)}
              className="flex items-center justify-between w-full text-zinc-500 hover:text-zinc-400 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Technical Logs
              </span>
              {showStack ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {showStack && (
              <div className="mt-3 bg-zinc-950 border border-zinc-900 rounded-lg p-4 font-mono text-[11px] text-zinc-300 overflow-auto max-h-48 shadow-inner select-text">
                <p className="text-red-400 font-bold mb-1">
                  [Error] {error.name || "RuntimeError"}: {error.message}
                </p>
                {error.digest && (
                  <p className="text-zinc-500 mb-2">Digest ID: {error.digest}</p>
                )}
                {error.stack && (
                  <pre className="whitespace-pre-wrap leading-5 opacity-80">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
