import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { pool } from '../config/database.js';
import { optionalAuth, authenticate, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = Router();

// Compatibility endpoint for legacy frontend code that still calls /api/migrations/plans
router.get('/plans', optionalAuth, async (req: Request, res: Response) => {
    try {
        const canSeeAll = ['admin', 'super_admin'].includes(req.user?.role || '');
        const showAll = canSeeAll && req.query.all === 'true';

        let queryStr = `
            SELECT
                id, name, description, price, currency,
                duration_days, class_limit, features, is_active, sort_order
            FROM plans
        `;

        if (!showAll) {
            queryStr += ` WHERE is_active = true`;
        }

        queryStr += ` ORDER BY sort_order ASC, price ASC`;

        const plans = await query(queryStr);

        const normalized = plans.map((plan: any) => ({
            ...plan,
            duration: plan.duration_days,
            classes: plan.class_limit ?? -1,
            active: plan.is_active,
            type: 'membership',
        }));

        res.json(normalized);
    } catch (error) {
        console.error('Legacy migration plans error:', error);
        res.status(500).json({ error: 'Error al obtener planes para migración' });
    }
});

// POST /api/migrations/client - Migrate/register existing client with membership
router.post('/client', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const {
            name, email, phone, birthDate, packageId,
            originalPaymentDate, originalAmount, paymentMethod,
            receiptReference, startDate, endDate,
            classesAlreadyUsed, notes
        } = req.body;

        if (!name || !phone || !packageId) {
            return res.status(400).json({ error: 'Nombre, teléfono y plan son requeridos' });
        }

        // Get the plan
        const plan = await queryOne('SELECT * FROM plans WHERE id = $1', [packageId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if user exists by email or phone
            let userId: string | null = null;
            let tempPassword = '';

            if (email) {
                const existing = await client.query(
                    'SELECT id FROM users WHERE email = $1',
                    [email]
                );
                if (existing.rows.length > 0) {
                    userId = existing.rows[0].id;
                }
            }

            if (!userId && phone) {
                const existing = await client.query(
                    'SELECT id FROM users WHERE phone = $1',
                    [phone]
                );
                if (existing.rows.length > 0) {
                    userId = existing.rows[0].id;
                }
            }

            // Create user if doesn't exist
            if (!userId) {
                tempPassword = crypto.randomBytes(4).toString('hex');
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                const newUser = await client.query(`
                    INSERT INTO users (display_name, email, phone, birth_date, password_hash, role)
                    VALUES ($1, $2, $3, $4, $5, 'client')
                    RETURNING id
                `, [name, email || null, phone, birthDate || null, hashedPassword]);

                userId = newUser.rows[0].id;
            }

            // Calculate classes remaining
            const classesTotal = plan.class_limit || 0;
            const used = classesAlreadyUsed || 0;
            const remaining = classesTotal > 0 ? Math.max(classesTotal - used, 0) : null;

            // Create membership
            const membership = await client.query(`
                INSERT INTO memberships (
                    user_id, plan_id, start_date, end_date,
                    classes_remaining, status, payment_method,
                    payment_reference, is_migration, migration_notes,
                    classes_used_before_migration
                ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, true, $8, $9)
                RETURNING id
            `, [
                userId, packageId,
                startDate || new Date().toISOString(),
                endDate,
                remaining,
                paymentMethod || 'cash',
                receiptReference || null,
                notes || `Migración: $${originalAmount || plan.price} pagado ${originalPaymentDate || 'sin fecha'}`,
                classesAlreadyUsed || 0
            ]);

            await client.query('COMMIT');

            res.status(201).json({
                userId,
                packageId,
                membershipId: membership.rows[0].id,
                tempPassword: tempPassword || '(usuario existente)',
                success: true,
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Migrate client error:', error);
        res.status(500).json({ error: error.message || 'Error al migrar cliente' });
    }
});

// POST /api/migrations/assign - Assign membership to existing user
router.post('/assign', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const {
            userId, packageId,
            originalPaymentDate, originalAmount, paymentMethod,
            receiptReference, startDate, endDate,
            classesAlreadyUsed, notes
        } = req.body;

        if (!userId || !packageId) {
            return res.status(400).json({ error: 'Usuario y plan son requeridos' });
        }

        // Verify user exists
        const user = await queryOne('SELECT id, display_name FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Get plan
        const plan = await queryOne('SELECT * FROM plans WHERE id = $1', [packageId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        // Calculate classes remaining
        const classesTotal = plan.class_limit || 0;
        const used = classesAlreadyUsed || 0;
        const remaining = classesTotal > 0 ? Math.max(classesTotal - used, 0) : null;

        // Create membership
        const membership = await queryOne(`
            INSERT INTO memberships (
                user_id, plan_id, start_date, end_date,
                classes_remaining, status, payment_method,
                payment_reference, is_migration, migration_notes,
                classes_used_before_migration
            ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, true, $8, $9)
            RETURNING *
        `, [
            userId, packageId,
            startDate || new Date().toISOString(),
            endDate,
            remaining,
            paymentMethod || 'cash',
            receiptReference || null,
            notes || `Migración: $${originalAmount || plan.price} pagado ${originalPaymentDate || 'sin fecha'}`,
            classesAlreadyUsed || 0
        ]);

        res.status(201).json({
            success: true,
            membership,
            userName: user.display_name,
        });
    } catch (error: any) {
        console.error('Assign membership error:', error);
        res.status(500).json({ error: error.message || 'Error al asignar membresía' });
    }
});

// GET /api/migrations/history - Migration history
router.get('/history', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const records = await query(`
            SELECT
                m.id, m.user_id as "userId",
                u.display_name as "userName",
                u.email as "userEmail",
                u.phone as "userPhone",
                p.name as "packageName",
                m.payment_amount as "originalAmount",
                m.payment_date as "originalPaymentDate",
                m.created_at as "migratedAt",
                m.notes
            FROM memberships m
            JOIN users u ON m.user_id = u.id
            JOIN plans p ON m.plan_id = p.id
            WHERE m.is_migration = true
            ORDER BY m.created_at DESC
            LIMIT $1
        `, [limit]);

        res.json(records);
    } catch (error) {
        console.error('Migration history error:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// GET /api/migrations/stats - Membership stats
router.get('/stats', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const stats = await queryOne(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'active') as "totalActivas",
                COUNT(*) FILTER (WHERE status = 'active' AND is_migration = false) as "porVenta",
                COUNT(*) FILTER (WHERE status = 'active' AND is_migration = true) as "porMigracion",
                0 as "porPromo",
                0 as "porGift"
            FROM memberships
        `);

        res.json({
            totalActivas: parseInt(stats?.totalActivas || '0'),
            porVenta: parseInt(stats?.porVenta || '0'),
            porMigracion: parseInt(stats?.porMigracion || '0'),
            porPromo: parseInt(stats?.porPromo || '0'),
            porGift: parseInt(stats?.porGift || '0'),
        });
    } catch (error) {
        console.error('Migration stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

export default router;
