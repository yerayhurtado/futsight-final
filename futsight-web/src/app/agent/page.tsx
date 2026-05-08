/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    User,
    Shield,
    Zap,
    Globe,
    Send,
    Loader2,
    AlertCircle,
    FileText,
    Star,
    Trash2,
    Download,
    X,
    History,
} from 'lucide-react';

const RECENT_KEY = 'agent_recent_queries';
const SHORTLIST_KEY = 'agent_shortlist';
const MAX_RECENT = 10;

const AGENT_STEPS = [
    { id: 0, label: 'Analizando consulta',       icon: '🧠', detail: 'El LLM extrae filtros del lenguaje natural' },
    { id: 1, label: 'Buscando jugadores',         icon: '🔍', detail: 'Aplicando filtros sobre la base de datos' },
    { id: 2, label: 'Generando análisis',         icon: '📋', detail: 'El ojeador redacta el informe de mercado' },
    { id: 3, label: 'Preparando resultados',      icon: '✨', detail: 'Ordenando candidatos por relevancia' },
];

function AgentProgressBar({ step, nodePhase }: { step: number; nodePhase: 'start' | 'end' }) {
    // Derivar progreso del step: eliminamos el estado separado que se desincronizaba
    // node_start → mitad del step, node_end → final del step
    const totalSteps = AGENT_STEPS.length;
    const baseProgress = step >= totalSteps ? 100 : (step / totalSteps) * 100;
    const halfStep = (1 / totalSteps) * 100;
    const progress = step >= totalSteps
        ? 100
        : nodePhase === 'end'
            ? baseProgress + halfStep  // step completado
            : baseProgress + halfStep * 0.4; // a mitad del step

    return (
        <div className="max-w-4xl mx-auto mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="glass border border-sky-500/20 rounded-2xl p-5 shadow-2xl">
                {/* Barra de progreso principal */}
                <div className="mb-5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                            {AGENT_STEPS[step]?.label ?? 'Finalizando…'}
                        </span>
                        <span className="text-xs font-mono text-gray-500">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(56,189,248,0.6)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Pasos */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {AGENT_STEPS.map((s) => {
                        const isDone    = s.id < step || (s.id === step && nodePhase === 'end');
                        const isCurrent = s.id === step && nodePhase === 'start';
                        return (
                            <div
                                key={s.id}
                                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all duration-500 ${
                                    isDone
                                        ? 'border-emerald-500/40 bg-emerald-500/10'
                                        : isCurrent
                                        ? 'border-sky-500/50 bg-sky-500/10 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                                        : 'border-white/[0.05] bg-white/[0.02] opacity-40'
                                }`}
                            >
                                <span className={`text-xl transition-all duration-300 ${ isCurrent ? 'animate-bounce' : '' }`}>
                                    {isDone ? '✅' : s.icon}
                                </span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider text-center leading-tight ${
                                    isDone ? 'text-emerald-400' : isCurrent ? 'text-sky-300' : 'text-gray-600'
                                }`}>
                                    {s.label}
                                </span>
                                {isCurrent && (
                                    <span className="text-[9px] text-gray-500 text-center leading-tight hidden md:block">
                                        {s.detail}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

type JugadorAgente = {
    PlayerID: number;
    Player?: string | null;
    Squad?: string | null;
    League?: string | null;
    Nation?: string | null;
    Pos?: string | null;
    Pos_Main?: string | null;
    Age?: number | null;
    Gls?: number | null;
    Ast?: number | null;
    Won?: number | null;
    Min?: number | null;
    xG?: number | null;
    KP?: number | null;
    SoT?: number | null;
    market_value_in_eur?: number | null;
    Perfil_Principal?: string | null;
    Perfil_Historico?: string | null;
    strCutout?: string | null;
    [k: string]: unknown;
};

type SortKey = 'relevancia' | 'goles' | 'asistencias' | 'regates' | 'valor' | 'edad';

const PLANTILLAS: { label: string; query: string }[] = [
    { label: 'Lateral tipo', query: 'Lateral joven con proyección' },
    { label: '9 goleador', query: 'Delantero goleador con goles' },
    { label: 'Medio creativo', query: 'Mediocentro con asistencias y pases clave' },
    { label: 'Extremo desequilibrador', query: 'Extremo joven con regate y gol' },
];

const SUGERENCIAS = [
    'delantero español',
    'extremo joven',
    'mediocentro con asistencias',
    'lateral',
    'goleador',
];

const getPosIcon = (pos: string) => {
    const p = (pos ?? '').toLowerCase();
    if (p.includes('gk') || p.includes('df')) return Shield;
    if (p.includes('mf')) return Globe;
    if (p.includes('fw')) return Zap;
    return User;
};

const capitalizeName = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatMarketValue = (value: number | null | undefined) => {
    if (value == null || value === 0) return '—';
    if (value >= 1_000_000) {
        const m = value / 1_000_000;
        return `${Number.isInteger(m) ? m : m.toFixed(1)}M€`;
    }
    if (value >= 1_000) {
        const k = value / 1_000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}K€`;
    }
    return `${value}€`;
};

const DEFAULT_CUTOUT = 'https://www.thesportsdb.com/images/media/player/cutout/default.png';

/** Métricas relevantes por posición (mismas claves que puede devolver GET /jugadores) */
const POSITION_STATS: Record<string, { key: string; label: string }[]> = {
    fw: [
        { key: 'Gls', label: 'Goles' },
        { key: 'Ast', label: 'Asist.' },
        { key: 'xG', label: 'xG' },
        { key: 'SoT', label: 'Tiros puerta' },
        { key: 'Won', label: 'Regates' },
        { key: 'Min', label: 'Min' },
        { key: 'market_value_in_eur', label: 'Valor' },
    ],
    mf: [
        { key: 'Ast', label: 'Asist.' },
        { key: 'KP', label: 'Pases clave' },
        { key: 'xA', label: 'xA' },
        { key: 'Cmp%', label: 'Pases %' },
        { key: 'Gls', label: 'Goles' },
        { key: 'Min', label: 'Min' },
        { key: 'market_value_in_eur', label: 'Valor' },
    ],
    df: [
        { key: 'Tkl', label: 'Entradas' },
        { key: 'Int', label: 'Intercep.' },
        { key: 'Won%', label: 'Duelos %' },
        { key: 'Cmp%', label: 'Pases %' },
        { key: 'Min', label: 'Min' },
        { key: 'market_value_in_eur', label: 'Valor' },
    ],
    gk: [
        { key: 'Min', label: 'Min' },
        { key: 'market_value_in_eur', label: 'Valor' },
    ],
};





const PlayerSkeleton = () => (
    <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="h-52 relative overflow-hidden bg-[#0a1628]">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>
        <div className="p-5 space-y-3">
            <div className="h-5 bg-white/[0.05] rounded-lg w-3/4 overflow-hidden relative">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>
            <div className="h-3.5 bg-white/[0.04] rounded-lg w-1/2" />
            <div className="pt-4 mt-4 border-t border-white/[0.05] flex justify-between">
                <div className="h-8 bg-white/[0.04] rounded-lg w-12" />
                <div className="h-8 bg-white/[0.04] rounded-lg w-20" />
            </div>
        </div>
    </div>
);

function sortJugadores(jugadores: JugadorAgente[], sortBy: SortKey): JugadorAgente[] {
    if (sortBy === 'relevancia') return [...jugadores];
    const sorted = [...jugadores];
    switch (sortBy) {
        case 'goles':
            return sorted.sort((a, b) => ((b.Gls ?? 0) - (a.Gls ?? 0)));
        case 'asistencias':
            return sorted.sort((a, b) => ((b.Ast ?? 0) - (a.Ast ?? 0)));
        case 'regates':
            return sorted.sort((a, b) => ((b.Won ?? 0) - (a.Won ?? 0)));
        case 'valor':
            return sorted.sort((a, b) => ((b.market_value_in_eur ?? 0) - (a.market_value_in_eur ?? 0)));
        case 'edad':
            return sorted.sort((a, b) => ((a.Age ?? 999) - (b.Age ?? 999)));
        default:
            return sorted;
    }
}

/** Columnas comunes (identificación + temporada actual). */
const CSV_COMMON_KEYS = ['PlayerID', 'Player', 'Squad', 'League', 'Nation', 'Pos_Main', 'Age', 'Season', 'market_value_in_eur'] as const;

/** Todas las claves de métricas por posición (sin duplicar market_value_in_eur). */
const CSV_METRIC_KEYS = ['Gls', 'Ast', 'xG', 'SoT', 'Won', 'KP', 'xA', 'Tkl', 'Int', 'Won%', 'Cmp%', 'Min'] as const;

/** Construye filas CSV: temporada actual (de /api/players) y solo métricas importantes para la posición de cada jugador. */
function buildCsvRowsFromCsvPlayers(fullPlayers: Array<Record<string, unknown>>): string[][] {
    if (fullPlayers.length === 0) return [];
    const header = [...CSV_COMMON_KEYS, ...CSV_METRIC_KEYS];
    const rows = fullPlayers.map((p) => {
        const posKey = (() => {
            const pos = (p.Pos_Main ?? p.Pos ?? '').toString().toLowerCase();
            if (pos.includes('gk')) return 'gk';
            if (pos.includes('df')) return 'df';
            if (pos.includes('mf')) return 'mf';
            return 'fw';
        })();
        const positionMetrics = POSITION_STATS[posKey] ?? POSITION_STATS.fw;
        const metricKeysForPos = new Set(positionMetrics.map((m) => m.key));
        return header.map((k) => {
            if (CSV_COMMON_KEYS.includes(k as typeof CSV_COMMON_KEYS[number])) return String(p[k] ?? '');
            if (metricKeysForPos.has(k)) return String(p[k] ?? '');
            return '';
        });
    });
    return [header, ...rows];
}

/** Obtiene las filas completas del CSV para los PlayerIDs dados (mismo orden). */
async function getFullPlayersFromCsv(playerIds: number[]): Promise<Array<Record<string, unknown>>> {
    const res = await fetch('/api/players');
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const byId = new Map<number, Record<string, unknown>>();
    data.forEach((p: Record<string, unknown>) => {
        const id = p.PlayerID;
        if (id != null) byId.set(Number(id), p);
    });
    return playerIds.map((id) => byId.get(id)).filter((p): p is Record<string, unknown> => p != null);
}

function downloadCsv(rows: string[][], filename: string, sep = ';') {
    const BOM = '\uFEFF';
    const csv = BOM + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(sep)).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

export default function AgentPage() {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [jugadores, setJugadores] = useState<JugadorAgente[]>([]);
    const [explicacion, setExplicacion] = useState('');
    const [basadoEn, setBasadoEn] = useState('');
    const [recomendacion, setRecomendacion] = useState('');
    const [orden, setOrden] = useState('');
    const [filtrosRelajados, setFiltrosRelajados] = useState('');
    const [error, setError] = useState('');
    const [busquedasSimilares, setBusquedasSimilares] = useState<string[]>([]);
    const [agentStep, setAgentStep] = useState(0);
    const [nodePhase, setNodePhase] = useState<'start' | 'end'>('start');

    const [recentQueries, setRecentQueries] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortKey>('relevancia');
    const [shortlist, setShortlist] = useState<JugadorAgente[]>([]);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(RECENT_KEY);
            if (raw) setRecentQueries(JSON.parse(raw));
        } catch {}
    }, []);
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(SHORTLIST_KEY);
            if (raw) setShortlist(JSON.parse(raw));
        } catch {}
    }, []);

    const saveRecent = useCallback((q: string) => {
        const trimmed = q.trim();
        if (!trimmed) return;
        setRecentQueries((prev) => {
            const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, MAX_RECENT);
            try {
                sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
            } catch {}
            return next;
        });
    }, []);

    const runSearch = useCallback(
        async (searchQuery: string) => {
            const q = searchQuery.trim();
            if (!q || loading) return;
            setQuery(q);
            setLoading(true);
            setHasSearched(true);
            setJugadores([]);
            setExplicacion('');
            setBasadoEn('');
            setRecomendacion('');
            setOrden('');
            setFiltrosRelajados('');
            setError('');
            setBusquedasSimilares([]);
            setAgentStep(0);
            setNodePhase('start');

            try {
                const res = await fetch('/api/agent/stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: q }),
                });

                if (!res.ok || !res.body) {
                    // Fallback: si el stream falla, usar el endpoint clásico
                    const fallbackRes = await fetch('/api/agent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ query: q }),
                    });
                    const data = await fallbackRes.json();
                    setAgentStep(AGENT_STEPS.length);
                    setJugadores(Array.isArray(data.jugadores) ? data.jugadores : []);
                    setExplicacion(data.explicacion ?? '');
                    setBasadoEn(data.basado_en ?? '');
                    setRecomendacion(data.recomendacion ?? '');
                    setOrden(data.orden ?? '');
                    setFiltrosRelajados(data.filtros_relajados ?? '');
                    setError(data.error ?? '');
                    setBusquedasSimilares(Array.isArray(data.busquedas_similares) ? data.busquedas_similares : []);
                    saveRecent(q);
                    setLoading(false);
                    return;
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                // Procesar cada chunk, forzando un render entre eventos
                const processEvents = async (text: string) => {
                    const parts = text.split('\n\n');
                    const remainder = parts.pop() || '';

                    for (const part of parts) {
                        if (!part.trim()) continue;

                        const lines = part.split('\n');
                        let eventType = '';
                        let dataStr = '';
                        for (const line of lines) {
                            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
                            if (line.startsWith('data: ')) dataStr = line.slice(6);
                        }
                        if (!eventType || !dataStr) continue;

                        try {
                            const payload = JSON.parse(dataStr);

                            if (eventType === 'node_start') {
                                setAgentStep(payload.step as number);
                                setNodePhase('start');
                            } else if (eventType === 'node_end') {
                                setAgentStep(payload.step as number);
                                setNodePhase('end');
                            } else if (eventType === 'result') {
                                setAgentStep(AGENT_STEPS.length);
                                setNodePhase('end');
                                setJugadores(Array.isArray(payload.jugadores) ? payload.jugadores : []);
                                setExplicacion(payload.explicacion ?? '');
                                setBasadoEn(payload.basado_en ?? '');
                                setRecomendacion(payload.recomendacion ?? '');
                                setOrden(payload.orden ?? '');
                                setFiltrosRelajados(payload.filtros_relajados ?? '');
                                setError(payload.error ?? '');
                                setBusquedasSimilares(
                                    Array.isArray(payload.busquedas_similares) ? payload.busquedas_similares : []
                                );
                                saveRecent(q);
                            } else if (eventType === 'error') {
                                setError(payload.message ?? 'Error desconocido del agente.');
                                setAgentStep(AGENT_STEPS.length);
                            }
                        } catch {
                            // Ignorar eventos mal formados
                        }

                        // Forzar un render entre eventos para que el UI se actualice
                        await new Promise((r) => setTimeout(r, 50));
                    }

                    return remainder;
                };

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    buffer = await processEvents(buffer);
                }
                // Procesar lo que quede en el buffer
                if (buffer.trim()) {
                    await processEvents(buffer + '\n\n');
                }
            } catch {
                setJugadores([]);
                setError('Error de conexión. Comprueba que el agente esté en marcha.');
                setAgentStep(AGENT_STEPS.length);
            } finally {
                setLoading(false);
            }
        },
        [loading, saveRecent]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = query.trim();
        if (q && !loading) runSearch(q);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const q = query.trim();
            if (q && !loading) runSearch(q);
        }
    };

    const addToShortlist = (j: JugadorAgente) => {
        setShortlist((prev) => {
            if (prev.some((p) => p.PlayerID === j.PlayerID)) return prev;
            const next = [...prev, j];
            try {
                sessionStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
            } catch {}
            return next;
        });
    };
    const removeFromShortlist = (playerId: number) => {
        setShortlist((prev) => {
            const next = prev.filter((p) => p.PlayerID !== playerId);
            try {
                sessionStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
            } catch {}
            return next;
        });
    };
    const clearShortlist = () => {
        setShortlist([]);
        try {
            sessionStorage.removeItem(SHORTLIST_KEY);
        } catch {}
    };

    const exportShortlistCsv = async () => {
        if (shortlist.length === 0) return;
        const ids = shortlist.map((j) => j.PlayerID);
        const full = await getFullPlayersFromCsv(ids);
        if (full.length === 0) return;
        downloadCsv(buildCsvRowsFromCsvPlayers(full), 'shortlist.csv');
    };

    const exportResultadosCsv = async () => {
        if (jugadores.length === 0) return;
        const ids = jugadores.map((j) => j.PlayerID);
        const full = await getFullPlayersFromCsv(ids);
        if (full.length === 0) return;
        downloadCsv(buildCsvRowsFromCsvPlayers(full), 'resultados-agente.csv');
    };

    const posMain = (j: JugadorAgente) => (j.Pos_Main ?? j.Pos ?? '').toString();
    const perfil = (j: JugadorAgente) => (j.Perfil_Principal ?? j.Perfil_Historico ?? '').toString();
    const hasValidCutout = (j: JugadorAgente) => {
        const u = j.strCutout;
        return typeof u === 'string' && u.trim().length > 0 && u.startsWith('http');
    };

    const sortedJugadores = sortJugadores(jugadores, sortBy);

    return (
        <section className="relative min-h-screen bg-[#020812] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(56,189,248,0.08),transparent)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_0%_100%,rgba(16,185,129,0.05),transparent)]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(rgba(56,189,248,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.8) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
            </div>

            <div className="relative z-10 pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto mb-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 glass border border-sky-500/20 rounded-full mb-6">
                        <Zap className="w-4 h-4 text-sky-400" />
                        <span className="text-sky-400 text-xs font-bold uppercase tracking-widest">Agente de IA</span>
                    </div>
                    <h1 className="text-5xl md:text-8xl font-black mb-6 leading-none tracking-tight">
                        <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Búsqueda</span>
                        <br />
                        <span className="bg-gradient-to-br from-sky-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">inteligente</span>
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                        Describe el perfil que necesitas. Recomendaciones basadas en datos analizados por IA.
                    </p>
                </div>

                {/* Caja de búsqueda: protagonista con aire */}
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-0 glass border border-white/10 rounded-2xl overflow-hidden focus-within:border-sky-500/60 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all duration-200 shadow-2xl">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ej: extremo con regate y gol, delantero goleador..."
                            rows={2}
                            className="w-full min-h-[52px] px-5 sm:px-6 py-4 sm:py-5 bg-transparent text-white placeholder-gray-500 outline-none resize-none text-base font-medium leading-relaxed flex-1"
                            disabled={loading}
                            aria-label="Búsqueda por lenguaje natural"
                        />
                        <div className="flex sm:flex-none px-4 pb-4 sm:px-3 sm:py-3 sm:border-l sm:border-white/10 sm:flex sm:items-center">
                            <button
                                type="submit"
                                disabled={!query.trim() || loading}
                                className="w-full sm:w-auto min-w-[120px] px-5 py-3 rounded-xl border border-white/15 bg-white/5 text-gray-300 font-bold text-sm hover:bg-sky-500/15 hover:border-sky-500/40 hover:text-sky-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/15 disabled:hover:text-gray-300 flex items-center justify-center gap-2 transition-colors"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                                ) : (
                                    <Send className="w-4 h-4 shrink-0" aria-hidden />
                                )}
                                <span>{loading ? 'Buscando...' : 'Buscar'}</span>
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-3 text-center sm:text-left" aria-hidden>
                        <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded border border-white/10">Enter</kbd> enviar · <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded border border-white/10">Shift+Enter</kbd> línea nueva
                    </p>
                </form>

                {/* Plantillas + Sugerencias en un solo bloque, menos etiquetas */}
                <div className="max-w-4xl mx-auto mb-6">
                    <p className="text-[11px] text-gray-600 uppercase tracking-wider mb-3">Prueba con</p>
                    <div className="flex flex-wrap gap-2">
                        {PLANTILLAS.map(({ label, query: q }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => { setQuery(q); runSearch(q); }}
                                className="px-4 py-2 rounded-xl glass border border-white/10 text-sm font-medium text-gray-300 hover:border-sky-500/50 hover:text-white transition-all"
                            >
                                {label}
                            </button>
                        ))}
                        {SUGERENCIAS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => { setQuery(s); runSearch(s); }}
                                className="px-3 py-1.5 rounded-lg glass border border-white/5 text-xs text-gray-400 hover:border-sky-500/30 hover:text-sky-400 transition-all"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Búsquedas recientes */}
                {recentQueries.length > 0 && (
                    <div className="max-w-4xl mx-auto mb-6">
                        <p className="text-[11px] text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <History className="w-3.5 h-3.5" /> Recientes
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {recentQueries.map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => { setQuery(q); runSearch(q); }}
                                    className="px-3 py-1.5 rounded-lg glass-dark border border-white/10 text-xs text-gray-300 hover:border-sky-500/40 hover:text-white transition-all truncate max-w-[200px]"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="max-w-7xl mx-auto space-y-8">
                    {loading && (
                        <AgentProgressBar step={agentStep} nodePhase={nodePhase} />
                    )}

                    {filtrosRelajados && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">{filtrosRelajados}</p>
                        </div>
                    )}

                    {!loading && hasSearched && (explicacion || basadoEn || recomendacion || orden) && (
                        <div className="glass border border-white/[0.07] rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                            <h2 className="text-lg font-black text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                                <FileText className="w-5 h-5 text-sky-400" />
                                Análisis del ojeador
                            </h2>
                            <div className="space-y-6 text-sm text-gray-300">
                                {explicacion && (
                                    <div className="relative">
                                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-sky-500/40 rounded-full" />
                                        <p className="text-lg md:text-xl font-medium text-white leading-relaxed italic">
                                            "{explicacion}"
                                        </p>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/[0.05]">
                                    {basadoEn && (
                                        <div>
                                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest block mb-2">Criterios técnicos</span>
                                            <p className="leading-relaxed text-gray-400">{basadoEn}</p>
                                        </div>
                                    )}
                                    {recomendacion && (
                                        <div>
                                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest block mb-2">Consejo del ojeador</span>
                                            <p className="leading-relaxed text-gray-400">{recomendacion}</p>
                                        </div>
                                    )}
                                    {orden && (
                                        <div>
                                            <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest block mb-2">Prioridad de resultados</span>
                                            <p className="leading-relaxed text-gray-400">{orden}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {!loading && hasSearched && jugadores.length === 0 && (
                        <div className="text-center py-16 bg-slate-800/20 rounded-3xl border border-white/5">
                            <p className="text-xl text-gray-400 mb-4">{error || 'No se encontraron jugadores para tu búsqueda.'}</p>
                            {busquedasSimilares.length > 0 && (
                                <div className="mt-6">
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Prueba con:</p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {busquedasSimilares.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => runSearch(s)}
                                                className="px-4 py-2 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 font-medium hover:bg-green-500/30 transition-all"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {busquedasSimilares.length === 0 && (
                                <p className="text-gray-500">Prueba otra descripción o relaja los criterios.</p>
                            )}
                        </div>
                    )}

                    {!loading && jugadores.length > 0 && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ordenar por</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortKey)}
                                        className="glass border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-medium outline-none focus:border-sky-500/50"
                                    >
                                        <option value="relevancia">Relevancia</option>
                                        <option value="goles">Goles</option>
                                        <option value="asistencias">Asistencias</option>
                                        <option value="regates">Regates</option>
                                        <option value="valor">Valor</option>
                                        <option value="edad">Edad</option>
                                    </select>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={exportResultadosCsv}
                                        className="px-4 py-2 rounded-xl bg-slate-800 border border-white/10 text-sm font-medium text-gray-300 hover:border-green-500/50 flex items-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Descargar CSV
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {sortedJugadores.map((j) => {
                                    const PosIcon = getPosIcon(posMain(j));
                                    const inShortlist = shortlist.some((p) => p.PlayerID === j.PlayerID);
                                    return (
                                        <div
                                            key={j.PlayerID}
                                            className="group flex flex-col bg-[#0a1628]/60 border border-white/[0.07] rounded-2xl overflow-hidden hover:border-sky-500/40 transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] shadow-xl"
                                        >
                                            <Link href={`/scouting/${j.PlayerID}`} className="flex flex-col flex-1 min-h-0">
                                                <div className="relative h-52 flex flex-col items-center justify-end bg-gradient-to-b from-sky-950/40 via-[#020812] to-[#020812] overflow-hidden shrink-0">
                                                    <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 120%,rgba(56,189,248,0.2),transparent 70%)`}} />
                                                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{background:`radial-gradient(circle at 50% 80%,rgba(56,189,248,0.15),transparent 60%)`}} />
                                                    {hasValidCutout(j) ? (
                                                        <img
                                                            src={j.strCutout!}
                                                            alt={capitalizeName((j.Player ?? '').toString())}
                                                            className="h-44 w-auto object-contain z-10 drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500"
                                                            loading="lazy"
                                                            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_CUTOUT; }}
                                                        />
                                                    ) : (
                                                        <User className="w-20 h-20 text-white/10 mb-6 group-hover:text-sky-500/30 transition-colors" />
                                                    )}
                                                    {perfil(j) && (
                                                        <div className="absolute top-3 right-3 px-2 py-0.5 bg-green-500/20 backdrop-blur-md border border-green-500/30 rounded-full z-20">
                                                            <span className="text-emerald-400 font-black text-[9px] uppercase tracking-tighter">{perfil(j)}</span>
                                                        </div>
                                                    )}
                                                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-1.5 z-20">
                                                        <PosIcon className="w-3.5 h-3.5 text-sky-400" />
                                                        <span className="text-white font-bold text-[10px] uppercase">{(posMain(j) || '—').toUpperCase()}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 space-y-2 border-t border-white/[0.06] bg-transparent shrink-0">
                                                    <h3 className="text-base font-black text-white truncate group-hover:text-sky-400 transition-colors">
                                                        {capitalizeName((j.Player ?? '—').toString())}
                                                    </h3>
                                                    <p className="text-[10px] text-gray-500 font-medium truncate uppercase tracking-widest">
                                                        {(j.Squad ?? 'Agente Libre').toString()}
                                                        {j.League ? ` · ${(j.League as string).toString()}` : ''}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs mt-3 pt-3 border-t border-white/[0.05]">
                                                        {(j.Gls != null || j.Ast != null) && (
                                                            <div><span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider block">G+A </span><span className="font-data font-black text-white block mt-0.5">{(j.Gls ?? 0)}+{(j.Ast ?? 0)}</span></div>
                                                        )}
                                                        {j.Won != null && <div><span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider block">Regates </span><span className="font-data font-black text-white block mt-0.5">{j.Won}</span></div>}
                                                        {j.Age != null && <div><span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider block">Edad </span><span className="font-data font-black text-white block mt-0.5">{j.Age}</span></div>}
                                                        {j.market_value_in_eur != null && (
                                                            <div><span className="text-gray-500 font-bold uppercase text-[9px] tracking-wider block">Valor </span><span className="font-data font-black text-sky-400 block mt-0.5">{formatMarketValue(j.market_value_in_eur)}</span></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                            <div className="p-3 border-t border-white/[0.06] bg-transparent shrink-0">
                                                {!inShortlist ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); addToShortlist(j); }}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl glass-dark border border-white/[0.05] text-xs font-bold text-gray-300 hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
                                                        title="Añadir a shortlist"
                                                    >
                                                        <Star className="w-4 h-4 shrink-0" /> Añadir a shortlist
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); removeFromShortlist(j.PlayerID); }}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-xs font-bold text-amber-400 hover:bg-amber-500/25 transition-colors"
                                                        title="Quitar de shortlist"
                                                    >
                                                        <Star className="w-4 h-4 shrink-0 fill-amber-400" /> En shortlist
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {loading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => <PlayerSkeleton key={i} />)}
                        </div>
                    )}

                    {!loading && !hasSearched && (
                        <div className="text-center py-16 text-gray-500">
                            <p className="text-lg">Usa una plantilla, una sugerencia o escribe tu búsqueda y pulsa Buscar.</p>
                        </div>
                    )}
                </div>

                {/* Mi shortlist (sidebar-style block) */}
                {shortlist.length > 0 && (
                    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-72 max-h-[80vh] overflow-hidden flex flex-col glass border border-white/[0.07] rounded-2xl shadow-2xl">
                        <div className="p-4 border-b border-white/[0.05] flex items-center justify-between bg-black/20">
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-400" /> Mi shortlist
                            </h3>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={exportShortlistCsv}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-white/5"
                                    title="Exportar CSV"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={clearShortlist}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5"
                                    title="Vaciar shortlist"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {shortlist.map((j) => (
                                <div key={j.PlayerID} className="flex items-center gap-2 p-2 rounded-xl bg-slate-700/30 border border-white/5">
                                    <span className="flex-1 text-xs font-medium text-white truncate">{capitalizeName((j.Player ?? '').toString())}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeFromShortlist(j.PlayerID)}
                                        className="p-1 rounded text-gray-500 hover:text-red-400 shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="p-2 border-t border-white/10 text-center">
                            <button
                                type="button"
                                onClick={exportShortlistCsv}
                                className="text-xs font-bold text-green-400 hover:text-green-300"
                            >
                                Exportar shortlist CSV
                            </button>
                        </div>
                    </div>
                )}
            </div>

        </section>
    );
}
