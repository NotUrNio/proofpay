"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 z-50 sticky top-0"
    >
      <WifiOff className="w-4 h-4 text-amber-400" />
      <span>
        <strong>Offline Mode:</strong> You are currently disconnected. Network calls to PayPal Sandbox and Gemini sensors cannot be synchronized.
      </span>
    </div>
  );
}

