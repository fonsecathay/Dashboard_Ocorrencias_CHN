import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Inicializa o cliente do Supabase puxando as variáveis do .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface TDNRecord {
  id: string | number;
  data: string;
  categoria: string;
  refeicao: string;
  publico: string;
  descricao: string;
  localizacao: string;
  unidade: string;
}

export interface QuaseFalhaRecord {
  mes: string;
  ano: number;
  percentual: number | null;
  naoConformidade?: string;
  causa?: string;
  acao?: string;
  prazo?: string;
  responsavel?: string;
  dataLimite?: string;
}

type AppState = { tdn: TDNRecord[]; quaseFalha: QuaseFalhaRecord[]; metaQuaseFalha: number };

interface Ctx {
  state: AppState;
  reset: () => void;
  addTDN: (r: Omit<TDNRecord, "id">) => void;
  addManyTDN: (rs: Omit<TDNRecord, "id">[]) => void;
  removeTDN: (id: string | number) => void;
  removeManyTDN: (ids: (string | number)[]) => void;
  updateQF: (mes: string, ano: number, campos: Partial<QuaseFalhaRecord>) => void;
  setMeta: (m: number) => void;
  importJSON: (s: AppState) => void;
  saveToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
  cloudAvailable: boolean;
  cloudUpdatedAt: string | null;
  syncStatus: string;
}

const DashboardCtx = createContext<Ctx | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [tdn, setTdn] = useState<TDNRecord[]>([]);
  const [quaseFalha, setQuaseFalha] = useState<QuaseFalhaRecord[]>([]);
  const [metaQuaseFalha, setMetaQuaseFalha] = useState<number>(0.8);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("Sincronizado");

  const cloudAvailable = !!supabase;

  function generateId() {
    try {
      if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
        return (crypto as any).randomUUID();
      }
      if (typeof crypto !== "undefined" && typeof (crypto as any).getRandomValues === "function") {
        const arr = new Uint8Array(16);
        (crypto as any).getRandomValues(arr);
        arr[6] = (arr[6] & 0x0f) | 0x40;
        arr[8] = (arr[8] & 0x3f) | 0x80;
        const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    } catch (e) {
      // ignore and fallback
    }
    return "id_" + Math.random().toString(36).slice(2, 10);
  }

  useEffect(() => {
    const localData = localStorage.getItem("chn-dashboard-data");
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        if (parsed.tdn) setTdn(parsed.tdn);
        if (parsed.quaseFalha) setQuaseFalha(parsed.quaseFalha);
        if (parsed.metaQuaseFalha) setMetaQuaseFalha(parsed.metaQuaseFalha);
      } catch (e) {
        console.error("Erro ao ler localStorage", e);
      }
    }
  }, []);

  useEffect(() => {
    const payload = { tdn, quaseFalha, metaQuaseFalha };
    localStorage.setItem("chn-dashboard-data", JSON.stringify(payload));
    try { console.debug("Saved dashboard to localStorage", payload); } catch (e) { console.debug("localStorage save failed", e); }
  }, [tdn, quaseFalha, metaQuaseFalha]);

  const reset = () => {
    setTdn([]);
    setQuaseFalha([]);
    setMetaQuaseFalha(0.8);
    localStorage.removeItem("chn-dashboard-data");
  };

  const addTDN = (record: Omit<TDNRecord, "id">) => {
    const newRecord = { ...record, id: generateId() };
    console.debug("addTDN called", newRecord);
    setTdn((prev) => [newRecord, ...prev]);
  };

  const addManyTDN = (records: Omit<TDNRecord, "id">[]) => {
    const newRecords = records.map((r) => ({ ...r, id: generateId() }));
    setTdn((prev) => [...newRecords, ...prev]);
  };

  const removeTDN = (id: string | number) => setTdn((prev) => prev.filter((item) => item.id !== id));
  const removeManyTDN = (ids: (string | number)[]) => setTdn((prev) => prev.filter((item) => !ids.includes(item.id)));

  const updateQF = (mes: string, ano: number, campos: Partial<QuaseFalhaRecord>) => {
    setQuaseFalha((prev) => {
      const existe = prev.some((q) => q.mes === mes && q.ano === ano);
      if (!existe) return [...prev, { mes, ano, percentual: null, ...campos }];
      return prev.map((q) => (q.mes === mes && q.ano === ano ? { ...q, ...campos } : q));
    });
  };

  const importJSON = (s: AppState) => {
    setTdn(s.tdn ?? []);
    setQuaseFalha(s.quaseFalha ?? []);
    setMetaQuaseFalha(s.metaQuaseFalha ?? 0.8);
  };

  // Supabase operations
  const saveToCloud = async () => {
    if (!supabase) return;
    setSyncStatus("Salvando...");
    try {
      // Upsert a single row with key 'shared' containing whole state
      const payload = { id: "shared", state: { tdn, quaseFalha, metaQuaseFalha }, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("dashboard_state").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setSyncStatus("Sincronizado");
      setCloudUpdatedAt(new Date().toLocaleString());
    } catch (err) {
      console.error(err);
      setSyncStatus("Erro ao sincronizar");
      throw err;
    }
  };

  const loadFromCloud = async () => {
    if (!supabase) return;
    setSyncStatus("Carregando...");
    try {
      const { data, error } = await supabase.from("dashboard_state").select("state, updated_at").eq("id", "shared").single();
      if (error) {
        setSyncStatus("Erro ao carregar");
        throw error;
      }
      if (data?.state) {
        importJSON(data.state as AppState);
        setCloudUpdatedAt(data.updated_at ?? new Date().toLocaleString());
        setSyncStatus("Sincronizado");
      }
    } catch (err) {
      console.error(err);
      setSyncStatus("Erro ao carregar");
      throw err;
    }
  };

  const value: Ctx = {
    state: { tdn, quaseFalha, metaQuaseFalha },
    reset,
    addTDN,
    addManyTDN,
    removeTDN,
    removeManyTDN,
    updateQF,
    setMeta: setMetaQuaseFalha,
    importJSON,
    saveToCloud,
    loadFromCloud,
    cloudAvailable,
    cloudUpdatedAt,
    syncStatus,
  };

  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}