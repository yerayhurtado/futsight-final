'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/agent', label: 'Búsqueda IA' },
  { href: '/scouting', label: 'Explorar' },
  { href: '/comparador', label: 'Comparador' },
  { href: '/mercado', label: 'Mercado' },
];

// Logo SVG del campo de fútbol estilizado
function FutSightLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Fondo redondeado */}
      <rect width="36" height="36" rx="10" fill="url(#logoGrad)" />
      {/* Campo de fútbol simplificado */}
      <rect x="6" y="10" width="24" height="16" rx="2" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
      {/* Línea central */}
      <line x1="18" y1="10" x2="18" y2="26" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
      {/* Círculo central */}
      <circle cx="18" cy="18" r="3.5" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"/>
      {/* Punto central */}
      <circle cx="18" cy="18" r="1" fill="white"/>
      {/* Área izquierda */}
      <rect x="6" y="13.5" width="5" height="9" rx="1" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1"/>
      {/* Área derecha */}
      <rect x="25" y="13.5" width="5" height="9" rx="1" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1"/>
    </svg>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-between
        px-6 py-3.5
        transition-all duration-500 ease-out
        ${scrolled
          ? 'bg-[#020812]/90 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_4px_40px_rgba(0,0,0,0.4)]'
          : 'bg-transparent'
        }
      `}
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-3 focus-visible:rounded-lg group"
        onClick={() => setMenuOpen(false)}
      >
        <div className="transition-transform duration-300 group-hover:scale-105">
          <FutSightLogo />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white tracking-tight">
            Fut<span className="text-emerald-400">Sight</span>
          </span>          
        </div>
      </Link>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="nav-link-animated px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/agent"
          className="ml-4 px-5 py-2.5 rounded-xl shimmer-btn text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.03] active:scale-[0.97] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020812]"
        >
          Empezar →
        </Link>
      </nav>

      {/* Botón hamburguesa */}
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="md:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay móvil */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 top-[65px] z-40 bg-black/70 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Menú móvil */}
      <nav
        className={`
          md:hidden fixed top-[65px] right-0 left-0 z-50
          flex flex-col glass-dark
          overflow-hidden transition-all duration-300 ease-out
          ${menuOpen ? 'max-h-[calc(100vh-65px)] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
        `}
        aria-label="Menú de navegación"
      >
        <div className="px-4 py-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 rounded-xl text-base font-medium text-gray-300 hover:text-white hover:bg-white/8 transition-colors"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/agent"
            onClick={() => setMenuOpen(false)}
            className="block mt-2 px-4 py-3 rounded-xl text-base font-semibold text-white shimmer-btn hover:opacity-90 transition-opacity text-center"
          >
            Empezar →
          </Link>
        </div>
      </nav>
    </header>
  );
}