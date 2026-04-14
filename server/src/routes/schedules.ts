import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Schema for Schedule validation
const ScheduleSchema = z.object({
    classTypeId: z.string().uuid(),
    instructorId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6), // 0=Sunday, 6=Saturday
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM requerido'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato HH:MM requerido'),
    maxCapacity: z.number().int().positive(),
    isRecurring: z.boolean().default(true),
    specificDate: z.string().optional(), // YYYY-MM-DD for non-recurring
    isActive: z.boolean().default(true),
});

// ============================================
// GET /api/schedules - List all schedules (Usually Admin)
// ============================================
router.get('/', authenticate, requireRole('admin', 'instructor'), async (req: Request, res: Response) => {
    try {
        const { all } = req.query;

        let queryStr = `
      SELECT 
        s.id, s.class_type_id, s.instructor_id, s.day_of_week, 
        s.start_time, s.end_time, s.max_capacity, s.is_recurring, 
        s.specific_date, s.is_active,
        ct.name as class_type_name, ct.color as class_type_color,
        i.display_name as instructor_name
      FROM schedules s
      JOIN class_types ct ON s.class_type_id = ct.id
      JOIN instructors i ON s.instructor_id = i.id
    `;

        if (all !== 'true') {
            queryStr += ` WHERE s.is_active = true`;
        }

        queryStr += ` ORDER BY s.day_of_week ASC, s.start_time ASC`;

        const schedules = await query(queryStr);

        // Format times to HH:MM if they come back as full strings (Postgres 'TIME' type)
        const formatted = schedules.map((s: any) => ({
            ...s,
            start_time: s.start_time.substring(0, 5),
            end_time: s.end_time.substring(0, 5)
        }));

        res.json(formatted);
    } catch (error) {
        console.error('List schedules error:', error);
        res.status(500).json({ error: 'Error al obtener horarios' });
    }
});

// ============================================
// POST /api/schedules - Create schedule template
// ============================================
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const validation = ScheduleSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        // TODO: Add overlap check logic here if needed (prevent double booking room/instructor)

        const newSchedule = await queryOne(
            `INSERT INTO schedules (
        class_type_id, instructor_id, day_of_week, start_time, 
        end_time, max_capacity, is_recurring, specific_date, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
            [
                data.classTypeId,
                data.instructorId,
                data.dayOfWeek,
                data.startTime,
                data.endTime,
                data.maxCapacity,
                data.isRecurring,
                data.specificDate || null,
                data.isActive,
            ]
        );

        res.status(201).json(newSchedule);
    } catch (error) {
        console.error('Create schedule error:', error);
        res.status(500).json({ error: 'Error al crear horario' });
    }
});

// ============================================
// PUT /api/schedules/:id - Update schedule
// ============================================
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const validation = ScheduleSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        const updatedSchedule = await queryOne(
            `UPDATE schedules SET 
                class_type_id = $1, 
                instructor_id = $2, 
                day_of_week = $3, 
                start_time = $4, 
                end_time = $5, 
                max_capacity = $6, 
                is_recurring = $7, 
                specific_date = $8, 
                is_active = $9
             WHERE id = $10
             RETURNING *`,
            [
                data.classTypeId,
                data.instructorId,
                data.dayOfWeek,
                data.startTime,
                data.endTime,
                data.maxCapacity,
                data.isRecurring,
                data.specificDate || null,
                data.isActive,
                id
            ]
        );

        if (!updatedSchedule) {
            return res.status(404).json({ error: 'Horario no encontrado' });
        }

        res.json(updatedSchedule);
    } catch (error) {
        console.error('Update schedule error:', error);
        res.status(500).json({ error: 'Error al actualizar horario' });
    }
});

// ============================================
// DELETE /api/schedules/:id - Deactivate/Delete schedule
// ============================================
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Hard delete for schedules might be cleaner if no classes generated yet, 
        // but soft delete (is_active = false) gives history. 
        // Let's stick to soft delete or just delete if it's a template.
        // For now, hard delete is fine for templates if we don't care about history of "it used to be scheduled".
        // Actually, task.md says "CRUD", let's do hard delete for now to keep it simple 
        // unless it violates FKs (classes table references schedules ON DELETE SET NULL).

        await query('DELETE FROM schedules WHERE id = $1', [id]);

        res.json({ message: 'Horario eliminado' });
    } catch (error) {
        console.error('Delete schedule error:', error);
        res.status(500).json({ error: 'Error al eliminar horario' });
    }
});

export default router;
