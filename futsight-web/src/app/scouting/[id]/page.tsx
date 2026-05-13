/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState, useEffect, use, Fragment, type SyntheticEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    User, Shield, Zap, Globe, ArrowLeft, TrendingUp, TrendingDown, Award,
    Target, MapPin, ChevronRight, Cake, Loader2,
    Activity, Dna, Clock, Timer, Percent, LineChart, Ruler, Footprints,
    ExternalLink, HelpCircle,
} from 'lucide-react';
import { PlayerData } from '@/lib/getPlayers';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';

// --- CONFIGURACIÓN DE MÉTRICAS ---
const commonBaseStats = [
    { key: 'MP', label: 'Partidos Jugados', icon: Activity },
    { key: 'Starts', label: 'Titularidades', icon: Shield },
    { key: 'Min', label: 'Minutos Totales', icon: Clock },
    { key: 'Mn/MP', label: 'Minutos por Partido', icon: Timer },
];

const BASE_STATS_MAP: Record<string, typeof commonBaseStats> = {
    df: commonBaseStats, mf: commonBaseStats, fw: commonBaseStats, gk: commonBaseStats,
};

const EFFICIENCY_MAP: Record<string, { key: string; label: string; max: number; description: string }[]> = {
    df: [
        { key: 'Won%', label: 'Eficacia Duelos Aéreos', max: 100, description: 'Porcentaje de duelos aéreos ganados. Vital para el dominio del área.' },
        { key: 'TklW', label: 'Entradas Ganadas', max: 80, description: 'Volumen de entradas que recuperan la posesión. Mide agresividad efectiva.' },
        { key: 'Int', label: 'Intercepciones', max: 100, description: 'Lectura del juego y anticipación para cortar líneas de pase rivales.' },
        { key: 'PrgP', label: 'Pases Progresivos', max: 150, description: 'Capacidad para romper la primera línea de presión con balón controlado.' },
    ],
    mf: [
        { key: 'Cmp%', label: 'Precisión de Pase', max: 100, description: 'Fiabilidad en la circulación. Base del juego de un mediocampista.' },
        { key: 'PrgP', label: 'Pases Progresivos', max: 200, description: 'Capacidad para mover el bloque equipo hacia el último tercio.' },
        { key: 'SCA90', label: 'Creación de Tiros / 90', max: 8, description: 'Acciones (pases, regates) por partido que derivan en un tiro.' },
        { key: 'Recov', label: 'Recuperaciones', max: 350, description: 'Despliegue físico y trabajo sucio en las transiciones defensivas.' },
    ],
    fw: [
        { key: 'npxG/Sh', label: 'Calidad de Tiro (npxG/Tiro)', max: 0.3, description: 'Inteligencia de remate. Valores altos indican que tira desde posiciones muy ventajosas.' },
        { key: 'SoT%', label: 'Precisión a Puerta (%)', max: 100, description: 'Porcentaje de todos sus disparos que van dirigidos entre los tres palos.' },
        { key: 'SCA90', label: 'Creación de Tiros / 90', max: 8, description: 'Impacto ofensivo: acciones (pases, conducciones) por partido que derivan en un tiro.' },
        { key: 'Att Pen', label: 'Toques en Área Rival', max: 150, description: 'Presencia en la zona de peligro. Refleja su capacidad para pisar el área de penalti.' },
    ],
    gk: [
        { key: 'Cmp%', label: 'Precisión de pase', max: 100, description: 'Porcentaje de pases completados con los pies. Cada vez más relevante en porteros modernos.' },
        { key: 'Won%', label: 'Eficacia en Duelos', max: 100, description: 'Porcentaje de duelos individuales ganados, fundamental en salidas y juego aéreo.' },
        { key: '+/-90', label: 'Impacto en Marcador', max: 3, description: 'Diferencia de goles del equipo por cada 90 minutos con el portero en el campo.' },
    ],
};

/** XAI cuando el modelo predice por debajo del valor de mercado */
type XaiDownTrendPayload = {
    impact_lines: string[];
    factor_edad_line: string;
    coef_liga_line: string;
    conclusion: string;
    highlight_box: string;
};

const XAI_DOWN_TREND_HELP =
    '¿Por qué baja el valor si el jugador es muy bueno? Muy sencillo: Es como una acción de bolsa que ha subido mucho por la ilusión de la gente (Hype). El modelo analiza los datos fríos (Goles y minutos) y dice: «El jugador es crack, pero su precio actual en el mercado es tan alto que, para mantenerlo o subir más, necesitaría cifras de Balón de Oro inmediatas». Es una predicción de ajuste de realidad, no una crítica al talento.';

/** Respuesta de /api/predict con campos XAI opcionales */
type PredictionWithXai = {
    predicted_value?: number;
    diff_pct?: number;
    explanation_details?: { mensaje: string }[];
    age_analysis?: string;
    league?: string;
    league_coeff?: number;
    xai_down_trend?: XaiDownTrendPayload | null;
};

const KEY_METRICS_BY_POSITION: Record<string, { key: string; label: string; suffix?: string }[]> = {
    df: [
        { key: 'Tkl', label: 'Entradas' },
        { key: 'Int', label: 'Intercep.' },
        { key: 'Blocks', label: 'Bloqueos' },
        { key: 'Clr', label: 'Despejes' },
        { key: 'Won%', label: 'Duelos Aéreos', suffix: '%' },
        { key: 'Recov', label: 'Recuperaciones' },
    ],
    mf: [
        { key: 'Ast', label: 'Asistencias' },
        { key: 'KP', label: 'Pases Clave' },
        { key: 'PrgP', label: 'Pases Prog.' },
        { key: 'SCA', label: 'Acc. Crea Tiro' },
        { key: 'Cmp%', label: 'Prec. Pase', suffix: '%' },
        { key: 'Recov', label: 'Recuperaciones' },
    ],
    fw: [
        { key: 'Gls', label: 'Goles' },
        { key: 'Ast', label: 'Asistencias' },
        { key: 'Sh', label: 'Disparos' },
        { key: 'SoT', label: 'A Puerta' },
        { key: 'xG', label: 'Goles Esp.' },
        { key: 'SCA', label: 'Acc. Crea Tiro' },
    ],
    gk: [
        { key: 'onGA', label: 'Goles Conc.' },
        { key: 'onxGA', label: 'xG en Contra' },
        { key: '+/-90', label: 'Dif. Goles/90' },
        { key: 'Cmp%', label: 'Prec. Pase', suffix: '%' },
        { key: 'Recov', label: 'Recuperaciones' },
        { key: 'Touches', label: 'Toques Balón' },
    ],
};

function capitalizeName(name: string) {
    if (!name) return '';
    return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

function getFlagUrl(nationCode: string) {
    if (!nationCode) return null;
    const parts = nationCode.split(' ');
    const code = parts[parts.length - 1].toLowerCase();
    return `https://flagcdn.com/w40/${code}.png`;
}

function formatHeight(h: number) {
    if (!h) return 'N/A';
    return `${h} cm`;
}

function formatPreferredFoot(foot: string) {
    if (!foot) return 'Ambas';
    return foot === 'right' ? 'Derecha' : foot === 'left' ? 'Izquierda' : 'Ambas';
}

function formatMarketValue(val: number) {
    if (!val || val === 0) return 'N/A';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M€`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K€`;
    return `${val}€`;
}

function formatKeyMetricValue(val: any, suffix: string = '') {
    if (val === undefined || val === null) return '0' + suffix;
    const num = Number(val);
    if (isNaN(num)) return val + suffix;
    if (Number.isInteger(num)) return num + suffix;
    return num.toFixed(2) + suffix;
}

function getPosIcon(pos: string) {
    const p = pos.toLowerCase();
    if (p.includes('gk')) return Shield;
    if (p.includes('df')) return Shield;
    if (p.includes('mf')) return Zap;
    return Target;
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const unwrappedParams = use(params);
    const playerIdFromUrl = unwrappedParams.id;
    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [seasonsData, setSeasonsData] = useState<{ Season: string; Valor_Mercado: number | null }[]>([]);
    const [predictedValue, setPredictedValue] = useState<number | null>(null);
    const [predictedDiff, setPredictedDiff] = useState<number | null>(null);
    const [predictedLoading, setPredictedLoading] = useState(false);
    const [predictionData, setPredictionData] = useState<PredictionWithXai | null>(null);
    const [similarPlayers, setSimilarPlayers] = useState<PlayerData[]>([]);
    const [similarLoading, setSimilarLoading] = useState(false);

    useEffect(() => {
        async function loadPlayer() {
            try {
                const response = await fetch('/api/players');
                const allPlayers: PlayerData[] = await response.json();
                const found = allPlayers.find(p => String(p.PlayerID) === String(playerIdFromUrl));
                setPlayer(found || null);
            } catch (error) { console.error(error); }
            finally { setLoading(false); }
        }
        loadPlayer();
    }, [playerIdFromUrl]);

    useEffect(() => {
        if (!playerIdFromUrl) return;
        async function loadSeasons() {
            try {
                const res = await fetch(`/api/players/${playerIdFromUrl}/seasons`);
                const data = await res.json();
                setSeasonsData(Array.isArray(data?.seasons) ? data.seasons : []);
            } catch (e) { /* ignore */ }
        }
        loadSeasons();
    }, [playerIdFromUrl]);

    // Fetch predicción del modelo cuando el jugador esté cargado
    useEffect(() => {
        if (!player?.Player) return;
        setPredictedLoading(true);
        setPredictionData(null);
        async function fetchPrediction() {
            try {
                const res = await fetch(`/api/predict?player=${encodeURIComponent(player!.Player)}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data?.predicted_value) {
                    setPredictionData(data as PredictionWithXai);
                    setPredictedValue(data.predicted_value);
                    setPredictedDiff(data.diff_pct ?? null);
                }
            } catch { /* servidor predicción no disponible */ }
            finally { setPredictedLoading(false); }
        }
        fetchPrediction();
    }, [player?.Player]);

    // Fetch jugadores similares
    useEffect(() => {
        if (!playerIdFromUrl) return;
        setSimilarLoading(true);
        async function fetchSimilar() {
            try {
                const res = await fetch(`/api/players/${playerIdFromUrl}/similar`);
                if (!res.ok) return;
                const data = await res.json();
                setSimilarPlayers(data.similar || []);
            } catch { /* error */ }
            finally { setSimilarLoading(false); }
        }
        fetchSimilar();
    }, [playerIdFromUrl]);

    if (loading) return (
        <div className="min-h-screen bg-[#020812] flex flex-col items-center justify-center text-white gap-6">
            <Loader2 className="animate-spin text-emerald-500 w-16 h-16" />
            <h2 className="text-xl font-black tracking-widest uppercase animate-pulse text-emerald-400/80">Sincronizando Métricas...</h2>
        </div>
    );

    if (!player) return <div className="min-h-screen bg-[#020812] flex items-center justify-center text-white font-black text-3xl">TALENTO NO ENCONTRADO</div>;

    const posKey = player.Pos_Main.toLowerCase();
    const baseStats = BASE_STATS_MAP[posKey] || [];
    const efficiencyStats = EFFICIENCY_MAP[posKey] || [];
    const keyMetricsForPosition = KEY_METRICS_BY_POSITION[posKey] || [];
    const PosIcon = getPosIcon(player.Pos_Main);

    return (
        <section className="relative min-h-screen bg-[#020812] overflow-hidden font-sans text-white p-6">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(16,185,129,0.07),transparent)]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.8) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            <div className="relative z-10 pt-24 pb-20 max-w-7xl mx-auto space-y-10">
                <div className="mb-4 no-print">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="group inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-bold text-sm uppercase tracking-widest"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Volver
                    </button>
                </div>

                {/* TARJETA PRINCIPAL CON IMAGEN REAL */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="glass border border-white/[0.07] rounded-[2.5rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative"
                >
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <div className="grid md:grid-cols-3 gap-12 p-12 items-center relative z-10">

                        {/* CONTENEDOR DE LA IMAGEN */}
                        <div className="flex flex-col items-center justify-center">
                            <div className="relative group">
                                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-3xl group-hover:bg-emerald-500/30 transition-all duration-700" />
                                <div className="relative w-64 h-64 rounded-full bg-gradient-to-b from-[#0a1628] to-[#020812] flex items-end justify-center border-4 border-white/[0.05] overflow-hidden shadow-2xl">
                                    {player.strCutout ? (
                                        <img
                                            src={player.strCutout}
                                            alt={player.Player}
                                            className="h-[90%] w-auto object-contain z-10 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transform group-hover:scale-110 transition-transform duration-500"
                                            onError={(e: SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = 'https://www.thesportsdb.com/images/media/player/cutout/default.png'; }}
                                        />
                                    ) : (
                                        <User className="w-36 h-36 text-white/5 mb-10" />
                                    )}
                                </div>
                                <div className="absolute -bottom-2 right-6 flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 rounded-2xl shadow-xl border-2 border-[#020812] z-20">
                                    <PosIcon className="w-4 h-4" />
                                    <span className="font-black text-xs uppercase tracking-wider">{player.Pos_Main}</span>
                                </div>
                            </div>
                        </div>

                        {/* INFO TEXTUAL */}
                        <div className="md:col-span-2 text-center md:text-left space-y-8">
                            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none italic uppercase">
                                {player.Player}
                            </h1>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                                <InfoItem Icon={MapPin} label="Club" value={capitalizeName((player as any).Squad) || 'N/A'} />
                                <InfoItem Icon={Globe} label="Nacionalidad" value={
                                    <div className="flex items-center gap-2">
                                        {getFlagUrl(player.Nation) && <img src={getFlagUrl(player.Nation)!} alt="" className="w-6 h-4 object-cover rounded-sm" />}
                                        <span className="text-xs text-gray-400 uppercase">{(player as any).Nation?.split(' ').pop()}</span>
                                    </div>
                                } />
                                <InfoItem Icon={Cake} label="Edad" value={`${player.Age} Años`} />
                                <InfoItem Icon={Ruler} label="Altura" value={formatHeight(player.Altura as number)} />
                                <InfoItem Icon={Footprints} label="Pierna buena" value={formatPreferredFoot(player.Pierna_Buena as string)} />
                                <InfoItem Icon={TrendingUp} label="Valor Mercado" value={formatMarketValue((player as any).Valor_Mercado || 0)} />
                                <InfoItem Icon={Target} label="Estilo" value={player.Perfil_Principal} />
                                <InfoItem Icon={Award} label="Pureza IA" value={`${(player.Puresa_Perfil * 100).toFixed(1)}%`} />
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Tarjetas base: Partidos, Titularidades, Minutos, Min/Partido */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-5"
                >
                    {baseStats.map((stat) => (
                        <div key={stat.key} className="glass border border-white/[0.05] p-8 rounded-3xl hover:border-emerald-500/40 transition-all duration-400 hover:-translate-y-1 hover:shadow-2xl group">
                            <stat.icon className="w-6 h-6 text-emerald-500/40 mb-5 group-hover:text-emerald-400 transition-colors" />
                            <p className="text-4xl font-data font-black mb-1 text-white">{(player as any)[stat.key] ?? 0}</p>
                            <p className="text-[11px] uppercase font-black text-gray-500 tracking-widest">{stat.label}</p>
                        </div>
                    ))}
                </motion.div>

                {/* Métricas más importantes para su posición */}
                {keyMetricsForPosition.length > 0 && (
                    <div className="space-y-5">
                        <h2 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                            <Target className="w-5 h-5 text-green-400" />
                            Métricas clave para {player.Pos_Main.toUpperCase()}
                        </h2>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
                        >
                            {keyMetricsForPosition.map((m) => (
                                <div key={m.key} className="glass-dark border border-white/[0.05] p-5 rounded-2xl hover:border-emerald-500/30 transition-all duration-400 hover:-translate-y-1 hover:shadow-xl">
                                    <p className="text-2xl font-data font-black text-emerald-400/90 mb-1">
                                        {formatKeyMetricValue((player as any)[m.key], m.suffix)}
                                    </p>
                                    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{m.label}</p>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                )}

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="grid md:grid-cols-2 gap-8"
                >
                    <div className="glass border border-white/[0.05] p-10 rounded-3xl relative overflow-hidden shadow-2xl">
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-500/5 blur-3xl rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />
                        <h2 className="text-xl font-black mb-2 flex items-center gap-3 uppercase tracking-tighter relative z-10">
                            <Percent className="text-emerald-400 w-5 h-5" /> Perfil Físico-Técnico
                        </h2>
                        <p className="text-sm text-gray-500 mb-8 relative z-10">
                            Métricas comparadas contra el valor ideal para su posición.
                        </p>
                        <div className="space-y-8 relative z-10">
                            {efficiencyStats.map((stat) => (
                                <Fragment key={stat.key}>
                                    <ProgressBar
                                        label={stat.label}
                                        value={(player as any)[stat.key] ?? 0}
                                        max={stat.max}
                                        color="from-green-500 to-emerald-400"
                                        description={'description' in stat ? stat.description : undefined}
                                    />
                                </Fragment>
                            ))}
                        </div>
                    </div>

                    <div className="glass border border-white/[0.07] p-10 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
                        <div className="space-y-8 relative z-10">
                            <div className="mb-2">
                                <h2 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter">
                                    <TrendingUp className="text-purple-400 w-5 h-5" /> Impacto Colectivo (On/Off)
                                </h2>
                                <p className="text-sm text-gray-500 mt-2">
                                    Mide la influencia real del jugador en el rendimiento del equipo. Un valor positivo indica que el equipo es mejor con él en el campo.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="glass-dark p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dif. Goles / 90</p>
                                    <div className={`text-3xl font-data font-black ${(player as any)['+/-90'] > 0 ? 'text-emerald-400' : (player as any)['+/-90'] < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                                        {(player as any)['+/-90'] > 0 ? '+' : ''}{formatKeyMetricValue((player as any)['+/-90'])}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Impacto neto en marcador</p>
                                </div>
                                <div className="glass-dark p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dif. xG / 90</p>
                                    <div className={`text-3xl font-data font-black ${(player as any)['xG+/-90'] > 0 ? 'text-emerald-400' : (player as any)['xG+/-90'] < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                                        {(player as any)['xG+/-90'] > 0 ? '+' : ''}{formatKeyMetricValue((player as any)['xG+/-90'])}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Impacto neto en peligro</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 glass rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Producción Ofensiva</p>
                                        <p className="text-xs text-gray-500">Goles vs Goles Esperados</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-data font-bold text-white"><span className="text-gray-500 text-xs">Real:</span> {formatKeyMetricValue((player as any)['onG'])}</p>
                                        <p className="font-data font-bold text-emerald-400/80"><span className="text-gray-500 text-xs">xG:</span> {formatKeyMetricValue((player as any)['onxG'])}</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center p-4 glass rounded-xl border border-white/5">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Solidez Defensiva</p>
                                        <p className="text-xs text-gray-500">Concedidos vs xG Concedidos</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-data font-bold text-white"><span className="text-gray-500 text-xs">Real:</span> {formatKeyMetricValue((player as any)['onGA'])}</p>
                                        <p className="font-data font-bold text-red-400/80"><span className="text-gray-500 text-xs">xGA:</span> {formatKeyMetricValue((player as any)['onxGA'])}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => window.print()} className="w-full mt-8 py-4 glass hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 group uppercase tracking-widest text-xs relative z-10 no-print">
                            Exportar Informe (PDF) <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5" />
                        </button>
                    </div>
                </motion.div>

                {/* Gráfica valor por temporada y predicción */}
                <ValorPorTemporadaChart
                    seasons={seasonsData}
                    currentValue={(player as any).Valor_Mercado ?? null}
                    predictedValue={predictedValue}
                    predictedDiff={predictedDiff}
                    predictedLoading={predictedLoading}
                    explanationData={predictionData}
                />

                {/* Sección de Jugadores Similares */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black flex items-center gap-3 uppercase tracking-tight text-white">
                            <Dna className="w-5 h-5 text-blue-400 animate-pulse" /> Perfiles Similares
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-blue-500/30" />
                            <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-[0.2em] bg-blue-500/5 px-3 py-1 rounded-full border border-blue-500/10">
                                ADN Estadístico
                            </span>
                        </div>
                    </div>

                    {similarLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="glass-dark h-64 rounded-[2rem] animate-pulse bg-white/5 border border-white/5" />
                            ))}
                        </div>
                    ) : similarPlayers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                            <AnimatePresence>
                                {similarPlayers.map((sim, i) => {
                                    const SimPosIcon = getPosIcon(sim.Pos);
                                    return (
                                        <motion.div
                                            key={sim.PlayerID}
                                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{ duration: 0.4, delay: i * 0.1 }}
                                        >
                                            <Link
                                                href={`/scouting/${sim.PlayerID}`}
                                                className="group block relative glass-dark border border-white/10 rounded-[2rem] p-6 hover:border-blue-500/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(59,130,246,0.15)] overflow-hidden"
                                            >
                                                {/* Efecto de resplandor interno */}
                                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full group-hover:bg-blue-500/20 transition-all duration-700" />

                                                <div className="flex flex-col items-center text-center relative z-10">
                                                    {/* Foto con anillo de similitud */}
                                                    <div className="relative mb-5">
                                                        <svg className="w-24 h-24 transform -rotate-90">
                                                            <circle cx="48" cy="48" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                                            <circle
                                                                cx="48" cy="48" r="45" fill="none"
                                                                stroke="url(#blueGradient)"
                                                                strokeWidth="3"
                                                                strokeDasharray={2 * Math.PI * 45}
                                                                strokeDashoffset={2 * Math.PI * 45 * (1 - sim.Similarity / 100)}
                                                                strokeLinecap="round"
                                                                className="transition-all duration-1000 ease-out"
                                                            />
                                                            <defs>
                                                                <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                                                    <stop offset="0%" stopColor="#3b82f6" />
                                                                    <stop offset="100%" stopColor="#06b6d4" />
                                                                </linearGradient>
                                                            </defs>
                                                        </svg>
                                                        <div className="absolute inset-0 m-2 rounded-full bg-slate-900 border border-white/10 overflow-hidden flex items-end justify-center">
                                                            {sim.strCutout && sim.strCutout !== 'nan' ? (
                                                                <img src={sim.strCutout} alt={sim.Player} className="w-full h-auto object-contain transform group-hover:scale-110 transition-transform duration-500" />
                                                            ) : (
                                                                <User className="w-10 h-10 text-white/10 mb-4" />
                                                            )}
                                                        </div>
                                                        {/* Badge Posición */}
                                                        <div className="absolute -bottom-1 -right-1 p-1.5 bg-blue-500 rounded-lg shadow-lg border border-[#020812]">
                                                            <SimPosIcon className="w-2.5 h-2.5 text-white" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <h3 className="font-black text-sm uppercase tracking-tight text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                                                            {sim.Player}
                                                        </h3>
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <MapPin className="w-2.5 h-2.5 text-gray-500" />
                                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest truncate max-w-[100px]">
                                                                {sim.Squad}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 w-full pt-4 border-t border-white/5 flex flex-col gap-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Coincidencia</span>
                                                            <span className="text-xs font-black text-blue-400">{sim.Similarity}%</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${sim.Similarity}%` }}
                                                                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                                                                />
                                                            </div>
                                                            <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-blue-400 transition-colors" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    ) : (
                        <div className="glass-dark p-12 rounded-[2rem] border border-white/5 text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Dna className="w-12 h-12 text-white/5 mx-auto mb-4" />
                            <p className="text-gray-500 text-sm italic font-medium">No se encontraron perfiles con suficiente similitud estadística.</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

// --- GRÁFICA VALOR POR TEMPORADA Y PREDICCIÓN ---
function formatValueShort(value: number): string {
    if (value >= 1_000_000) {
        const m = value / 1_000_000;
        return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (value >= 1_000) {
        const k = value / 1_000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
    }
    return String(value);
}

function formatValueFull(value: number): string {
    if (value >= 1_000_000) {
        const m = value / 1_000_000;
        return `${Number.isInteger(m) ? m : m.toFixed(1)}M€`;
    }
    if (value >= 1_000) {
        const k = value / 1_000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}K€`;
    }
    return `${value}€`;
}

function ValorPorTemporadaChart({
    seasons,
    currentValue,
    predictedValue,
    predictedDiff,
    predictedLoading,
    explanationData,
}: {
    seasons: { Season: string; Valor_Mercado: number | null }[];
    currentValue: number | null;
    predictedValue?: number | null;
    predictedDiff?: number | null;
    predictedLoading?: boolean;
    explanationData?: PredictionWithXai | null;
}) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const validSeasons = seasons.filter((s) => s.Valor_Mercado != null && s.Valor_Mercado > 0);
    const lastValue = validSeasons.length > 0 ? (validSeasons[validSeasons.length - 1].Valor_Mercado ?? 0) : (currentValue ?? 0);
    // Usa el valor del modelo si está disponible, si no fallback +3%
    const predictionValue = predictedValue ?? Math.round(lastValue * 1.03);
    const isRealPrediction = !!predictedValue;
    const seasonLabel = (sea: string) => (sea && sea.length >= 9 ? `${sea.slice(2, 4)}-${sea.slice(7, 9)}` : sea);
    const seasonFull = (sea: string) => (sea && sea.length >= 9 ? sea : sea);
    const allPoints = [
        ...validSeasons.map((s) => ({ label: seasonLabel(s.Season), fullLabel: seasonFull(s.Season), value: s.Valor_Mercado as number, isPrediction: false })),
        ...(lastValue > 0 ? [{ label: 'Próx.', fullLabel: 'Predicción modelo', value: predictionValue, isPrediction: true }] : []),
    ];
    const values = allPoints.map((p) => p.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 1);
    const range = maxVal - minVal || 1;
    const padding = { top: 36, right: 24, bottom: 48, left: 58 };
    const w = 680;
    const h = 300;
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const x = (i: number) => padding.left + (i / Math.max(allPoints.length - 1, 1)) * chartW;
    const y = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH;
    const pathD = allPoints
        .filter((p) => !p.isPrediction)
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`)
        .join(' ');
    const areaD = pathD ? `${pathD} L ${x(allPoints.filter((p) => !p.isPrediction).length - 1)} ${y(minVal)} L ${x(0)} ${y(minVal)} Z` : '';
    const predIdx = allPoints.length - 1;
    const predPath = allPoints.length > 1 && allPoints[predIdx].isPrediction
        ? `M ${x(predIdx - 1)} ${y(allPoints[predIdx - 1].value)} L ${x(predIdx)} ${y(allPoints[predIdx].value)}`
        : '';

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minVal + range * t);

    const diffSign = (predictedDiff ?? 0) >= 0;
    const diffAbs = Math.abs(predictedDiff ?? 0).toFixed(1);

    // ── SKELETON: mostrar mientras el modelo está cargando ──────────────────
    if (predictedLoading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="glass border border-white/[0.05] rounded-3xl p-8 md:p-10 relative overflow-hidden shadow-2xl"
            >
                {/* Cabecera skeleton */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded bg-slate-700 animate-pulse" />
                        <div className="h-5 w-56 rounded-lg bg-slate-700 animate-pulse" />
                    </div>
                    <div className="h-7 w-36 rounded-full bg-slate-700 animate-pulse" />
                </div>
                <div className="h-3 w-80 rounded bg-slate-700/60 animate-pulse mb-8" />

                {/* SVG skeleton con curva decorativa */}
                <div className="overflow-x-auto">
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[320px] max-w-full h-auto" preserveAspectRatio="xMidYMid meet">
                        {/* Cuadrícula simulada */}
                        {[0.25, 0.5, 0.75].map((t, i) => (
                            <line key={i}
                                x1={padding.left} y1={padding.top + chartH * (1 - t)}
                                x2={w - padding.right} y2={padding.top + chartH * (1 - t)}
                                stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4"
                            />
                        ))}
                        {/* Etiquetas eje Y skeleton */}
                        {[0.08, 0.32, 0.56, 0.80].map((t, i) => (
                            <rect key={i} x={4} y={padding.top + chartH * (1 - t) - 5}
                                width={44} height={10} rx={4} fill="rgba(100,116,139,0.20)" />
                        ))}
                        {/* Área skeleton */}
                        <path
                            d={`M ${padding.left} ${padding.top + chartH * 0.72}
                                C ${padding.left + chartW * 0.18} ${padding.top + chartH * 0.55},
                                  ${padding.left + chartW * 0.33} ${padding.top + chartH * 0.62},
                                  ${padding.left + chartW * 0.50} ${padding.top + chartH * 0.38}
                                C ${padding.left + chartW * 0.64} ${padding.top + chartH * 0.18},
                                  ${padding.left + chartW * 0.78} ${padding.top + chartH * 0.28},
                                  ${padding.left + chartW * 0.88} ${padding.top + chartH * 0.14}
                                L ${padding.left + chartW * 0.88} ${padding.top + chartH}
                                L ${padding.left} ${padding.top + chartH} Z`}
                            fill="rgba(52,211,153,0.05)"
                        />
                        {/* Línea histórica skeleton */}
                        <path
                            d={`M ${padding.left} ${padding.top + chartH * 0.72}
                                C ${padding.left + chartW * 0.18} ${padding.top + chartH * 0.55},
                                  ${padding.left + chartW * 0.33} ${padding.top + chartH * 0.62},
                                  ${padding.left + chartW * 0.50} ${padding.top + chartH * 0.38}
                                C ${padding.left + chartW * 0.64} ${padding.top + chartH * 0.18},
                                  ${padding.left + chartW * 0.78} ${padding.top + chartH * 0.28},
                                  ${padding.left + chartW * 0.88} ${padding.top + chartH * 0.14}`}
                            fill="none" stroke="rgba(52,211,153,0.18)" strokeWidth="2.5" strokeLinecap="round"
                        />
                        {/* Línea predicción skeleton */}
                        <path
                            d={`M ${padding.left + chartW * 0.88} ${padding.top + chartH * 0.14} L ${w - padding.right} ${padding.top + chartH * 0.06}`}
                            fill="none" stroke="rgba(251,191,36,0.18)" strokeWidth="2" strokeDasharray="8 5" strokeLinecap="round"
                        />
                        {/* Puntos skeleton */}
                        {([
                            [0, 0.72], [0.22, 0.55], [0.45, 0.38], [0.67, 0.28], [0.88, 0.14], [1.0, 0.06]
                        ] as [number, number][]).map(([tx, ty], i) => (
                            <circle key={i}
                                cx={padding.left + chartW * tx}
                                cy={padding.top + chartH * ty}
                                r={6}
                                fill={i === 5 ? 'rgba(251,191,36,0.22)' : 'rgba(52,211,153,0.22)'}
                            />
                        ))}
                        {/* Etiquetas eje X skeleton */}
                        {[0, 0.22, 0.45, 0.67, 0.88, 1.0].map((t, i) => (
                            <rect key={i}
                                x={padding.left + chartW * t - 14} y={h - 28}
                                width={28} height={10} rx={4} fill="rgba(100,116,139,0.20)"
                            />
                        ))}
                    </svg>
                </div>

                {/* Leyenda skeleton */}
                <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-400/20 animate-pulse" />
                        <div className="h-3 w-16 rounded bg-slate-700/60 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-400/20 animate-pulse" />
                        <div className="h-3 w-44 rounded bg-slate-700/60 animate-pulse" />
                    </div>
                    <div className="h-3 w-52 rounded bg-slate-700/40 animate-pulse" />
                </div>
            </motion.div>
        );
    }
    // ────────────────────────────────────────────────────────────────────────

    if (validSeasons.length === 0 && !currentValue) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="glass border border-white/[0.05] rounded-3xl p-10 relative overflow-hidden shadow-2xl"
            >
                <h2 className="text-xl font-black mb-4 flex items-center gap-3 uppercase tracking-tight">
                    <LineChart className="w-5 h-5 text-green-400" /> Valor por temporada y predicción
                </h2>
                <p className="text-gray-500 text-sm">No hay datos históricos de valor por temporada para este jugador.</p>
            </motion.div>
        );
    }


    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="glass border border-white/[0.05] rounded-3xl p-8 md:p-10 relative overflow-hidden shadow-2xl"
        >
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                    <h2 className="text-xl font-black flex items-center gap-3 uppercase tracking-tight">
                        <LineChart className="w-5 h-5 text-green-400" /> Valor por temporada y predicción
                    </h2>
                    {!predictedLoading && isRealPrediction && predictedDiff !== null && (
                        <span className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-black uppercase tracking-wider ${diffSign
                                ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                : 'bg-red-500/15 border-red-500/40 text-red-400'
                            }`}>
                            {diffSign
                                ? <TrendingUp className="w-4 h-4" />
                                : <TrendingDown className="w-4 h-4" />}
                            {diffSign ? '+' : '-'}{diffAbs}% modelo
                        </span>
                    )}
                </div>
                <p className="text-gray-500 text-sm mb-6">
                    Pasa el cursor sobre un punto para ver el valor. La línea discontinua es la predicción del modelo por posición, edad y estadísticas.
                </p>
                <div className="overflow-x-auto relative">
                    <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[320px] max-w-full h-auto" preserveAspectRatio="xMidYMid meet">
                        {/* Área bajo la línea (gradiente suave) */}
                        <defs>
                            <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {areaD && <path d={areaD} fill="url(#chartAreaGradient)" />}

                        {/* Cuadrícula horizontal */}
                        {yTicks.slice(1, -1).map((val, idx) => (
                            <line
                                key={idx}
                                x1={padding.left}
                                y1={y(val)}
                                x2={w - padding.right}
                                y2={y(val)}
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                            />
                        ))}

                        {/* Eje Y: etiquetas de valor */}
                        {yTicks.map((val, idx) => (
                            <text
                                key={idx}
                                x={padding.left - 10}
                                y={y(val)}
                                textAnchor="end"
                                dominantBaseline="middle"
                                className="fill-gray-500 text-[11px] font-semibold tabular-nums"
                            >
                                {formatValueShort(val)}
                            </text>
                        ))}

                        {/* Línea histórica */}
                        {pathD && <path d={pathD} fill="none" stroke="rgb(52, 211, 153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                        {predPath && <path d={predPath} fill="none" stroke="rgb(251, 191, 36)" strokeWidth="2" strokeDasharray="8 5" strokeLinecap="round" />}

                        {/* Puntos con zona de hover */}
                        {allPoints.map((p, i) => {
                            const cx = x(i);
                            const cy = y(p.value);
                            const isHovered = hoveredIndex === i;
                            const r = 6;
                            const hoverR = 14;
                            return (
                                <g key={i}>
                                    <circle cx={cx} cy={cy} r={hoverR} fill="transparent" style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} />
                                    <circle cx={cx} cy={cy} r={isHovered ? r + 2 : r} fill={p.isPrediction ? 'rgb(251, 191, 36)' : 'rgb(52, 211, 153)'} stroke="rgb(15, 23, 42)" strokeWidth={isHovered ? 2 : 1} style={{ pointerEvents: 'none' }} />
                                </g>
                            );
                        })}

                        {/* Etiquetas eje X (temporadas) */}
                        {allPoints.map((p, i) => (
                            <text key={i} x={x(i)} y={h - 18} textAnchor="middle" className="fill-gray-500 text-[10px] font-semibold">
                                {p.label}
                            </text>
                        ))}

                        {/* Título eje Y */}
                        <text x={16} y={padding.top + chartH / 2} textAnchor="middle" transform={`rotate(-90, 16, ${padding.top + chartH / 2})`} className="fill-gray-500 text-[10px] font-bold uppercase tracking-wider">
                            Valor de mercado
                        </text>

                        {/* Tooltip encima de todo (renderizado al final para que no quede tapado) */}
                        {hoveredIndex !== null && (() => {
                            const p = allPoints[hoveredIndex];
                            const cx = x(hoveredIndex);
                            const cy = y(p.value);
                            const tw = 112;
                            const th = 36;
                            const tx = Math.max(8, Math.min(cx - tw / 2, w - tw - 8));
                            const ty = Math.max(8, cy - th - 16);
                            return (
                                <g pointerEvents="none">
                                    <rect x={tx} y={ty} width={tw} height={th} rx={8} fill="rgb(30, 41, 59)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                                    <text x={tx + tw / 2} y={ty + 16} textAnchor="middle" className="fill-gray-300 text-[11px] font-bold">{p.fullLabel}</text>
                                    <text x={tx + tw / 2} y={ty + 28} textAnchor="middle" className="fill-green-400 text-[13px] font-black tabular-nums">{formatValueFull(p.value)}</text>
                                </g>
                            );
                        })()}
                    </svg>
                </div>
                <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-white/10">
                    <span className="flex items-center gap-2 text-sm text-gray-400"><span className="w-3 h-3 rounded-full bg-green-400" /> Histórico</span>
                    {allPoints.some((p) => p.isPrediction) && (
                        <span className="flex items-center gap-2 text-sm text-gray-400">
                            <span className="w-3 h-3 rounded-full bg-amber-400" />
                            {isRealPrediction ? 'Predicción modelo (próx. temporada)' : 'Predicción orientativa'}
                        </span>
                    )}
                    {isRealPrediction && (
                        <span className="text-xs text-gray-600">Modelo: pesos por posición + curva de edad</span>
                    )}
                </div>
                {/* --- JUSTIFICACIÓN DEL MODELO (XAI) --- */}
                {explanationData?.xai_down_trend && (
                    <div className="mt-8 pt-6 border-t border-white/10 space-y-5">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-blue-400 shrink-0" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                                Justificación del Modelo
                            </h4>
                            <div className="group relative inline-flex items-center focus-within:outline-none">
                                <button
                                    type="button"
                                    className="rounded-full p-0.5 text-gray-500 hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                                    aria-label="Ayuda: por qué puede bajar el valor predicho"
                                >
                                    <HelpCircle className="w-4 h-4 cursor-help" />
                                </button>
                                <div
                                    className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[min(100vw-2rem,22rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-slate-900/98 p-3 text-left text-[11px] leading-relaxed text-gray-300 opacity-0 shadow-xl ring-1 ring-white/5 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 md:left-0 md:translate-x-0"
                                    role="tooltip"
                                >
                                    {XAI_DOWN_TREND_HELP}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
                            <div className="space-y-3">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Desglose de impactos</p>
                                <ul className="space-y-2.5">
                                    {explanationData.xai_down_trend.impact_lines.map((line, idx) => (
                                        <li key={idx} className="flex gap-2.5 text-[12px] leading-snug text-gray-300">
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.45)]" />
                                            <span>{line}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="space-y-1.5 border-t border-white/5 pt-3 text-[11px] text-gray-500">
                                    <p className="tabular-nums text-gray-400">{explanationData.xai_down_trend.factor_edad_line}</p>
                                    <p className="tabular-nums text-gray-400">{explanationData.xai_down_trend.coef_liga_line}</p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-slate-900/40 to-slate-900/80 p-5 shadow-[0_0_40px_rgba(59,130,246,0.08)]">
                                <p className="text-[12px] font-medium leading-relaxed text-gray-100">
                                    {explanationData.xai_down_trend.highlight_box}
                                </p>
                            </div>
                        </div>

                        <p className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-[12px] italic leading-relaxed text-gray-400">
                            {explanationData.xai_down_trend.conclusion}
                        </p>

                        <p className="text-center text-[11px] text-gray-500">
                            Nivel de liga detectado:{' '}
                            <span className="font-bold uppercase text-gray-300">{explanationData.league ?? '—'}</span>
                            {' '}(x{explanationData.league_coeff ?? '1'})
                        </p>
                    </div>
                )}
                {!explanationData?.xai_down_trend && explanationData?.explanation_details && explanationData.explanation_details.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Target className="w-4 h-4 text-blue-400" />
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                                Justificación del Modelo
                            </h4>
                            {(predictedDiff ?? 0) < 0 && (
                                <div className="group relative inline-flex items-center focus-within:outline-none">
                                    <button
                                        type="button"
                                        className="rounded-full p-0.5 text-gray-500 hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                                        aria-label="Ayuda: por qué puede bajar el valor predicho"
                                    >
                                        <HelpCircle className="w-4 h-4 cursor-help" />
                                    </button>
                                    <div
                                        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-[min(100vw-2rem,22rem)] -translate-x-1/2 rounded-xl border border-white/10 bg-slate-900/98 p-3 text-left text-[11px] leading-relaxed text-gray-300 opacity-0 shadow-xl ring-1 ring-white/5 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 md:left-0 md:translate-x-0"
                                        role="tooltip"
                                    >
                                        {XAI_DOWN_TREND_HELP}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {explanationData.explanation_details.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 items-start group mb-2">
                                        <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        <p className="text-[12px] text-gray-400 leading-relaxed italic group-hover:text-gray-200 transition-colors">
                                            {item.mensaje}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                <p className="text-[12px] text-emerald-400 font-medium mb-2">
                                    {explanationData.age_analysis}
                                </p>
                                <p className="text-[11px] text-gray-500 leading-tight text-center md:text-left">
                                    Nivel de liga detectado: <span className="text-gray-300 uppercase font-bold">{explanationData.league}</span> (x{explanationData.league_coeff})
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}





























// --- SUBCOMPONENTES ---
function InfoItem({ Icon, label, value }: { Icon: any, label: string, value: any }) {
    return (
        <div className="flex items-center gap-4">
            <div className="p-2.5 glass border border-white/[0.05] rounded-xl"><Icon className="w-4 h-4 text-emerald-400" /></div>
            <div>
                <p className="text-[10px] uppercase font-black text-gray-500 tracking-wider mb-0.5">{label}</p>
                <div className="text-white font-bold text-sm tracking-tight">{value}</div>
            </div>
        </div>
    );
}

function AnalysisPoint({ title, text }: { title: string, text: string }) {
    return (
        <div className="flex gap-5">
            <div className="w-1.5 h-12 bg-green-500 rounded-full shrink-0" />
            <div>
                <h4 className="text-white font-black text-xs mb-1.5 uppercase tracking-widest">{title}</h4>
                <p className="text-gray-400 text-xs leading-relaxed">{text}</p>
            </div>
        </div>
    );
}

function ProgressBar({
    label,
    value,
    max,
    color,
    description,
}: { label: string, value: number, max: number, color: string, description?: string }) {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const displayValue = max === 100 ? `${Number(value).toFixed(1)}%` : typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : String(value);
    return (
        <div>
            <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest">{label}</span>
                <span className="text-lg font-black text-white">{displayValue}</span>
            </div>
            <div className="w-full glass-dark rounded-full h-2.5 overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`} style={{ width: `${percentage}%` }} />
            </div>
            {description && (
                <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">{description}</p>
            )}
        </div>
    );
}