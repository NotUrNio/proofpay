"use client";

import { useEffect, useState } from "react";
import { User, Shield, Briefcase, CheckCircle2 } from "lucide-react";

type UserRole = "client" | "freelancer" | "reviewer";

interface SessionUser {
  email: string;
  name: string;
  role: UserRole;
}

const ROLES: { id: UserRole; label: string; icon: any; color: string; email: string }[] = [
  {
    id: "reviewer",
    label: "Reviewer (Alex)",
    icon: Shield,
    color: "bg-purple-100 text-purple-800 border-purple-200",
    email: "reviewer@proofpay.io",
  },
  {
    id: "freelancer",
    label: "Freelancer (Priya)",
    icon: Briefcase,
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    email: "priya@proofpay.io",
  },
  {
    id: "client",
    label: "Client (Alice)",
    icon: User,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    email: "alice@proofpay.io",
  },
];

export function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<UserRole>("reviewer");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/role")
      .then((res) => res.json())
      .then((data) => {
        if (data?.user?.role) {
          setCurrentRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const handleRoleChange = async (role: UserRole) => {
    setLoading(true);
    try {
      await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setCurrentRole(role);
      setIsOpen(false);
      // Refresh page so role-guarded server state is re-evaluated
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch role:", e);
    } finally {
      setLoading(false);
    }
  };

  const active = ROLES.find((r) => r.id === currentRole) || ROLES[0];
  const Icon = active.icon;

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${active.color} hover:opacity-90 shadow-xs`}
        title="Switch Demo Role (Judge Access Control)"
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{active.label}</span>
        <span className="text-[10px] opacity-60 ml-0.5">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-50">
          <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Demo User Switcher (Judge Mode)
          </div>
          {ROLES.map((role) => {
            const RoleIcon = role.icon;
            const isSelected = role.id === currentRole;
            return (
              <button
                key={role.id}
                onClick={() => handleRoleChange(role.id)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition-colors hover:bg-slate-50 ${
                  isSelected ? "bg-slate-100/70 font-bold" : ""
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${role.color}`}
                  >
                    <RoleIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-slate-800">{role.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {role.email}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

