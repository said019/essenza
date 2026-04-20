/**
 * Política de cancelación — Essenza del Flusso
 *
 * - Clases antes de las 12:00 PM: mínimo 10 horas de anticipación.
 * - Clases a las 12:00 PM o después: mínimo 6 horas de anticipación.
 * - Fuera de la ventana = sin reembolso de crédito (se pierde la clase).
 */

export const AM_CUTOFF_HOUR = 12;
export const WINDOW_AM = 10;
export const WINDOW_PM = 6;

/**
 * Devuelve la ventana de cancelación en horas (10 o 6) según la hora de inicio
 * de la clase. Acepta "HH:MM" o "HH:MM:SS".
 */
export function cancellationWindowHours(classStartTime: string): number {
    const hour = parseInt(classStartTime.slice(0, 2), 10);
    return hour < AM_CUTOFF_HOUR ? WINDOW_AM : WINDOW_PM;
}

/**
 * Evalúa si una cancelación está dentro de la ventana permitida.
 *
 * @param classDateYmd  Fecha de la clase YYYY-MM-DD (hora local México)
 * @param classStartHm  Hora de inicio HH:MM (hora local México)
 * @param now           Instante de referencia (default: Date.now())
 */
export function evaluateCancellation(
    classDateYmd: string,
    classStartHm: string,
    now: Date = new Date()
): {
    requiredHours: number;
    hoursUntilClass: number;
    isWithinWindow: boolean;
} {
    const timeStr = classStartHm.substring(0, 5);
    // DB almacena hora local CDMX; ancla con offset -06:00
    const classDateTime = new Date(`${classDateYmd}T${timeStr}:00-06:00`);
    const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const requiredHours = cancellationWindowHours(classStartHm);
    return {
        requiredHours,
        hoursUntilClass,
        isWithinWindow: hoursUntilClass >= requiredHours,
    };
}

/** Tolerancia de llegada: 8 minutos después del inicio. */
export const ARRIVAL_TOLERANCE_MINUTES = 8;
