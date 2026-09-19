import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Trello, Megaphone, ShieldAlert, FileText, Users,
  CheckSquare, BarChart3, Settings, Plus, X, Trash2, Pencil,
  GripVertical, ChevronDown, ChevronRight, Download, Search,
  Sparkles, Clock, HelpCircle, Filter as FilterIcon, Check, AlertCircle, Copy, Menu
} from "lucide-react";

/* ============================================================
   CONSTANTS
============================================================ */
const STORAGE_KEY = "gaid_crm_state_v1";

const STATUS_LIST = [
  "Novo", "Contato Enviado", "Respondeu", "Qualificado",
  "Oferta Enviada", "Comprou", "Upsell", "Não Comprou",
];
const FUNNEL_STATUSES = ["Novo", "Contato Enviado", "Respondeu", "Qualificado", "Oferta Enviada", "Comprou"];
const STATUS_COLOR = {
  "Novo": "bg-zinc-100 text-zinc-700",
  "Contato Enviado": "bg-sky-50 text-sky-700",
  "Respondeu": "bg-cyan-50 text-cyan-700",
  "Qualificado": "bg-violet-50 text-violet-700",
  "Oferta Enviada": "bg-amber-50 text-amber-700",
  "Comprou": "bg-emerald-50 text-emerald-700",
  "Upsell": "bg-indigo-50 text-indigo-700",
  "Não Comprou": "bg-rose-50 text-rose-700",
};
const SEX_OPTIONS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const PIPELINE_COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#64748B"];
const PRIORITIES = ["Baixa", "Média", "Alta", "Urgente"];
const TASK_STATUSES = ["A fazer", "Em andamento", "Concluída"];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pipelines", label: "Pipelines", icon: Trello },
  { id: "campanhas", label: "Campanhas", icon: Megaphone },
  { id: "validacao", label: "Validação", icon: HelpCircle },
  { id: "objecoes", label: "Objeções", icon: ShieldAlert },
  { id: "scripts", label: "Scripts", icon: FileText },
  { id: "leads", label: "Leads", icon: Users },
  { id: "tarefas", label: "Tarefas", icon: CheckSquare },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

/* ============================================================
   HELPERS
============================================================ */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => new Date().toISOString();
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtMoney = (n) => (n || n === 0 ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00");
const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const fmtRate = (r) => (r === null || r === undefined ? "—" : `${r}%`);
const mode = (arr) => {
  const clean = arr.filter((x) => x && String(x).trim());
  if (!clean.length) return null;
  const counts = {};
  clean.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
};
const ageBracket = (age) => {
  const a = Number(age);
  if (!a && a !== 0) return null;
  if (a <= 17) return "0-17";
  if (a <= 25) return "18-25";
  if (a <= 35) return "26-35";
  if (a <= 50) return "36-50";
  return "51+";
};
const hoursBetween = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 36e5);
const fmtDuration = (hrs) => {
  if (hrs === null || hrs === undefined) return "—";
  if (hrs < 24) return `${Math.round(hrs)}h`;
  return `${Math.round(hrs / 24)} d`;
};

const emptyLead = () => ({
  id: uid(), name: "", phone: "", email: "", sex: "", age: "", city: "",
  origin: "", campaignId: "", scriptId: "", objectionId: "", mainPain: "",
  mainDesire: "", lastInteraction: "", nextAction: "", status: "Novo",
  value: "", product: "", expectedResult: "", obtainedResult: "", nextNeed: "",
  pipelineId: "", stageId: "", createdAt: now(),
  statusHistory: [{ status: "Novo", at: now() }],
});

const emptyPipeline = () => ({
  id: uid(), name: "", description: "", color: PIPELINE_COLORS[0], campaignId: "",
  stages: [
    { id: uid(), name: "Lead Captado", statusMap: "Novo" },
    { id: uid(), name: "Mensagem Enviada", statusMap: "Contato Enviado" },
    { id: uid(), name: "Qualificado", statusMap: "Qualificado" },
    { id: uid(), name: "Comprou", statusMap: "Comprou" },
  ],
});

const emptyCampaign = () => ({
  id: uid(), name: "", objective: "", product: "", date: "", pipelineId: "",
  steps: [{ id: uid(), name: "Contato Inicial" }],
});

const emptyScript = () => ({ id: uid(), name: "", text: "", stageId: "", campaignId: "" });
const emptyObjection = () => ({ id: uid(), name: "", script: "" });
const emptyTask = () => ({
  id: uid(), title: "", description: "", assignee: "", dueDate: "",
  priority: "Média", status: "A fazer", subtasks: [],
});

const initialState = {
  leads: [], pipelines: [], campaigns: [], scripts: [], objections: [], tasks: [],
};

/* ============================================================
   PRIMITIVES
============================================================ */
function Panel({ children, className = "" }) {
  return <div className={`bg-white border border-zinc-200 rounded-lg ${className}`}>{children}</div>;
}
function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50",
    ghost: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
    danger: "text-rose-600 hover:bg-rose-50",
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Field({ label, children, span }) {
  return (
    <label className={`flex flex-col gap-1 ${span ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function Input(props) { return <input {...props} className={`${inputCls} ${props.className || ""}`} />; }
function Select({ children, ...props }) { return <select {...props} className={`${inputCls} bg-white ${props.className || ""}`}>{children}</select>; }
function Textarea(props) { return <textarea {...props} className={`${inputCls} resize-none ${props.className || ""}`} />; }

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-xl bg-white shadow-xl mt-4 mb-8`}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function StatCard({ label, value, sub }) {
  return (
    <Panel className="p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold text-zinc-900 tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-zinc-400">{sub}</div> : null}
    </Panel>
  );
}
function SectionTitle({ children, action }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-zinc-800">{children}</h2>
      {action}
    </div>
  );
}
function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-14 text-center">
      <Icon size={22} className="text-zinc-300" />
      <div className="mt-3 text-sm font-medium text-zinc-600">{title}</div>
      {hint ? <div className="mt-1 max-w-xs text-xs text-zinc-400">{hint}</div> : null}
    </div>
  );
}
function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) { console.error(err); }
  };
  return (
    <button onClick={doCopy} className={`shrink-0 flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium ${copied ? "text-emerald-600" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"}`}>
      {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
    </button>
  );
}

/* ============================================================
   APP
============================================================ */
export default function App() {
  const [state, setState] = useState(initialState);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("dashboard");
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState, ...JSON.parse(raw) });
    } catch (e) { /* first run, no data yet */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaving(true);
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
      setSaving(false);
    }, 350);
    return () => clearTimeout(t);
  }, [state, loaded]);

  const update = useCallback((key, fn) => {
    setState((s) => ({ ...s, [key]: fn(s[key]) }));
  }, []);

  const upsert = (key, item) => update(key, (list) => {
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx === -1) return [...list, item];
    const copy = [...list]; copy[idx] = item; return copy;
  });
  const remove = (key, id) => update(key, (list) => list.filter((x) => x.id !== id));

  if (!loaded) {
    return <div className="flex h-screen items-center justify-center text-sm text-zinc-400">Carregando GAID CRM…</div>;
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === view)?.label || "GAID CRM";

  return (
    <div className="flex h-screen w-full bg-zinc-50 text-zinc-800" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Sidebar
        view={view}
        setView={(v) => { setView(v); setSidebarOpen(false); }}
        saving={saving}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-500 hover:text-zinc-800">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-zinc-900">{activeLabel}</span>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {view === "dashboard" && <Dashboard state={state} />}
            {view === "pipelines" && <Pipelines state={state} update={update} upsert={upsert} remove={remove} />}
            {view === "campanhas" && <Campanhas state={state} upsert={upsert} remove={remove} />}
            {view === "validacao" && <Validacao state={state} />}
            {view === "objecoes" && <Objecoes state={state} upsert={upsert} remove={remove} />}
            {view === "scripts" && <Scripts state={state} upsert={upsert} remove={remove} />}
            {view === "leads" && <Leads state={state} upsert={upsert} remove={remove} />}
            {view === "tarefas" && <Tarefas state={state} upsert={upsert} remove={remove} />}
            {view === "relatorios" && <Relatorios state={state} />}
            {view === "configuracoes" && <Configuracoes state={state} setState={setState} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, saving, open, onClose }) {
  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 z-30 bg-zinc-900/40 md:hidden" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-out md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">G</div>
            <div>
              <div className="text-sm font-semibold leading-none text-zinc-900">GAID CRM</div>
              <div className="mt-0.5 text-[11px] leading-none text-zinc-400">Inteligência comercial</div>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 md:hidden">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                  active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                <Icon size={16} strokeWidth={2} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-[11px] text-zinc-400">{saving ? "Salvando…" : "Dados salvos"}</div>
      </aside>
    </>
  );
}

/* ============================================================
   METRICS ENGINE
============================================================ */
function useMetrics(state) {
  return useMemo(() => {
    const { leads, campaigns, scripts, objections } = state;
    const totalLeads = leads.length;
    const converted = leads.filter((l) => l.status === "Comprou" || l.status === "Upsell");
    const activeLeads = leads.filter((l) => !["Comprou", "Não Comprou", "Upsell"].includes(l.status));
    const revenue = converted.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const avgTicket = converted.length ? revenue / converted.length : null;
    const overallConversion = rate(converted.length, totalLeads);

    // funnel: reached-or-beyond count per status
    const idx = (s) => FUNNEL_STATUSES.indexOf(s === "Upsell" ? "Comprou" : s);
    const funnel = FUNNEL_STATUSES.map((st, i) => {
      const reached = leads.filter((l) => idx(l.status) >= i).length;
      return { status: st, reached };
    });
    const funnelWithRate = funnel.map((f, i) => ({
      ...f,
      convFromPrev: i === 0 ? null : rate(f.reached, funnel[i - 1].reached),
    }));
    let bottleneck = null;
    funnelWithRate.slice(1).forEach((f) => {
      if (f.convFromPrev !== null && (bottleneck === null || f.convFromPrev < bottleneck.convFromPrev)) bottleneck = f;
    });

    // avg time in each status using statusHistory
    const timeInStatus = {};
    STATUS_LIST.forEach((st) => {
      const durations = [];
      leads.forEach((l) => {
        const hist = l.statusHistory || [];
        hist.forEach((entry, i) => {
          if (entry.status !== st) return;
          const end = hist[i + 1] ? hist[i + 1].at : now();
          durations.push(hoursBetween(entry.at, end));
        });
      });
      if (durations.length) timeInStatus[st] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });

    // best campaign / script / objection
    const rankBy = (list, keyField) => list.map((item) => {
      const its = leads.filter((l) => l[keyField] === item.id);
      const conv = its.filter((l) => l.status === "Comprou" || l.status === "Upsell").length;
      return { item, total: its.length, conv, convRate: rate(conv, its.length) };
    }).filter((r) => r.total > 0).sort((a, b) => (b.convRate ?? -1) - (a.convRate ?? -1));

    const campaignRank = rankBy(campaigns, "campaignId");
    const scriptRank = rankBy(scripts, "scriptId");
    const objectionRank = rankBy(objections, "objectionId");

    // profile of buyers
    const sexDist = {};
    converted.forEach((l) => { if (l.sex) sexDist[l.sex] = (sexDist[l.sex] || 0) + 1; });
    const ageDist = {};
    converted.forEach((l) => { const b = ageBracket(l.age); if (b) ageDist[b] = (ageDist[b] || 0) + 1; });
    const cityDist = {};
    converted.forEach((l) => { if (l.city) cityDist[l.city] = (cityDist[l.city] || 0) + 1; });
    const topCities = Object.entries(cityDist).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // product outcomes
    const productMap = {};
    leads.forEach((l) => {
      if (!l.product) return;
      productMap[l.product] = productMap[l.product] || [];
      productMap[l.product].push(l);
    });
    const productInsights = Object.entries(productMap).map(([product, its]) => ({
      product, count: its.length,
      expected: mode(its.map((l) => l.expectedResult)),
      obtained: mode(its.map((l) => l.obtainedResult)),
      nextNeed: mode(its.map((l) => l.nextNeed)),
    }));

    return {
      totalLeads, activeLeads: activeLeads.length, convertedLeads: converted.length,
      revenue, avgTicket, overallConversion, funnel: funnelWithRate, bottleneck, timeInStatus,
      campaignRank, scriptRank, objectionRank, sexDist, ageDist, topCities, productInsights, converted,
    };
  }, [state]);
}

/* ============================================================
   DASHBOARD
============================================================ */
function Dashboard({ state }) {
  const m = useMetrics(state);
  const hasData = state.leads.length > 0;
  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Cockpit estratégico</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Métricas calculadas a partir dos dados reais lançados no sistema.</p>
      </div>

      {!hasData && (
        <EmptyState icon={BarChart3} title="Nenhum dado ainda" hint="Cadastre leads em Pipelines ou na aba Leads para o dashboard começar a calcular métricas reais." />
      )}

      {hasData && (
        <>
          <div>
            <SectionTitle>Comercial</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Leads totais" value={m.totalLeads} />
              <StatCard label="Leads ativos" value={m.activeLeads} />
              <StatCard label="Convertidos" value={m.convertedLeads} />
              <StatCard label="Receita" value={fmtMoney(m.revenue)} />
              <StatCard label="Ticket médio" value={m.avgTicket ? fmtMoney(m.avgTicket) : "—"} />
              <StatCard label="Conversão geral" value={fmtRate(m.overallConversion)} />
            </div>
          </div>

          <div>
            <SectionTitle>Funil</SectionTitle>
            <Panel className="p-4">
              <div className="space-y-2">
                {m.funnel.map((f) => {
                  const width = m.funnel[0].reached ? Math.max(4, (f.reached / m.funnel[0].reached) * 100) : 0;
                  const isBottleneck = m.bottleneck && m.bottleneck.status === f.status;
                  return (
                    <div key={f.status} className="flex items-center gap-3">
                      <div className="w-32 shrink-0 text-xs text-zinc-600">{f.status}</div>
                      <div className="h-6 flex-1 rounded bg-zinc-100">
                        <div className={`h-6 rounded ${isBottleneck ? "bg-rose-400" : "bg-indigo-500"}`} style={{ width: `${width}%` }} />
                      </div>
                      <div className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-600">{f.reached}</div>
                      <div className="w-14 shrink-0 text-right text-xs tabular-nums text-zinc-400">{fmtRate(f.convFromPrev)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                <span>Gargalo principal: <b className="text-zinc-700">{m.bottleneck ? m.bottleneck.status : "—"}</b></span>
                <span className="flex items-center gap-1"><Clock size={12} /> Tempo médio em etapa:</span>
                {FUNNEL_STATUSES.map((s) => (
                  <span key={s} className="text-zinc-400">{s}: <b className="text-zinc-600">{fmtDuration(m.timeInStatus[s])}</b></span>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <SectionTitle>Campanhas</SectionTitle>
              <Panel className="p-4 space-y-2 text-sm">
                <RankLine label="Melhor campanha" rank={m.campaignRank} state={state} entity="campaigns" />
                <RankLine label="Melhor script" rank={m.scriptRank} state={state} entity="scripts" />
                <RankLine label="Melhor objeção tratada" rank={m.objectionRank} state={state} entity="objections" />
              </Panel>
            </div>
            <div>
              <SectionTitle>Perfil dos compradores</SectionTitle>
              <Panel className="p-4 space-y-3 text-sm">
                <DistRow title="Sexo" dist={m.sexDist} />
                <DistRow title="Faixa etária" dist={m.ageDist} />
                <div>
                  <div className="text-xs font-medium text-zinc-500 mb-1">Região (cidades)</div>
                  {m.topCities.length ? m.topCities.map(([city, n]) => (
                    <div key={city} className="flex justify-between text-xs text-zinc-600 py-0.5">
                      <span>{city}</span><span className="tabular-nums">{n}</span>
                    </div>
                  )) : <span className="text-xs text-zinc-400">Sem dados suficientes</span>}
                </div>
              </Panel>
            </div>
          </div>

          <div>
            <SectionTitle>Produto</SectionTitle>
            {m.productInsights.length === 0 ? (
              <EmptyState icon={FileText} title="Nenhum produto associado a leads ainda" />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {m.productInsights.map((p) => (
                  <Panel key={p.product} className="p-4 text-sm">
                    <div className="font-medium text-zinc-800 mb-2">{p.product} <span className="text-xs font-normal text-zinc-400">({p.count} leads)</span></div>
                    <div className="space-y-1 text-xs text-zinc-500">
                      <div>Resultado esperado mais citado: <b className="text-zinc-700">{p.expected ? p.expected[0] : "—"}</b></div>
                      <div>Resultado obtido mais citado: <b className="text-zinc-700">{p.obtained ? p.obtained[0] : "—"}</b></div>
                      <div>Próxima necessidade mais citada: <b className="text-zinc-700">{p.nextNeed ? p.nextNeed[0] : "—"}</b></div>
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RankLine({ label, rank, state, entity }) {
  const top = rank[0];
  const name = top ? (state[entity].find((x) => x.id === top.item.id)?.name) : null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-800">{name ? `${name} (${fmtRate(top.convRate)})` : "Dados insuficientes"}</span>
    </div>
  );
}
function DistRow({ title, dist }) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  return (
    <div>
      <div className="text-xs font-medium text-zinc-500 mb-1">{title}</div>
      {entries.length ? entries.map(([k, n]) => (
        <div key={k} className="flex justify-between text-xs text-zinc-600 py-0.5">
          <span>{k}</span><span className="tabular-nums">{n} ({rate(n, total)}%)</span>
        </div>
      )) : <span className="text-xs text-zinc-400">Sem dados suficientes</span>}
    </div>
  );
}

/* ============================================================
   PIPELINES (Trello-like)
============================================================ */
function Pipelines({ state, update, upsert, remove }) {
  const [selected, setSelected] = useState(state.pipelines[0]?.id || "");
  const [pipeModal, setPipeModal] = useState(null);
  const [leadModal, setLeadModal] = useState(null);
  const [newStageName, setNewStageName] = useState("");
  const [dragLeadId, setDragLeadId] = useState(null);
  const [editingStage, setEditingStage] = useState(null);

  useEffect(() => {
    if (!selected && state.pipelines.length) setSelected(state.pipelines[0].id);
  }, [state.pipelines, selected]);

  const pipeline = state.pipelines.find((p) => p.id === selected);

  const addStage = () => {
    if (!newStageName.trim() || !pipeline) return;
    upsert("pipelines", { ...pipeline, stages: [...pipeline.stages, { id: uid(), name: newStageName.trim(), statusMap: "" }] });
    setNewStageName("");
  };
  const renameStage = (stageId, name) => {
    upsert("pipelines", { ...pipeline, stages: pipeline.stages.map((s) => (s.id === stageId ? { ...s, name } : s)) });
  };
  const setStageStatusMap = (stageId, statusMap) => {
    upsert("pipelines", { ...pipeline, stages: pipeline.stages.map((s) => (s.id === stageId ? { ...s, statusMap } : s)) });
  };
  const deleteStage = (stageId) => {
    if (pipeline.stages.length <= 1) return;
    const fallback = pipeline.stages.find((s) => s.id !== stageId).id;
    update("leads", (list) => list.map((l) => (l.stageId === stageId ? { ...l, stageId: fallback } : l)));
    upsert("pipelines", { ...pipeline, stages: pipeline.stages.filter((s) => s.id !== stageId) });
  };
  const moveStage = (stageId, dir) => {
    const idx = pipeline.stages.findIndex((s) => s.id === stageId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pipeline.stages.length) return;
    const copy = [...pipeline.stages];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    upsert("pipelines", { ...pipeline, stages: copy });
  };
  const applyStageStatus = (lead, stage) => {
    if (!stage.statusMap || lead.status === stage.statusMap) return lead;
    const hist = [...(lead.statusHistory || []), { status: stage.statusMap, at: now() }];
    return { ...lead, status: stage.statusMap, statusHistory: hist };
  };
  const dropOnStage = (stageId) => {
    if (!dragLeadId) return;
    const lead = state.leads.find((l) => l.id === dragLeadId);
    const stage = pipeline.stages.find((s) => s.id === stageId);
    if (lead && lead.stageId !== stageId) {
      upsert("leads", applyStageStatus({ ...lead, stageId, pipelineId: pipeline.id }, stage));
    }
    setDragLeadId(null);
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Pipelines</h1>
        <Button onClick={() => setPipeModal(emptyPipeline())}><Plus size={14} /> Criar Pipeline</Button>
      </div>

      {state.pipelines.length === 0 ? (
        <EmptyState icon={Trello} title="Nenhum pipeline criado" hint="Crie um pipeline para começar a organizar seus leads em etapas, do jeito que fizer sentido para sua operação." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {state.pipelines.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
                  selected === p.id ? "border-zinc-300 bg-white text-zinc-800" : "border-transparent text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.name || "Sem nome"}
                {selected === p.id && (
                  <span onClick={(e) => { e.stopPropagation(); setPipeModal(p); }} className="ml-1 text-zinc-400 hover:text-zinc-700"><Pencil size={11} /></span>
                )}
              </button>
            ))}
          </div>

          {pipeline && (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {pipeline.stages.map((stage, i) => {
                const stageLeads = state.leads.filter((l) => l.pipelineId === pipeline.id && l.stageId === stage.id);
                return (
                  <div
                    key={stage.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dropOnStage(stage.id)}
                    className="flex w-64 shrink-0 flex-col rounded-lg bg-zinc-100/70"
                  >
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
                      {editingStage === stage.id ? (
                        <input
                          autoFocus defaultValue={stage.name}
                          onBlur={(e) => { renameStage(stage.id, e.target.value || stage.name); setEditingStage(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          className="w-full rounded border border-indigo-300 px-1.5 py-0.5 text-xs font-semibold"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                          {stage.name}
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-500 tabular-nums">{stageLeads.length}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 text-zinc-400">
                        <button onClick={() => moveStage(stage.id, -1)} disabled={i === 0} className="hover:text-zinc-700 disabled:opacity-30"><ChevronRight size={12} className="rotate-180" /></button>
                        <button onClick={() => moveStage(stage.id, 1)} disabled={i === pipeline.stages.length - 1} className="hover:text-zinc-700 disabled:opacity-30"><ChevronRight size={12} /></button>
                        <button onClick={() => setEditingStage(stage.id)} className="hover:text-zinc-700"><Pencil size={11} /></button>
                        <button onClick={() => deleteStage(stage.id)} className="hover:text-rose-600"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <div className="px-3 pb-2">
                      <select
                        value={stage.statusMap || ""}
                        onChange={(e) => setStageStatusMap(stage.id, e.target.value)}
                        title="Status aplicado automaticamente aos leads movidos para esta etapa"
                        className={`w-full rounded border px-1.5 py-1 text-[11px] outline-none ${stage.statusMap ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-dashed border-zinc-300 text-zinc-400"}`}
                      >
                        <option value="">Sem status vinculado</option>
                        {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 space-y-2 px-2 pb-2 min-h-[60px]">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDragLeadId(lead.id)}
                          onClick={() => setLeadModal(lead)}
                          className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2.5 shadow-sm hover:border-indigo-300"
                        >
                          <div className="text-xs font-medium text-zinc-800">{lead.name || "Sem nome"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge className={STATUS_COLOR[lead.status]}>{lead.status}</Badge>
                            {lead.value ? <span className="text-[10px] text-zinc-500">{fmtMoney(Number(lead.value))}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const base = { ...emptyLead(), pipelineId: pipeline.id, stageId: stage.id };
                        setLeadModal(stage.statusMap ? { ...base, status: stage.statusMap, statusHistory: [{ status: stage.statusMap, at: now() }] } : base);
                      }}
                      className="mx-2 mb-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-200/60"
                    >
                      <Plus size={12} /> Adicionar lead
                    </button>
                  </div>
                );
              })}
              <div className="w-64 shrink-0">
                <div className="flex gap-1.5">
                  <Input placeholder="Nova etapa" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStage()} />
                  <Button size="sm" variant="secondary" onClick={addStage}><Plus size={13} /></Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {pipeModal && <PipelineModal pipeline={pipeModal} state={state} onClose={() => setPipeModal(null)} onSave={(p) => { upsert("pipelines", p); setSelected(p.id); setPipeModal(null); }} onDelete={(id) => { remove("pipelines", id); setPipeModal(null); if (selected === id) setSelected(""); }} />}
      {leadModal && <LeadModal lead={leadModal} state={state} onClose={() => setLeadModal(null)} onSave={(l) => { upsert("leads", l); setLeadModal(null); }} onDelete={(id) => { remove("leads", id); setLeadModal(null); }} />}
    </div>
  );
}

function PipelineModal({ pipeline, state, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(pipeline);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title={pipeline.name ? "Editar pipeline" : "Criar pipeline"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Vendas Low Ticket" /></Field>
        <Field label="Descrição"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Campanha vinculada (opcional)">
          <Select value={form.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
            <option value="">Nenhuma</option>
            {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Cor">
          <div className="flex gap-2">
            {PIPELINE_COLORS.map((c) => (
              <button key={c} onClick={() => set("color", c)} className={`h-6 w-6 rounded-full ${form.color === c ? "ring-2 ring-offset-1 ring-zinc-400" : ""}`} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between pt-2">
          {state.pipelines.find((p) => p.id === pipeline.id) ? (
            <Button variant="danger" size="sm" onClick={() => onDelete(pipeline.id)}><Trash2 size={13} /> Excluir</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!form.name.trim()} onClick={() => onSave(form)}>Salvar</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   LEAD MODAL (shared)
============================================================ */
function LeadModal({ lead, state, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(lead);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setStatus = (newStatus) => {
    setForm((f) => {
      if (f.status === newStatus) return f;
      const hist = [...(f.statusHistory || []), { status: newStatus, at: now() }];
      return { ...f, status: newStatus, statusHistory: hist };
    });
  };
  const isNew = !state.leads.find((l) => l.id === lead.id);
  return (
    <Modal title={isNew ? "Novo lead" : "Editar lead"} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Telefone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="E-mail"><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Cidade"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Sexo">
          <Select value={form.sex} onChange={(e) => set("sex", e.target.value)}>
            <option value="">—</option>
            {SEX_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Idade"><Input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} /></Field>
        <Field label="Origem"><Input value={form.origin} onChange={(e) => set("origin", e.target.value)} placeholder="Ex: Instagram, Indicação" /></Field>
        <Field label="Produto"><Input value={form.product} onChange={(e) => set("product", e.target.value)} /></Field>
        <Field label="Campanha">
          <Select value={form.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
            <option value="">—</option>
            {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Script utilizado">
          <Select value={form.scriptId} onChange={(e) => set("scriptId", e.target.value)}>
            <option value="">—</option>
            {state.scripts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Objeção">
          <Select value={form.objectionId} onChange={(e) => set("objectionId", e.target.value)}>
            <option value="">—</option>
            {state.objections.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Dor principal" span><Input value={form.mainPain} onChange={(e) => set("mainPain", e.target.value)} /></Field>
        <Field label="Desejo principal" span><Input value={form.mainDesire} onChange={(e) => set("mainDesire", e.target.value)} /></Field>
        <Field label="Última interação"><Input type="date" value={form.lastInteraction} onChange={(e) => set("lastInteraction", e.target.value)} /></Field>
        <Field label="Próxima ação"><Input value={form.nextAction} onChange={(e) => set("nextAction", e.target.value)} /></Field>
        <Field label="Valor (R$)"><Input type="number" value={form.value} onChange={(e) => set("value", e.target.value)} /></Field>
        <Field label="Resultado esperado"><Input value={form.expectedResult} onChange={(e) => set("expectedResult", e.target.value)} /></Field>
        <Field label="Resultado obtido"><Input value={form.obtainedResult} onChange={(e) => set("obtainedResult", e.target.value)} /></Field>
        <Field label="Próxima necessidade"><Input value={form.nextNeed} onChange={(e) => set("nextNeed", e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
        {!isNew ? <Button variant="danger" size="sm" onClick={() => onDelete(form.id)}><Trash2 size={13} /> Excluir</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!form.name.trim()} onClick={() => onSave(form)}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   LEADS (table + filters)
============================================================ */
function Leads({ state, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ campaignId: "", sex: "", origin: "", scriptId: "", objectionId: "", product: "", status: "" });
  const [search, setSearch] = useState("");

  const filtered = state.leads.filter((l) => {
    if (filters.campaignId && l.campaignId !== filters.campaignId) return false;
    if (filters.sex && l.sex !== filters.sex) return false;
    if (filters.origin && l.origin !== filters.origin) return false;
    if (filters.scriptId && l.scriptId !== filters.scriptId) return false;
    if (filters.objectionId && l.objectionId !== filters.objectionId) return false;
    if (filters.product && l.product !== filters.product) return false;
    if (filters.status && l.status !== filters.status) return false;
    if (search && !`${l.name} ${l.email} ${l.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const origins = [...new Set(state.leads.map((l) => l.origin).filter(Boolean))];
  const products = [...new Set(state.leads.map((l) => l.product).filter(Boolean))];
  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Leads</h1>
        <Button onClick={() => setModal(emptyLead())}><Plus size={14} /> Novo lead</Button>
      </div>

      <Panel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-400" />
            <Input placeholder="Buscar nome, e-mail, telefone" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-7 w-52" />
          </div>
          <Select value={filters.status} onChange={(e) => setF("status", e.target.value)} className="w-36"><option value="">Status</option>{STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          <Select value={filters.campaignId} onChange={(e) => setF("campaignId", e.target.value)} className="w-36"><option value="">Campanha</option>{state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={filters.scriptId} onChange={(e) => setF("scriptId", e.target.value)} className="w-36"><option value="">Script</option>{state.scripts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select value={filters.objectionId} onChange={(e) => setF("objectionId", e.target.value)} className="w-36"><option value="">Objeção</option>{state.objections.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          <Select value={filters.sex} onChange={(e) => setF("sex", e.target.value)} className="w-36"><option value="">Sexo</option>{SEX_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          <Select value={filters.origin} onChange={(e) => setF("origin", e.target.value)} className="w-36"><option value="">Origem</option>{origins.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
          <Select value={filters.product} onChange={(e) => setF("product", e.target.value)} className="w-36"><option value="">Produto</option>{products.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
          {Object.values(filters).some(Boolean) && <Button size="sm" variant="ghost" onClick={() => setFilters({ campaignId: "", sex: "", origin: "", scriptId: "", objectionId: "", product: "", status: "" })}>Limpar</Button>}
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={state.leads.length ? "Nenhum lead corresponde aos filtros" : "Nenhum lead cadastrado"} />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 text-zinc-400">
              <tr>
                {["Nome", "Contato", "Status", "Origem", "Produto", "Valor", "Próxima ação", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer" onClick={() => setModal(l)}>
                  <td className="px-3 py-2 font-medium text-zinc-800">{l.name || "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{l.email || l.phone || "—"}</td>
                  <td className="px-3 py-2"><Badge className={STATUS_COLOR[l.status]}>{l.status}</Badge></td>
                  <td className="px-3 py-2 text-zinc-500">{l.origin || "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{l.product || "—"}</td>
                  <td className="px-3 py-2 text-zinc-500 tabular-nums">{l.value ? fmtMoney(Number(l.value)) : "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{l.nextAction || "—"}</td>
                  <td className="px-3 py-2 text-right text-zinc-300"><Pencil size={12} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {modal && <LeadModal lead={modal} state={state} onClose={() => setModal(null)} onSave={(l) => { upsert("leads", l); setModal(null); }} onDelete={(id) => { remove("leads", id); setModal(null); }} />}
    </div>
  );
}

/* ============================================================
   CAMPANHAS
============================================================ */
function Campanhas({ state, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);

  const rankBy = (campaignId) => {
    const its = state.leads.filter((l) => l.campaignId === campaignId);
    const conv = its.filter((l) => l.status === "Comprou" || l.status === "Upsell").length;
    return { total: its.length, conv, r: rate(conv, its.length) };
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Campanhas</h1>
        <Button onClick={() => setModal(emptyCampaign())}><Plus size={14} /> Criar Campanha</Button>
      </div>
      {state.campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha criada" hint="Campanhas ajudam a medir experimentos comerciais: mensagens, ofertas e scripts testados." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.campaigns.map((c) => {
            const m = rankBy(c.id);
            return (
              <Panel key={c.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">{c.name}</div>
                    <div className="text-xs text-zinc-400">{c.objective}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(c)} className="text-zinc-400 hover:text-zinc-700"><Pencil size={13} /></button>
                    <button onClick={() => remove("campaigns", c.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                  <span>Leads: <b className="text-zinc-700">{m.total}</b></span>
                  <span>Conversão: <b className="text-zinc-700">{fmtRate(m.r)}</b></span>
                  <span>{fmtDate(c.date)}</span>
                </div>
                <button onClick={() => setDetail(c)} className="mt-3 text-xs font-medium text-indigo-600 hover:underline">Ver etapas da campanha ({c.steps.length})</button>
              </Panel>
            );
          })}
        </div>
      )}
      {modal && <CampaignModal campaign={modal} state={state} onClose={() => setModal(null)} onSave={(c) => { upsert("campaigns", c); setModal(null); }} />}
      {detail && <CampaignStepsModal campaign={detail} state={state} onClose={() => setDetail(null)} onSave={(c) => { upsert("campaigns", c); setDetail(c); }} />}
    </div>
  );
}

function CampaignModal({ campaign, state, onClose, onSave }) {
  const [form, setForm] = useState(campaign);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title={state.campaigns.find((c) => c.id === campaign.id) ? "Editar campanha" : "Criar campanha"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Objetivo"><Input value={form.objective} onChange={(e) => set("objective", e.target.value)} /></Field>
        <Field label="Produto"><Input value={form.product} onChange={(e) => set("product", e.target.value)} /></Field>
        <Field label="Data"><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Pipeline vinculado">
          <Select value={form.pipelineId} onChange={(e) => set("pipelineId", e.target.value)}>
            <option value="">Nenhum</option>
            {state.pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!form.name.trim()} onClick={() => onSave(form)}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

function CampaignStepsModal({ campaign, state, onClose, onSave }) {
  const [steps, setSteps] = useState(campaign.steps);
  const addStep = () => setSteps((s) => [...s, { id: uid(), name: `Etapa ${s.length + 1}` }]);
  const updateStep = (id, name) => setSteps((s) => s.map((st) => (st.id === id ? { ...st, name } : st)));
  const removeStep = (id) => setSteps((s) => s.filter((st) => st.id !== id));
  const duplicateStep = (id) => setSteps((s) => {
    const idx = s.findIndex((st) => st.id === id);
    const copy = { ...s[idx], id: uid(), name: `${s[idx].name} (cópia)` };
    return [...s.slice(0, idx + 1), copy, ...s.slice(idx + 1)];
  });
  const move = (id, dir) => setSteps((s) => {
    const idx = s.findIndex((st) => st.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= s.length) return s;
    const copy = [...s]; [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]; return copy;
  });
  const scriptsForStep = (stepId) => state.scripts.filter((sc) => sc.stageId === stepId);

  return (
    <Modal title={`Etapas — ${campaign.name}`} onClose={onClose} wide>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.id} className="rounded-md border border-zinc-200 p-2.5">
            <div className="flex items-center gap-2">
              <GripVertical size={13} className="text-zinc-300" />
              <Input value={s.name} onChange={(e) => updateStep(s.id, e.target.value)} className="flex-1" />
              <button onClick={() => move(s.id, -1)} disabled={i === 0} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"><ChevronRight size={13} className="rotate-180" /></button>
              <button onClick={() => move(s.id, 1)} disabled={i === steps.length - 1} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"><ChevronRight size={13} /></button>
              <button onClick={() => duplicateStep(s.id)} className="text-zinc-400 hover:text-zinc-700 text-[10px] px-1">Duplicar</button>
              <button onClick={() => removeStep(s.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 size={13} /></button>
            </div>
            {scriptsForStep(s.id).length > 0 && (
              <div className="ml-5 mt-1.5 flex flex-wrap gap-1">
                {scriptsForStep(s.id).map((sc) => <Badge key={sc.id} className="bg-zinc-100 text-zinc-600">{sc.name}</Badge>)}
              </div>
            )}
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={addStep}><Plus size={13} /> Adicionar bloco</Button>
        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 mt-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={() => onSave({ ...campaign, steps })}>Salvar etapas</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   SCRIPTS
============================================================ */
function Scripts({ state, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const metricsFor = (scriptId) => {
    const its = state.leads.filter((l) => l.scriptId === scriptId);
    const responded = its.filter((l) => FUNNEL_STATUSES.indexOf(l.status === "Upsell" ? "Comprou" : l.status) >= FUNNEL_STATUSES.indexOf("Respondeu")).length;
    const qualified = its.filter((l) => FUNNEL_STATUSES.indexOf(l.status === "Upsell" ? "Comprou" : l.status) >= FUNNEL_STATUSES.indexOf("Qualificado")).length;
    const purchased = its.filter((l) => l.status === "Comprou" || l.status === "Upsell").length;
    const upsold = its.filter((l) => l.status === "Upsell").length;
    return {
      total: its.length,
      responseRate: rate(responded, its.length),
      qualificationRate: rate(qualified, responded),
      saleRate: rate(purchased, its.length),
      upsellRate: rate(upsold, purchased),
    };
  };
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Scripts</h1>
        <Button onClick={() => setModal(emptyScript())}><Plus size={14} /> Novo script</Button>
      </div>
      {state.scripts.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum script cadastrado" hint="Cadastre os textos usados na prospecção para medir taxa de resposta, qualificação, venda e upsell." />
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 text-zinc-400">
              <tr>{["Nome", "Campanha", "Leads", "Resposta", "Qualificação", "Venda", "Upsell", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {state.scripts.map((s) => {
                const m = metricsFor(s.id);
                const campaign = state.campaigns.find((c) => c.id === s.campaignId);
                return (
                  <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                    <td className="px-3 py-2 font-medium text-zinc-800 cursor-pointer" onClick={() => setModal(s)}>{s.name}</td>
                    <td className="px-3 py-2 text-zinc-500">{campaign?.name || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500 tabular-nums">{m.total}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.responseRate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.qualificationRate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.saleRate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.upsellRate)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => remove("scripts", s.id)} className="text-zinc-300 hover:text-rose-600"><Trash2 size={12} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
      {modal && <ScriptModal script={modal} state={state} onClose={() => setModal(null)} onSave={(s) => { upsert("scripts", s); setModal(null); }} />}
    </div>
  );
}

function ScriptModal({ script, state, onClose, onSave }) {
  const [form, setForm] = useState(script);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const campaign = state.campaigns.find((c) => c.id === form.campaignId);
  return (
    <Modal title="Script" onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Script A" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Campanha">
            <Select value={form.campaignId} onChange={(e) => set("campaignId", e.target.value)}>
              <option value="">—</option>
              {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Etapa da campanha">
            <Select value={form.stageId} onChange={(e) => set("stageId", e.target.value)} disabled={!campaign}>
              <option value="">—</option>
              {campaign?.steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Texto"><Textarea rows={5} value={form.text} onChange={(e) => set("text", e.target.value)} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!form.name.trim()} onClick={() => onSave(form)}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   OBJEÇÕES
============================================================ */
function Objecoes({ state, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const bestScriptFor = (objectionId) => {
    const rows = state.scripts.map((sc) => {
      const its = state.leads.filter((l) => l.objectionId === objectionId && l.scriptId === sc.id);
      const conv = its.filter((l) => l.status === "Comprou" || l.status === "Upsell").length;
      return { script: sc, total: its.length, r: rate(conv, its.length) };
    }).filter((r) => r.total > 0).sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
    return rows;
  };
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Objeções</h1>
        <Button onClick={() => setModal(emptyObjection())}><Plus size={14} /> Nova objeção</Button>
      </div>
      {state.objections.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Nenhuma objeção cadastrada" hint="Cadastre as objeções mais comuns (preço, tempo, confiança...) para identificar automaticamente o melhor script para cada uma." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.objections.map((o) => {
            const rows = bestScriptFor(o.id);
            return (
              <Panel key={o.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold text-zinc-800">{o.name}</div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(o)} className="text-zinc-400 hover:text-zinc-700"><Pencil size={13} /></button>
                    <button onClick={() => remove("objections", o.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 size={13} /></button>
                  </div>
                </div>
                {o.script && (
                  <div className="mt-1.5 flex items-start justify-between gap-2 rounded-md bg-zinc-50 p-2">
                    <p className="text-xs text-zinc-500 whitespace-pre-wrap">{o.script}</p>
                    <CopyButton text={o.script} />
                  </div>
                )}
                <div className="mt-3 border-t border-zinc-100 pt-2">
                  <div className="text-xs font-medium text-zinc-500 mb-1">Conversão por script</div>
                  {rows.length === 0 ? (
                    <span className="text-xs text-zinc-400">Sem dados suficientes</span>
                  ) : rows.map((r, i) => (
                    <div key={r.script.id} className="flex items-center justify-between text-xs py-0.5">
                      <span className={i === 0 ? "font-medium text-zinc-800 flex items-center gap-1" : "text-zinc-500"}>
                        {i === 0 && <Sparkles size={11} className="text-indigo-500" />} {r.script.name}
                      </span>
                      <span className="tabular-nums text-zinc-600">{fmtRate(r.r)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      {modal && <ObjectionModal objection={modal} onClose={() => setModal(null)} onSave={(o) => { upsert("objections", o); setModal(null); }} />}
    </div>
  );
}

function ObjectionModal({ objection, onClose, onSave }) {
  const [form, setForm] = useState(objection);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal title="Objeção" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Preço" /></Field>
        <Field label="Script"><Textarea rows={4} value={form.script} onChange={(e) => set("script", e.target.value)} placeholder="Texto usado para contornar essa objeção" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!form.name.trim()} onClick={() => onSave(form)}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   VALIDAÇÃO
============================================================ */
function Validacao({ state }) {
  const m = useMetrics(state);
  const MIN = 5;
  const enough = m.converted.length >= MIN;

  const topSex = Object.entries(m.sexDist).sort((a, b) => b[1] - a[1])[0];
  const topAge = Object.entries(m.ageDist).sort((a, b) => b[1] - a[1])[0];
  const topCity = m.topCities[0];
  const topPain = mode(m.converted.map((l) => l.mainPain));
  const topDesire = mode(m.converted.map((l) => l.mainDesire));
  const bestResponseScript = [...state.scripts].map((sc) => {
    const its = state.leads.filter((l) => l.scriptId === sc.id);
    const responded = its.filter((l) => FUNNEL_STATUSES.indexOf(l.status === "Upsell" ? "Comprou" : l.status) >= FUNNEL_STATUSES.indexOf("Respondeu")).length;
    return { sc, its: its.length, r: rate(responded, its.length) };
  }).filter((x) => x.its > 0).sort((a, b) => (b.r ?? -1) - (a.r ?? -1))[0];
  const bestObjectionHandled = m.objectionRank[0];
  const mostCommonObjection = (() => {
    const counts = {};
    state.leads.forEach((l) => { if (l.objectionId) counts[l.objectionId] = (counts[l.objectionId] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? state.objections.find((o) => o.id === top[0]) : null;
  })();
  const mostCommonLostObjection = (() => {
    const counts = {};
    state.leads.filter((l) => l.status === "Não Comprou").forEach((l) => { if (l.objectionId) counts[l.objectionId] = (counts[l.objectionId] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? state.objections.find((o) => o.id === top[0]) : null;
  })();
  const bestFollow = null; // depende de dados de follow-up estruturados por bloco de campanha
  const expectedMode = mode(state.leads.map((l) => l.expectedResult));
  const obtainedMode = mode(state.leads.map((l) => l.obtainedResult));
  const nextNeedMode = mode(state.leads.map((l) => l.nextNeed));

  const rows = [
    { q: "Quem compra?", a: enough ? `Predominantemente ${topSex ? topSex[0].toLowerCase() : "—"}${topAge ? `, faixa ${topAge[0]} anos` : ""}${topCity ? `, principalmente em ${topCity[0]}` : ""}.` : null },
    { q: "Por que compra?", a: (topPain || topDesire) ? `Dor mais citada: "${topPain ? topPain[0] : "—"}". Desejo mais citado: "${topDesire ? topDesire[0] : "—"}".` : null },
    { q: "O que gera resposta?", a: bestResponseScript ? `O script "${bestResponseScript.sc.name}" tem a maior taxa de resposta (${fmtRate(bestResponseScript.r)}).` : null },
    { q: "O que gera confiança?", a: bestObjectionHandled ? `Objeções tratadas com o script vinculado à melhor conversão indicam maior confiança gerada (${fmtRate(bestObjectionHandled.convRate)}).` : null },
    { q: "Qual objeção aparece mais?", a: mostCommonObjection ? `"${mostCommonObjection.name}" é a objeção mais frequente entre os leads.` : null },
    { q: "O que quase causa desistência?", a: mostCommonLostObjection ? `A objeção "${mostCommonLostObjection.name}" é a mais comum entre leads marcados como "Não Comprou".` : null },
    { q: "Qual resultado é esperado?", a: expectedMode ? `Resultado esperado mais citado: "${expectedMode[0]}".` : null },
    { q: "Qual resultado foi obtido?", a: obtainedMode ? `Resultado obtido mais citado: "${obtainedMode[0]}".` : null },
    { q: "Qual é a próxima necessidade?", a: nextNeedMode ? `Necessidade mais citada: "${nextNeedMode[0]}".` : null },
  ];

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Validação de produto</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Respostas geradas automaticamente quando há dados reais suficientes ({m.converted.length}/{MIN} conversões mínimas para inferências sobre compradores).</p>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <Panel key={r.q} className="p-4">
            <div className="text-sm font-medium text-zinc-800">{r.q}</div>
            <div className="mt-1 flex items-start gap-1.5 text-sm">
              {r.a ? (
                <><Sparkles size={13} className="mt-0.5 shrink-0 text-indigo-500" /><span className="text-zinc-600">{r.a}</span></>
              ) : (
                <span className="text-xs text-zinc-400 flex items-center gap-1"><AlertCircle size={12} /> Dados insuficientes até o momento</span>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   TAREFAS
============================================================ */
function Tarefas({ state, upsert, remove }) {
  const [modal, setModal] = useState(null);
  const [mode_, setMode] = useState("lista");

  const byStatus = (status) => state.tasks.filter((t) => t.status === status);
  const priorityColor = { Baixa: "bg-zinc-100 text-zinc-600", Média: "bg-sky-50 text-sky-700", Alta: "bg-amber-50 text-amber-700", Urgente: "bg-rose-50 text-rose-700" };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Tarefas</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-zinc-200 p-0.5 text-xs">
            {["lista", "kanban"].map((v) => (
              <button key={v} onClick={() => setMode(v)} className={`rounded px-2.5 py-1 capitalize ${mode_ === v ? "bg-zinc-100 font-medium text-zinc-800" : "text-zinc-400"}`}>{v}</button>
            ))}
          </div>
          <Button onClick={() => setModal(emptyTask())}><Plus size={14} /> Nova tarefa</Button>
        </div>
      </div>

      {state.tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Nenhuma tarefa cadastrada" />
      ) : mode_ === "lista" ? (
        <Panel className="divide-y divide-zinc-50">
          {state.tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 cursor-pointer" onClick={() => setModal(t)}>
              <CheckSquare size={14} className={t.status === "Concluída" ? "text-emerald-500" : "text-zinc-300"} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${t.status === "Concluída" ? "text-zinc-400 line-through" : "text-zinc-800"}`}>{t.title}</div>
                <div className="text-xs text-zinc-400">{t.assignee || "Sem responsável"} {t.dueDate ? `· ${fmtDate(t.dueDate)}` : ""}</div>
              </div>
              <Badge className={priorityColor[t.priority]}>{t.priority}</Badge>
              <span className="text-xs text-zinc-400 w-24 text-right">{t.status}</span>
            </div>
          ))}
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {TASK_STATUSES.map((st) => (
            <div key={st} className="rounded-lg bg-zinc-100/70 p-2">
              <div className="px-1.5 py-1 text-xs font-semibold text-zinc-600">{st} <span className="text-zinc-400">({byStatus(st).length})</span></div>
              <div className="space-y-2">
                {byStatus(st).map((t) => (
                  <div key={t.id} onClick={() => setModal(t)} className="cursor-pointer rounded-md border border-zinc-200 bg-white p-2.5">
                    <div className="text-xs font-medium text-zinc-800">{t.title}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <Badge className={priorityColor[t.priority]}>{t.priority}</Badge>
                      <span className="text-[10px] text-zinc-400">{fmtDate(t.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {modal && <TaskModal task={modal} onClose={() => setModal(null)} onSave={(t) => { upsert("tasks", t); setModal(null); }} onDelete={(id) => { remove("tasks", id); setModal(null); }} />}
    </div>
  );
}

function TaskModal({ task, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(task);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const addSub = () => set("subtasks", [...form.subtasks, { id: uid(), title: "", done: false }]);
  const updateSub = (id, patch) => set("subtasks", form.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSub = (id) => set("subtasks", form.subtasks.filter((s) => s.id !== id));
  return (
    <Modal title="Tarefa" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Título" span><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Descrição" span><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Responsável"><Input value={form.assignee} onChange={(e) => set("assignee", e.target.value)} /></Field>
        <Field label="Data"><Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
        <Field label="Prioridade">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value)}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </Field>
      </div>
      <div className="mt-3">
        <div className="text-xs font-medium text-zinc-500 mb-1.5">Subtarefas</div>
        <div className="space-y-1.5">
          {form.subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <input type="checkbox" checked={s.done} onChange={(e) => updateSub(s.id, { done: e.target.checked })} />
              <Input value={s.title} onChange={(e) => updateSub(s.id, { title: e.target.value })} className="flex-1" />
              <button onClick={() => removeSub(s.id)} className="text-zinc-300 hover:text-rose-600"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="secondary" onClick={addSub} className="mt-1.5"><Plus size={12} /> Subtarefa</Button>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
        {onDelete ? <Button variant="danger" size="sm" onClick={() => onDelete(form.id)}><Trash2 size={13} /> Excluir</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!form.title.trim()} onClick={() => onSave(form)}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   RELATÓRIOS
============================================================ */
function Relatorios({ state }) {
  const exportCsv = () => {
    const headers = ["Nome", "Telefone", "E-mail", "Sexo", "Idade", "Cidade", "Origem", "Status", "Produto", "Valor", "Criado em"];
    const rows = state.leads.map((l) => [l.name, l.phone, l.email, l.sex, l.age, l.city, l.origin, l.status, l.product, l.value, fmtDate(l.createdAt)]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gaid-crm-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-lg font-semibold text-zinc-900">Relatórios</h1>
      <Panel className="p-4">
        <div className="text-sm font-medium text-zinc-800">Exportar leads</div>
        <p className="mt-1 text-xs text-zinc-500">Gera um arquivo CSV com todos os leads cadastrados — compatível com Excel e Google Sheets. Exportação em PDF pode ser adicionada depois, se você precisar de um layout específico.</p>
        <Button size="sm" className="mt-3" onClick={exportCsv} disabled={!state.leads.length}><Download size={13} /> Baixar CSV</Button>
      </Panel>
      <Panel className="p-4">
        <div className="text-sm font-medium text-zinc-800 mb-2">Resumo geral</div>
        <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500 sm:grid-cols-4">
          <div>Leads: <b className="text-zinc-800">{state.leads.length}</b></div>
          <div>Pipelines: <b className="text-zinc-800">{state.pipelines.length}</b></div>
          <div>Campanhas: <b className="text-zinc-800">{state.campaigns.length}</b></div>
          <div>Scripts: <b className="text-zinc-800">{state.scripts.length}</b></div>
          <div>Objeções: <b className="text-zinc-800">{state.objections.length}</b></div>
          <div>Tarefas: <b className="text-zinc-800">{state.tasks.length}</b></div>
        </div>
      </Panel>
    </div>
  );
}

/* ============================================================
   CONFIGURAÇÕES
============================================================ */
function Configuracoes({ state, setState }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4 pb-10 max-w-lg">
      <h1 className="text-lg font-semibold text-zinc-900">Configurações</h1>
      <Panel className="p-4">
        <div className="text-sm font-medium text-zinc-800">Sobre os dados</div>
        <p className="mt-1 text-xs text-zinc-500">Todos os dados deste CRM ficam salvos automaticamente e são de uso pessoal — não são compartilhados com outros usuários. Nenhuma métrica é inventada: tudo é calculado a partir do que você cadastra.</p>
      </Panel>
      <Panel className="p-4">
        <div className="text-sm font-medium text-zinc-800">Zona de risco</div>
        <p className="mt-1 text-xs text-zinc-500">Apaga permanentemente todos os leads, pipelines, campanhas, scripts, objeções e tarefas.</p>
        {!confirm ? (
          <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirm(true)}><Trash2 size={13} /> Limpar todos os dados</Button>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={() => { setState(initialState); setConfirm(false); }}>Confirmar exclusão</Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(false)}>Cancelar</Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
