"use client";

import { useEffect, useState, useRef } from "react";
import { User, Shield, Briefcase, ChevronDown, Check } from "lucide-react";

export type UserRole = "client" | "freelancer" | "reviewer";

export interface PersonaInfo {
  id: UserRole;
  name: string;
  roleTitle: string;
  avatarInitials: string;
  email: string;
  description: string;
  accentBg: string;
  accentText: string;
  badgeBorder: string;
}

export const PERSONAS: PersonaInfo[] = [
  {
    id: "freelancer",
    name: "Priya",
    roleTitle: "Freelance Designer",
    avatarInitials: "P",
    email: "priya@proofpay.io",
    description: "Submits creative banners, expects instant payouts on pass",
    accentBg: "bg-emerald-950/80",
    accentText: "text-emerald-400",
    badgeBorder: "border-emerald-800/80",
  },
  {
    id: "client",
    name: "Alice",
    roleTitle: "Marketing Client",
    avatarInitials: "A",
    email: "alice@proofpay.io",
    description: "Funds milestones safely in PayPal escrow with strict policy caps",
    accentBg: "bg-blue-950/80",
    accentText: "text-blue-400",
    badgeBorder: "border-blue-800/80",
  },
  {
    id: "reviewer",
    name: "Alex",
    roleTitle: "Milestone Auditor",
    avatarInitials: "X",
    email: "reviewer@proofpay.io",
    description: "Reviews gray-zone near-misses and tests system chaos drills",
    accentBg: "bg-purple-950/80",
    accentText: "text-purple-400",
    badgeBorder: "border-purple-800/80",
  },
];

export function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<UserRole>("client");
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectRole = async (role: UserRole) => {
    const hasCookie =
      typeof document !== "undefined" &&
      document.cookie.includes(`proofpay_role=${role}`);
    if (role === currentRole && hasCookie) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setCurrentRole(role);
      setIsOpen(false);
      // Reload current view to hydrate role-specific permissions and UI
      window.location.reload();
    } catch (err) {
      console.error("Failed to switch role:", err);
    } finally {
      setSwitching(false);
    }
  };

  const activePersona = PERSONAS.find((p) => p.id === currentRole) || PERSONAS[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={switching}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${activePersona.badgeBorder} ${activePersona.accentBg} text-slate-200 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        <span className="text-slate-400 font-normal">Demo as:</span>
        <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${activePersona.accentText} bg-black/40`}>
          {activePersona.avatarInitials}
        </span>
        <span className="font-semibold text-white">{activePersona.name}</span>
        <span className="text-slate-400 hidden sm:inline font-normal">({activePersona.roleTitle.split(" ")[0]})</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select Demo Persona"
          className="absolute right-0 mt-2 w-72 rounded-xl bg-[#161B22] border border-[#30363D] shadow-2xl p-2 z-50 focus:outline-none"
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-[#30363D] mb-1">
            SWITCH DEMO PERSPECTIVE
          </div>
          <div className="space-y-1">
            {PERSONAS.map((persona) => {
              const isSelected = persona.id === currentRole;
              return (
                <button
                  key={persona.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectRole(persona.id)}
                  className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition-colors ${
                    isSelected ? "bg-[#21262D] border border-blue-500/40" : "hover:bg-[#21262D]/60 border border-transparent"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs ${persona.accentBg} ${persona.accentText} border ${persona.badgeBorder}`}>
                    {persona.avatarInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white">{persona.name}</span>
                      <span className="text-[10px] text-slate-400">{persona.roleTitle}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                      {persona.description}
                    </p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
