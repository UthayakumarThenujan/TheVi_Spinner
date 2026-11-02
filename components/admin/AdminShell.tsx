"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Disc3, Trophy, Users, Settings, LogOut, Menu, X, ExternalLink, Sparkles } from "lucide-react";
import { api } from "@/lib/client/api";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/spinners", label: "Spinners", icon: Disc3 },
  { href: "/admin/winners", label: "Winners", icon: Trophy },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ username, brand, children }: { username: string; brand: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await api("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" /> {label}
          </Link>
        );
      })}
      <a href="/" target="_blank" className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
        <ExternalLink className="h-5 w-5" /> View public site
      </a>
      <div className="mt-auto border-t border-white/10 pt-3">
        <p className="px-3 text-xs text-white/50">Signed in as</p>
        <p className="px-3 text-sm font-semibold text-white">{username}</p>
        <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut className="h-5 w-5" /> Log out
        </button>
      </div>
    </nav>
  );

  const logo = (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-brand-400 text-night-900">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold leading-tight text-white">{brand}</p>
        <p className="text-[11px] text-white/50">Admin</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-night-800 lg:flex">
        {logo}
        {nav}
      </aside>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-night-800 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-5 w-5 text-gold-400" />
          <span className="font-bold">{brand}</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-night-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-3">
              {logo}
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status, paused }: { status: string; paused?: boolean }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    active: "bg-emerald-100 text-emerald-800",
    completed: "bg-sky-100 text-sky-800",
    archived: "bg-zinc-200 text-zinc-600",
    won: "bg-amber-100 text-amber-800",
    lost: "bg-slate-100 text-slate-600",
    redeemed: "bg-emerald-100 text-emerald-800",
    pending: "bg-violet-100 text-violet-700",
  };
  const label = status === "active" && paused ? "active · paused" : status;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] ?? "bg-slate-100"}`}>
      {label}
    </span>
  );
}
