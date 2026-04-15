import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, MapPin } from "lucide-react";

const sections = [
    { id: "aceptacion", title: "1. Aceptación" },
    { id: "servicio", title: "2. Descripción del Servicio" },
    { id: "registro", title: "3. Registro y Cuenta" },
    { id: "reservas", title: "4. Reservaciones y Cancelaciones" },
    { id: "pagos", title: "5. Pagos y Vigencia" },
    { id: "responsabilidad", title: "6. Responsabilidad" },
    { id: "propiedad", title: "7. Propiedad Intelectual" },
    { id: "modificaciones", title: "8. Modificaciones" },
    { id: "jurisdiccion", title: "9. Jurisdicción" },
    { id: "imagen", title: "10. Uso de Imagen" },
    { id: "menores", title: "11. Menores de Edad" },
    { id: "fuerza-mayor", title: "12. Fuerza Mayor" },
    { id: "reglamento", title: "Reglamento Interno" },
    { id: "contacto", title: "Contacto" },
];

export default function Terms() {
    const [activeSection, setActiveSection] = useState("aceptacion");

    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 120;
            for (const section of sections) {
                const element = document.getElementById(section.id);
                if (element) {
                    const { offsetTop, offsetHeight } = element;
                    if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                        setActiveSection(section.id);
                        break;
                    }
                }
            }
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            const offset = 100;
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen bg-surface text-on-surface font-body">
            <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-essenza-outlineVariant/40">
                <div className="container mx-auto px-4 lg:px-8 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-sm text-essenza-secondary hover:text-primary transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        Volver al inicio
                    </Link>
                    <div className="flex items-center gap-2">
                        <img src="/essenza-logo.jpeg" alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-primary/20" />
                        <span className="hidden sm:inline font-headline italic text-sm text-on-surface">Essenza del Flusso</span>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 lg:px-8 py-12">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                    <aside className="lg:sticky lg:top-24 lg:w-72 flex-shrink-0 h-fit">
                        <nav className="space-y-1 bg-surface-container-lowest rounded-2xl border border-essenza-outlineVariant/40 p-4">
                            <h2 className="text-[11px] font-semibold text-essenza-secondary uppercase tracking-[0.3em] mb-4 px-3">
                                Contenido
                            </h2>
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => scrollToSection(section.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                                        activeSection === section.id
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "text-essenza-secondary hover:bg-surface-container-low hover:text-on-surface"
                                    }`}
                                >
                                    <span>{section.title}</span>
                                    <ChevronRight
                                        className={`w-4 h-4 transition-transform ${
                                            activeSection === section.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
                                        }`}
                                    />
                                </button>
                            ))}
                        </nav>

                        <div className="mt-6 p-5 bg-primary/5 rounded-2xl border border-primary/15">
                            <div className="flex items-start gap-2 mb-2">
                                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <h3 className="text-sm font-semibold text-on-surface">Domicilio</h3>
                            </div>
                            <p className="text-xs text-essenza-secondary leading-relaxed">
                                C. de Orleans 51, piso 1<br />
                                Lomas Estrella 2da Secc<br />
                                Iztapalapa, 09890<br />
                                Ciudad de México, CDMX
                            </p>
                        </div>
                    </aside>

                    <main className="flex-1 max-w-3xl">
                        <div className="bg-surface-container-lowest rounded-2xl border border-essenza-outlineVariant/40 p-8 lg:p-12 space-y-12">
                            <div className="space-y-3 pb-8 border-b border-essenza-outlineVariant/40">
                                <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary font-semibold">
                                    Essenza del Flusso Studio
                                </span>
                                <h1 className="font-headline text-4xl md:text-5xl font-light leading-tight">
                                    Términos y Condiciones
                                </h1>
                                <p className="text-essenza-secondary text-sm">
                                    Última actualización: {new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                                </p>
                            </div>

                            <section id="aceptacion" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem] text-on-surface">1. Aceptación de los Términos</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    Al registrarse y utilizar los servicios de Essenza del Flusso Studio (en adelante, "el Estudio"),
                                    el usuario (en adelante, "el Usuario" o "el Cliente") acepta estos Términos y Condiciones.
                                    Si no está de acuerdo, deberá abstenerse de utilizar los servicios.
                                </p>
                            </section>

                            <section id="servicio" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">2. Descripción del Servicio</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    El Estudio ofrece clases de Pilates Reformer y otros servicios de acondicionamiento físico
                                    enfocados en el bienestar integral, impartidos por instructores calificados.
                                </p>
                            </section>

                            <section id="registro" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">3. Registro y Cuenta</h2>
                                <ul className="text-essenza-secondary leading-relaxed space-y-2 list-disc pl-5 marker:text-primary/60">
                                    <li>El Usuario deberá proporcionar información veraz y actualizada.</li>
                                    <li>Es responsable de su cuenta y contraseña.</li>
                                    <li>No se permite compartir cuentas.</li>
                                    <li>El Estudio podrá suspender cuentas por mal uso o incumplimiento.</li>
                                </ul>
                            </section>

                            <section id="reservas" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">4. Reservaciones y Cancelaciones</h2>
                                <ul className="text-essenza-secondary leading-relaxed space-y-2 list-disc pl-5 marker:text-primary/60">
                                    <li>Las clases se reservan con anticipación y están sujetas a disponibilidad.</li>
                                    <li>
                                        Cancelaciones:
                                        <ul className="mt-2 space-y-1 list-[circle] pl-5 marker:text-primary/50">
                                            <li>Clases antes de las 12:00 PM: mínimo 10 horas antes.</li>
                                            <li>Clases después de las 12:00 PM: mínimo 6 horas antes.</li>
                                        </ul>
                                    </li>
                                    <li>Cancelaciones fuera de tiempo o inasistencias implican la pérdida de la clase.</li>
                                    <li>Tolerancia máxima de llegada: 8 minutos.</li>
                                </ul>
                            </section>

                            <section id="pagos" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">5. Pagos y Vigencia</h2>
                                <ul className="text-essenza-secondary leading-relaxed space-y-2 list-disc pl-5 marker:text-primary/60">
                                    <li>Todos los servicios deben pagarse por adelantado.</li>
                                    <li>Los paquetes tienen vigencia y no son transferibles.</li>
                                    <li>No hay reembolsos, salvo casos excepcionales autorizados por el Estudio.</li>
                                </ul>
                            </section>

                            <section id="responsabilidad" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">6. Responsabilidad</h2>
                                <ul className="text-essenza-secondary leading-relaxed space-y-2 list-disc pl-5 marker:text-primary/60">
                                    <li>El Usuario asume los riesgos propios de la actividad física.</li>
                                    <li>Declara estar en condiciones de salud adecuadas.</li>
                                    <li>El Estudio no se hace responsable por objetos personales.</li>
                                </ul>
                            </section>

                            <section id="propiedad" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">7. Propiedad Intelectual</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    Todo el contenido del Estudio es propiedad de Essenza del Flusso Studio y no puede ser reproducido sin autorización.
                                </p>
                            </section>

                            <section id="modificaciones" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">8. Modificaciones</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    El Estudio puede actualizar estos términos en cualquier momento. El uso continuo implica aceptación de los cambios.
                                </p>
                            </section>

                            <section id="jurisdiccion" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">9. Jurisdicción</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    Estos términos se rigen por las leyes de México y cualquier controversia se resolverá en la Ciudad de México.
                                </p>
                            </section>

                            <section id="imagen" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">10. Uso de Imagen</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    El Usuario autoriza el uso de su imagen con fines promocionales únicamente con su consentimiento previo.
                                </p>
                            </section>

                            <section id="menores" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">11. Menores de Edad</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    Solo podrán asistir con autorización de padres o tutores.
                                </p>
                            </section>

                            <section id="fuerza-mayor" className="space-y-3">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">12. Fuerza Mayor</h2>
                                <p className="text-essenza-secondary leading-relaxed">
                                    El Estudio no será responsable por interrupciones causadas por factores externos.
                                </p>
                                <p className="text-essenza-secondary leading-relaxed pt-4 italic">
                                    Al reservar o asistir a una clase, el Usuario acepta estos términos y el reglamento interno.
                                </p>
                            </section>

                            {/* ═══ REGLAMENTO INTERNO ═══ */}
                            <section id="reglamento" className="space-y-6 pt-12 border-t border-essenza-outlineVariant/40">
                                <div className="space-y-2">
                                    <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary font-semibold">
                                        Normas del Studio
                                    </span>
                                    <h2 className="font-headline text-3xl md:text-4xl font-light">Reglamento Interno</h2>
                                </div>

                                <ReglamentoItem n="1" title="Puntualidad" items={[
                                    "Llegar 10 minutos antes de la clase.",
                                    "Tolerancia máxima: 8 minutos."
                                ]} />
                                <ReglamentoItem n="2" title="Reservas y Cancelaciones" items={[
                                    "Reservar con anticipación.",
                                    "Cancelaciones: 10 horas (matutino) / 6 horas (vespertino).",
                                    "Cancelaciones tardías se cobran como clase tomada."
                                ]} />
                                <ReglamentoItem n="3" title="Asistencia" items={[
                                    "Clases no asistidas no son reembolsables ni recuperables."
                                ]} />
                                <ReglamentoItem n="4" title="Pagos" items={[
                                    "Pago previo obligatorio.",
                                    "Paquetes con vigencia y no transferibles."
                                ]} />
                                <ReglamentoItem n="5" title="Salud y Seguridad" items={[
                                    "Informar lesiones o condiciones médicas.",
                                    "Evitar asistir enfermo.",
                                    "Limpiar el equipo después de usarlo."
                                ]} />
                                <ReglamentoItem n="6" title="Uso del Espacio" items={[
                                    "Respetar el espacio de otros alumnos.",
                                    "No usar el celular durante la clase (excepto emergencias).",
                                    "Guardar y limpiar el equipo al finalizar."
                                ]} />
                                <ReglamentoItem n="7" title="Vestimenta" items={[
                                    "Ropa deportiva cómoda.",
                                    "Uso obligatorio de calcetines.",
                                    "No se permite calzado deportivo en el equipo."
                                ]} />
                                <ReglamentoItem n="8" title="Conducta en Clase" items={[
                                    "Prohibido consumir alimentos.",
                                    "Mantener el celular en silencio.",
                                    "Seguir indicaciones del instructor."
                                ]} />
                                <ReglamentoItem n="9" title="Respeto y Comportamiento" items={[
                                    "Conducta respetuosa en todo momento.",
                                    "No se permite lenguaje ofensivo.",
                                    "El incumplimiento puede resultar en suspensión."
                                ]} />
                                <ReglamentoItem n="10" title="Responsabilidad del Alumno" items={[
                                    "Seguir instrucciones del instructor.",
                                    "Respetar sus propios límites físicos."
                                ]} />
                                <ReglamentoItem n="11" title="Derecho de Admisión" items={[
                                    "El Estudio podrá negar el acceso a quien incumpla las normas o afecte la seguridad del grupo."
                                ]} />
                                <ReglamentoItem n="12" title="Cambios de Instructor" items={[
                                    "El Estudio puede asignar instructores sustitutos sin previo aviso."
                                ]} />
                                <ReglamentoItem n="13" title="Modificaciones de Clases" items={[
                                    "El Estudio puede modificar horarios o cancelar clases por causas operativas o de fuerza mayor."
                                ]} />
                                <ReglamentoItem n="14" title="Objetos Personales" items={[
                                    "El Estudio no se hace responsable por pérdidas o robos."
                                ]} />
                                <ReglamentoItem n="15" title="Reembolsos" items={[
                                    "Solo aplican en casos excepcionales (ej. incapacidad médica comprobable)."
                                ]} />
                                <ReglamentoItem n="16" title="Incumplimiento" items={[
                                    "El Estudio podrá limitar el acceso o venta de paquetes a usuarios que incumplan el reglamento."
                                ]} />
                                <ReglamentoItem n="17" title="Modificaciones" items={[
                                    "El reglamento puede actualizarse en cualquier momento."
                                ]} />
                            </section>

                            <section id="contacto" className="space-y-4 pt-12 border-t border-essenza-outlineVariant/40">
                                <h2 className="font-headline text-2xl md:text-[1.75rem]">Domicilio del Studio</h2>
                                <div className="flex items-start gap-3 p-5 bg-primary/5 rounded-xl border border-primary/15">
                                    <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                    <p className="text-essenza-secondary leading-relaxed">
                                        C. de Orleans 51, piso 1,<br />
                                        Lomas Estrella 2da Secc, Iztapalapa,<br />
                                        09890 Ciudad de México, CDMX
                                    </p>
                                </div>
                            </section>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

function ReglamentoItem({ n, title, items }: { n: string; title: string; items: string[] }) {
    return (
        <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-headline text-sm font-semibold">
                {n}
            </div>
            <div className="flex-1 space-y-2 pt-1">
                <h3 className="font-headline text-lg text-on-surface">{title}</h3>
                <ul className="text-essenza-secondary leading-relaxed space-y-1.5 list-disc pl-5 marker:text-primary/60 text-sm">
                    {items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
