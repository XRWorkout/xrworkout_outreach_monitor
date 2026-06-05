import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-zinc-950/72 shadow-[0_20px_80px_rgba(0,0,0,0.22)] backdrop-blur",
        className
      )}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "secondary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "success" | "ghost" }) {
  const variants = {
    primary: "border-cyan-400/60 bg-cyan-400 text-zinc-950 hover:bg-cyan-300",
    secondary: "border-white/10 bg-white/[0.06] text-zinc-100 hover:border-white/20 hover:bg-white/[0.09]",
    danger: "border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/15",
    success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15",
    ghost: "border-transparent bg-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white"
  };

  return (
    <button
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-10 w-full rounded-md border border-white/10 bg-black/25 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10",
        className
      )}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-36 w-full resize-y rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-10 w-full rounded-md border border-white/10 bg-black/25 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10",
        className
      )}
      {...props}
    />
  );
}

export function SoftBadge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.04] text-zinc-300",
    good: "border-emerald-300/20 bg-emerald-300/8 text-emerald-200",
    warn: "border-amber-300/20 bg-amber-300/8 text-amber-200",
    bad: "border-red-300/20 bg-red-300/8 text-red-200",
    info: "border-cyan-300/20 bg-cyan-300/8 text-cyan-200"
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-white/10 bg-white/[0.025] p-8 text-center">
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="mt-2 text-sm text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}
