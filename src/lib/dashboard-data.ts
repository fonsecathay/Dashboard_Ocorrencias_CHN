// Tipos e armazenamento local (localStorage) dos indicadores CHN.
// Pensado para alimentação manual mensal com import/export JSON.

export type Categoria =
  | "Qualidade"
  | "Falta de item"
  | "Dieta Errada"
  | "Atraso"
  | "Higiene"
  | "Temperatura"
  | "Outros";

export type Refeicao =
  | "Desjejum"
  | "Avulso"
  | "Almoço"
  | "Lanche"
  | "Jantar"
  | "Ceia"
  | "Refeição não informada";

export type PublicoAlvo = "Paciente" | "Acompanhante" | "Colaborador";

export type Unidade = "I" | "II" | "III" | "IV" | "V" | "-";

export interface TDNEntry {
  id: string;
  data: string; // ISO yyyy-mm-dd
  categoria: Categoria;
  refeicao: Refeicao;
  publico: PublicoAlvo;
  descricao: string;
  localizacao: string;
  unidade: Unidade;
}

export const MESES = [
  "JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
  "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO",
] as const;
export type MesNome = (typeof MESES)[number];

export interface QuaseFalhaEntry {
  mes: MesNome;
  ano: number;
  percentual: number | null; // 0..1 (ex: 0.7507)
  naoConformidade?: string;
  causa?: string;
  acao?: string;
  prazo?: string;
  responsavel?: string;
  dataLimite?: string;
}

export interface AppState {
  tdn: TDNEntry[];
  quaseFalha: QuaseFalhaEntry[];
  metaQuaseFalha: number; // 0..1
}

const STORAGE_KEY = "chn-dashboard-v1";

const seed: AppState = {
  metaQuaseFalha: 0.65,
  quaseFalha: [
    { mes: "JANEIRO", ano: 2026, percentual: 0.7507 },
    ...(["FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"] as MesNome[])
      .map((m) => ({ mes: m, ano: 2026, percentual: null })),
  ],
  tdn: [
    ["2026-01-02","Qualidade","Almoço","Paciente","Frango enviado com pedaço de plástico","715","IV"],
    ["2026-01-02","Qualidade","Almoço","Paciente","Carne estava dura","714","IV"],
    ["2026-01-03","Falta de item","Desjejum","Acompanhante","Água quente, café e chá","805","III"],
    ["2026-01-03","Dieta Errada","Desjejum","Paciente","Recebeu café mesmo estando sem café","UTG I LT 05","I"],
    ["2026-01-04","Atraso","Jantar","Paciente","Atraso na entrega","817","IV"],
    ["2026-01-05","Dieta Errada","Almoço","Paciente","Dieta sem sal recebendo sachê de sal","502","III"],
    ["2026-01-06","Dieta Errada","Almoço","Paciente","Arroz integral trocado por comum","Day Clinic","-"],
    ["2026-01-06","Qualidade","Desjejum","Paciente","Mingau frio","824","IV"],
    ["2026-01-08","Dieta Errada","Desjejum","Paciente","Intolerante à lactose recebeu leite comum","Cardio 1 LT 10","I"],
    ["2026-01-09","Falta de item","Desjejum","Paciente","Falta de leite","UTG I LT 05","I"],
    ["2026-01-11","Qualidade","Almoço","Paciente","Presença de osso (paciente idoso)","632","I"],
    ["2026-01-12","Qualidade","Desjejum","Paciente","Tapioca dura e ressecada","Cardio 1 LT 13","I"],
    ["2026-01-13","Dieta Errada","Desjejum","Paciente","Recebeu polvilho em dia sem glúten","Cardio 1 LT 13","I"],
    ["2026-01-14","Dieta Errada","Desjejum","Paciente","Dieta semilíquida recebeu pão","Neuro 11","-"],
    ["2026-01-15","Dieta Errada","Almoço","Paciente","Vegetariana recebeu sopa com frango","809","III"],
    ["2026-01-16","Qualidade","Almoço","Paciente","Macarrão duro","612","V"],
    ["2026-01-17","Dieta Errada","Almoço","Paciente","Dieta semilíquida recebeu ameixa inteira","UTG II LT 29","II"],
    ["2026-01-18","Dieta Errada","Almoço","Paciente","Paciente não come peixe e recebeu","506","I"],
    ["2026-01-20","Qualidade","Almoço","Paciente","Proteína dura","Cardio II LT 8","II"],
    ["2026-01-21","Qualidade","Desjejum","Paciente","Símbolo de erro: apenas arroz enviado","623","V"],
    ["2026-01-22","Dieta Errada","Almoço","Paciente","Cardápio pastosa recebeu sopa","619","V"],
    ["2026-01-23","Falta de item","Desjejum","Paciente","Recebeu leite sem a água","802","IV"],
  ].map((r, i) => ({
    id: `seed-${i}`,
    data: r[0],
    categoria: r[1] as Categoria,
    refeicao: r[2] as Refeicao,
    publico: r[3] as PublicoAlvo,
    descricao: r[4],
    localizacao: r[5],
    unidade: r[6] as Unidade,
  })),
};

export function loadState(): AppState {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    return JSON.parse(raw) as AppState;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return seed;
  }
}

export function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}
