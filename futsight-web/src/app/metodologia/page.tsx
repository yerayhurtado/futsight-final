import { Brain, Calculator, Eye, ShieldCheck, GraduationCap, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Metodología y XAI - Futsight",
  description: "Metodología y Transparencia Algorítmica (XAI) en Futsight.",
};

export default function MetodologiaPage() {
  return (
    <main className="min-h-screen bg-[#020812] text-gray-300 font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto px-6 py-24 sm:py-32 space-y-16">
        
        <header className="space-y-6">
          <Link href="/" className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            Metodología y Transparencia <span className="text-emerald-400">Algorítmica (XAI)</span>
          </h1>
          <p className="text-gray-400 max-w-2xl text-lg sm:text-xl leading-relaxed">
            En FutSight, la tecnología no es una "caja negra". Bajo los principios de la IA Act de la Unión Europea, hemos diseñado un ecosistema donde la precisión matemática se une a la transparencia ejecutiva. Este apartado detalla los fundamentos científicos y técnicos que permiten a nuestra plataforma transformar datos brutos en inteligencia estratégica.
          </p>
        </header>

        <div className="space-y-12">
          
          {/* 1. Segmentación Táctica Avanzada */}
          <section className="glass p-8 sm:p-10 rounded-3xl border border-emerald-500/10 space-y-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 sm:p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <Brain className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">1. Segmentación Táctica Avanzada: Modelos de Mezcla Gaussiana (GMM)</h2>
            </div>
            <div className="text-base sm:text-lg leading-relaxed text-gray-400 space-y-4">
              <p>Para la clasificación de roles y perfiles tácticos, hemos evolucionado más allá de los algoritmos tradicionales de hard clustering.</p>
              <ul className="space-y-3 ml-2 border-l-2 border-emerald-500/20 pl-4">
                <li><strong className="text-gray-200">Hibridez Táctica:</strong> En el fútbol moderno, los jugadores rara vez ocupan roles puros. Un "Falso 9" puede compartir atributos con un finalizador y un creador de juego. Mientras que algoritmos como K-Means forzarían una asignación binaria, el uso de Gaussian Mixture Models (GMM) nos permite implementar un soft clustering.</li>
                <li><strong className="text-gray-200">Pureza de Perfil:</strong> El sistema calcula la probabilidad de pertenencia de un jugador a diferentes clústeres. Esto genera una métrica de "Pureza de Perfil", permitiendo a los directores deportivos entender no solo qué posición ocupa el jugador, sino cómo de polivalente es dentro del esquema táctico.</li>
              </ul>
            </div>
          </section>

          {/* 2. Motor de Valoración Predictiva */}
          <section className="glass p-8 sm:p-10 rounded-3xl border border-blue-500/10 space-y-6 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 sm:p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Calculator className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{"2. Motor de Valoración Predictiva (V_pred)"}</h2>
            </div>
            <div className="text-base sm:text-lg leading-relaxed text-gray-400 space-y-6">
              <p>Nuestra valoración financiera es el resultado de un modelo determinista que pondera el rendimiento deportivo contra las variables de mercado y el contexto competitivo.</p>
              
              <p>La valoración se rige por la siguiente función multivariable:</p>
              <div className="p-4 sm:p-6 glass bg-[#050b14] border border-white/5 rounded-2xl font-mono text-emerald-400 text-center overflow-x-auto text-sm sm:text-base">
                V_pred = ( Σ (Stat_i × W_i) ) × γ_edad × λ_liga
              </div>

              <ul className="space-y-3 ml-2 border-l-2 border-blue-500/20 pl-4">
                <li><strong className="text-gray-200">Ingeniería de Pesos (W_i):</strong> El sistema asigna pesos dinámicos a las métricas (goles, pases progresivos, intercepciones, etc.) dependiendo de la posición específica y la fase de la carrera del jugador.</li>
                <li><strong className="text-gray-200">Factor Biológico de Edad (γ_edad):</strong> Implementamos curvas de decaimiento que aprecian el valor en etapas de desarrollo (Early Stage) y aplican una depreciación técnica a partir del peak de rendimiento físico (normalmente a los 29 años), reflejando el valor de reventa futuro.</li>
                <li><strong className="text-gray-200">Ajuste por Nivel Competitivo (λ_liga):</strong> No todas las métricas valen lo mismo en contextos diferentes. Aplicamos coeficientes de exigencia para normalizar los datos de ligas periféricas respecto a las ligas de élite.</li>
              </ul>
            </div>
          </section>

          {/* 3. Inteligencia Artificial Explicable (XAI) */}
          <section className="glass p-8 sm:p-10 rounded-3xl border border-purple-500/10 space-y-6 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 sm:p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                <Eye className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">3. Inteligencia Artificial Explicable (XAI)</h2>
            </div>
            <div className="text-base sm:text-lg leading-relaxed text-gray-400 space-y-4">
              <p>Siguiendo la investigación en <em>"Quantifying football player value via performance"</em>, entendemos que una predicción sin contexto carece de utilidad.</p>
              <ul className="space-y-3 ml-2 border-l-2 border-purple-500/20 pl-4">
                <li><strong className="text-gray-200">Desglose de Impacto:</strong> FutSight descompone cada valoración para mostrar exactamente qué factores han influido en el precio. Si el valor de un jugador aumenta, el usuario puede ver qué porcentaje de esa subida se debe a su rendimiento estadístico, a su progresión por edad o a su contexto competitivo.</li>
                <li><strong className="text-gray-200">Corrección de Sesgos (Reputación vs. Realidad):</strong> El algoritmo identifica discrepancias entre la "Reputación de Mercado" (hype) y el rendimiento real. Esto permite alertar sobre jugadores sobrevalorados por el mercado o detectar "gangas" estadísticas cuyo valor real está por encima de su precio de adquisición.</li>
              </ul>
            </div>
          </section>

          {/* 4. Compromiso con la Privacidad: Inferencia Local */}
          <section className="glass p-8 sm:p-10 rounded-3xl border border-rose-500/10 space-y-6 relative overflow-hidden group hover:border-rose-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-rose-500/10 transition-colors" />
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 sm:p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <ShieldCheck className="w-8 h-8 text-rose-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">4. Compromiso con la Privacidad: Inferencia Local</h2>
            </div>
            <div className="text-base sm:text-lg leading-relaxed text-gray-400 space-y-4">
              <p>Fieles al paradigma de <strong>Privacy by Design</strong>, FutSight garantiza que la estrategia de scouting de una organización sea totalmente hermética.</p>
              <ul className="space-y-3 ml-2 border-l-2 border-rose-500/20 pl-4">
                <li><strong className="text-gray-200">Procesamiento On-Premise:</strong> Las consultas en lenguaje natural dirigidas a nuestro agente de scouting se procesan mediante Ollama con modelos locales (Qwen2.5).</li>
                <li><strong className="text-gray-200">Seguridad de Datos:</strong> Al no utilizar APIs externas de terceros para la inferencia de IA, aseguramos que ningún interés por un jugador o directriz táctica confidencial sea filtrada o utilizada para entrenar modelos externos.</li>
              </ul>
            </div>
          </section>

          {/* 5. Fundamentación Académica (Estado del Arte) */}
          <section className="glass p-8 sm:p-10 rounded-3xl border border-amber-500/10 space-y-6 relative overflow-hidden group hover:border-amber-500/30 transition-colors">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 sm:p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                <GraduationCap className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">5. Fundamentación Académica (Estado del Arte)</h2>
            </div>
            <div className="text-base sm:text-lg leading-relaxed text-gray-400 space-y-4">
              <p>Este proyecto integra principios de investigaciones pioneras en el ámbito de la analítica deportiva:</p>
              <ul className="space-y-3 ml-2 border-l-2 border-amber-500/20 pl-4">
                <li><strong className="text-gray-200">Valoración Financiera:</strong> Basado en marcos de trabajo para la valoración monetaria dinámica de futbolistas profesionales.</li>
                <li><strong className="text-gray-200">Rendimiento Defensivo:</strong> Incorporación de métricas avanzadas para la cuantificación del valor en posiciones no ofensivas.</li>
                <li><strong className="text-gray-200">Reconocimiento de Patrones:</strong> Aplicación de estudios sobre el comportamiento y la acción humana para la definición de roles tácticos.</li>
              </ul>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
