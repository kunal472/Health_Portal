"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  title?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDiagnostics: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDiagnostics: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  private handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDiagnostics: false,
    });
  };

  private toggleDiagnostics = () => {
    this.setState((prev) => ({ showDiagnostics: !prev.showDiagnostics }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={`p-6 bg-red-50/70 border border-red-200 rounded-xl shadow-sm text-gray-800 max-w-2xl mx-auto my-4 transition-all duration-300 ${this.props.className || ""}`}>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-full text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 mb-1">
                {this.props.title || "Section Rendering Failed"}
              </h3>
              <p className="text-sm text-red-700 mb-4">
                We encountered an unexpected error while displaying this component. To preserve your session, other features remain active.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={this.toggleDiagnostics}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-sm font-medium transition-all cursor-pointer"
                >
                  {this.state.showDiagnostics ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show Technical Details
                    </>
                  )}
                </button>
              </div>

              {/* Technical diagnostics panel */}
              {this.state.showDiagnostics && (
                <div className="mt-3 bg-gray-900 text-gray-200 p-4 rounded-lg text-xs font-mono overflow-auto max-h-60 border border-gray-850 shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-red-400 font-semibold mb-2">
                    {this.state.error?.toString() || "Unknown Error"}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="whitespace-pre-wrap leading-relaxed opacity-90">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
