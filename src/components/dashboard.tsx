import { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useDashboard } from "@/hooks/use-dashboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ReferenceLine, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { Download, Plus, Trash2, AlertTriangle, TrendingUp, Clock, Users, Building2, FileSpreadsheet, Moon, Sun } from "lucide-react";
import logo from "@/assets/logo-chn.png";
import { MESES, type Categoria, type PublicoAlvo, type Refeicao, type Unidade } from "@/lib/dashboard-data";
import { parseSpreadsheet } from "@/lib/spreadsheet-import";

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("chn-theme");
    const isDark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("chn-theme", next ? "dark" : "light");
      return next;
    });
  };
  return { dark, toggle };
}

const CATEGORIAS: Categoria[] = ["Qualidade", "Falta de item", "Dieta Errada", "Atraso", "Higiene", "Temperatura", "Outros"];
const REFEICOES: Refeicao[] = ["Desjejum", "Avulso", "Almoço", "Lanche", "Jantar", "Ceia"];
const PUBLICOS: PublicoAlvo[] = ["Paciente", "Acompanhante", "Colaborador"];
const UNIDADES: Unidade[] = ["I", "II", "III", "IV", "V", "-"];

const PALETTE = ["#5B2A86", "#7B3FA0", "#A56EBE", "#3FA34D", "#4B3F72", "#C094D6", "#2A1A4A"];

export function Dashboard() {
  const { state, reset, addManyTDN } = useDashboard();
  const [anoSel, setAnoSel] = useState<number>(2026);
  const [mesSel, setMesSel] = useState<string>("todos");
  const { dark, toggle } = useDarkMode();

  const anos = useMemo(() => {
    const s = new Set<number>([anoSel, new Date().getFullYear(), 2026]);
    state.tdn.forEach((t) => { if (t.data) s.add(Number(t.data.split("-")[0])); });
    state.quaseFalha.forEach((q) => s.add(q.ano));
    return Array.from(s).sort();
  }, [state, anoSel]);

  const exportar = () => {
    const wb = XLSX.utils.book_new();

    // Aba TDN
    const tdnRows = state.tdn.map((t) => {
      const [y, m, d] = t.data.split("-");
      return {
        Data: `${d}/${m}/${y}`,
        Categoria: t.categoria,
        Refeição: t.refeicao,
        "Público-alvo": t.publico,
        Descrição: t.descricao,
        Localização: t.localizacao,
        Unidade: t.unidade,
      };
    });
    const wsTdn = XLSX.utils.json_to_sheet(tdnRows);
    wsTdn["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 50 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsTdn, "TDN");

    // Aba Quase-Falha
    const qfRows = state.quaseFalha.map((q) => ({
      Mês: q.mes,
      Ano: q.ano,
      "Percentual (%)": q.percentual != null ? +(q.percentual * 100).toFixed(2) : "",
      "Não conformidade": q.naoConformidade ?? "",
      Causa: q.causa ?? "",
      Ação: q.acao ?? "",
      Prazo: q.prazo ?? "",
      Responsável: q.responsavel ?? "",
      "Data limite": q.dataLimite ?? "",
    }));
    const wsQf = XLSX.utils.json_to_sheet(qfRows);
    wsQf["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsQf, "Quase-Falha");

    // Aba Meta
    const wsMeta = XLSX.utils.json_to_sheet([{ "Meta Quase-Falha (%)": +(state.metaQuaseFalha * 100).toFixed(2) }]);
    XLSX.utils.book_append_sheet(wb, wsMeta, "Configurações");

    XLSX.writeFile(wb, `chn-dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Planilha exportada com sucesso");
  };

  const importarPlanilha = async (file: File) => {
    try {
      const entries = await parseSpreadsheet(file);
      const validEntries = entries.filter((e: any) => e && e.data && e.categoria && e.descricao);
      if (!validEntries.length) {
        toast.error("Nenhum registro válido encontrado na planilha");
        return;
      }
      addManyTDN(validEntries);
      toast.success(`${validEntries.length} registros importados da planilha`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao ler a planilha. Verifique a estrutura do arquivo.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-md p-1.5 shadow-sm">
              <img src={logo} alt="CHN Rede Américas" className="h-10 w-auto" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Dashboard de Ocorrências</h1>
              <p className="text-sm text-sidebar-foreground/70">Indicadores de Nutrição e Dietética</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(anoSel)} onValueChange={(v) => setAnoSel(Number(v))}>
              <SelectTrigger className="w-28 bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={mesSel} onValueChange={setMesSel}>
              <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Ano inteiro</SelectItem>
                {MESES.map((m, i) => <SelectItem key={m} value={String(i)}>{m.charAt(0) + m.slice(1).toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="secondary" size="icon" onClick={toggle} aria-label="Alternar tema" title={dark ? "Modo claro" : "Modo escuro"}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="secondary" size="sm" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar Excel</Button>
            <label>
              <input type="file" accept=".ods,.xlsx,.xls,.csv,application/vnd.oasis.opendocument.spreadsheet,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importarPlanilha(f); e.target.value = ""; }} />
              <Button variant="secondary" size="sm" asChild><span><FileSpreadsheet className="h-4 w-4 mr-1" />Importar planilha</span></Button>
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <Tabs defaultValue="visao" className="space-y-6">
          <TabsList>
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="tdn">Termo de Notificação</TabsTrigger>
            <TabsTrigger value="qf">Indicador Quase-Falha</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao"><VisaoGeral ano={anoSel} mes={mesSel === "todos" ? null : Number(mesSel)} /></TabsContent>
          <TabsContent value="tdn"><TDNView ano={anoSel} mes={mesSel === "todos" ? null : Number(mesSel)} /></TabsContent>
          <TabsContent value="qf"><QFView ano={anoSel} /></TabsContent>
          <TabsContent value="config">
            <Card>
              <CardHeader><CardTitle>Configurações</CardTitle><CardDescription>Gerenciar dados do dashboard.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Os dados são salvos automaticamente no navegador. Use Exportar/Importar para backup ou para mover entre dispositivos.</p>
                <Button variant="destructive" onClick={() => { if (confirm("Restaurar dados iniciais? Isso apaga todos os registros atuais permanentemente.")) { reset(); toast.success("Dados restaurados."); } }}>
                  <Trash2 className="h-4 w-4 mr-1" />Restaurar dados iniciais
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function KPI({ title, value, hint, icon: Icon, tone = "default" }: { title: string; value: string; hint?: string; icon: React.ElementType; tone?: "default" | "good" | "bad" }) {
  const toneCls = tone === "good" ? "text-accent-foreground bg-accent/30" : tone === "bad" ? "text-destructive bg-destructive/10" : "text-primary bg-secondary";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold mt-1 tracking-tight">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`rounded-lg p-2 ${toneCls}`}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function VisaoGeral({ ano, mes }: { ano: number; mes: number | null }) {
  const { state } = useDashboard();

  const tdnAno = useMemo(() => {
    return state.tdn.filter((t) => t.data && Number(t.data.split("-")[0]) === ano);
  }, [state.tdn, ano]);

  const tdnFiltro = useMemo(() => {
    if (mes == null) return tdnAno;
    return tdnAno.filter((t) => {
      const partes = t.data.split("-");
      return partes.length >= 2 && (Number(partes[1]) - 1) === mes;
    });
  }, [tdnAno, mes]);

  const periodoLabel = mes == null ? `${ano}` : `${MESES[mes].charAt(0) + MESES[mes].slice(1).toLowerCase()} / ${ano}`;

  const porMes = useMemo(() => {
    const acc = MESES.map((m, i) => ({ mes: m.slice(0, 3), idx: i, total: 0 }));
    tdnAno.forEach((t) => {
      const partes = t.data.split("-");
      if (partes.length >= 2) {
        const m = Number(partes[1]) - 1;
        if (acc[m]) acc[m].total++;
      }
    });
    return acc;
  }, [tdnAno]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    tdnFiltro.forEach((t) => map.set(t.categoria, (map.get(t.categoria) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [tdnFiltro]);

  const qfAno = state.quaseFalha.filter((q) => q.ano === ano);
  const qfChart = qfAno.map((q) => ({ mes: q.mes.slice(0, 3), valor: q.percentual != null ? +(q.percentual * 100).toFixed(2) : null }));
  const ultimoQF = [...qfAno].reverse().find((q) => q.percentual != null);
  const meta = state.metaQuaseFalha * 100;

  const atrasos = tdnFiltro.filter((t) => t.categoria === "Atraso").length;
  const total = tdnFiltro.length;

  const porPublico = useMemo(() => {
    const map = new Map<string, number>();
    tdnFiltro.forEach((t) => map.set(t.publico, (map.get(t.publico) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [tdnFiltro]);

  const porUnidade = useMemo(() => {
    const map = new Map<string, number>();
    tdnFiltro.forEach((t) => {
      const key = t.unidade && t.unidade !== "-" ? `Unidade ${t.unidade}` : "Sem unidade";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([unidade, total]) => ({ unidade, total }))
      .sort((a, b) => b.total - a.total);
  }, [tdnFiltro]);

  const unidadeTop = porUnidade[0];
  const publicoTop = [...porPublico].sort((a, b) => b.value - a.value)[0];

  const porDia = useMemo(() => {
    const map = new Map<string, number>();
    tdnFiltro.forEach((t) => map.set(t.data, (map.get(t.data) ?? 0) + 1));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, total]) => {
        const partes = data.split("-");
        const diaStr = partes[2] ?? "";
        const mIdx = Number(partes[1]) - 1;
        const label = `${diaStr}/${MESES[mIdx]?.slice(0, 3) ?? ""}`;
        return { data, label, total };
      });
  }, [tdnFiltro]);

  const diasComRegistro = porDia.length;
  const mediaDia = diasComRegistro ? (tdnFiltro.length / diasComRegistro).toFixed(1) : "0";
  const diaPico = porDia.reduce((a, b) => (b.total > (a?.total ?? 0) ? b : a), porDia[0]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPI title={mes == null ? "Total de ocorrências no ano" : "Total de ocorrências no mês"} value={String(total)} hint={periodoLabel} icon={AlertTriangle} tone="bad" />
        <KPI title="Atrasos" value={String(atrasos)} hint={total ? `${((atrasos/total)*100).toFixed(1)}% do total` : "—"} icon={Clock} tone="bad" />
        <KPI title="Público mais afetado" value={publicoTop?.name ?? "—"} hint={publicoTop ? `${publicoTop.value} ocorrências` : "sem dados"} icon={Users} />
        <KPI title="Unidade com mais ocorrências" value={unidadeTop?.unidade.replace("Unidade ","Un. ") ?? "—"} hint={unidadeTop ? `${unidadeTop.total} ocorrências` : "sem dados"} icon={Building2} tone="bad" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KPI title="Quase-Falha (último mês)" value={ultimoQF?.percentual != null ? `${(ultimoQF.percentual*100).toFixed(2)}%` : "—"} hint={ultimoQF ? `${ultimoQF.mes} · meta ≥ ${meta}%` : "sem dados"} icon={TrendingUp} tone={ultimoQF && ultimoQF.percentual! >= state.metaQuaseFalha ? "good" : "bad"} />
        <KPI title="Média de registros / dia" value={mediaDia} hint={`${diasComRegistro} dia(s) com ocorrência`} icon={TrendingUp} />
        <KPI title="Dia com mais ocorrências" value={diaPico ? diaPico.label : "—"} hint={diaPico ? `${diaPico.total} registro(s)` : "sem dados"} icon={AlertTriangle} tone="bad" />
      </div>

      <Card>
        <CardHeader><CardTitle>Registros por dia</CardTitle><CardDescription>Evolução diária — {ano}</CardDescription></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill={PALETTE[2]} radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Total de ocorrências por mês</CardTitle><CardDescription>{ano}</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill={PALETTE[0]} radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Por categoria</CardTitle><CardDescription>Distribuição dos registros</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porCategoria} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${d.value}`}>
                  {porCategoria.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(value: any, name: any) => [`${value} ocorrências`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ocorrências por unidade</CardTitle><CardDescription>Ranking — {ano}</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porUnidade} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="unidade" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill={PALETTE[1]} radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Público-alvo afetado</CardTitle><CardDescription>Distribuição de impacto</CardDescription></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porPublico} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${d.value}`}>
                  {porPublico.map((_, i) => <Cell key={i} fill={PALETTE[(i+2) % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={(value: any, name: any) => [`${value} registros`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Indicador Quase-Falha</CardTitle><CardDescription>Meta ≥ {meta}% — evolução mensal {ano}</CardDescription></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={qfChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => v != null ? `${v}%` : "—"} />
              <ReferenceLine y={meta} stroke={PALETTE[3]} strokeDasharray="5 5" label={{ value: `Meta ${meta}%`, fill: PALETTE[3], fontSize: 12 }} />
              <Line type="monotone" dataKey="valor" stroke={PALETTE[0]} strokeWidth={3} dot={{ r: 5, fill: PALETTE[0] }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function TDNView({ ano, mes }: { ano: number; mes: number | null }) {
  const { state, addTDN, removeTDN } = useDashboard();
  const [open, setOpen] = useState(false);
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  const itens = useMemo(() => {
    return state.tdn
      .filter((t) => t.data && Number(t.data.split("-")[0]) === ano)
      .filter((t) => {
        if (mes == null) return true;
        const partes = t.data.split("-");
        return partes.length >= 2 && (Number(partes[1]) - 1) === mes;
      })
      .filter((t) => filtroCat === "todas" || t.categoria === filtroCat)
      .filter((t) => !busca || t.descricao.toLowerCase().includes(busca.toLowerCase()) || t.localizacao.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [state.tdn, ano, mes, filtroCat, busca]);

  const periodo = mes == null ? `${ano}` : `${MESES[mes].charAt(0) + MESES[mes].slice(1).toLowerCase()} / ${ano}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Termo de Notificação</CardTitle>
            <CardDescription>{itens.length} registros em {periodo}</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo registro</Button></DialogTrigger>
            <NovoTDNDialog onSave={(e) => { addTDN(e); setOpen(false); toast.success("Registro adicionado com sucesso"); }} />
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Input placeholder="Buscar por descrição ou local…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
            <Select value={filtroCat} onValueChange={setFiltroCat}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Refeição</TableHead>
                  <TableHead>Público</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro encontrado para este período.</TableCell></TableRow>}
                {itens.map((t) => {
                  const [anoStr, mesStr, diaStr] = t.data.split("-");
                  const dataFormatada = `${diaStr}/${mesStr}/${anoStr}`;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{dataFormatada}</TableCell>
                      <TableCell><Badge variant="secondary">{t.categoria}</Badge></TableCell>
                      <TableCell>{t.refeicao}</TableCell>
                      <TableCell>{t.publico}</TableCell>
                      <TableCell className="max-w-md">{t.descricao}</TableCell>
                      <TableCell>{t.localizacao}</TableCell>
                      <TableCell>{t.unidade}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Deseja realmente remover este termo de notificação?")) removeTDN(t.id); }} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NovoTDNDialog({ onSave }: { onSave: (e: any) => void }) {
  const camposIniciais = {
    data: new Date().toISOString().slice(0, 10),
    categoria: "Qualidade" as Categoria,
    refeicao: "Almoço" as Refeicao,
    publico: "Paciente" as PublicoAlvo,
    descricao: "",
    localizacao: "",
    unidade: "I" as Unidade,
  };

  const [form, setForm] = useState(camposIniciais);

  const handleSalvar = () => {
    if (!form.descricao.trim()) {
      toast.error("O campo descrição é obrigatório");
      return;
    }
    onSave(form);
    setForm(camposIniciais);
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Novo Termo de Notificação</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
          <div><Label>Unidade</Label>
            <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v as Unidade })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Categoria</Label>
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v as Categoria })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Refeição</Label>
            <Select value={form.refeicao} onValueChange={(v) => setForm({ ...form, refeicao: v as Refeicao })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REFEICOES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Público-alvo</Label>
          <Select value={form.publico} onValueChange={(v) => setForm({ ...form, publico: v as PublicoAlvo })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PUBLICOS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Localização (leito/setor)</Label><Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} /></div>
        <div><Label>Descrição</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={handleSalvar} className="w-full sm:w-auto">Salvar</Button></DialogFooter>
    </DialogContent>
  );
}

function QFView({ ano }: { ano: number }) {
  const { state, updateQF, setMeta } = useDashboard();
  const linhas = state.quaseFalha.filter((q) => q.ano === ano);
  const meta = state.metaQuaseFalha;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Indicador Quase-Falha — {ano}</CardTitle>
          <CardDescription>Edição mensal direta na tabela. Meta atual: {(meta * 100).toFixed(0)}%</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Label className="text-sm">Meta (%)</Label>
            <Input type="number" className="w-24" min={0} max={100} step={1} value={Math.round(meta * 100)} onChange={(e) => setMeta(Math.max(0, Math.min(100, Number(e.target.value))) / 100)} />
          </div>
          <div className="rounded-md border overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Mês</TableHead>
                  <TableHead className="w-28">%</TableHead>
                  <TableHead className="w-36">Status</TableHead>
                  <TableHead>Não-conformidade</TableHead>
                  <TableHead>Causa</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="w-28">Prazo</TableHead>
                  <TableHead className="w-48">Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((q) => {
                  const ok = q.percentual != null && q.percentual >= meta;
                  return (
                    <TableRow key={q.mes}>
                      <TableCell className="font-medium whitespace-nowrap">{q.mes}</TableCell>
                      <TableCell>
                        <QFInputDebounced type="number" step="0.01" min="0" max="100" className="w-24" value={q.percentual != null ? String(+(q.percentual * 100).toFixed(2)) : ""} onSave={(v) => updateQF(q.mes, ano, { percentual: v === "" ? null : Number(v) / 100 })} />
                      </TableCell>
                      <TableCell>
                        {q.percentual == null ? <Badge variant="outline">—</Badge>
                          : ok ? <Badge className="bg-accent text-accent-foreground">Meta atingida</Badge>
                          : <Badge variant="destructive">Abaixo da meta</Badge>}
                      </TableCell>
                      <TableCell><QFTextareaDebounced value={q.naoConformidade ?? ""} onSave={(v) => updateQF(q.mes, ano, { naoConformidade: v })} /></TableCell>
                      <TableCell><QFTextareaDebounced value={q.causa ?? ""} onSave={(v) => updateQF(q.mes, ano, { causa: v })} /></TableCell>
                      <TableCell><QFTextareaDebounced value={q.acao ?? ""} onSave={(v) => updateQF(q.mes, ano, { acao: v })} /></TableCell>
                      <TableCell><QFInputDebounced className="w-24" value={q.prazo ?? ""} onSave={(v) => updateQF(q.mes, ano, { prazo: v })} placeholder="30 dias" /></TableCell>
                      <TableCell><QFInputDebounced className="w-44" value={q.responsavel ?? ""} onSave={(v) => updateQF(q.mes, ano, { responsavel: v })} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {linhas.filter(q => q.percentual != null).map((q) => (
          <Card key={q.mes}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{q.mes}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-semibold">{(q.percentual! * 100).toFixed(2)}%</span>
                <span className="text-xs text-muted-foreground">meta {(meta * 100).toFixed(0)}%</span>
              </div>
              <Progress value={Math.min(100, q.percentual! * 100)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* Inputs com estado local para evitar lag de digitação na tabela Quase-Falha */
interface DebouncedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onSave: (v: string) => void;
}

function QFInputDebounced({ value, onSave, ...props }: DebouncedInputProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return <Input {...props} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => onSave(local)} />;
}

interface DebouncedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value: string;
  onSave: (v: string) => void;
}

function QFTextareaDebounced({ value, onSave, ...props }: DebouncedTextareaProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return <Textarea rows={1} {...props} className="min-w-[180px] resize-y" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => onSave(local)} />;
}
