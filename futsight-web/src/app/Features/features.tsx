'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Brain, LayoutGrid, GitCompare, TrendingUp, Database, Activity } from 'lucide-react';

const features = [
  {
    icon: Brain,
    number: '01',
    title: 'Búsqueda IA',
    tag: 'Inteligencia Artificial',
    description: 'Describe el perfil que necesitas en lenguaje natural. Obtén recomendaciones de jugadores basadas en datos con explicación del ojeador y criterios aplicados.',
    color: 'from-emerald-500 to-teal-600',
    accentColor: 'text-emerald-400',
    bgAccent: 'bg-emerald-500/10',
    borderAccent: 'border-emerald-500/20',
    href: '/agent',
  },
  {
    icon: LayoutGrid,
    number: '02',
    title: 'Catálogo Explorar',
    tag: 'Scouting',
    description: 'Navega el catálogo completo de jugadores con filtros por posición, nación y perfil táctico. Visualiza métricas clave y accede a fichas detalladas.',
    color: 'from-blue-500 to-cyan-600',
    accentColor: 'text-blue-400',
    bgAccent: 'bg-blue-500/10',
    borderAccent: 'border-blue-500/20',
    href: '/scouting',
  },
  {
    icon: GitCompare,
    number: '03',
    title: 'Comparador',
    tag: 'Análisis',
    description: 'Compara dos jugadores lado a lado. Métricas adaptadas por posición (goles, asistencias, xG, pases clave, duelos...) para tomar decisiones informadas.',
    color: 'from-purple-500 to-pink-600',
    accentColor: 'text-purple-400',
    bgAccent: 'bg-purple-500/10',
    borderAccent: 'border-purple-500/20',
    href: '/comparador',
  },
  {
    icon: TrendingUp,
    number: '04',
    title: 'Mercado',
    tag: 'Valoración',
    description: 'Explora el valor de mercado de los jugadores. Identifica jugadores infravalorados o inflados según rendimiento, edad y posición.',
    color: 'from-orange-500 to-amber-600',
    accentColor: 'text-orange-400',
    bgAccent: 'bg-orange-500/10',
    borderAccent: 'border-orange-500/20',
    href: '/mercado',
  },
  {
    icon: Database,
    number: '05',
    title: 'Datos y Métricas',
    tag: 'Base de datos',
    description: 'Base de datos histórica con métricas de producción (goles, asistencias, xG, regates...) y perfiles tácticos por posición durante 33 años.',
    color: 'from-teal-500 to-emerald-600',
    accentColor: 'text-teal-400',
    bgAccent: 'bg-teal-500/10',
    borderAccent: 'border-teal-500/20',
    href: '/scouting',
  },
  {
    icon: Activity,
    number: '06',
    title: 'Metodología XAI',
    tag: 'Ciencia de Datos',
    description: 'Descubre la ingeniería detrás de FutSight. Algoritmos GMM para hibridez táctica, modelos de valoración deterministas y transparencia algorítmica (XAI).',
    color: 'from-rose-500 to-red-600',
    accentColor: 'text-rose-400',
    bgAccent: 'bg-rose-500/10',
    borderAccent: 'border-rose-500/20',
    href: '/metodologia',
    cta: 'Ver Libro Blanco',
  },
];

const stats = [
  { value: 33, suffix: ' Años', label: 'Datos Históricos' },
  { value: 4,  suffix: ' Módulos', label: 'De Navegación' },
  { value: 200, prefix: '+', label: 'Métricas Analizadas' },
  { value: 5,  suffix: ' Ligas', label: 'Top Europeas' },
];

// Hook para IntersectionObserver
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); observer.disconnect(); }
    }, { threshold });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// Contador animado
function AnimatedCounter({ value, prefix = '', suffix = '', inView }: { value: number; prefix?: string; suffix?: string; inView: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1500;
    const steps = 50;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, value]);
  return <>{prefix}{count}{suffix}</>;
}

export default function Features() {
  const { ref: sectionRef, inView: sectionInView } = useInView(0.05);
  const { ref: statsRef, inView: statsInView } = useInView(0.2);

  return (
    <section id="metodologia" className="relative py-28 px-6 bg-[#020812] overflow-hidden scroll-mt-20">
      
      {/* Fondo decorativo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_100%,rgba(16,185,129,0.05),transparent)]" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(16,185,129,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div ref={sectionRef} className="relative max-w-7xl mx-auto">

        {/* Header de la sección */}
        <div className={`text-center mb-20 ${sectionInView ? 'animate-fade-in-up' : 'opacity-0'}`}>
          {/* Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 glass border border-emerald-500/20 rounded-full mb-6">
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Metodología</span>
          </div>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black mb-5 text-white tracking-tight leading-tight">
            Scouting con
            <span className="block gradient-text-animated">Inteligencia Artificial</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Análisis futbolístico con modelos de machine learning y 33 años de datos históricos (1992–2025).
          </p>
        </div>

        {/* Grid de características */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Link
                key={index}
                href={feature.href}
                className={`
                  group card-gradient-border relative block p-7
                  glass border border-white/[0.07] rounded-2xl
                  hover:border-white/15 hover:bg-white/[0.03]
                  transition-all duration-400 hover:-translate-y-1.5
                  focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020812]
                  ${sectionInView ? 'animate-fade-in-up' : 'opacity-0'}
                `}
                style={{ animationDelay: `${index * 100 + 100}ms` }}
              >
                {/* Número editorial */}
                <span className="absolute top-5 right-6 font-data font-black text-4xl text-white/[0.04] select-none group-hover:text-white/[0.07] transition-colors duration-500">
                  {feature.number}
                </span>

                {/* Tag */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${feature.bgAccent} border ${feature.borderAccent} rounded-lg mb-5`}>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${feature.accentColor}`}>{feature.tag}</span>
                </div>

                {/* Icono */}
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-5 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-400`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Contenido */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {feature.description}
                </p>

                {/* CTA arrow */}
                <div className={`flex items-center gap-2 ${feature.accentColor} text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all duration-300`}>
                  <span>{(feature as any).cta || 'Explorar módulo'}</span>
                  <span>→</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Stats bar animada */}
        <div
          ref={statsRef}
          className={`glass border border-emerald-500/15 rounded-3xl p-8 bg-gradient-to-r from-emerald-500/[0.04] to-teal-500/[0.04] ${statsInView ? 'animate-fade-in-up' : 'opacity-0'}`}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center group">
                <div className="font-data text-4xl md:text-5xl font-black text-emerald-400 mb-2 tabular-nums">
                  <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} inView={statsInView} />
                </div>
                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}