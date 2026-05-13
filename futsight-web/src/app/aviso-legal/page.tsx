import { Shield, Lock, Scale, Info, Calendar, Database, Brain, Clock } from "lucide-react";

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
              <p><strong className="text-gray-200">Co-responsables:</strong> Miguel Mure Fernandez, Yeray Hurtado Dragón y Peter Gerard Ascencio Macias.</p>
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

          {/* Derechos del Interesado */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <Info className="w-6 h-6 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Derechos del Interesado (ARCO+)</h2>
            </div>
            <div className="text-sm leading-relaxed text-gray-400 space-y-3">
              <p>Cualquier persona podrá ejercer sus derechos de <strong>acceso, rectificación, supresión ("derecho al olvido"), limitación del tratamiento, portabilidad y oposición</strong> (especialmente en caso de que un deportista no desee ser indexado por nuestro sistema) mediante el correo <a href="mailto:FutSight@gmail.com" className="text-emerald-400 hover:underline">FutSight@gmail.com</a>.</p>
              <p>Asimismo, se informa del derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD).</p>
            </div>
          </section>

          {/* Procedencia de los Datos */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                <Database className="w-6 h-6 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Procedencia de los Datos (Art. 14 RGPD)</h2>
            </div>
            <div className="text-sm leading-relaxed text-gray-400 space-y-3">
              <p>Los datos estadísticos analizados en FutSight proceden íntegramente de <strong>fuentes públicas de información deportiva y OSINT</strong> (como FBref o Transfermarkt), así como registros de competiciones oficiales.</p>
              <p>El tratamiento se limita a KPIs técnicos de naturaleza profesional y pública, minimizando la expectativa de privacidad personal del deportista, ya que no se recaban datos íntimos ni privados.</p>
            </div>
          </section>

          {/* Transparencia en IA */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20">
                <Brain className="w-6 h-6 text-fuchsia-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Transparencia en IA (Art. 22 RGPD)</h2>
            </div>
            <div className="text-sm leading-relaxed text-gray-400 space-y-3">
              <p>FutSight es un sistema <strong>"Human-in-the-loop"</strong>. De acuerdo con las directrices de la Unión Europea sobre IA, nos comprometemos con la IA Explicable (XAI). El sistema genera estimaciones probabilísticas o scores como apoyo a la toma de decisiones.</p>
              <p>Garantizamos que <strong>la decisión final sobre cualquier operación deportiva siempre recae en un analista o profesional humano</strong>, evitando la automatización de decisiones que puedan tener efectos jurídicos vinculantes para los sujetos analizados.</p>
            </div>
          </section>

          {/* Plazo de Conservación y Cookies */}
          <section className="glass p-8 rounded-3xl border border-white/5 space-y-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="flex items-center gap-3 text-white mb-6">
              <div className="p-3 bg-gray-500/10 rounded-xl border border-gray-500/20">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Conservación y Cookies</h2>
            </div>
            <div className="text-sm leading-relaxed text-gray-400 space-y-3">
              <div>
                <strong className="text-gray-200 block mb-1">Plazo de Conservación:</strong>
                <p>Los datos se conservarán durante el tiempo estrictamente necesario para el desarrollo del proyecto académico, la investigación y la mejora iterativa de nuestros modelos predictivos.</p>
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">Cookies y Seguimiento:</strong>
                <p>El sitio web utiliza únicamente cookies técnicas necesarias para la navegación, la seguridad de la infraestructura y el correcto funcionamiento del agente NLP local.</p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
