import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { query, queryOne } from '../config/database.js';
import {
  ensureCheckinWithinWindow,
  ensureSinglePartnerCheckinPerDay,
  getLatestWalletCodeForUser,
  getUpcomingPartnerMappings,
  getPlatformCredentials,
  markPartnerCheckinResult,
  reconcilePartnerInventory,
  renewTotalPassToken,
  syncPartnerAvailability,
  upsertPartnerClassMapping,
  validateTotalPassCheckin,
  validateWellhubVisit,
} from '../lib/partners.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await query(
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
       ORDER BY channel ASC`,
    );

    res.json(settings);
  } catch (error) {
    console.error('Get partner settings error:', error);
    res.status(500).json({ error: 'Error al obtener configuración de partners' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [];

    for (const row of rows) {
      if (!row?.channel || !['wellhub', 'totalpass'].includes(row.channel)) {
        continue;
      }

      await query(
        `UPDATE platform_credentials
         SET environment = COALESCE($2, environment),
             is_enabled = COALESCE($3, is_enabled),
             api_base_url = $4,
             booking_base_url = $5,
             access_base_url = $6,
             partner_api_key = $7,
             place_api_key = $8,
             api_key = $9,
             api_secret = $10,
             access_token = $11,
             refresh_token = $12,
             token_expires_at = $13,
             webhook_secret = $14,
             gym_id = $15,
             webhook_url = $16,
             extra_config = COALESCE($17::jsonb, '{}'::jsonb),
             updated_at = NOW(),
             updated_by = $18
         WHERE channel = $1`,
        [
          row.channel,
          row.environment || null,
          typeof row.is_enabled === 'boolean' ? row.is_enabled : null,
          row.api_base_url || null,
          row.booking_base_url || null,
          row.access_base_url || null,
          row.partner_api_key || null,
          row.place_api_key || null,
          row.api_key || null,
          row.api_secret || null,
          row.access_token || null,
          row.refresh_token || null,
          row.token_expires_at || null,
          row.webhook_secret || null,
          row.gym_id || null,
          row.webhook_url || null,
          row.extra_config ? JSON.stringify(row.extra_config) : null,
          req.user?.userId || null,
        ],
      );
    }

    res.json({ message: 'Configuración de partners actualizada' });
  } catch (error) {
    console.error('Update partner settings error:', error);
    res.status(500).json({ error: 'Error al actualizar configuración de partners' });
  }
});

router.get('/checkins', async (req: Request, res: Response) => {
  try {
    const { status, channel, date } = req.query;
    const filters: string[] = [`c.channel IN ('totalpass', 'wellhub')`];
    const params: any[] = [];
    let paramIndex = 1;

    if (channel && typeof channel === 'string' && ['totalpass', 'wellhub'].includes(channel)) {
      filters.push(`c.channel = $${paramIndex++}`);
      params.push(channel);
    }

    if (date && typeof date === 'string') {
      filters.push(`DATE(c.created_at) = $${paramIndex++}`);
      params.push(date);
    } else {
      filters.push(`c.created_at > NOW() - INTERVAL '30 days'`);
    }

    if (status && typeof status === 'string') {
      if (status === 'pending') {
        filters.push(`c.status = 'pending'`);
      } else if (status === 'confirmed') {
        filters.push(`c.status = 'confirmed'`);
      } else if (status === 'failed') {
        filters.push(`c.status = 'failed'`);
      } else if (status === 'cancelled') {
        filters.push(`c.status = 'cancelled'`);
      } else if (status === 'expired') {
        filters.push(`(c.status = 'expired' OR (c.status = 'pending' AND ((c.channel = 'wellhub' AND c.created_at + INTERVAL '20 minutes' < NOW()) OR (c.channel = 'totalpass' AND c.created_at + INTERVAL '90 minutes' < NOW()))) )`);
      }
    }

    const rows = await query(
      `SELECT
          c.id,
          c.booking_id,
          c.created_at,
          c.validated_at,
          c.channel,
          c.validation_method,
          c.status,
          c.last_validation_error,
          u.display_name AS user_name,
          u.wellhub_id,
          u.totalpass_token,
          cls.date AS class_date,
          cls.start_time,
          ct.name AS class_name,
          b.external_ref
       FROM checkins c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN bookings b ON b.id = c.booking_id
       LEFT JOIN classes cls ON cls.id = COALESCE(c.class_id, b.class_id)
       LEFT JOIN class_types ct ON ct.id = cls.class_type_id
       WHERE ${filters.join(' AND ')}
       ORDER BY c.created_at DESC`,
      params,
    );

    const response = rows.map((row: any) => {
      const createdAt = new Date(row.created_at);
      const expiresAt = new Date(
        createdAt.getTime() + (row.channel === 'wellhub' ? 20 : 90) * 60 * 1000,
      );
      const inferredStatus = row.status === 'pending' && expiresAt < new Date()
        ? 'expired'
        : row.status;

      return {
        ...row,
        status: inferredStatus,
        expires_at: expiresAt.toISOString(),
        remaining_minutes: Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000)),
      };
    });

    res.json(response);
  } catch (error) {
    console.error('Get partner checkins error:', error);
    res.status(500).json({ error: 'Error al obtener check-ins de partners' });
  }
});

router.post('/checkins/:id/confirm', async (req: Request, res: Response) => {
  try {
    const checkin = await queryOne<any>(
      `SELECT
          c.*,
          u.wellhub_id,
          u.totalpass_token,
          b.partner_metadata,
          b.id as booking_id_ref
       FROM checkins c
       JOIN users u ON u.id = c.user_id
       LEFT JOIN bookings b ON b.id = c.booking_id
       WHERE c.id = $1`,
      [req.params.id],
    );

    if (!checkin) {
      return res.status(404).json({ error: 'Check-in no encontrado' });
    }

    if (checkin.status === 'confirmed') {
      return res.json({ message: 'El check-in ya estaba confirmado', checkin });
    }

    ensureCheckinWithinWindow(checkin.channel, new Date(checkin.created_at));
    await ensureSinglePartnerCheckinPerDay(checkin.user_id, checkin.channel);

    if (checkin.channel === 'wellhub') {
      if (!checkin.wellhub_id) {
        return res.status(400).json({ error: 'El usuario no tiene wellhub_id configurado' });
      }

      const customCode = await getLatestWalletCodeForUser(checkin.user_id);
      const validation = await validateWellhubVisit({
        wellhubId: checkin.wellhub_id,
        customCode,
      });

      if (!validation.ok) {
        await markPartnerCheckinResult({
          checkinId: checkin.id,
          status: 'failed',
          validationMethod: 'manual_panel',
          platformResponse: validation.data || { raw: validation.text },
          errorMessage: validation.text || `Wellhub respondió ${validation.status}`,
        });

        return res.status(validation.status).json({
          error: 'No se pudo confirmar en Wellhub',
          detail: validation.data || validation.text,
        });
      }

      await markPartnerCheckinResult({
        checkinId: checkin.id,
        status: 'confirmed',
        validationMethod: 'manual_panel',
        platformResponse: validation.data || { raw: validation.text },
      });
    } else {
      const confirmationUrl = checkin?.payload?.confirmation_url
        || checkin?.payload?.confirmationUrl
        || checkin?.partner_metadata?.confirmation_url
        || checkin?.partner_metadata?.confirmationUrl;

      const validation = await validateTotalPassCheckin({
        confirmationUrl,
        payload: checkin.payload,
      });

      if (!validation.ok) {
        await markPartnerCheckinResult({
          checkinId: checkin.id,
          status: 'failed',
          validationMethod: 'manual_panel',
          platformResponse: validation.data || { raw: validation.text },
          errorMessage: validation.text || `TotalPass respondió ${validation.status}`,
        });

        return res.status(validation.status).json({
          error: 'No se pudo confirmar en TotalPass',
          detail: validation.data || validation.text,
        });
      }

      await markPartnerCheckinResult({
        checkinId: checkin.id,
        status: 'confirmed',
        validationMethod: 'manual_panel',
        platformResponse: validation.data || { raw: validation.text },
      });
    }

    if (checkin.booking_id_ref) {
      await query(
        `UPDATE bookings
         SET status = CASE WHEN status = 'cancelled' THEN status ELSE 'checked_in' END,
             checked_in_at = COALESCE(checked_in_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [checkin.booking_id_ref],
      );
    }

    const refreshed = await queryOne(`SELECT * FROM checkins WHERE id = $1`, [checkin.id]);
    res.json({ message: 'Check-in confirmado manualmente', checkin: refreshed });
  } catch (error: any) {
    if (String(error?.message || '').includes('expirado')) {
      return res.status(409).json({ error: error.message });
    }
    if (String(error?.message || '').includes('ya tiene un check-in')) {
      return res.status(409).json({ error: error.message });
    }

    console.error('Confirm partner checkin error:', error);
    res.status(500).json({ error: 'Error al confirmar manualmente el check-in' });
  }
});

router.get('/mappings', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit || 100);
    const mappings = await getUpcomingPartnerMappings(limit);
    res.json(mappings);
  } catch (error) {
    console.error('Partner mappings error:', error);
    res.status(500).json({ error: 'Error al obtener mapeos de partners' });
  }
});

router.put('/mappings/:classId', async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const updated = [];

    for (const row of rows) {
      if (!row?.channel || !['wellhub', 'totalpass'].includes(row.channel)) {
        continue;
      }

      updated.push(await upsertPartnerClassMapping({
        classId,
        channel: row.channel,
        external_class_id: row.external_class_id || null,
        external_slot_id: row.external_slot_id || null,
        external_event_id: row.external_event_id || null,
        external_occurrence_id: row.external_occurrence_id || null,
        sync_enabled: typeof row.sync_enabled === 'boolean' ? row.sync_enabled : undefined,
        metadata: row.metadata || {},
      }));
    }

    res.json(updated);
  } catch (error) {
    console.error('Update partner mappings error:', error);
    res.status(500).json({ error: 'Error al actualizar mapeos de partners' });
  }
});

router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const summary = await query(
      `SELECT
          b.channel,
          COUNT(*) AS total_bookings,
          COUNT(DISTINCT b.user_id) AS unique_users,
          COUNT(ch.id) FILTER (WHERE ch.status = 'confirmed') AS confirmed_checkins
       FROM bookings b
       LEFT JOIN checkins ch ON ch.booking_id = b.id
       JOIN classes c ON c.id = b.class_id
       WHERE c.date >= DATE_TRUNC('month', CURRENT_DATE)
         AND b.status != 'cancelled'
         AND b.channel IN ('wellhub', 'totalpass')
       GROUP BY b.channel
       ORDER BY total_bookings DESC`,
    );

    res.json(summary);
  } catch (error) {
    console.error('Partner summary error:', error);
    res.status(500).json({ error: 'Error al obtener resumen de partners' });
  }
});

router.post('/reconcile-inventory', async (_req: Request, res: Response) => {
  try {
    await reconcilePartnerInventory();
    res.json({ message: 'Inventario de partners reconciliado' });
  } catch (error) {
    console.error('Reconcile partner inventory error:', error);
    res.status(500).json({ error: 'Error al reconciliar inventario de partners' });
  }
});

router.post('/sync-availability', async (req: Request, res: Response) => {
  try {
    const classId = typeof req.body?.classId === 'string' ? req.body.classId : undefined;
    await reconcilePartnerInventory();
    await syncPartnerAvailability(classId);
    res.json({ message: classId ? 'Disponibilidad sincronizada para la clase' : 'Disponibilidad sincronizada para partners' });
  } catch (error: any) {
    console.error('Sync partner availability error:', error);
    res.status(500).json({ error: error?.message || 'Error al sincronizar disponibilidad con partners' });
  }
});

router.post('/totalpass/renew-token', async (_req: Request, res: Response) => {
  try {
    await renewTotalPassToken();
    const credentials = await getPlatformCredentials('totalpass');
    res.json({
      message: 'Token TotalPass renovado',
      token_expires_at: credentials?.token_expires_at || null,
    });
  } catch (error: any) {
    console.error('Renew TotalPass token error:', error);
    res.status(500).json({ error: error?.message || 'Error renovando token de TotalPass' });
  }
});

export default router;
