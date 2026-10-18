"use client";

import { useEffect, useState } from "react";
import { AgGridLedger, LedgerRowData } from "@/components/ledger/AgGridLedger";
import { ShieldCheck, History, ExternalLink } from "lucide-react";

export default function LedgerPage() {
  const [ledgerEvents, setLedgerEvents] = useState<LedgerRowData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    try {
      const res = await fetch("/api/ledger?limit=100");
      const data = await res.json();
      if (data.events) {
        setLedgerEvents(data.events);
      }
    } catch (err) {
      console.error("Failed to load ledger events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30363D] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Cryptographic Audit Ledger
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Append-only PostgreSQL ledger with SHA-256 forward-hash chaining. Every escrow deposit, deliverable submission, guard evaluation, and PayPal payout writes an immutable seal.
          </p>
        </div>
      </div>

      {/* Ledger Grid */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 sm:p-5">
        <AgGridLedger events={ledgerEvents} onRefresh={fetchLedger} />
      </div>
    </div>
  );
}
