import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StudioClient from "./StudioClient";

export const metadata = {
  title: "Analytics Workspace | ProofPay",
  description:
    "Real-time analytics dashboard visualizing milestone velocity, settlement outcomes, policy cap compliance, and ground-truth model benchmarks.",
};

export default function StudioPage() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30363D] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Settlement Analytics &amp; Velocity Workspace
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time analytics visualizing escrow spend velocity, decision outcomes, policy cap margins, and ground-truth eval metrics powered by Recharts (MIT).
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg border border-[#30363D] bg-[#161B22] self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Overview
        </Link>
      </div>

      {/* Analytics Dashboard */}
      <StudioClient />
    </div>
  );
}
