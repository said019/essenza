import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { sendMembershipActivatedEmail } from '../services/email.js';
import { sendMembershipActivatedNotice } from '../lib/whatsapp.js';
import { awardPaymentLoyaltyPoints } from '../lib/loyalty.js';
import { notifyMembershipRenewed } from '../lib/notifications.js';

const router = Router();

const PurchaseMembershipSchema = z.object({
    planId: z.string().uuid(),
    paymentMethod: z.enum(['cash', 'transfer']),
});

// ============================================
// GET /api/memberships/me - Current user's membership
// ============================================
router.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const membership = await queryOne(
            `SELECT 
        m.id, m.status, m.start_date, m.end_date, m.classes_remaining,
        m.payment_method, m.payment_reference,
        p.name as plan_name, p.price as plan_price, p.currency as plan_currency,
        p.duration_days as plan_duration_days, p.class_limit
      FROM memberships m
      JOIN plans p ON m.plan_id = p.id
      WHERE m.user_id = $1
      ORDER BY
        CASE m.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'pending_activation' THEN 2 WHEN 'pending_payment' THEN 3 ELSE 4 END,
        m.created_at DESC
      LIMIT 1`,
            [userId]
        );

        if (!membership) {
            return res.status(404).json({ error: 'No tienes membresía activa' });
        }

        res.json(membership);
    } catch (error) {
        console.error('Get membership error:', error);
        res.status(500).json({ error: 'Error al obtener membresía' });
    }
});

// ============================================
// GET /api/memberships/my - List all user's active memberships
// ============================================
router.get('/my', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const memberships = await query(
            `SELECT 
        m.id, m.status, m.start_date, m.end_date, m.classes_remaining,
        p.name as plan_name
      FROM memberships m
      JOIN plans p ON m.plan_id = p.id
      WHERE m.user_id = $1 AND m.status IN ('active', 'pending_payment')
      ORDER BY m.created_at DESC`,
            [userId]
        );

        res.json(memberships);
    } catch (error) {
        console.error('List my memberships error:', error);
        res.status(500).json({ error: 'Error al obtener mis membresías' });
    }
});

// ============================================
// POST /api/memberships - Purchase membership (Client)
// ============================================
router.post('/', authenticate, requireRole('client'), async (req: Request, res: Response) => {
    try {
        const validation = PurchaseMembershipSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const { planId, paymentMethod } = validation.data;

        const plan = await queryOne(
            `SELECT id, class_limit FROM plans WHERE id = $1 AND is_active = true`,
            [planId]
        );

        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        const existing = await queryOne(
            `SELECT id FROM memberships 
       WHERE user_id = $1 AND plan_id = $2 
       AND status IN ('pending_payment', 'pending_activation')`,
            [userId, planId]
        );

        if (existing) {
            return res.status(409).json({ error: 'Ya tienes una solicitud pendiente para este plan' });
        }

        const classesRemaining = plan.class_limit ?? null;

        const membership = await queryOne(
            `INSERT INTO memberships (
        user_id, plan_id, status, classes_remaining, payment_method
      ) VALUES ($1, $2, 'pending_payment', $3, $4)
      RETURNING id, status`,
            [userId, planId, classesRemaining, paymentMethod]
        );

        res.status(201).json({
            membershipId: membership.id,
            status: membership.status,
        });
    } catch (error) {
        console.error('Purchase membership error:', error);
        res.status(500).json({ error: 'Error al crear membresía' });
    }
});

// ============================================
// GET /api/memberships - List memberships (Admin)
// ============================================
router.get('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { status, userId } = req.query;

        let queryStr = `
      SELECT m.*, 
             u.display_name as user_name, u.email as user_email, u.phone as user_phone,
             p.name as plan_name, p.price as plan_price, p.currency as plan_currency, p.duration_days as plan_duration_days
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      JOIN plans p ON m.plan_id = p.id
      WHERE 1=1
    `;
        const params: any[] = [];
        let paramCount = 1;

        if (status) {
            queryStr += ` AND m.status = $${paramCount++}`;
            params.push(status);
        }

        if (userId) {
            queryStr += ` AND m.user_id = $${paramCount++}`;
            params.push(userId);
        }

        queryStr += ` ORDER BY m.created_at DESC`;

        const memberships = await query(queryStr, params);
        res.json(memberships);
    } catch (error) {
        console.error('List memberships error:', error);
        res.status(500).json({ error: 'Error al listar membresías' });
    }
});

// ============================================
// GET /api/memberships/pending - List pending activations (Admin)
// ============================================
router.get('/pending', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const memberships = await query(`
      SELECT m.*, 
             u.display_name as user_name, u.email as user_email, u.phone as user_phone,
             p.name as plan_name, p.price as plan_price, p.currency as plan_currency, p.duration_days as plan_duration_days
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      JOIN plans p ON m.plan_id = p.id
      WHERE m.status IN ('pending_payment', 'pending_activation')
      ORDER BY m.created_at DESC
    `);
        res.json(memberships);
    } catch (error) {
        console.error('List pending memberships error:', error);
        res.status(500).json({ error: 'Error al obtener membresías pendientes' });
    }
});

// ============================================
// POST /api/memberships/assign - Assign membership manually (Admin)
// ============================================
const AssignMembershipSchema = z.object({
    userId: z.string().uuid(),
    planId: z.string().uuid(),
    startDate: z.string().optional(), // ISO date string
    status: z.enum(['active', 'pending_payment', 'pending_activation']).default('active'),
    paymentMethod: z.enum(['cash', 'transfer', 'card', 'online', 'bank_transfer']).optional(),
    notes: z.string().optional(),
});

const ActivateMembershipSchema = z.object({
    paymentMethod: z.enum(['cash', 'transfer', 'card', 'online']).optional(),
    paymentReference: z.string().max(255).optional(),
    startDate: z.string().optional(),
    notes: z.string().max(500).optional(),
    notifyMember: z.boolean().optional(),
    generateWalletPass: z.boolean().optional(),
});

router.post('/assign', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const validation = AssignMembershipSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { userId, planId, startDate, status, paymentMethod, notes } = validation.data;

        // Get plan details
        const plan = await queryOne('SELECT * FROM plans WHERE id = $1', [planId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        // Calculate dates
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + plan.duration_days);

        // Create membership within transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create membership
            const normalizedPaymentMethod = paymentMethod === 'bank_transfer' ? 'transfer' : (paymentMethod || null);

            const membershipResult = await client.query(
                `INSERT INTO memberships (
          user_id, plan_id, start_date, end_date, status, classes_remaining, payment_method, payment_reference
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
                [
                    userId,
                    planId,
                    status === 'active' ? start : null,
                    status === 'active' ? end : null,
                    status,
                    plan.class_limit ?? null,
                    normalizedPaymentMethod,
                    notes || null,
                ]
            );
            const membership = membershipResult.rows[0];

            // 2. Record payment if method provided
            if (normalizedPaymentMethod) {
                const payResult = await client.query(
                    `INSERT INTO payments (
            user_id, membership_id, amount, currency,
            payment_method, reference, notes, status, processed_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8)
          RETURNING id`,
                    [
                        userId,
                        membership.id,
                        plan.price,
                        plan.currency,
                        normalizedPaymentMethod,
                        null,
                        notes || null,
                        req.user?.userId || null,
                    ]
                );

                // Award loyalty points for payment
                if (payResult.rows[0]?.id) {
                    await awardPaymentLoyaltyPoints({
                        db: client,
                        userId,
                        paymentId: payResult.rows[0].id,
                        amount: Number(plan.price),
                        paymentMethod: normalizedPaymentMethod,
                    }).catch(e => console.error('Loyalty points error:', e));
                }
            }

            await client.query('COMMIT');

            // Send notifications if membership is active
            if (status === 'active') {
                const user = await queryOne<any>('SELECT display_name, email, phone FROM users WHERE id = $1', [userId]);
                if (user) {
                    const endStr = end.toISOString().split('T')[0];
                    const startStr = start.toISOString().split('T')[0];
                    // Email
                    if (user.email) {
                        sendMembershipActivatedEmail({
                            to: user.email,
                            clientName: user.display_name || 'Cliente',
                            planName: plan.name,
                            classesIncluded: plan.class_limit || null,
                            startDate: startStr,
                            endDate: endStr,
                        }).catch(e => console.error('Email notification error:', e));
                    }
                    // WhatsApp
                    if (user.phone) {
                        const fmtEnd = end.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
                        sendMembershipActivatedNotice(
                            user.phone, user.display_name || 'Cliente',
                            plan.name, plan.class_limit || null, fmtEnd
                        ).catch(e => console.error('WhatsApp notification error:', e));
                    }
                }
                // Update Apple + Google Wallet passes
                notifyMembershipRenewed(membership.id).catch(e => console.error('Wallet notification error:', e));
            }

            res.status(201).json(membership);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Assign membership error:', error);
        res.status(500).json({ error: 'Error al asignar membresía' });
    }
});

// ============================================
// POST /api/memberships/:id/activate - Activate membership (Admin)
// ============================================
router.post('/:id/activate', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const validation = ActivateMembershipSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const {
            paymentMethod,
            paymentReference,
            startDate,
            notes,
            generateWalletPass,
        } = validation.data;

        // Get membership + plan to calculate end date and payment data
        const membership = await queryOne<{
            id: string;
            user_id: string;
            plan_id: string;
            status: string;
            duration_days: number;
            plan_price: number;
            plan_currency: string;
        }>(`
        SELECT m.*, p.duration_days, p.price as plan_price, p.currency as plan_currency
        FROM memberships m
        JOIN plans p ON m.plan_id = p.id
        WHERE m.id = $1
    `, [id]);

        if (!membership) {
            return res.status(404).json({ error: 'Membresía no encontrada' });
        }

        if (membership.status === 'active') {
            return res.status(400).json({ error: 'La membresía ya está activa' });
        }

        const start = startDate ? new Date(startDate) : new Date();
        if (Number.isNaN(start.getTime())) {
            return res.status(400).json({ error: 'Fecha de inicio inválida' });
        }
        const end = new Date(start);
        end.setDate(end.getDate() + membership.duration_days);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const updatedResult = await client.query(
                `UPDATE memberships 
         SET status = 'active', 
             start_date = $1, 
             end_date = $2,
             activated_at = NOW(),
             activated_by = $3,
             payment_method = COALESCE($4, payment_method),
             payment_reference = COALESCE($5, payment_reference),
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
                [
                    start,
                    end,
                    req.user?.userId || null,
                    paymentMethod || null,
                    paymentReference || null,
                    id,
                ]
            );

            if (paymentMethod) {
                await client.query(
                    `INSERT INTO payments (
            user_id, membership_id, amount, currency,
            payment_method, reference, notes, status, processed_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8)`,
                    [
                        membership.user_id,
                        membership.id,
                        membership.plan_price,
                        membership.plan_currency,
                        paymentMethod,
                        paymentReference || null,
                        notes || null,
                        req.user?.userId || null,
                    ]
                );
            }

            const shouldGenerateWalletPass = generateWalletPass !== false;
            if (shouldGenerateWalletPass) {
                const existingPasses = await client.query(
                    `SELECT platform FROM wallet_passes WHERE membership_id = $1`,
                    [membership.id]
                );
                const existingPlatforms = new Set(existingPasses.rows.map((row) => row.platform));

                const platforms: Array<'apple' | 'google'> = ['apple', 'google'];
                for (const platform of platforms) {
                    if (!existingPlatforms.has(platform)) {
                        await client.query(
                            `INSERT INTO wallet_passes (
                user_id, membership_id, platform, serial_number, pass_type_identifier, last_updated
              ) VALUES ($1, $2, $3, $4, $5, NOW())`,
                            [
                                membership.user_id,
                                membership.id,
                                platform,
                                randomUUID(),
                                platform === 'apple' ? process.env.APPLE_PASS_TYPE_IDENTIFIER || null : null,
                            ]
                        );
                    }
                }
            }

            const settingsResult = await client.query(
                `SELECT value FROM system_settings WHERE key = 'loyalty_settings'`
            );
            const settingsValue = settingsResult.rows[0]?.value;
            const settings = typeof settingsValue === 'string' ? JSON.parse(settingsValue) : settingsValue;
            const welcomeBonus = Number(settings?.welcome_bonus || 0);
            const bonusExists = await client.query(
                `SELECT 1 FROM loyalty_points WHERE user_id = $1 AND type = 'bonus' AND description = 'Bono de bienvenida' LIMIT 1`,
                [membership.user_id]
            );
            if (welcomeBonus > 0 && bonusExists.rowCount === 0) {
                await client.query(
                    `INSERT INTO loyalty_points (user_id, points, type, description)
           VALUES ($1, $2, 'bonus', 'Bono de bienvenida')`,
                    [membership.user_id, welcomeBonus]
                );
            }

            await client.query('COMMIT');

            // Send notifications
            const activated = updatedResult.rows[0];
            const user = await queryOne<any>('SELECT display_name, email, phone FROM users WHERE id = $1', [activated.user_id]);
            const planInfo = await queryOne<any>('SELECT name, class_limit FROM plans WHERE id = $1', [activated.plan_id]);
            if (user && planInfo) {
                const endStr = String(activated.end_date).split('T')[0];
                const startStr = String(activated.start_date).split('T')[0];
                if (user.email) {
                    sendMembershipActivatedEmail({
                        to: user.email,
                        clientName: user.display_name || 'Cliente',
                        planName: planInfo.name,
                        classesIncluded: planInfo.class_limit || null,
                        startDate: startStr,
                        endDate: endStr,
                    }).catch(e => console.error('Email notification error:', e));
                }
                if (user.phone) {
                    const fmtEnd = new Date(endStr + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
                    sendMembershipActivatedNotice(
                        user.phone, user.display_name || 'Cliente',
                        planInfo.name, planInfo.class_limit || null, fmtEnd
                    ).catch(e => console.error('WhatsApp notification error:', e));
                }
                // Update Apple + Google Wallet passes
                notifyMembershipRenewed(activated.id).catch(e => console.error('Wallet notification error:', e));
            }

            res.json(activated);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Activate membership error:', error);
        res.status(500).json({ error: 'Error al activar membresía' });
    }
});

// ============================================
// POST /api/memberships/:id/cancel - Cancel membership
// ============================================
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;

        // Check ownership or admin role
        const membership = await queryOne('SELECT * FROM memberships WHERE id = $1', [id]);

        if (!membership) {
            return res.status(404).json({ error: 'Membresía no encontrada' });
        }

        if (role !== 'admin' && membership.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const updated = await queryOne(
            `UPDATE memberships 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
            [id]
        );

        res.json(updated);
    } catch (error) {
        console.error('Cancel membership error:', error);
        res.status(500).json({ error: 'Error al cancelar membresía' });
    }
});

// ============================================
// PATCH /api/memberships/:id/credits - Adjust credits (Admin)
// ============================================
router.patch('/:id/credits', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { classes_remaining } = req.body;

        if (classes_remaining === undefined || typeof classes_remaining !== 'number' || classes_remaining < 0) {
            return res.status(400).json({ error: 'classes_remaining debe ser un número >= 0' });
        }

        const membership = await queryOne('SELECT * FROM memberships WHERE id = $1', [id]);
        if (!membership) {
            return res.status(404).json({ error: 'Membresía no encontrada' });
        }

        const updated = await queryOne(
            `UPDATE memberships SET classes_remaining = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [classes_remaining, id]
        );

        res.json(updated);
    } catch (error) {
        console.error('Adjust credits error:', error);
        res.status(500).json({ error: 'Error al ajustar créditos' });
    }
});

export default router;
