import React from "react";
import { AgStudioEmbed } from "@/components/studio/AgStudioEmbed";
import Link from "next/link";
import { ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "AG Studio Spike | ProofPay",
  description: "Milestone 3.0 Spike: Embedded AG Studio Canvas with Trial License",
};

export default function StudioSpikePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 px-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to ProofPay
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> AG Studio Embedded Canvas
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>License Key Active (Front-End Trial)</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-50 tracking-tight">Milestone 3.0 Spike: AG Studio Integration</h2>
          <p className="text-sm text-slate-400 mt-1">
            Validating interactive AG Studio canvas embed inside Next.js App Router with official AG Grid Enterprise trial license.
          </p>
        </div>

        <div className="flex-1">
          <AgStudioEmbed className="h-[700px]" />
        </div>
      </main>
    </div>
  );
}

