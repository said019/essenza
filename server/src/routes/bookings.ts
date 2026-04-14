import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { sendBookingConfirmation, sendCancellationNotice, sendWhatsAppMessage } from '../lib/whatsapp.js';
import { notifyAllUserDevices } from '../lib/apple-wallet.js';
import { upsertGoogleLoyaltyObject } from '../lib/google-wallet.js';
import { syncPartnerAvailability } from '../lib/partners.js';

const router = Router();

// Schema for Creating Booking
const CreateBookingSchema = z.object({
    classId: z.string().uuid(),
    membershipId: z.string().uuid().optional(), // Optional, if not provided we auto-select
});

// ============================================
// GET /api/bookings - List bookings (Admin)
// ============================================
router.get('/', authenticate, requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
    try {
        const { status, search, startDate, endDate } = req.query;

        let queryStr = `
      SELECT 
        b.id as booking_id,
        b.status as booking_status,
        b.created_at,
        b.checked_in_at,
        b.waitlist_position,
        u.id as user_id,
        u.display_name as user_name,
        u.email as user_email,
        u.phone as user_phone,
        c.id as class_id,
        c.date as class_date,
        c.start_time as class_start_time,
        c.end_time as class_end_time,
        ct.name as class_name,
        i.display_name as instructor_name,
        m.id as membership_id,
        p.name as plan_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN instructors i ON c.instructor_id = i.id
      LEFT JOIN memberships m ON b.membership_id = m.id
      LEFT JOIN plans p ON m.plan_id = p.id
      WHERE 1=1
    `;

        const params: any[] = [];
        let paramCount = 1;

        if (status) {
            queryStr += ` AND b.status = $${paramCount++}`;
            params.push(status);
        }

        if (search) {
            queryStr += ` AND (
        u.display_name ILIKE $${paramCount} OR 
        u.email ILIKE $${paramCount} OR 
        ct.name ILIKE $${paramCount}
      )`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (startDate) {
            queryStr += ` AND c.date >= $${paramCount++}`;
            params.push(startDate);
        }

        if (endDate) {
            queryStr += ` AND c.date <= $${paramCount++}`;
            params.push(endDate);
        }

        queryStr += ` ORDER BY c.date DESC, c.start_time DESC`;

        const bookings = await query(queryStr, params);
        const formattedBookings = bookings.map((b: any) => ({
            ...b,
            class_date: b.class_date instanceof Date ? b.class_date.toISOString().split('T')[0] : b.class_date
        }));
        res.json(formattedBookings);
    } catch (error) {
        console.error('List bookings error:', error);
        res.status(500).json({ error: 'Error al listar reservas' });
    }
});

// Schema for Bulk Booking (Monthly) — Admin only
const BulkBookingSchema = z.object({
    scheduleId: z.string().uuid(),
    userId: z.string().uuid(),
    month: z.number().min(0).max(11),
    year: z.number().min(2024),
    membershipId: z.string().uuid().optional(),
    selectedDates: z.array(z.string()).optional(), // ISO date strings the admin picked
});

// ============================================
// POST /api/bookings/bulk-month - Create multiple bookings for a month (Admin)
// Allows admin to pick specific dates via selectedDates[]
// ============================================
router.post('/bulk-month', authenticate, requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
    try {
        const validation = BulkBookingSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: validation.error.flatten().fieldErrors });
        }

        const { scheduleId, userId, month, year, membershipId, selectedDates } = validation.data;

        const now = new Date();
        const startOfMonthDate = new Date(year, month, 1);
        const endOfMonthDate = new Date(year, month + 1, 0);

        let effectiveStart = startOfMonthDate;
        if (now.getMonth() === month && now.getFullYear() === year) {
            effectiveStart = now;
        } else if (endOfMonthDate < now) {
            return res.status(400).json({ error: 'El mes seleccionado ya ha pasado.' });
        } else if (startOfMonthDate < now) {
            effectiveStart = now;
        }

        const startDateStr = effectiveStart.toISOString().split('T')[0];
        const endDateStr = endOfMonthDate.toISOString().split('T')[0];

        // Find all classes for this schedule in range
        let classesToBook = await query(
            `SELECT c.* FROM classes c
             WHERE c.schedule_id = $1 
             AND c.date >= $2 AND c.date <= $3
             AND c.status = 'scheduled'
             AND c.current_bookings < c.max_capacity
             ORDER BY c.date ASC`,
            [scheduleId, startDateStr, endDateStr]
        );

        if (classesToBook.length === 0) {
            return res.status(404).json({ error: 'No se encontraron clases programadas para este horario en el mes seleccionado.' });
        }

        // If admin sent specific dates, filter to only those
        if (selectedDates && selectedDates.length > 0) {
            const selectedSet = new Set(selectedDates.map(d => d.split('T')[0]));
            classesToBook = classesToBook.filter((c: any) => {
                const cDate = c.date instanceof Date
                    ? c.date.toISOString().split('T')[0]
                    : String(c.date).split('T')[0];
                return selectedSet.has(cDate);
            });

            if (classesToBook.length === 0) {
                return res.status(400).json({ error: 'Ninguna de las fechas seleccionadas tiene clases disponibles.' });
            }
        }

        // Remove already-booked classes
        const existingBookings = await query(
            `SELECT class_id FROM bookings 
             WHERE user_id = $1 AND status != 'cancelled'
             AND class_id IN (${classesToBook.map((_: any, i: number) => `$${i + 2}`).join(',')})`,
            [userId, ...classesToBook.map((c: any) => c.id)]
        );

        const existingClassIds = new Set(existingBookings.map((b: any) => b.class_id));
        const targetClasses = classesToBook.filter((c: any) => !existingClassIds.has(c.id));

        if (targetClasses.length === 0) {
            return res.status(400).json({ error: 'El usuario ya tiene reservas para todas las clases seleccionadas.' });
        }

        // Find/validate membership
        let targetMembershipId = membershipId;
        let membership;

        if (!targetMembershipId) {
            const activeMemberships = await query(
                `SELECT * FROM memberships 
                 WHERE user_id = $1 AND status = 'active' 
                 AND (end_date >= $2 OR end_date IS NULL)
                 AND (classes_remaining >= $3 OR classes_remaining IS NULL)
                 ORDER BY end_date ASC LIMIT 1`,
                [userId, endDateStr, targetClasses.length]
            );

            if (activeMemberships.length > 0) {
                targetMembershipId = activeMemberships[0].id;
                membership = activeMemberships[0];
            }
        } else {
            membership = await queryOne(`SELECT * FROM memberships WHERE id = $1`, [targetMembershipId]);
        }

        if (!membership) {
            return res.status(400).json({ error: 'No se encontró una membresía válida con suficientes créditos para las clases seleccionadas.' });
        }

        if (membership.classes_remaining !== null && membership.classes_remaining < targetClasses.length) {
            return res.status(400).json({
                error: `Membresía insuficiente. Se requieren ${targetClasses.length} créditos, tiene ${membership.classes_remaining}.`
            });
        }

        // Deduct credits
        if (membership.classes_remaining !== null) {
            await query(
                `UPDATE memberships SET classes_remaining = classes_remaining - $1 WHERE id = $2`,
                [targetClasses.length, membership.id]
            );
        }

        // Create bookings
        const results = [];
        for (const cls of targetClasses) {
            const newBooking = await queryOne(
                `INSERT INTO bookings (class_id, user_id, membership_id, status)
                 VALUES ($1, $2, $3, 'confirmed') RETURNING id`,
                [cls.id, userId, membership.id]
            );
            results.push(newBooking);
        }

        res.json({
            success: true,
            bookedCount: results.length,
            message: `Se han agendado ${results.length} clase${results.length !== 1 ? 's' : ''} exitosamente.`
        });

    } catch (error) {
        console.error('Bulk booking error:', error);
        res.status(500).json({ error: 'Error al procesar reserva masiva' });
    }
});

// ============================================
// POST /api/bookings - Create a booking
// ============================================
router.post('/', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const validation = CreateBookingSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: validation.error.flatten().fieldErrors });
        }

        const { classId } = validation.data;
        let { membershipId } = validation.data;

        // 1. Get Class Details (check capacity)
        const classDetails = await queryOne(
            `SELECT * FROM classes WHERE id = $1`, [classId]
        );

        if (!classDetails) return res.status(404).json({ error: 'Clase no encontrada' });
        if (classDetails.status !== 'scheduled') return res.status(400).json({ error: 'Esta clase no esta disponible' });
        if (classDetails.current_bookings >= classDetails.max_capacity) {
            return res.status(400).json({ error: 'Clase llena' });
        }

        // Check if studio is closed on this date
        const classDateStr = classDetails.date instanceof Date
            ? classDetails.date.toISOString().split('T')[0]
            : String(classDetails.date).split('T')[0];
        const closedDay = await queryOne(
            `SELECT id, reason FROM studio_closed_days WHERE date = $1`,
            [classDateStr]
        );
        if (closedDay) {
            return res.status(400).json({
                error: `El estudio está cerrado este día: ${closedDay.reason || 'Día inhábil'}`
            });
        }

        // Check if class is in the past
        const now = new Date();
        // Format date properly - classDetails.date might be a Date object or string
        let dateStr: string;
        if (classDetails.date instanceof Date) {
            // Get local date parts to avoid UTC shift
            const d = classDetails.date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
        } else {
            // If it's already a string, take the date part
            dateStr = String(classDetails.date).split('T')[0];
        }

        const timeStr = classDetails.start_time.substring(0, 5); // HH:MM

        // Create class datetime in Mexico timezone (UTC-6)
        // The class time is stored in local Mexico time, so we need to compare properly
        // We construct an ISO string with the offset to ensure precise comparison
        const classDateTime = new Date(`${dateStr}T${timeStr}:00-06:00`);

        // Debug log
        console.log('Booking time check:', {
            now: now.toISOString(),
            classDate: dateStr,
            classTime: timeStr,
            classDateTime: classDateTime.toISOString(),
            isPast: classDateTime < now
        });

        if (isNaN(classDateTime.getTime())) {
            console.error('Invalid class date generated', { dateStr, timeStr });
            return res.status(500).json({ error: 'Error interno: Fecha de clase inválida' });
        }

        // Allow booking up to 10 minutes after class start time
        const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes
        const cutoffTime = new Date(classDateTime.getTime() + GRACE_PERIOD_MS);

        if (now > cutoffTime) {
            return res.status(400).json({
                error: `No puedes reservar esta clase, el tiempo límite para reservar ya pasó.`
            });
        }

        // 2. Check for existing booking
        const existing = await queryOne(
            `SELECT id FROM bookings WHERE class_id = $1 AND user_id = $2 AND status != 'cancelled'`,
            [classId, userId]
        );
        if (existing) return res.status(400).json({ error: 'Ya tienes una reserva para esta clase' });

        if (!membershipId) {
            // Auto-select: Active, has remaining classes (or null=unlimited), not expired
            // We use the Mexico City date for comparison to avoid timezone shifts
            const activeMemberships = await query(
                `SELECT * FROM memberships 
                 WHERE user_id = $1 
                 AND status = 'active' 
                 AND (end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::date OR end_date IS NULL)
                 AND (classes_remaining > 0 OR classes_remaining IS NULL)
                 ORDER BY end_date ASC 
                 LIMIT 1`,
                [userId]
            );

            if (activeMemberships.length === 0) {
                console.log('No active class pack found for user:', userId);
                return res.status(403).json({ error: 'No tienes créditos disponibles. Compra un pack de clases para reservar.' });
            }
            membershipId = activeMemberships[0].id;
        } else {
            // Validate provided membership
            const membership = await queryOne(
                `SELECT * FROM memberships WHERE id = $1 AND user_id = $2`,
                [membershipId, userId]
            );
            if (!membership) return res.status(403).json({ error: 'Membresía inválida' });
            if (membership.status !== 'active') return res.status(403).json({ error: 'Membresía no activa' });
            if (membership.classes_remaining !== null && membership.classes_remaining <= 0) {
                return res.status(403).json({ error: 'Sin créditos disponibles en esta membresía' });
            }
        }

        // 4. Create Booking & Deduct Credit (Transaction ideally)
        // We update membership first
        const membership = await queryOne(`SELECT classes_remaining FROM memberships WHERE id = $1`, [membershipId]);

        if (membership.classes_remaining !== null) {
            await query(
                `UPDATE memberships SET classes_remaining = classes_remaining - 1 WHERE id = $1`,
                [membershipId]
            );
        }

        // Insert booking
        const newBooking = await queryOne(
            `INSERT INTO bookings (class_id, user_id, membership_id, status)
         VALUES ($1, $2, $3, 'confirmed')
         RETURNING *`,
            [classId, userId, membershipId]
        );

        // Note: trigger_update_booking_count updates the classes table count automatically.

        // Send WhatsApp confirmation (async, don't block response)
        try {
            const notifSettings = await queryOne(
                "SELECT value FROM settings WHERE key = 'notification_settings'"
            );
            const shouldSend = notifSettings?.value?.send_booking_confirmation !== false;

            if (shouldSend) {
                const user = await queryOne('SELECT display_name, phone FROM users WHERE id = $1', [userId]);
                const classInfo = await queryOne(`
                    SELECT ct.name as class_name, c.date, c.start_time,
                           i.display_name as instructor_name
                    FROM classes c
                    JOIN class_types ct ON c.class_type_id = ct.id
                    JOIN instructors i ON c.instructor_id = i.id
                    WHERE c.id = $1
                `, [classId]);

                if (user?.phone && classInfo) {
                    const classDate = classInfo.date instanceof Date
                        ? classInfo.date.toLocaleDateString('es-MX')
                        : String(classInfo.date).split('T')[0];
                    const classTime = classInfo.start_time?.substring(0, 5);

                    sendBookingConfirmation(
                        user.phone,
                        user.display_name,
                        classInfo.class_name,
                        classDate,
                        classTime
                    ).catch(err => console.error('[WhatsApp] Error sending booking confirmation:', err));
                }
            }
        } catch (waErr) {
            console.error('[WhatsApp] Non-blocking error:', waErr);
        }

        // Update Apple + Google Wallet passes (credits changed)
        notifyAllUserDevices(userId, '✅ Reserva confirmada', 'Tu pase se actualizó con tu nueva reserva')
            .catch(e => console.error('Apple Wallet booking notify error:', e));
        if (membershipId) {
            upsertGoogleLoyaltyObject(membershipId).catch(e => console.error('Google Wallet booking error:', e));
        }

        res.status(201).json(newBooking);

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'Error al procesar reserva' });
    }
});

// ============================================
// GET /api/bookings/my-bookings - List user's bookings
// ============================================
router.get('/my-bookings', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    try {
        const bookings = await query(
            `SELECT * FROM user_bookings_view WHERE user_id = $1`,
            [userId]
        );

        const formattedBookings = bookings.map((b: any) => ({
            ...b,
            class_date: b.class_date instanceof Date ? b.class_date.toISOString().split('T')[0] : b.class_date,
            date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date // Handle potential alias
        }));

        res.json(formattedBookings);
    } catch (error) {
        console.error('My bookings error:', error);
        res.status(500).json({ error: 'Error al obtener reservas' });
    }
});

// ============================================
// GET /api/bookings/:id - Booking detail
// ============================================
router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'instructor';

        const booking = await queryOne(
            `SELECT 
        b.id as booking_id,
        b.status as booking_status,
        b.created_at,
        b.checked_in_at,
        b.waitlist_position,
        b.membership_id,
        u.id as user_id,
        u.display_name as user_name,
        u.email as user_email,
        c.id as class_id,
        c.date as class_date,
        c.start_time as class_start_time,
        c.end_time as class_end_time,
        ct.name as class_name,
        ct.color as class_type_color,
        i.display_name as instructor_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN instructors i ON c.instructor_id = i.id
      WHERE b.id = $1`,
            [id]
        );

        if (!booking) {
            return res.status(404).json({ error: 'Reserva no encontrada' });
        }

        if (!isAdmin && booking.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Strip sensitive fields for non-admin users
        const response: any = {
            ...booking,
            class_date: booking.class_date instanceof Date ? booking.class_date.toISOString().split('T')[0] : booking.class_date
        };
        if (!isAdmin) {
            delete response.user_email;
        }

        res.json(response);
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ error: 'Error al obtener reserva' });
    }
});

// ============================================
// GET /api/bookings/:id/cancel-preview - Preview cancellation outcome
// ============================================
router.get('/:id/cancel-preview', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const bookingId = req.params.id;

    try {
        const booking = await queryOne(
            `SELECT * FROM bookings WHERE id = $1`,
            [bookingId]
        );

        if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

        const isAdmin = req.user?.role === 'admin';
        if (!isAdmin && booking.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ error: 'La reserva ya estaba cancelada' });
        }

        const classInfo = await queryOne(
            `SELECT date, start_time FROM classes WHERE id = $1`,
            [booking.class_id]
        );

        const now = new Date();
        const dateStr = classInfo.date instanceof Date
            ? classInfo.date.toISOString().split('T')[0]
            : classInfo.date;
        const timeStr = classInfo.start_time.substring(0, 5);
        // DB stores local Mexico City times, append offset
        const classDateTime = new Date(`${dateStr}T${timeStr}:00-06:00`);
        const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        const CANCELLATION_WINDOW_HOURS = 5;
        const isWithinWindow = hoursUntilClass >= CANCELLATION_WINDOW_HOURS;

        let willRefund = false;
        let cancellationsUsed = 0;
        let cancellationLimit = 2;
        let reason = '';

        if (isAdmin) {
            willRefund = true;
            reason = 'Admin siempre obtiene reembolso';
        } else if (!isWithinWindow) {
            willRefund = false;
            reason = `Faltan menos de ${CANCELLATION_WINDOW_HOURS} horas para la clase. No se reembolsará el crédito.`;
        } else if (booking.membership_id) {
            const membership = await queryOne(
                `SELECT cancellations_used, cancellation_limit FROM memberships WHERE id = $1`,
                [booking.membership_id]
            );
            if (membership) {
                cancellationsUsed = membership.cancellations_used || 0;
                cancellationLimit = membership.cancellation_limit || 2;
                if (cancellationsUsed < cancellationLimit) {
                    willRefund = true;
                    reason = 'Se reembolsará tu crédito.';
                } else {
                    willRefund = false;
                    reason = `Ya usaste tus ${cancellationLimit} cancelaciones con reembolso. No se reembolsará el crédito.`;
                }
            } else {
                willRefund = true;
                reason = 'Se reembolsará tu crédito.';
            }
        } else {
            willRefund = true;
            reason = 'Se reembolsará tu crédito.';
        }

        res.json({
            willRefund,
            hoursUntilClass: Math.round(hoursUntilClass * 10) / 10,
            cancellationsUsed,
            cancellationLimit,
            isWithinWindow,
            reason,
        });
    } catch (error) {
        console.error('Cancel preview error:', error);
        res.status(500).json({ error: 'Error al obtener vista previa de cancelación' });
    }
});

// ============================================
// POST /api/bookings/:id/cancel - Cancel booking
// ============================================
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const bookingId = req.params.id;

    try {
        const booking = await queryOne(
            `SELECT * FROM bookings WHERE id = $1`,
            [bookingId]
        );

        if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

        // Admin can cancel any, User can only cancel own
        const isAdmin = req.user?.role === 'admin';
        if (!isAdmin && booking.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ error: 'La reserva ya estaba cancelada' });
        }

        // Get class info to check cancellation window
        const classInfo = await queryOne(
            `SELECT date, start_time FROM classes WHERE id = $1`,
            [booking.class_id]
        );

        // Logic for refunding credit - check cancellation policy time window
        // Use Mexico City time for comparison since DB stores local times
        const now = new Date();
        const dateStr = classInfo.date instanceof Date
            ? classInfo.date.toISOString().split('T')[0]
            : classInfo.date;
        const timeStr = classInfo.start_time.substring(0, 5);

        // Construct class datetime in Mexico City timezone
        // DB stores local Mexico City times, so we append the offset
        const classDateTime = new Date(`${dateStr}T${timeStr}:00-06:00`);

        // Calculate hours until class
        const hoursUntilClass = (classDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        // Cancellation policy: 5 hours minimum notice
        const CANCELLATION_WINDOW_HOURS = 5;
        const isWithinWindow = hoursUntilClass >= CANCELLATION_WINDOW_HOURS;

        // Note: We allow cancellation even outside the window, but without refund

        let shouldRefund = false;
        let refundReason = '';
        let cancellationsUsed = 0;
        let cancellationLimit = 2; // Default

        if (isAdmin) {
            shouldRefund = true;
            refundReason = 'Cancelada por admin';
            // Admin cancel always refunds the credit
            if (booking.membership_id) {
                const membership = await queryOne(
                    `SELECT classes_remaining FROM memberships WHERE id = $1`,
                    [booking.membership_id]
                );
                if (membership && membership.classes_remaining !== null) {
                    await query(
                        `UPDATE memberships SET classes_remaining = classes_remaining + 1 WHERE id = $1`,
                        [booking.membership_id]
                    );
                }
            }
        } else {
            if (isWithinWindow) {
                // Check cancellation limits if it's a membership booking
                if (booking.membership_id) {
                    const membership = await queryOne(
                        `SELECT id, cancellations_used, cancellation_limit, classes_remaining 
                         FROM memberships WHERE id = $1`,
                        [booking.membership_id]
                    );

                    if (membership) {
                        cancellationsUsed = membership.cancellations_used || 0;
                        cancellationLimit = membership.cancellation_limit || 2;

                        // We check if it's a reposicion? (Not implemented in schema yet, assumed normal)

                        if (cancellationsUsed < cancellationLimit) {
                            shouldRefund = true;
                            // Increment cancellation usage
                            await query(
                                `UPDATE memberships 
                                 SET cancellations_used = cancellations_used + 1 
                                 WHERE id = $1`,
                                [booking.membership_id]
                            );
                            // Also refund the credit
                            if (membership.classes_remaining !== null) {
                                await query(
                                    `UPDATE memberships 
                                     SET classes_remaining = classes_remaining + 1 
                                     WHERE id = $1`,
                                    [booking.membership_id]
                                );
                            }
                        } else {
                            shouldRefund = false;
                            refundReason = `Límite de cancelaciones alcanzado (${cancellationLimit})`;
                        }
                    } else {
                        // Should not happen if constraint exists
                        shouldRefund = true;
                    }
                } else {
                    // No membership? Maybe pay-as-you-go. Refund enabled.
                    shouldRefund = true;
                }
            } else {
                shouldRefund = false;
                refundReason = `Fuera de tiempo (menos de ${CANCELLATION_WINDOW_HOURS}h)`;
            }
        }

        const cancelled = await queryOne(
            `UPDATE bookings
             SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1
             WHERE id = $2 RETURNING *`,
            [isAdmin ? 'Cancelada por admin' : (refundReason || 'Cancelada por usuario'), bookingId]
        );

        if (booking.channel === 'wellhub' || booking.channel === 'totalpass') {
            await query(
                `UPDATE checkins
                 SET status = CASE WHEN status = 'confirmed' THEN status ELSE 'cancelled' END,
                     cancelled_at = NOW(),
                     updated_at = NOW()
                 WHERE booking_id = $1
                   AND status IN ('pending', 'failed')`,
                [bookingId]
            );
        }

        if (booking.channel === 'wellhub' || booking.channel === 'totalpass') {
            syncPartnerAvailability(booking.class_id).catch((error) => {
                console.error('[Partners] Error syncing availability after cancellation:', error);
            });
        }

        // Decrement current_bookings on the class
        await query(
            `UPDATE classes SET current_bookings = GREATEST(current_bookings - 1, 0) WHERE id = $1`,
            [booking.class_id]
        );

        const updatedMembership = booking.membership_id ? await queryOne(`SELECT cancellations_used FROM memberships WHERE id=$1`, [booking.membership_id]) : null;

        // Promote next person from waitlist
        let promotedUser: { display_name: string; phone: string } | null = null;
        try {
            const nextInWaitlist = await queryOne<{
                id: string; user_id: string; membership_id: string | null;
            }>(`
                SELECT id, user_id, membership_id FROM bookings
                WHERE class_id = $1 AND status = 'waitlist'
                ORDER BY waitlist_position ASC, created_at ASC
                LIMIT 1
            `, [booking.class_id]);

            if (nextInWaitlist) {
                // Promote to confirmed
                await query(
                    `UPDATE bookings SET status = 'confirmed', waitlist_position = NULL, updated_at = NOW()
                     WHERE id = $1`,
                    [nextInWaitlist.id]
                );

                // Increment current_bookings back (was decremented above)
                await query(
                    `UPDATE classes SET current_bookings = current_bookings + 1 WHERE id = $1`,
                    [booking.class_id]
                );

                // Deduct credit from membership
                if (nextInWaitlist.membership_id) {
                    await query(
                        `UPDATE memberships SET classes_remaining = GREATEST(classes_remaining - 1, 0)
                         WHERE id = $1 AND classes_remaining IS NOT NULL AND classes_remaining > 0`,
                        [nextInWaitlist.membership_id]
                    );
                }

                // Get user info for notification
                promotedUser = await queryOne<{ display_name: string; phone: string }>(
                    `SELECT display_name, phone FROM users WHERE id = $1`,
                    [nextInWaitlist.user_id]
                );

                // Notify promoted user
                if (promotedUser?.phone) {
                    const classDetail = await queryOne<{ class_name: string; date: string; start_time: string }>(
                        `SELECT ct.name as class_name, c.date::text, c.start_time::text
                         FROM classes c JOIN class_types ct ON c.class_type_id = ct.id
                         WHERE c.id = $1`,
                        [booking.class_id]
                    );
                    if (classDetail) {
                        const msg = `🎉 *¡Lugar confirmado!*\n\n` +
                            `Hola ${promotedUser.display_name}!\n\n` +
                            `Se liberó un lugar y tu reserva fue confirmada:\n\n` +
                            `📍 *${classDetail.class_name}*\n` +
                            `📅 ${classDetail.date}\n` +
                            `⏰ ${classDetail.start_time.substring(0, 5)}\n\n` +
                            `¡Te esperamos! 🧘✨`;
                        sendWhatsAppMessage(promotedUser.phone, msg)
                            .catch(err => console.error('[WhatsApp] Waitlist promotion error:', err));
                    }
                }

                // Update wallet pass for promoted user
                if (nextInWaitlist.membership_id) {
                    notifyAllUserDevices(nextInWaitlist.user_id, '🎉 ¡Lugar confirmado!', 'Tu reserva en lista de espera fue confirmada.')
                        .catch(e => console.error('Waitlist Apple notify error:', e));
                    upsertGoogleLoyaltyObject(nextInWaitlist.membership_id)
                        .catch(e => console.error('Waitlist Google notify error:', e));
                }

                console.log(`[WAITLIST] Promovido: ${promotedUser?.display_name} para clase ${booking.class_id}`);
            }
        } catch (waitlistErr) {
            console.error('[WAITLIST] Error promoting from waitlist:', waitlistErr);
        }

        // Send WhatsApp cancellation notice
        try {
            const notifSettings = await queryOne(
                "SELECT value FROM settings WHERE key = 'notification_settings'"
            );
            const shouldNotify = notifSettings?.value?.send_cancellation_notice !== false;

            if (shouldNotify) {
                const user = await queryOne('SELECT display_name, phone FROM users WHERE id = $1', [booking.user_id]);
                const classInfo2 = await queryOne(`
                    SELECT ct.name as class_name, c.date
                    FROM classes c
                    JOIN class_types ct ON c.class_type_id = ct.id
                    WHERE c.id = $1
                `, [booking.class_id]);

                if (user?.phone && classInfo2) {
                    const dateStr = classInfo2.date instanceof Date
                        ? classInfo2.date.toLocaleDateString('es-MX')
                        : String(classInfo2.date).split('T')[0];
                    const reason = shouldRefund
                        ? undefined
                        : refundReason || 'No aplica reembolso';
                    sendCancellationNotice(
                        user.phone, user.display_name, classInfo2.class_name, dateStr, reason, shouldRefund
                    ).catch(err => console.error('[WhatsApp] Cancel notice error:', err));
                }
            }
        } catch (waErr) {
            console.error('[WhatsApp] Non-blocking error:', waErr);
        }

        // Update Apple + Google Wallet passes (credits changed)
        notifyAllUserDevices(booking.user_id, '⚠️ Reserva cancelada', shouldRefund ? 'Crédito devuelto' : 'Sin reembolso')
            .catch(e => console.error('Apple Wallet cancel notify error:', e));
        if (booking.membership_id) {
            upsertGoogleLoyaltyObject(booking.membership_id).catch(e => console.error('Google Wallet cancel error:', e));
        }

        res.json({
            ...cancelled,
            refunded: shouldRefund,
            message: shouldRefund
                ? 'Reserva cancelada. Se ha reembolsado el credito.'
                : `Reserva cancelada sin reembolso: ${refundReason || 'Condiciones no cumplidas'}.`,
            cancellationsUsed: updatedMembership?.cancellations_used
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ error: 'Error al cancelar reserva' });
    }
});

// ============================================
// GET /api/bookings/class/:classId - List attendees (Admin)
// ============================================
router.get('/class/:classId', authenticate, requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
    try {
        const attendees = await query(
            `SELECT 
                b.id as booking_id, b.status, b.checked_in_at,
                u.id as user_id, u.display_name, u.email, u.photo_url, u.phone,
                m.id as membership_id, p.name as plan_name
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             LEFT JOIN memberships m ON b.membership_id = m.id
             LEFT JOIN plans p ON m.plan_id = p.id
             WHERE b.class_id = $1 AND b.status != 'cancelled'`,
            [req.params.classId]
        );
        res.json(attendees);
    } catch (error) {
        console.error('List attendees error:', error);
        res.status(500).json({ error: 'Error al obtener asistentes' });
    }
});

// ============================================
// POST /api/bookings/:id/check-in - Check-in User
// ============================================
router.post('/:id/check-in', authenticate, requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
    try {
        const bookingId = req.params.id;

        // This update triggers the DB function we want to disable/avoid?
        // We will disable the trigger in index.ts, so this just marks status.
        const booking = await queryOne(
            `UPDATE bookings 
             SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $1
             WHERE id = $2
             RETURNING *`,
            [req.user?.userId, bookingId]
        );

        if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

        res.json(booking);
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: 'Error al realizar check-in' });
    }
});

export default router;
