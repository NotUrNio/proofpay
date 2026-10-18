"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, DollarSign, Sparkles, AlertTriangle, ShieldCheck, FileCheck } from "lucide-react";

interface Job {
  id: string;
  title: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  freelancerEmail: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSeed, setCreatingSeed] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Failed to load jobs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const createSeedJob = async () => {
    setCreatingSeed(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Social Media Banner (Summer Sale)",
          description: "1080x1080 PNG, <= 2MB, contains 'SUMMER SALE', warm brand palette.",
          clientEmail: "sandbox-buyer@business.example.com",
          freelancerEmail: "priya-designer@sandbox.paypal.com",
          amount: "50.00",
          currency: "USD",
        }),
      });
      const data = await res.json();
      if (data.job?.id) {
        window.location.href = `/jobs/${data.job.id}`;
      } else {
        await fetchJobs();
      }
    } catch (err) {
      console.error("Failed to seed job", err);
    } finally {
      setCreatingSeed(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SETTLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Settled (Paid Out)
          </span>
        );
      case "FUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <DollarSign className="w-3.5 h-3.5" /> Funded (In Escrow)
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Sparkles className="w-3.5 h-3.5" /> Submitted
          </span>
        );
      case "MANUAL_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Human Review Queue
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-8 text-white shadow-md relative overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 text-blue-200 text-xs font-semibold px-3 py-1 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Zero-LLM Guarded Escrow
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            ProofPay: AI-Verified Autonomous Escrow
          </h1>
          <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
            Eliminating 30-day payout delays for freelancers like Priya. Clients fund escrow via PayPal Orders v2, deliverables are verified against strict rubrics, and a pure TypeScript Policy Guard safely authorizes immediate payouts.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={createSeedJob}
              disabled={creatingSeed}
              className="bg-white hover:bg-slate-100 text-blue-900 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              {creatingSeed ? "Seeding..." : "Quick Launch Demo Seed Job"}
            </button>
            <Link
              href="/jobs/new"
              className="bg-blue-700/60 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl border border-blue-400/40 text-sm transition-all flex items-center gap-2"
            >
              <span>Custom Job</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Jobs Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Milestone Escrow Pipeline</h2>
            <p className="text-xs text-slate-500">Real-time status of active milestones and settlements</p>
          </div>
          <button
            onClick={fetchJobs}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            Refresh List
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading milestones...</div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">No milestones found</p>
              <p className="text-xs text-slate-500 mt-1">Get started by launching the hackathon demo seed job.</p>
            </div>
            <button
              onClick={createSeedJob}
              disabled={creatingSeed}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow-sm"
            >
              Launch Seed Job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Milestone Title</th>
                  <th className="px-6 py-3">Payee (Freelancer)</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <Link href={`/jobs/${job.id}`} className="hover:text-blue-600">
                        {job.title}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {job.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                      {job.freelancerEmail}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ${job.amount} {job.currency}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <span>View Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
