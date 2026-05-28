import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loadState, saveState, type AppState, type TDNEntry, type QuaseFalhaEntry } from "@/lib/dashboard-data";

interface Ctx {
  state: AppState;
  addTDN: (e: Omit<TDNEntry, "id">) => void;
  addManyTDN: (entries: Omit<TDNEntry, "id">[]) => void;
  removeTDN: (id: string) => void;
  updateQF: (mes: string, ano: number, patch: Partial<QuaseFalhaEntry>) => void;
  setMeta: (m: number) => void;
  importJSON: (s: AppState) => void;
  reset: () => void;
}

const DashboardCtx = createContext<Ctx | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Always start with seed on first render (works for SSR + hydration parity).
  const [state, setState] = useState<AppState>(() => loadState());
  const hydrated = useRef(false);

  // After mount, re-read from localStorage to pick up any saved data and
  // avoid overwriting it on the first effect tick.
  useEffect(() => {
    const saved = loadState();
    setState(saved);
    // mark hydrated on the next tick so the save-effect below skips this run
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveState(state);
  }, [state]);

  const value: Ctx = {
    state,
    addTDN: (e) =>
      setState((s) => ({ ...s, tdn: [{ ...e, id: crypto.randomUUID() }, ...s.tdn] })),
    addManyTDN: (entries) =>
      setState((s) => ({ ...s, tdn: [...entries.map((e) => ({ ...e, id: crypto.randomUUID() })), ...s.tdn] })),
    removeTDN: (id) =>
      setState((s) => ({ ...s, tdn: s.tdn.filter((t) => t.id !== id) })),
    updateQF: (mes, ano, patch) =>
      setState((s) => ({
        ...s,
        quaseFalha: s.quaseFalha.map((q) =>
          q.mes === mes && q.ano === ano ? { ...q, ...patch } : q
        ),
      })),
    setMeta: (m) => setState((s) => ({ ...s, metaQuaseFalha: m })),
    importJSON: (s) => setState(s),
    reset: () => {
      localStorage.removeItem("chn-dashboard-v1");
      setState(loadState());
    },
  };

  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard fora do provider");
  return ctx;
}
