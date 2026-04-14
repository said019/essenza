import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import {
  buildWebhookEventId,
  cancelPartnerBooking,
  clearProcessedEvent,
  createPartnerCheckin,
  deleteWellhubCustomCode,
  ensureCheckinWithinWindow,
  ensureSinglePartnerCheckinPerDay,
  extractPartnerExternalRef,
  extractPartnerMappingData,
  finalizeProcessedEvent,
  findOrCreatePartnerUser,
  findPartnerBookingByExternalRef,
  findTodayPartnerBookingForUser,
  getLatestWalletCodeForUser,
  markPartnerCheckinResult,
  normalizeTimestamp,
  PARTNER_CHANNELS,
  reserveProcessedEvent,
  resolveClassForPartnerPayload,
  sendWellhubCustomCode,
  syncPartnerAvailability,
  updateWellhubCustomCode,
  upsertPartnerClassMapping,
  upsertPartnerBooking,
  validateTotalPassCheckin,
  validateWellhubVisit,
  verifyPartnerWebhook,
} from '../lib/partners.js';

const router = Router();

function hasPartnerChannel(value: string | null | undefined): value is 'wellhub' | 'totalpass' {
  return !!value && PARTNER_CHANNELS.includes(value as 'wellhub' | 'totalpass');
}

function buildMappingPayload(channel: 'wellhub' | 'totalpass', classId: string, payload: any) {
  const mapping = extractPartnerMappingData(channel, payload);

  return {
    classId,
    channel,
    ...mapping,
    metadata: mapping.metadata || undefined,
  };
}

async function markLocalBookingAsCheckedIn(bookingId: string): Promise<void> {
  await query(
    `UPDATE bookings
     SET status = CASE WHEN status = 'cancelled' THEN status ELSE 'checked_in' END,
         checked_in_at = COALESCE(checked_in_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [bookingId],
  );
}

router.post('/wellhub/checkin', async (req: Request, res: Response) => {
  const authorized = await verifyPartnerWebhook('wellhub', req);
  if (!authorized) {
    return res.status(401).json({ error: 'Firma Wellhub inválida' });
  }

  const eventId = buildWebhookEventId('wellhub', 'checkin', req.body);
  const alreadyProcessed = await reserveProcessedEvent(eventId, 'wellhub', 'checkin');
  if (alreadyProcessed) {
    return res.status(200).json({ status: 'already_processed' });
  }

  try {
    const user = await findOrCreatePartnerUser('wellhub', req.body);
    const externalRef = extractPartnerExternalRef(req.body);
    const timestamp = normalizeTimestamp(
      req.body?.event_data?.timestamp
      || req.body?.checked_in_at
      || req.body?.timestamp
      || req.body?.created_at,
    ) || new Date();

    ensureCheckinWithinWindow('wellhub', timestamp);
    await ensureSinglePartnerCheckinPerDay(user.id, 'wellhub');

    let booking = externalRef ? await findPartnerBookingByExternalRef('wellhub', externalRef) : null;
    if (!booking) {
      booking = await findTodayPartnerBookingForUser('wellhub', user.id);
    }

    if (!booking) {
      const classInfo = await resolveClassForPartnerPayload(req.body);
      if (!classInfo) {
        throw new Error('No se pudo relacionar el check-in de Wellhub con una clase local');
      }

      const createdBooking = await upsertPartnerBooking({
        channel: 'wellhub',
        classId: classInfo.id,
        userId: user.id,
        externalRef,
        partnerMetadata: req.body,
      });

      booking = {
        id: createdBooking.id,
        class_id: createdBooking.class_id,
        user_id: createdBooking.user_id,
        channel: createdBooking.channel,
        external_ref: createdBooking.external_ref,
        status: createdBooking.status,
      };
    }

    await upsertPartnerClassMapping(buildMappingPayload('wellhub', booking.class_id, req.body));

    const checkin = await createPartnerCheckin({
      bookingId: booking.id,
      userId: user.id,
      classId: booking.class_id,
      channel: 'wellhub',
      externalRef,
      platformEventId: eventId,
      validationMethod: 'automated',
      payload: req.body,
      createdAt: timestamp,
    });

    const customCode = await getLatestWalletCodeForUser(user.id);
    if (customCode && user.wellhub_id) {
      updateWellhubCustomCode(user.wellhub_id, customCode).catch(() => {
        sendWellhubCustomCode(user.wellhub_id!, customCode).catch((error) => {
          console.error('[Wellhub] Error enviando custom code:', error);
        });
      });
    }

    if (!user.wellhub_id) {
      throw new Error('El usuario de Wellhub no tiene wellhub_id configurado');
    }

    if (!customCode) {
      console.warn('[Wellhub] Usuario sin wallet code para custom code sync', user.id);
    }

    const validation = await validateWellhubVisit({
      wellhubId: user.wellhub_id,
      customCode,
    });

    if (!validation.ok) {
      await markPartnerCheckinResult({
        checkinId: checkin.id,
        status: 'failed',
        validationMethod: 'automated',
        platformResponse: validation.data || { raw: validation.text },
        errorMessage: validation.text || `Wellhub respondió ${validation.status}`,
      });

      await finalizeProcessedEvent(eventId, validation.status);
      return res.status(validation.status).json({
        status: 'validation_failed',
        detail: validation.data || validation.text,
      });
    }

    await markPartnerCheckinResult({
      checkinId: checkin.id,
      status: 'confirmed',
      validationMethod: 'automated',
      platformResponse: validation.data || { raw: validation.text },
    });

    await markLocalBookingAsCheckedIn(booking.id);
    await finalizeProcessedEvent(eventId, 200);

    return res.status(200).json({ status: 'validated', bookingId: booking.id });
  } catch (error: any) {
    await clearProcessedEvent(eventId);
    console.error('[Wellhub] checkin error:', error);
    return res.status(500).json({ error: error?.message || 'Error procesando check-in Wellhub' });
  }
});

router.post('/wellhub/cancel', async (req: Request, res: Response) => {
  const authorized = await verifyPartnerWebhook('wellhub', req);
  if (!authorized) {
    return res.status(401).json({ error: 'Firma Wellhub inválida' });
  }

  const eventId = buildWebhookEventId('wellhub', 'cancel', req.body);
  const alreadyProcessed = await reserveProcessedEvent(eventId, 'wellhub', 'cancel');
  if (alreadyProcessed) {
    return res.status(202).json({ status: 'already_processed' });
  }

  try {
    const wellhubId = String(req.body?.user_id || req.body?.user?.id || '').trim();
    const planId = String(req.body?.plan_id || req.body?.product?.id || '').trim();

    if (!wellhubId) {
      throw new Error('Payload de Wellhub sin user_id');
    }

    await query(
      `UPDATE users
       SET platform_plan = CASE WHEN $2 = '' THEN 'cancelled' ELSE $2 END,
           updated_at = NOW()
       WHERE wellhub_id = $1`,
      [wellhubId, planId],
    );

    if (planId === '0' || planId.toLowerCase() === 'cancelled' || planId.toLowerCase() === 'paused') {
      await deleteWellhubCustomCode(wellhubId).catch((error) => {
        console.error('[Wellhub] Error enviando custom code:', error);
      });
    }

    if (planId === '0' || planId.toLowerCase() === 'cancelled' || planId.toLowerCase() === 'paused') {
      const bookings = await query<{ id: string; class_id: string }>(
        `SELECT b.id
               , b.class_id
         FROM bookings b
         JOIN classes c ON c.id = b.class_id
         JOIN users u ON u.id = b.user_id
         WHERE u.wellhub_id = $1
           AND b.channel = 'wellhub'
           AND b.status IN ('confirmed', 'checked_in')
           AND c.date >= CURRENT_DATE`,
        [wellhubId],
      );

      for (const booking of bookings) {
        await cancelPartnerBooking(booking.id, 'Cancelación Wellhub');
        syncPartnerAvailability(booking.class_id).catch((error) => {
          console.error('[Wellhub] Error syncing availability after cancellation:', error);
        });
      }
    }

    await finalizeProcessedEvent(eventId, 202);
    return res.status(202).json({ status: 'accepted' });
  } catch (error: any) {
    await clearProcessedEvent(eventId);
    console.error('[Wellhub] cancel error:', error);
    return res.status(500).json({ error: error?.message || 'Error procesando cancelación Wellhub' });
  }
});

router.post('/wellhub/change', async (req: Request, res: Response) => {
  const authorized = await verifyPartnerWebhook('wellhub', req);
  if (!authorized) {
    return res.status(401).json({ error: 'Firma Wellhub inválida' });
  }

  const eventId = buildWebhookEventId('wellhub', 'change', req.body);
  const alreadyProcessed = await reserveProcessedEvent(eventId, 'wellhub', 'change');
  if (alreadyProcessed) {
    return res.status(202).json({ status: 'already_processed' });
  }

  try {
    const wellhubId = String(req.body?.user_id || req.body?.user?.id || '').trim();
    const planId = String(req.body?.plan_id || req.body?.product?.id || '').trim();

    if (!wellhubId) {
      throw new Error('Payload de Wellhub sin user_id');
    }

    await query(
      `UPDATE users
       SET platform_plan = NULLIF($2, ''),
           updated_at = NOW()
      WHERE wellhub_id = $1`,
      [wellhubId, planId],
    );

    const user = await queryOne<{ id: string; wellhub_id: string | null }>(
      `SELECT id, wellhub_id
       FROM users
       WHERE wellhub_id = $1`,
      [wellhubId],
    );

    if (user?.wellhub_id && planId !== '0') {
      const walletCode = await getLatestWalletCodeForUser(user.id);
      if (walletCode) {
        await updateWellhubCustomCode(user.wellhub_id, walletCode).catch(async () => {
          await sendWellhubCustomCode(user.wellhub_id!, walletCode);
        });
      }
    }

    await finalizeProcessedEvent(eventId, 202);
    return res.status(202).json({ status: 'accepted' });
  } catch (error: any) {
    await clearProcessedEvent(eventId);
    console.error('[Wellhub] change error:', error);
    return res.status(500).json({ error: error?.message || 'Error procesando cambio Wellhub' });
  }
});

router.post('/totalpass/booking', async (req: Request, res: Response) => {
  const authorized = await verifyPartnerWebhook('totalpass', req);
  if (!authorized) {
    return res.status(401).json({ error: 'Firma TotalPass inválida' });
  }

  const eventId = buildWebhookEventId('totalpass', 'booking', req.body);
  const alreadyProcessed = await reserveProcessedEvent(eventId, 'totalpass', 'booking');
  if (alreadyProcessed) {
    return res.status(200).json({ status: 'already_processed' });
  }

  try {
    const user = await findOrCreatePartnerUser('totalpass', req.body);
    const classInfo = await resolveClassForPartnerPayload(req.body);

    if (!classInfo) {
      throw new Error('No se pudo relacionar la reserva de TotalPass con una clase local');
    }

    const externalRef = extractPartnerExternalRef(req.body);
    const booking = await upsertPartnerBooking({
      channel: 'totalpass',
      classId: classInfo.id,
      userId: user.id,
      externalRef,
      partnerMetadata: req.body,
    });

    await upsertPartnerClassMapping(buildMappingPayload('totalpass', classInfo.id, req.body));

    syncPartnerAvailability(classInfo.id).catch((error) => {
      console.error('[TotalPass] Error syncing availability after booking:', error);
    });

    await finalizeProcessedEvent(eventId, 200);
    return res.status(200).json({ status: 'booked', bookingId: booking.id });
  } catch (error: any) {
    await clearProcessedEvent(eventId);
    console.error('[TotalPass] booking error:', error);
    return res.status(500).json({ error: error?.message || 'Error procesando reserva TotalPass' });
  }
});

router.delete('/totalpass/booking/:slotId', async (req: Request, res: Response) => {
  const authorized = await verifyPartnerWebhook('totalpass', req);
  if (!authorized) {
    return res.status(401).json({ error: 'Firma TotalPass inválida' });
  }

  const eventId = buildWebhookEventId('totalpass', 'cancel', req.body, req.params.slotId);
  const alreadyProcessed = await reserveProcessedEvent(eventId, 'totalpass', 'cancel');
  if (alreadyProcessed) {
    return res.status(200).json({ status: 'already_processed' });
  }

  try {
    const booking = await findPartnerBookingByExternalRef('totalpass', req.params.slotId);
    if (!booking) {
      await finalizeProcessedEvent(eventId, 404);
      return res.status(404).json({ error: 'Reserva TotalPass no encontrada' });
    }

    await cancelPartnerBooking(booking.id, 'Cancelación TotalPass');
    syncPartnerAvailability(booking.class_id).catch((error) => {
      console.error('[TotalPass] Error syncing availability after cancellation:', error);
    });
    await finalizeProcessedEvent(eventId, 200);
    return res.status(200).json({ status: 'cancelled', bookingId: booking.id });
  } catch (error: any) {
    await clearProcessedEvent(eventId);
    console.error('[TotalPass] cancel error:', error);
    return res.status(500).json({ error: error?.message || 'Error cancelando reserva TotalPass' });
  }
});

router.post('/totalpass/checkin', async (req: Request, res: Response) => {
  const authorized = await verifyPartnerWebhook('totalpass', req);
  if (!authorized) {
    return res.status(401).json({ error: 'Firma TotalPass inválida' });
  }

  const eventId = buildWebhookEventId('totalpass', 'checkin', req.body);
  const alreadyProcessed = await reserveProcessedEvent(eventId, 'totalpass', 'checkin');
  if (alreadyProcessed) {
    return res.status(200).json({ status: 'already_processed' });
  }

  try {
    const user = await findOrCreatePartnerUser('totalpass', req.body);
    const externalRef = extractPartnerExternalRef(req.body);
    const timestamp = normalizeTimestamp(
      req.body?.checked_in_at
      || req.body?.timestamp
      || req.body?.created_at,
    ) || new Date();

    ensureCheckinWithinWindow('totalpass', timestamp);
    await ensureSinglePartnerCheckinPerDay(user.id, 'totalpass');

    let booking = externalRef ? await findPartnerBookingByExternalRef('totalpass', externalRef) : null;
    if (!booking) {
      booking = await findTodayPartnerBookingForUser('totalpass', user.id);
    }

    if (!booking) {
      const classInfo = await resolveClassForPartnerPayload(req.body);
      if (!classInfo) {
        throw new Error('No se pudo relacionar el check-in de TotalPass con una clase local');
      }

      const createdBooking = await upsertPartnerBooking({
        channel: 'totalpass',
        classId: classInfo.id,
        userId: user.id,
        externalRef,
        partnerMetadata: req.body,
      });

      booking = {
        id: createdBooking.id,
        class_id: createdBooking.class_id,
        user_id: createdBooking.user_id,
        channel: createdBooking.channel,
        external_ref: createdBooking.external_ref,
        status: createdBooking.status,
      };
    }

    await upsertPartnerClassMapping(buildMappingPayload('totalpass', booking.class_id, req.body));

    const checkin = await createPartnerCheckin({
      bookingId: booking.id,
      userId: user.id,
      classId: booking.class_id,
      channel: 'totalpass',
      externalRef,
      platformEventId: eventId,
      validationMethod: 'automated',
      payload: req.body,
      createdAt: timestamp,
    });

    const validation = await validateTotalPassCheckin({ payload: req.body });
    if (!validation.ok) {
      await markPartnerCheckinResult({
        checkinId: checkin.id,
        status: 'failed',
        validationMethod: 'automated',
        platformResponse: validation.data || { raw: validation.text },
        errorMessage: validation.text || `TotalPass respondió ${validation.status}`,
      });

      await finalizeProcessedEvent(eventId, validation.status);
      return res.status(validation.status).json({
        status: 'validation_failed',
        detail: validation.data || validation.text,
      });
    }

    await markPartnerCheckinResult({
      checkinId: checkin.id,
      status: 'confirmed',
      validationMethod: 'automated',
      platformResponse: validation.data || { raw: validation.text },
    });

    await markLocalBookingAsCheckedIn(booking.id);
    await finalizeProcessedEvent(eventId, 200);
    return res.status(200).json({ status: 'validated', bookingId: booking.id });
  } catch (error: any) {
    await clearProcessedEvent(eventId);
    console.error('[TotalPass] checkin error:', error);
    return res.status(500).json({ error: error?.message || 'Error procesando check-in TotalPass' });
  }
});

router.post('/:channel/debug/echo', async (req: Request, res: Response) => {
  const channel = req.params.channel;
  if (!hasPartnerChannel(channel)) {
    return res.status(404).json({ error: 'Canal no soportado' });
  }

  return res.json({
    channel,
    receivedAt: new Date().toISOString(),
    body: req.body,
  });
});

export default router;
