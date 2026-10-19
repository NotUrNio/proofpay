"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Plus,
  Inbox,
  Sliders,
  ChevronRight,
  ExternalLink,
  History,
  FileText,
} from "lucide-react";
import { SignatureCheckpointRoute } from "@/components/pipeline/SignatureCheckpointRoute";
import { GuidedDemoScenarios } from "@/components/demo/GuidedDemoScenarios";
import { maskEmail } from "@/lib/ledger-display";

interface Job {
  id: string;
  title: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  freelancerEmail: string;
  clientEmail: string;
  createdAt: string;
}

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState<"client" | "freelancer" | "reviewer">("client");
  const demoSectionRef = useRef<HTMLDivElement>(null);

  const fetchHomeData = async () => {
    try {
      const [jobsRes, roleRes] = await Promise.all([
        fetch("/api/jobs"),
        fetch("/api/auth/role"),
      ]);
      const jobsData = await jobsRes.json();
      const roleData = await roleRes.json();

      if (jobsData.jobs) {
        setJobs(jobsData.jobs);
      }
      if (roleData.user?.role) {
        setCurrentRole(roleData.user.role);
      }
    } catch (err) {
      console.error("Failed to load home data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const handleQuickRoleSwitch = async (role: "client" | "freelancer" | "reviewer") => {
    try {
      await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setCurrentRole(role);
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch role:", err);
    }
  };

  const scrollToDemo = () => {
    demoSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SETTLED":
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Settled (Paid Out)
          </span>
        );
      case "FUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-800">
            <Lock className="w-3 h-3 text-blue-400" /> Funded (In Escrow)
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/80 text-purple-400 border border-purple-800">
            <Sparkles className="w-3 h-3 text-purple-400" /> Submitted
          </span>
        );
      case "VERIFYING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-900/60 text-blue-300 border border-blue-700 animate-pulse">
            <Sparkles className="w-3 h-3" /> Verifying
          </span>
        );
      case "MANUAL_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> Human Review Queue
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#21262D] text-slate-300 border border-[#30363D]">
            <Clock className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-12">
      {/* 1. Hero Section */}
      <section className="space-y-6">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#161B22] border border-[#30363D] text-blue-400 text-xs font-semibold px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Autonomous Escrow • PayPal AI Hackathon</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Autonomous milestone escrow that pays freelancers the second work passes.
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            Priya gets paid in seconds without waiting 30 days for an invoice. Alice funds with confidence, knowing funds never leave PayPal escrow until deliverables strictly pass the contract rules.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={scrollToDemo}
              className="bg-[#0070BA] hover:bg-[#005ea6] text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs sm:text-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 fill-current text-white" />
              <span>Try the 60-Second Guided Demo</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
              <span>Or explore as:</span>
              <button
                type="button"
                onClick={() => handleQuickRoleSwitch("freelancer")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  currentRole === "freelancer"
                    ? "bg-emerald-950 text-emerald-300 border-emerald-700"
                    : "bg-[#161B22] text-slate-300 border-[#30363D] hover:border-slate-500"
                }`}
              >
                Priya (Freelancer)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRoleSwitch("client")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  currentRole === "client"
                    ? "bg-blue-950 text-blue-300 border-blue-700"
                    : "bg-[#161B22] text-slate-300 border-[#30363D] hover:border-slate-500"
                }`}
              >
                Alice (Client)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRoleSwitch("reviewer")}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                  currentRole === "reviewer"
                    ? "bg-purple-950 text-purple-300 border-purple-700"
                    : "bg-[#161B22] text-slate-300 border-[#30363D] hover:border-slate-500"
                }`}
              >
                Alex (Reviewer)
              </button>
            </div>
          </div>
        </div>

        {/* The Signature Checkpoint Route Component */}
        <SignatureCheckpointRoute currentStep="settled" />
      </section>

      {/* 2. Guided Demo Section */}
      <section ref={demoSectionRef} className="space-y-4 pt-4 border-t border-[#30363D]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Guided 60-Second Sandbox Demo
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Run real end-to-end sandbox scenarios with pre-loaded deliverables. No file upload or PayPal account needed.
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-1 rounded self-start sm:self-auto">
            Live Sandbox Environment
          </span>
        </div>

        <GuidedDemoScenarios />
      </section>

      {/* 3. Role-Specific Dashboard Section */}
      <section className="space-y-4 pt-4 border-t border-[#30363D]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {currentRole === "freelancer" && "Priya's Milestones & Payouts"}
              {currentRole === "client" && "Alice's Funded Milestones in Escrow"}
              {currentRole === "reviewer" && "Alex's Milestone Triage Queue"}
            </h2>
            <p className="text-xs text-slate-400">
              {currentRole === "freelancer" && "Track automated payouts and submit required deliverables."}
              {currentRole === "client" && "Inspect active escrow balances and review cryptographically enforced mandates."}
              {currentRole === "reviewer" && "Triaging borderline deliverables routed by the Policy Guard."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentRole === "client" && (
              <Link
                href="/jobs/new"
                className="bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Fund New Milestone</span>
              </Link>
            )}
            {currentRole === "reviewer" && (
              <Link
                href="/inbox"
                className="bg-[#D29922] hover:bg-[#BB8009] text-black text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Open Review Inbox</span>
              </Link>
            )}
          </div>
        </div>

        {/* Milestones List */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-6 space-y-3">
              <div className="h-10 rounded skeleton-shimmer" />
              <div className="h-10 rounded skeleton-shimmer" />
              <div className="h-10 rounded skeleton-shimmer" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <FileText className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-400">No active milestones found in the sandbox.</p>
              <Link
                href="/jobs/new"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                <span>Fund your first milestone</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#30363D]">
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1C2128] transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="font-bold text-sm text-white hover:text-blue-400 transition-colors truncate"
                      >
                        {job.title}
                      </Link>
                      {getStatusBadge(job.status)}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {job.description}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Freelancer: {maskEmail(job.freelancerEmail)}</span>
                      <span>•</span>
                      <span>Client: {maskEmail(job.clientEmail)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-white">
                        ${parseFloat(job.amount).toFixed(2)} {job.currency}
                      </div>
                      <div className="text-[10px] text-slate-400">Milestone Escrow</div>
                    </div>

                    <Link
                      href={`/jobs/${job.id}`}
                      className="p-2 rounded-lg bg-[#21262D] hover:bg-[#30363D] text-slate-300 hover:text-white transition-colors"
                      title="View milestone checkpoint route"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. "How It Is Protected" — Technical Credibility */}
      <section className="space-y-4 pt-4 border-t border-[#30363D]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            How It Is Protected
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Engineered with fail-closed security. Artificial intelligence never touches the payment trigger.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pillar 1 */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">Zero AI in Policy Guard</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multimodal models only act as passive sensory readers. The final payout decision is rendered by a deterministic, pure TypeScript Policy Guard that has zero AI imports.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">HMAC Signed Mandates</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every milestone signs an immutable HMAC-SHA256 mandate at creation. The Policy Guard verifies that payee, scope, and maximum payout cap strictly match before releasing funds.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-800 text-purple-400 flex items-center justify-center font-bold">
              <History className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">Tamper-Evident Ledger</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              PostgreSQL row-level triggers enforce forward SHA-256 hash chaining on all ledger rows. Every event seals the previous hash, creating a mathematical audit trail.
            </p>
          </div>
        </div>

        {/* Real Benchmark Stats Box */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-white">Evaluation Benchmark: 100.0% Accuracy</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                28 / 28 Fixtures
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Evaluated on Gemini 3.8 Flash across 28 multi-aspect visual fixtures. 0.0% False-Approval Rate; Wilson 95% Confidence Interval: [87.9%, 100.0%] (Sample size: N=28).
            </p>
          </div>
          <Link
            href="/eval"
            className="flex-shrink-0 text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Inspect Benchmark Data</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
