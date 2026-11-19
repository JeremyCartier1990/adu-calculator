"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mx-auto mt-16 max-w-sm rounded-[28px] border border-line bg-surface p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        try {
          const response = await fetch("/api/admin/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const data = (await response.json()) as { ok: boolean; message?: string };
          if (data.ok) router.refresh();
          else setMessage(data.message ?? "Sign-in failed.");
        } catch {
          setMessage("Sign-in failed.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h1 className="font-display text-3xl">Team sign-in</h1>
      <p className="mt-2 text-sm text-ink-soft">Leads and saved ADU reports.</p>
      <label className="mt-6 block">
        <span className="text-sm font-medium">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-ink focus:ring-4 focus:ring-ink/10"
        />
      </label>
      {message ? (
        <p role="alert" className="mt-3 text-sm text-clay">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 min-h-12 w-full rounded-full bg-ink text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        router.refresh();
      }}
      className="text-sm font-medium text-ink-soft hover:text-ink"
    >
      Sign out
    </button>
  );
}
