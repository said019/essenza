import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { query, queryOne } from '../config/database.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

const PaymentCreateSchema = z.object({
    userId: z.string().uuid(),
    membershipId: z.string().uuid().optional(),
    amount: z.coerce.number().positive(),
    currency: z.string().min(3).max(3).default('MXN'),
    paymentMethod: z.enum(['cash', 'transfer', 'card', 'online']),
    reference: z.string().max(255).optional(),
    notes: z.string().max(500).optional(),
    status: z.enum(['completed', 'pending']).optional().default('completed'),
});

const buildPaymentsQuery = (status?: string, search?: string, startDate?: string, endDate?: string) => {
    let queryStr = `
    SELECT 
      p.id,
      p.user_id,
      p.membership_id,
      p.amount,
      p.currency,
      p.payment_method,
      p.reference,
      p.notes,
      p.status,
      p.processed_by,
      COALESCE(p.transaction_date, p.created_at) as created_at,
      u.display_name as user_name,
      u.email as user_email,
      pl.name as plan_name
    FROM payments p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN memberships m ON p.membership_id = m.id
    LEFT JOIN plans pl ON m.plan_id = pl.id
    WHERE 1=1
  `;

    const params: any[] = [];
    let paramCount = 1;

    if (status) {
        queryStr += ` AND p.status = $${paramCount++}`;
        params.push(status);
    }

    if (search) {
        queryStr += ` AND (
      u.display_name ILIKE $${paramCount} OR 
      u.email ILIKE $${paramCount}
    )`;
        params.push(`%${search}%`);
        paramCount++;
    }

    if (startDate) {
        queryStr += ` AND COALESCE(p.transaction_date, p.created_at) >= $${paramCount++}`;
        params.push(startDate);
    }

    if (endDate) {
        queryStr += ` AND COALESCE(p.transaction_date, p.created_at) <= $${paramCount++}`;
        params.push(endDate);
    }

    queryStr += ` ORDER BY COALESCE(p.transaction_date, p.created_at) DESC`;

    return { queryStr, params };
};

// ============================================
// GET /api/payments/transactions - List payments
// ============================================
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        const { status, search, startDate, endDate } = req.query;
        const { queryStr, params } = buildPaymentsQuery(
            status as string | undefined,
            search as string | undefined,
            startDate as string | undefined,
            endDate as string | undefined
        );
        const payments = await query(queryStr, params);
        res.json(payments);
    } catch (error) {
        console.error('List payments error:', error);
        res.status(500).json({ error: 'Error al listar pagos' });
    }
});

// ============================================
// GET /api/payments/pending - List pending payments
// ============================================
router.get('/pending', async (req: Request, res: Response) => {
    try {
        const { queryStr, params } = buildPaymentsQuery('pending');
        const payments = await query(queryStr, params);
        res.json(payments);
    } catch (error) {
        console.error('List pending payments error:', error);
        res.status(500).json({ error: 'Error al listar pagos pendientes' });
    }
});

// ============================================
// POST /api/payments/register - Register payment
// ============================================
router.post('/register', async (req: Request, res: Response) => {
    try {
        const validation = PaymentCreateSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const {
            userId,
            membershipId,
            amount,
            currency,
            paymentMethod,
            reference,
            notes,
            status,
        } = validation.data;

        const result = await queryOne(
            `INSERT INTO payments (
        user_id,
        membership_id,
        amount,
        currency,
        payment_method,
        reference,
        notes,
        status,
        processed_by,
        transaction_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
            [
                userId,
                membershipId || null,
                amount,
                currency,
                paymentMethod,
                reference || null,
                notes || null,
                status,
                req.user?.userId || null,
            ]
        );

        res.status(201).json(result);
    } catch (error) {
        console.error('Register payment error:', error);
        res.status(500).json({ error: 'Error al registrar pago' });
    }
});

// ============================================
// GET /api/payments/reports - Payments summary
// ============================================
router.get('/reports', async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const params: any[] = [];
        let dateFilter = '';
        let paramCount = 1;

        if (startDate) {
            dateFilter += ` AND COALESCE(transaction_date, created_at) >= $${paramCount++}`;
            params.push(startDate);
        }
        if (endDate) {
            dateFilter += ` AND COALESCE(transaction_date, created_at) <= $${paramCount++}`;
            params.push(endDate);
        }

        const totals = await queryOne<{
            total_amount: string;
            completed_amount: string;
            pending_amount: string;
            total_count: string;
            completed_count: string;
            pending_count: string;
        }>(
            `SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completed_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count
      FROM payments
      WHERE 1=1 ${dateFilter}`,
            params
        );

        const byMethod = await query<{ payment_method: string; total: string }>(
            `SELECT payment_method, COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE 1=1 ${dateFilter}
       GROUP BY payment_method
       ORDER BY total DESC`,
            params
        );

        res.json({
            total_amount: Number(totals?.total_amount || 0),
            completed_amount: Number(totals?.completed_amount || 0),
            pending_amount: Number(totals?.pending_amount || 0),
            total_count: Number(totals?.total_count || 0),
            completed_count: Number(totals?.completed_count || 0),
            pending_count: Number(totals?.pending_count || 0),
            by_method: byMethod.map((row) => ({
                payment_method: row.payment_method,
                total: Number(row.total),
            })),
        });
    } catch (error) {
        console.error('Payments report error:', error);
        res.status(500).json({ error: 'Error al generar reporte de pagos' });
    }
});

export default router;
