import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, queryOne, pool } from '../config/database.js';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth.js';
import { applyDiscountToOrder } from './discount-codes.js';
import { sendMembershipActivatedEmail, sendOrderRejectedEmail } from '../services/email.js';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import { finalizeApprovedOrder } from '../lib/order-approval.js';
import {
    createMercadoPagoCheckoutPreference,
    mercadoPagoEnabled,
    syncMercadoPagoPaymentForOrder,
} from '../lib/mercadopago.js';

const router = Router();

let paymentProofColumnsCache: Set<string> | null = null;

async function getPaymentProofColumns(): Promise<Set<string>> {
    if (paymentProofColumnsCache) {
        return paymentProofColumnsCache;
    }

    const rows = await query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'payment_proofs'`
    );

    paymentProofColumnsCache = new Set(rows.map((row) => row.column_name));
    return paymentProofColumnsCache;
}

function getPaymentProofSelectFragments(columns: Set<string>) {
    const fileTypeExpr = columns.has('file_type')
        ? 'file_type'
        : columns.has('mime_type')
            ? 'mime_type AS file_type'
            : 'NULL::text AS file_type';

    const notesExpr = columns.has('additional_notes')
        ? 'additional_notes AS notes'
        : 'NULL::text AS notes';

    return { fileTypeExpr, notesExpr };
}

async function fetchPaymentProofs(orderId: string) {
    const columns = await getPaymentProofColumns();
    const { fileTypeExpr, notesExpr } = getPaymentProofSelectFragments(columns);

    return query(`
        SELECT
            id,
            file_url,
            file_name,
            ${fileTypeExpr},
            bank_reference as transfer_reference,
            ${notesExpr},
            uploaded_at
        FROM payment_proofs
        WHERE order_id = $1
        ORDER BY uploaded_at DESC
    `, [orderId]);
}

async function insertPaymentProof(
    client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
    params: {
        orderId: string;
        fileUrl: string;
        fileName: string;
        fileType: string;
        transferReference: string;
        notes: string;
    },
) {
    const columns = await getPaymentProofColumns();
    const insertColumns = ['order_id', 'file_url', 'file_name'];
    const values: any[] = [params.orderId, params.fileUrl, params.fileName];

    if (columns.has('file_type')) {
        insertColumns.push('file_type');
        values.push(params.fileType);
    } else if (columns.has('mime_type')) {
        insertColumns.push('mime_type');
        values.push(params.fileType);
    }

    if (columns.has('bank_reference')) {
        insertColumns.push('bank_reference');
        values.push(params.transferReference);
    }

    if (columns.has('additional_notes')) {
        insertColumns.push('additional_notes');
        values.push(params.notes);
    }

    if (columns.has('status')) {
        insertColumns.push('status');
        values.push('pending');
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
    const { fileTypeExpr, notesExpr } = getPaymentProofSelectFragments(columns);

    return client.query(`
        INSERT INTO payment_proofs (${insertColumns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING
            id,
            file_name,
            ${fileTypeExpr},
            bank_reference as transfer_reference,
            ${notesExpr},
            uploaded_at
    `, values);
}

async function markPaymentProofsRejected(
    client: { query: (sql: string, params?: any[]) => Promise<any> },
    params: {
        orderId: string;
        adminUserId: string;
        notes: string;
    },
) {
    const columns = await getPaymentProofColumns();
    const assignments = [`status = 'rejected'`];
    const values: any[] = [];

    if (columns.has('validated_by')) {
        values.push(params.adminUserId);
        assignments.push(`validated_by = $${values.length}`);
    } else if (columns.has('reviewed_by')) {
        values.push(params.adminUserId);
        assignments.push(`reviewed_by = $${values.length}`);
    }

    if (columns.has('validation_notes')) {
        values.push(params.notes);
        assignments.push(`validation_notes = $${values.length}`);
    } else if (columns.has('rejection_reason')) {
        values.push(params.notes);
        assignments.push(`rejection_reason = $${values.length}`);
    }

    if (columns.has('validated_at')) {
        assignments.push('validated_at = NOW()');
    } else if (columns.has('reviewed_at')) {
        assignments.push('reviewed_at = NOW()');
    }

    values.push(params.orderId);

    await client.query(`
        UPDATE payment_proofs
        SET ${assignments.join(', ')}
        WHERE order_id = $${values.length}
          AND status = 'pending'
    `, values);
}

// ============================================
// SCHEMAS
// ============================================

const CreateOrderSchema = z.object({
    plan_id: z.string().uuid(),
    payment_method: z.enum(['bank_transfer', 'card', 'transfer', 'cash']),
    notes: z.string().max(500).optional(),
    discount_code_id: z.string().uuid().optional(),
    discount_amount: z.number().min(0).optional(),
});

const UploadProofSchema = z.object({
    file_url: z.string().url().optional(),
    file_name: z.string().optional(),
    file_type: z.string().optional(),
    transfer_reference: z.string().max(100).optional(),
    transfer_date: z.string().optional(),
    notes: z.string().max(500).optional(),
});

const ApproveOrderSchema = z.object({
    admin_notes: z.string().max(500).optional(),
    adminNotes: z.string().max(500).optional(), // Legacy support
    startDate: z.string().optional(), // ISO date para inicio de membresía
});

const RejectOrderSchema = z.object({
    rejectionReason: z.string().max(500).optional(),
    admin_notes: z.string().max(500).optional(),
    adminNotes: z.string().max(500).optional(), // Legacy support
});

// ============================================
// GET /api/orders/bank-info - Public bank info
// ============================================
router.get('/bank-info', async (req: Request, res: Response) => {
    try {
        const setting = await queryOne(
            `SELECT value FROM system_settings WHERE key = 'bank_info'`
        );

        if (!setting) {
            return res.status(404).json({ error: 'Información bancaria no configurada' });
        }

        res.json(setting.value);
    } catch (error) {
        console.error('Get bank info error:', error);
        res.status(500).json({ error: 'Error al obtener información bancaria' });
    }
});

// ============================================
// GET /api/orders/stats - Admin dashboard stats
// ============================================
router.get('/stats', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const stats = await queryOne(`SELECT * FROM orders_dashboard_stats`);
        res.json(stats);
    } catch (error) {
        console.error('Get orders stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// ============================================
// GET /api/orders/pending - Admin pending orders
// ============================================
router.get('/pending', authenticate, requireRole('admin', 'super_admin', 'reception'), async (req: Request, res: Response) => {
    try {
        const orders = await query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.payment_method,
                o.subtotal,
                o.tax_amount as tax,
                o.total_amount as total,
                o.currency,
                o.customer_notes as notes,
                o.payment_provider,
                o.payment_intent_id,
                o.mp_checkout_url,
                o.mp_payment_id,
                o.mp_payment_status,
                o.mp_status_detail,
                o.created_at,
                o.paid_at,
                o.approved_at,
                o.rejected_at,
                o.rejection_reason,
                o.expires_at,
                u.id as user_id,
                u.display_name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                p.id as plan_id,
                p.name as plan_name,
                p.class_limit as plan_credits,
                p.duration_days as plan_duration_days
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN plans p ON o.plan_id = p.id
            WHERE o.status IN ('pending_payment', 'pending_verification')
            ORDER BY 
                CASE WHEN o.status = 'pending_verification' THEN 0 ELSE 1 END,
                o.created_at ASC
        `);

        // For each order, get its payment proofs
        const ordersWithProofs = await Promise.all(orders.map(async (order: any) => {
            const proofs = await fetchPaymentProofs(order.id);
            return { ...order, payment_proofs: proofs };
        }));

        res.json(ordersWithProofs);
    } catch (error) {
        console.error('Get pending orders error:', error);
        res.status(500).json({ error: 'Error al obtener órdenes pendientes' });
    }
});

// ============================================
// GET /api/orders/my-orders - Client's orders
// ============================================
router.get('/my-orders', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;

        const orders = await query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.payment_method,
                o.subtotal,
                o.tax_amount as tax,
                o.total_amount as total,
                o.currency,
                o.payment_provider,
                o.payment_intent_id,
                o.mp_checkout_url,
                o.mp_payment_id,
                o.mp_payment_status,
                o.mp_status_detail,
                o.created_at,
                o.approved_at,
                o.rejected_at,
                o.rejection_reason,
                o.expires_at,
                p.name as plan_name,
                p.class_limit as plan_classes,
                p.duration_days as plan_duration,
                pp.file_url as proof_url,
                pp.status as proof_status,
                pp.uploaded_at as proof_uploaded_at
            FROM orders o
            JOIN plans p ON o.plan_id = p.id
            LEFT JOIN LATERAL (
                SELECT * FROM payment_proofs 
                WHERE order_id = o.id 
                ORDER BY uploaded_at DESC 
                LIMIT 1
            ) pp ON true
            WHERE o.user_id = $1
            ORDER BY o.created_at DESC
        `, [userId]);

        res.json(orders);
    } catch (error) {
        console.error('Get my orders error:', error);
        res.status(500).json({ error: 'Error al obtener tus órdenes' });
    }
});

// ============================================
// GET /api/orders/:id - Order detail
// ============================================
router.get('/:id', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;

        const order = await queryOne(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.payment_method,
                o.subtotal,
                o.tax_amount as tax,
                o.total_amount as total,
                o.currency,
                o.customer_notes as notes,
                o.admin_notes,
                o.payment_provider,
                o.payment_intent_id,
                o.mp_checkout_url,
                o.mp_payment_id,
                o.mp_payment_status,
                o.mp_status_detail,
                o.created_at,
                o.paid_at,
                o.approved_at,
                o.rejected_at,
                o.rejection_reason,
                o.expires_at,
                u.id as user_id,
                u.display_name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                p.id as plan_id,
                p.name as plan_name,
                p.class_limit as plan_credits,
                p.duration_days as plan_duration_days
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN plans p ON o.plan_id = p.id
            WHERE o.id = $1
        `, [id]);

        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Verify ownership or admin
        if (role !== 'admin' && role !== 'super_admin' && order.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Get all proofs for this order
        const proofs = await fetchPaymentProofs(id);

        res.json({ ...order, payment_proofs: proofs });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Error al obtener orden' });
    }
});

// ============================================
// POST /api/orders - Create new order
// ============================================
router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
        const validation = CreateOrderSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { plan_id, payment_method, notes, discount_code_id, discount_amount } = validation.data;
        const userId = req.user?.userId;

        if (payment_method === 'card' && !(await mercadoPagoEnabled())) {
            return res.status(503).json({
                error: 'El pago con tarjeta no está disponible en este momento',
            });
        }

        // Get plan
        const plan = await queryOne(
            `SELECT * FROM plans WHERE id = $1 AND is_active = true`,
            [plan_id]
        );

        if (!plan) {
            return res.status(404).json({ error: 'Plan no encontrado o no disponible' });
        }

        // Calculate totals with discount
        const subtotal = parseFloat(plan.price);
        const taxAmount = 0;
        const appliedDiscount = discount_code_id && discount_amount ? Math.min(discount_amount, subtotal) : 0;
        const totalAmount = Math.max(subtotal - appliedDiscount, 0);

        // Check for existing pending order for same plan
        const existingOrder = await queryOne(`
            SELECT id, order_number FROM orders 
            WHERE user_id = $1 AND plan_id = $2 
            AND status IN ('pending_payment', 'pending_verification')
        `, [userId, plan_id]);

        if (existingOrder) {
            return res.status(409).json({ 
                error: 'Ya tienes una orden pendiente para este plan',
                existingOrderId: existingOrder.id,
                existingOrderNumber: existingOrder.order_number
            });
        }

        // Create order
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48); // 48 hrs to upload proof

        const order = await queryOne(`
            INSERT INTO orders (
                user_id, plan_id, subtotal, tax_rate, tax_amount, 
                total_amount, currency, payment_method, customer_notes, expires_at,
                discount_code_id, discount_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            userId,
            plan_id,
            subtotal,
            0, // tax_rate = 0 (absorbed by business)
            taxAmount,
            totalAmount,
            plan.currency || 'MXN',
            payment_method,
            notes || null,
            payment_method === 'bank_transfer' || payment_method === 'transfer' ? expiresAt : null,
            discount_code_id || null,
            appliedDiscount > 0 ? appliedDiscount : null,
        ]);

        let mercadoPagoCheckout: {
            checkout_url: string;
            preference_id: string;
            sandbox_checkout_url: string | null;
        } | null = null;

        if (payment_method === 'card') {
            try {
                const preference = await createMercadoPagoCheckoutPreference(order.id);
                mercadoPagoCheckout = {
                    checkout_url: preference.checkoutUrl,
                    preference_id: preference.preferenceId,
                    sandbox_checkout_url: preference.sandboxCheckoutUrl,
                };
            } catch (checkoutError) {
                await query(`DELETE FROM orders WHERE id = $1`, [order.id]);
                throw checkoutError;
            }
        }

        // Apply discount code (increment usage counter)
        if (discount_code_id && appliedDiscount > 0) {
            try {
                await applyDiscountToOrder(discount_code_id, order.id, appliedDiscount);
            } catch (discountError) {
                console.error('Error applying discount to order:', discountError);
                // Order still created, discount just not tracked
            }
        }

        // Return with plan info
        res.status(201).json({
            ...order,
            payment_provider: payment_method === 'card' ? 'mercadopago' : order.payment_provider || null,
            mp_checkout_url: mercadoPagoCheckout?.checkout_url || null,
            payment_intent_id: mercadoPagoCheckout?.preference_id || order.payment_intent_id || null,
            plan_name: plan.name,
            plan_classes: plan.class_limit,
            plan_duration: plan.duration_days,
            mercadoPagoCheckout,
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Error al crear orden' });
    }
});

// ============================================
// POST /api/orders/:id/mercadopago/checkout - Create or refresh Mercado Pago preference
// ============================================
router.post('/:id/mercadopago/checkout', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;

        const order = await queryOne<any>(
            `SELECT id, user_id, status, payment_method
             FROM orders
             WHERE id = $1`,
            [id],
        );

        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (role !== 'admin' && role !== 'super_admin' && order.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        if (order.status !== 'pending_payment') {
            return res.status(409).json({ error: 'La orden ya no está disponible para pago con tarjeta' });
        }

        const preference = await createMercadoPagoCheckoutPreference(id);

        res.json({
            message: 'Checkout Mercado Pago listo',
            checkout_url: preference.checkoutUrl,
            preference_id: preference.preferenceId,
            sandbox_checkout_url: preference.sandboxCheckoutUrl,
        });
    } catch (error: any) {
        console.error('Mercado Pago checkout error:', error);
        res.status(500).json({ error: error?.message || 'No se pudo iniciar el checkout con Mercado Pago' });
    }
});

// ============================================
// POST /api/orders/:id/mercadopago/sync - Sync latest MP payment for this order
// ============================================
router.post('/:id/mercadopago/sync', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;
        const paymentId = typeof req.body?.paymentId === 'string' ? req.body.paymentId : undefined;

        const order = await queryOne<any>(
            `SELECT id, user_id
             FROM orders
             WHERE id = $1`,
            [id],
        );

        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (role !== 'admin' && role !== 'super_admin' && order.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        const updatedOrder = await syncMercadoPagoPaymentForOrder(id, paymentId);
        res.json({
            message: 'Estado de Mercado Pago sincronizado',
            order: updatedOrder,
        });
    } catch (error: any) {
        console.error('Mercado Pago sync error:', error);
        res.status(500).json({ error: error?.message || 'No se pudo sincronizar el pago con Mercado Pago' });
    }
});

// ============================================
// POST /api/orders/:id/upload-proof - Upload payment proof
// ============================================
router.post('/:id/upload-proof', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;

        // Get form data - can be JSON or FormData
        const transfer_reference = req.body.transfer_reference || '';
        const transfer_date = req.body.transfer_date || null;
        const notes = req.body.notes || '';
        const file_data = req.body.file_data || null; // Base64 encoded file
        const file_name = req.body.file_name || 'comprobante';
        const file_type = req.body.file_type || 'image/jpeg';

        // Verify order ownership
        const order = await queryOne(
            `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (order.status !== 'pending_payment' && order.status !== 'pending_verification') {
            return res.status(400).json({ error: 'Esta orden ya no acepta comprobantes' });
        }

        // Store the file as base64 data URL or generate a proper file URL
        // For now, store the base64 directly (in production you'd upload to S3/cloud storage)
        let fileUrl = 'pending://upload';
        if (file_data) {
            // Store base64 data directly in DB (not ideal for production, but works)
            fileUrl = file_data;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create proof record
            const proof = await insertPaymentProof(client, {
                orderId: id,
                fileUrl,
                fileName: file_name,
                fileType: file_type,
                transferReference: transfer_reference,
                notes,
            });

            // Update order status
            await client.query(`
                UPDATE orders SET status = 'pending_verification', updated_at = NOW()
                WHERE id = $1
            `, [id]);

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Comprobante registrado exitosamente',
                proof: proof.rows[0],
                newStatus: 'pending_verification'
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Upload proof error:', error);
        res.status(500).json({ error: 'Error al subir comprobante' });
    }
});

// ============================================
// POST /api/orders/:id/approve - Admin approves order
// ============================================
router.post('/:id/approve', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user?.userId;

        const validation = ApproveOrderSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { adminNotes, admin_notes, startDate } = validation.data;
        const finalAdminNotes = admin_notes || adminNotes || null;

        const existingOrder = await queryOne(`SELECT id FROM orders WHERE id = $1`, [id]);
        if (!existingOrder) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        const result = await finalizeApprovedOrder({
            orderId: id,
            actorUserId: adminUserId,
            adminNotes: finalAdminNotes,
            startDate: startDate || null,
        });

        res.json({
            message: 'Orden aprobada exitosamente',
            order: result.order,
            membershipId: result.membershipId,
        });
    } catch (error: any) {
        console.error('Approve order error:', error.message, error.detail || '', error.stack);
        res.status(500).json({ error: 'Error al aprobar orden', detail: error.message });
    }
});

// ============================================
// POST /api/orders/:id/reject - Admin rejects order
// ============================================
router.post('/:id/reject', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminUserId = req.user?.userId;

        if (!adminUserId) {
            return res.status(401).json({ error: 'Sesión no válida' });
        }

        const validation = RejectOrderSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { rejectionReason, adminNotes, admin_notes } = validation.data;
        const notes = admin_notes || adminNotes || rejectionReason || '';

        // Get order
        const order = await queryOne(`SELECT * FROM orders WHERE id = $1`, [id]);

        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        if (order.status !== 'pending_verification') {
            return res.status(400).json({ error: 'Solo se pueden rechazar órdenes en verificación' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update order
            await client.query(`
                UPDATE orders SET 
                    status = 'rejected',
                    reviewed_by = $1,
                    reviewed_at = NOW(),
                    rejected_at = NOW(),
                    rejection_reason = $2,
                    admin_notes = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [adminUserId, notes, id]);

            // Update proof status
            await markPaymentProofsRejected(client, {
                orderId: id,
                adminUserId,
                notes,
            });

            // Log admin action
            await client.query(`
                INSERT INTO admin_actions (
                    admin_user_id, action_type, entity_type, entity_id,
                    description, new_data
                ) VALUES ($1, 'reject_order', 'order', $2, $3, $4)
            `, [
                adminUserId,
                id,
                `Orden ${order.order_number} rechazada`,
                JSON.stringify({ rejection_reason: notes })
            ]);

            await client.query('COMMIT');

            // Get updated order + user info for notifications
            const updatedOrder = await queryOne(`SELECT * FROM orders_with_details WHERE id = $1`, [id]);
            const orderUser = await queryOne<{ display_name: string; email: string; phone: string }>(
                `SELECT display_name, email, phone FROM users WHERE id = $1`,
                [order.user_id]
            );
            const plan = await queryOne<{ name: string }>(
                `SELECT name FROM plans WHERE id = $1`,
                [order.plan_id]
            );

            // Send rejection notifications (fire and forget)
            if (orderUser) {
                const planName = plan?.name || 'tu plan';
                const reasonText = notes ? `\n\nMotivo: ${notes}` : '';

                // Email
                sendOrderRejectedEmail({
                    to: orderUser.email,
                    clientName: orderUser.display_name,
                    orderNumber: order.order_number,
                    planName,
                    rejectionReason: notes || undefined,
                }).catch(err => console.error('Error sending rejection email:', err));

                // WhatsApp
                const whatsMsg = `❌ *Pago no aprobado*\n\n` +
                    `Hola ${orderUser.display_name},\n\n` +
                    `Tu comprobante de pago para la orden *#${order.order_number}* (${planName}) no fue aprobado.${reasonText}\n\n` +
                    `Puedes subir un nuevo comprobante o contactarnos para más información.\n\n` +
                    `¿Necesitas ayuda? Escríbenos 💬`;

                sendWhatsAppMessage(orderUser.phone, whatsMsg)
                    .catch(err => console.error('Error sending rejection WhatsApp:', err));
            }

            res.json({
                message: 'Orden rechazada',
                order: updatedOrder
            });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Reject order error:', error);
        res.status(500).json({ error: 'Error al rechazar orden' });
    }
});

// ============================================
// POST /api/orders/:id/cancel - Cancel order
// ============================================
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const role = req.user?.role;

        const order = await queryOne(`SELECT * FROM orders WHERE id = $1`, [id]);

        if (!order) {
            return res.status(404).json({ error: 'Orden no encontrada' });
        }

        // Check ownership or admin
        if (role !== 'admin' && role !== 'super_admin' && order.user_id !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        // Only allow cancellation of pending_payment orders (not pending_verification)
        // Admins can cancel any pending order
        if (role !== 'admin' && role !== 'super_admin') {
            if (order.status !== 'pending_payment') {
                return res.status(400).json({ error: 'No puedes cancelar una orden que ya está en revisión' });
            }
        } else {
            // Admins can cancel pending_payment or pending_verification
            if (order.status !== 'pending_payment' && order.status !== 'pending_verification') {
                return res.status(400).json({ error: 'Esta orden no puede ser cancelada' });
            }
        }

        await query(`
            UPDATE orders SET 
                status = 'cancelled',
                cancelled_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
        `, [id]);

        res.json({ message: 'Orden cancelada exitosamente' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Error al cancelar orden' });
    }
});

// ============================================
// GET /api/orders - List all orders (Admin)
// ============================================
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const { status, paymentMethod, startDate, endDate, search, limit = 50, offset = 0 } = req.query;

        let queryStr = `SELECT * FROM orders_with_details WHERE 1=1`;
        const params: any[] = [];
        let paramCount = 1;

        if (status) {
            queryStr += ` AND status = $${paramCount++}`;
            params.push(status);
        }

        if (paymentMethod) {
            queryStr += ` AND payment_method = $${paramCount++}`;
            params.push(paymentMethod);
        }

        if (startDate) {
            queryStr += ` AND created_at >= $${paramCount++}`;
            params.push(startDate);
        }

        if (endDate) {
            queryStr += ` AND created_at <= $${paramCount++}`;
            params.push(endDate);
        }

        if (search) {
            queryStr += ` AND (
                user_name ILIKE $${paramCount} OR
                user_email ILIKE $${paramCount} OR
                order_number ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
            paramCount++;
        }

        queryStr += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(limit, offset);

        const orders = await query(queryStr, params);

        res.json(orders);
    } catch (error) {
        console.error('List orders error:', error);
        res.status(500).json({ error: 'Error al listar órdenes' });
    }
});

export default router;
