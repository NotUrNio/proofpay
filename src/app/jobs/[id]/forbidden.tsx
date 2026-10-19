import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { cookies } from "next/headers";
import { ROLE_COOKIE_NAME, DEMO_USERS, UserRole } from "@/lib/auth/roles";

export default async function JobForbiddenBoundary() {
  const cookieStore = await cookies();
  const roleValue = (cookieStore.get(ROLE_COOKIE_NAME)?.value || "client") as UserRole;
  const user = DEMO_USERS[roleValue] || DEMO_USERS.client;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-[#161B22] border border-rose-900/60 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">403: Access Denied</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Signed in as <strong>{user.name}</strong>. You do not own this private milestone and are not designated as its recipient or reviewer.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 bg-[#21262D] hover:bg-[#30363D] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

