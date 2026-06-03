import * as XLSX from "xlsx";
import type { Categoria, PublicoAlvo, Refeicao, TDNEntry, Unidade } from "./dashboard-data";

const CATS: Categoria[] = ["Qualidade","Falta de item","Dieta Errada","Atraso","Higiene","Temperatura","Outros"];
const REFS: Refeicao[] = ["Desjejum","Avulso","Almoço","Lanche","Jantar","Ceia","Refeição não informada"];
const PUBS: PublicoAlvo[] = ["Paciente","Acompanhante","Colaborador"];
const UNIS: Unidade[] = ["I","II","III","IV","V","-"];

const norm = (s: any) => String(s ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function pick<T extends string>(val: any, opts: T[], fallback: T): T {
  const v = norm(val);
  if (!v) return fallback;
  const exact = opts.find((o) => norm(o) === v);
  if (exact) return exact;
  const partial = opts.find((o) => v.includes(norm(o)) || norm(o).includes(v));
  return (partial ?? fallback) as T;
}

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (br) {
    let [, d, m, y] = br;
    if (y.length === 2) y = "20" + y;
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

const FIELD_ALIASES: Record<string, string[]> = {
  data: ["data","date","dia"],
  categoria: ["categoria","tipo","ocorrencia","ocorrência","classificacao"],
  refeicao: ["refeicao","refeição","meal"],
  publico: ["publico","público","alvo","publico-alvo","público-alvo"],
  descricao: ["descricao","descrição","observacao","observação","relato","detalhe"],
  localizacao: ["localizacao","localização","local","leito","quarto","setor"],
  unidade: ["unidade","un","torre","ala"],
};

function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (map[field] != null) continue;
      if (aliases.some((a) => n === a || n.includes(a))) map[field] = i;
    }
  });
  return map;
}

export async function parseSpreadsheet(file: File): Promise<Omit<TDNEntry,"id">[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const out: Omit<TDNEntry,"id">[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    if (!rows.length) continue;
    // Find header row (first row with any text matching aliases)
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const m = mapHeaders(rows[i].map(String));
      if (m.data != null || m.descricao != null || m.categoria != null) { headerIdx = i; break; }
    }
    const headers = (rows[headerIdx] ?? []).map(String);
    const cols = mapHeaders(headers);
    if (cols.data == null && cols.descricao == null) continue;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => c === "" || c == null)) continue;
      const data = parseDate(r[cols.data ?? -1]);
      const descricao = String(r[cols.descricao ?? -1] ?? "").trim();
      if (!data && !descricao) continue;
      out.push({
        data: data ?? new Date().toISOString().slice(0, 10),
        categoria: pick(r[cols.categoria ?? -1], CATS, "Outros"),
        refeicao: pick(r[cols.refeicao ?? -1], REFS, "Almoço"),
        publico: pick(r[cols.publico ?? -1], PUBS, "Paciente"),
        descricao,
        localizacao: String(r[cols.localizacao ?? -1] ?? "").trim(),
        unidade: pick(r[cols.unidade ?? -1], UNIS, "-"),
      });
    }
  }
  return out;
}
