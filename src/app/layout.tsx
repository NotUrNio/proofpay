import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { ShieldAlert, ShieldCheck, Zap } from "lucide-react";
import { MoneyFlowStrip } from "@/components/layout/MoneyFlowStrip";

export const metadata: Metadata = {
  title: "ProofPay ⚡ AI-Verified Escrow & Instant Payouts",
  description: "Autonomous escrow and milestone settlement engine for freelancers powered by PayPal and Google Gemini",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMock = process.env.PAYPAL_MOCK === "true";

  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen flex flex-col">
        {/* Prominent MOCK MODE Banner if PAYPAL_MOCK=true */}
        {isMock && (
          <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2.5 text-center text-sm shadow-sm flex items-center justify-center gap-2 tracking-wide border-b border-amber-600">
            <ShieldAlert className="w-5 h-5 text-slate-950" />
            <span>⚠️ MOCK MODE ACTIVE: Running in simulated sandbox mode. Real PayPal network calls are bypassed. Spike scripts and final demo require real credentials.</span>
          </div>
        )}

        {/* Global Money-Flow Strip at Top */}
        <MoneyFlowStrip />

        {/* Global Navigation Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 font-black text-xl text-blue-700 tracking-tight">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <span>ProofPay</span>
                <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200 ml-1">
                  PayPal AI Hackathon
                </span>
              </Link>
              <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
                <Link href="/" className="hover:text-blue-600 transition-colors">
                  Dashboard
                </Link>
                <Link href="/inbox" className="hover:text-blue-600 transition-colors">
                  Review Inbox
                </Link>
                <Link href="/policy" className="hover:text-blue-600 transition-colors">
                  Policy Guard
                </Link>
                <Link href="/chaos" className="hover:text-rose-600 text-rose-700 font-semibold transition-colors">
                  Chaos Drills
                </Link>
                <Link href="/studio" className="hover:text-blue-600 transition-colors text-indigo-600 font-semibold">
                  AG Studio
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Zero-LLM Guard: Active
              </span>
              <Link
                href="/jobs/new"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>+ New Milestone</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            <p>ProofPay Autonomous Milestone Escrow • PayPal AI Hackathon 2026 • MIT Licensed</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
