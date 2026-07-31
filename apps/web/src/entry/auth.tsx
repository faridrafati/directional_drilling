/**
 * Sign-in state for the report-entry module.
 *
 * The rest of the app is unauthenticated; only this page has a session. The
 * token lives in localStorage (see client.ts) and /entry/auth/me is the source
 * of truth for who you are and which wells you may report on — a token whose
 * user was deactivated or unassigned resolves to a 401 / empty well list on the
 * next call rather than a stale local copy.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entryApi, getToken, setToken, onTokenChange, type EntryUser, type EntryWell } from "./client.js";

interface Me { user: EntryUser; wells: EntryWell[] }

interface AuthValue {
  user: EntryUser | null;
  wells: EntryWell[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  /** Re-read /entry/auth/me (after a password change or an admin edit). */
  refresh: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function EntryAuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(getToken());
  const qc = useQueryClient();

  // Keep React in step with the module-level token (a 401 clears it from
  // inside a fetch, with no component involved).
  useEffect(() => onTokenChange(setTok), []);

  const meQ = useQuery({
    queryKey: ["entry", "me", token],
    queryFn: () => entryApi.get<Me>("/auth/me"),
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
  });

  const signIn = useCallback(async (username: string, password: string) => {
    const r = await entryApi.post<{ token: string; user: EntryUser }>("/auth/login", { username, password });
    setToken(r.token);
    await qc.invalidateQueries({ queryKey: ["entry"] });
  }, [qc]);

  const signOut = useCallback(() => {
    setToken(null);
    qc.removeQueries({ queryKey: ["entry"] });
  }, [qc]);

  const value: AuthValue = {
    user: token ? meQ.data?.user ?? null : null,
    wells: meQ.data?.wells ?? [],
    loading: !!token && meQ.isLoading,
    signIn,
    signOut,
    refresh: () => { void qc.invalidateQueries({ queryKey: ["entry", "me"] }); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntryAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEntryAuth must be used within an EntryAuthProvider");
  return v;
}

/** Sign-in card shown in place of the page until the company man is known. */
export function SignInCard() {
  const { signIn } = useEntryAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await signIn(username.trim(), password); }
    catch (err) { setError(String((err as Error).message)); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex-1 min-h-0 flex items-start justify-center pt-10">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 tracking-tight">Rig sign-in</h3>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          Company men sign in to file the daily drilling report for the well they are assigned to.
        </p>
        <label className="block mb-3">
          <span className="text-xs text-gray-600">User name</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username"
            className="mt-1 w-full h-9 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="block mb-4">
          <span className="text-xs text-gray-600">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="mt-1 w-full h-9 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>
        {error && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}
        <button type="submit" disabled={busy || !username || !password}
          className="w-full h-9 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

/** Forced on first login and available any time from the header. */
export function ChangePasswordCard({ forced, onDone }: { forced?: boolean; onDone: () => void }) {
  const { refresh } = useEntryAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) { setError("the two new passwords don't match"); return; }
    setBusy(true); setError(null);
    try {
      await entryApi.post("/auth/password", { currentPassword: current, newPassword: next });
      refresh();
      onDone();
    } catch (err) { setError(String((err as Error).message)); }
    finally { setBusy(false); }
  }

  const input = "mt-1 w-full h-9 px-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">{forced ? "Set a new password" : "Change password"}</h3>
      {forced && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
        This account still has the password an admin gave it — choose your own before filing reports.
      </p>}
      <label className="block mt-3"><span className="text-xs text-gray-600">Current password</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={input} /></label>
      <label className="block mt-3"><span className="text-xs text-gray-600">New password (min 6 characters)</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={input} /></label>
      <label className="block mt-3 mb-4"><span className="text-xs text-gray-600">Repeat new password</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className={input} /></label>
      {error && <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !current || next.length < 6}
          className="flex-1 h-9 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300">
          {busy ? "Saving…" : "Save password"}
        </button>
        {!forced && <button type="button" onClick={onDone} className="h-9 px-3 rounded-md border border-gray-300 bg-white text-gray-700 text-sm hover:bg-gray-50 transition-colors duration-150">Cancel</button>}
      </div>
    </form>
  );
}
