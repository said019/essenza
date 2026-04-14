import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth.js';
import { query, queryOne } from '../config/database.js';
import { notifyClassAttended } from '../lib/notifications.js';
import { sendWhatsAppMessage } from '../lib/whatsapp.js';
import {
  createPartnerCheckin,
  ensureCheckinWithinWindow,
  ensureSinglePartnerCheckinPerDay,
  getLatestWalletCodeForUser,
  markPartnerCheckinResult,
  validateTotalPassCheckin,
  validateWellhubVisit,
} from '../lib/partners.js';

const router = Router();

// ============================================
// SCHEMAS DE VALIDACIÓN
// ============================================

const CheckinRequestSchema = z.object({
  qrPayload: z.string().min(1),
  // Información del dispositivo (opcional, para tracking)
  deviceInfo: z.object({
    deviceId: z.string().optional(),
    deviceType: z.string().optional(),
    deviceModel: z.string().optional(),
    appVersion: z.string().optional(),
  }).optional(),
  // Geolocalización (opcional)
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
  }).optional(),
});

const SelfCheckinSchema = z.object({
  bookingId: z.string().uuid(),
  // Información del dispositivo
  deviceInfo: z.object({
    deviceId: z.string().optional(),
    deviceType: z.string().optional(),
    deviceModel: z.string().optional(),
    appVersion: z.string().optional(),
  }).optional(),
  // Geolocalización (requerida para self-checkin)
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
  }),
});

const ManualCheckinSchema = z.object({
  bookingId: z.string().uuid(),
  notes: z.string().optional(),
});

const QrPayloadSchema = z.object({
  t: z.literal('checkin'),
  m: z.string().uuid(),
  ms: z.string().uuid().nullable().optional(),
  e: z.number(),
  h: z.string().min(32),
});

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

const decodePayload = (payload: string) => {
  const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
  return JSON.parse(decoded) as unknown;
};

const computeHash = (userId: string, membershipId: string | null | undefined, expiresAt: number) => {
  const secret = process.env.CHECKIN_SECRET || 'walletclub-dev';
  const base = `${userId}:${membershipId || 'none'}:${expiresAt}:${secret}`;
  return createHash('sha256').update(base).digest('hex');
};

// Calcular distancia entre dos puntos usando Haversine
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Radio de la tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Obtener coordenadas del estudio desde settings
const getStudioLocation = async (): Promise<{ lat: number; lon: number }> => {
  const settings = await queryOne<{ value: { latitude: number; longitude: number } }>(
    `SELECT value FROM system_settings WHERE key = 'studio_location'`
  );
  if (settings?.value) {
    return {
      lat: settings.value.latitude,
      lon: settings.value.longitude,
    };
  }
  return {
    lat: parseFloat(process.env.BUSINESS_LATITUDE || '19.4326'),
    lon: parseFloat(process.env.BUSINESS_LONGITUDE || '-99.1332'),
  };
};

// Crear log de check-in
const createCheckinLog = async (params: {
  bookingId: string;
  userId: string;
  classId: string;
  membershipId: string | null;
  checkinMethod: string;
  checkedInBy: string | null;
  deviceInfo?: {
    deviceId?: string;
    deviceType?: string;
    deviceModel?: string;
    appVersion?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  ipAddress: string;
  userAgent: string;
  qrCode?: string;
  classStartTime: string;
  isFirstClass: boolean;
}) => {
  const studioLocation = await getStudioLocation();
  let distanceFromStudio: number | null = null;
  let isLate = false;
  let minutesEarlyLate = 0;

  // Calcular distancia si tenemos ubicación
  if (params.location) {
    distanceFromStudio = calculateDistance(
      params.location.latitude,
      params.location.longitude,
      studioLocation.lat,
      studioLocation.lon
    );
  }

  // Calcular si llegó tarde
  const classStart = new Date(params.classStartTime);
  const now = new Date();
  minutesEarlyLate = Math.round((classStart.getTime() - now.getTime()) / 60000);
  isLate = minutesEarlyLate < -10; // Más de 10 minutos tarde

  return queryOne(
    `INSERT INTO checkin_logs (
      booking_id, user_id, class_id, membership_id,
      checkin_method, checked_in_by,
      device_id, device_type, device_model, app_version,
      ip_address, user_agent,
      latitude, longitude, location_accuracy, distance_from_studio,
      qr_code_used, is_late, minutes_early_late, is_first_class
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING id`,
    [
      params.bookingId,
      params.userId,
      params.classId,
      params.membershipId,
      params.checkinMethod,
      params.checkedInBy,
      params.deviceInfo?.deviceId || null,
      params.deviceInfo?.deviceType || null,
      params.deviceInfo?.deviceModel || null,
      params.deviceInfo?.appVersion || null,
      params.ipAddress,
      params.userAgent,
      params.location?.latitude || null,
      params.location?.longitude || null,
      params.location?.accuracy || null,
      distanceFromStudio,
      params.qrCode || null,
      isLate,
      minutesEarlyLate,
      params.isFirstClass,
    ]
  );
};

// Verificar si es la primera clase del usuario
const isFirstClassForUser = async (userId: string): Promise<boolean> => {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM bookings WHERE user_id = $1 AND status = 'checked_in'`,
    [userId]
  );
  return parseInt(result?.count || '0') === 0;
};

// Otorgar puntos de lealtad por asistencia a clase
const awardCheckinPoints = async (userId: string, bookingId: string): Promise<void> => {
  try {
    // Verificar que no se hayan otorgado puntos ya para esta reserva
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM loyalty_points WHERE user_id = $1 AND related_booking_id = $2 AND type = 'class_attended'`,
      [userId, bookingId]
    );
    if (existing) return; // Ya se otorgaron puntos

    // Obtener configuración de lealtad
    const configRow = await queryOne<{ value: any }>(
      `SELECT value FROM system_settings WHERE key = 'loyalty_config'`
    );
    const config = configRow?.value || { points_per_class: 10 };
    const pointsToAward = config.points_per_class || 10;

    // Insertar registro de puntos
    await query(
      `INSERT INTO loyalty_points (user_id, points, type, description, related_booking_id)
       VALUES ($1, $2, 'class_attended', 'Puntos por asistencia a clase', $3)`,
      [userId, pointsToAward, bookingId]
    );

    // Actualizar balance del usuario
    await query(
      `UPDATE users SET loyalty_points = COALESCE(loyalty_points, 0) + $1 WHERE id = $2`,
      [pointsToAward, userId]
    );

    console.log(`Loyalty: +${pointsToAward} pts for user ${userId} (booking ${bookingId})`);

    // Send WhatsApp notification for points earned
    try {
      const notifSettings = await queryOne<{ value: any }>(
        "SELECT value FROM settings WHERE key = 'notification_settings'"
      );
      if (notifSettings?.value?.send_points_earned !== false) {
        const user = await queryOne<{ display_name: string; phone: string; loyalty_points: number }>(
          'SELECT display_name, phone, COALESCE(loyalty_points, 0) as loyalty_points FROM users WHERE id = $1',
          [userId]
        );
        if (user?.phone) {
          const msg = `🎉 *¡Ganaste Puntos!*\n\n` +
            `Hola ${user.display_name}!\n\n` +
            `Has ganado *${pointsToAward} puntos* de lealtad por asistir a tu clase.\n\n` +
            `Tu saldo actual: ${user.loyalty_points} puntos.\n\n` +
            `¡Sigue acumulando! 💪`;
          sendWhatsAppMessage(user.phone, msg).catch(() => {});
        }
      }
    } catch {}
  } catch (err) {
    console.error('Error awarding loyalty points:', err);
    // No lanzar error para no afectar el check-in
  }
};

const triggerPartnerAttendanceValidation = async (params: {
  bookingId: string;
  userId: string;
  classId: string;
  channel: string;
}) => {
  if (!['wellhub', 'totalpass'].includes(params.channel)) {
    return null;
  }

  let partnerCheckin = await queryOne<any>(
    `SELECT
       c.*,
       b.partner_metadata,
       u.wellhub_id
     FROM checkins c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN bookings b ON b.id = c.booking_id
     WHERE c.booking_id = $1
       AND c.channel = $2
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [params.bookingId, params.channel],
  );

  if (!partnerCheckin) {
    const bookingRow = await queryOne<{ partner_metadata: any }>(
      `SELECT partner_metadata
       FROM bookings
       WHERE id = $1`,
      [params.bookingId],
    );

    partnerCheckin = await createPartnerCheckin({
      bookingId: params.bookingId,
      userId: params.userId,
      classId: params.classId,
      channel: params.channel as 'wellhub' | 'totalpass',
      validationMethod: 'attendance',
      payload: bookingRow?.partner_metadata || {},
    });

    partnerCheckin.partner_metadata = bookingRow?.partner_metadata || {};
    if (params.channel === 'wellhub') {
      const user = await queryOne<{ wellhub_id: string | null }>(
        `SELECT wellhub_id FROM users WHERE id = $1`,
        [params.userId],
      );
      partnerCheckin.wellhub_id = user?.wellhub_id || null;
    }
  }

  if (partnerCheckin.status === 'confirmed') {
    return { status: 'already_confirmed' };
  }

  try {
    ensureCheckinWithinWindow(params.channel as 'wellhub' | 'totalpass', new Date(partnerCheckin.created_at));
    await ensureSinglePartnerCheckinPerDay(params.userId, params.channel as 'wellhub' | 'totalpass');
  } catch (error: any) {
    await markPartnerCheckinResult({
      checkinId: partnerCheckin.id,
      status: String(error?.message || '').includes('ya tiene un check-in') ? 'failed' : 'expired',
      validationMethod: 'attendance',
      errorMessage: error?.message || 'Validación de asistencia no permitida',
    });
    return {
      status: String(error?.message || '').includes('ya tiene un check-in') ? 'duplicate' : 'expired',
      error: error?.message,
    };
  }

  if (params.channel === 'wellhub') {
    if (!partnerCheckin.wellhub_id) {
      return { status: 'skipped', error: 'El usuario Wellhub no tiene wellhub_id' };
    }

    const customCode = await getLatestWalletCodeForUser(params.userId);
    const validation = await validateWellhubVisit({
      wellhubId: partnerCheckin.wellhub_id,
      customCode,
    });

    if (!validation.ok) {
      await markPartnerCheckinResult({
        checkinId: partnerCheckin.id,
        status: 'failed',
        validationMethod: 'attendance',
        platformResponse: validation.data || { raw: validation.text },
        errorMessage: validation.text || `Wellhub respondió ${validation.status}`,
      });
      return { status: 'failed', error: validation.text || `Wellhub ${validation.status}` };
    }

    await markPartnerCheckinResult({
      checkinId: partnerCheckin.id,
      status: 'confirmed',
      validationMethod: 'attendance',
      platformResponse: validation.data || { raw: validation.text },
    });

    return { status: 'confirmed' };
  }

  const confirmationUrl = partnerCheckin?.payload?.confirmation_url
    || partnerCheckin?.payload?.confirmationUrl
    || partnerCheckin?.partner_metadata?.confirmation_url
    || partnerCheckin?.partner_metadata?.confirmationUrl;

  if (!confirmationUrl) {
    return { status: 'skipped', error: 'No hay confirmation_url para TotalPass' };
  }

  const validation = await validateTotalPassCheckin({
    confirmationUrl,
    payload: partnerCheckin.payload || partnerCheckin.partner_metadata || {},
  });

  if (!validation.ok) {
    await markPartnerCheckinResult({
      checkinId: partnerCheckin.id,
      status: 'failed',
      validationMethod: 'attendance',
      platformResponse: validation.data || { raw: validation.text },
      errorMessage: validation.text || `TotalPass respondió ${validation.status}`,
    });
    return { status: 'failed', error: validation.text || `TotalPass ${validation.status}` };
  }

  await markPartnerCheckinResult({
    checkinId: partnerCheckin.id,
    status: 'confirmed',
    validationMethod: 'attendance',
    platformResponse: validation.data || { raw: validation.text },
  });

  return { status: 'confirmed' };
};

// ============================================
// ENDPOINTS
// ============================================

/**
 * POST /api/checkin/qr
 * Check-in via QR code (staff only)
 */
router.post('/qr', authenticate, requireRole('admin', 'instructor', 'reception'), async (req: Request, res: Response) => {
  try {
    const validation = CheckinRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.flatten().fieldErrors,
      });
    }

    let decodedPayload: unknown;
    try {
      decodedPayload = decodePayload(validation.data.qrPayload);
    } catch {
      return res.status(400).json({ error: 'QR inválido' });
    }

    const payloadValidation = QrPayloadSchema.safeParse(decodedPayload);
    if (!payloadValidation.success) {
      // Check if it's an event QR scanned in the wrong mode
      if (decodedPayload && typeof decodedPayload === 'object' && (decodedPayload as any).t === 'event_checkin') {
        return res.status(400).json({ error: 'Este QR es para un evento. Usa el check-in de eventos.' });
      }
      return res.status(400).json({ error: 'QR inválido' });
    }

    const { m: userId, ms: membershipId, e: expiresAt, h: hash } = payloadValidation.data;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > expiresAt) {
      return res.status(400).json({ error: 'QR expirado' });
    }

    const expectedHash = computeHash(userId, membershipId, expiresAt);
    if (expectedHash !== hash) {
      return res.status(400).json({ error: 'QR inválido' });
    }

    const booking = await queryOne<{
      booking_id: string;
      booking_status: string;
      waitlist_position: number | null;
      checked_in_at: string | null;
      user_id: string;
      channel: string;
      display_name: string;
      email: string;
      photo_url: string | null;
      membership_id: string | null;
      class_id: string;
      class_date: string;
      class_start_time: string;
      class_end_time: string;
      max_capacity: number;
      current_bookings: number;
      class_name: string;
      instructor_name: string;
    }>(
      `SELECT
         b.id as booking_id,
         b.status as booking_status,
         b.channel,
         b.waitlist_position,
         b.checked_in_at,
         b.user_id,
         u.display_name,
         u.email,
         u.photo_url,
         b.membership_id,
         c.id as class_id,
         c.date as class_date,
         c.start_time as class_start_time,
         c.end_time as class_end_time,
         c.max_capacity,
         c.current_bookings,
         ct.name as class_name,
         i.display_name as instructor_name
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN classes c ON b.class_id = c.id
       JOIN class_types ct ON c.class_type_id = ct.id
       JOIN instructors i ON c.instructor_id = i.id
       WHERE b.user_id = $1
         AND b.status IN ('confirmed', 'waitlist', 'checked_in')
         AND (c.date + c.start_time) BETWEEN NOW() - INTERVAL '30 minutes' AND NOW() + INTERVAL '30 minutes'
       ORDER BY ABS(EXTRACT(EPOCH FROM ((c.date + c.start_time) - NOW()))) ASC
       LIMIT 1`,
      [userId]
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró una reserva válida para esta clase',
      });
    }

    if (membershipId && booking.membership_id !== membershipId) {
      return res.status(400).json({ success: false, error: 'QR no coincide con la reserva' });
    }

    if (booking.booking_status === 'checked_in') {
      return res.json({
        success: true,
        message: 'Cliente ya registrado',
        alreadyCheckedIn: true,
        member: {
          id: booking.user_id,
          name: booking.display_name,
          email: booking.email,
          photo: booking.photo_url,
        },
        class: {
          id: booking.class_id,
          name: booking.class_name,
          date: booking.class_date,
          start_time: booking.class_start_time,
          instructor: booking.instructor_name,
        },
        booking: {
          id: booking.booking_id,
          status: booking.booking_status,
          checked_in_at: booking.checked_in_at
        },
      });
    }

    const availableSpots = booking.max_capacity - booking.current_bookings;
    if (booking.booking_status === 'waitlist' && availableSpots <= 0) {
      return res.status(409).json({
        success: false,
        error: 'Sin lugares disponibles, sigues en lista de espera',
        waitlistPosition: booking.waitlist_position,
      });
    }

    // Verificar si es primera clase
    const firstClass = await isFirstClassForUser(booking.user_id);

    // Actualizar booking
    const updated = await queryOne<{
      id: string;
      status: string;
      checked_in_at: string;
    }>(
      `UPDATE bookings
       SET status = 'checked_in',
           checked_in_at = NOW(),
           checked_in_by = $1
       WHERE id = $2
       RETURNING id, status, checked_in_at`,
      [req.user?.userId || null, booking.booking_id]
    );

    // Crear log de check-in
    await createCheckinLog({
      bookingId: booking.booking_id,
      userId: booking.user_id,
      classId: booking.class_id,
      membershipId: booking.membership_id,
      checkinMethod: 'qr_scan',
      checkedInBy: req.user?.userId || null,
      deviceInfo: validation.data.deviceInfo,
      location: validation.data.location,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      qrCode: validation.data.qrPayload,
      classStartTime: `${booking.class_date}T${booking.class_start_time}`,
      isFirstClass: firstClass,
    });

    // Notificar al pase de Apple Wallet (actualiza clases restantes)
    if (booking.membership_id) {
      const membership = await queryOne<{ classes_remaining: number }>(
        `SELECT classes_remaining FROM memberships WHERE id = $1`,
        [booking.membership_id]
      );
      if (membership) {
        // Notificar en background (no bloquear respuesta)
        notifyClassAttended(booking.membership_id, membership.classes_remaining + 1, membership.classes_remaining)
          .catch(err => console.error('Error notifying wallet:', err));
      }
    }

    // Otorgar puntos de lealtad
    await awardCheckinPoints(booking.user_id, booking.booking_id);

    const partnerValidation = await triggerPartnerAttendanceValidation({
      bookingId: booking.booking_id,
      userId: booking.user_id,
      classId: booking.class_id,
      channel: booking.channel,
    });

    res.json({
      success: true,
      message: firstClass ? '¡Bienvenido a tu primera clase!' : 'Check-in exitoso',
      isFirstClass: firstClass,
      member: {
        id: booking.user_id,
        name: booking.display_name,
        email: booking.email,
        photo: booking.photo_url,
      },
      class: {
        id: booking.class_id,
        name: booking.class_name,
        date: booking.class_date,
        start_time: booking.class_start_time,
        instructor: booking.instructor_name,
      },
      booking: updated,
      partnerValidation,
    });
  } catch (error) {
    console.error('QR check-in error:', error);
    res.status(500).json({ error: 'Error al procesar check-in' });
  }
});

/**
 * POST /api/checkin/self
 * Self check-in desde la app (requiere geolocalización)
 */
router.post('/self', authenticate, async (req: Request, res: Response) => {
  try {
    const validation = SelfCheckinSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Verificar configuración de self-checkin
    const settings = await queryOne<{ value: { self_checkin_enabled: boolean; self_checkin_radius_meters: number } }>(
      `SELECT value FROM system_settings WHERE key = 'checkin_settings'`
    );

    const selfCheckinEnabled = settings?.value?.self_checkin_enabled ?? true;
    const maxRadius = settings?.value?.self_checkin_radius_meters ?? 200;

    if (!selfCheckinEnabled) {
      return res.status(403).json({ error: 'Self check-in no está habilitado' });
    }

    // Verificar distancia del estudio
    const studioLocation = await getStudioLocation();
    const distance = calculateDistance(
      validation.data.location.latitude,
      validation.data.location.longitude,
      studioLocation.lat,
      studioLocation.lon
    );

    if (distance > maxRadius) {
      return res.status(403).json({
        error: 'Debes estar en el estudio para hacer check-in',
        distance: Math.round(distance),
        maxRadius,
      });
    }

    // Buscar booking
    const booking = await queryOne<{
      booking_id: string;
      booking_status: string;
      user_id: string;
      membership_id: string | null;
      class_id: string;
      class_date: string;
      class_start_time: string;
      class_end_time: string;
      max_capacity: number;
      current_bookings: number;
      class_name: string;
      instructor_name: string;
    }>(
      `SELECT
         b.id as booking_id,
         b.status as booking_status,
         b.user_id,
         b.membership_id,
         c.id as class_id,
         c.date as class_date,
         c.start_time as class_start_time,
         c.end_time as class_end_time,
         c.max_capacity,
         c.current_bookings,
         ct.name as class_name,
         i.display_name as instructor_name
       FROM bookings b
       JOIN classes c ON b.class_id = c.id
       JOIN class_types ct ON c.class_type_id = ct.id
       JOIN instructors i ON c.instructor_id = i.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [validation.data.bookingId, userId]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (booking.booking_status === 'checked_in') {
      return res.json({ success: true, message: 'Ya hiciste check-in', alreadyCheckedIn: true });
    }

    if (booking.booking_status !== 'confirmed') {
      return res.status(400).json({ error: 'No puedes hacer check-in con este estado de reserva' });
    }

    // Verificar que la clase sea dentro de los próximos 30 minutos o hace menos de 10 minutos
    const classStart = new Date(`${booking.class_date}T${booking.class_start_time}`);
    const now = new Date();
    const diffMinutes = (classStart.getTime() - now.getTime()) / 60000;

    if (diffMinutes > 30) {
      return res.status(400).json({ error: 'Muy temprano para hacer check-in. Intenta 30 minutos antes de la clase.' });
    }

    if (diffMinutes < -15) {
      return res.status(400).json({ error: 'El tiempo para check-in ha pasado' });
    }

    // Verificar si es primera clase
    const firstClass = await isFirstClassForUser(userId);

    // Actualizar booking
    const updated = await queryOne<{ id: string; status: string; checked_in_at: string }>(
      `UPDATE bookings
       SET status = 'checked_in', checked_in_at = NOW()
       WHERE id = $1
       RETURNING id, status, checked_in_at`,
      [validation.data.bookingId]
    );

    // Crear log de check-in
    await createCheckinLog({
      bookingId: booking.booking_id,
      userId,
      classId: booking.class_id,
      membershipId: booking.membership_id,
      checkinMethod: 'self_checkin',
      checkedInBy: null,
      deviceInfo: validation.data.deviceInfo,
      location: validation.data.location,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      classStartTime: `${booking.class_date}T${booking.class_start_time}`,
      isFirstClass: firstClass,
    });

    // Notificar al pase de Apple Wallet (actualiza clases restantes)
    if (booking.membership_id) {
      const membership = await queryOne<{ classes_remaining: number }>(
        `SELECT classes_remaining FROM memberships WHERE id = $1`,
        [booking.membership_id]
      );
      if (membership) {
        notifyClassAttended(booking.membership_id, membership.classes_remaining + 1, membership.classes_remaining)
          .catch(err => console.error('Error notifying wallet:', err));
      }
    }

    // Otorgar puntos de lealtad
    await awardCheckinPoints(userId!, booking.booking_id);

    res.json({
      success: true,
      message: firstClass ? '¡Bienvenido a tu primera clase!' : 'Check-in exitoso',
      isFirstClass: firstClass,
      class: {
        id: booking.class_id,
        name: booking.class_name,
        date: booking.class_date,
        start_time: booking.class_start_time,
        instructor: booking.instructor_name,
      },
      booking: updated,
    });
  } catch (error) {
    console.error('Self check-in error:', error);
    res.status(500).json({ error: 'Error al procesar check-in' });
  }
});

/**
 * POST /api/checkin/manual
 * Check-in manual por staff (sin QR)
 */
router.post('/manual', authenticate, requireRole('admin', 'instructor', 'reception'), async (req: Request, res: Response) => {
  try {
    const validation = ManualCheckinSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const booking = await queryOne<{
      booking_id: string;
      booking_status: string;
      user_id: string;
      channel: string;
      display_name: string;
      email: string;
      photo_url: string | null;
      membership_id: string | null;
      class_id: string;
      class_date: string;
      class_start_time: string;
      class_name: string;
      instructor_name: string;
    }>(
      `SELECT
         b.id as booking_id,
         b.status as booking_status,
         b.channel,
         b.user_id,
         u.display_name,
         u.email,
         u.photo_url,
         b.membership_id,
         c.id as class_id,
         c.date as class_date,
         c.start_time as class_start_time,
         ct.name as class_name,
         i.display_name as instructor_name
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN classes c ON b.class_id = c.id
       JOIN class_types ct ON c.class_type_id = ct.id
       JOIN instructors i ON c.instructor_id = i.id
       WHERE b.id = $1`,
      [validation.data.bookingId]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    if (booking.booking_status === 'checked_in') {
      return res.json({ success: true, message: 'Cliente ya registrado', alreadyCheckedIn: true });
    }

    if (!['confirmed', 'waitlist'].includes(booking.booking_status)) {
      return res.status(400).json({ error: 'No se puede hacer check-in con este estado' });
    }

    const firstClass = await isFirstClassForUser(booking.user_id);

    const updated = await queryOne<{ id: string; status: string; checked_in_at: string }>(
      `UPDATE bookings
       SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $1
       WHERE id = $2
       RETURNING id, status, checked_in_at`,
      [req.user?.userId, validation.data.bookingId]
    );

    await createCheckinLog({
      bookingId: booking.booking_id,
      userId: booking.user_id,
      classId: booking.class_id,
      membershipId: booking.membership_id,
      checkinMethod: 'manual_reception',
      checkedInBy: req.user?.userId || null,
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      classStartTime: `${booking.class_date}T${booking.class_start_time}`,
      isFirstClass: firstClass,
    });

    // Notificar al pase de Apple Wallet (actualiza clases restantes)
    if (booking.membership_id) {
      const membership = await queryOne<{ classes_remaining: number }>(
        `SELECT classes_remaining FROM memberships WHERE id = $1`,
        [booking.membership_id]
      );
      if (membership) {
        notifyClassAttended(booking.membership_id, membership.classes_remaining + 1, membership.classes_remaining)
          .catch(err => console.error('Error notifying wallet:', err));
      }
    }

    // Otorgar puntos de lealtad
    await awardCheckinPoints(booking.user_id, booking.booking_id);

    const partnerValidation = await triggerPartnerAttendanceValidation({
      bookingId: booking.booking_id,
      userId: booking.user_id,
      classId: booking.class_id,
      channel: booking.channel,
    });

    res.json({
      success: true,
      message: firstClass ? '¡Primera clase del cliente!' : 'Check-in manual exitoso',
      isFirstClass: firstClass,
      member: {
        id: booking.user_id,
        name: booking.display_name,
        email: booking.email,
        photo: booking.photo_url,
      },
      class: {
        id: booking.class_id,
        name: booking.class_name,
        date: booking.class_date,
        start_time: booking.class_start_time,
        instructor: booking.instructor_name,
      },
      booking: updated,
      partnerValidation,
    });
  } catch (error) {
    console.error('Manual check-in error:', error);
    res.status(500).json({ error: 'Error al procesar check-in' });
  }
});

/**
 * GET /api/checkin/class/:classId
 * Obtener lista de check-ins de una clase
 */
router.get('/class/:classId', authenticate, requireRole('admin', 'instructor', 'reception'), async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;

    const classInfo = await queryOne<{
      id: string;
      date: string;
      start_time: string;
      end_time: string;
      class_name: string;
      instructor_name: string;
      max_capacity: number;
      current_bookings: number;
    }>(
      `SELECT
         c.id, c.date, c.start_time, c.end_time,
         ct.name as class_name,
         i.display_name as instructor_name,
         c.max_capacity, c.current_bookings
       FROM classes c
       JOIN class_types ct ON c.class_type_id = ct.id
       JOIN instructors i ON c.instructor_id = i.id
       WHERE c.id = $1`,
      [classId]
    );

    if (!classInfo) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    const attendees = await query<{
      booking_id: string;
      user_id: string;
      display_name: string;
      email: string;
      photo_url: string | null;
      status: string;
      checked_in_at: string | null;
      checkin_method: string | null;
      is_late: boolean | null;
      is_first_class: boolean | null;
      waitlist_position: number | null;
    }>(
      `SELECT
         b.id as booking_id,
         b.user_id,
         u.display_name,
         u.email,
         u.photo_url,
         b.status,
         b.checked_in_at,
         cl.checkin_method,
         cl.is_late,
         cl.is_first_class,
         b.waitlist_position
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       LEFT JOIN checkin_logs cl ON b.id = cl.booking_id
       WHERE b.class_id = $1 AND b.status NOT IN ('cancelled')
       ORDER BY
         CASE b.status
           WHEN 'checked_in' THEN 1
           WHEN 'confirmed' THEN 2
           WHEN 'waitlist' THEN 3
           ELSE 4
         END,
         b.created_at`,
      [classId]
    );

    const stats = {
      total: attendees.length,
      checkedIn: attendees.filter(a => a.status === 'checked_in').length,
      confirmed: attendees.filter(a => a.status === 'confirmed').length,
      waitlist: attendees.filter(a => a.status === 'waitlist').length,
      firstTimers: attendees.filter(a => a.is_first_class).length,
      late: attendees.filter(a => a.is_late).length,
    };

    res.json({
      class: classInfo,
      attendees,
      stats,
    });
  } catch (error) {
    console.error('Get class checkins error:', error);
    res.status(500).json({ error: 'Error al obtener check-ins' });
  }
});

/**
 * GET /api/checkin/stats
 * Estadísticas de check-in (admin only)
 */
router.get('/stats', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const stats = await query<{
      date: string;
      total_checkins: string;
      unique_users: string;
      classes_with_checkins: string;
      qr_checkins: string;
      manual_checkins: string;
      self_checkins: string;
      late_checkins: string;
      on_time_checkins: string;
      first_time_users: string;
    }>(
      `SELECT * FROM checkin_stats WHERE date BETWEEN $1 AND $2 ORDER BY date DESC`,
      [start, end]
    );

    // Totales
    const totals = await queryOne<{
      total_checkins: string;
      unique_users: string;
      avg_per_day: string;
    }>(
      `SELECT
         COUNT(*) as total_checkins,
         COUNT(DISTINCT user_id) as unique_users,
         ROUND(COUNT(*)::numeric / GREATEST(1, (SELECT COUNT(DISTINCT DATE(checked_in_at)) FROM checkin_logs WHERE checked_in_at BETWEEN $1 AND $2)), 1) as avg_per_day
       FROM checkin_logs
       WHERE checked_in_at BETWEEN $1 AND $2`,
      [start, end]
    );

    res.json({
      period: { start, end },
      totals: {
        totalCheckins: parseInt(totals?.total_checkins || '0'),
        uniqueUsers: parseInt(totals?.unique_users || '0'),
        avgPerDay: parseFloat(totals?.avg_per_day || '0'),
      },
      daily: stats.map(s => ({
        date: s.date,
        totalCheckins: parseInt(s.total_checkins),
        uniqueUsers: parseInt(s.unique_users),
        classesWithCheckins: parseInt(s.classes_with_checkins),
        byMethod: {
          qr: parseInt(s.qr_checkins),
          manual: parseInt(s.manual_checkins),
          self: parseInt(s.self_checkins),
        },
        punctuality: {
          late: parseInt(s.late_checkins),
          onTime: parseInt(s.on_time_checkins),
        },
        firstTimeUsers: parseInt(s.first_time_users),
      })),
    });
  } catch (error) {
    console.error('Get checkin stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/checkin/suspicious
 * Ver actividad sospechosa (admin only)
 */
router.get('/suspicious', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { reviewed } = req.query;
    const showReviewed = reviewed === 'true';

    const activities = await query<{
      id: string;
      user_id: string;
      user_name: string;
      user_email: string;
      activity_type: string;
      severity: string;
      description: string;
      evidence: object;
      is_reviewed: boolean;
      is_false_positive: boolean;
      created_at: string;
    }>(
      `SELECT
         sa.id,
         sa.user_id,
         u.display_name as user_name,
         u.email as user_email,
         sa.activity_type,
         sa.severity,
         sa.description,
         sa.evidence,
         sa.is_reviewed,
         sa.is_false_positive,
         sa.created_at
       FROM suspicious_activity sa
       JOIN users u ON sa.user_id = u.id
       WHERE sa.is_reviewed = $1
       ORDER BY
         CASE sa.severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         sa.created_at DESC
       LIMIT 100`,
      [showReviewed]
    );

    res.json({ activities });
  } catch (error) {
    console.error('Get suspicious activity error:', error);
    res.status(500).json({ error: 'Error al obtener actividad sospechosa' });
  }
});

/**
 * PUT /api/checkin/suspicious/:id/review
 * Marcar actividad sospechosa como revisada
 */
router.put('/suspicious/:id/review', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isFalsePositive, notes, actionTaken } = req.body;

    await queryOne(
      `UPDATE suspicious_activity
       SET is_reviewed = true,
           reviewed_by = $1,
           reviewed_at = NOW(),
           is_false_positive = $2,
           resolution_notes = $3,
           action_taken = $4
       WHERE id = $5`,
      [req.user?.userId, isFalsePositive || false, notes || null, actionTaken || 'none', id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Review suspicious activity error:', error);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// ============================================
// EVENT QR CHECK-IN
// ============================================

const EventQrPayloadSchema = z.object({
  t: z.literal('event_checkin'),
  u: z.string().uuid(),
  ev: z.string().uuid(),
  r: z.string().uuid(),
  e: z.number(),
  h: z.string().min(32),
});

const computeEventHash = (userId: string, eventId: string, regId: string, expiresAt: number) => {
  const secret = process.env.CHECKIN_SECRET || 'essenza-studio-secret';
  const base = `event:${userId}:${eventId}:${regId}:${expiresAt}:${secret}`;
  return createHash('sha256').update(base).digest('hex');
};

/**
 * POST /api/checkin/event-qr
 * Check-in via QR code for events (staff only)
 * Accepts both event QR (t:'event_checkin') and membership QR (t:'checkin')
 */
router.post('/event-qr', authenticate, requireRole('admin', 'instructor', 'reception'), async (req: Request, res: Response) => {
  try {
    const { qrPayload, eventId: requestEventId } = req.body;

    if (!qrPayload) {
      return res.status(400).json({ error: 'QR requerido' });
    }

    let decodedPayload: unknown;
    try {
      decodedPayload = decodePayload(qrPayload);
    } catch {
      // Maybe it's a raw membership ID (UUID)
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(qrPayload)) {
        decodedPayload = { raw_id: qrPayload };
      } else {
        return res.status(400).json({ error: 'QR inválido' });
      }
    }

    let userId: string | null = null;

    // Try event QR format first
    const eventPayload = EventQrPayloadSchema.safeParse(decodedPayload);
    if (eventPayload.success) {
      const { u, ev, r, e: expiresAt, h: hash } = eventPayload.data;
      if (Math.floor(Date.now() / 1000) > expiresAt) {
        return res.status(400).json({ error: 'QR expirado' });
      }
      const expectedHash = computeEventHash(u, ev, r, expiresAt);
      if (expectedHash !== hash) {
        return res.status(400).json({ error: 'QR inválido' });
      }
      userId = u;
    }

    // Try membership/class QR format (t:'checkin')
    if (!userId) {
      const classPayload = QrPayloadSchema.safeParse(decodedPayload);
      if (classPayload.success) {
        const { m, ms, e: expiresAt, h: hash } = classPayload.data;
        if (Math.floor(Date.now() / 1000) > expiresAt) {
          return res.status(400).json({ error: 'QR expirado' });
        }
        const expectedHash = computeHash(m, ms, expiresAt);
        if (expectedHash !== hash) {
          return res.status(400).json({ error: 'QR inválido' });
        }
        userId = m;
      }
    }

    // Try raw membership ID (from Apple/Google Wallet barcode)
    if (!userId && (decodedPayload as any)?.raw_id) {
      const memId = (decodedPayload as any).raw_id;
      const mem = await queryOne<{ user_id: string }>(`SELECT user_id FROM memberships WHERE id = $1`, [memId]);
      if (mem) {
        userId = mem.user_id;
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'No se pudo identificar al usuario del QR' });
    }

    if (!requestEventId) {
      return res.status(400).json({ error: 'Se requiere el ID del evento' });
    }

    // Find registration for this user in this event
    const reg = await queryOne<{
      id: string;
      name: string;
      email: string;
      status: string;
      checked_in: boolean;
      event_title: string;
    }>(`
      SELECT r.id, r.name, r.email, r.status, r.checked_in,
             e.title as event_title
      FROM event_registrations r
      JOIN events e ON r.event_id = e.id
      WHERE r.user_id = $1 AND r.event_id = $2
    `, [userId, requestEventId]);

    if (!reg) {
      return res.status(404).json({ error: 'Este usuario no está inscrito en este evento' });
    }

    if (reg.status !== 'confirmed') {
      return res.status(400).json({ error: `No se puede hacer check-in: estado "${reg.status}"` });
    }

    if (reg.checked_in) {
      return res.status(400).json({ error: 'Ya se realizó el check-in para este evento' });
    }

    // Perform check-in
    await query(
      `UPDATE event_registrations
       SET checked_in = true, checked_in_at = NOW(), checked_in_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [req.user!.userId, reg.id]
    );

    res.json({
      success: true,
      message: 'Check-in de evento exitoso',
      attendee: {
        name: reg.name,
        email: reg.email,
        eventTitle: reg.event_title,
      },
    });
  } catch (error) {
    console.error('Event QR check-in error:', error);
    res.status(500).json({ error: 'Error al realizar check-in de evento' });
  }
});

export default router;
