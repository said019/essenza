import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { sendClassAssignmentNotification } from '../services/email.js';
import { cancelClassWithRefunds } from '../lib/cancel-class.js';
import { z } from 'zod';

const router = Router();

// Schema for Class creation
const ClassSchema = z.object({
    classTypeId: z.string().uuid(),
    instructorId: z.string().uuid(),
    facilityId: z.string().uuid().optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM requerido'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM requerido'),
    maxCapacity: z.number().int().positive(),
});

// Schema for Bulk Generation
const GenerateSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
});

// ============================================
// GET /api/classes - List classes (Public/Admin)
// ============================================
router.get('/', async (req: Request, res: Response) => {
    try {
        const { start, end, start_date, end_date, instructorId, classTypeId } = req.query;

        // Accept both start/end and start_date/end_date
        const startParam = start || start_date;
        const endParam = end || end_date;

        if (!startParam || !endParam) {
            return res.status(400).json({ error: 'Se requieren parámetros start y end (YYYY-MM-DD)' });
        }

        const params: any[] = [startParam, endParam];
        let queryStr = `
      SELECT
        c.id, c.date, c.start_time, c.end_time, c.max_capacity,
        c.current_bookings, c.status, c.class_type_id, c.instructor_id,
        c.facility_id,
        ct.name as class_type_name, ct.color as class_type_color,
        i.display_name as instructor_name, i.user_id as instructor_user_id,
        f.name as facility_name
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN instructors i ON c.instructor_id = i.id
      LEFT JOIN facilities f ON c.facility_id = f.id
      WHERE c.date >= $1 AND c.date <= $2
    `;

        let paramCount = 3;

        if (instructorId) {
            queryStr += ` AND c.instructor_id = $${paramCount++}`;
            params.push(instructorId);
        }

        // Admins see all, users usually only see scheduled (not cancelled) 
        // BUT frontend might want to see cancelled to show "Cancelled" badge. 
        // Let's return all stats for now, filter in frontend if needed.

        queryStr += ` ORDER BY c.date ASC, c.start_time ASC`;

        const classes = await query(queryStr, params);

        // Format times and dates
        const formatted = classes.map((c: any) => {
            const dateStr = c.date instanceof Date
                ? c.date.toISOString().split('T')[0]
                : String(c.date).split('T')[0];
            return {
                ...c,
                date: dateStr, // Override raw Date → clean YYYY-MM-DD
                class_date: dateStr,
                start_time: c.start_time.substring(0, 5),
                end_time: c.end_time.substring(0, 5),
                capacity: c.max_capacity,
            };
        });

        res.json(formatted);
    } catch (error) {
        console.error('List classes error:', error);
        res.status(500).json({ error: 'Error al obtener clases' });
    }
});

// ============================================
// GET /api/classes/:id - Class detail
// ============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const classInfo = await queryOne(
            `SELECT
        c.id, c.date, c.start_time, c.end_time, c.max_capacity,
        c.current_bookings, c.status, c.class_type_id, c.instructor_id,
        c.facility_id,
        ct.name as class_type_name, ct.color as class_type_color,
        i.display_name as instructor_name, i.photo_url as instructor_photo,
        f.name as facility_name
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN instructors i ON c.instructor_id = i.id
      LEFT JOIN facilities f ON c.facility_id = f.id
      WHERE c.id = $1`,
            [id]
        );

        if (!classInfo) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }

        res.json({
            ...classInfo,
            date: classInfo.date.toISOString().split('T')[0],
            start_time: classInfo.start_time.substring(0, 5),
            end_time: classInfo.end_time.substring(0, 5),
        });
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({ error: 'Error al obtener clase' });
    }
});

// ============================================
// POST /api/classes - Create single class (Admin)
// ============================================
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const validation = ClassSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        const newClass = await queryOne(
            `INSERT INTO classes (
        class_type_id, instructor_id, facility_id, date, start_time, 
        end_time, max_capacity
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
            [
                data.classTypeId,
                data.instructorId,
                data.facilityId || null,
                data.date,
                data.startTime,
                data.endTime,
                data.maxCapacity,
            ]
        );

        // Notify the instructor about the new class assignment
        try {
            const instructorInfo = await queryOne<{
                email: string;
                display_name: string;
            }>(
                `SELECT i.email, i.display_name 
                 FROM instructors i 
                 WHERE i.id = $1`,
                [data.instructorId]
            );
            
            const classTypeInfo = await queryOne<{ name: string }>(
                'SELECT name FROM class_types WHERE id = $1',
                [data.classTypeId]
            );

            if (instructorInfo?.email && classTypeInfo) {
                await sendClassAssignmentNotification({
                    to: instructorInfo.email,
                    coachName: instructorInfo.display_name,
                    className: classTypeInfo.name,
                    classDate: data.date,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    capacity: data.maxCapacity,
                });
            }
        } catch (notifyError) {
            console.error('Failed to notify instructor:', notifyError);
            // Don't fail class creation if notification fails
        }

        res.status(201).json(newClass);
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Error al crear clase' });
    }
});

// ============================================
// POST /api/classes/generate - Bulk Generate (Admin)
// ============================================
router.post('/generate', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    // Transaction logic ideally needed here
    try {
        const validation = GenerateSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { startDate, endDate } = validation.data;

        // 1. Get all active recurring schedules
        const schedules = await query(`
      SELECT * FROM schedules 
      WHERE is_active = true AND is_recurring = true
    `);

        if (schedules.length === 0) {
            return res.json({ message: 'No hay horarios recurrentes activos para generar clases', count: 0 });
        }

        // 2. Get closed days in the range to skip them
        const closedRows = await query(
            `SELECT date FROM studio_closed_days WHERE date >= $1 AND date <= $2`,
            [startDate, endDate]
        );
        const closedDates = new Set(
            closedRows.map((r: any) => (r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0]))
        );

        // 3. Iterate through dates range
        let current = new Date(startDate);
        const end = new Date(endDate);
        let classesCreated = 0;

        while (current <= end) {
            const dayOfWeek = current.getDay();
            const dateStr = current.toISOString().split('T')[0];

            // Skip closed days
            if (closedDates.has(dateStr)) {
                current.setDate(current.getDate() + 1);
                continue;
            }

            // Find schedules for this day
            const daySchedules = schedules.filter((s: any) => s.day_of_week === dayOfWeek);

            for (const sched of daySchedules) {
                // Check if class already exists for this schedule on this date to avoid dupes
                // We use schedule_id to track origin
                const existing = await queryOne(
                    `SELECT id FROM classes WHERE schedule_id = $1 AND date = $2`,
                    [sched.id, dateStr]
                );

                if (!existing) {
                    await query(
                        `INSERT INTO classes (
                        schedule_id, class_type_id, instructor_id, date,
                        start_time, end_time, max_capacity
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            sched.id,
                            sched.class_type_id,
                            sched.instructor_id,
                            dateStr,
                            sched.start_time,
                            sched.end_time,
                            sched.max_capacity
                        ]
                    );
                    classesCreated++;
                }
            }

            // Next day directly
            current.setDate(current.getDate() + 1);
        }

        res.json({ message: 'Clases generadas exitosamente', count: classesCreated });

    } catch (error) {
        console.error('Generate classes error:', error);
        res.status(500).json({ error: 'Error al generar clases' });
    }
});

// ============================================
// PUT /api/classes/:id - Update class (Admin)
// ============================================
const ClassUpdateSchema = z.object({
    classTypeId: z.string().uuid().optional(),
    instructorId: z.string().uuid().optional(),
    facilityId: z.string().uuid().optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido').optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM requerido').optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM requerido').optional(),
    maxCapacity: z.number().int().positive().optional(),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
});

router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const validation = ClassUpdateSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos invalidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        // Check class exists
        const existing = await queryOne('SELECT * FROM classes WHERE id = $1', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.classTypeId !== undefined) {
            updates.push(`class_type_id = $${paramCount++}`);
            values.push(data.classTypeId);
        }
        if (data.instructorId !== undefined) {
            updates.push(`instructor_id = $${paramCount++}`);
            values.push(data.instructorId);
        }
        if (data.facilityId !== undefined) {
            updates.push(`facility_id = $${paramCount++}`);
            values.push(data.facilityId);
        }
        if (data.date !== undefined) {
            updates.push(`date = $${paramCount++}`);
            values.push(data.date);
        }
        if (data.startTime !== undefined) {
            updates.push(`start_time = $${paramCount++}`);
            values.push(data.startTime);
        }
        if (data.endTime !== undefined) {
            updates.push(`end_time = $${paramCount++}`);
            values.push(data.endTime);
        }
        if (data.maxCapacity !== undefined) {
            // Validate max capacity is not less than current bookings
            if (data.maxCapacity < existing.current_bookings) {
                return res.status(400).json({
                    error: `La capacidad no puede ser menor a las reservas actuales (${existing.current_bookings})`
                });
            }
            updates.push(`max_capacity = $${paramCount++}`);
            values.push(data.maxCapacity);
        }
        if (data.status !== undefined) {
            updates.push(`status = $${paramCount++}`);
            values.push(data.status);
        }

        if (updates.length === 0) {
            return res.json(existing);
        }

        values.push(id);
        const result = await queryOne(
            `UPDATE classes SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${paramCount} RETURNING *`,
            values
        );

        res.json(result);
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({ error: 'Error al actualizar clase' });
    }
});

// ============================================
// DELETE /api/classes/:id - Cancel class (Admin)
// ============================================
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        // Get class info first
        const classInfo = await queryOne('SELECT * FROM classes WHERE id = $1', [id]);
        if (!classInfo) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }

        if (classInfo.status === 'cancelled') {
            return res.status(400).json({ error: 'La clase ya esta cancelada' });
        }

        const { class: result, cancelledBookings, refundedCredits } = await cancelClassWithRefunds(
            id,
            req.user?.userId || '',
            reason || 'Cancelada por administrador'
        );

        res.json({
            message: 'Clase cancelada exitosamente',
            class: result,
            cancelledBookings,
            refundedCredits
        });
    } catch (error) {
        console.error('Cancel class error:', error);
        res.status(500).json({ error: 'Error al cancelar clase' });
    }
});

// ============================================
// POST /api/classes/:id/substitute - Substitute coach (Admin)
// ============================================
router.post('/:id/substitute', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { newInstructorId, reason } = req.body;

        if (!newInstructorId) {
            return res.status(400).json({ error: 'Se requiere nuevo instructor' });
        }

        // Get current class info
        const classInfo = await queryOne(
            `SELECT c.*, i.display_name as original_instructor_name
             FROM classes c
             JOIN instructors i ON c.instructor_id = i.id
             WHERE c.id = $1`,
            [id]
        );

        if (!classInfo) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }

        if (classInfo.status === 'cancelled') {
            return res.status(400).json({ error: 'No se puede sustituir una clase cancelada' });
        }

        // Get new instructor info
        const newInstructor = await queryOne(
            'SELECT id, display_name FROM instructors WHERE id = $1 AND is_active = true',
            [newInstructorId]
        );

        if (!newInstructor) {
            return res.status(404).json({ error: 'Instructor no encontrado o inactivo' });
        }

        // Check if new instructor already has a class at this time
        const conflict = await queryOne(`
            SELECT id FROM classes 
            WHERE instructor_id = $1 
              AND date = $2 
              AND status != 'cancelled'
              AND id != $3
              AND (
                  (start_time <= $4 AND end_time > $4)
                  OR (start_time < $5 AND end_time >= $5)
                  OR (start_time >= $4 AND end_time <= $5)
              )
        `, [newInstructorId, classInfo.date, id, classInfo.start_time, classInfo.end_time]);

        if (conflict) {
            return res.status(400).json({ error: 'El instructor tiene otra clase en este horario' });
        }

        const originalInstructorId = classInfo.instructor_id;

        // Update class with new instructor
        await queryOne(
            'UPDATE classes SET instructor_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newInstructorId, id]
        );

        // Record substitution
        await queryOne(`
            INSERT INTO coach_substitutions 
            (class_id, original_instructor_id, new_instructor_id, reason, substituted_by)
            VALUES ($1, $2, $3, $4, $5)
        `, [id, originalInstructorId, newInstructorId, reason || null, req.user?.userId]);

        // Get clients booked in this class for notification
        const bookedClients = await query(`
            SELECT u.id, u.email, u.display_name
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.class_id = $1 AND b.status IN ('confirmed', 'waitlist')
        `, [id]);

        // TODO: Send notifications
        // - To original instructor (removed)
        // - To new instructor (assigned)
        // - To booked clients (instructor changed)

        res.json({
            message: 'Instructor sustituido exitosamente',
            original_instructor: classInfo.original_instructor_name,
            new_instructor: newInstructor.display_name,
            affected_clients: bookedClients.length
        });
    } catch (error) {
        console.error('Substitute coach error:', error);
        res.status(500).json({ error: 'Error al sustituir instructor' });
    }
});

// ============================================
// GET /api/classes/:id/attendees - Get class attendees (for calendar view)
// ============================================
router.get('/:id/attendees', authenticate, requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const attendees = await query(`
            SELECT
                b.id AS booking_id,
                b.status,
                b.waitlist_position,
                b.checked_in_at,
                u.id AS user_id,
                u.display_name,
                u.email,
                u.phone,
                u.photo_url,
                u.health_notes,
                u.alert_flag,
                u.alert_message
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.class_id = $1 AND b.status != 'cancelled'
            ORDER BY
                CASE b.status WHEN 'waitlist' THEN 2 ELSE 1 END,
                b.waitlist_position NULLS LAST,
                b.created_at
        `, [id]);

        const confirmed = attendees.filter((a: any) => a.status !== 'waitlist');
        const waitlist = attendees.filter((a: any) => a.status === 'waitlist');

        res.json({ confirmed, waitlist, total: confirmed.length, waitlist_count: waitlist.length });
    } catch (error) {
        console.error('Get attendees error:', error);
        res.status(500).json({ error: 'Error al obtener asistentes' });
    }
});

export default router;
