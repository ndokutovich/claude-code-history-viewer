import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { LoadingProgress } from "../types";

interface SplashScreenProps {
  progress: LoadingProgress;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ progress }) => {
  const [dots, setDots] = useState("");

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 z-50">
      <div className="max-w-md w-full px-8">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-ping opacity-20" />
          </div>
        </div>

        {/* App Title */}
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800 dark:text-gray-100">
          Claude Code History Viewer
        </h1>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mb-8">
          Loading conversation history{dots}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
            <span>{progress.message}</span>
            <span>{Math.round(progress.progress)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>

        {/* Details */}
        {progress.details && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-500 mt-4">
            {progress.details}
          </p>
        )}

        {/* Stage indicator */}
        <div className="flex justify-center space-x-2 mt-6">
          {['initializing', 'detecting-sources', 'loading-adapters', 'scanning-projects', 'complete'].map((stage, index) => (
            <div
              key={stage}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                progress.stage === stage
                  ? 'bg-purple-600 dark:bg-purple-400 scale-125'
                  : index < ['initializing', 'detecting-sources', 'loading-adapters', 'scanning-projects', 'complete'].indexOf(progress.stage)
                  ? 'bg-blue-500 dark:bg-blue-400'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
