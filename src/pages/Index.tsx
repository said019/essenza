import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";

const navLinks = [
  { label: "Studio", href: "#studio", active: true },
  { label: "Método", href: "#method" },
  { label: "Horarios", href: "#schedule" },
  { label: "Membresías", href: "#membership" },
];

const benefits = [
  {
    title: "Resistencia Progresiva",
    tagline: "Control total",
    desc: "El Reformer permite ajustar la tensión de muelles para trabajar cada músculo con precisión, desde principiantes hasta nivel avanzado.",
    img: "/test1.jpeg",
    align: "",
  },
  {
    title: "Core Profundo",
    tagline: "Fuerza desde adentro",
    desc: "Cada ejercicio activa el centro del cuerpo. El Reformer revela músculos que el entrenamiento convencional nunca alcanza.",
    img: "/test2.jpeg",
    align: "md:mt-24",
  },
  {
    title: "Movilidad & Postura",
    tagline: "Movimiento sin límites",
    desc: "El deslizamiento del carro alarga la cadena muscular y corrige la alineación postural, sesión tras sesión.",
    img: "/test1.jpeg",
    align: "",
  },
];

const morningSlots = ["07:00 – 08:00", "08:00 – 09:00", "09:00 – 10:00", "10:00 – 11:00"];
const eveningSlots = ["05:00 – 06:00 PM", "06:00 – 07:00 PM", "07:00 – 08:00 PM", "08:00 – 09:00 PM"];
const specialSlots = ["11:00 – 12:00 PM", "12:00 – 01:00 PM"];

const plans = [
  {
    label: "Primera visita",
    name: "Primera clase",
    price: "$150",
    unit: "por sesión",
    features: ["Oferta de bienvenida", "Válido 15 días", "Cualquier horario"],
    cta: "Reservar",
    highlight: false,
  },
  {
    label: "Drop-in",
    name: "Clase suelta",
    price: "$200",
    unit: "por sesión",
    features: ["Sin compromiso", "Válido 30 días", "Cualquier horario"],
    cta: "Comprar",
    highlight: false,
  },
  {
    label: "Pack 4",
    name: "4 sesiones",
    price: "$760",
    unit: "$190 por sesión",
    features: ["Válido 45 días", "Todos los niveles"],
    cta: "Comprar pack",
    highlight: false,
  },
  {
    label: "Pack 8 · Ritual",
    name: "8 sesiones",
    price: "$1,490",
    unit: "$186 por sesión",
    features: ["Válido 60 días", "Todos los niveles", "Pase de invitada"],
    cta: "Comprar pack",
    highlight: true,
    badge: "Más popular",
  },
  {
    label: "Pack 12",
    name: "12 sesiones",
    price: "$2,160",
    unit: "$180 por sesión",
    features: ["Válido 90 días", "Prioridad en reservas", "Todos los niveles"],
    cta: "Comprar pack",
    highlight: false,
  },
];

/* ── SVG wave components ── */
const WaveDivider = ({ flip = false, color = "#fbf9f6" }: { flip?: boolean; color?: string }) => (
  <div className={`wave-divider ${flip ? "rotate-180" : ""}`}>
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        className="wave-path"
        d="M0,32 C240,60 480,0 720,32 C960,60 1200,0 1440,32 L1440,60 L0,60 Z"
        fill={color}
      />
    </svg>
  </div>
);

const WaveDividerLg = ({ flip = false, color = "#fbf9f6" }: { flip?: boolean; color?: string }) => (
  <div className={`wave-divider wave-divider-lg ${flip ? "rotate-180" : ""}`}>
    <svg viewBox="0 0 1440 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        className="wave-path"
        d="M0,50 C180,80 360,20 540,50 C720,80 900,20 1080,50 C1260,80 1350,30 1440,50 L1440,100 L0,100 Z"
        fill={color}
      />
    </svg>
  </div>
);

/* ── Intersection Observer hook ── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up");
            entry.target.classList.remove("opacity-0", "translate-y-8");
          }
        });
      },
      { threshold: 0.15 }
    );
    const children = el.querySelectorAll("[data-reveal]");
    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

const Index = () => {
  const methodRef = useScrollReveal();
  const scheduleRef = useScrollReveal();
  const membershipRef = useScrollReveal();
  const testimonialRef = useScrollReveal();

  return (
    <main className="min-h-screen bg-surface text-on-surface font-body overflow-hidden">

      {/* ═══ Nav ═══ */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-7xl rounded-full px-6 md:px-10 py-4 glass-nav flex justify-between items-center z-50 shadow-lg">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/essenza-logo.jpeg"
            alt="Essenza del Flusso"
            className="h-10 w-10 rounded-full object-cover ring-1 ring-primary/20 transition-transform duration-500 group-hover:scale-110"
          />
          <span className="hidden sm:inline text-xl md:text-2xl font-headline font-light tracking-tighter text-on-surface">
            ESSENZA
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`font-headline text-xs tracking-[0.2em] uppercase transition-all duration-300 ${
                l.active
                  ? "text-primary border-b border-primary/40 pb-1"
                  : "text-essenza-secondary hover:text-primary hover:tracking-[0.25em]"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>
        <Link
          to="/register"
          className="bg-gradient-gold text-white px-6 md:px-8 py-2.5 rounded-full font-label text-xs tracking-widest uppercase shadow-md hover:shadow-xl transition-all duration-500 active:scale-95 ripple-btn"
        >
          Reservar
        </Link>
      </nav>

      {/* ═══ Hero ═══ */}
      <header className="relative min-h-screen flex items-center overflow-hidden">
        {/* Animated flowing background */}
        <div className="absolute inset-0 flow-gradient z-0" />

        {/* Decorative floating blobs */}
        <div className="flow-blob flow-blob-gold w-[500px] h-[500px] -top-20 -right-20 animate-drift z-[1]" />
        <div className="flow-blob flow-blob-blue w-[400px] h-[400px] bottom-10 -left-20 animate-drift-slow z-[1]" style={{ animationDelay: "-5s" }} />
        <div className="flow-blob flow-blob-sage w-[300px] h-[300px] top-1/3 right-1/4 animate-breathe z-[1]" style={{ animationDelay: "-3s" }} />

        {/* Background image overlay */}
        <div className="absolute inset-0 z-[2]">
          <img
            src="/test2.jpeg"
            alt="Essenza del Flusso — Pilates Reformer studio"
            className="w-full h-full object-cover opacity-40 mix-blend-overlay scale-105"
          />
        </div>

        {/* Soft vignette */}
        <div className="absolute inset-0 z-[3] bg-gradient-to-b from-transparent via-transparent to-white/40" />

        <div className="container mx-auto px-6 relative z-10 text-center md:text-left pt-32 pb-16">
          <span className="font-label text-xs uppercase tracking-[0.4em] text-primary mb-8 block font-semibold animate-fade-in">
            ✦ Pilates Reformer Studio ✦
          </span>
          <h1 className="font-headline text-3xl md:text-5xl lg:text-6xl leading-[0.95] mb-8 max-w-4xl tracking-tight animate-fade-up">
            La <span className="text-gradient-gold italic">esencia</span> del <br />
            <span className="animate-fade-up delay-200">movimiento consciente.</span>
          </h1>
          <p className="font-body text-essenza-secondary text-sm md:text-lg max-w-xl mb-12 leading-relaxed font-light mx-auto md:mx-0 animate-fade-up delay-300 opacity-0">
            Un studio de Pilates Reformer donde cada sesión es un ritual de precisión,
            fuerza y fluidez. Tu cuerpo, en su mejor versión.
          </p>
          <div className="flex flex-col md:flex-row gap-5 md:gap-6 items-center md:items-start animate-fade-up delay-400 opacity-0">
            <Link
              to="/register"
              className="bg-on-surface text-surface px-8 md:px-10 py-4 rounded-full font-label uppercase tracking-[0.2em] text-[11px] hover:bg-primary transition-all duration-500 shadow-xl ripple-btn"
            >
              Reserva tu primera clase
            </Link>
            <a
              href="#method"
              className="glass-flow px-8 md:px-10 py-4 rounded-full font-label uppercase tracking-[0.2em] text-[11px] hover:border-primary/40"
            >
              Descubrir el método →
            </a>
          </div>
        </div>
      </header>

      {/* Wave transition hero → method */}
      <WaveDividerLg color="#fbf9f6" />

      {/* ═══ Por qué el Reformer ═══ */}
      <section id="method" ref={methodRef} className="py-24 md:py-40 px-6 bg-surface marble-overlay relative">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="mb-16 md:mb-24 text-center" data-reveal>
            <span className="font-label text-xs uppercase tracking-[0.4em] text-primary/70 mb-4 block">El Método</span>
            <h2 className="font-headline text-3xl md:text-5xl mb-6 font-light">Por qué el Reformer</h2>
            <div className="w-32 h-px bg-gradient-gold mx-auto opacity-60" />
            <p className="text-essenza-secondary max-w-xl mx-auto mt-6 text-base md:text-lg font-light leading-relaxed">
              El Pilates Reformer es la evolución del método clásico. Resistencia, control y fluidez
              en un solo aparato diseñado para transformar tu cuerpo desde adentro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                data-reveal
                className={`group relative flex flex-col items-center opacity-0 translate-y-8 ${b.align}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="relative w-full aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl transition-all duration-700 group-hover:-translate-y-4 group-hover:shadow-[0_32px_80px_rgba(175,139,59,0.2)]">
                  <img
                    src={b.img}
                    alt={b.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  {/* Flow line overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-700">
                    <svg className="w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="none">
                      <path d="M0,250 Q100,200 200,250 T400,250" fill="none" stroke="rgba(175,139,59,0.5)" strokeWidth="1">
                        <animate attributeName="d" dur="4s" repeatCount="indefinite"
                          values="M0,250 Q100,200 200,250 T400,250;M0,250 Q100,300 200,250 T400,250;M0,250 Q100,200 200,250 T400,250" />
                      </path>
                    </svg>
                  </div>
                  <div className="absolute bottom-10 left-10 right-10">
                    <span className="font-label text-[10px] uppercase tracking-[0.3em] text-primary-fixed-dim mb-2 block">
                      {b.tagline}
                    </span>
                    <h3 className="font-headline text-2xl md:text-3xl text-surface">{b.title}</h3>
                    <p className="text-surface/70 text-xs mt-2 leading-relaxed font-light hidden group-hover:block transition-all duration-500">
                      {b.desc}
                    </p>
                  </div>
                </div>
                <div className="mt-8 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0 font-label text-[10px] uppercase tracking-widest text-primary">
                  Descubrir más →
                </div>
              </div>
            ))}
          </div>

          {/* CTA intermedio */}
          <div className="text-center mt-20 md:mt-32" data-reveal>
            <div className="inline-flex flex-col items-center gap-6">
              <p className="font-headline text-xl md:text-2xl font-light italic text-essenza-secondary">
                "El Reformer no es una máquina — es tu aliado."
              </p>
              <Link
                to="/register"
                className="bg-on-surface text-surface px-10 py-4 rounded-full font-label text-[11px] uppercase tracking-[0.2em] hover:bg-primary transition-all duration-500 ripple-btn shadow-lg"
              >
                Agenda tu sesión introductoria
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Wave transition method → schedule */}
      <WaveDivider color="#f5f3f0" />

      {/* ═══ Schedule ═══ */}
      <section id="schedule" ref={scheduleRef} className="py-24 md:py-40 px-6 bg-surface-container-low marble-overlay">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="mb-16 md:mb-24 text-center md:text-left" data-reveal>
            <span className="font-label text-xs uppercase tracking-[0.4em] text-primary/70 mb-4 block">Tu Ritmo</span>
            <h2 className="font-headline text-3xl md:text-5xl mb-6">Horarios</h2>
            <p className="text-essenza-secondary max-w-2xl text-base md:text-lg">
              Sesiones de Pilates Reformer de una hora. Elige el bloque que mejor se acomode a tu día.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 stagger-children">
            {/* Matutinos */}
            <div data-reveal className="glass-flow p-8 md:p-10 rounded-3xl opacity-0 translate-y-8 shimmer-border">
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h4 className="font-label uppercase tracking-[0.3em] text-[10px] text-primary font-extrabold">
                  Matutinos
                </h4>
                <span className="material-symbols-outlined text-primary/60 animate-float-slow">wb_sunny</span>
              </div>
              <ul className="space-y-5 relative z-10">
                {morningSlots.map((t) => (
                  <li key={t} className="flex items-center justify-between border-b border-primary/10 pb-4 last:border-0 group/slot hover:border-primary/30 transition-colors">
                    <span className="font-headline text-base md:text-lg group-hover/slot:text-primary transition-colors">{t}</span>
                    <span className="text-[10px] text-essenza-secondary uppercase tracking-widest">AM</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Especiales */}
            <div data-reveal className="bg-gradient-gold p-8 md:p-10 rounded-3xl text-white shadow-[0_20px_60px_rgba(175,139,59,0.25)] md:scale-[1.02] relative overflow-hidden opacity-0 translate-y-8 breathe-glow">
              <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full" viewBox="0 0 400 400" preserveAspectRatio="none">
                  <path d="M0,200 Q100,150 200,200 T400,200" fill="none" stroke="white" strokeWidth="0.5" opacity="0.5">
                    <animate attributeName="d" dur="6s" repeatCount="indefinite"
                      values="M0,200 Q100,150 200,200 T400,200;M0,200 Q100,250 200,200 T400,200;M0,200 Q100,150 200,200 T400,200" />
                  </path>
                  <path d="M0,180 Q150,130 300,180 T400,180" fill="none" stroke="white" strokeWidth="0.3" opacity="0.3">
                    <animate attributeName="d" dur="8s" repeatCount="indefinite"
                      values="M0,180 Q150,130 300,180 T400,180;M0,180 Q150,230 300,180 T400,180;M0,180 Q150,130 300,180 T400,180" />
                  </path>
                </svg>
              </div>
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h4 className="font-label uppercase tracking-[0.3em] text-[10px] font-extrabold text-white">
                  Especiales
                </h4>
                <span className="material-symbols-outlined animate-breathe">auto_awesome</span>
              </div>
              <ul className="space-y-5 relative z-10">
                {specialSlots.map((t) => (
                  <li key={t} className="flex items-center justify-between border-b border-white/20 pb-4 last:border-0">
                    <span className="font-headline text-base md:text-lg">{t}</span>
                    <span className="text-[10px] uppercase tracking-widest text-white/80">Mediodía</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-xs text-white/85 leading-relaxed relative z-10">
                Cupos limitados por sesión. Reserva con anticipación.
              </p>
            </div>

            {/* Vespertinos */}
            <div data-reveal className="glass-flow p-8 md:p-10 rounded-3xl opacity-0 translate-y-8 shimmer-border">
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h4 className="font-label uppercase tracking-[0.3em] text-[10px] text-primary font-extrabold">
                  Vespertinos
                </h4>
                <span className="material-symbols-outlined text-primary/60 animate-float-slow" style={{ animationDelay: "-2s" }}>nightlight</span>
              </div>
              <ul className="space-y-5 relative z-10">
                {eveningSlots.map((t) => (
                  <li key={t} className="flex items-center justify-between border-b border-primary/10 pb-4 last:border-0 group/slot hover:border-primary/30 transition-colors">
                    <span className="font-headline text-base md:text-lg group-hover/slot:text-primary transition-colors">{t}</span>
                    <span className="text-[10px] text-essenza-secondary uppercase tracking-widest">PM</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-12 text-center text-xs text-essenza-secondary uppercase tracking-[0.3em]">
            Lunes a Viernes · Cada sesión 60 minutos · Pilates Reformer
          </p>
        </div>
      </section>

      {/* Wave transition schedule → membership */}
      <WaveDividerLg flip color="#f5f3f0" />

      {/* ═══ Membership ═══ */}
      <section id="membership" ref={membershipRef} className="py-24 md:py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 flow-gradient opacity-40 z-0" />
        <div className="absolute inset-0 marble-bg z-0" />
        <div className="absolute inset-0 bg-white/80 z-0" />
        <div className="flow-blob flow-blob-gold w-[350px] h-[350px] top-20 -right-10 z-[1] animate-drift" />
        <div className="flow-blob flow-blob-blue w-[250px] h-[250px] bottom-20 left-10 z-[1] animate-drift-slow" style={{ animationDelay: "-7s" }} />

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-16 md:mb-24" data-reveal>
            <span className="font-label text-xs uppercase tracking-[0.4em] text-primary mb-6 block font-semibold">
              Sin anualidad · Sin membresía obligatoria
            </span>
            <h2 className="font-headline text-3xl md:text-5xl lg:text-6xl mb-6 md:mb-8 italic tracking-tight">
              Commit to Flow
            </h2>
            <p className="font-body text-essenza-secondary max-w-2xl mx-auto text-sm md:text-base font-light">
              Paga solo las sesiones de Reformer que vas a tomar. Sin contratos ni cuotas anuales.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 md:gap-8 items-stretch">
            {plans.map((p, i) => (
              <div
                key={p.name}
                data-reveal
                className={`opacity-0 translate-y-8 ${
                  p.highlight
                    ? "bg-gradient-gold p-8 md:p-10 rounded-[2.5rem] text-center shadow-[0_40px_80px_rgba(175,139,59,0.3)] relative overflow-hidden lg:scale-[1.04] z-20 flex flex-col breathe-glow"
                    : "glass-flow p-8 md:p-10 rounded-[2.5rem] text-center group hover-float flex flex-col"
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                {p.highlight && p.badge && (
                  <div className="absolute top-5 right-5">
                    <span className="bg-white/20 text-white text-[9px] px-3 py-1 rounded-full backdrop-blur-md uppercase tracking-widest">
                      {p.badge}
                    </span>
                  </div>
                )}
                {p.highlight && (
                  <div className="absolute inset-0 opacity-15">
                    <svg className="w-full h-full" viewBox="0 0 300 500" preserveAspectRatio="none">
                      <path d="M0,400 Q75,380 150,400 T300,400" fill="none" stroke="white" strokeWidth="0.5">
                        <animate attributeName="d" dur="5s" repeatCount="indefinite"
                          values="M0,400 Q75,380 150,400 T300,400;M0,400 Q75,420 150,400 T300,400;M0,400 Q75,380 150,400 T300,400" />
                      </path>
                    </svg>
                  </div>
                )}
                <span className={`font-label text-[10px] uppercase tracking-[0.35em] mb-4 block relative z-10 ${p.highlight ? "text-white/80" : "text-essenza-secondary"}`}>
                  {p.label}
                </span>
                <h3 className={`font-headline text-2xl md:text-3xl mb-6 relative z-10 ${p.highlight ? "text-white" : ""}`}>
                  {p.name}
                </h3>
                <div className={`text-4xl md:text-5xl font-headline mb-2 relative z-10 ${p.highlight ? "text-white" : "text-primary"}`}>
                  {p.price}
                </div>
                <div className={`text-[10px] uppercase tracking-widest mb-8 relative z-10 ${p.highlight ? "text-white/70" : "text-essenza-secondary"}`}>
                  {p.unit}
                </div>
                <ul className={`text-sm space-y-3 mb-8 font-light flex-1 relative z-10 ${p.highlight ? "text-white/90" : "text-essenza-secondary"}`}>
                  {p.features.map((f) => (
                    <li key={f}>✦ {f}</li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`relative z-10 ripple-btn ${
                    p.highlight
                      ? "block w-full bg-white text-primary py-4 rounded-full font-label text-[10px] uppercase tracking-[0.3em] hover:bg-on-surface hover:text-white transition-all shadow-xl"
                      : "block w-full border border-primary/30 py-4 rounded-full font-label text-[10px] uppercase tracking-[0.3em] group-hover:bg-primary group-hover:text-white transition-all duration-500"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave transition membership → testimonial */}
      <WaveDivider color="#fbf9f6" />

      {/* ═══ Testimonial ═══ */}
      <section ref={testimonialRef} className="py-32 md:py-48 px-6 bg-surface marble-overlay overflow-hidden text-center relative">
        <div className="flow-blob flow-blob-gold w-[200px] h-[200px] top-10 left-1/4 z-[1] animate-breathe opacity-20" />

        <div className="container mx-auto max-w-5xl relative z-10">
          <span data-reveal className="text-primary text-6xl md:text-7xl font-headline opacity-10 leading-none block animate-float-slow opacity-0 translate-y-8">&ldquo;</span>
          <h2 data-reveal className="font-headline text-xl md:text-3xl leading-snug mb-14 italic font-light -mt-6 md:-mt-10 opacity-0 translate-y-8">
            Nunca pensé que el Reformer pudiera cambiarme tanto. Mi postura, mi fuerza,{" "}
            <span className="text-gradient-gold">mi forma de moverme en la vida</span> — todo cambió.
          </h2>
          <div data-reveal className="flex flex-col items-center gap-6 opacity-0 translate-y-8">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-primary/20 p-1 bg-gradient-gold animate-breathe" />
            <div>
              <p className="font-label text-xs uppercase tracking-[0.3em] font-bold text-primary">Sofia M.</p>
              <p className="text-[10px] text-essenza-secondary uppercase tracking-widest mt-1">Alumna · 6 meses en el studio</p>
            </div>
          </div>
        </div>
      </section>

      {/* Wave footer top */}
      <WaveDivider color="#e4e2df" />

      {/* ═══ Footer ═══ */}
      <footer className="w-full py-20 md:py-24 px-6 md:px-12 bg-surface-container-highest relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="flow-blob flow-blob-gold w-[200px] h-[200px] bottom-0 right-10 animate-drift-slow" />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 md:gap-12 relative z-10">
          <div className="flex items-center gap-3">
            <img
              src="/essenza-logo.jpeg"
              alt="Essenza del Flusso"
              className="h-12 w-12 rounded-full object-cover ring-1 ring-primary/20 animate-float-slow"
            />
            <div className="font-headline italic text-xl md:text-2xl text-on-surface tracking-tighter">
              Essenza del Flusso
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {[
              { label: "Privacidad", to: "/privacy" },
              { label: "Términos", to: "/terms" },
              { label: "Cancelación", to: "/cancellation-policy" },
              { label: "Instagram", to: "#" },
              { label: "Contacto", to: "#" },
            ].map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="font-body text-[10px] uppercase tracking-[0.3em] text-essenza-secondary hover:text-primary transition-all duration-300 hover:tracking-[0.35em]"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="font-body text-[10px] uppercase tracking-[0.3em] text-essenza-secondary opacity-60 text-center">
            © {new Date().getFullYear()} Essenza del Flusso · Pilates Reformer Studio
          </div>
        </div>
      </footer>
    </main>
  );
};

export default Index;
