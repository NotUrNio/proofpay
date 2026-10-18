"use client";

import { Check, DollarSign, Upload, FileCheck, ShieldCheck, ArrowRight, Lock } from "lucide-react";

export type CheckpointStepId = "funded" | "submitted" | "checked" | "guard" | "settled";

export interface CheckpointInfo {
  id: CheckpointStepId;
  label: string;
  sublabel: string;
  actor: string;
  status: "complete" | "active" | "pending" | "failed";
  badge?: string;
}

interface SignatureCheckpointRouteProps {
  currentStep?: CheckpointStepId;
  statusText?: string;
  interactive?: boolean;
  onSelectStep?: (step: CheckpointStepId) => void;
}

export function SignatureCheckpointRoute({
  currentStep = "settled",
  statusText,
  interactive = false,
  onSelectStep,
}: SignatureCheckpointRouteProps) {
  const steps: CheckpointInfo[] = [
    {
      id: "funded",
      label: "1. Funded",
      sublabel: "PayPal Orders v2",
      actor: "Alice (Client)",
      status: "complete",
    },
    {
      id: "submitted",
      label: "2. Submitted",
      sublabel: "1080x1080 PNG",
      actor: "Priya (Freelancer)",
      status: currentStep === "funded" ? "active" : "complete",
    },
    {
      id: "checked",
      label: "3. Hard Checks",
      sublabel: "Aspect ratio & size",
      actor: "Deterministic Guard",
      status:
        currentStep === "funded" || currentStep === "submitted"
          ? "pending"
          : "complete",
    },
    {
      id: "guard",
      label: "4. Policy Guard",
      sublabel: "Pure TypeScript",
      actor: "Zero-AI Mandate",
      status:
        currentStep === "funded" || currentStep === "submitted" || currentStep === "checked"
          ? "pending"
          : "complete",
    },
    {
      id: "settled",
      label: "5. Settled",
      sublabel: "PayPal Payouts",
      actor: "Instant Wallet Payout",
      status: currentStep === "settled" ? "complete" : "pending",
    },
  ];

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 sm:p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#30363D] pb-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <h3 className="font-bold text-sm text-white tracking-wide">
            THE CHECKPOINT ROUTE
          </h3>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
            • Fail-Closed Settlement Conduit
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          {statusText || "Escrow funds locked until all cryptographic checkpoints pass"}
        </div>
      </div>

      {/* Horizontal Checkpoints Conduit */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-2 relative">
        {steps.map((step, idx) => {
          const isComplete = step.status === "complete";
          const isActive = step.status === "active";

          return (
            <div
              key={step.id}
              onClick={() => interactive && onSelectStep && onSelectStep(step.id)}
              className={`relative rounded-xl p-3 border transition-all ${
                interactive ? "cursor-pointer hover:border-slate-400" : ""
              } ${
                isComplete
                  ? "bg-[#0D1117] border-emerald-800/80 text-white"
                  : isActive
                  ? "bg-blue-950/40 border-blue-500 text-white ring-1 ring-blue-500/30"
                  : "bg-[#0D1117]/60 border-[#21262D] text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">{step.label}</span>
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isComplete
                      ? "bg-emerald-500 text-black"
                      : isActive
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-[#21262D] text-slate-500"
                  }`}
                >
                  {isComplete ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                </span>
              </div>

              <div className="text-[11px] font-semibold text-slate-200 truncate">
                {step.sublabel}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {step.actor}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
