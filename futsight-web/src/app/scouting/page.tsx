/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { User, Shield, Zap, Globe, Search, Filter, X, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, LayoutGrid } from 'lucide-react';
import { PlayerData } from '@/lib/getPlayers';
import { motion, AnimatePresence } from 'framer-motion';

// --- HELPERS ---
const normalizeString = (str: string) => {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "");
};

const getPosIcon = (pos: string) => {
    const p = pos?.toLowerCase() || '';
    if (p.includes('gk') || p.includes('df')) return Shield;
    if (p.includes('mf')) return Globe;
    if (p.includes('fw')) return Zap;
    return User;
};

const capitalizeName = (str: string) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// --- COMPONENTE SKELETON ---
const PlayerSkeleton = () => (
    <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="h-64 relative overflow-hidden bg-[#0a1628]">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>
        <div className="p-5 space-y-3">
            <div className="h-5 bg-white/[0.05] rounded-lg w-3/4 overflow-hidden relative">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
            </div>
            <div className="h-3.5 bg-white/[0.04] rounded-lg w-1/2" />
            <div className="pt-3 border-t border-white/[0.05] flex justify-between">
                <div className="h-7 bg-white/[0.04] rounded-lg w-14" />
                <div className="h-7 bg-white/[0.04] rounded-lg w-20" />
            </div>
        </div>
    </div>
);

export default function ScoutingPage() {
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPosition, setSelectedPosition] = useState('');
    const [selectedNation, setSelectedNation] = useState('');
    const [selectedPerfil, setSelectedPerfil] = useState('');
    const [ageRange, setAgeRange] = useState({ min: '', max: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [sortBy, setSortBy] = useState<string>('valor-desc');
    const [currentPage, setCurrentPage] = useState(1);
    const playersPerPage = 20;

    useEffect(() => {
        async function loadData() {
            try {
                const response = await fetch('/api/players');
                const data = await response.json();
                setPlayers(data);
            } catch (error) {
                console.error("Error cargando API:", error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const positions = useMemo(() => [...new Set(players.map(p => p.Pos_Main).filter(Boolean))].sort(), [players]);
    const nations = useMemo(() => [...new Set(players.map(p => (p as any).Nation).filter(Boolean))].sort(), [players]);

    const allPerfiles = useMemo(() => {
        let playersSource = players;
        if (selectedPosition) {
            playersSource = players.filter(p => p.Pos_Main === selectedPosition);
        }
        return [...new Set(playersSource.map(p => p.Perfil_Historico).filter(Boolean))].sort();
    }, [players, selectedPosition]);

    useEffect(() => {
        if (selectedPerfil && !allPerfiles.includes(selectedPerfil)) {
            setSelectedPerfil('');
        }
    }, [selectedPosition, allPerfiles, selectedPerfil]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedPosition, selectedNation, selectedPerfil, ageRange.min, ageRange.max, sortBy]);

    const filteredPlayers = useMemo(() => {
        const normalizedSearch = normalizeString(searchTerm);

        const result = players.filter(player => {
            const playerName = normalizeString(player.Player);
            const playerSquad = normalizeString((player as any).Squad || '');
            const matchesSearch = playerName.includes(normalizedSearch) || playerSquad.includes(normalizedSearch);
            const matchesPosition = !selectedPosition || player.Pos_Main === selectedPosition;
            const matchesNation = !selectedNation || (player as any).Nation === selectedNation;
            const matchesPerfil = !selectedPerfil || player.Perfil_Historico === selectedPerfil;
            const playerAge = (player as any).Age || 0;
            const matchesAge = (!ageRange.min || playerAge >= parseInt(ageRange.min)) &&
                               (!ageRange.max || playerAge <= parseInt(ageRange.max));
            return matchesSearch && matchesPosition && matchesNation && matchesPerfil && matchesAge;
        });

        // Ordenación profesional: valor de mercado por defecto, luego producción, minutos, edad, nombre
        const gA = (p: any) => ((p.Gls ?? 0) + (p.Ast ?? 0));
        const val = (p: any) => p.Valor_Mercado ?? 0;
        const min = (p: any) => p.Min ?? 0;
        const age = (p: any) => p.Age ?? 99;

        if (sortBy === 'valor-desc') result.sort((a, b) => val(b) - val(a) || gA(b) - gA(a) || min(b) - min(a));
        else if (sortBy === 'valor-asc') result.sort((a, b) => val(a) - val(b) || gA(b) - gA(a));
        else if (sortBy === 'produccion-desc') result.sort((a, b) => gA(b) - gA(a) || val(b) - val(a));
        else if (sortBy === 'minutos-desc') result.sort((a, b) => min(b) - min(a) || gA(b) - gA(a));
        else if (sortBy === 'edad-asc') result.sort((a, b) => age(a) - age(b) || gA(b) - gA(a));
        else if (sortBy === 'edad-desc') result.sort((a, b) => age(b) - age(a) || gA(b) - gA(a));
        else if (sortBy === 'name-asc') result.sort((a, b) => a.Player.localeCompare(b.Player));
        else if (sortBy === 'name-desc') result.sort((a, b) => b.Player.localeCompare(a.Player));
        return result;
    }, [players, searchTerm, selectedPosition, selectedNation, selectedPerfil, ageRange, sortBy]);

    const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
    const currentPlayers = filteredPlayers.slice((currentPage - 1) * playersPerPage, currentPage * playersPerPage);

    const clearAllFilters = () => {
        setSearchTerm(''); setSelectedPosition(''); setSelectedNation('');
        setSelectedPerfil(''); setAgeRange({ min: '', max: '' }); setSortBy('valor-desc'); setCurrentPage(1);
    };

    const hasActiveFilters = searchTerm || selectedPosition || selectedNation || selectedPerfil || ageRange.min || ageRange.max;

    // Helper para color de posición
    const getPosGradient = (pos: string) => {
        const p = pos?.toLowerCase() || '';
        if (p.includes('gk')) return 'from-orange-950/80 via-[#020812] to-[#020812]';
        if (p.includes('df')) return 'from-blue-950/80 via-[#020812] to-[#020812]';
        if (p.includes('mf')) return 'from-purple-950/80 via-[#020812] to-[#020812]';
        return 'from-emerald-950/80 via-[#020812] to-[#020812]';
    };
    const getPosAccent = (pos: string) => {
        const p = pos?.toLowerCase() || '';
        if (p.includes('gk')) return 'rgba(249,115,22,0.25)';
        if (p.includes('df')) return 'rgba(59,130,246,0.25)';
        if (p.includes('mf')) return 'rgba(168,85,247,0.25)';
        return 'rgba(16,185,129,0.25)';
    };
    const formatValue = (v: number) => {
        if (!v) return null;
        if (v >= 1000000) return `€${(v/1000000).toFixed(0)}M`;
        if (v >= 1000) return `€${(v/1000).toFixed(0)}K`;
        return `€${v}`;
    };

    return (
        <section className="relative min-h-screen bg-[#020812] overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(16,185,129,0.07),transparent)]" />
                <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(rgba(16,185,129,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.8) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
            </div>

            <div className="relative z-10 pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto mb-12 text-center">
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-2 glass border border-emerald-500/20 rounded-full mb-6"
                    >
                        <LayoutGrid className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em]">Catálogo de Jugadores</span>
                    </motion.div>
                    <h1 className="text-5xl md:text-8xl font-black mb-6 leading-none tracking-tight">
                        <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Explora</span>
                        <br />
                        <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">talento</span>
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Catálogo de jugadores con filtros por posición, perfil y métricas. Incluye análisis de pureza de perfil.
                    </p>
                </div>

                {/* Barra de Búsqueda y Filtros */}
                <div className="max-w-7xl mx-auto mb-10">
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-green-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o club..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 glass border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xl"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div className="min-w-[180px]">
                                <label className="sr-only">Ordenar por</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                                    className="w-full px-4 py-4 glass border border-white/10 rounded-2xl text-white text-sm font-medium outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 shadow-xl transition-all"
                                >
                                    <option value="valor-desc">Valor de mercado ↓</option>
                                    <option value="valor-asc">Valor de mercado ↑</option>
                                    <option value="produccion-desc">G+A (producción) ↓</option>
                                    <option value="minutos-desc">Minutos jugados ↓</option>
                                    <option value="edad-asc">Edad (jóvenes primero)</option>
                                    <option value="edad-desc">Edad (veteranos primero)</option>
                                    <option value="name-asc">Nombre A–Z</option>
                                    <option value="name-desc">Nombre Z–A</option>
                                </select>
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-6 py-4 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl ${showFilters ? 'bg-emerald-500 text-white' : 'glass border border-white/10 text-white hover:border-emerald-500/40'}`}
                            >
                                <Filter className="w-5 h-5" /> Filtros {hasActiveFilters && "●"}
                            </button>
                            {hasActiveFilters && (
                                <button onClick={clearAllFilters} className="px-6 py-4 rounded-2xl font-bold flex items-center gap-2 glass border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all shadow-xl">
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0, y: -20 }}
                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                exit={{ opacity: 0, height: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                                className="glass border border-white/[0.07] rounded-2xl p-8 mb-8 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
                                    <div>
                                        <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-widest">Posición</label>
                                        <select value={selectedPosition} onChange={(e) => setSelectedPosition(e.target.value)} className="w-full glass-dark text-white p-3.5 rounded-xl border border-white/10 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/5 transition-all">
                                            <option value="">Todas las posiciones</option>
                                            {positions.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-widest">Perfil IA</label>
                                        <select value={selectedPerfil} onChange={(e) => setSelectedPerfil(e.target.value)} className="w-full glass-dark text-white p-3.5 rounded-xl border border-white/10 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/5 transition-all">
                                            <option value="">Todos los perfiles</option>
                                            {allPerfiles.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-widest">Nacionalidad</label>
                                        <select value={selectedNation} onChange={(e) => setSelectedNation(e.target.value)} className="w-full glass-dark text-white p-3.5 rounded-xl border border-white/10 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/5 transition-all">
                                            <option value="">Todas las naciones</option>
                                            {nations.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-widest">Edad Mín.</label>
                                        <input type="number" value={ageRange.min} onChange={(e) => setAgeRange({...ageRange, min: e.target.value})} className="w-full glass-dark text-white p-3.5 rounded-xl border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/5 outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-widest">Edad Máx.</label>
                                        <input type="number" value={ageRange.max} onChange={(e) => setAgeRange({...ageRange, max: e.target.value})} className="w-full glass-dark text-white p-3.5 rounded-xl border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/5 outline-none transition-all" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Grid de Jugadores */}
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => <PlayerSkeleton key={i} />)}
                        </div>
                    ) : currentPlayers.length === 0 ? (
                        <div className="text-center py-20 bg-slate-800/20 rounded-3xl border border-white/5">
                            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-2xl font-black text-gray-400">Sin coincidencias</h3>
                        </div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
                        >
                            {currentPlayers.map((player, idx) => {
                                const PosIcon = getPosIcon(player.Pos_Main);
                                const posGrad = getPosGradient(player.Pos_Main);
                                const posAccent = getPosAccent(player.Pos_Main);
                                const marketVal = formatValue((player as any).Valor_Mercado);
                                const gls = (player as any).Gls ?? 0;
                                const ast = (player as any).Ast ?? 0;
                                const mins = (player as any).Min ?? 0;
                                return (
                                    <motion.div
                                        key={player.PlayerID}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: (idx % 20) * 0.05 }}
                                    >
                                        <Link href={`/scouting/${player.PlayerID}`}
                                            className="group relative block h-full bg-[#0a1628]/60 border border-white/[0.07] rounded-2xl overflow-hidden hover:border-emerald-500/40 transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] shadow-xl"
                                        >
                                        {/* Imagen */}
                                        <div className={`relative h-60 flex items-end justify-center bg-gradient-to-b ${posGrad} overflow-hidden`}>
                                            <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 120%,${posAccent},transparent 70%)`}} />
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{background:`radial-gradient(circle at 50% 80%,${posAccent},transparent 60%)`}} />

                                            {player.strCutout ? (
                                                <img src={player.strCutout} alt={player.Player}
                                                    className="relative z-10 h-52 w-auto object-contain drop-shadow-2xl transform group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.thesportsdb.com/images/media/player/cutout/default.png'; }}
                                                />
                                            ) : (
                                                <User className="relative z-10 w-20 h-20 text-white/10 mb-10 group-hover:text-white/20 transition-colors" />
                                            )}

                                            {/* Badges */}
                                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg z-20">
                                                <PosIcon className="w-3 h-3 text-emerald-400" />
                                                <span className="text-white font-black text-[10px]">{player.Pos_Main.toUpperCase()}</span>
                                            </div>
                                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/15 backdrop-blur-md border border-emerald-500/25 rounded-full z-20">
                                                <span className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider">{player.Perfil_Historico}</span>
                                            </div>

                                            {/* Stats overlay — aparece en hover */}
                                            <div className="stat-overlay absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-8 pb-3 px-4">
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    {[{l:'Goles',v:gls},{l:'Asist',v:ast},{l:'Min',v:mins}].map(s=>(
                                                        <div key={s.l}>
                                                            <p className="font-data font-black text-white text-base leading-none">{s.v}</p>
                                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider mt-0.5">{s.l}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="p-4 space-y-3">
                                            <div>
                                                <h3 className="font-black text-white text-base truncate group-hover:text-emerald-400 transition-colors">{capitalizeName(player.Player)}</h3>
                                                <p className="text-[11px] text-gray-600 font-medium truncate uppercase tracking-wider">{(player as any).Squad || 'Agente Libre'}</p>
                                            </div>
                                            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                                                <div>
                                                    <p className="text-[9px] text-gray-600 font-bold uppercase mb-0.5">Edad</p>
                                                    <p className="font-data font-black text-white text-sm">{(player as any).Age || '--'}</p>
                                                </div>
                                                {marketVal ? (
                                                    <span className="font-data font-black text-emerald-400 text-sm px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                        {marketVal}
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold uppercase">
                                                        Ver <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>

                {/* Paginación */}
                {!loading && totalPages > 1 && (
                    <div className="flex justify-center items-center gap-3 mt-16">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 glass border border-white/10 rounded-xl text-white disabled:opacity-20 hover:border-emerald-500/40 hover:text-emerald-400 transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                                const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                                            page === currentPage
                                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                : 'glass border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                        }`}
                                    >{page}</button>
                                );
                            })}
                        </div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 glass border border-white/10 rounded-xl text-white disabled:opacity-20 hover:border-emerald-500/40 hover:text-emerald-400 transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}