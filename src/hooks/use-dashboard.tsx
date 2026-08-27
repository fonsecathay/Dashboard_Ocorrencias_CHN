import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SHARED_ID = "shared";
const LOCAL_KEY = "chn-dashboard-data";

export interface TDNRecord {
  id: string | number;
  data: string;
  categoria: string;
  refeicao: string;
  publico: string;
  descricao: string;
  localizacao: string;
  unidade: string;
  plantao?: "Diurno" | "Noturno";
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
  updateTDN: (id: string | number, campos: Partial<Omit<TDNRecord, "id">>) => void;
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
  const [metaQuaseFalha, setMetaQuaseFalha] = useState<number>(0.65);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>("Carregando...");

  // evita salvar antes de carregar, e evita eco do próprio salvamento
  const loadedRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const stateRef = useRef<AppState>({ tdn, quaseFalha, metaQuaseFalha });
  stateRef.current = { tdn, quaseFalha, metaQuaseFalha };

  const cloudAvailable = true;

  function generateId() {
    try {
      if (typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function") {
        return (crypto as any).randomUUID();
      }
    } catch {
      /* fallback abaixo */
    }
    return "id_" + Math.random().toString(36).slice(2, 10);
  }

  const applyState = (s: Partial<AppState> | null | undefined) => {
    if (!s) return;
    applyingRemoteRef.current = true;
    setTdn(Array.isArray(s.tdn) ? s.tdn : []);
    setQuaseFalha(Array.isArray(s.quaseFalha) ? s.quaseFalha : []);
    setMetaQuaseFalha(typeof s.metaQuaseFalha === "number" ? s.metaQuaseFalha : 0.65);
  };

  // Carrega da nuvem (com cache local como fallback offline)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = typeof window !== "undefined" ? localStorage.getItem(LOCAL_KEY) : null;
      if (cached) {
        try {
          applyState(JSON.parse(cached));
        } catch {
          /* ignora cache inválido */
        }
      }

      const { data, error } = await supabase
        .from("dashboard_state")
        .select("state, updated_at")
        .eq("id", SHARED_ID)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(error);
        setSyncStatus("Erro ao carregar");
      } else if (data) {
        applyState(data.state as unknown as AppState);
        setCloudUpdatedAt(new Date(data.updated_at).toLocaleString("pt-BR"));
        setSyncStatus("Sincronizado");
      } else {
        setSyncStatus("Sincronizado");
      }

      loadedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Atualizações em tempo real de outros usuários
  useEffect(() => {
    const channel = supabase
      .channel("dashboard_state_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dashboard_state", filter: `id=eq.${SHARED_ID}` },
        (payload) => {
          const row = payload.new as { state?: AppState; updated_at?: string } | null;
          if (!row?.state) return;
          applyState(row.state);
          if (row.updated_at) setCloudUpdatedAt(new Date(row.updated_at).toLocaleString("pt-BR"));
          setSyncStatus("Sincronizado");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Salva automaticamente (local + nuvem, com debounce)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ tdn, quaseFalha, metaQuaseFalha }));
    }

    if (!loadedRef.current) return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }

    setSyncStatus("Salvando...");
    const timer = setTimeout(() => {
      void persist();
    }, 700);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdn, quaseFalha, metaQuaseFalha]);

  const persist = async () => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("dashboard_state")
      .upsert({ id: SHARED_ID, state: stateRef.current as any, updated_at: updatedAt }, { onConflict: "id" });

    if (error) {
      console.error(error);
      setSyncStatus("Erro ao sincronizar");
      throw error;
    }
    setSyncStatus("Sincronizado");
    setCloudUpdatedAt(new Date(updatedAt).toLocaleString("pt-BR"));
  };

  const reset = () => {
    applyingRemoteRef.current = false;
    setTdn([]);
    setQuaseFalha([]);
    setMetaQuaseFalha(0.65);
  };

  const addTDN = (record: Omit<TDNRecord, "id">) => {
    const newRecord = { ...record, id: generateId() };
    setTdn((prev) => [newRecord, ...prev]);
  };

  const addManyTDN = (records: Omit<TDNRecord, "id">[]) => {
    const newRecords = records.map((r) => ({ ...r, id: generateId() }));
    setTdn((prev) => [...newRecords, ...prev]);
  };

  const removeTDN = (id: string | number) => setTdn((prev) => prev.filter((item) => item.id !== id));
  const removeManyTDN = (ids: (string | number)[]) => setTdn((prev) => prev.filter((item) => !ids.includes(item.id)));
  const updateTDN = (id: string | number, campos: Partial<Omit<TDNRecord, "id">>) =>
    setTdn((prev) => prev.map((item) => (item.id === id ? { ...item, ...campos } : item)));

  const updateQF = (mes: string, ano: number, campos: Partial<QuaseFalhaRecord>) => {
    setQuaseFalha((prev) => {
      const existe = prev.some((q) => q.mes === mes && q.ano === ano);
      if (!existe) return [...prev, { mes, ano, percentual: null, ...campos }];
      return prev.map((q) => (q.mes === mes && q.ano === ano ? { ...q, ...campos } : q));
    });
  };

  const importJSON = (s: AppState) => {
    applyingRemoteRef.current = false;
    setTdn(s.tdn ?? []);
    setQuaseFalha(s.quaseFalha ?? []);
    setMetaQuaseFalha(s.metaQuaseFalha ?? 0.65);
  };

  const saveToCloud = async () => {
    setSyncStatus("Salvando...");
    await persist();
  };

  const loadFromCloud = async () => {
    setSyncStatus("Carregando...");
    const { data, error } = await supabase
      .from("dashboard_state")
      .select("state, updated_at")
      .eq("id", SHARED_ID)
      .maybeSingle();

    if (error) {
      setSyncStatus("Erro ao carregar");
      throw error;
    }
    if (data?.state) {
      applyState(data.state as unknown as AppState);
      setCloudUpdatedAt(new Date(data.updated_at).toLocaleString("pt-BR"));
    }
    setSyncStatus("Sincronizado");
  };

  const value: Ctx = {
    state: { tdn, quaseFalha, metaQuaseFalha },
    reset,
    addTDN,
    addManyTDN,
    removeTDN,
    removeManyTDN,
    updateTDN,
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
