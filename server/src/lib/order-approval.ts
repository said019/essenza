import { PoolClient } from 'pg';
import { pool, queryOne } from '../config/database.js';
import { sendMembershipActivatedEmail } from '../services/email.js';
import { sendMembershipActivatedNotice } from '../lib/whatsapp.js';
import { awardPaymentLoyaltyPoints } from './loyalty.js';
import { notifyMembershipRenewed } from './notifications.js';

interface ApprovalContext {
  orderId: string;
  actorUserId?: string | null;
  adminNotes?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  paymentIntentId?: string | null;
  paymentReference?: string | null;
  providerStatus?: string | null;
  providerStatusDetail?: string | null;
  providerPayload?: Record<string, any> | null;
  startDate?: string | Date | null;
}

interface FinalizedOrderResult {
  order: any;
  membershipId: string;
  paymentId: string | null;
  alreadyApproved: boolean;
}

async function getOrderDetail(orderId: string) {
  return queryOne<any>(
    `SELECT
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
        p.class_limit,
        p.duration_days as plan_duration_days
     FROM orders o
     JOIN plans p ON o.plan_id = p.id
     JOIN users u ON o.user_id = u.id
     WHERE o.id = $1`,
    [orderId],
  );
}

function normalizePaymentMethod(value?: string | null): 'cash' | 'transfer' | 'card' | 'online' | 'bank_transfer' {
  if (value === 'cash' || value === 'transfer' || value === 'card' || value === 'online' || value === 'bank_transfer') {
    return value;
  }

  return 'card';
}

async function upsertPaymentRecord(params: {
  client: PoolClient;
  order: any;
  membershipId: string;
  actorUserId?: string | null;
  paymentMethod: string;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  providerStatus?: string | null;
  providerPayload?: Record<string, any> | null;
}): Promise<{ id: string; inserted: boolean }> {
  const existing = await params.client.query<{ id: string }>(
    `SELECT id
     FROM payments
     WHERE order_id = $1
        OR ($2::text IS NOT NULL AND provider = $2 AND external_id = $3::text)
     ORDER BY created_at DESC
     LIMIT 1`,
    [params.order.id, params.paymentProvider || null, params.paymentReference || null],
  );

  const payload = JSON.stringify(params.providerPayload || {});

  if (existing.rows[0]?.id) {
    const updated = await params.client.query<{ id: string }>(
      `UPDATE payments
       SET membership_id = COALESCE(membership_id, $1),
           amount = $2,
           currency = $3,
           payment_method = $4,
           reference = COALESCE($5, reference),
           status = 'completed',
           processed_by = COALESCE($6, processed_by),
           transaction_date = COALESCE(transaction_date, NOW()),
           provider = COALESCE($7, provider),
           external_id = COALESCE($8, external_id),
           provider_status = COALESCE($9, provider_status),
           provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $10::jsonb
       WHERE id = $11
       RETURNING id`,
      [
        params.membershipId,
        params.order.total_amount,
        params.order.currency,
        normalizePaymentMethod(params.paymentMethod),
        params.paymentReference || null,
        params.actorUserId || null,
        params.paymentProvider || null,
        params.paymentReference || null,
        params.providerStatus || null,
        payload,
        existing.rows[0].id,
      ],
    );

    return { id: updated.rows[0].id, inserted: false };
  }

  const inserted = await params.client.query<{ id: string }>(
    `INSERT INTO payments (
        user_id,
        membership_id,
        order_id,
        amount,
        currency,
        payment_method,
        reference,
        notes,
        status,
        processed_by,
        transaction_date,
        provider,
        external_id,
        provider_status,
        provider_payload
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9, NOW(), $10, $11, $12, $13::jsonb)
     RETURNING id`,
    [
      params.order.user_id,
      params.membershipId,
      params.order.id,
      params.order.total_amount,
      params.order.currency,
      normalizePaymentMethod(params.paymentMethod),
      params.paymentReference || null,
      params.paymentProvider === 'mercadopago'
        ? 'Pago confirmado automáticamente por webhook Mercado Pago'
        : params.order.customer_notes || null,
      params.actorUserId || null,
      params.paymentProvider || null,
      params.paymentReference || null,
      params.providerStatus || null,
      payload,
    ],
  );

  return { id: inserted.rows[0].id, inserted: true };
}

export async function finalizeApprovedOrder(context: ApprovalContext): Promise<FinalizedOrderResult> {
  const client = await pool.connect();
  let shouldNotify = false;

  try {
    await client.query('BEGIN');

    const orderResult = await client.query<any>(
      `SELECT o.*, p.duration_days, p.class_limit, p.name as plan_name
       FROM orders o
       JOIN plans p ON o.plan_id = p.id
       WHERE o.id = $1
       FOR UPDATE`,
      [context.orderId],
    );

    const order = orderResult.rows[0];

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    if (!['pending_payment', 'pending_verification', 'approved'].includes(order.status)) {
      throw new Error(`No se puede aprobar una orden con estado: ${order.status}`);
    }

    const alreadyApproved = order.status === 'approved' && !!order.membership_id;

    const start = context.startDate ? new Date(context.startDate) : new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + Number(order.duration_days || 0));

    let membershipId = order.membership_id as string | null;

    if (!membershipId) {
      const membershipResult = await client.query<{ id: string }>(
        `INSERT INTO memberships (
            user_id, plan_id, status, classes_remaining,
            start_date, end_date, activated_by, activated_at,
            payment_method, order_id
         ) VALUES ($1, $2, 'active', $3, $4, $5, $6, NOW(), $7, $8)
         RETURNING id`,
        [
          order.user_id,
          order.plan_id,
          order.class_limit,
          start,
          end,
          context.actorUserId || null,
          normalizePaymentMethod(context.paymentMethod || order.payment_method),
          order.id,
        ],
      );

      membershipId = membershipResult.rows[0].id;
      shouldNotify = true;
    }

    await client.query(
      `UPDATE orders
       SET status = 'approved',
           membership_id = COALESCE(membership_id, $1),
           reviewed_by = COALESCE($2, reviewed_by),
           reviewed_at = COALESCE(reviewed_at, NOW()),
           approved_at = COALESCE(approved_at, NOW()),
           paid_at = COALESCE(paid_at, NOW()),
           admin_notes = COALESCE($3, admin_notes),
           payment_method = COALESCE($4, payment_method),
           payment_provider = COALESCE($5, payment_provider),
           payment_intent_id = COALESCE($6, payment_intent_id),
           mp_payment_id = COALESCE($7, mp_payment_id),
           mp_payment_status = COALESCE($8, mp_payment_status),
           mp_status_detail = COALESCE($9, mp_status_detail),
           provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || $10::jsonb,
           provider_synced_at = NOW(),
           updated_at = NOW()
       WHERE id = $11`,
      [
        membershipId,
        context.actorUserId || null,
        context.adminNotes || null,
        normalizePaymentMethod(context.paymentMethod || order.payment_method),
        context.paymentProvider || null,
        context.paymentIntentId || null,
        context.paymentReference || null,
        context.providerStatus || null,
        context.providerStatusDetail || null,
        JSON.stringify(context.providerPayload || {}),
        order.id,
      ],
    );

    await client.query(
      `UPDATE payment_proofs
       SET status = 'approved',
           reviewed_by = COALESCE($1, reviewed_by),
           reviewed_at = COALESCE(reviewed_at, NOW())
       WHERE order_id = $2
         AND status = 'pending'`,
      [context.actorUserId || null, order.id],
    );

    const paymentRecord = await upsertPaymentRecord({
      client,
      order,
      membershipId,
      actorUserId: context.actorUserId,
      paymentMethod: context.paymentMethod || order.payment_method,
      paymentProvider: context.paymentProvider,
      paymentReference: context.paymentReference,
      providerStatus: context.providerStatus,
      providerPayload: context.providerPayload,
    });

    if (paymentRecord.inserted) {
      await awardPaymentLoyaltyPoints({
        db: client,
        userId: order.user_id,
        paymentId: paymentRecord.id,
        amount: Number(order.total_amount),
        paymentMethod: context.paymentMethod || order.payment_method,
      }).catch((error) => {
        console.error('Loyalty points error:', error);
      });
    }

    if (context.actorUserId && !alreadyApproved) {
      await client.query(
        `INSERT INTO admin_actions (
            admin_user_id, action_type, entity_type, entity_id,
            description, new_data
         ) VALUES ($1, 'approve_order', 'order', $2, $3, $4)`,
        [
          context.actorUserId,
          order.id,
          `Orden ${order.order_number} aprobada - ${order.plan_name}`,
          JSON.stringify({ membership_id: membershipId, payment_provider: context.paymentProvider || null }),
        ],
      );
    }

    await client.query('COMMIT');

    const finalizedOrder = await getOrderDetail(order.id);

    if (!finalizedOrder) {
      throw new Error('No se pudo hidratar la orden aprobada');
    }

    if (shouldNotify) {
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      if (finalizedOrder.user_email) {
        sendMembershipActivatedEmail({
          to: finalizedOrder.user_email,
          clientName: finalizedOrder.user_name || 'Cliente',
          planName: finalizedOrder.plan_name,
          classesIncluded: finalizedOrder.class_limit || null,
          startDate: startStr,
          endDate: endStr,
        }).catch((error) => console.error('Email notification error:', error));
      }

      if (finalizedOrder.user_phone) {
        const prettyEnd = end.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        sendMembershipActivatedNotice(
          finalizedOrder.user_phone,
          finalizedOrder.user_name || 'Cliente',
          finalizedOrder.plan_name,
          finalizedOrder.class_limit || null,
          prettyEnd,
        ).catch((error) => console.error('WhatsApp notification error:', error));
      }

      notifyMembershipRenewed(membershipId).catch((error) => console.error('Wallet notification error:', error));
    }

    return {
      order: finalizedOrder,
      membershipId,
      paymentId: paymentRecord.id,
      alreadyApproved,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
