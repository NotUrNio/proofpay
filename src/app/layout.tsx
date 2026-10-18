import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Shield, Zap, ChevronDown, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { MoneyFlowStrip } from "@/components/layout/MoneyFlowStrip";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "ProofPay — Autonomous Milestone Escrow & Instant Settlement",
  description:
    "Autonomous milestone escrow for freelancers and clients powered by PayPal Orders & Payouts and pure TypeScript Policy Guard.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("proofpay_role")?.value || "client";
  const currentRole = roleCookie as "client" | "freelancer" | "reviewer";

  return (
    <html lang="en">
      <body className="bg-[#0D1117] text-[#F0F6FC] antialiased min-h-screen flex flex-col selection:bg-blue-600/30">
        {/* Universal Honesty Banner */}
        <div className="bg-[#161B22] border-b border-[#30363D] text-slate-300 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span>
            <strong>Sandbox demo, no real money moves.</strong> All transactions run on PayPal Sandbox with simulated or test accounts.
          </span>
        </div>

        {/* Global Navigation Header (Single unified bar) */}
        <header className="bg-[#161B22] border-b border-[#30363D] sticky top-0 z-40 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
            {/* Brand Logo */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 font-bold text-base text-white tracking-tight">
                <div className="w-7 h-7 rounded-lg bg-[#0070BA] text-white flex items-center justify-center font-black shadow-sm">
                  <Zap className="w-4 h-4 fill-current text-white" />
                </div>
                <span>ProofPay</span>
                <span className="hidden sm:inline text-[11px] text-slate-400 font-normal border-l border-slate-700 pl-2 ml-0.5">
                  Escrow & Settlement
                </span>
              </Link>

              {/* Role-Aware Nav Items */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-slate-300">
                <Link
                  href="/"
                  className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-[#21262D] transition-colors"
                >
                  Overview
                </Link>

                {currentRole === "client" && (
                  <Link
                    href="/jobs/new"
                    className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-[#21262D] transition-colors"
                  >
                    Fund Milestone
                  </Link>
                )}

                {currentRole === "reviewer" && (
                  <Link
                    href="/inbox"
                    className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-[#21262D] transition-colors"
                  >
                    Review Inbox
                  </Link>
                )}

                <Link
                  href="/ledger"
                  className="px-2.5 py-1.5 rounded-md hover:text-white hover:bg-[#21262D] transition-colors"
                >
                  Audit Ledger
                </Link>

                {/* Under the Hood / Lab Dropdown Group */}
                <div className="relative group ml-1">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#21262D] transition-colors"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-blue-400" />
                    <span>Under the hood</span>
                    <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-transform" />
                  </button>

                  <div className="absolute left-0 mt-1 w-56 rounded-xl bg-[#161B22] border border-[#30363D] shadow-2xl p-1.5 hidden group-hover:block group-focus-within:block z-50">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 border-b border-[#30363D] mb-1">
                      VERIFICATION & AUDIT LAB
                    </div>
                    <Link
                      href="/policy"
                      className="block px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#21262D] rounded-md transition-colors"
                    >
                      Policy Guard & Replay
                    </Link>
                    <Link
                      href="/chaos"
                      className="block px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#21262D] rounded-md transition-colors"
                    >
                      Reliability Chaos Drills
                    </Link>
                    <Link
                      href="/studio"
                      className="block px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#21262D] rounded-md transition-colors"
                    >
                      AG Studio Analytics
                    </Link>
                    <Link
                      href="/eval"
                      className="block px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-[#21262D] rounded-md transition-colors"
                    >
                      Benchmark Evals (N=28)
                    </Link>
                  </div>
                </div>
              </nav>
            </div>

            {/* Right Side: Command Palette + Demo as Switcher + Action CTA */}
            <div className="flex items-center gap-2 sm:gap-3">
              <CommandPalette />
              <RoleSwitcher />

              {currentRole === "client" ? (
                <Link
                  href="/jobs/new"
                  className="bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <span>+ Fund Milestone</span>
                </Link>
              ) : currentRole === "reviewer" ? (
                <Link
                  href="/inbox"
                  className="bg-[#D29922] hover:bg-[#BB8009] text-black text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <span>Triage Inbox</span>
                </Link>
              ) : (
                <Link
                  href="/"
                  className="bg-[#2EA043] hover:bg-[#238636] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <span>View Payouts</span>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Global Money-Flow Strip */}
        <MoneyFlowStrip />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Institutional Minimal Footer */}
        <footer className="bg-[#161B22] border-t border-[#30363D] py-6 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">ProofPay</span>
              <span>•</span>
              <span>PayPal AI Hackathon 2026</span>
              <span>•</span>
              <span>MIT Licensed</span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <Link href="/policy" className="hover:text-slate-200">Policy Guard</Link>
              <Link href="/chaos" className="hover:text-slate-200">Chaos Lab</Link>
              <Link href="/eval" className="hover:text-slate-200">Evaluations (N=28)</Link>
              <Link href="/ledger" className="hover:text-slate-200">Tamper-evident Ledger</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
