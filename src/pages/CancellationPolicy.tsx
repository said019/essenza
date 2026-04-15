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
                                Última actualización: 10 de febrero de 2026
                            </p>
                            <p className="text-muted-foreground leading-relaxed">
                                En Essenza del Flusso valoramos tu tiempo y el de nuestros instructores. Nuestra política 
                                de cancelación está diseñada para ser justa tanto para ti como para nuestra comunidad.
                            </p>
                        </div>

                        {/* Rules Cards */}
                        <div className="space-y-6">
                            <h2 className="font-heading text-2xl font-semibold">Reglas de Cancelación</h2>

                            {/* Rule 1: +5h + within limit */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-800">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Cancelación con +5 horas de anticipación
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Si cancelas con <strong>5 horas o más</strong> antes de que inicie la clase, 
                                        se te devolverá el crédito de la clase a tu plan. Esto aplica hasta un 
                                        máximo de <strong>2 cancelaciones con reembolso</strong> por plan.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 2: +5h but limit reached */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800">
                                <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Límite de cancelaciones alcanzado
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Si ya utilizaste tus <strong>2 cancelaciones con reembolso</strong>, 
                                        podrás seguir cancelando tu reserva pero <strong>no se devolverá el crédito</strong>, 
                                        aun si cancelas con más de 5 horas de anticipación.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 3: <5h */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-800">
                                <XCircle className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Cancelación con menos de 5 horas
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Si cancelas con <strong>menos de 5 horas</strong> antes de la clase, 
                                        la reserva se cancelará pero <strong>no se devolverá el crédito</strong>. 
                                        Te recomendamos planificar con tiempo.
                                    </p>
                                </div>
                            </div>

                            {/* Rule 4: No-show */}
                            <div className="flex items-start gap-4 p-5 rounded-xl border bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-800">
                                <Clock className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold text-base mb-1">
                                        Inasistencia (No-Show)
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        Si no te presentas a tu clase sin cancelar previamente, 
                                        <strong> se perderá el crédito</strong> de la clase y podrían aplicarse 
                                        penalizaciones adicionales.
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
                                                +5 horas y menos de 2 cancelaciones
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                                                    <CheckCircle2 className="w-4 h-4" /> Sí
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                +5 horas pero ya usó 2 cancelaciones
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                                                    <XCircle className="w-4 h-4" /> No
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                Menos de 5 horas de anticipación
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-red-500 font-medium">
                                                    <XCircle className="w-4 h-4" /> No
                                                </span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                No-show (inasistencia)
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
                                    <p className="text-sm font-medium">Essenza del Flusso</p>
                                    <p className="text-sm text-muted-foreground">
                                        Hermenegildo Galeana Int. Local 4, Centro, 76803 San Juan del Río, Qro.
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Email</p>
                                    <a
                                        href="mailto:hola@essenza-studio.com.mx"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        hola@essenza-studio.com.mx
                                    </a>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Teléfono / WhatsApp</p>
                                    <a
                                        href="tel:+525574034316"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        +52 55 7403 4316
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
