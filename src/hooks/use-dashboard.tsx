import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => { saveState(state); }, [state]);

  const value: Ctx = {
    state,
    addTDN: (e) =>
      setState((s) => ({ ...s, tdn: [{ ...e, id: crypto.randomUUID() }, ...s.tdn] })),
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
