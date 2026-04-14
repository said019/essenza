/**
 * Essenza del Flusso - Cron Jobs Service
 *
 * Tareas programadas automáticas:
 * - Generación de clases recurrentes
 * - Solicitudes de reseñas post-clase
 * - Alertas de membresías por vencer
 * - Marcar membresías expiradas
 * - Limpieza de órdenes expiradas
 * - Marcar no-shows
 */

import cron from 'node-cron';
import { query, queryOne } from '../config/database.js';
import {
    notifyMembershipExpiring,
    sendCustomNotification
} from '../lib/notifications.js';
import {
    sendExpiringMembershipNotice,
} from '../lib/whatsapp.js';
import {
    reconcilePartnerInventory,
    renewTotalPassToken,
    reportWellhubDailySummary,
    syncPartnerAvailability,
} from '../lib/partners.js';

// ============================================
// TIPOS
// ============================================

interface CronJobStatus {
    name: string;
    lastRun: Date | null;
    nextRun: Date | null;
    isRunning: boolean;
    lastError: string | null;
}

const jobStatus: Record<string, CronJobStatus> = {};

// ============================================
// UTILIDADES
// ============================================

function logJob(jobName: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[CRON ${jobName}] ${timestamp} - ${message}`);
}

function logError(jobName: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(`[CRON ${jobName}] ${timestamp} - ERROR:`, error);
    jobStatus[jobName] = {
        ...jobStatus[jobName],
        lastError: String(error),
    };
}

async function recordJobExecution(jobName: string, success: boolean, details?: string): Promise<void> {
    try {
        await query(`
            INSERT INTO cron_job_logs (job_name, success, details, executed_at)
            VALUES ($1, $2, $3, NOW())
        `, [jobName, success, details || null]);
    } catch {
        // Silently fail if table doesn't exist
    }
}

// ============================================
// JOB 1: GENERAR CLASES RECURRENTES
// Ejecuta cada día a las 3:00 AM
// ============================================

async function generateRecurringClasses(): Promise<void> {
    const jobName = 'GENERATE_CLASSES';
    logJob(jobName, 'Iniciando generación de clases recurrentes...');

    try {
        // Obtener schedules activos
        const schedules = await query<{
            id: string;
            class_type_id: string;
            instructor_id: string;
            facility_id: string | null;
            day_of_week: number;
            start_time: string;
            end_time: string;
            max_capacity: number;
        }>(`
            SELECT s.*, ct.name as class_type_name
            FROM schedules s
            JOIN class_types ct ON s.class_type_id = ct.id
            WHERE s.is_active = true
        `);

        if (schedules.length === 0) {
            logJob(jobName, 'No hay schedules activos');
            return;
        }

        // Generar clases para los próximos 14 días
        const daysAhead = 14;
        let classesCreated = 0;
        let classesSkipped = 0;

        for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + dayOffset);
            const dayOfWeek = targetDate.getDay(); // 0 = Domingo

            const dateStr = targetDate.toISOString().split('T')[0];

            // Buscar schedules para este día
            const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeek);

            for (const schedule of daySchedules) {
                // Verificar si la clase ya existe
                const existing = await queryOne(`
                    SELECT id FROM classes
                    WHERE schedule_id = $1 AND date = $2
                `, [schedule.id, dateStr]);

                if (existing) {
                    classesSkipped++;
                    continue;
                }

                // Crear la clase
                await query(`
                    INSERT INTO classes (
                        schedule_id, class_type_id, instructor_id, facility_id,
                        date, start_time, end_time, max_capacity, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
                `, [
                    schedule.id,
                    schedule.class_type_id,
                    schedule.instructor_id,
                    schedule.facility_id,
                    dateStr,
                    schedule.start_time,
                    schedule.end_time,
                    schedule.max_capacity,
                ]);

                classesCreated++;
            }
        }

        logJob(jobName, `Completado: ${classesCreated} clases creadas, ${classesSkipped} ya existían`);
        await recordJobExecution(jobName, true, `Created: ${classesCreated}, Skipped: ${classesSkipped}`);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 2: SOLICITAR RESEÑAS (2H POST-CLASE)
// Ejecuta cada hora
// ============================================

async function requestReviews(): Promise<void> {
    const jobName = 'REQUEST_REVIEWS';
    logJob(jobName, 'Buscando clases completadas para solicitar reseñas...');

    try {
        // Buscar bookings de clases que terminaron hace ~2 horas sin reseña
        const bookings = await query<{
            booking_id: string;
            user_id: string;
            membership_id: string;
            class_type: string;
            instructor_name: string;
        }>(`
            SELECT
                b.id as booking_id,
                b.user_id,
                b.membership_id,
                ct.name as class_type,
                i.display_name as instructor_name
            FROM bookings b
            JOIN classes c ON b.class_id = c.id
            JOIN class_types ct ON c.class_type_id = ct.id
            JOIN instructors i ON c.instructor_id = i.id
            LEFT JOIN reviews r ON b.id = r.booking_id
            LEFT JOIN review_requests rr ON b.id = rr.booking_id
            WHERE b.status = 'checked_in'
            AND r.id IS NULL
            AND (rr.id IS NULL OR rr.status = 'pending')
            AND (c.date + c.end_time) BETWEEN (NOW() AT TIME ZONE 'America/Mexico_City') - INTERVAL '2.5 hours'
                                           AND (NOW() AT TIME ZONE 'America/Mexico_City') - INTERVAL '1.5 hours'
        `);

        if (bookings.length === 0) {
            logJob(jobName, 'No hay solicitudes de reseña pendientes');
            return;
        }

        let sent = 0;
        for (const booking of bookings) {
            try {
                if (booking.membership_id) {
                    await sendCustomNotification({
                        membershipId: booking.membership_id,
                        title: '⭐ ¿Cómo estuvo tu clase?',
                        message: `Cuéntanos tu experiencia en ${booking.class_type} y gana 50 puntos`,
                    });
                }

                // Actualizar review_request
                await query(`
                    UPDATE review_requests
                    SET status = 'sent', sent_at = NOW()
                    WHERE booking_id = $1
                `, [booking.booking_id]);

                sent++;
            } catch (err) {
                logError(jobName, `Error: ${err}`);
            }
        }

        logJob(jobName, `Enviadas ${sent}/${bookings.length} solicitudes de reseña`);
        await recordJobExecution(jobName, true, `Sent: ${sent}`);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 5: ALERTAS DE MEMBRESÍAS POR VENCER
// Ejecuta diario a las 10:00 AM
// ============================================

async function notifyExpiringMemberships(): Promise<void> {
    const jobName = 'EXPIRING_MEMBERSHIPS';
    logJob(jobName, 'Buscando membresías por vencer...');

    try {
        // Notificar membresías que vencen en 7 días, 3 días, y 1 día
        const daysToNotify = [7, 3, 1];

        for (const days of daysToNotify) {
            const memberships = await query<{
                id: string;
                user_id: string;
                plan_name: string;
                end_date: string;
                user_name: string;
                user_phone: string;
            }>(`
                SELECT
                    m.id,
                    m.user_id,
                    p.name as plan_name,
                    m.end_date,
                    u.display_name as user_name,
                    u.phone as user_phone
                FROM memberships m
                JOIN plans p ON m.plan_id = p.id
                JOIN users u ON m.user_id = u.id
                LEFT JOIN expiry_notifications en
                    ON m.id = en.membership_id AND en.days_before = $1
                WHERE m.status = 'active'
                AND en.id IS NULL
                AND m.end_date = CURRENT_DATE + $1
            `, [days]);

            for (const membership of memberships) {
                try {
                    await notifyMembershipExpiring(membership.id, days);

                    // Enviar WhatsApp
                    if (membership.user_phone) {
                        const endDateStr = String(membership.end_date).split('T')[0];
                        sendExpiringMembershipNotice(
                            membership.user_phone,
                            membership.user_name,
                            membership.plan_name,
                            days,
                            endDateStr
                        ).catch(err => logError(jobName, `WhatsApp error: ${err}`));
                    }

                    // Marcar como notificado
                    await query(`
                        INSERT INTO expiry_notifications (membership_id, days_before, sent_at)
                        VALUES ($1, $2, NOW())
                        ON CONFLICT (membership_id, days_before) DO NOTHING
                    `, [membership.id, days]);

                } catch (err) {
                    logError(jobName, `Error notificando ${membership.id}: ${err}`);
                }
            }

            if (memberships.length > 0) {
                logJob(jobName, `Notificadas ${memberships.length} membresías que vencen en ${days} días`);
            }
        }

        await recordJobExecution(jobName, true);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 6: MARCAR MEMBRESÍAS EXPIRADAS
// Ejecuta diario a las 00:05 AM
// ============================================

async function markExpiredMemberships(): Promise<void> {
    const jobName = 'MARK_EXPIRED';
    logJob(jobName, 'Marcando membresías expiradas...');

    try {
        const result = await query(`
            UPDATE memberships
            SET status = 'expired', updated_at = NOW()
            WHERE status = 'active'
            AND end_date < CURRENT_DATE
            RETURNING id
        `);

        const count = result.length;
        if (count > 0) {
            logJob(jobName, `${count} membresías marcadas como expiradas`);
        } else {
            logJob(jobName, 'No hay membresías para marcar');
        }

        await recordJobExecution(jobName, true, `Expired: ${count}`);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 7: LIMPIAR ÓRDENES EXPIRADAS
// Ejecuta cada 6 horas
// ============================================

async function cleanupExpiredOrders(): Promise<void> {
    const jobName = 'CLEANUP_ORDERS';
    logJob(jobName, 'Limpiando órdenes expiradas...');

    try {
        // Cancelar órdenes de transferencia sin pagar después de 48h
        const result = await query(`
            UPDATE orders
            SET status = 'expired', updated_at = NOW()
            WHERE status IN ('pending_payment', 'pending')
            AND payment_method = 'bank_transfer'
            AND created_at < NOW() - INTERVAL '48 hours'
            RETURNING id, order_number
        `);

        const count = result.length;
        if (count > 0) {
            logJob(jobName, `${count} órdenes expiradas`);
        } else {
            logJob(jobName, 'No hay órdenes para limpiar');
        }

        await recordJobExecution(jobName, true, `Expired: ${count}`);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 8: MARCAR NO-SHOWS
// Ejecuta cada 30 minutos
// ============================================

async function markNoShows(): Promise<void> {
    const jobName = 'MARK_NO_SHOWS';
    logJob(jobName, 'Marcando no-shows...');

    try {
        // Marcar como no-show bookings confirmados de clases que ya terminaron
        // Usar timezone de México para comparar correctamente
        const result = await query(`
            UPDATE bookings
            SET status = 'no_show', updated_at = NOW()
            WHERE status = 'confirmed'
            AND class_id IN (
                SELECT id FROM classes
                WHERE (date + end_time) < (NOW() AT TIME ZONE 'America/Mexico_City') - INTERVAL '30 minutes'
                AND status IN ('completed', 'scheduled')
            )
            RETURNING id
        `);

        const count = result.length;

        // Actualizar clases completadas
        // Usar timezone de México para no marcar clases futuras como completadas
        await query(`
            UPDATE classes
            SET status = 'completed', updated_at = NOW()
            WHERE status = 'scheduled'
            AND (date + end_time) < (NOW() AT TIME ZONE 'America/Mexico_City') - INTERVAL '15 minutes'
        `);

        if (count > 0) {
            logJob(jobName, `${count} bookings marcados como no-show`);
        }

        await recordJobExecution(jobName, true, `No-shows: ${count}`);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 9: EXPIRAR SOLICITUDES DE RESEÑA
// Ejecuta diario a las 2:00 AM
// ============================================

async function expireReviewRequests(): Promise<void> {
    const jobName = 'EXPIRE_REVIEWS';
    logJob(jobName, 'Expirando solicitudes de reseña antiguas...');

    try {
        const result = await query(`
            UPDATE review_requests
            SET status = 'expired', updated_at = NOW()
            WHERE status IN ('pending', 'sent')
            AND created_at < NOW() - INTERVAL '7 days'
            RETURNING id
        `);

        const count = result.length;
        if (count > 0) {
            logJob(jobName, `${count} solicitudes de reseña expiradas`);
        }

        await recordJobExecution(jobName, true, `Expired: ${count}`);

    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 10: RENOVAR TOKEN TOTALPASS
// Ejecuta diario cada 23 horas
// ============================================

async function refreshTotalPassTokenJob(): Promise<void> {
    const jobName = 'TOTALPASS_TOKEN';
    logJob(jobName, 'Renovando token de TotalPass...');

    try {
        await renewTotalPassToken();
        await recordJobExecution(jobName, true, 'Token renovado');
        logJob(jobName, 'Token renovado correctamente');
    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 11: RECONCILIAR INVENTARIO PARTNERS
// Ejecuta cada 5 minutos
// ============================================

async function reconcilePartnerInventoryJob(): Promise<void> {
    const jobName = 'PARTNER_INVENTORY';

    try {
        await reconcilePartnerInventory();
        await syncPartnerAvailability();
        await recordJobExecution(jobName, true, 'Inventario reconciliado');
    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// JOB 12: REPORTE DIARIO WELLHUB
// Ejecuta diario a las 11:40 PM
// ============================================

async function reportWellhubDailySummaryJob(): Promise<void> {
    const jobName = 'WELLHUB_DAILY';

    try {
        await reportWellhubDailySummary();
        await recordJobExecution(jobName, true, 'Resumen Wellhub enviado');
    } catch (error) {
        logError(jobName, error);
        await recordJobExecution(jobName, false, String(error));
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

export function initializeCronJobs(): void {
    console.log('\n⏰ Inicializando Cron Jobs...\n');

    // Crear tabla de logs si no existe
    query(`
        CREATE TABLE IF NOT EXISTS cron_job_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            job_name VARCHAR(100) NOT NULL,
            success BOOLEAN NOT NULL,
            details TEXT,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS booking_reminders (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            reminder_type VARCHAR(20) NOT NULL,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(booking_id, reminder_type)
        );

        CREATE TABLE IF NOT EXISTS expiry_notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
            days_before INTEGER NOT NULL,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(membership_id, days_before)
        );
    `).catch(() => {
        // Tables might already exist
    });

    // ============================================
    // SCHEDULE DE JOBS
    // ============================================

    // 3:00 AM - Generar clases recurrentes (cada día)
    cron.schedule('0 3 * * *', generateRecurringClasses, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ GENERATE_CLASSES - Diario 3:00 AM');

    // Cada hora (:30) - Solicitar reseñas
    cron.schedule('30 * * * *', requestReviews, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ REQUEST_REVIEWS - Cada hora');

    // 10:00 AM - Alertas de membresías por vencer
    cron.schedule('0 10 * * *', notifyExpiringMemberships, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ EXPIRING_MEMBERSHIPS - Diario 10:00 AM');

    // 00:05 AM - Marcar membresías expiradas
    cron.schedule('5 0 * * *', markExpiredMemberships, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ MARK_EXPIRED - Diario 00:05 AM');

    // Cada 6 horas - Limpiar órdenes expiradas
    cron.schedule('0 */6 * * *', cleanupExpiredOrders, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ CLEANUP_ORDERS - Cada 6 horas');

    // Cada 30 min - Marcar no-shows y completar clases
    cron.schedule('5,35 * * * *', markNoShows, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ MARK_NO_SHOWS - Cada 30 min');

    // 2:00 AM - Expirar solicitudes de reseña
    cron.schedule('0 2 * * *', expireReviewRequests, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ EXPIRE_REVIEWS - Diario 2:00 AM');

    // Diario - renovar token TotalPass antes de su expiración operativa
    cron.schedule('15 0 * * *', refreshTotalPassTokenJob, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ TOTALPASS_TOKEN - Diario 12:15 AM');

    // Cada 5 minutos - reconciliar inventario de partners
    cron.schedule('*/5 * * * *', reconcilePartnerInventoryJob, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ PARTNER_INVENTORY - Cada 5 minutos');

    // 11:40 PM - resumen diario Wellhub
    cron.schedule('40 23 * * *', reportWellhubDailySummaryJob, {
        timezone: 'America/Mexico_City',
    });
    console.log('  ✅ WELLHUB_DAILY - Diario 11:40 PM');

    console.log('\n⏰ Cron Jobs inicializados correctamente\n');
}

// ============================================
// EXPORTAR FUNCIONES PARA EJECUCIÓN MANUAL
// ============================================

export const cronJobs = {
    generateRecurringClasses,
    requestReviews,
    notifyExpiringMemberships,
    markExpiredMemberships,
    cleanupExpiredOrders,
    markNoShows,
    expireReviewRequests,
    refreshTotalPassTokenJob,
    reconcilePartnerInventoryJob,
    reportWellhubDailySummaryJob,
};

export default initializeCronJobs;
