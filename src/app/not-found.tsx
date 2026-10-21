import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-[#21262D] border border-[#30363D] text-blue-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">404: Page Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The milestone, drill, or route you are looking for does not exist in the ProofPay application.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

