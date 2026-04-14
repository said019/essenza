import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// v2 — fixed date() SQL queries to use classes.date column directly
// Middleware to ensure admin access for all routes in this file
router.use(authenticate, requireRole('admin'));

// ============================================
// GET /api/admin/stats - Dashboard KPIs
// ============================================
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Parallel queries for efficiency - each wrapped to avoid one failure crashing all
        const safeQuery = async <T>(text: string, params?: any[]): Promise<T | null> => {
            try { return await queryOne<T>(text, params); } catch { return null; }
        };

        const [
            scheduledClasses,
            confirmedBookings,
            activeMemberships,
            todaysRevenue
        ] = await Promise.all([
            safeQuery<{ count: string }>(`
        SELECT COUNT(*) as count FROM classes 
        WHERE date = $1
      `, [today]),

            safeQuery<{ count: string }>(`
        SELECT COUNT(*) as count 
        FROM bookings b
        JOIN classes c ON b.class_id = c.id
        WHERE c.date = $1 AND b.status = 'confirmed'
      `, [today]),

            safeQuery<{ count: string }>(`
        SELECT COUNT(*) as count FROM memberships WHERE status = 'active'
      `),

            safeQuery<{ total: string }>(`
        SELECT COALESCE(SUM(total), 0) as total FROM (
          SELECT COALESCE(SUM(amount), 0) as total
          FROM payments
          WHERE created_at::date = $1 AND status = 'completed'
          UNION ALL
          SELECT COALESCE(SUM(amount), 0) as total
          FROM event_registrations
          WHERE paid_at::date = $1 AND status = 'confirmed'
        ) combined
      `, [today])
        ]);

        res.json({
            scheduledClasses: parseInt(scheduledClasses?.count || '0'),
            confirmedBookings: parseInt(confirmedBookings?.count || '0'),
            activeMemberships: parseInt(activeMemberships?.count || '0'),
            revenue: parseFloat(todaysRevenue?.total || '0')
        });

    } catch (error) {
        console.error('Admin stats error:', error);
        res.json({
            scheduledClasses: 0,
            confirmedBookings: 0,
            activeMemberships: 0,
            revenue: 0
        });
    }
});

// ============================================
// GET /api/admin/birthdays - Birthdays this month
// ============================================
router.get('/birthdays', async (req: Request, res: Response) => {
    try {
        const birthdays = await query(
            `SELECT id, display_name, email, phone, photo_url, date_of_birth
             FROM users
             WHERE role = 'client'
               AND date_of_birth IS NOT NULL
               AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
             ORDER BY EXTRACT(DAY FROM date_of_birth) ASC`
        );
        res.json(birthdays);
    } catch (error) {
        console.error('Get birthdays error:', error);
        res.status(500).json({ error: 'Error al obtener cumpleaños' });
    }
});

// ============================================
// GET /api/admin/clients/:id/full-profile - Full client details
// ============================================
router.get('/clients/:id/full-profile', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 1. Basic user info
        const user = await queryOne(`
      SELECT id, email, display_name, phone, photo_url, role,
             emergency_contact_name, emergency_contact_phone,
             health_notes, date_of_birth, created_at
      FROM users WHERE id = $1
    `, [id]);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // 2. Admin notes (internal notes about the client)
        const notes = await query(`
      SELECT an.*, u.display_name as author_name
      FROM admin_notes an
      LEFT JOIN users u ON an.created_by = u.id
      WHERE an.user_id = $1
      ORDER BY an.created_at DESC
    `, [id]);

        // 3. Memberships history with plan details
        const memberships = await query(`
      SELECT m.*,
             p.name as plan_name,
             p.price as plan_price,
             p.class_limit,
             m.classes_remaining as credits_remaining,
             p.class_limit as credits_total,
             p.price as price_paid
      FROM memberships m
      JOIN plans p ON m.plan_id = p.id
      WHERE m.user_id = $1
      ORDER BY m.created_at DESC
    `, [id]);

        // 4. Last 5 bookings with class type name
        const bookings = await query(`
      SELECT b.*,
             ct.name as class_name,
             c.date,
             c.start_time
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      WHERE b.user_id = $1
      ORDER BY c.date DESC, c.start_time DESC
      LIMIT 5
    `, [id]);

        // 5. Total loyalty points (sum of all points)
        const loyalty = await queryOne<{ total: string }>(`
      SELECT COALESCE(SUM(points), 0) as total
      FROM loyalty_points
      WHERE user_id = $1
    `, [id]);

        // 6. Get current active membership (prefer one with class credits over inscription-only)
        const currentMembership = await queryOne(`
      SELECT m.*,
             p.name as plan_name,
             p.price as plan_price,
             p.class_limit
      FROM memberships m
      JOIN plans p ON m.plan_id = p.id
      WHERE m.user_id = $1 AND m.status = 'active'
      ORDER BY
        CASE WHEN p.class_limit IS NOT NULL AND p.class_limit > 0 THEN 0 ELSE 1 END,
        m.end_date DESC
      LIMIT 1
    `, [id]);

        res.json({
            ...user,
            notes,
            memberships,
            currentMembership,
            recentBookings: bookings,
            loyaltyPoints: parseInt(loyalty?.total || '0', 10)
        });

    } catch (error) {
        console.error('Full profile error:', error);
        res.status(500).json({ error: 'Error al obtener perfil completo' });
    }
});

// ============================================
// POST /api/admin/clients/:id/notes - Add internal note
// ============================================
const NoteSchema = z.object({
    content: z.string().min(1, 'El contenido es requerido'),
});

router.post('/clients/:id/notes', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authorId = req.user?.userId;

        const validation = NoteSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: 'Contenido inválido' });
        }

        const newNote = await queryOne(`
      INSERT INTO admin_notes (user_id, created_by, note)
      VALUES ($1, $2, $3)
      RETURNING *, $2 as author_id
    `, [id, authorId, validation.data.content]);

        res.status(201).json(newNote);
    } catch (error) {
        console.error('Add note error:', error);
        res.status(500).json({ error: 'Error al agregar nota' });
    }
});

// ============================================
// GET /api/admin/notifications - Recent system activity feed
// ============================================
router.get('/notifications', async (req: Request, res: Response) => {
    try {
        // Combine recent events from payments, memberships, and bookings
        const notifications = await query(`
            (
                SELECT
                    p.id,
                    'payment' as type,
                    p.amount::text as title,
                    p.payment_method::text as detail,
                    p.status::text as status,
                    u.display_name as user_name,
                    p.created_at,
                    p.user_id
                FROM payments p
                JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
                LIMIT 10
            )
            UNION ALL
            (
                SELECT
                    m.id,
                    'membership' as type,
                    pl.name as title,
                    m.status::text as detail,
                    m.status::text as status,
                    u.display_name as user_name,
                    m.created_at,
                    m.user_id
                FROM memberships m
                JOIN users u ON m.user_id = u.id
                JOIN plans pl ON m.plan_id = pl.id
                ORDER BY m.created_at DESC
                LIMIT 10
            )
            UNION ALL
            (
                SELECT
                    b.id,
                    'booking' as type,
                    ct.name as title,
                    b.status::text as detail,
                    b.status::text as status,
                    u.display_name as user_name,
                    b.created_at,
                    b.user_id
                FROM bookings b
                JOIN users u ON b.user_id = u.id
                JOIN classes c ON b.class_id = c.id
                JOIN class_types ct ON c.class_type_id = ct.id
                ORDER BY b.created_at DESC
                LIMIT 10
            )
            ORDER BY created_at DESC
            LIMIT 20
        `);

        // Count unread (items from last 24 hours)
        const countResult = await queryOne<{ count: string }>(`
            SELECT (
                (SELECT COUNT(*) FROM payments WHERE created_at > NOW() - INTERVAL '24 hours') +
                (SELECT COUNT(*) FROM memberships WHERE created_at > NOW() - INTERVAL '24 hours') +
                (SELECT COUNT(*) FROM bookings WHERE created_at > NOW() - INTERVAL '24 hours')
            ) as count
        `);

        res.json({
            notifications,
            unreadCount: parseInt(countResult?.count || '0'),
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.json({ notifications: [], unreadCount: 0 });
    }
});

// ============================================
// POST /api/admin/physical-sale - Register physical sale (cash/transfer)
// ============================================
router.post('/physical-sale', async (req: Request, res: Response) => {
    try {
        const { userId, planId, paymentDate, amount, paymentMethod, reference, notes } = req.body;

        if (!userId || !planId) {
            return res.status(400).json({ error: 'Usuario y plan son requeridos' });
        }

        // Verify user
        const user = await queryOne('SELECT id, display_name FROM users WHERE id = $1', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Get plan
        const plan = await queryOne('SELECT * FROM plans WHERE id = $1', [planId]);
        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado' });
        }

        // Calculate dates
        const startDate = paymentDate || new Date().toISOString().split('T')[0];
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (plan.duration_days || 30));

        // Create membership
        const membership = await queryOne(`
            INSERT INTO memberships (
                user_id, plan_id, start_date, end_date,
                classes_remaining, status, payment_method, payment_reference
            ) VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
            RETURNING *
        `, [
            userId, planId, startDate, endDate.toISOString().split('T')[0],
            plan.class_limit || null,
            paymentMethod || 'cash',
            reference || null
        ]);

        // Create order record for reporting
        const order = await queryOne(`
            INSERT INTO orders (
                user_id, plan_id, subtotal, tax_amount, total_amount,
                currency, payment_method, customer_notes, status, paid_at, approved_at
            ) VALUES ($1, $2, $3, 0, $3, 'MXN', $4, $5, 'approved', NOW(), NOW())
            RETURNING *
        `, [userId, planId, amount || plan.price, paymentMethod || 'cash', notes || null]);

        res.status(201).json({
            success: true,
            membership,
            order,
            userName: user.display_name,
        });
    } catch (error) {
        console.error('Physical sale error:', error);
        res.status(500).json({ error: 'Error al registrar venta física' });
    }
});

export default router;
