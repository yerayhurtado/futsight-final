/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, GitCompare, ChevronRight, X, User, Trophy, Zap, Target, Shield, Activity, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';

type PlayerRow = {
    PlayerID: number;
    Player?: string | null;
    Squad?: string | null;
    Pos_Main?: string | null;
    Pos?: string | null;
    Age?: number | null;
    Gls?: number | null;
    Ast?: number | null;
    Won?: number | null;
    Min?: number | null;
    xG?: number | null;
    KP?: number | null;
    SoT?: number | null;
    strCutout?: string | null;
    Valor_Mercado?: number | null;
    [k: string]: unknown;
};

const POSITION_STATS: Record<string, { key: string; label: string; max: number }[]> = {
    fw: [
        { key: 'Gls', label: 'Goles', max: 30 },
        { key: 'Ast', label: 'Asist.', max: 15 },
        { key: 'xG', label: 'xG', max: 25 },
        { key: 'SoT', label: 'Tiros', max: 100 },
        { key: 'Won', label: 'Regates', max: 100 },
        { key: 'SCA', label: 'Creación', max: 150 },
    ],
    mf: [
        { key: 'Ast', label: 'Asist.', max: 15 },
        { key: 'KP', label: 'Pases Clave', max: 80 },
        { key: 'Cmp%', label: 'Pases %', max: 100 },
        { key: 'Recov', label: 'Recuper.', max: 300 },
        { key: 'PrgP', label: 'Prog.', max: 200 },
        { key: 'Gls', label: 'Goles', max: 15 },
    ],
    df: [
        { key: 'Tkl', label: 'Entradas', max: 100 },
        { key: 'Int', label: 'Intercep.', max: 80 },
        { key: 'Won%', label: 'Duelos %', max: 100 },
        { key: 'Blocks', label: 'Bloqueos', max: 60 },
        { key: 'Cmp%', label: 'Pases %', max: 100 },
        { key: 'Clr', label: 'Despejes', max: 150 },
    ],
    gk: [
        { key: 'Save%', label: 'Paradas %', max: 100 },
        { key: 'CS', label: 'Porterías 0', max: 20 },
        { key: 'PSxG', label: 'Goles Evit.', max: 10 },
        { key: 'Cmp%', label: 'Pases %', max: 100 },
        { key: 'Min', label: 'Minutos', max: 3420 },
        { key: 'Valor_Mercado', label: 'Valor', max: 100000000 },
    ],
};

const STAT_ORDER = ['Gls', 'Ast', 'xG', 'SoT', 'Won', 'KP', 'SCA', 'Tkl', 'Int', 'Won%', 'Cmp%', 'Min', 'Valor_Mercado'];

function getPositionKey(p: PlayerRow): string {
    const pos = (p.Pos_Main ?? p.Pos ?? '').toString().toLowerCase();
    if (pos.includes('fw')) return 'fw';
    if (pos.includes('mf')) return 'mf';
    if (pos.includes('df')) return 'df';
    if (pos.includes('gk')) return 'gk';
    return 'fw';
}

function formatValue(p: PlayerRow, key: string): string {
    if (key === 'Valor_Mercado') {
        const v = p.Valor_Mercado;
        if (v == null || v === 0) return '—';
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M€`;
        if (v >= 1000) return `${(v / 1000).toFixed(0)}K€`;
        return `${v}€`;
    }
    const v = p[key];
    if (v == null || v === '') return '—';
    if (typeof v === 'number' && (key === 'Cmp%' || key === 'Won%' || key === 'Save%')) return `${v}%`;
    if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(2);
    return String(v);
}

function normalize(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
}

function capitalizeName(str: string) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const DEFAULT_CUTOUT = 'https://www.thesportsdb.com/images/media/player/cutout/default.png';

export default function ComparadorPage() {
    const [players, setPlayers] = useState<PlayerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [player1, setPlayer1] = useState<PlayerRow | null>(null);
    const [player2, setPlayer2] = useState<PlayerRow | null>(null);
    const [query1, setQuery1] = useState('');
    const [query2, setQuery2] = useState('');
    const [openDropdown1, setOpenDropdown1] = useState(false);
    const [openDropdown2, setOpenDropdown2] = useState(false);

    useEffect(() => {
        fetch('/api/players')
            .then((res) => res.json())
            .then((data) => setPlayers(Array.isArray(data) ? data : []))
            .catch(() => setPlayers([]))
            .finally(() => setLoading(false));
    }, []);

    const suggestions1 = useMemo(() => {
        const q = normalize(query1);
        if (!q || q.length < 2) return [];
        return players.filter((p) => normalize(p.Player ?? '').includes(q) || normalize(p.Squad ?? '').includes(q)).slice(0, 8);
    }, [players, query1]);

    const suggestions2 = useMemo(() => {
        const q = normalize(query2);
        if (!q || q.length < 2) return [];
        return players.filter((p) => normalize(p.Player ?? '').includes(q) || normalize(p.Squad ?? '').includes(q)).slice(0, 8);
    }, [players, query2]);

    // Calcular datos para el radar
    const radarData = useMemo(() => {
        if (!player1 || !player2) return [];
        const pos1 = getPositionKey(player1);
        const pos2 = getPositionKey(player2);
        
        // Usar las métricas de la posición del jugador 1 como base si coinciden, si no las de FW (más comunes)
        const metrics = POSITION_STATS[pos1] || POSITION_STATS.fw;
        
        return metrics.map(m => ({
            subject: m.label,
            A: Math.min(((Number(player1[m.key]) || 0) / m.max) * 100, 100),
            B: Math.min(((Number(player2[m.key]) || 0) / m.max) * 100, 100),
            fullMark: 100,
        }));
    }, [player1, player2]);

    // Calcular quién gana en más métricas
    const statsComparison = useMemo(() => {
        if (!player1 || !player2) return { wins1: 0, wins2: 0, total: 0 };
        const keys = STAT_ORDER.filter(k => player1[k] !== undefined || player2[k] !== undefined);
        let w1 = 0, w2 = 0;
        keys.forEach(k => {
            const v1 = Number(player1[k]) || 0;
            const v2 = Number(player2[k]) || 0;
            if (v1 > v2) w1++;
            else if (v2 > v1) w2++;
        });
        return { wins1: w1, wins2: w2, total: keys.length };
    }, [player1, player2]);

    return (
        <section className="relative min-h-screen bg-[#020812] overflow-hidden text-white font-sans">
            {/* Fondo decorativo */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(168,85,247,0.08),transparent)]" />
                <div className="absolute top-0 left-0 w-full h-full opacity-[0.02]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',backgroundSize:'50px 50px'}} />
            </div>

            <div className="relative z-10 pt-24 pb-20 px-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 glass border border-purple-500/20 rounded-full mb-6"
                    >
                        <GitCompare className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-400 text-[10px] font-black uppercase tracking-[0.3em]">Scouting Versus</span>
                    </motion.div>
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-none mb-4">
                        Cara a <span className="text-purple-500">Cara</span>
                    </h1>
                    <p className="text-gray-500 text-sm max-w-xl mx-auto uppercase font-bold tracking-widest">
                        Análisis comparativo de rendimiento estadístico
                    </p>
                </div>

                {/* Selectores */}
                <div className="grid md:grid-cols-2 gap-8 mb-16 relative">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex">
                        <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center font-black italic text-xl border-4 border-[#020812] shadow-[0_0_30px_rgba(147,51,234,0.5)]">
                            VS
                        </div>
                    </div>
                    
                    <PlayerSelector 
                        label="Atacante A" 
                        player={player1} 
                        query={query1} 
                        setQuery={setQuery1} 
                        setPlayer={setPlayer1} 
                        suggestions={suggestions1} 
                        open={openDropdown1} 
                        setOpen={setOpenDropdown1} 
                        color="purple"
                    />
                    <PlayerSelector 
                        label="Atacante B" 
                        player={player2} 
                        query={query2} 
                        setQuery={setQuery2} 
                        setPlayer={setPlayer2} 
                        suggestions={suggestions2} 
                        open={openDropdown2} 
                        setOpen={setOpenDropdown2} 
                        color="emerald"
                    />
                </div>

                {/* Resultados */}
                <AnimatePresence mode="wait">
                    {player1 && player2 ? (
                        <motion.div 
                            key="results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="grid lg:grid-cols-3 gap-8"
                        >
                            {/* Stats Columna 1 */}
                            <div className="space-y-6 order-2 lg:order-1">
                                <h3 className="text-xs font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Métricas {player1.Player?.split(' ')[0]}
                                </h3>
                                <div className="space-y-3">
                                    {STAT_ORDER.map(k => {
                                        const v1 = Number(player1[k]);
                                        const v2 = Number(player2[k]);
                                        const isBetter = !isNaN(v1) && !isNaN(v2) && v1 > v2;
                                        if (player1[k] === undefined) return null;
                                        return (
                                            <StatRow key={k} label={k} value={formatValue(player1, k)} highlight={isBetter} color="purple" />
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Radar Central */}
                            <div className="order-1 lg:order-2 flex flex-col items-center">
                                <div className="glass border border-white/5 rounded-[3rem] p-8 w-full aspect-square relative mb-8">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(147,51,234,0.1),transparent_70%)]" />
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar
                                                name={player1.Player || ''}
                                                dataKey="A"
                                                stroke="#a855f7"
                                                fill="#a855f7"
                                                fillOpacity={0.4}
                                            />
                                            <Radar
                                                name={player2.Player || ''}
                                                dataKey="B"
                                                stroke="#10b981"
                                                fill="#10b981"
                                                fillOpacity={0.4}
                                            />
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: '#020812', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Marcador de Victorias */}
                                <div className="grid grid-cols-3 w-full max-w-sm gap-4 items-center">
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-purple-400">{statsComparison.wins1}</div>
                                        <div className="text-[10px] font-black uppercase text-gray-500">Wins</div>
                                    </div>
                                    <div className="flex justify-center">
                                        <Trophy className="w-8 h-8 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-3xl font-black text-emerald-400">{statsComparison.wins2}</div>
                                        <div className="text-[10px] font-black uppercase text-gray-500">Wins</div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Columna 2 */}
                            <div className="space-y-6 order-3">
                                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2 justify-end">
                                    Métricas {player2.Player?.split(' ')[0]} <Shield className="w-4 h-4" />
                                </h3>
                                <div className="space-y-3">
                                    {STAT_ORDER.map(k => {
                                        const v1 = Number(player1[k]);
                                        const v2 = Number(player2[k]);
                                        const isBetter = !isNaN(v1) && !isNaN(v2) && v2 > v1;
                                        if (player2[k] === undefined) return null;
                                        return (
                                            <StatRow key={k} label={k} value={formatValue(player2, k)} highlight={isBetter} color="emerald" reverse />
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="max-w-md mx-auto text-center py-20"
                        >
                            <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 relative">
                                <GitCompare className="w-10 h-10 text-gray-600" />
                                <div className="absolute inset-0 bg-purple-500/10 blur-2xl rounded-full" />
                            </div>
                            <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Esperando selección...</h3>
                            <p className="text-gray-500 text-sm">Elige dos talentos para iniciar el escaneo comparativo de métricas avanzadas.</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}

// --- SUBCOMPONENTES ---

function PlayerSelector({ label, player, query, setQuery, setPlayer, suggestions, open, setOpen, color }: any) {
    const borderColor = color === 'purple' ? 'group-hover:border-purple-500/40' : 'group-hover:border-emerald-500/40';
    const accentColor = color === 'purple' ? 'bg-purple-500' : 'bg-emerald-500';

    return (
        <div className="relative group">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 block">{label}</label>
            <div className={`glass border border-white/10 rounded-[2rem] p-6 transition-all duration-500 ${borderColor} relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-32 h-32 ${accentColor}/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2`} />
                
                <div className="flex items-center gap-6 relative z-10">
                    <div className={`w-20 h-20 rounded-2xl ${accentColor}/10 border border-white/5 overflow-hidden flex items-end justify-center shrink-0`}>
                        {player?.strCutout ? (
                            <img src={player.strCutout} alt="" className="h-16 w-auto object-contain drop-shadow-lg" />
                        ) : (
                            <User className="w-8 h-8 text-white/10 mb-4" />
                        )}
                    </div>
                    
                    <div className="flex-1">
                        {player ? (
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-black text-xl italic uppercase tracking-tighter text-white">{player.Player}</h4>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{player.Squad}</p>
                                </div>
                                <button onClick={() => { setPlayer(null); setQuery(''); }} className="p-2 hover:bg-white/5 rounded-lg text-gray-600 hover:text-white transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                                    onFocus={() => setOpen(true)}
                                    onBlur={() => setTimeout(() => setOpen(false), 200)}
                                    placeholder="Buscar jugador..."
                                    className="w-full bg-transparent border-none pl-7 py-2 text-white font-bold outline-none placeholder:text-gray-700"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sugerencias */}
            <AnimatePresence>
                {open && suggestions.length > 0 && !player && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 right-0 top-full mt-2 glass-dark border border-white/10 rounded-2xl shadow-2xl z-50 py-2 max-h-60 overflow-y-auto"
                    >
                        {suggestions.map((p: any) => (
                            <button
                                key={p.PlayerID}
                                onClick={() => { setPlayer(p); setQuery(''); setOpen(false); }}
                                className="w-full px-5 py-3 text-left hover:bg-white/5 flex items-center gap-4 transition-all"
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-end justify-center overflow-hidden shrink-0">
                                    {p.strCutout ? <img src={p.strCutout} alt="" className="h-8 w-auto object-contain" /> : <User className="w-4 h-4 text-white/10 mb-2" />}
                                </div>
                                <div>
                                    <p className="font-black text-sm uppercase tracking-tight text-white">{p.Player}</p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{p.Squad}</p>
                                </div>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatRow({ label, value, highlight, color, reverse }: any) {
    const bgColor = highlight ? (color === 'purple' ? 'bg-purple-500/10' : 'bg-emerald-500/10') : 'bg-white/[0.02]';
    const textColor = highlight ? (color === 'purple' ? 'text-purple-400' : 'text-emerald-400') : 'text-gray-400';
    const borderActive = highlight ? (color === 'purple' ? 'border-purple-500/20' : 'border-emerald-500/20') : 'border-white/5';

    return (
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${borderActive} ${bgColor} transition-all duration-500 ${reverse ? 'flex-row-reverse' : ''}`}>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</span>
            <span className={`text-lg font-black font-data ${textColor}`}>{value}</span>
        </div>
    );
}
