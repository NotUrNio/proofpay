"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Zap,
  Plus,
  Inbox,
  ShieldCheck,
  Flame,
  BarChart3,
  Cpu,
  User,
  Briefcase,
  Shield,
  ArrowRight,
  X,
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  category: "Navigation" | "Persona" | "Lab";
  icon: any;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const switchRole = async (role: "client" | "freelancer" | "reviewer") => {
    try {
      await fetch("/api/auth/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      window.location.reload();
    } catch (err) {
      console.error("Role switch failed:", err);
    }
  };

  const commands: CommandItem[] = [
    {
      id: "nav_home",
      title: "Overview Dashboard",
      category: "Navigation",
      icon: Zap,
      action: () => router.push("/"),
    },
    {
      id: "nav_new",
      title: "Fund New Milestone",
      category: "Navigation",
      icon: Plus,
      action: () => router.push("/jobs/new"),
    },
    {
      id: "nav_inbox",
      title: "Reviewer Triage Inbox",
      category: "Navigation",
      icon: Inbox,
      action: () => router.push("/inbox"),
    },
    {
      id: "nav_ledger",
      title: "Cryptographic Audit Ledger",
      category: "Navigation",
      icon: ShieldCheck,
      action: () => router.push("/ledger"),
    },
    {
      id: "lab_policy",
      title: "Policy Guard & Replay Simulator",
      category: "Lab",
      icon: ShieldCheck,
      action: () => router.push("/policy"),
    },
    {
      id: "lab_chaos",
      title: "Reliability Chaos Negative Testing",
      category: "Lab",
      icon: Flame,
      action: () => router.push("/chaos"),
    },
    {
      id: "lab_studio",
      title: "AG Studio Analytics Workspace",
      category: "Lab",
      icon: BarChart3,
      action: () => router.push("/studio"),
    },
    {
      id: "lab_eval",
      title: "Benchmark Evaluation Results (N=28)",
      category: "Lab",
      icon: Cpu,
      action: () => router.push("/eval"),
    },
    {
      id: "persona_priya",
      title: "Switch Persona to Priya (Freelancer)",
      category: "Persona",
      icon: Briefcase,
      action: () => switchRole("freelancer"),
    },
    {
      id: "persona_alice",
      title: "Switch Persona to Alice (Client)",
      category: "Persona",
      icon: User,
      action: () => switchRole("client"),
    },
    {
      id: "persona_alex",
      title: "Switch Persona to Alex (Reviewer)",
      category: "Persona",
      icon: Shield,
      action: () => switchRole("reviewer"),
    },
  ];

  const filteredCommands = query
    ? commands.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      } else if (isOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(filteredCommands.length - 1, prev + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
          e.preventDefault();
          filteredCommands[selectedIndex].action();
          setIsOpen(false);
        }
      }
    },
    [isOpen, filteredCommands, selectedIndex]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0D1117] border border-[#30363D] text-slate-400 hover:text-slate-200 text-xs transition-colors"
        title="Open Command Palette"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search...</span>
        <kbd className="text-[10px] bg-[#161B22] border border-[#30363D] px-1 py-0.5 rounded font-mono text-slate-400">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-start justify-center pt-20 px-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-2">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-[#30363D] flex items-center gap-2.5">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or jump to page..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500"
          />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Items List */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No matching commands or routes found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => {
                    cmd.action();
                    setIsOpen(false);
                  }}
                  className={`w-full p-2.5 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                    isSelected ? "bg-[#21262D] text-white" : "text-slate-300 hover:bg-[#21262D]/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>{cmd.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {cmd.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2.5 border-t border-[#30363D] bg-[#0D1117] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Navigate with ↑ / ↓</span>
          <span>Press Enter to select • Esc to close</span>
        </div>
      </div>
    </div>
  );
}

