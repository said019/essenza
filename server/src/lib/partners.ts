import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { query, queryOne } from '../config/database.js';

export type PartnerChannel = 'wellhub' | 'totalpass';
export type PartnerCheckinMethod = 'automated' | 'attendance' | 'manual_panel' | 'manual_reception';

export const PARTNER_CHANNELS: PartnerChannel[] = ['wellhub', 'totalpass'];

export const CHECKIN_WINDOWS_MS: Record<PartnerChannel, number> = {
  totalpass: 90 * 60 * 1000,
  wellhub: 20 * 60 * 1000,
};

interface RawRequest extends Request {
  rawBody?: string;
}

export interface PlatformCredentials {
  channel: PartnerChannel;
  environment: 'sandbox' | 'production';
  is_enabled: boolean;
  api_base_url: string | null;
  booking_base_url: string | null;
  access_base_url: string | null;
  partner_api_key: string | null;
  place_api_key: string | null;
  api_key: string | null;
  api_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  webhook_secret: string | null;
  gym_id: string | null;
  webhook_url: string | null;
  extra_config: Record<string, any> | null;
}

interface PartnerIdentity {
  partnerId: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  planCode: string | null;
}

interface ClassLookupResult {
  id: string;
  date: string | Date;
  start_time: string;
  end_time: string;
  max_capacity: number;
  current_bookings: number;
  class_type_id: string;
  class_name?: string;
}

interface BookingLookupResult {
  id: string;
  class_id: string;
  user_id: string;
  channel: string;
  external_ref: string | null;
  status: string;
  class_date?: string | Date;
  class_start_time?: string;
}

export interface PartnerClassMapping {
  id: string;
  class_id: string;
  channel: PartnerChannel;
  external_class_id: string | null;
  external_slot_id: string | null;
  external_event_id: string | null;
  external_occurrence_id: string | null;
  sync_enabled: boolean;
  sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
  sync_error: string | null;
  last_synced_at: string | null;
  metadata: Record<string, any> | null;
}

class SimpleRateLimiter {
  private nextAvailableAt = 0;

  constructor(private readonly minTimeMs: number) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.minTimeMs;

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    return task();
  }
}

const outboundLimiters = {
  totalpass: new SimpleRateLimiter(200),
  wellhub: new SimpleRateLimiter(200),
  wellhubBatch: new SimpleRateLimiter(1200),
};

function parseJsonObject(input: unknown): Record<string, any> {
  if (!input) {
    return {};
  }

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

function sanitizeEmailLocalPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'partner';
}

function fallbackEmail(channel: PartnerChannel, partnerId: string): string {
  return `${sanitizeEmailLocalPart(partnerId)}@${channel}.walletclub.local`;
}

function fallbackPhone(): string {
  return '+520000000000';
}

function valueAtPath(payload: any, paths: string[]): any {
  for (const path of paths) {
    const parts = path.split('.');
    let current = payload;
    let found = true;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        found = false;
        break;
      }
    }

    if (found && current !== undefined && current !== null && current !== '') {
      return current;
    }
  }

  return null;
}

export function normalizeTimestamp(input: any): Date | null {
  if (!input) return null;

  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input;
  }

  if (typeof input === 'number') {
    const timestamp = input > 9_999_999_999 ? input : input * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof input === 'string') {
    const maybeNumber = Number(input);
    if (!Number.isNaN(maybeNumber) && input.trim() !== '') {
      return normalizeTimestamp(maybeNumber);
    }

    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizeDateOnly(input: any): string | null {
  const date = normalizeTimestamp(input);
  if (date) {
    return date.toISOString().slice(0, 10);
  }

  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  return null;
}

function normalizeTimeOnly(input: any): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  const date = normalizeTimestamp(trimmed);
  if (!date) {
    return null;
  }

  return date.toISOString().slice(11, 16);
}

function getSignatureCandidate(req: Request): string | null {
  const headerNames = [
    'x-wellhub-signature',
    'x-gympass-signature',
    'x-hub-signature',
    'x-signature',
    'x-totalpass-signature',
    'x-webhook-signature',
  ];

  for (const headerName of headerNames) {
    const value = req.header(headerName);
    if (value) return value;
  }

  return null;
}

function timingSafeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function requestJson<T = any>(
  url: string,
  init: RequestInit,
  limiter: SimpleRateLimiter,
  timeoutMs = 5000,
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  return limiter.schedule(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    let text: string;

    try {
      response = await fetch(url, { ...init, signal: controller.signal });
      text = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    let data: T | null = null;

    try {
      data = text ? JSON.parse(text) as T : null;
    } catch {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      text,
    };
  });
}

export async function getPlatformCredentials(channel: PartnerChannel): Promise<PlatformCredentials | null> {
  return queryOne<PlatformCredentials>(
    `SELECT
        channel,
        environment,
        is_enabled,
        api_base_url,
        booking_base_url,
        access_base_url,
        partner_api_key,
        place_api_key,
        api_key,
        api_secret,
        access_token,
        refresh_token,
        token_expires_at,
        webhook_secret,
        gym_id,
        webhook_url,
        extra_config
      FROM platform_credentials
      WHERE channel = $1`,
    [channel],
  );
}

export async function verifyPartnerWebhook(channel: PartnerChannel, req: Request): Promise<boolean> {
  const credentials = await getPlatformCredentials(channel);
  const configuredSecret = credentials?.webhook_secret?.trim();

  if (!configuredSecret) {
    return true;
  }

  const signature = getSignatureCandidate(req);
  const rawBody = (req as RawRequest).rawBody || JSON.stringify(req.body ?? {});

  if (channel === 'wellhub') {
    if (!signature) {
      return false;
    }

    const digest = createHmac('sha1', configuredSecret).update(rawBody).digest('hex');
    const normalizedSignature = signature.replace(/^sha1=/i, '');
    return timingSafeEquals(digest, normalizedSignature);
  }

  const authorization = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = signature || authorization || req.header('x-webhook-secret');
  if (!provided) {
    return false;
  }

  return timingSafeEquals(provided, configuredSecret);
}

export async function reserveProcessedEvent(
  eventId: string,
  channel: PartnerChannel,
  eventType: string,
  responseStatus: number | null = null,
  payloadHash: string | null = null,
): Promise<boolean> {
  try {
    await query(
      `INSERT INTO processed_events (event_id, channel, event_type, response_status, payload_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, channel, eventType, responseStatus, payloadHash],
    );
    return false;
  } catch (error: any) {
    if (error?.code === '23505') {
      return true;
    }
    throw error;
  }
}

export async function finalizeProcessedEvent(eventId: string, responseStatus: number): Promise<void> {
  await query(
    `UPDATE processed_events
     SET response_status = $2, processed_at = NOW()
     WHERE event_id = $1`,
    [eventId, responseStatus],
  );
}

export async function clearProcessedEvent(eventId: string): Promise<void> {
  await query(
    `DELETE FROM processed_events
     WHERE event_id = $1
       AND response_status IS NULL`,
    [eventId],
  );
}

export function buildWebhookEventId(
  channel: PartnerChannel,
  eventType: string,
  payload: any,
  fallbackSuffix?: string,
): string {
  const direct = valueAtPath(payload, [
    'id',
    'event_id',
    'eventId',
    'payload.id',
    'payload.event_id',
    'event_data.id',
  ]);

  if (direct) {
    return `${channel}:${eventType}:${String(direct)}`;
  }

  const userId = valueAtPath(payload, [
    'user_id',
    'user.id',
    'user.unique_token',
    'user.gpw_id',
    'event_data.user.unique_token',
    'event_data.user.gpw_id',
    'token',
    'user.token',
  ]) || fallbackSuffix || 'na';

  const timestamp = valueAtPath(payload, [
    'timestamp',
    'created_at',
    'createdAt',
    'checked_in_at',
    'checkin_at',
    'event_data.timestamp',
  ]) || new Date().toISOString();

  return `${channel}:${eventType}:${String(userId)}:${String(timestamp)}`;
}

function buildPartnerIdentity(channel: PartnerChannel, payload: any): PartnerIdentity {
  if (channel === 'wellhub') {
    const partnerId = String(valueAtPath(payload, [
      'event_data.user.unique_token',
      'event_data.user.gpw_id',
      'user.unique_token',
      'user.gpw_id',
      'unique_token',
      'gpw_id',
      'user_id',
    ]) || '').trim();

    const firstName = String(valueAtPath(payload, [
      'event_data.user.first_name',
      'user.first_name',
      'first_name',
    ]) || '').trim();

    const lastName = String(valueAtPath(payload, [
      'event_data.user.last_name',
      'user.last_name',
      'last_name',
    ]) || '').trim();

    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()
      || String(valueAtPath(payload, ['event_data.user.name', 'user.name', 'name']) || 'Cliente Wellhub').trim();

    return {
      partnerId,
      email: valueAtPath(payload, ['event_data.user.email', 'user.email', 'email']),
      phone: valueAtPath(payload, ['event_data.user.phone_number', 'user.phone_number', 'phone_number', 'phone']),
      displayName,
      planCode: String(valueAtPath(payload, ['product.id', 'event_data.product.id', 'plan_id']) || '').trim() || null,
    };
  }

  const partnerId = String(valueAtPath(payload, [
    'token',
    'user.token',
    'user.external_id',
    'external_user_id',
    'user_id',
  ]) || '').trim();

  const displayName = String(valueAtPath(payload, [
    'name',
    'user.name',
    'customer.name',
    'member.name',
  ]) || 'Cliente TotalPass').trim();

  return {
    partnerId,
    email: valueAtPath(payload, ['email', 'user.email', 'customer.email']),
    phone: valueAtPath(payload, ['phone', 'user.phone', 'customer.phone']),
    displayName,
    planCode: String(valueAtPath(payload, ['service_provider_plan_code', 'plan.code', 'plan_id']) || '').trim() || null,
  };
}

export async function findOrCreatePartnerUser(channel: PartnerChannel, payload: any): Promise<{ id: string; display_name: string; wellhub_id: string | null; totalpass_token: string | null; source: string }> {
  const identity = buildPartnerIdentity(channel, payload);

  if (!identity.partnerId) {
    throw new Error(`No se encontró el identificador único del usuario para ${channel}`);
  }

  const partnerColumn = channel === 'wellhub' ? 'wellhub_id' : 'totalpass_token';

  let existing = await queryOne<any>(
    `SELECT id, display_name, wellhub_id, totalpass_token, source
     FROM users
     WHERE ${partnerColumn} = $1`,
    [identity.partnerId],
  );

  if (existing) {
    await query(
      `UPDATE users
       SET display_name = COALESCE(NULLIF($2, ''), display_name),
           phone = COALESCE(NULLIF($3, ''), phone),
           platform_plan = COALESCE($4, platform_plan),
           updated_at = NOW()
       WHERE id = $1`,
      [existing.id, identity.displayName, identity.phone || null, identity.planCode],
    );

    return existing;
  }

  if (identity.email) {
    existing = await queryOne<any>(
      `SELECT id, display_name, wellhub_id, totalpass_token, source
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [identity.email],
    );

    if (existing) {
      await query(
        `UPDATE users
         SET ${partnerColumn} = $2,
             source = CASE WHEN source = 'app' THEN $3 ELSE source END,
             phone = COALESCE(NULLIF($4, ''), phone),
             platform_plan = COALESCE($5, platform_plan),
             updated_at = NOW()
         WHERE id = $1`,
        [existing.id, identity.partnerId, channel, identity.phone || null, identity.planCode],
      );

      existing[partnerColumn] = identity.partnerId;
      return existing;
    }
  }

  const inserted = await queryOne<any>(
    `INSERT INTO users (
        email,
        phone,
        display_name,
        ${partnerColumn},
        source,
        platform_plan
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, display_name, wellhub_id, totalpass_token, source`,
    [
      identity.email || fallbackEmail(channel, identity.partnerId),
      identity.phone || fallbackPhone(),
      identity.displayName,
      identity.partnerId,
      channel,
      identity.planCode,
    ],
  );

  return inserted;
}

export async function resolveClassForPartnerPayload(payload: any): Promise<ClassLookupResult | null> {
  const directClassId = valueAtPath(payload, [
    'class_id',
    'classId',
    'class.id',
    'booking.class_id',
    'event_data.class_id',
  ]);

  if (directClassId && typeof directClassId === 'string' && /^[0-9a-f-]{36}$/i.test(directClassId)) {
    const byId = await queryOne<ClassLookupResult>(
      `SELECT c.*, ct.name as class_name
       FROM classes c
       JOIN class_types ct ON ct.id = c.class_type_id
       WHERE c.id = $1`,
      [directClassId],
    );
    if (byId) return byId;
  }

  const mappedExternalId = valueAtPath(payload, [
    'event_data.slot.class_id',
    'event_data.slot.id',
    'slot.id',
    'slot_id',
    'slotId',
    'event.id',
    'event_id',
    'eventId',
    'occurrenceUuid',
    'event.occurrenceUuid',
  ]);

  if (mappedExternalId) {
    const byMapping = await queryOne<ClassLookupResult>(
      `SELECT c.*, ct.name as class_name
       FROM partner_class_mappings pcm
       JOIN classes c ON c.id = pcm.class_id
       JOIN class_types ct ON ct.id = c.class_type_id
       WHERE pcm.external_class_id = $1
          OR pcm.external_slot_id = $1
          OR pcm.external_event_id = $1
          OR pcm.external_occurrence_id = $1
       ORDER BY c.date ASC, c.start_time ASC
       LIMIT 1`,
      [String(mappedExternalId)],
    );
    if (byMapping) return byMapping;
  }

  const externalRef = valueAtPath(payload, ['external_ref', 'slot_id', 'slotId', 'booking_id', 'reservation_id']);
  if (externalRef) {
    const byBooking = await queryOne<ClassLookupResult>(
      `SELECT c.*, ct.name as class_name
       FROM bookings b
       JOIN classes c ON c.id = b.class_id
       JOIN class_types ct ON ct.id = c.class_type_id
       WHERE b.external_ref = $1
       ORDER BY b.created_at DESC
       LIMIT 1`,
      [String(externalRef)],
    );
    if (byBooking) return byBooking;
  }

  const dateOnly = normalizeDateOnly(valueAtPath(payload, [
    'starts_at',
    'start_at',
    'startDateTime',
    'class_date',
    'date',
    'event_data.starts_at',
  ]));

  const timeOnly = normalizeTimeOnly(valueAtPath(payload, [
    'starts_at',
    'start_at',
    'startDateTime',
    'start_time',
    'time',
    'event_data.starts_at',
  ]));

  if (dateOnly && timeOnly) {
    return queryOne<ClassLookupResult>(
      `SELECT c.*, ct.name as class_name
       FROM classes c
       JOIN class_types ct ON ct.id = c.class_type_id
       WHERE c.date = $1
         AND c.start_time::text LIKE $2
       ORDER BY c.created_at ASC
       LIMIT 1`,
      [dateOnly, `${timeOnly}%`],
    );
  }

  return null;
}

export function extractPartnerExternalRef(payload: any): string | null {
  const value = valueAtPath(payload, [
    'external_ref',
    'slot_id',
    'slotId',
    'booking_id',
    'booking.id',
    'reservation_id',
    'reservation.id',
    'event_occurrence_id',
  ]);

  return value ? String(value) : null;
}

export function extractPartnerMappingData(channel: PartnerChannel, payload: any): Partial<PartnerClassMapping> {
  if (channel === 'wellhub') {
    return {
      external_class_id: valueAtPath(payload, [
        'event_data.slot.class_id',
        'event_data.slot.classId',
        'slot.class_id',
        'slot.classId',
        'class_id',
        'classId',
      ])?.toString?.() || null,
      external_slot_id: valueAtPath(payload, [
        'event_data.slot.id',
        'slot.id',
        'slot_id',
        'slotId',
      ])?.toString?.() || null,
      metadata: parseJsonObject({
        product_id: valueAtPath(payload, ['product.id', 'event_data.product.id', 'plan_id']),
      }),
    };
  }

  return {
    external_event_id: valueAtPath(payload, [
      'event.id',
      'event_id',
      'eventId',
    ])?.toString?.() || null,
    external_occurrence_id: valueAtPath(payload, [
      'occurrenceUuid',
      'event.occurrenceUuid',
      'event.occurrence_uuid',
      'slot.occurrenceUuid',
      'slot.occurrence_uuid',
    ])?.toString?.() || null,
    external_slot_id: valueAtPath(payload, [
      'slot.id',
      'slot_id',
      'slotId',
    ])?.toString?.() || null,
    metadata: parseJsonObject({
      seat_external_reference: valueAtPath(payload, ['slot.seat.externalReference', 'slot.seat.external_reference']),
      confirmation_url: valueAtPath(payload, ['slot.confirmation_url', 'confirmation_url']),
    }),
  };
}

export async function upsertPartnerClassMapping(params: {
  classId: string;
  channel: PartnerChannel;
  external_class_id?: string | null;
  external_slot_id?: string | null;
  external_event_id?: string | null;
  external_occurrence_id?: string | null;
  sync_enabled?: boolean;
  metadata?: Record<string, any>;
}): Promise<PartnerClassMapping> {
  return queryOne<PartnerClassMapping>(
    `INSERT INTO partner_class_mappings (
        class_id,
        channel,
        external_class_id,
        external_slot_id,
        external_event_id,
        external_occurrence_id,
        sync_enabled,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, true), $8::jsonb)
      ON CONFLICT (class_id, channel) DO UPDATE
      SET external_class_id = COALESCE(EXCLUDED.external_class_id, partner_class_mappings.external_class_id),
          external_slot_id = COALESCE(EXCLUDED.external_slot_id, partner_class_mappings.external_slot_id),
          external_event_id = COALESCE(EXCLUDED.external_event_id, partner_class_mappings.external_event_id),
          external_occurrence_id = COALESCE(EXCLUDED.external_occurrence_id, partner_class_mappings.external_occurrence_id),
          sync_enabled = COALESCE(EXCLUDED.sync_enabled, partner_class_mappings.sync_enabled),
          metadata = COALESCE(partner_class_mappings.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
          updated_at = NOW()
      RETURNING *`,
    [
      params.classId,
      params.channel,
      params.external_class_id || null,
      params.external_slot_id || null,
      params.external_event_id || null,
      params.external_occurrence_id || null,
      params.sync_enabled ?? null,
      JSON.stringify(params.metadata || {}),
    ],
  ) as Promise<PartnerClassMapping>;
}

export async function getUpcomingPartnerMappings(limit = 100): Promise<(PartnerClassMapping & {
  class_date: string | Date;
  start_time: string;
  class_name: string;
  inventory_max_spots: number | null;
  inventory_booked_spots: number | null;
})[]> {
  return query(
    `SELECT
        pcm.*,
        c.date as class_date,
        c.start_time,
        ct.name as class_name,
        ci.max_spots as inventory_max_spots,
        ci.booked_spots as inventory_booked_spots
     FROM partner_class_mappings pcm
     JOIN classes c ON c.id = pcm.class_id
     JOIN class_types ct ON ct.id = c.class_type_id
     LEFT JOIN channel_inventory ci ON ci.class_id = pcm.class_id AND ci.channel = pcm.channel
     WHERE c.date >= CURRENT_DATE
     ORDER BY c.date ASC, c.start_time ASC
     LIMIT $1`,
    [limit],
  ) as Promise<any>;
}

export async function findPartnerBookingByExternalRef(channel: PartnerChannel, externalRef: string): Promise<BookingLookupResult | null> {
  return queryOne<BookingLookupResult>(
    `SELECT
        b.id,
        b.class_id,
        b.user_id,
        b.channel,
        b.external_ref,
        b.status,
        c.date as class_date,
        c.start_time as class_start_time
      FROM bookings b
      JOIN classes c ON c.id = b.class_id
      WHERE b.channel = $1
        AND b.external_ref = $2
      ORDER BY b.created_at DESC
      LIMIT 1`,
    [channel, externalRef],
  );
}

export async function findTodayPartnerBookingForUser(channel: PartnerChannel, userId: string): Promise<BookingLookupResult | null> {
  return queryOne<BookingLookupResult>(
    `SELECT
        b.id,
        b.class_id,
        b.user_id,
        b.channel,
        b.external_ref,
        b.status,
        c.date as class_date,
        c.start_time as class_start_time
      FROM bookings b
      JOIN classes c ON c.id = b.class_id
      WHERE b.channel = $1
        AND b.user_id = $2
        AND c.date = CURRENT_DATE
        AND b.status IN ('confirmed', 'checked_in')
      ORDER BY c.start_time ASC
      LIMIT 1`,
    [channel, userId],
  );
}

export async function ensureChannelCapacity(classId: string, channel: PartnerChannel): Promise<void> {
  const inventory = await queryOne<{ max_spots: number; booked_spots: number }>(
    `SELECT max_spots, booked_spots
     FROM channel_inventory
     WHERE class_id = $1 AND channel = $2`,
    [classId, channel],
  );

  if (!inventory) {
    throw new Error(`No hay inventario configurado para ${channel} en esta clase`);
  }

  if (inventory.booked_spots >= inventory.max_spots) {
    throw new Error(`La cuota de ${channel} para esta clase está llena`);
  }
}

export async function upsertPartnerBooking(params: {
  channel: PartnerChannel;
  classId: string;
  userId: string;
  externalRef: string | null;
  partnerMetadata?: Record<string, any>;
}): Promise<any> {
  if (params.externalRef) {
    const existing = await queryOne<any>(
      `SELECT *
       FROM bookings
       WHERE channel = $1
         AND external_ref = $2
       LIMIT 1`,
      [params.channel, params.externalRef],
    );

    if (existing) {
      return existing;
    }
  }

  const duplicateClassBooking = await queryOne<any>(
    `SELECT *
     FROM bookings
     WHERE class_id = $1
       AND user_id = $2
       AND status != 'cancelled'
     LIMIT 1`,
    [params.classId, params.userId],
  );

  if (duplicateClassBooking) {
    await query(
      `UPDATE bookings
       SET channel = $2,
           external_ref = COALESCE($3, external_ref),
           partner_metadata = COALESCE(partner_metadata, '{}'::jsonb) || $4::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        duplicateClassBooking.id,
        params.channel,
        params.externalRef,
        JSON.stringify(params.partnerMetadata || {}),
      ],
    );
    return { ...duplicateClassBooking, channel: params.channel, external_ref: params.externalRef };
  }

  await ensureChannelCapacity(params.classId, params.channel);

  return queryOne<any>(
    `INSERT INTO bookings (class_id, user_id, status, channel, external_ref, partner_metadata)
     VALUES ($1, $2, 'confirmed', $3, $4, $5::jsonb)
     RETURNING *`,
    [
      params.classId,
      params.userId,
      params.channel,
      params.externalRef,
      JSON.stringify(params.partnerMetadata || {}),
    ],
  );
}

export async function cancelPartnerBooking(bookingId: string, reason: string): Promise<void> {
  await query(
    `UPDATE bookings
     SET status = 'cancelled',
         cancelled_at = NOW(),
         cancellation_reason = $2,
         updated_at = NOW()
     WHERE id = $1
       AND status != 'cancelled'`,
    [bookingId, reason],
  );

  await query(
    `UPDATE checkins
     SET status = CASE WHEN status = 'confirmed' THEN status ELSE 'cancelled' END,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE booking_id = $1
       AND status IN ('pending', 'failed')`,
    [bookingId],
  );
}

export function ensureCheckinWithinWindow(channel: PartnerChannel, checkinTimestamp: Date): void {
  const allowedWindow = CHECKIN_WINDOWS_MS[channel];
  const elapsed = Date.now() - checkinTimestamp.getTime();

  if (elapsed > allowedWindow) {
    throw new Error(`Check-in expirado: ${channel} tiene ${allowedWindow / 60000} minutos`);
  }
}

export async function ensureSinglePartnerCheckinPerDay(userId: string, channel: PartnerChannel): Promise<void> {
  const existing = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM checkins
     WHERE user_id = $1
       AND channel = $2
       AND status = 'confirmed'
       AND validated_at::date = CURRENT_DATE`,
    [userId, channel],
  );

  if (Number(existing?.count || 0) > 0) {
    throw new Error(`El usuario ya tiene un check-in confirmado hoy en ${channel}`);
  }
}

export async function createPartnerCheckin(params: {
  bookingId: string | null;
  userId: string;
  classId: string | null;
  channel: PartnerChannel;
  externalRef?: string | null;
  platformEventId?: string | null;
  status?: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'failed';
  validationMethod?: PartnerCheckinMethod;
  payload?: Record<string, any>;
  createdAt?: Date | null;
}): Promise<any> {
  if (params.platformEventId) {
    const existing = await queryOne<any>(
      `SELECT * FROM checkins WHERE platform_event_id = $1`,
      [params.platformEventId],
    );
    if (existing) {
      return existing;
    }
  }

  return queryOne<any>(
    `INSERT INTO checkins (
        booking_id,
        user_id,
        class_id,
        channel,
        external_ref,
        platform_event_id,
        status,
        validation_method,
        payload,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, COALESCE($10, NOW()), NOW())
      RETURNING *`,
    [
      params.bookingId,
      params.userId,
      params.classId,
      params.channel,
      params.externalRef || null,
      params.platformEventId || null,
      params.status || 'pending',
      params.validationMethod || 'automated',
      JSON.stringify(params.payload || {}),
      params.createdAt || null,
    ],
  );
}

export async function markPartnerCheckinResult(params: {
  checkinId: string;
  status: 'confirmed' | 'failed' | 'expired' | 'cancelled';
  validationMethod: PartnerCheckinMethod;
  platformResponse?: any;
  errorMessage?: string | null;
}): Promise<void> {
  await query(
    `UPDATE checkins
     SET status = $2,
         validation_method = $3,
         validated_at = CASE WHEN $2 = 'confirmed' THEN NOW() ELSE validated_at END,
         cancelled_at = CASE WHEN $2 = 'cancelled' THEN NOW() ELSE cancelled_at END,
         validation_attempts = validation_attempts + 1,
         last_validation_error = $4,
         platform_response = COALESCE($5::jsonb, platform_response),
         updated_at = NOW()
     WHERE id = $1`,
    [
      params.checkinId,
      params.status,
      params.validationMethod,
      params.errorMessage || null,
      params.platformResponse ? JSON.stringify(params.platformResponse) : null,
    ],
  );
}

export async function validateWellhubVisit(params: {
  wellhubId: string;
  customCode?: string | null;
}): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const credentials = await getPlatformCredentials('wellhub');
  if (!credentials?.is_enabled) {
    throw new Error('Wellhub no está habilitado en configuración');
  }
  if (!credentials.access_token || !credentials.gym_id) {
    throw new Error('Faltan credenciales de Access Control para Wellhub');
  }

  const timeoutMs = Number(credentials.extra_config?.validation_timeout_ms || 900);
  const baseUrl = credentials.access_base_url
    || (credentials.environment === 'production'
      ? 'https://api.partners.gympass.com/access/v1'
      : 'https://apitesting.partners.gympass.com/access/v1');

  return requestJson(
    `${baseUrl.replace(/\/$/, '')}/validate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'X-Gym-Id': credentials.gym_id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gympass_id: params.wellhubId,
        ...(params.customCode ? { custom_code: params.customCode } : {}),
      }),
    },
    outboundLimiters.wellhub,
    timeoutMs,
  );
}

async function upsertWellhubCustomCode(method: 'POST' | 'PUT', wellhubId: string, customCode: string): Promise<void> {
  const credentials = await getPlatformCredentials('wellhub');
  if (!credentials?.is_enabled || !credentials.access_token || !credentials.gym_id) {
    return;
  }

  const baseUrl = credentials.access_base_url
    || (credentials.environment === 'production'
      ? 'https://api.partners.gympass.com/access/v1'
      : 'https://apitesting.partners.gympass.com/access/v1');

  const response = await requestJson(
    `${baseUrl.replace(/\/$/, '')}/code/${encodeURIComponent(wellhubId)}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'X-Gym-Id': credentials.gym_id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ custom_code: customCode }),
    },
    outboundLimiters.wellhub,
    Number(credentials.extra_config?.custom_code_timeout_ms || 5000),
  );

  if (!response.ok) {
    throw new Error(`Wellhub custom code error ${response.status}: ${response.text}`);
  }
}

export async function sendWellhubCustomCode(wellhubId: string, customCode: string): Promise<void> {
  await upsertWellhubCustomCode('POST', wellhubId, customCode);
}

export async function updateWellhubCustomCode(wellhubId: string, customCode: string): Promise<void> {
  await upsertWellhubCustomCode('PUT', wellhubId, customCode);
}

export async function deleteWellhubCustomCode(wellhubId: string): Promise<void> {
  const credentials = await getPlatformCredentials('wellhub');
  if (!credentials?.is_enabled || !credentials.access_token || !credentials.gym_id) {
    return;
  }

  const baseUrl = credentials.access_base_url
    || (credentials.environment === 'production'
      ? 'https://api.partners.gympass.com/access/v1'
      : 'https://apitesting.partners.gympass.com/access/v1');

  const response = await requestJson(
    `${baseUrl.replace(/\/$/, '')}/code/${encodeURIComponent(wellhubId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'X-Gym-Id': credentials.gym_id,
        'Content-Type': 'application/json',
      },
    },
    outboundLimiters.wellhub,
    Number(credentials.extra_config?.custom_code_timeout_ms || 5000),
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Wellhub custom code delete error ${response.status}: ${response.text}`);
  }
}

export async function getLatestWalletCodeForUser(userId: string): Promise<string | null> {
  const walletPass = await queryOne<{ serial_number: string }>(
    `SELECT serial_number
     FROM wallet_passes
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );

  return walletPass?.serial_number || null;
}

export async function validateTotalPassCheckin(params: {
  confirmationUrl?: string | null;
  payload?: any;
}): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const credentials = await getPlatformCredentials('totalpass');
  if (!credentials?.is_enabled) {
    throw new Error('TotalPass no está habilitado en configuración');
  }

  const confirmationUrl = params.confirmationUrl
    || valueAtPath(params.payload, ['confirmation_url', 'confirmationUrl', 'checkin.confirmation_url']);

  if (!confirmationUrl) {
    throw new Error('El payload de TotalPass no incluye confirmation_url');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (credentials.access_token) {
    headers.Authorization = `Bearer ${credentials.access_token}`;
  }
  if (credentials.place_api_key) {
    headers['x-place-api-key'] = credentials.place_api_key;
  }
  if (credentials.partner_api_key) {
    headers['x-partner-api-key'] = credentials.partner_api_key;
  }

  const timeoutMs = Number(credentials.extra_config?.validation_timeout_ms || 900);
  return requestJson(
    confirmationUrl,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(params.payload || {}),
    },
    outboundLimiters.totalpass,
    timeoutMs,
  );
}

export async function renewTotalPassToken(): Promise<void> {
  const credentials = await getPlatformCredentials('totalpass');

  if (!credentials?.is_enabled) {
    return;
  }

  if (!credentials.partner_api_key || !credentials.place_api_key) {
    throw new Error('Faltan place_api_key o partner_api_key para renovar TotalPass');
  }

  const baseUrl = credentials.booking_base_url || credentials.api_base_url || 'https://booking-api.totalpass.com';
  const response = await requestJson<any>(
    `${baseUrl.replace(/\/$/, '')}/partner/auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        place_api_key: credentials.place_api_key,
        partner_api_key: credentials.partner_api_key,
      }),
    },
    outboundLimiters.totalpass,
    Number(credentials.extra_config?.auth_timeout_ms || 5000),
  );

  if (!response.ok) {
    throw new Error(`No se pudo renovar token TotalPass (${response.status}) ${response.text}`);
  }

  const token = response.data?.token || response.data?.access_token || response.data?.jwt;
  if (!token) {
    throw new Error('Respuesta de TotalPass sin token');
  }

  await query(
    `UPDATE platform_credentials
     SET access_token = $2,
         token_expires_at = NOW() + INTERVAL '23 hours',
         updated_at = NOW()
     WHERE channel = $1`,
    ['totalpass', token],
  );
}

async function markPartnerClassMappingSyncResult(params: {
  classId: string;
  channel: PartnerChannel;
  status: 'synced' | 'failed' | 'skipped';
  error?: string | null;
}): Promise<void> {
  await query(
    `UPDATE partner_class_mappings
     SET sync_status = $3,
         sync_error = $4,
         last_synced_at = NOW(),
         updated_at = NOW()
     WHERE class_id = $1
       AND channel = $2`,
    [params.classId, params.channel, params.status, params.error || null],
  );
}

export async function syncWellhubAvailabilityForClass(classId: string): Promise<void> {
  const credentials = await getPlatformCredentials('wellhub');
  if (!credentials?.is_enabled || !credentials.access_token || !credentials.gym_id) {
    return;
  }

  const mapping = await queryOne<PartnerClassMapping>(
    `SELECT *
     FROM partner_class_mappings
     WHERE class_id = $1
       AND channel = 'wellhub'`,
    [classId],
  );

  if (!mapping?.sync_enabled) {
    return;
  }

  if (!mapping.external_class_id || !mapping.external_slot_id) {
    await markPartnerClassMappingSyncResult({
      classId,
      channel: 'wellhub',
      status: 'skipped',
      error: 'Faltan external_class_id o external_slot_id',
    });
    return;
  }

  const inventory = await queryOne<{ max_spots: number; booked_spots: number }>(
    `SELECT max_spots, booked_spots
     FROM channel_inventory
     WHERE class_id = $1
       AND channel = 'wellhub'`,
    [classId],
  );

  if (!inventory) {
    await markPartnerClassMappingSyncResult({
      classId,
      channel: 'wellhub',
      status: 'skipped',
      error: 'No existe inventario Wellhub para esta clase',
    });
    return;
  }

  const bookingBaseUrl = credentials.booking_base_url
    || credentials.api_base_url
    || (credentials.environment === 'production'
      ? 'https://api.partners.gympass.com/booking/v1'
      : 'https://apitesting.partners.gympass.com/booking/v1');

  const response = await requestJson(
    `${bookingBaseUrl.replace(/\/$/, '')}/gyms/${encodeURIComponent(credentials.gym_id)}/classes/${encodeURIComponent(mapping.external_class_id)}/slots/${encodeURIComponent(mapping.external_slot_id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        total_capacity: inventory.max_spots,
        total_booked: inventory.booked_spots,
      }),
    },
    outboundLimiters.wellhub,
    Number(credentials.extra_config?.sync_timeout_ms || 5000),
  );

  if (!response.ok) {
    await markPartnerClassMappingSyncResult({
      classId,
      channel: 'wellhub',
      status: 'failed',
      error: response.text || `Wellhub sync ${response.status}`,
    });
    throw new Error(`Wellhub availability sync error ${response.status}: ${response.text}`);
  }

  await markPartnerClassMappingSyncResult({
    classId,
    channel: 'wellhub',
    status: 'synced',
  });
}

export async function syncTotalPassAvailabilityForClass(classId: string): Promise<void> {
  const credentials = await getPlatformCredentials('totalpass');
  if (!credentials?.is_enabled) {
    return;
  }

  const mapping = await queryOne<PartnerClassMapping>(
    `SELECT *
     FROM partner_class_mappings
     WHERE class_id = $1
       AND channel = 'totalpass'`,
    [classId],
  );

  if (!mapping?.sync_enabled) {
    return;
  }

  if (!mapping.external_occurrence_id) {
    await markPartnerClassMappingSyncResult({
      classId,
      channel: 'totalpass',
      status: 'skipped',
      error: 'Falta external_occurrence_id',
    });
    return;
  }

  const inventory = await queryOne<{ max_spots: number; booked_spots: number }>(
    `SELECT max_spots, booked_spots
     FROM channel_inventory
     WHERE class_id = $1
       AND channel = 'totalpass'`,
    [classId],
  );

  if (!inventory) {
    await markPartnerClassMappingSyncResult({
      classId,
      channel: 'totalpass',
      status: 'skipped',
      error: 'No existe inventario TotalPass para esta clase',
    });
    return;
  }

  const baseUrl = credentials.booking_base_url || credentials.api_base_url || 'https://booking-api.totalpass.com';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (credentials.access_token) {
    headers.Authorization = `Bearer ${credentials.access_token}`;
  }
  if (credentials.place_api_key) {
    headers['x-place-api-key'] = credentials.place_api_key;
  }
  if (credentials.partner_api_key) {
    headers['x-partner-api-key'] = credentials.partner_api_key;
  }

  const metadata = parseJsonObject(mapping.metadata);
  const response = await requestJson(
    `${baseUrl.replace(/\/$/, '')}/partner/event-occurrence/${encodeURIComponent(mapping.external_occurrence_id)}/slot`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        slots: inventory.max_spots,
        ...(Array.isArray(metadata.availablePositions)
          ? { availablePositions: metadata.availablePositions }
          : {}),
      }),
    },
    outboundLimiters.totalpass,
    Number(credentials.extra_config?.sync_timeout_ms || 5000),
  );

  if (!response.ok) {
    await markPartnerClassMappingSyncResult({
      classId,
      channel: 'totalpass',
      status: 'failed',
      error: response.text || `TotalPass sync ${response.status}`,
    });
    throw new Error(`TotalPass availability sync error ${response.status}: ${response.text}`);
  }

  await markPartnerClassMappingSyncResult({
    classId,
    channel: 'totalpass',
    status: 'synced',
  });
}

export async function reconcilePartnerInventory(): Promise<void> {
  await query(
    `UPDATE channel_inventory ci
     SET booked_spots = COALESCE(src.booked_spots, 0),
         updated_at = NOW()
     FROM (
       SELECT class_id, channel, COUNT(*)::int AS booked_spots
       FROM bookings
       WHERE channel IN ('wellhub', 'totalpass')
         AND status IN ('confirmed', 'checked_in')
       GROUP BY class_id, channel
     ) src
     WHERE ci.class_id = src.class_id
       AND ci.channel = src.channel`,
  );

  await query(
    `UPDATE channel_inventory ci
     SET booked_spots = 0,
         updated_at = NOW()
     WHERE NOT EXISTS (
       SELECT 1
       FROM bookings b
       WHERE b.class_id = ci.class_id
         AND b.channel = ci.channel
         AND b.status IN ('confirmed', 'checked_in')
     )`,
  );
}

export async function syncPartnerAvailability(classId?: string): Promise<void> {
  const classes = classId
    ? await query<{ class_id: string; channel: PartnerChannel }>(
      `SELECT class_id, channel
       FROM partner_class_mappings
       WHERE class_id = $1
         AND sync_enabled = true`,
      [classId],
    )
    : await query<{ class_id: string; channel: PartnerChannel }>(
      `SELECT pcm.class_id, pcm.channel
       FROM partner_class_mappings pcm
       JOIN classes c ON c.id = pcm.class_id
       WHERE pcm.sync_enabled = true
         AND c.date >= CURRENT_DATE`,
    );

  for (const row of classes) {
    try {
      if (row.channel === 'wellhub') {
        await syncWellhubAvailabilityForClass(row.class_id);
      } else {
        await syncTotalPassAvailabilityForClass(row.class_id);
      }
    } catch (error) {
      console.error(`[Partners] Error syncing availability for ${row.channel} class ${row.class_id}:`, error);
    }
  }
}

export async function applyPartnerQuotasToFutureClasses(classTypeId: string): Promise<void> {
  const classType = await queryOne<{ totalpass_quota: number; wellhub_quota: number }>(
    `SELECT totalpass_quota, wellhub_quota
     FROM class_types
     WHERE id = $1`,
    [classTypeId],
  );

  if (!classType) {
    throw new Error('Tipo de clase no encontrado');
  }

  for (const channel of PARTNER_CHANNELS) {
    const newQuota = channel === 'totalpass' ? classType.totalpass_quota : classType.wellhub_quota;

    await query(
      `INSERT INTO channel_inventory (class_id, channel, max_spots)
       SELECT c.id, $2, $3
       FROM classes c
       WHERE c.class_type_id = $1
         AND c.date >= CURRENT_DATE
         AND $3 > 0
       ON CONFLICT (class_id, channel) DO UPDATE
       SET max_spots = EXCLUDED.max_spots,
           updated_at = NOW()`,
      [classTypeId, channel, newQuota],
    );

    if (newQuota === 0) {
      await query(
        `DELETE FROM channel_inventory ci
         USING classes c
         WHERE ci.class_id = c.id
           AND c.class_type_id = $1
           AND c.date >= CURRENT_DATE
           AND ci.channel = $2
           AND ci.booked_spots = 0`,
        [classTypeId, channel],
      );
    }
  }
}

export async function reportWellhubDailySummary(): Promise<void> {
  const credentials = await getPlatformCredentials('wellhub');
  const reportUrl = credentials?.extra_config?.events_report_url
    || credentials?.extra_config?.daily_report_url
    || credentials?.extra_config?.events_api_url;

  if (!credentials?.is_enabled || !reportUrl) {
    return;
  }

  const checkins = await query<{
    id: string;
    validated_at: string;
    user_id: string;
    class_name: string;
    class_date: string | Date;
    start_time: string;
    wellhub_id: string | null;
  }>(
    `SELECT
        c.id,
        c.validated_at,
        c.user_id,
        ct.name as class_name,
        cls.date as class_date,
        cls.start_time,
        u.wellhub_id
     FROM checkins c
     JOIN classes cls ON cls.id = c.class_id
     JOIN class_types ct ON ct.id = cls.class_type_id
     JOIN users u ON u.id = c.user_id
     WHERE c.channel = 'wellhub'
       AND c.status = 'confirmed'
       AND c.partner_reported_at IS NULL
       AND c.validated_at >= DATE_TRUNC('day', NOW() - INTERVAL '1 day')
       AND c.validated_at < DATE_TRUNC('day', NOW())
     ORDER BY c.validated_at ASC`,
  );

  if (checkins.length === 0) {
    return;
  }

  const response = await requestJson(
    reportUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(credentials.access_token ? { Authorization: `Bearer ${credentials.access_token}` } : {}),
        ...(credentials.gym_id ? { 'X-Gym-Id': credentials.gym_id } : {}),
      },
      body: JSON.stringify({
        generated_at: new Date().toISOString(),
        channel: 'wellhub',
        events: checkins.map((checkin) => ({
          event_type: 'other',
          event_subcategory: 'studio_checkin',
          occurred_at: checkin.validated_at,
          user_id: checkin.wellhub_id || checkin.user_id,
          title: checkin.class_name,
          metadata: {
            local_checkin_id: checkin.id,
            local_user_id: checkin.user_id,
            class_date: typeof checkin.class_date === 'string'
              ? checkin.class_date
              : checkin.class_date.toISOString().slice(0, 10),
            class_time: checkin.start_time,
          },
        })),
      }),
    },
    outboundLimiters.wellhubBatch,
    Number(credentials.extra_config?.events_timeout_ms || 10000),
  );

  if (!response.ok) {
    await query(
      `UPDATE checkins
       SET partner_report_status = 'failed',
           partner_report_error = $2,
           updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [checkins.map((checkin) => checkin.id), response.text || `Wellhub report ${response.status}`],
    );
    throw new Error(`Wellhub events report error ${response.status}: ${response.text}`);
  }

  await query(
    `UPDATE checkins
     SET partner_reported_at = NOW(),
         partner_report_status = 'reported',
         partner_report_error = NULL,
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [checkins.map((checkin) => checkin.id)],
  );
}
