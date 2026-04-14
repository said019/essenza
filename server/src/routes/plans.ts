import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Schema for Plan validation
const PlanSchema = z.object({
    name: z.string().min(2, 'El nombre es obligatorio'),
    description: z.string().optional(),
    price: z.number().positive('El precio debe ser positivo'),
    currency: z.string().default('MXN'),
    durationDays: z.number().int().positive('La duración debe ser positiva'),
    classLimit: z.number().int().positive().nullable().optional(), // null = unlimited
    features: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
});

// ============================================
// GET /api/plans - List all active plans (Public/Admin)
// ============================================
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const showAll = isAdmin && req.query.all === 'true';

        let queryStr = `
      SELECT 
        id, name, description, price, currency, duration_days, 
        class_limit, features, is_active, sort_order
      FROM plans
    `;

        if (!showAll) {
            queryStr += ` WHERE is_active = true`;
        }

        queryStr += ` ORDER BY sort_order ASC, price ASC`;

        const plans = await query(queryStr);
        res.json(plans);
    } catch (error) {
        console.error('List plans error:', error);
        res.status(500).json({ error: 'Error al obtener planes' });
    }
});

// ============================================
// GET /api/plans/:id - Plan detail (Public)
// ============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const plan = await queryOne(
            `SELECT 
        id, name, description, price, currency, duration_days, 
        class_limit, features, is_active, sort_order
       FROM plans
       WHERE id = $1`,
            [id]
        );

        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        if (!plan.is_active) {
            return res.status(404).json({ error: 'Plan no disponible' });
        }

        res.json(plan);
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Error al obtener plan' });
    }
});

// ============================================
// POST /api/plans - Create new plan (Admin)
// ============================================
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const validation = PlanSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        const newPlan = await queryOne(
            `INSERT INTO plans (
        name, description, price, currency, duration_days, 
        class_limit, features, is_active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
            [
                data.name,
                data.description,
                data.price,
                data.currency,
                data.durationDays,
                data.classLimit || null,
                JSON.stringify(data.features),
                data.isActive,
                data.sortOrder,
            ]
        );

        res.status(201).json(newPlan);
    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({ error: 'Error al crear plan' });
    }
});

// ============================================
// PUT /api/plans/:id - Update plan (Admin)
// ============================================
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const validation = PlanSchema.partial().safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        // Check if plan exists
        const existingPlan = await queryOne('SELECT id FROM plans WHERE id = $1', [id]);
        if (!existingPlan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        // Dynamic update
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(data.name);
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(data.description);
        }
        if (data.price !== undefined) {
            updates.push(`price = $${paramCount++}`);
            values.push(data.price);
        }
        if (data.durationDays !== undefined) {
            updates.push(`duration_days = $${paramCount++}`);
            values.push(data.durationDays);
        }
        if (data.classLimit !== undefined) {
            updates.push(`class_limit = $${paramCount++}`);
            values.push(data.classLimit);
        }
        if (data.features !== undefined) {
            updates.push(`features = $${paramCount++}`);
            values.push(JSON.stringify(data.features));
        }
        if (data.isActive !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(data.isActive);
        }
        if (data.sortOrder !== undefined) {
            updates.push(`sort_order = $${paramCount++}`);
            values.push(data.sortOrder);
        }

        if (updates.length > 0) {
            values.push(id); // push id for WHERE clause
            const result = await queryOne(
                `UPDATE plans SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
                values
            );
            return res.json(result);
        }

        res.json(existingPlan);
    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({ error: 'Error al actualizar plan' });
    }
});

// ============================================
// DELETE /api/plans/:id - Soft delete/Deactivate plan (Admin)
// ============================================
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await queryOne(
            'UPDATE plans SET is_active = false WHERE id = $1 RETURNING id',
            [id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        res.json({ message: 'Plan desactivado exitosamente' });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({ error: 'Error al eliminar plan' });
    }
});

export default router;
