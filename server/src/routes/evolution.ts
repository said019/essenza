import { Router, Request, Response } from 'express';
import { getEvolutionClient, getEvolutionState, updateEvolutionState } from '../lib/whatsapp-evolution.js';
import { getWhatsAppStatus, sendWhatsAppMessage } from '../lib/whatsapp.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// Todos los endpoints requieren autenticación admin
router.use(authenticate);
router.use(requireRole('admin'));

/**
 * GET /api/evolution/status
 * Obtener estado de conexión de WhatsApp
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const status = await getWhatsAppStatus();
        const cachedState = getEvolutionState();
        
        res.json({
            ...status,
            lastUpdated: cachedState.lastUpdated,
        });
    } catch (error: any) {
        console.error('[Evolution] Error getting status:', error);
        res.status(500).json({ 
            error: 'Error obteniendo estado',
            details: error.message 
        });
    }
});

/**
 * POST /api/evolution/connect
 * Iniciar conexión y obtener QR code
 */
router.post('/connect', async (req: Request, res: Response) => {
    try {
        const client = getEvolutionClient();
        
        // Primero verificar si ya está conectado
        const currentStatus = await client.getStatus();
        if (currentStatus.connected) {
            return res.json({
                success: true,
                message: 'Ya está conectado',
                status: currentStatus,
            });
        }
        
        // Obtener QR code para conexión
        const result = await client.connectInstance();
        
        // Evolution API devuelve base64, el frontend espera qrCode
        res.json({
            success: true,
            qrCode: result.base64, // Mapear base64 -> qrCode
            ...result,
        });
    } catch (error: any) {
        console.error('[Evolution] Error connecting:', error);
        res.status(500).json({ 
            error: 'Error conectando WhatsApp',
            details: error.message 
        });
    }
});

/**
 * POST /api/evolution/logout
 * Cerrar sesión de WhatsApp
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const client = getEvolutionClient();
        await client.logout();
        
        // Limpiar estado cacheado
        updateEvolutionState({
            connected: false,
            connectionState: 'logged_out',
            phoneNumber: undefined,
        });
        
        res.json({
            success: true,
            message: 'Sesión cerrada correctamente',
        });
    } catch (error: any) {
        console.error('[Evolution] Error logging out:', error);
        res.status(500).json({ 
            error: 'Error cerrando sesión',
            details: error.message 
        });
    }
});

/**
 * POST /api/evolution/test
 * Enviar mensaje de prueba
 */
router.post('/test', async (req: Request, res: Response) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone) {
            return res.status(400).json({ error: 'Se requiere número de teléfono' });
        }
        
        const testMessage = message || '🧘 Mensaje de prueba desde Essenza del Flusso ✨';
        
        const success = await sendWhatsAppMessage(phone, testMessage);
        
        if (success) {
            res.json({
                success: true,
                message: 'Mensaje enviado correctamente',
                phone,
            });
        } else {
            res.status(500).json({
                error: 'No se pudo enviar el mensaje',
            });
        }
    } catch (error: any) {
        console.error('[Evolution] Error sending test:', error);
        res.status(500).json({ 
            error: 'Error enviando mensaje de prueba',
            details: error.message 
        });
    }
});

/**
 * POST /api/evolution/create-instance
 * Crear la instancia de essenza (solo si no existe)
 */
router.post('/create-instance', async (req: Request, res: Response) => {
    try {
        const client = getEvolutionClient();
        
        // Primero verificar si la instancia ya existe
        const status = await client.getStatus();
        if (status.state !== 'not_found') {
            // La instancia ya existe, no es necesario crearla
            return res.json({
                success: true,
                message: 'Instancia ya existe. Usa "Conectar WhatsApp" para obtener el QR.',
                status: status,
            });
        }
        
        // Configurar webhook URL del backend (usar BASE_URL de producción)
        const baseUrl = process.env.BASE_URL || process.env.BACKEND_URL;
        if (!baseUrl || baseUrl.includes('localhost')) {
            return res.status(400).json({
                error: 'BASE_URL no configurada',
                message: 'Configura BASE_URL con la URL de producción de tu backend (ej: https://tu-app.up.railway.app)',
            });
        }
        
        const webhookUrl = `${baseUrl}/api/evolution/webhook`;
        
        const result = await client.createInstance(webhookUrl);
        
        res.json({
            success: true,
            message: 'Instancia creada correctamente',
            instanceName: result.instance?.instanceName,
            status: result.instance?.status,
        });
    } catch (error: any) {
        // Si la instancia ya existe, no es un error
        if (error.message?.includes('already exists') || error.response?.status === 409) {
            return res.json({
                success: true,
                message: 'Instancia ya existe',
            });
        }
        
        console.error('[Evolution] Error creating instance:', error);
        res.status(500).json({ 
            error: 'Error creando instancia',
            details: error.message 
        });
    }
});

/**
 * DELETE /api/evolution/delete-instance
 * Eliminar la instancia (CUIDADO - acción destructiva)
 */
router.delete('/delete-instance', async (req: Request, res: Response) => {
    try {
        const client = getEvolutionClient();
        await client.deleteInstance();
        
        // Limpiar estado cacheado
        updateEvolutionState({
            connected: false,
            connectionState: 'deleted',
            phoneNumber: undefined,
        });
        
        res.json({
            success: true,
            message: 'Instancia eliminada',
        });
    } catch (error: any) {
        console.error('[Evolution] Error deleting instance:', error);
        res.status(500).json({ 
            error: 'Error eliminando instancia',
            details: error.message 
        });
    }
});

/**
 * GET /api/evolution/info
 * Obtener información de configuración (para debug)
 */
router.get('/info', async (req: Request, res: Response) => {
    try {
        const baseUrl = process.env.BASE_URL || process.env.BACKEND_URL;
        const webhookUrl = baseUrl ? `${baseUrl}/api/evolution/webhook` : '✗ BASE_URL no configurada';
        
        res.json({
            provider: 'evolution',
            instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'essenza',
            apiUrl: process.env.EVOLUTION_API_URL ? '✓ Configurado' : '✗ No configurado',
            apiKey: process.env.EVOLUTION_API_KEY ? '✓ Configurado' : '✗ No configurado',
            baseUrl: baseUrl ? '✓ Configurado' : '✗ No configurado',
            webhookUrl,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
