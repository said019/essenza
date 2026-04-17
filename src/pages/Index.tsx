import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";

const navLinks = [
  { label: "Método", href: "#method" },
  { label: "Horarios", href: "#schedule" },
  { label: "Planes", href: "#membership" },
];

const benefits = [
  {
    title: "Resistencia Progresiva",
    tagline: "Control total",
    desc: "El Reformer ajusta la tensión con muelles para trabajar cada músculo con precisión, de principiante a avanzado.",
    img: "/test1.jpeg",
    align: "",
  },
  {
    title: "Core Profundo",
    tagline: "Fuerza desde adentro",
    desc: "Cada ejercicio activa el centro del cuerpo. Revela músculos que el entrenamiento convencional nunca alcanza.",
    img: "/test2.jpeg",
    align: "md:mt-24",
  },
  {
    title: "Movilidad & Postura",
    tagline: "Movimiento sin límites",
    desc: "El deslizamiento del carro alarga la cadena muscular y corrige la alineación, sesión tras sesión.",
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

const WaveDivider = ({ flip = false, color = "#fbf9f6" }: { flip?: boolean; color?: string }) => (
  <div className={`wave-divider ${flip ? "rotate-180" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0,32 C240,60 480,0 720,32 C960,60 1200,0 1440,32 L1440,60 L0,60 Z"
        fill={color}
      />
    </svg>
  </div>
);

const WaveDividerLg = ({ flip = false, color = "#fbf9f6" }: { flip?: boolean; color?: string }) => (
  <div className={`wave-divider wave-divider-lg ${flip ? "rotate-180" : ""}`} aria-hidden="true">
    <svg viewBox="0 0 1440 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0,50 C180,80 360,20 540,50 C720,80 900,20 1080,50 C1260,80 1350,30 1440,50 L1440,100 L0,100 Z"
        fill={color}
      />
    </svg>
  </div>
);

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

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const Index = () => {
  const methodRef = useScrollReveal();
  const scheduleRef = useScrollReveal();
  const membershipRef = useScrollReveal();
  const testimonialRef = useScrollReveal();
  const active = useActiveSection(["method", "schedule", "membership"]);

  return (
    <main className="min-h-screen bg-surface text-on-surface font-body overflow-x-hidden">

      {/* ═══ Nav ═══ */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-7xl rounded-full px-6 md:px-10 py-4 glass-nav flex justify-between items-center z-50 shadow-lg">
        <Link to="/" className="flex items-center group" aria-label="Essenza del Flusso — inicio">
          <Brand
            variant="logo"
            className="h-14 w-auto mix-blend-multiply transition-opacity duration-300 group-hover:opacity-80"
          />
        </Link>
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((l) => {
            const id = l.href.replace("#", "");
            const isActive = active === id;
            return (
              <a
                key={l.label}
                href={l.href}
                className={`font-headline text-xs tracking-[0.2em] uppercase transition-colors duration-300 ${
                  isActive
                    ? "text-primary border-b border-primary/40 pb-1"
                    : "text-essenza-secondary hover:text-primary"
                }`}
              >
                {l.label}
              </a>
            );
          })}
        </div>
        <Link
          to="/register"
          className="bg-primary text-white px-6 md:px-8 py-2.5 rounded-full font-label text-xs tracking-widest uppercase shadow-md hover:bg-essenza-goldLight transition-colors duration-300 active:scale-[0.98]"
        >
          Reservar
        </Link>
      </nav>

      {/* ═══ Hero ═══ */}
      <header className="relative min-h-[100svh] flex items-center overflow-hidden">
        <div className="absolute inset-0 flow-gradient z-0" aria-hidden="true" />

        <div className="flow-blob flow-blob-gold w-[500px] h-[500px] -top-20 -right-20 z-[1]" aria-hidden="true" />
        <div className="flow-blob flow-blob-blue w-[400px] h-[400px] bottom-10 -left-20 z-[1]" style={{ animationDelay: "-5s" }} aria-hidden="true" />

        <div className="absolute inset-0 z-[2]" aria-hidden="true">
          <img
            src="/test2.jpeg"
            alt=""
            className="w-full h-full object-cover opacity-40 mix-blend-overlay scale-105"
          />
        </div>

        <div className="absolute inset-0 z-[3] bg-gradient-to-b from-transparent via-transparent to-white/40" aria-hidden="true" />

        <div className="container mx-auto px-6 relative z-10 text-center md:text-left pt-32 pb-20">
          <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary mb-6 inline-flex items-center gap-3 font-semibold">
            <img src="/reformer-icon-gold.svg" alt="" className="h-5 w-auto" />
            Pilates Reformer Studio
          </span>
          <h1 className="mb-4 max-w-2xl md:max-w-3xl">
            <Brand
              variant="logo"
              className="w-full max-w-[340px] md:max-w-[520px] mix-blend-multiply"
            />
          </h1>
          <p className="font-headline text-[clamp(1.25rem,3vw,2rem)] leading-tight mb-8 max-w-3xl tracking-wide uppercase text-on-surface/80">
            La esencia del movimiento consciente
          </p>
          <p className="font-body text-essenza-secondary text-base md:text-lg max-w-[55ch] mb-12 leading-relaxed font-light mx-auto md:mx-0">
            Un studio de Pilates Reformer donde cada sesión es un ritual de precisión,
            fuerza y fluidez.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-center md:items-start">
            <Link
              to="/register"
              className="bg-gradient-gold text-white px-8 md:px-10 py-4 rounded-full font-label uppercase tracking-[0.2em] text-[11px] hover:opacity-90 transition-opacity duration-300 shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface min-h-[44px]"
            >
              Reserva tu primera clase
            </Link>
            <a
              href="#method"
              className="px-8 md:px-10 py-4 rounded-full font-label uppercase tracking-[0.2em] text-[11px] text-on-surface hover:text-primary transition-colors duration-300 min-h-[44px] inline-flex items-center"
            >
              Conoce el método
            </a>
          </div>
        </div>
      </header>

      <WaveDividerLg color="#fbf9f6" />

      {/* ═══ Method ═══ */}
      <section id="method" ref={methodRef} className="py-24 md:py-40 px-6 bg-surface marble-overlay relative">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="mb-16 md:mb-24 max-w-3xl mx-auto text-center" data-reveal>
            <img
              src="/reformer-icon-gold.svg"
              alt=""
              className="h-24 w-auto mx-auto mb-8 opacity-90"
            />
            <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary/80 mb-4 block">El Método</span>
            <h2 className="font-signature text-[clamp(2.5rem,6vw,4.5rem)] text-primary mb-8 font-light leading-snug">Por qué el Reformer</h2>
            <p className="text-essenza-secondary text-base md:text-lg font-light leading-relaxed max-w-[60ch] mx-auto">
              La evolución del método clásico. Resistencia, control y fluidez en un solo
              aparato diseñado para transformar el cuerpo desde adentro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
            {benefits.map((b, i) => (
              <article
                key={b.title}
                data-reveal
                className={`group relative flex flex-col opacity-0 translate-y-8 ${b.align}`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="relative w-full aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-xl transition-all duration-700 group-hover:-translate-y-3 group-hover:shadow-2xl">
                  <img
                    src={b.img}
                    alt={b.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" aria-hidden="true" />
                  <div className="absolute bottom-8 left-8 right-8 text-surface">
                    <span className="font-label text-[10px] uppercase tracking-[0.3em] text-primary-fixed-dim mb-2 block">
                      {b.tagline}
                    </span>
                    <h3 className="font-headline text-2xl md:text-3xl mb-3">{b.title}</h3>
                    <p className="text-surface/85 text-sm leading-relaxed font-light">
                      {b.desc}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider color="#f5f3f0" />

      {/* ═══ Schedule ═══ */}
      <section id="schedule" ref={scheduleRef} className="py-24 md:py-40 px-6 bg-surface-container-low marble-overlay">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="mb-16 md:mb-24 max-w-3xl" data-reveal>
            <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary/80 mb-4 block">Tu Ritmo</span>
            <h2 className="font-signature text-[clamp(2.5rem,6vw,4.5rem)] text-primary mb-8 leading-snug">Horarios</h2>
            <p className="text-essenza-secondary text-base md:text-lg font-light max-w-[55ch]">
              Sesiones de una hora, de lunes a viernes. Cualquier pase te da acceso a todos los bloques.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Matutinos */}
            <div data-reveal className="opacity-0 translate-y-8 bg-surface-container-lowest border border-essenza-outlineVariant/40 p-8 md:p-10 rounded-3xl">
              <div className="flex items-baseline justify-between mb-8">
                <h3 className="font-label uppercase tracking-[0.3em] text-[11px] text-primary font-semibold">
                  Matutinos
                </h3>
                <span className="text-[10px] text-essenza-secondary uppercase tracking-widest">AM</span>
              </div>
              <ul className="space-y-4">
                {morningSlots.map((t) => (
                  <li key={t} className="flex items-baseline border-b border-essenza-outlineVariant/30 pb-3 last:border-0">
                    <span className="font-headline text-lg">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Especiales — única superficie acentuada por sección */}
            <div data-reveal className="opacity-0 translate-y-8 bg-gradient-gold p-8 md:p-10 rounded-3xl text-white shadow-[0_24px_60px_-20px_rgba(175,139,59,0.45)] md:scale-[1.02] relative">
              <div className="flex items-baseline justify-between mb-8">
                <h3 className="font-label uppercase tracking-[0.3em] text-[11px] font-semibold text-white">
                  Especiales
                </h3>
                <span className="text-[10px] uppercase tracking-widest text-white/80">Mediodía</span>
              </div>
              <ul className="space-y-4">
                {specialSlots.map((t) => (
                  <li key={t} className="flex items-baseline border-b border-white/25 pb-3 last:border-0">
                    <span className="font-headline text-lg">{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-xs text-white/85 leading-relaxed">
                Cupos limitados. Reserva con anticipación.
              </p>
            </div>

            {/* Vespertinos */}
            <div data-reveal className="opacity-0 translate-y-8 bg-surface-container-lowest border border-essenza-outlineVariant/40 p-8 md:p-10 rounded-3xl">
              <div className="flex items-baseline justify-between mb-8">
                <h3 className="font-label uppercase tracking-[0.3em] text-[11px] text-primary font-semibold">
                  Vespertinos
                </h3>
                <span className="text-[10px] text-essenza-secondary uppercase tracking-widest">PM</span>
              </div>
              <ul className="space-y-4">
                {eveningSlots.map((t) => (
                  <li key={t} className="flex items-baseline border-b border-essenza-outlineVariant/30 pb-3 last:border-0">
                    <span className="font-headline text-lg">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-12 text-center text-xs text-essenza-secondary uppercase tracking-[0.3em]">
            60 minutos por sesión
          </p>
        </div>
      </section>

      <WaveDividerLg flip color="#f5f3f0" />

      {/* ═══ Membership ═══ */}
      <section id="membership" ref={membershipRef} className="py-24 md:py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 marble-bg z-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-white/85 z-0" aria-hidden="true" />

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-16 md:mb-24 max-w-3xl mx-auto" data-reveal>
            <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary mb-4 block font-semibold">
              Sin anualidad · Sin contrato
            </span>
            <h2 className="font-signature text-[clamp(2.5rem,6vw,4.5rem)] text-primary mb-8 italic font-light leading-snug">
              Paga por sesión
            </h2>
            <p className="font-body text-essenza-secondary text-base md:text-lg font-light max-w-[55ch] mx-auto">
              Compra solo las sesiones de Reformer que vas a tomar. Cualquiera puede empezar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 md:gap-6 items-stretch">
            {plans.map((p, i) => (
              <article
                key={p.name}
                data-reveal
                className={`opacity-0 translate-y-8 flex flex-col rounded-[2rem] p-7 md:p-8 transition-transform duration-500 ${
                  p.highlight
                    ? "bg-gradient-gold text-white shadow-[0_30px_70px_-20px_rgba(175,139,59,0.45)] lg:scale-[1.05] z-10 relative"
                    : "bg-surface-container-lowest border border-essenza-outlineVariant/40 hover:-translate-y-1 hover:shadow-lg"
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {p.highlight && p.badge && (
                  <span className="absolute top-5 right-5 bg-white/20 text-white text-[9px] px-3 py-1 rounded-full backdrop-blur-md uppercase tracking-widest">
                    {p.badge}
                  </span>
                )}
                <span className={`font-label text-[10px] uppercase tracking-[0.35em] mb-3 ${p.highlight ? "text-white/80" : "text-essenza-secondary"}`}>
                  {p.label}
                </span>
                <h3 className={`font-headline text-2xl md:text-[1.75rem] mb-6 leading-tight ${p.highlight ? "text-white" : "text-on-surface"}`}>
                  {p.name}
                </h3>
                <div className={`text-4xl md:text-[2.75rem] font-headline mb-1 leading-none ${p.highlight ? "text-white" : "text-primary"}`}>
                  {p.price}
                </div>
                <div className={`text-[10px] uppercase tracking-widest mb-7 ${p.highlight ? "text-white/70" : "text-essenza-secondary"}`}>
                  {p.unit}
                </div>
                <ul className={`text-sm space-y-2.5 mb-8 font-light flex-1 ${p.highlight ? "text-white/90" : "text-essenza-secondary"}`}>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`block w-full text-center py-3.5 rounded-full font-label text-[10px] uppercase tracking-[0.3em] transition-colors duration-300 min-h-[44px] inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    p.highlight
                      ? "bg-white text-primary hover:bg-essenza-cream shadow-md focus-visible:ring-white"
                      : "border border-primary/30 text-on-surface hover:bg-primary hover:text-white hover:border-primary focus-visible:ring-primary"
                  }`}
                >
                  {p.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider color="#fbf9f6" />

      {/* ═══ Testimonial ═══ */}
      <section ref={testimonialRef} className="py-28 md:py-40 px-6 bg-surface marble-overlay overflow-hidden text-center relative">
        <div className="container mx-auto max-w-3xl relative z-10">
          <p
            data-reveal
            className="opacity-0 translate-y-8 font-body text-2xl md:text-[2.25rem] leading-snug mb-12 italic font-light text-on-surface"
          >
            "Nunca pensé que el Reformer pudiera cambiarme tanto. Mi postura, mi fuerza,
            mi forma de moverme — todo cambió."
          </p>
          <div data-reveal className="opacity-0 translate-y-8 flex flex-col items-center gap-3">
            <img
              src="/essenza-logo.jpeg"
              alt=""
              className="w-14 h-14 rounded-full object-cover ring-1 ring-primary/20"
            />
            <p className="font-label text-[11px] uppercase tracking-[0.3em] font-semibold text-primary">Sofía M.</p>
            <p className="text-[10px] text-essenza-secondary uppercase tracking-widest">Alumna · 6 meses</p>
          </div>
        </div>
      </section>

      <WaveDivider color="#e4e2df" />

      {/* ═══ Ubicación ═══ */}
      <section className="py-20 md:py-28 px-6 bg-surface marble-overlay relative">
        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary/80 mb-4 block font-semibold">Encuéntranos</span>
            <h2 className="font-signature text-[clamp(2.5rem,6vw,4.5rem)] text-primary mb-6 leading-snug">
              Visítanos
            </h2>
            <p className="font-body text-essenza-secondary text-base md:text-lg max-w-lg mx-auto">
              C. de Orleans 51, piso 1, Lomas Estrella 2da Secc,<br />
              Iztapalapa, 09890 Ciudad de México, CDMX
            </p>
          </div>
          <div className="rounded-3xl overflow-hidden shadow-xl border border-essenza-outlineVariant/30 aspect-video max-h-[450px]">
            <iframe
              title="Ubicación de Essenza del Flusso Studio"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3765.212!2d-99.0756!3d19.3148!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85ce00f0b1fa58c3%3A0x0!2sC.+de+Orleans+51%2C+Lomas+Estrella+2da+Secc%2C+Iztapalapa%2C+09890+Ciudad+de+M%C3%A9xico%2C+CDMX!5e0!3m2!1ses!2smx!4v1700000000000!5m2!1ses!2smx"
              className="w-full h-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="w-full py-16 md:py-20 px-6 md:px-12 bg-surface-container-highest">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-start gap-10 md:gap-6">
          <div className="flex flex-col items-center md:items-start gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img
                src="/essenza-logo.jpeg"
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-primary/20"
              />
              <Brand variant="signature" className="text-2xl" />
            </Link>
            <p className="font-body text-xs text-essenza-secondary leading-relaxed text-center md:text-left max-w-[240px]">
              C. de Orleans 51, piso 1<br />
              Lomas Estrella 2da Secc, Iztapalapa<br />
              09890 CDMX
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
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
                className="font-label text-[11px] uppercase tracking-[0.3em] text-essenza-secondary hover:text-primary transition-colors duration-300"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="font-body text-[10px] uppercase tracking-[0.3em] text-essenza-secondary/70 text-center md:text-right">
            © {new Date().getFullYear()} Essenza del Flusso Studio
          </p>
        </div>
      </footer>
    </main>
  );
};

export default Index;
