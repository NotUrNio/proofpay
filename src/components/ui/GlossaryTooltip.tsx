"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

export type GlossaryTerm = "escrow" | "guard" | "deltaE" | "mandate";

const GLOSSARY_DEFINITIONS: Record<
  GlossaryTerm,
  { term: string; definition: string; formula?: string }
> = {
  escrow: {
    term: "Escrow Lockbox",
    definition:
      "Funds captured and held in PayPal Orders v2 neutral custody. Money never leaves escrow until all cryptographic checkpoints pass.",
  },
  guard: {
    term: "Pure TS Policy Guard",
    definition:
      "Deterministic, fail-closed TypeScript validation module with zero AI model dependencies, ensuring mathematical contract enforcement.",
  },
  deltaE: {
    term: "CIEDE2000 ΔE (Delta E)",
    definition:
      "Perceptual color distance metric. ΔE < 11.5 passes automatically; 11.5–16 enters the human review gray-zone; > 16 fails immediately.",
    formula: "ΔE = √((ΔL')² + (ΔC')² + (ΔH')² + RT·ΔC'·ΔH')",
  },
  mandate: {
    term: "HMAC Mandate",
    definition:
      "Cryptographically signed authorization binding maximum payout amount, payee email, and expiration before work begins.",
  },
};

interface GlossaryTooltipProps {
  term: GlossaryTerm;
  children?: React.ReactNode;
}

export function GlossaryTooltip({ term, children }: GlossaryTooltipProps) {
  const [open, setOpen] = useState(false);
  const data = GLOSSARY_DEFINITIONS[term];
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center gap-1 cursor-help group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className="underline decoration-dotted decoration-slate-400 underline-offset-2">
        {children || data.term}
      </span>
      <button
        type="button"
        aria-label={`Definition of ${data.term}`}
        aria-expanded={open}
        className="text-slate-400 hover:text-blue-400 transition-colors p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      >
        <HelpCircle className="w-3 h-3" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#161B22] border border-[#30363D] text-[#F0F6FC] text-xs rounded-xl shadow-2xl z-50 pointer-events-none text-left"
        >
          <span className="font-bold text-white block mb-1">{data.term}</span>
          <span className="text-slate-300 text-[11px] leading-relaxed block">
            {data.definition}
          </span>
          {data.formula && (
            <span className="block mt-1 font-mono text-[10px] text-blue-300 bg-[#0D1117] p-1 rounded border border-[#21262D]">
              {data.formula}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
