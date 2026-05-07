/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Euro,
  User,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';

const PLAYERS_PER_PAGE = 24;

type PlayerRow = {
  PlayerID: number;
  Player: string;
  Squad?: string;
  League?: string;
  Nation?: string;
  Pos_Main?: string;
  Age?: number;
  Valor_Mercado?: number;
  Perfil_Historico?: string;
  strCutout?: string;
  Gls?: number;
  Ast?: number;
  Min?: number;
  [k: string]: unknown;
};

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

const formatMarketValue = (value: number | null | undefined): string => {
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

type PredictionResult = { predicted_value: number; diff_pct: number };

function PlayerCardSkeleton() {
  return (
    <div className="bg-[#0a1628]/60 border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="h-48 relative overflow-hidden bg-[#0a1628]">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-5 bg-white/[0.05] rounded-lg w-4/5 overflow-hidden relative">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite_0.2s] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>
        <div className="h-3.5 bg-white/[0.04] rounded-lg w-1/2" />
        <div className="h-8 bg-white/[0.04] rounded-lg w-20 mt-4" />
      </div>
    </div>
  );
}

export default function MercadoPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'valor-desc' | 'valor-asc' | 'nombre' | 'edad' | 'oportunidad'>('valor-desc');
  const [positionFilter, setPositionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // Mapa nombre -> resultado del modelo Python
  const [predictionsMap, setPredictionsMap] = useState<Record<string, PredictionResult>>({});
  const [predictionLoading, setPredictionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/players');
        const data = await res.json();
        setPlayers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const positions = useMemo(() => [...new Set(players.map((p) => p.Pos_Main).filter(Boolean))].sort(), [players]);

  const filteredAndSorted = useMemo(() => {
    let list = players.filter((p) => {
      const matchPos = !positionFilter || p.Pos_Main === positionFilter;
      const name = (p.Player ?? '').toLowerCase();
      const squad = (p.Squad ?? '').toLowerCase();
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || name.includes(term) || squad.includes(term);
      return matchPos && matchSearch;
    });
    if (sortBy === 'valor-desc') list = [...list].sort((a, b) => ((b.Valor_Mercado ?? 0) - (a.Valor_Mercado ?? 0)));
    if (sortBy === 'valor-asc') list = [...list].sort((a, b) => ((a.Valor_Mercado ?? 0) - (b.Valor_Mercado ?? 0)));
    if (sortBy === 'nombre') list = [...list].sort((a, b) => (a.Player ?? '').localeCompare(b.Player ?? ''));
    if (sortBy === 'edad') list = [...list].sort((a, b) => ((a.Age ?? 0) - (b.Age ?? 0)));
    if (sortBy === 'oportunidad') {
      // Ordena por diferencia real del modelo: valor predicho - valor actual (más negativo = más oportunidad)
      list = [...list].sort((a, b) => {
        const predA = predictionsMap[a.Player]?.predicted_value ?? (a.Valor_Mercado ?? 0);
        const predB = predictionsMap[b.Player]?.predicted_value ?? (b.Valor_Mercado ?? 0);
        const diffA = (a.Valor_Mercado ?? 0) - predA;
        const diffB = (b.Valor_Mercado ?? 0) - predB;
        return diffA - diffB;
      });
    }
    return list;
  }, [players, positionFilter, searchTerm, sortBy, predictionsMap]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PLAYERS_PER_PAGE));
  const start = (currentPage - 1) * PLAYERS_PER_PAGE;
  const currentPlayers = filteredAndSorted.slice(start, start + PLAYERS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [positionFilter, searchTerm, sortBy]);

  // Solicitar predicciones del modelo Python para los jugadores de la página actual
  useEffect(() => {
    if (currentPlayers.length === 0) return;
    const names = currentPlayers.map((p) => p.Player).filter(Boolean);
    if (names.length === 0) return;
    // Solo pedir las que aún no tenemos cacheadas
    const missing = names.filter((n) => !(n in predictionsMap));
    if (missing.length === 0) return;

    setPredictionLoading(true);
    fetch(`/api/predict/batch?players=${encodeURIComponent(missing.join(','))}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.predictions) return;
        const newMap: Record<string, PredictionResult> = {};
        (data.predictions as Array<{ player: string; predicted_value: number; diff_pct: number; error?: string }>)
          .forEach((item) => {
            if (!item.error && item.player) {
              newMap[item.player] = { predicted_value: item.predicted_value, diff_pct: item.diff_pct };
            }
          });
        setPredictionsMap((prev) => ({ ...prev, ...newMap }));
      })
      .catch(() => { /* microservicio no disponible, sin predicciones */ })
      .finally(() => setPredictionLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayers.map((p) => p.Player).join(',')]);

  return (
    <section className="relative min-h-screen bg-[#020812] overflow-hidden text-white pt-24 pb-20">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(245,158,11,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_100%,rgba(16,185,129,0.05),transparent)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(rgba(245,158,11,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.8) 1px,transparent 1px)',backgroundSize:'40px 40px'}} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Título */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass border border-amber-500/20 rounded-full mb-6">
            <Euro className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Mercado y valoración</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight leading-none">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Valoración</span>
            {' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">de Mercado</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Jugadores con valor de mercado y valor esperado según rendimiento. Identifica oportunidades infravaloradas.
          </p>
        </div>

        {/* Filtros y ordenación */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre o club..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 glass border border-white/10 rounded-2xl text-white placeholder-gray-600 outline-none focus:border-amber-500/50 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-4 py-3.5 glass border border-white/10 rounded-xl text-white text-sm outline-none focus:border-amber-500/50 transition-all"
            >
              <option value="">Todas las posiciones</option>
              {positions.filter(Boolean).map((p) => (
                <option key={p} value={p}>{p?.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-3.5 glass border border-white/10 rounded-xl text-white text-sm outline-none focus:border-amber-500/50 transition-all"
            >
              <option value="valor-desc">Mayor valor</option>
              <option value="valor-asc">Menor valor</option>
              <option value="oportunidad">Oportunidad</option>
              <option value="nombre">Nombre</option>
              <option value="edad">Edad</option>
            </select>
          </div>
        </div>

        {/* Grid de tarjetas */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <PlayerCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-white/10">
            <TrendingUp className="w-14 h-14 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No hay jugadores que coincidan con los filtros.</p>
          </div>
        ) : (
          <>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {currentPlayers.map((player, idx) => {
              const PosIcon = getPosIcon(player.Pos_Main ?? '');
              const value = player.Valor_Mercado ?? 0;
              // Usa el modelo Python si ya está disponible para este jugador
              const prediction = predictionsMap[player.Player] ?? null;
              const modelValue = prediction?.predicted_value ?? null;
              const diffPct = prediction?.diff_pct ?? null;
              return (
                <motion.div
                  key={player.PlayerID}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: (idx % 24) * 0.05 }}
                  className="h-full"
                >
                <Link
                  href={`/scouting/${player.PlayerID}`}
                  className="group block h-full bg-[#0a1628]/60 border border-white/[0.07] rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] shadow-xl"
                >
                  {/* Imagen */}
                  <div className="relative h-48 bg-gradient-to-b from-amber-950/40 via-[#020812] to-[#020812] flex items-end justify-center overflow-hidden">
                    <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 120%,rgba(245,158,11,0.2),transparent 70%)`}} />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{background:`radial-gradient(circle at 50% 80%,rgba(245,158,11,0.15),transparent 60%)`}} />
                    {player.strCutout ? (
                      <img
                        src={player.strCutout}
                        alt={player.Player}
                        className="h-40 w-auto object-contain z-10 drop-shadow-2xl group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.thesportsdb.com/images/media/player/cutout/default.png'; }}
                      />
                    ) : (
                      <User className="w-20 h-20 text-white/10 mb-6" />
                    )}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-1.5 z-20">
                      <PosIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-white font-bold text-[10px] uppercase">{player.Pos_Main ?? '—'}</span>
                    </div>
                    {/* Badge predicción: flecha arriba verde / flecha abajo roja usando modelo Python */}
                    {predictionLoading && !prediction && (
                      <div className="absolute top-3 right-3 w-16 h-6 rounded-lg bg-slate-700/60 animate-pulse z-20" />
                    )}
                    {!predictionLoading && prediction && diffPct !== null && (() => {
                      const isUp = diffPct >= 0;
                      const absDiff = Math.abs(diffPct).toFixed(1);
                      return (
                        <div
                          className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase z-20 border ${
                            isUp
                              ? 'bg-green-500/20 text-green-400 border-green-500/40'
                              : 'bg-red-500/20 text-red-400 border-red-500/40'
                          }`}
                        >
                          {isUp ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {isUp ? '+' : '-'}{absDiff}%
                        </div>
                      );
                    })()}
                  </div>

                  {/* Contenido */}
                  <div className="p-5 border-t border-white/5">
                    <h3 className="font-black text-white truncate group-hover:text-green-400 transition-colors">
                      {capitalizeName(player.Player)}
                    </h3>
                    <p className="text-xs text-gray-500 truncate uppercase tracking-wider mt-0.5">
                      {player.Squad ? capitalizeName(player.Squad) : '—'}
                    </p>

                    {/* Valor actual y valor del modelo Python */}
                    <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Valor mercado</span>
                        <span className="font-data text-lg font-black text-amber-400">{formatMarketValue(value)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Valor modelo</span>
                        {predictionLoading && !prediction ? (
                          <div className="h-4 w-16 rounded bg-slate-700 animate-pulse" />
                        ) : modelValue ? (
                          <div className="flex items-center gap-1.5">
                            {diffPct !== null && (
                              diffPct >= 0
                                ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                                : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            )}
                            <span className={`text-sm font-bold ${
                              diffPct !== null
                                ? diffPct >= 0 ? 'text-green-400' : 'text-red-400'
                                : 'text-gray-400'
                            }`}>{formatMarketValue(modelValue)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-gray-600">—</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex gap-3 text-[11px] text-gray-500">
                        <span>Edad {player.Age ?? '—'}</span>
                        {player.Gls != null && <span>{player.Gls} g</span>}
                        {player.Ast != null && <span>{player.Ast} a</span>}
                      </div>
                      <span className="text-gray-500 text-xs font-bold group-hover:text-green-400 transition-colors">
                        Ficha <ChevronRight className="w-3.5 h-3.5 inline group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
                </motion.div>
              );
              })}
            </motion.div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-gray-600 text-sm">
                  Mostrando {start + 1}–{Math.min(start + PLAYERS_PER_PAGE, filteredAndSorted.length)} de {filteredAndSorted.length} jugadores
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="p-3 rounded-xl glass border border-white/10 text-white disabled:opacity-30 hover:border-amber-500/40 hover:text-amber-400 transition-all"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-5 py-2.5 rounded-xl glass border border-white/10 text-white font-data font-bold text-sm min-w-[100px] text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="p-3 rounded-xl glass border border-white/10 text-white disabled:opacity-30 hover:border-amber-500/40 hover:text-amber-400 transition-all"
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
