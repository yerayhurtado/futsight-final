'use client';
import Link from 'next/link';
import { Github, Twitter, Linkedin, Brain } from 'lucide-react';

const modules = [
  { href: '/agent', label: 'Búsqueda IA' },
  { href: '/scouting', label: 'Explorar' },
  { href: '/comparador', label: 'Comparador' },
  { href: '/mercado', label: 'Mercado' },
];

const socials = [
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
];

const techBadges = ['Next.js', 'Python', 'Machine Learning', 'FBref'];

export default function Footer() {
  return (
    <footer className="relative bg-[#020812] overflow-hidden">
      {/* Línea superior gradiente */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

      {/* Glow sutil arriba */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-12 mb-14">

          {/* Logo + descripción */}
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-transform duration-300 group-hover:scale-105">
                <span className="text-sm font-black text-white">FS</span>
              </div>
              <span className="text-lg font-bold text-white">
                Fut<span className="text-emerald-400">Sight</span>
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed max-w-sm mb-6">
              Plataforma de analytics futbolístico con IA. Scouting inteligente, comparador de jugadores y análisis de mercado con 33 años de datos históricos.
            </p>

            {/* Newsletter visual */}
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 px-4 py-2.5 glass border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/40 transition-colors outline-none"
              />
              <button className="px-4 py-2.5 shimmer-btn rounded-xl text-white text-sm font-semibold shrink-0 hover:opacity-90 transition-opacity">
                Suscribirse
              </button>
            </div>
          </div>

          {/* Módulos */}
          <div>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-5 flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-emerald-500" /> Módulos
            </h3>
            <ul className="space-y-3">
              {modules.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-gray-500 hover:text-emerald-400 transition-colors duration-200 flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 bg-gray-700 rounded-full group-hover:bg-emerald-400 transition-colors" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social + tech */}
          <div>
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-5">Conectar</h3>
            <div className="flex gap-3 mb-8">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 glass border border-white/10 rounded-xl flex items-center justify-center text-gray-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all duration-200 hover:scale-110"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>

            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Stack</h3>
            <div className="flex flex-wrap gap-2">
              {techBadges.map(tech => (
                <span key={tech} className="px-2 py-1 glass border border-white/8 rounded-lg text-[10px] text-gray-500 font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} FutSight. Datos con fines informativos y educativos.
          </p>
          <Link href="/#metodologia" className="text-xs text-gray-600 hover:text-emerald-400 transition-colors">
            Metodología →
          </Link>
        </div>
      </div>
    </footer>
  );
}
