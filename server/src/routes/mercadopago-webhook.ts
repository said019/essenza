import { Router, Request, Response } from 'express';
import { processMercadoPagoWebhook, verifyMercadoPagoWebhook } from '../lib/mercadopago.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const valid = await verifyMercadoPagoWebhook(req);

    if (!valid) {
      return res.status(401).json({ error: 'Firma Mercado Pago inválida' });
    }

    const result = await processMercadoPagoWebhook(req);

    if (result.ignored) {
      return res.status(202).json({ status: 'ignored' });
    }

    return res.status(200).json({ status: 'processed' });
  } catch (error: any) {
    console.error('Mercado Pago webhook error:', error);
    return res.status(500).json({ error: error?.message || 'Error procesando webhook Mercado Pago' });
  }
});

export default router;
