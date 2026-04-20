import { Link } from "react-router-dom";
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export default function CancellationPolicy() {
    return (
        <div className="min-h-screen bg-muted/20">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
                <div className="container mx-auto px-4 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver al inicio
                        </Link>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 lg:px-8 py-12">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-background rounded-lg border p-8 lg:p-12 space-y-10">
                        {/* Header */}
                        <div className="space-y-4 pb-8 border-b">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="w-8 h-8 text-primary" />
                                <h1 className="font-heading text-3xl lg:text-4xl font-bold">Política de Cancelación</h1>
                            </div>
                            <p className="text-muted-foreground">
                                Última actualización: 20 de abril de 2026
                            </p>
                            <p className="text-muted-foreground leading-relaxed">
                                En Essenza del Flusso valoramos tu tiempo y el de nuestros instructores. Nuestra política 
                                de cancelación está diseñada para ser justa tanto para ti como para nuestra comunidad.
                            </p>
                        </div>

                        {/* Rules Cards */}
                        <div className="space-y-6">
                            <h2 className="font-heading text-2xl font-semibold">Reglas de Cancelación</h2>

                            {/* Rule 1: AM classes — 10h */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-800">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Clases antes de las 12:00 PM
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Cancela con <strong>mínimo 10 horas</strong> de anticipación para que se te devuelva
                                        el crédito. Aplica hasta un máximo de <strong>2 cancelaciones con reembolso</strong> por plan.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 2: PM classes — 6h */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-800">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Clases desde las 12:00 PM
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Cancela con <strong>mínimo 6 horas</strong> de anticipación para reembolso del
                                        crédito. Sujeto al mismo límite de <strong>2 cancelaciones con reembolso</strong> por plan.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 3: limit reached */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800">
                                <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Límite de cancelaciones alcanzado
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Si ya utilizaste tus <strong>2 cancelaciones con reembolso</strong>,
                                        podrás seguir cancelando tu reserva pero <strong>no se devolverá el crédito</strong>,
                                        aun cumpliendo la ventana de anticipación.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 4: out of window / no-show */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-800">
                                <XCircle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Cancelación fuera de tiempo o inasistencia
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Cancelar fuera de la ventana (menos de 10 h en clases matutinas o menos de 6 h en
                                        vespertinas) o no presentarte = <strong>se pierde la clase</strong>. El crédito no se reembolsa.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 5: arrival tolerance */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800">
                                <Clock className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Tolerancia de llegada
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Máximo <strong>8 minutos</strong> después del inicio de la clase. Pasado ese tiempo,
                                        por seguridad y respeto al grupo, no se permite el ingreso y se contabiliza como
                                        inasistencia.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Summary Table */}
                        <div className="space-y-4">
                            <h2 className="font-heading text-2xl font-semibold">Resumen</h2>
                            <div className="overflow-hidden rounded-xl border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/50">
                                            <th className="text-left px-4 py-3 font-semibold">Situación</th>
                                            <th className="text-left px-4 py-3 font-semibold">¿Se devuelve crédito?</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                Clase AM cancelada con +10 h, dentro del límite
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                                    <CheckCircle2 className="w-4 h-4" /> Sí
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                Clase PM cancelada con +6 h, dentro del límite
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                                    <CheckCircle2 className="w-4 h-4" /> Sí
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                En tiempo pero ya usó 2 cancelaciones
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                                                    <XCircle className="w-4 h-4" /> No
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                Clase AM con menos de 10 h de anticipación
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                                                    <XCircle className="w-4 h-4" /> No
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                Clase PM con menos de 6 h de anticipación
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                                                    <XCircle className="w-4 h-4" /> No
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                No-show o llegar +8 min tarde
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                                                    <XCircle className="w-4 h-4" /> No
                                                </span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* FAQ */}
                        <div className="space-y-4">
                            <h2 className="font-heading text-2xl font-semibold">Preguntas Frecuentes</h2>
                            
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <h3 className="font-medium mb-2">¿Cómo sé cuántas cancelaciones me quedan?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Al momento de cancelar, el sistema te mostrará cuántas cancelaciones con reembolso 
                                        has usado y si se te devolverá el crédito antes de confirmar la cancelación.
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <h3 className="font-medium mb-2">¿El límite de cancelaciones se reinicia?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Sí, el conteo de cancelaciones se reinicia con cada nuevo plan o membresía que adquieras.
                                    </p>
                                </div>
                                <div className="p-4 rounded-lg bg-muted/30">
                                    <h3 className="font-medium mb-2">¿Puedo cancelar desde la app?</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Sí, puedes cancelar directamente desde la sección "Mis Clases" en tu cuenta. 
                                        El sistema te informará si aplica o no el reembolso antes de confirmar.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="space-y-4 pt-8 border-t">
                            <h2 className="font-heading text-2xl font-semibold">¿Necesitas ayuda?</h2>
                            <div className="bg-muted/50 p-6 rounded-lg space-y-3">
                                <div>
                                    <p className="text-sm font-medium">Essenza del Flusso Studio</p>
                                    <p className="text-sm text-muted-foreground">
                                        C. de Orleans 51, Piso 1, Lomas Estrella 2da Secc, Iztapalapa, 09890 CDMX
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Email</p>
                                    <a
                                        href="mailto:essenza.flusso@gmail.com"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        essenza.flusso@gmail.com
                                    </a>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">WhatsApp</p>
                                    <a
                                        href="https://wa.me/525574034312"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        55 7403 4312
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-8 border-t">
                            <p className="text-xs text-muted-foreground">
                                Esta política forma parte de nuestros{" "}
                                <Link to="/terms" className="text-primary hover:underline">
                                    Términos y Condiciones
                                </Link>
                                . Al reservar una clase, confirmas que has leído y aceptado esta política.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
