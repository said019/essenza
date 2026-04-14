import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { query, queryOne } from '../config/database.js';
import { finalizeApprovedOrder } from './order-approval.js';

type MercadoPagoNotificationType = 'payment' | 'merchant_order' | 'unknown';

interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  frontendUrl: string;
  apiUrl: string;
  statementDescriptor: string;
}

interface OrderCheckoutContext {
  id: string;
  order_number: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  total_amount: string | number;
  currency: string;
  status: string;
  payment_method: string;
  user_email: string | null;
  user_name: string | null;
}

function parseJsonObject(input: unknown): Record<string, any> {
  if (!input) return {};

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof input === 'object' ? input as Record<string, any> : {};
}

async function requestMercadoPago<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const config = await getMercadoPagoConfig();
  if (!config.accessToken) {
    throw new Error('Mercado Pago no está configurado: falta access token');
  }

  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Mercado Pago respondió ${response.status}`);
  }

  return data as T;
}

function getHeader(req: Request, header: string): string {
  const value = req.header(header);
  return typeof value === 'string' ? value : '';
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeBaseUrl(url: string, fallback: string): string {
  const value = (url || fallback).trim();
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function extractSignaturePiece(headerValue: string, prefix: string): string {
  return headerValue
    .split(',')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${prefix}=`))
    ?.slice(prefix.length + 1) || '';
}

function extractNotificationType(req: Request): MercadoPagoNotificationType {
  const type = String(req.body?.type || req.body?.topic || req.query.type || req.query.topic || '').trim();

  if (type === 'payment') return 'payment';
  if (type === 'merchant_order') return 'merchant_order';
  return 'unknown';
}

function extractNotificationDataId(req: Request): string {
  const queryId = req.query['data.id'];

  if (typeof queryId === 'string' && queryId.trim()) {
    return queryId.trim().toLowerCase();
  }

  const bodyId = req.body?.data?.id || req.body?.id;
  if (bodyId) {
    return String(bodyId).trim().toLowerCase();
  }

  return '';
}

async function getStoredMercadoPagoConfig(): Promise<Record<string, any>> {
  const row = await queryOne<{ value: any }>(
    `SELECT value
     FROM system_settings
     WHERE key = 'mercadopago_config'`,
  );

  return parseJsonObject(row?.value);
}

async function getOrderCheckoutContext(orderId: string): Promise<OrderCheckoutContext | null> {
  return queryOne<OrderCheckoutContext>(
    `SELECT
        o.id,
        o.order_number,
        o.user_id,
        o.plan_id,
        p.name as plan_name,
        o.total_amount,
        o.currency,
        o.status,
        o.payment_method,
        u.email as user_email,
        u.display_name as user_name
     FROM orders o
     JOIN plans p ON p.id = o.plan_id
     JOIN users u ON u.id = o.user_id
     WHERE o.id = $1`,
    [orderId],
  );
}

async function markWebhookProcessed(eventKey: string): Promise<boolean> {
  const inserted = await queryOne<{ event_key: string }>(
    `INSERT INTO payment_webhook_events (provider, event_key, event_type, payload)
     VALUES ('mercadopago', $1, 'pending', '{}'::jsonb)
     ON CONFLICT (provider, event_key) DO NOTHING
     RETURNING event_key`,
    [eventKey],
  );

  return !inserted;
}

async function completeWebhookEvent(eventKey: string, eventType: string, payload: any): Promise<void> {
  await query(
    `UPDATE payment_webhook_events
     SET event_type = $2,
         payload = $3::jsonb,
         processed_at = NOW()
     WHERE provider = 'mercadopago'
       AND event_key = $1`,
    [eventKey, eventType, JSON.stringify(payload || {})],
  );
}

async function deleteWebhookReservation(eventKey: string): Promise<void> {
  await query(
    `DELETE FROM payment_webhook_events
     WHERE provider = 'mercadopago'
       AND event_key = $1
       AND processed_at IS NULL`,
    [eventKey],
  );
}

export async function getMercadoPagoConfig(): Promise<MercadoPagoConfig> {
  const stored = await getStoredMercadoPagoConfig();

  const frontendUrl = normalizeBaseUrl(
    process.env.FRONTEND_URL || stored.frontend_url || stored.frontendUrl || '',
    'http://localhost:5173',
  );
  const apiUrl = normalizeBaseUrl(
    process.env.API_URL || process.env.BACKEND_URL || stored.api_url || stored.apiUrl || '',
    `http://localhost:${process.env.PORT || '3001'}`,
  ).replace(/\/api$/i, '');

  return {
    accessToken: (process.env.MP_ACCESS_TOKEN || stored.access_token || stored.accessToken || '').trim(),
    publicKey: (process.env.MP_PUBLIC_KEY || stored.public_key || stored.publicKey || '').trim(),
    webhookSecret: (process.env.MP_WEBHOOK_SECRET || stored.webhook_secret || stored.webhookSecret || '').trim(),
    frontendUrl,
    apiUrl,
    statementDescriptor: String(
      process.env.MP_STATEMENT_DESCRIPTOR
      || stored.statement_descriptor
      || stored.statementDescriptor
      || 'WALLETCLUB',
    ).slice(0, 22),
  };
}

export async function mercadoPagoEnabled(): Promise<boolean> {
  const config = await getMercadoPagoConfig();
  return Boolean(config.accessToken);
}

export async function createMercadoPagoCheckoutPreference(orderId: string): Promise<{
  preferenceId: string;
  checkoutUrl: string;
  sandboxCheckoutUrl: string | null;
}> {
  const order = await getOrderCheckoutContext(orderId);

  if (!order) {
    throw new Error('Orden no encontrada');
  }

  if (!['pending_payment', 'pending_verification'].includes(order.status)) {
    throw new Error(`La orden ${order.order_number} ya no está disponible para pago`);
  }

  const config = await getMercadoPagoConfig();

  if (!config.accessToken) {
    throw new Error('Mercado Pago no está configurado: falta access token');
  }

  const orderUrl = `${config.frontendUrl}/app/orders/${order.id}`;
  const webhookUrl = `${config.apiUrl}/webhooks/mercadopago`;

  const preference = await requestMercadoPago<any>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      external_reference: order.id,
      statement_descriptor: config.statementDescriptor,
      notification_url: `${webhookUrl}?source=checkout`,
      back_urls: {
        success: `${orderUrl}?provider=mercadopago&checkout=success`,
        pending: `${orderUrl}?provider=mercadopago&checkout=pending`,
        failure: `${orderUrl}?provider=mercadopago&checkout=failure`,
      },
      auto_return: 'approved',
      payer: {
        email: order.user_email || undefined,
        name: order.user_name || undefined,
      },
      items: [
        {
          id: order.plan_id,
          title: order.plan_name,
          description: `Orden ${order.order_number}`,
          quantity: 1,
          currency_id: order.currency || 'MXN',
          unit_price: Number(order.total_amount),
        },
      ],
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        user_id: order.user_id,
      },
      payment_methods: {
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'atm' },
          { id: 'bank_transfer' },
        ],
      },
    }),
  });

  const checkoutUrl = String(preference.init_point || '').trim();
  const sandboxCheckoutUrl = preference.sandbox_init_point ? String(preference.sandbox_init_point) : null;

  if (!checkoutUrl) {
    throw new Error('Mercado Pago no devolvió init_point para la preferencia');
  }

  await query(
    `UPDATE orders
     SET payment_provider = 'mercadopago',
         payment_method = 'card',
         payment_intent_id = $2,
         mp_checkout_url = $3,
         provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || $4::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [
      order.id,
      preference.id || null,
      checkoutUrl,
      JSON.stringify({
        preference_id: preference.id || null,
        init_point: checkoutUrl,
        sandbox_init_point: sandboxCheckoutUrl,
        generated_at: new Date().toISOString(),
      }),
    ],
  );

  return {
    preferenceId: String(preference.id || ''),
    checkoutUrl,
    sandboxCheckoutUrl,
  };
}

export async function verifyMercadoPagoWebhook(req: Request): Promise<boolean> {
  const config = await getMercadoPagoConfig();
  if (!config.webhookSecret) {
    // Sin webhook secret configurado, aceptar el webhook sin verificar firma.
    // La seguridad se mantiene porque syncMercadoPagoPayment valida el pago
    // directamente con la API de MercadoPago antes de aprobar la orden.
    return true;
  }

  const signature = getHeader(req, 'x-signature');
  const requestId = getHeader(req, 'x-request-id');
  const ts = extractSignaturePiece(signature, 'ts');
  const v1 = extractSignaturePiece(signature, 'v1');
  const dataId = extractNotificationDataId(req);

  if (!ts || !v1 || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const digest = createHmac('sha256', config.webhookSecret).update(manifest).digest('hex');

  return safeEquals(digest, v1);
}

export async function syncMercadoPagoPayment(paymentId: string): Promise<any> {
  const payment = await requestMercadoPago<any>(`/v1/payments/${paymentId}`, {
    method: 'GET',
  });

  const orderId = String(
    payment?.external_reference
    || payment?.metadata?.order_id
    || '',
  ).trim();

  if (!orderId) {
    throw new Error(`El pago ${paymentId} no está ligado a una orden local`);
  }

  const providerPayload = {
    payment_id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    transaction_amount: payment.transaction_amount,
    date_approved: payment.date_approved,
    date_created: payment.date_created,
    payment_method_id: payment.payment_method_id,
    payment_type_id: payment.payment_type_id,
    installments: payment.installments,
    raw: payment,
  };

  if (payment.status === 'approved') {
    const finalized = await finalizeApprovedOrder({
      orderId,
      paymentMethod: 'card',
      paymentProvider: 'mercadopago',
      paymentIntentId: String(payment.order?.id || payment.preference_id || payment.id || ''),
      paymentReference: String(payment.id),
      providerStatus: payment.status || null,
      providerStatusDetail: payment.status_detail || null,
      providerPayload,
    });

    return finalized.order;
  }

  await query(
    `UPDATE orders
     SET payment_provider = 'mercadopago',
         payment_method = 'card',
         mp_payment_id = COALESCE($2, mp_payment_id),
         mp_payment_status = $3,
         mp_status_detail = $4,
         provider_metadata = COALESCE(provider_metadata, '{}'::jsonb) || $5::jsonb,
         provider_synced_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [
      orderId,
      payment.id ? String(payment.id) : null,
      payment.status || null,
      payment.status_detail || null,
      JSON.stringify(providerPayload),
    ],
  );

  const existingPayment = await queryOne<{ id: string }>(
    `SELECT id
     FROM payments
     WHERE provider = 'mercadopago'
       AND external_id = $1`,
    [String(payment.id)],
  );

  if (existingPayment) {
    await query(
      `UPDATE payments
       SET provider_status = $2,
           provider_payload = COALESCE(provider_payload, '{}'::jsonb) || $3::jsonb,
           reference = COALESCE(reference, $1)
       WHERE id = $4`,
      [
        String(payment.id),
        payment.status || null,
        JSON.stringify(providerPayload),
        existingPayment.id,
      ],
    );
  }

  return queryOne(
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
        p.class_limit as plan_credits,
        p.duration_days as plan_duration_days
     FROM orders o
     JOIN users u ON u.id = o.user_id
     JOIN plans p ON p.id = o.plan_id
     WHERE o.id = $1`,
    [orderId],
  );
}

export async function syncMercadoPagoPaymentForOrder(orderId: string, paymentId?: string): Promise<any> {
  const order = await queryOne<any>(
    `SELECT id, mp_payment_id
     FROM orders
     WHERE id = $1`,
    [orderId],
  );

  if (!order) {
    throw new Error('Orden no encontrada');
  }

  const targetPaymentId = String(paymentId || order.mp_payment_id || '').trim();
  if (!targetPaymentId) {
    throw new Error('La orden todavía no tiene un pago Mercado Pago ligado');
  }

  return syncMercadoPagoPayment(targetPaymentId);
}

export async function processMercadoPagoWebhook(req: Request): Promise<{ ignored?: boolean; eventKey?: string; order?: any }> {
  const eventType = extractNotificationType(req);
  const dataId = extractNotificationDataId(req);
  const action = String(req.body?.action || req.query.action || '').trim() || 'unknown';
  const eventKey = `${eventType}:${dataId}:${action}`;

  if (!dataId || eventType === 'unknown') {
    return { ignored: true };
  }

  const alreadyProcessed = await markWebhookProcessed(eventKey);
  if (alreadyProcessed) {
    return { ignored: true, eventKey };
  }

  try {
    if (eventType !== 'payment') {
      await completeWebhookEvent(eventKey, eventType, req.body);
      return { ignored: true, eventKey };
    }

    const order = await syncMercadoPagoPayment(dataId);
    await completeWebhookEvent(eventKey, eventType, req.body);
    return { eventKey, order };
  } catch (error) {
    await deleteWebhookReservation(eventKey);
    throw error;
  }
}
