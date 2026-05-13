'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Search, LayoutGrid, GitCompare, BarChart3, TrendingUp, Star, Zap } from 'lucide-react';

// Tarjeta flotante de jugador (preview del producto)
function FloatingPlayerCard() {
  return (
    <div className="animate-float-card w-72 md:w-80">
      <div className="glass-dark rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)] border border-white/10">
        {/* Header de la tarjeta */}
        <div className="relative h-44 bg-gradient-to-br from-emerald-950/80 via-[#020f1a] to-[#020812] flex items-end justify-center overflow-hidden">
          {/* Orbe de fondo */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,0.25),transparent_70%)]" />
          {/* Patrón de puntos */}
          <div className="absolute inset-0 opacity-20"
            style={{backgroundImage:'radial-gradient(circle, rgba(16,185,129,0.4) 1px, transparent 1px)', backgroundSize:'20px 20px'}}
          />
          {/* Avatar placeholder */}
          <div className="relative z-10 mb-3 w-24 h-28 rounded-xl bg-gradient-to-t from-emerald-900/40 to-transparent border border-white/10 flex items-center justify-center">
            <span className="text-5xl">⚽</span>
          </div>
          {/* Badge posición */}
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg backdrop-blur-md">
            <span className="text-emerald-400 font-black text-[10px] uppercase tracking-widest">FW</span>
          </div>
          {/* Badge perfil */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg backdrop-blur-md">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-amber-400 font-black text-[10px]">Goleador</span>
          </div>
        </div>

        {/* Info jugador */}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-black text-white text-lg leading-tight">Lamine Yamal</h3>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">FC Barcelona · 🇪🇸 ESP</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2 py-3 border-t border-white/[0.07]">
            {[
              { label: 'Goles', value: '18', icon: '⚡' },
              { label: 'Asist', value: '14', icon: '🎯' },
              { label: 'xG',    value: '14.2', icon: '📊' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] text-gray-500 mb-0.5">{s.icon} {s.label}</p>
                <p className="font-data font-black text-white text-lg leading-none">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Valor */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
            <span className="text-xs text-gray-500">Valor de mercado</span>
            <span className="font-data font-black text-emerald-400 text-sm glow-green-sm px-2 py-0.5 bg-emerald-500/10 rounded-lg">
              €180M
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 30,
        y: (e.clientY / window.innerHeight - 0.5) * 30,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-dvh flex items-center overflow-hidden bg-[#020812] pt-20">
      
      {/* ── FONDO PROFUNDO ───────────────────────────────── */}
      {/* Gradiente base */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,78,59,0.35),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_-10%_60%,rgba(16,185,129,0.08),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_80%_at_110%_40%,rgba(6,182,212,0.06),transparent)]" />

      {/* Grid perspectiva */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(rgba(16,185,129,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          transform: `translate(${mousePosition.x * 0.2}px, ${mousePosition.y * 0.2}px)`,
        }}
      />

      {/* Orbes flotantes */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-emerald-500/[0.07] blur-[120px] animate-orb" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.05] blur-[100px] animate-orb" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full bg-teal-500/[0.04] blur-[80px] animate-orb" style={{ animationDelay: '4s' }} />

      {/* Halo de luz central que sigue el mouse */}
      <div
        className="absolute pointer-events-none w-[800px] h-[800px] rounded-full opacity-[0.04] blur-[100px] bg-emerald-400 transition-transform duration-700 ease-out"
        style={{ top: '50%', left: '50%', transform: `translate(calc(-50% + ${mousePosition.x}px), calc(-50% + ${mousePosition.y}px))` }}
      />

      {/* ── CONTENIDO ────────────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full ">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* COLUMNA IZQUIERDA */}
          <div className="flex-1 text-center lg:text-left">

            {/* Badge premium */}
            <div className={`inline-flex items-center gap-2.5 px-4 py-2 glass border border-emerald-500/20 rounded-full mb-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-dot-pulse shrink-0" />
              <span className="text-gray-300 text-xs sm:text-sm font-medium">Scouting con IA · 33 años de datos</span>
              <span className="hidden sm:flex items-center gap-1 ml-1 px-2 py-0.5 bg-emerald-500/10 rounded-full text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                <Zap className="w-3 h-3" /> Nuevo
              </span>
            </div>

            {/* Heading principal */}
            <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-[1.1] tracking-tight ${mounted ? 'animate-fade-in-up delay-100' : 'opacity-0'}`}>
              <span className="block text-white mb-2">El Futuro del</span>
              <span className="block gradient-text-animated pb-2">Scouting</span>
            </h1>

            {/* Subtítulo */}
            <p className={`text-base sm:text-lg md:text-xl text-gray-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
              Analiza perfiles de producción, predice rendimiento y valor de mercado, y obtén recomendaciones de fichajes inteligentes adaptadas a tu club.
            </p>

            {/* CTAs */}
            <div className={`flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start mb-12 ${mounted ? 'animate-fade-in-up delay-300' : 'opacity-0'}`}>
              <Link
                href="/scouting"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 shimmer-btn text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020812]"
              >
                <Search className="w-5 h-5" />
                Explorar talento
                <span className="inline-block group-hover:translate-x-1 transition-transform">→</span>
              </Link>
              <Link
                href="#metodologia"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 glass border border-white/10 text-white rounded-xl font-semibold text-base hover:bg-white/8 hover:border-white/20 active:scale-[0.97] transition-all duration-300"
              >
                Ver metodología
              </Link>
            </div>

            {/* Mini stats */}
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto lg:mx-0 ${mounted ? 'animate-fade-in-up delay-400' : 'opacity-0'}`}>
              {[
                { icon: Search, label: 'Búsqueda IA' },
                { icon: LayoutGrid, label: 'Catálogo filtrado' },
                { icon: GitCompare, label: 'Comparador' },
                { icon: BarChart3, label: 'Métricas avanzadas' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-gray-500 justify-center lg:justify-start">
                  <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COLUMNA DERECHA — tarjeta flotante */}
          <div className={`hidden lg:flex flex-col items-center gap-6 ${mounted ? 'animate-fade-in-right delay-300' : 'opacity-0'}`}>
            <FloatingPlayerCard />

            {/* Badges secundarios flotantes */}
            <div
              className="glass border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 shadow-xl animate-float"
              style={{ animationDelay: '1s' }}
            >
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs text-gray-500">Valor predicho</p>
                <p className="font-data font-black text-white text-sm">+12% respecto mercado</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 scroll-indicator hidden sm:block">
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex items-start justify-center p-1.5">
          <div className="w-1 h-3 bg-emerald-400/60 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}