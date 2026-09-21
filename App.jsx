import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LayoutDashboard, Trello, Megaphone, ShieldAlert, FileText, Users,
  CheckSquare, BarChart3, Settings, Plus, X, Trash2, Pencil,
  GripVertical, ChevronDown, ChevronRight, Download, Search,
  Sparkles, Clock, HelpCircle, Filter as FilterIcon, Check, AlertCircle, Copy, Menu,
  Zap, TrendingUp, PieChart as PieChartIcon, Target,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

/* ============================================================
   CONSTANTS
============================================================ */
const STORAGE_KEY = "gaid_crm_state_v1";

const SEX_OPTIONS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const PIPELINE_COLORS = ["#EC4899", "#F43F5E", "#8B5CF6", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#64748B"];
const PRIORITIES = ["Baixa", "Média", "Alta", "Urgente"];
const TASK_STATUSES = ["A fazer", "Em andamento", "Concluída"];
const STATUS_KIND_LABEL = { normal: "Etapa do funil", won: "Conversão (ganho)", lost: "Perda" };

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
const usesScript = (lead, scriptId) => !!(lead.stepScripts && Object.values(lead.stepScripts).includes(scriptId));
const leadScriptIds = (lead) => (lead.stepScripts ? Object.values(lead.stepScripts).filter(Boolean) : []);

/* ---- editable lead-status system ---- */
const makeDefaultStatuses = () => [
  { id: uid(), name: "Novo", kind: "normal" },
  { id: uid(), name: "Contato Enviado", kind: "normal" },
  { id: uid(), name: "Respondeu", kind: "normal" },
  { id: uid(), name: "Qualificado", kind: "normal", isQualifiedMilestone: true },
  { id: uid(), name: "Oferta Enviada", kind: "normal" },
  { id: uid(), name: "Comprou", kind: "won" },
  { id: uid(), name: "Upsell", kind: "won", isUpsell: true },
  { id: uid(), name: "Não Comprou", kind: "lost" },
];
// funnel order = "normal" statuses (as stored) followed by "won" statuses (as stored); "lost" is excluded
const funnelSequence = (statuses) => [
  ...statuses.filter((s) => s.kind === "normal"),
  ...statuses.filter((s) => s.kind === "won"),
];
const findStatus = (statuses, name) => (statuses || []).find((s) => s.name === name);
const statusKind = (statuses, name) => findStatus(statuses, name)?.kind || "normal";
const isConvertedStatus = (statuses, name) => statusKind(statuses, name) === "won";
const isUpsellStatus = (statuses, name) => !!findStatus(statuses, name)?.isUpsell;
const statusBadgeClass = (statuses, name) => {
  const kind = statusKind(statuses, name);
  if (kind === "won") return "bg-emerald-50 text-emerald-700";
  if (kind === "lost") return "bg-rose-50 text-rose-700";
  return "bg-zinc-100 text-zinc-700";
};

const emptyLead = () => ({
  id: uid(), name: "", phone: "", email: "", sex: "", age: "", city: "",
  origin: "", campaignId: "", stepScripts: {}, objectionId: "", mainPain: "",
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
const emptyObjection = () => ({ id: uid(), name: "", script: "", conditions: [] });
const emptyTask = () => ({
  id: uid(), title: "", description: "", assignee: "", dueDate: "",
  priority: "Média", status: "A fazer", subtasks: [],
});

const initialState = {
  leads: [], pipelines: [], campaigns: [], scripts: [], objections: [], tasks: [],
  statuses: makeDefaultStatuses(),
};

/* ============================================================
   GLOBAL STYLE (glass, neon-pink accents, fluid motion)
============================================================ */
function GlobalStyles() {
  return (
    <style>{`
      @keyframes riseIn {
        from { opacity: 0; transform: translateY(18px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes popIn {
        from { opacity: 0; transform: translateY(8px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes fadeIn {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes floatA {
        0%, 100% { transform: translate(0,0) scale(1); }
        50% { transform: translate(24px, 26px) scale(1.08); }
      }
      @keyframes floatB {
        0%, 100% { transform: translate(0,0) scale(1); }
        50% { transform: translate(-26px, -18px) scale(0.94); }
      }
      @keyframes floatC {
        0%, 100% { transform: translate(0,0) scale(1); }
        50% { transform: translate(-16px, 22px) scale(1.1); }
      }
      @keyframes iconFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
      @keyframes glowPulse {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 0.9; }
      }
      .rise-in { animation: riseIn 0.55s cubic-bezier(.16,1,.3,1) both; }
      .pop-in { animation: popIn 0.22s cubic-bezier(.16,1,.3,1) both; }
      .fade-in { animation: fadeIn 0.2s ease-out both; }
      .icon-float { animation: iconFloat 3.2s ease-in-out infinite; }
      .orb { position: absolute; border-radius: 9999px; filter: blur(46px); }
      .orb-a { width: 240px; height: 240px; top: -60px; left: -30px; background: radial-gradient(circle, rgba(244,114,182,0.55), transparent 70%); animation: floatA 15s ease-in-out infinite; }
      .orb-b { width: 220px; height: 220px; bottom: -60px; right: 6%; background: radial-gradient(circle, rgba(167,139,250,0.4), transparent 70%); animation: floatB 19s ease-in-out infinite; }
      .orb-c { width: 180px; height: 180px; top: 20%; right: -50px; background: radial-gradient(circle, rgba(251,113,133,0.4), transparent 70%); animation: floatC 21s ease-in-out infinite; }
      * { -webkit-tap-highlight-color: transparent; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(236,72,153,0.18); border-radius: 8px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(236,72,153,0.34); }
    `}</style>
  );
}
function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
    </div>
  );
}
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const startVal = from.current;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = startVal + (target - startVal) * eased;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}
function CountUp({ value, format }) {
  const animated = useCountUp(value || 0);
  return <>{format ? format(animated) : Math.round(animated)}</>;
}
const CHART_PINKS = ["#ec4899", "#f472b6", "#fb7185", "#f43f5e", "#c084fc", "#a78bfa", "#818cf8"];
const chartTooltipStyle = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(244,114,182,0.25)",
  borderRadius: "12px",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgba(236,72,153,0.15)",
};

/* ============================================================
   PRIMITIVES
============================================================ */
function Panel({ children, className = "", rise, delay = 0 }) {
  return (
    <div
      className={`relative rounded-2xl border border-zinc-200/70 bg-white/95 backdrop-blur-sm shadow-sm shadow-zinc-200/50 ${rise ? "rise-in" : ""} ${className}`}
      style={rise ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-300/50 hover:shadow-lg hover:shadow-pink-300/60 hover:brightness-105",
    secondary: "bg-white/90 text-zinc-700 border border-zinc-200 hover:bg-white shadow-sm",
    ghost: "text-zinc-500 hover:bg-pink-50/80 hover:text-pink-700",
    danger: "text-rose-600 hover:bg-rose-50",
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 ease-out active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${sizes[size]} ${variants[variant]} ${className}`}
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
const inputCls = "w-full rounded-xl border border-zinc-200 bg-white/70 backdrop-blur-sm px-2.5 py-1.5 text-sm text-zinc-800 outline-none transition-all duration-200 focus:border-pink-400 focus:ring-2 focus:ring-pink-200/70 focus:bg-white";

function Input(props) { return <input {...props} className={`${inputCls} ${props.className || ""}`} />; }
function Select({ children, ...props }) { return <select {...props} className={`${inputCls} bg-white/70 ${props.className || ""}`}>{children}</select>; }
function Textarea(props) { return <textarea {...props} className={`${inputCls} resize-none ${props.className || ""}`} />; }

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/65 backdrop-blur-md p-4 sm:p-8 fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`pop-in w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-zinc-200/70 bg-white/97 backdrop-blur-sm shadow-2xl shadow-zinc-900/10 mt-4 mb-8`}>
        <div className="flex items-center justify-between border-b border-zinc-100/80 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 transition-all duration-150 hover:bg-pink-50 hover:text-pink-600 active:scale-90"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
function StatCard({ label, value, sub, delay = 0, trend }) {
  const hasTrend = trend && trend.length > 1 && trend.some((v) => v > 0);
  return (
    <Panel className="relative overflow-hidden p-4 transition-transform duration-300 hover:-translate-y-0.5" rise delay={delay}>
      {hasTrend && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 opacity-50">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.map((v, i) => ({ i, v }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Line type="monotone" dataKey="v" stroke="#2563EB" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative">
        <div className="text-xs font-medium text-zinc-500">{label}</div>
        <div className="mt-1.5 text-3xl font-bold text-zinc-900 tabular-nums">{value}</div>
        {sub ? <div className="mt-0.5 text-xs text-zinc-400">{sub}</div> : null}
      </div>
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
function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="rise-in flex flex-col items-center justify-center rounded-2xl border border-zinc-200/70 bg-white/95 py-16 text-center shadow-sm shadow-zinc-200/50">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-50 to-zinc-100" />
        <Icon size={24} className="relative text-pink-400" strokeWidth={1.75} />
      </div>
      <div className="mt-4 text-sm font-medium text-zinc-700">{title}</div>
      {hint ? <div className="mt-1 max-w-xs text-xs text-zinc-400">{hint}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
function Badge({ children, className = "" }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${className}`}>{children}</span>;
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
    <button onClick={doCopy} className={`shrink-0 flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium transition-all duration-150 active:scale-90 ${copied ? "text-emerald-600" : "text-zinc-400 hover:text-pink-600 hover:bg-pink-50"}`}>
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
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.statuses || !parsed.statuses.length) parsed.statuses = makeDefaultStatuses();
        if (parsed.objections) {
          parsed.objections = parsed.objections.map((o) => {
            if (typeof o.script === "string" && Array.isArray(o.conditions)) return o; // already current format
            if (Array.isArray(o.conditions) && o.conditions.length) {
              const [first, ...rest] = o.conditions;
              return {
                id: o.id, name: o.name,
                script: first?.script || "",
                conditions: rest.map((c) => ({ id: c.id || uid(), label: c.label || "", script: c.script || "" })),
              };
            }
            return { id: o.id, name: o.name, script: o.script || "", conditions: [] };
          });
        }
        setState({ ...initialState, ...parsed });
      }
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
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-400" style={{ background: "#F9FAFB" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" />
          <span>Carregando GAID CRM…</span>
        </div>
      </div>
    );
  }

  const activeLabel = NAV_ITEMS.find((n) => n.id === view)?.label || "GAID CRM";

  return (
    <div
      className="flex h-screen w-full text-zinc-800"
      style={{
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        background: "radial-gradient(1100px circle at 15% -10%, rgba(236,72,153,0.05), transparent 40%), #F9FAFB",
      }}
    >
      <GlobalStyles />
      <Sidebar
        view={view}
        setView={(v) => { setView(v); setSidebarOpen(false); }}
        saving={saving}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-zinc-200/70 bg-white/90 backdrop-blur-sm px-4 py-3 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-500 transition-all duration-150 active:scale-90 hover:text-pink-600">
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-zinc-900">{activeLabel}</span>
        </div>
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div key={view} className="fade-in mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {view === "dashboard" && <Dashboard state={state} onNavigate={setView} />}
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
      <BottomNav view={view} setView={setView} onMore={() => setSidebarOpen(true)} />
    </div>
  );
}

const BOTTOM_NAV_ITEMS = [
  { id: "dashboard", label: "Início", icon: LayoutDashboard },
  { id: "pipelines", label: "Pipelines", icon: Trello },
  { id: "leads", label: "Leads", icon: Users },
  { id: "campanhas", label: "Campanhas", icon: Megaphone },
  { id: "tarefas", label: "Tarefas", icon: CheckSquare },
];
function BottomNav({ view, setView, onMore }) {
  const isMoreActive = !BOTTOM_NAV_ITEMS.some((i) => i.id === view);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-zinc-200/70 bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className="group flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-all duration-150 active:scale-95"
          >
            <Icon size={20} strokeWidth={2} className={`transition-all duration-200 ${active ? "text-pink-600 scale-110" : "text-zinc-400 group-hover:text-pink-400"}`} />
            <span className={`text-[10px] font-medium ${active ? "text-pink-600" : "text-zinc-400"}`}>{item.label}</span>
          </button>
        );
      })}
      <button onClick={onMore} className="group flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-all duration-150 active:scale-95">
        <Menu size={20} strokeWidth={2} className={`transition-all duration-200 ${isMoreActive ? "text-pink-600 scale-110" : "text-zinc-400 group-hover:text-pink-400"}`} />
        <span className={`text-[10px] font-medium ${isMoreActive ? "text-pink-600" : "text-zinc-400"}`}>Mais</span>
      </button>
    </nav>
  );
}

function Sidebar({ view, setView, saving, open, onClose }) {
  return (
    <>
      {open && (
        <div onClick={onClose} className="fade-in fixed inset-0 z-30 bg-zinc-900/40 backdrop-blur-sm md:hidden" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-zinc-200/70 bg-white/95 backdrop-blur-sm transition-transform duration-300 ease-out md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-xs font-bold text-white shadow-md shadow-pink-300/50">G</div>
            <div>
              <div className="text-sm font-semibold leading-none text-zinc-900">GAID CRM</div>
              <div className="mt-0.5 text-[11px] leading-none text-zinc-400">Inteligência comercial</div>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 transition-all duration-150 active:scale-90 hover:text-pink-600 md:hidden">
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
                className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-pink-50 to-rose-50 text-pink-700 font-medium shadow-sm shadow-pink-100"
                    : "text-zinc-600 hover:bg-pink-50/60 hover:text-pink-700"
                }`}
              >
                <Icon size={16} strokeWidth={2} className="transition-transform duration-200 group-hover:scale-110 group-active:scale-95" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5 px-4 py-3 text-[11px] text-zinc-400">
          <span className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
          {saving ? "Salvando…" : "Dados salvos"}
        </div>
      </aside>
    </>
  );
}

/* ============================================================
   METRICS ENGINE
============================================================ */
function useMetrics(state) {
  return useMemo(() => {
    const { leads, campaigns, scripts, objections, statuses } = state;
    const totalLeads = leads.length;
    const converted = leads.filter((l) => isConvertedStatus(statuses, l.status));
    const lostNames = statuses.filter((s) => s.kind === "lost").map((s) => s.name);
    const activeLeads = leads.filter((l) => !isConvertedStatus(statuses, l.status) && !lostNames.includes(l.status));
    const revenue = converted.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const avgTicket = converted.length ? revenue / converted.length : null;
    const overallConversion = rate(converted.length, totalLeads);

    // funnel: reached-or-beyond count per status (normal statuses, then won statuses, in order)
    const seq = funnelSequence(statuses);
    const idx = (s) => seq.findIndex((st) => st.name === s);
    const funnel = seq.map((st, i) => {
      const reached = leads.filter((l) => idx(l.status) >= i && idx(l.status) !== -1).length;
      return { status: st.name, reached };
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
    statuses.forEach((st) => {
      const durations = [];
      leads.forEach((l) => {
        const hist = l.statusHistory || [];
        hist.forEach((entry, i) => {
          if (entry.status !== st.name) return;
          const end = hist[i + 1] ? hist[i + 1].at : now();
          durations.push(hoursBetween(entry.at, end));
        });
      });
      if (durations.length) timeInStatus[st.name] = durations.reduce((a, b) => a + b, 0) / durations.length;
    });

    // best campaign / script / objection
    const rankBy = (list, keyField) => list.map((item) => {
      const its = leads.filter((l) => l[keyField] === item.id);
      const conv = its.filter((l) => isConvertedStatus(statuses, l.status)).length;
      return { item, total: its.length, conv, convRate: rate(conv, its.length) };
    }).filter((r) => r.total > 0).sort((a, b) => (b.convRate ?? -1) - (a.convRate ?? -1));

    const campaignRank = rankBy(campaigns, "campaignId");
    const scriptRank = scripts.map((sc) => {
      const its = leads.filter((l) => usesScript(l, sc.id));
      const conv = its.filter((l) => isConvertedStatus(statuses, l.status)).length;
      return { item: sc, total: its.length, conv, convRate: rate(conv, its.length) };
    }).filter((r) => r.total > 0).sort((a, b) => (b.convRate ?? -1) - (a.convRate ?? -1));
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

    // chart-ready data: status donut, origin bars, trend line
    const statusDist = statuses.map((s) => ({
      name: s.name, kind: s.kind,
      value: leads.filter((l) => l.status === s.name).length,
    })).filter((d) => d.value > 0);

    const originCounts = {};
    leads.forEach((l) => {
      const key = l.origin && l.origin.trim() ? l.origin.trim() : "Não informado";
      originCounts[key] = (originCounts[key] || 0) + 1;
    });
    const originDist = Object.entries(originCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    const dayKey = (iso) => (iso || "").slice(0, 10);
    const wonNames = statuses.filter((s) => s.kind === "won").map((s) => s.name);
    const newByDay = {};
    leads.forEach((l) => { const k = dayKey(l.createdAt); if (k) newByDay[k] = (newByDay[k] || 0) + 1; });
    const wonByDay = {};
    leads.forEach((l) => {
      if (!isConvertedStatus(statuses, l.status)) return;
      const hist = l.statusHistory || [];
      const wonEntry = hist.find((h) => wonNames.includes(h.status));
      const k = dayKey(wonEntry ? wonEntry.at : l.createdAt);
      if (k) wonByDay[k] = (wonByDay[k] || 0) + 1;
    });
    const allDays = [...new Set([...Object.keys(newByDay), ...Object.keys(wonByDay)])].sort();
    const trend = allDays.slice(-30).map((d) => ({
      date: d.slice(5).split("-").reverse().join("/"),
      novos: newByDay[d] || 0,
      conversoes: wonByDay[d] || 0,
    }));
    const revenueByDay = {};
    leads.forEach((l) => {
      if (!isConvertedStatus(statuses, l.status)) return;
      const hist = l.statusHistory || [];
      const wonEntry = hist.find((h) => wonNames.includes(h.status));
      const k = dayKey(wonEntry ? wonEntry.at : l.createdAt);
      if (k) revenueByDay[k] = (revenueByDay[k] || 0) + (Number(l.value) || 0);
    });
    const revenueTrend = allDays.slice(-30).map((d) => ({
      date: d.slice(5).split("-").reverse().join("/"),
      receita: Math.round((revenueByDay[d] || 0) * 100) / 100,
    }));

    return {
      totalLeads, activeLeads: activeLeads.length, convertedLeads: converted.length,
      revenue, avgTicket, overallConversion, funnel: funnelWithRate, bottleneck, timeInStatus,
      campaignRank, scriptRank, objectionRank, sexDist, ageDist, topCities, productInsights, converted,
      statusDist, originDist, trend, revenueTrend,
    };
  }, [state]);
}

/* ============================================================
   DASHBOARD
============================================================ */
function Dashboard({ state, onNavigate }) {
  const m = useMetrics(state);
  const hasData = state.leads.length > 0;
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);

  const priorityWeight = { "Urgente": 0, "Alta": 1 };
  const urgentTasks = state.tasks
    .filter((t) => (t.priority === "Urgente" || t.priority === "Alta") && t.status === "A fazer")
    .sort((a, b) => (priorityWeight[a.priority] - priorityWeight[b.priority]) || (a.dueDate || "").localeCompare(b.dueDate || ""));
  const taskPriorityColor = { Alta: "bg-amber-50 text-amber-700", Urgente: "bg-rose-50 text-rose-700" };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Visão Geral de Negócios</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Métricas em tempo real.</p>
      </div>

      <div>
        <SectionTitle
          action={state.tasks.length > 0 && <button onClick={() => onNavigate && onNavigate("tarefas")} className="text-xs font-medium text-pink-600 transition-colors hover:text-pink-700 hover:underline">Ver todas as tarefas</button>}
        >
          Tarefas prioritárias em aberto
        </SectionTitle>
        <Panel className={urgentTasks.length === 0 ? "border-l-4 border-l-emerald-500 p-2" : "p-2"} rise>
          {urgentTasks.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <Check size={16} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-800">Tudo em ordem</div>
                <div className="text-xs text-zinc-400">Nenhuma tarefa urgente ou de alta prioridade pendente.</div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100/70">
              {urgentTasks.slice(0, 6).map((t, ti) => (
                <div
                  key={t.id}
                  onClick={() => onNavigate && onNavigate("tarefas")}
                  style={{ animationDelay: `${ti * 40}ms` }}
                  className="rise-in flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-pink-50/50"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${t.priority === "Urgente" ? "bg-rose-500 animate-pulse" : "bg-amber-400"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-800">{t.title || "Sem título"}</div>
                    <div className="text-xs text-zinc-400">{t.assignee || "Sem responsável"}{t.dueDate ? ` · vence ${fmtDate(t.dueDate)}` : ""}</div>
                  </div>
                  <Badge className={taskPriorityColor[t.priority]}>{t.priority}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {!hasData && (
        <EmptyState icon={BarChart3} title="Nenhum dado ainda" hint="Cadastre leads em Pipelines ou na aba Leads para o dashboard começar a calcular métricas reais." />
      )}

      {hasData && (
        <>
          <div>
            <SectionTitle>Comercial</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Leads totais" value={m.totalLeads} delay={0} trend={m.trend.map((d) => d.novos)} />
              <StatCard label="Leads ativos" value={m.activeLeads} delay={40} />
              <StatCard label="Convertidos" value={m.convertedLeads} delay={80} />
              <StatCard label="Receita" value={fmtMoney(m.revenue)} delay={120} trend={m.revenueTrend.map((d) => d.receita)} />
              <StatCard label="Ticket médio" value={m.avgTicket ? fmtMoney(m.avgTicket) : "—"} delay={160} />
              <StatCard label="Conversão geral" value={fmtRate(m.overallConversion)} delay={200} />
            </div>
          </div>

          <div>
            <SectionTitle>Visão em gráficos</SectionTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Panel className="p-4 lg:col-span-2" rise delay={40}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                  <PieChartIcon size={13} className="text-pink-400" /> Leads por status
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={m.statusDist} dataKey="value" nameKey="name" innerRadius={54} outerRadius={80} paddingAngle={3} isAnimationActive animationDuration={900} animationEasing="ease-out">
                        {m.statusDist.map((d, i) => (
                          <Cell key={d.name} fill={d.kind === "won" ? "#10b981" : d.kind === "lost" ? "#f43f5e" : CHART_PINKS[i % CHART_PINKS.length]} stroke="rgba(255,255,255,0.8)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {m.statusDist.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.kind === "won" ? "#10b981" : d.kind === "lost" ? "#f43f5e" : CHART_PINKS[i % CHART_PINKS.length] }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="p-4 lg:col-span-3" rise delay={80}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                  <BarChart3 size={13} className="text-pink-400" /> Leads por origem
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.originDist} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={40} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(236,72,153,0.06)" }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out">
                        {m.originDist.map((d, i) => <Cell key={d.name} fill={CHART_PINKS[i % CHART_PINKS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            {m.trend.length > 1 && (
              <Panel className="mt-4 p-4" rise delay={120}>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                  <TrendingUp size={13} className="text-pink-400" /> Leads e conversões ao longo do tempo
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={m.trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="novos" name="Novos leads" stroke="#ec4899" strokeWidth={2.5} dot={false} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
                      <Line type="monotone" dataKey="conversoes" name="Conversões" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive animationDuration={1000} animationEasing="ease-out" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            )}
          </div>

          <div>
            <SectionTitle>Funil</SectionTitle>
            <Panel className="p-4" rise delay={80}>
              <div className="space-y-2">
                {m.funnel.map((f, fi) => {
                  const width = m.funnel[0].reached ? Math.max(4, (f.reached / m.funnel[0].reached) * 100) : 0;
                  const isBottleneck = m.bottleneck && m.bottleneck.status === f.status;
                  return (
                    <div key={f.status} className="flex items-center gap-3">
                      <div className="w-32 shrink-0 text-xs text-zinc-600">{f.status}</div>
                      <div className="h-6 flex-1 rounded-full bg-zinc-100/80 overflow-hidden">
                        <div
                          className={`h-6 rounded-full transition-all ease-out ${isBottleneck ? "bg-gradient-to-r from-rose-400 to-rose-500" : "bg-gradient-to-r from-pink-500 to-rose-400"}`}
                          style={{ width: grown ? `${width}%` : "0%", transitionDuration: "800ms", transitionDelay: `${fi * 60}ms` }}
                        />
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
                {m.funnel.map((f) => (
                  <span key={f.status} className="text-zinc-400">{f.status}: <b className="text-zinc-600">{fmtDuration(m.timeInStatus[f.status])}</b></span>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <SectionTitle>Campanhas</SectionTitle>
              <Panel className="p-4 space-y-2 text-sm" rise delay={120}>
                <RankLine label="Melhor campanha" rank={m.campaignRank} state={state} entity="campaigns" />
                <RankLine label="Melhor script" rank={m.scriptRank} state={state} entity="scripts" />
                <RankLine label="Melhor objeção tratada" rank={m.objectionRank} state={state} entity="objections" />
              </Panel>
            </div>
            <div>
              <SectionTitle>Perfil dos compradores</SectionTitle>
              <Panel className="p-4 space-y-3 text-sm" rise delay={160}>
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
                {m.productInsights.map((p, pi) => (
                  <Panel key={p.product} className="p-4 text-sm" rise delay={200 + pi * 40}>
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
  const [statusModal, setStatusModal] = useState(false);

  useEffect(() => {
    if (!selected && state.pipelines.length) setSelected(state.pipelines[0].id);
  }, [state.pipelines, selected]);

  const pipeline = state.pipelines.find((p) => p.id === selected);

  const saveStatuses = (newList) => {
    const oldById = {};
    state.statuses.forEach((s) => { oldById[s.id] = s.name; });
    const newById = {};
    newList.forEach((s) => { newById[s.id] = s.name; });
    const fallbackName = newList[0]?.name || "";
    const mapName = (name) => {
      const id = Object.keys(oldById).find((k) => oldById[k] === name);
      if (!id) return name;
      return newById[id] || fallbackName;
    };
    update("leads", (list) => list.map((l) => ({
      ...l,
      status: mapName(l.status),
      statusHistory: (l.statusHistory || []).map((h) => ({ ...h, status: mapName(h.status) })),
    })));
    update("pipelines", (list) => list.map((p) => ({
      ...p,
      stages: p.stages.map((s) => ({ ...s, statusMap: s.statusMap ? mapName(s.statusMap) : s.statusMap })),
    })));
    update("statuses", () => newList);
    setStatusModal(false);
  };

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
        <h1 className="text-xl font-bold text-zinc-900">Pipelines</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStatusModal(true)}><Settings size={14} /> Gerenciar status</Button>
          <Button onClick={() => setPipeModal(emptyPipeline())}><Plus size={14} /> Criar Pipeline</Button>
        </div>
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
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95 ${
                  selected === p.id
                    ? "border-white/80 bg-white/80 backdrop-blur-md text-zinc-800 shadow-sm shadow-pink-100"
                    : "border-transparent text-zinc-500 hover:bg-white/50"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.name || "Sem nome"}
                {selected === p.id && (
                  <span onClick={(e) => { e.stopPropagation(); setPipeModal(p); }} className="ml-1 text-zinc-400 transition-colors hover:text-pink-600"><Pencil size={11} /></span>
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
                    className="flex w-64 shrink-0 flex-col rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md transition-colors duration-200"
                  >
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
                      {editingStage === stage.id ? (
                        <input
                          autoFocus defaultValue={stage.name}
                          onBlur={(e) => { renameStage(stage.id, e.target.value || stage.name); setEditingStage(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          className="w-full rounded-lg border border-pink-300 px-1.5 py-0.5 text-xs font-semibold outline-none ring-2 ring-pink-200/70"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                          {stage.name}
                          <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-zinc-500 tabular-nums">{stageLeads.length}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 text-zinc-400">
                        <button onClick={() => moveStage(stage.id, -1)} disabled={i === 0} className="rounded p-0.5 transition-all duration-150 hover:text-pink-600 active:scale-90 disabled:opacity-30"><ChevronRight size={12} className="rotate-180" /></button>
                        <button onClick={() => moveStage(stage.id, 1)} disabled={i === pipeline.stages.length - 1} className="rounded p-0.5 transition-all duration-150 hover:text-pink-600 active:scale-90 disabled:opacity-30"><ChevronRight size={12} /></button>
                        <button onClick={() => setEditingStage(stage.id)} className="rounded p-0.5 transition-all duration-150 hover:text-pink-600 active:scale-90"><Pencil size={11} /></button>
                        <button onClick={() => deleteStage(stage.id)} className="rounded p-0.5 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <div className="px-3 pb-2">
                      <select
                        value={stage.statusMap || ""}
                        onChange={(e) => setStageStatusMap(stage.id, e.target.value)}
                        title="Status aplicado automaticamente aos leads movidos para esta etapa"
                        className={`w-full rounded-lg border px-1.5 py-1 text-[11px] outline-none transition-colors duration-200 ${stage.statusMap ? "border-pink-200 bg-pink-50/80 text-pink-700" : "border-dashed border-zinc-300 bg-white/40 text-zinc-400"}`}
                      >
                        <option value="">Sem status vinculado</option>
                        {state.statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 space-y-2 px-2 pb-2 min-h-[60px]">
                      {stageLeads.map((lead, li) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDragLeadId(lead.id)}
                          onClick={() => setLeadModal(lead)}
                          style={{ animationDelay: `${Math.min(li, 8) * 45}ms` }}
                          className="rise-in cursor-pointer rounded-xl border border-white/70 bg-white/75 backdrop-blur-md p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300 hover:shadow-lg hover:shadow-pink-200/50 active:scale-[0.98]"
                        >
                          <div className="text-xs font-medium text-zinc-800">{lead.name || "Sem nome"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <Badge className={statusBadgeClass(state.statuses, lead.status)}>{lead.status}</Badge>
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
                      className="mx-2 mb-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition-all duration-150 hover:bg-pink-50/80 hover:text-pink-700 active:scale-95"
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
      {statusModal && <StatusManagerModal state={state} onClose={() => setStatusModal(false)} onSave={saveStatuses} />}
    </div>
  );
}

function StatusManagerModal({ state, onClose, onSave }) {
  const [list, setList] = useState(state.statuses);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("normal");

  const patch = (id, p) => setList((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (id, dir) => setList((l) => {
    const idx = l.findIndex((s) => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= l.length) return l;
    const copy = [...l];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    return copy;
  });
  const addStatus = () => {
    if (!newName.trim()) return;
    setList((l) => [...l, { id: uid(), name: newName.trim(), kind: newKind }]);
    setNewName("");
    setNewKind("normal");
  };
  const removeStatus = (id) => setList((l) => l.filter((s) => s.id !== id));
  const setQualifiedMilestone = (id) => setList((l) => l.map((s) => ({ ...s, isQualifiedMilestone: s.id === id })));

  return (
    <Modal title="Status dos leads" onClose={onClose} wide>
      <p className="mb-3 text-xs text-zinc-500">
        Esses são os status disponíveis no cadastro do lead e para vincular às etapas de qualquer pipeline.
        Crie quantos precisar (ex: "Envio de formulário", "Em teste") e diga se cada um representa uma
        etapa normal do funil, uma conversão (ganho) ou uma perda.
      </p>
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {list.map((s, i) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 p-2">
            <div className="flex flex-col text-zinc-300">
              <button onClick={() => move(s.id, -1)} disabled={i === 0} className="hover:text-zinc-700 disabled:opacity-30"><ChevronDown size={12} className="rotate-180" /></button>
              <button onClick={() => move(s.id, 1)} disabled={i === list.length - 1} className="hover:text-zinc-700 disabled:opacity-30"><ChevronDown size={12} /></button>
            </div>
            <Input value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} className="min-w-[9rem] flex-1" />
            <Select
              value={s.kind}
              onChange={(e) => patch(s.id, { kind: e.target.value, isUpsell: e.target.value === "won" ? s.isUpsell : false, isQualifiedMilestone: e.target.value === "normal" ? s.isQualifiedMilestone : false })}
              className="w-44"
            >
              <option value="normal">{STATUS_KIND_LABEL.normal}</option>
              <option value="won">{STATUS_KIND_LABEL.won}</option>
              <option value="lost">{STATUS_KIND_LABEL.lost}</option>
            </Select>
            {s.kind === "normal" && (
              <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-zinc-500">
                <input type="checkbox" checked={!!s.isQualifiedMilestone} onChange={() => setQualifiedMilestone(s.id)} /> Marco de qualificação
              </label>
            )}
            {s.kind === "won" && (
              <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-zinc-500">
                <input type="checkbox" checked={!!s.isUpsell} onChange={(e) => patch(s.id, { isUpsell: e.target.checked })} /> É upsell
              </label>
            )}
            <button onClick={() => removeStatus(s.id)} className="ml-auto text-zinc-300 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Input placeholder='Novo status (ex: "Em teste")' value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStatus()} className="min-w-[10rem] flex-1" />
        <Select value={newKind} onChange={(e) => setNewKind(e.target.value)} className="w-44">
          <option value="normal">{STATUS_KIND_LABEL.normal}</option>
          <option value="won">{STATUS_KIND_LABEL.won}</option>
          <option value="lost">{STATUS_KIND_LABEL.lost}</option>
        </Select>
        <Button size="sm" variant="secondary" onClick={addStatus}><Plus size={13} /> Adicionar</Button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        Renomear um status atualiza automaticamente os leads e etapas que já usavam ele. Excluir um status
        move os leads e etapas afetados para o primeiro status da lista.
      </p>
      <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-3">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" disabled={!list.length} onClick={() => onSave(list)}>Salvar</Button>
      </div>
    </Modal>
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
        <Field label="Objeção">
          <Select value={form.objectionId} onChange={(e) => set("objectionId", e.target.value)}>
            <option value="">—</option>
            {state.objections.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => setStatus(e.target.value)}>
            {state.statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
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
      <ScriptsByStepField form={form} setForm={setForm} state={state} />
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

function ScriptsByStepField({ form, setForm, state }) {
  const campaign = state.campaigns.find((c) => c.id === form.campaignId);
  const setStepScript = (stepId, scriptId) => setForm((f) => ({ ...f, stepScripts: { ...f.stepScripts, [stepId]: scriptId } }));

  if (!campaign) {
    return <p className="mt-3 text-xs text-zinc-400">Selecione uma campanha para registrar qual script foi usado em cada etapa da conversa com esse lead.</p>;
  }
  return (
    <div className="mt-4 rounded-md border border-zinc-200 p-3">
      <div className="mb-2 text-xs font-medium text-zinc-500">Script usado em cada etapa — {campaign.name}</div>
      <div className="space-y-2">
        {campaign.steps.map((step) => {
          const options = state.scripts.filter((s) => s.stageId === step.id);
          return (
            <div key={step.id} className="flex items-center gap-2">
              <span className="w-36 shrink-0 text-xs text-zinc-600">{step.name}</span>
              {options.length ? (
                <Select value={(form.stepScripts && form.stepScripts[step.id]) || ""} onChange={(e) => setStepScript(step.id, e.target.value)} className="flex-1">
                  <option value="">—</option>
                  {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              ) : (
                <span className="flex-1 text-xs text-zinc-400">Nenhum script cadastrado para esta etapa ainda</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
    if (filters.scriptId && !usesScript(l, filters.scriptId)) return false;
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
        <h1 className="text-xl font-bold text-zinc-900">Leads</h1>
        <Button onClick={() => setModal(emptyLead())}><Plus size={14} /> Novo lead</Button>
      </div>

      <Panel className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-400" />
            <Input placeholder="Buscar nome, e-mail, telefone" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full pl-8 w-52" />
          </div>
          <Select value={filters.status} onChange={(e) => setF("status", e.target.value)} className="w-36"><option value="">Status</option>{state.statuses.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</Select>
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
                <tr key={l.id} className="border-b border-zinc-100/60 hover:bg-pink-50/50 transition-colors duration-150 cursor-pointer" onClick={() => setModal(l)}>
                  <td className="px-3 py-2 font-medium text-zinc-800">{l.name || "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{l.email || l.phone || "—"}</td>
                  <td className="px-3 py-2"><Badge className={statusBadgeClass(state.statuses, l.status)}>{l.status}</Badge></td>
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
    const conv = its.filter((l) => isConvertedStatus(state.statuses, l.status)).length;
    return { total: its.length, conv, r: rate(conv, its.length) };
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Campanhas</h1>
        <Button onClick={() => setModal(emptyCampaign())}><Plus size={14} /> Criar Campanha</Button>
      </div>
      {state.campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha criada" hint="Campanhas ajudam a medir experimentos comerciais: mensagens, ofertas e scripts testados." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.campaigns.map((c, ci) => {
            const m = rankBy(c.id);
            return (
              <Panel key={c.id} className="p-4 transition-transform duration-300 hover:-translate-y-0.5" rise delay={ci * 50}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">{c.name}</div>
                    <div className="text-xs text-zinc-400">{c.objective}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(c)} className="text-zinc-400 transition-all duration-150 hover:text-pink-600 active:scale-90"><Pencil size={13} /></button>
                    <button onClick={() => remove("campaigns", c.id)} className="text-zinc-400 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                  <span>Leads: <b className="text-zinc-700">{m.total}</b></span>
                  <span>Conversão: <b className="text-zinc-700">{fmtRate(m.r)}</b></span>
                  <span>{fmtDate(c.date)}</span>
                </div>
                <button onClick={() => setDetail(c)} className="mt-3 text-xs font-medium text-pink-600 hover:text-pink-700 hover:underline transition-colors duration-150">Ver etapas da campanha ({c.steps.length})</button>
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
              <button onClick={() => removeStep(s.id)} className="text-zinc-400 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={13} /></button>
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
  const seq = funnelSequence(state.statuses);
  const idxOf = (name) => seq.findIndex((s) => s.name === name);
  const qualifiedIdx = seq.findIndex((s) => s.isQualifiedMilestone);
  const fallbackQualifiedIdx = Math.ceil(seq.filter((s) => s.kind === "normal").length / 2);
  const metricsFor = (scriptId) => {
    const its = state.leads.filter((l) => usesScript(l, scriptId));
    const responded = its.filter((l) => idxOf(l.status) >= 1).length;
    const qualified = its.filter((l) => idxOf(l.status) >= (qualifiedIdx >= 0 ? qualifiedIdx : fallbackQualifiedIdx)).length;
    const purchased = its.filter((l) => isConvertedStatus(state.statuses, l.status)).length;
    const upsold = its.filter((l) => isUpsellStatus(state.statuses, l.status)).length;
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
        <h1 className="text-xl font-bold text-zinc-900">Scripts</h1>
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
                  <tr key={s.id} className="border-b border-zinc-100/60 hover:bg-pink-50/50 transition-colors duration-150">
                    <td className="px-3 py-2 font-medium text-zinc-800 cursor-pointer" onClick={() => setModal(s)}>{s.name}</td>
                    <td className="px-3 py-2 text-zinc-500">{campaign?.name || "—"}</td>
                    <td className="px-3 py-2 text-zinc-500 tabular-nums">{m.total}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.responseRate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.qualificationRate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.saleRate)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtRate(m.upsellRate)}</td>
                    <td className="px-3 py-2 text-right"><button onClick={() => remove("scripts", s.id)} className="text-zinc-300 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={12} /></button></td>
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
  const [expanded, setExpanded] = useState({});
  const bestScriptFor = (objectionId) => {
    const rows = state.scripts.map((sc) => {
      const its = state.leads.filter((l) => l.objectionId === objectionId && usesScript(l, sc.id));
      const conv = its.filter((l) => isConvertedStatus(state.statuses, l.status)).length;
      return { script: sc, total: its.length, r: rate(conv, its.length) };
    }).filter((r) => r.total > 0).sort((a, b) => (b.r ?? -1) - (a.r ?? -1));
    return rows;
  };
  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Objeções</h1>
        <Button onClick={() => setModal(emptyObjection())}><Plus size={14} /> Nova objeção</Button>
      </div>
      {state.objections.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Nenhuma objeção cadastrada" hint="Cadastre as objeções mais comuns (preço, tempo, confiança...) para identificar automaticamente o melhor script para cada uma." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.objections.map((o, oi) => {
            const rows = bestScriptFor(o.id);
            const conditions = (o.conditions || []).filter((c) => c.script || c.label);
            const isOpen = !!expanded[o.id];
            return (
              <Panel key={o.id} className="p-4 transition-transform duration-300 hover:-translate-y-0.5" rise delay={oi * 50}>
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold text-zinc-800">{o.name}</div>
                  <div className="flex gap-1">
                    <button onClick={() => setModal(o)} className="text-zinc-400 transition-all duration-150 hover:text-pink-600 active:scale-90"><Pencil size={13} /></button>
                    <button onClick={() => remove("objections", o.id)} className="text-zinc-400 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={13} /></button>
                  </div>
                </div>

                {o.script && (
                  <div className="mt-2 rounded-xl border border-white/60 bg-white/50 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-zinc-500 whitespace-pre-wrap">{o.script}</p>
                      <CopyButton text={o.script} />
                    </div>
                  </div>
                )}

                {conditions.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [o.id]: !isOpen }))}
                      className="flex items-center gap-1 text-[11px] font-medium text-pink-600 transition-colors duration-150 hover:text-pink-700"
                    >
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      {isOpen ? "Mostrar menos" : `Mostrar mais (${conditions.length} condiç${conditions.length > 1 ? "ões" : "ão"})`}
                    </button>
                    {isOpen && (
                      <div className="space-y-2 border-l-2 border-pink-200/70 pl-3">
                        {conditions.map((c) => (
                          <div key={c.id} className="rounded-xl border border-white/60 bg-white/50 p-2">
                            {c.label && <div className="mb-1 text-[11px] font-semibold text-pink-600">↳ {c.label}</div>}
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs text-zinc-500 whitespace-pre-wrap">{c.script || "—"}</p>
                              {c.script && <CopyButton text={c.script} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 border-t border-zinc-100 pt-2">
                  <div className="text-xs font-medium text-zinc-500 mb-1">Conversão por script</div>
                  {rows.length === 0 ? (
                    <span className="text-xs text-zinc-400">Sem dados suficientes</span>
                  ) : rows.map((r, i) => (
                    <div key={r.script.id} className="flex items-center justify-between text-xs py-0.5">
                      <span className={i === 0 ? "font-medium text-zinc-800 flex items-center gap-1" : "text-zinc-500"}>
                        {i === 0 && <Sparkles size={11} className="text-pink-500" />} {r.script.name}
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
  const conditions = form.conditions || [];

  const updateCondition = (id, patch) => setForm((f) => ({
    ...f,
    conditions: (f.conditions || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }));
  const addCondition = () => setForm((f) => ({
    ...f,
    conditions: [...(f.conditions || []), { id: uid(), label: "", script: "" }],
  }));
  const removeCondition = (id) => setForm((f) => ({
    ...f,
    conditions: (f.conditions || []).filter((c) => c.id !== id),
  }));

  return (
    <Modal title="Objeção" onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Preço" /></Field>

        <Field label="Script principal">
          <Textarea
            rows={4}
            value={form.script}
            onChange={(e) => set("script", e.target.value)}
            placeholder='Ex: "Ok, entendi. Me responde uma coisa rápida: você consegue entregar 100 unidades em 10 dias?"'
          />
        </Field>

        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-500">Condições (ramificações a partir da resposta do lead)</div>
          <p className="mb-2 text-[11px] text-zinc-400">
            Depois do script principal, o lead responde algo — cada condição é um desses caminhos possíveis, com o script que você usa a partir dali. Ex: "Se disser que sim" e "Se disser que não", cada um com seu próprio script de continuação.
          </p>
          {conditions.length > 0 && (
            <div className="mb-2 space-y-2 border-l-2 border-pink-200/70 pl-3">
              {conditions.map((c) => (
                <div key={c.id} className="rounded-xl border border-zinc-200 bg-white/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-pink-400">↳</span>
                    <Input
                      value={c.label}
                      onChange={(e) => updateCondition(c.id, { label: e.target.value })}
                      placeholder='Condição (ex: "Se disser que sim:")'
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeCondition(c.id)}
                      className="shrink-0 text-zinc-400 transition-all duration-150 hover:text-rose-600 active:scale-90"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <Textarea
                    rows={3}
                    value={c.script}
                    onChange={(e) => updateCondition(c.id, { script: e.target.value })}
                    placeholder="Script de continuação para essa condição"
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={addCondition}><Plus size={13} /> Adicionar condição</Button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" disabled={!form.name.trim()} onClick={() => onSave({ ...form, conditions })}>Salvar</Button>
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
  const seq = funnelSequence(state.statuses);
  const bestResponseScript = [...state.scripts].map((sc) => {
    const its = state.leads.filter((l) => usesScript(l, sc.id));
    const responded = its.filter((l) => seq.findIndex((s) => s.name === l.status) >= 1).length;
    return { sc, its: its.length, r: rate(responded, its.length) };
  }).filter((x) => x.its > 0).sort((a, b) => (b.r ?? -1) - (a.r ?? -1))[0];
  const bestObjectionHandled = m.objectionRank[0];
  const mostCommonObjection = (() => {
    const counts = {};
    state.leads.forEach((l) => { if (l.objectionId) counts[l.objectionId] = (counts[l.objectionId] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? state.objections.find((o) => o.id === top[0]) : null;
  })();
  const lostNames = state.statuses.filter((s) => s.kind === "lost").map((s) => s.name);
  const mostCommonLostObjection = (() => {
    const counts = {};
    state.leads.filter((l) => lostNames.includes(l.status)).forEach((l) => { if (l.objectionId) counts[l.objectionId] = (counts[l.objectionId] || 0) + 1; });
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
        <h1 className="text-xl font-bold text-zinc-900">Validação de produto</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Respostas geradas automaticamente quando há dados reais suficientes ({m.converted.length}/{MIN} conversões mínimas para inferências sobre compradores).</p>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <Panel key={r.q} className="p-4">
            <div className="text-sm font-medium text-zinc-800">{r.q}</div>
            <div className="mt-1 flex items-start gap-1.5 text-sm">
              {r.a ? (
                <><Sparkles size={13} className="mt-0.5 shrink-0 text-pink-500" /><span className="text-zinc-600">{r.a}</span></>
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
        <h1 className="text-xl font-bold text-zinc-900">Tarefas</h1>
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
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-pink-50/50 transition-colors duration-150 cursor-pointer" onClick={() => setModal(t)}>
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
              <button onClick={() => removeSub(s.id)} className="text-zinc-300 transition-all duration-150 hover:text-rose-600 active:scale-90"><Trash2 size={13} /></button>
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
  const m = useMetrics(state);
  const hasData = state.leads.length > 0;
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 80);
    return () => clearTimeout(t);
  }, []);

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

  const chips = [
    ["Leads", state.leads.length], ["Pipelines", state.pipelines.length], ["Campanhas", state.campaigns.length],
    ["Scripts", state.scripts.length], ["Objeções", state.objections.length], ["Tarefas", state.tasks.length],
  ];

  return (
    <div className="space-y-6 pb-10">
      <Panel className="relative overflow-hidden p-6" rise>
        <FloatingOrbs />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-pink-600">
            <Zap size={14} className="icon-float" /> INTELIGÊNCIA COMERCIAL
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Relatórios</h1>
          <p className="mt-1 max-w-lg text-sm text-zinc-500">Um retrato ao vivo da sua operação — tudo calculado a partir dos dados reais lançados no GAID CRM.</p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-2xl font-semibold text-zinc-900 tabular-nums"><CountUp value={m.totalLeads} /></div>
              <div className="text-xs text-zinc-500">Leads totais</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-900 tabular-nums"><CountUp value={m.overallConversion || 0} format={(v) => `${v.toFixed(1)}%`} /></div>
              <div className="text-xs text-zinc-500">Conversão geral</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-900 tabular-nums"><CountUp value={m.revenue} format={(v) => fmtMoney(v)} /></div>
              <div className="text-xs text-zinc-500">Receita</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-zinc-900 tabular-nums">{m.avgTicket ? <CountUp value={m.avgTicket} format={(v) => fmtMoney(v)} /> : "—"}</div>
              <div className="text-xs text-zinc-500">Ticket médio</div>
            </div>
          </div>
        </div>
      </Panel>

      {!hasData ? (
        <EmptyState icon={BarChart3} title="Ainda sem dados para analisar" hint="Assim que você cadastrar leads, esta página ganha vida com gráficos e rankings reais." />
      ) : (
        <>
          {m.revenueTrend.some((d) => d.receita > 0) && (
            <Panel className="p-4" rise delay={40}>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <TrendingUp size={13} className="text-pink-400" /> Receita ao longo do tempo
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.revenueTrend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => fmtMoney(v)} />
                    <Line type="monotone" dataKey="receita" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 3, fill: "#ec4899", strokeWidth: 0 }} isAnimationActive animationDuration={1100} animationEasing="ease-out" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <RankBars title="Top campanhas" icon={Megaphone} rows={m.campaignRank} state={state} entity="campaigns" grown={grown} delay={80} />
            <RankBars title="Top scripts" icon={FileText} rows={m.scriptRank} state={state} entity="scripts" grown={grown} delay={110} />
            <RankBars title="Objeções melhor tratadas" icon={ShieldAlert} rows={m.objectionRank} state={state} entity="objections" grown={grown} delay={140} />
          </div>
        </>
      )}

      <Panel className="p-4" rise delay={hasData ? 200 : 40}>
        <div className="text-sm font-medium text-zinc-800">Exportar leads</div>
        <p className="mt-1 text-xs text-zinc-500">Gera um arquivo CSV com todos os leads cadastrados — compatível com Excel e Google Sheets.</p>
        <Button size="sm" className="mt-3" onClick={exportCsv} disabled={!state.leads.length}><Download size={13} /> Baixar CSV</Button>
      </Panel>

      <div className="flex flex-wrap gap-2">
        {chips.map(([label, n]) => (
          <div key={label} className="flex items-center gap-1.5 rounded-full border border-white/70 bg-white/60 backdrop-blur-md px-3 py-1.5 text-xs text-zinc-500 shadow-sm">
            <span className="font-semibold text-zinc-800 tabular-nums">{n}</span> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function RankBars({ title, icon: Icon, rows, state, entity, grown, delay = 0 }) {
  return (
    <Panel className="p-4" rise delay={delay}>
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <Icon size={13} className="text-pink-400" /> {title}
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-zinc-400">Dados insuficientes</div>
      ) : (
        <div className="space-y-2.5">
          {rows.slice(0, 5).map((r, i) => {
            const name = state[entity].find((x) => x.id === r.item.id)?.name || "—";
            return (
              <div key={r.item.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1 truncate text-zinc-700">
                    {i === 0 && <Sparkles size={11} className="shrink-0 text-pink-500" />}
                    <span className="truncate">{name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-zinc-600">{fmtRate(r.convRate)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100/80">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all ease-out"
                    style={{ width: grown ? `${Math.max(3, Math.min(100, r.convRate || 0))}%` : "0%", transitionDuration: "900ms", transitionDelay: `${i * 70}ms` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ============================================================
   CONFIGURAÇÕES
============================================================ */
function Configuracoes({ state, setState }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4 pb-10 max-w-lg">
      <h1 className="text-xl font-bold text-zinc-900">Configurações</h1>
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
