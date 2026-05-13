import { Shield, Lock, Scale, Info, Calendar } from "lucide-react";

export const metadata = {
  title: "Futsight - Política de Privacidad y Aviso Legal",
  description: "Política de Privacidad y Aviso Legal Integral de Futsight.",
};

export default function AvisoLegalPage() {
  return (
    <main className="min-h-screen bg-[#020812] text-gray-300 font-sans selection:bg-emerald-500/30">
      <div className="max-w-4xl mx-auto px-6 py-24 sm:py-32 space-y-16">
        
        <header className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Política de Privacidad y <span className="text-emerald-400">Aviso Legal</span>
          </h1>
          <p className="text-gray-500 max-w-2xl text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" />
            Última actualización: 12 de mayo de 2026
          </p>
        </header>

        <div className="space-y-12">
          
          {/* Identificación */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Info className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Identificación</h2>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-gray-400">
              <p><strong className="text-gray-200">Co-responsables:</strong> Miguel Mure Fernandez, Yeray Hurtado Dragón y Peter Gerard Asencio.</p>
              <p><strong className="text-gray-200">Ubicación:</strong> Carrer de Monlau, 6, 08027 Barcelona.</p>
              <p><strong className="text-gray-200">Email:</strong> FutSight@gmail.com.</p>
            </div>
          </section>

          {/* Propiedad Intelectual */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Scale className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Propiedad Intelectual (Aviso Legal)</h2>
            </div>
            <div className="text-sm leading-relaxed text-gray-400">
              <p>FutSight se constituye y define como una <strong>Obra Derivada</strong>. Amparándonos en la Directiva (UE) 2019/790 (Art. 3 y 4), este proyecto realiza minería de textos y datos (scraping) sobre fuentes de acceso público para fines exclusivos de innovación e investigación tecnológica en el ámbito deportivo.</p>
            </div>
          </section>

          {/* Privacidad, RGPD y Privacy by Design */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Privacidad y RGPD</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-gray-400">
              <div>
                <strong className="text-gray-200 block mb-1">Base Jurídica (RGPD):</strong>
                <p>El tratamiento de datos dentro de FutSight se fundamenta en el <strong>Interés Legítimo (Art. 6.1.f)</strong> para promover la transparencia y análisis en el ecosistema deportivo, así como con <strong>fines estadísticos (Art. 89)</strong>, garantizando que el uso de los datos no menoscaba los derechos de los interesados.</p>
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">Privacy by Design:</strong>
                <p>Nuestra arquitectura prioriza la confidencialidad desde el diseño. Implementamos <strong>inferencia local (Ollama/Qwen2.5)</strong> para asegurar que las consultas de scouting sean estrictamente herméticas y nunca transiten hacia servidores externos ni APIs de terceros.</p>
              </div>
            </div>
          </section>

          {/* Exención de Responsabilidad */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Exención de Responsabilidad</h2>
            </div>
            <div className="text-sm leading-relaxed text-gray-400">
              <p>FutSight es exclusivamente una herramienta de soporte analítico. Los resultados presentados por la IA y el motor probabilístico son <strong>estimaciones estadísticas</strong> basadas en patrones y datos históricos. Los co-responsables del proyecto no asumen ninguna responsabilidad derivada de decisiones financieras, de inversión o de fichajes deportivos tomadas por terceros en base a dichos resultados.</p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
