"use client";

import dynamic from "next/dynamic";

const AnalyticsDashboard = dynamic(
  () => import("@/components/studio/RechartsAnalyticsDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[#161B22] border border-[#30363D] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-[#161B22] border border-[#30363D] animate-pulse" />
          ))}
        </div>
      </div>
    ),
  }
);

export default function StudioClient() {
  return <AnalyticsDashboard />;
}
