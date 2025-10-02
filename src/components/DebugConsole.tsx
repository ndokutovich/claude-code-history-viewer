import { useState, useEffect, useRef } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface LogEntry {
  timestamp: string;
  type: "log" | "error" | "warn";
  message: string;
}

export const DebugConsole = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args: any[]) => {
      originalLog(...args);
      addLog("log", args.map(arg =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(" "));
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      addLog("error", args.map(arg =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(" "));
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      addLog("warn", args.map(arg =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(" "));
    };

    // Keyboard shortcut to toggle (Cmd+Shift+D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const addLog = (type: LogEntry["type"], message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, type, message }]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl z-50",
        isMinimized ? "w-64" : "w-[600px] h-[400px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
        <div className="text-sm font-medium">Debug Console (Cmd+Shift+D)</div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setLogs([])}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
          >
            Clear
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div className="p-2 h-[calc(100%-44px)] overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "py-1 border-b border-gray-200 dark:border-gray-800",
                  log.type === "error" && "text-red-600 dark:text-red-400",
                  log.type === "warn" && "text-yellow-600 dark:text-yellow-400",
                  log.type === "log" && "text-gray-800 dark:text-gray-200"
                )}
              >
                <span className="text-gray-500 mr-2">[{log.timestamp}]</span>
                <span className="whitespace-pre-wrap">{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
};
