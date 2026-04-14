import { getEvolutionClient } from './whatsapp-evolution.js';

/**
 * Facade principal para envío de WhatsApp
 * Soporta múltiples proveedores: evolution (gratuito) o twilio (pago)
 */

const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'evolution';

export interface WhatsAppMessage {
    to: string;
    message: string;
}

export interface WhatsAppPollMessage {
    to: string;
    question: string;
    options: string[];
    selectableCount?: number;
}

export interface WhatsAppMediaMessage {
    to: string;
    mediaUrl: string;
    caption?: string;
    mediaType?: 'image' | 'video' | 'document';
}

/**
 * Enviar mensaje de texto por WhatsApp
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    try {
        if (WHATSAPP_PROVIDER === 'evolution') {
            const client = getEvolutionClient();
            await client.sendText(to, message);
            console.log(`[WhatsApp] Mensaje enviado a ${to}`);
            return true;
        }

        // Twilio u otro proveedor futuro
        console.warn('[WhatsApp] Proveedor no configurado:', WHATSAPP_PROVIDER);
        return false;
    } catch (error: any) {
        console.error('[WhatsApp] Error enviando mensaje:', error.message);
        return false;
    }
}

/**
 * Enviar Poll/Encuesta por WhatsApp (funciona en iOS y Android)
 * Mejor opción para confirmaciones y opciones
 */
export async function sendWhatsAppPoll(
    to: string,
    question: string,
    options: string[],
    selectableCount: number = 1
): Promise<boolean> {
    try {
        if (WHATSAPP_PROVIDER === 'evolution') {
            const client = getEvolutionClient();
            await client.sendPoll(to, question, options, selectableCount);
            console.log(`[WhatsApp] Poll enviado a ${to}`);
            return true;
        }

        console.warn('[WhatsApp] Proveedor no soporta polls');
        return false;
    } catch (error: any) {
        console.error('[WhatsApp] Error enviando poll:', error.message);
        return false;
    }
}

/**
 * Enviar imagen/media por WhatsApp
 */
export async function sendWhatsAppMedia(
    to: string,
    mediaUrl: string,
    caption?: string,
    mediaType: 'image' | 'video' | 'document' = 'image'
): Promise<boolean> {
    try {
        if (WHATSAPP_PROVIDER === 'evolution') {
            const client = getEvolutionClient();
            await client.sendMedia(to, mediaUrl, caption, mediaType);
            console.log(`[WhatsApp] Media enviado a ${to}`);
            return true;
        }

        console.warn('[WhatsApp] Proveedor no configurado');
        return false;
    } catch (error: any) {
        console.error('[WhatsApp] Error enviando media:', error.message);
        return false;
    }
}

/**
 * Obtener estado de conexión de WhatsApp
 */
export async function getWhatsAppStatus(): Promise<{
    provider: string;
    connected: boolean;
    state: string;
    number?: string;
}> {
    try {
        if (WHATSAPP_PROVIDER === 'evolution') {
            const client = getEvolutionClient();
            const status = await client.getStatus();
            return {
                provider: 'evolution',
                ...status,
            };
        }

        return {
            provider: WHATSAPP_PROVIDER,
            connected: false,
            state: 'not_configured',
        };
    } catch (error: any) {
        console.error('[WhatsApp] Error obteniendo estado:', error.message);
        return {
            provider: WHATSAPP_PROVIDER,
            connected: false,
            state: 'error',
        };
    }
}

// ============================================
// Mensajes predefinidos para Essenza
// ============================================

/**
 * Enviar confirmación de reserva
 */
export async function sendBookingConfirmation(
    phone: string,
    clientName: string,
    className: string,
    date: string,
    time: string,
    spotNumber?: number
): Promise<boolean> {
    const spotText = spotNumber ? `\n🎯 Lugar: #${spotNumber}` : '';
    
    const message = `✅ *Reserva Confirmada*\n\n` +
        `Hola ${clientName}!\n\n` +
        `Tu reserva está confirmada:\n\n` +
        `📍 *${className}*\n` +
        `📅 ${date}\n` +
        `⏰ ${time}${spotText}\n\n` +
        `¡Te esperamos! 🧘✨`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar notificación de cancelación
 */
export async function sendCancellationNotice(
    phone: string,
    clientName: string,
    className: string,
    date: string,
    reason?: string,
    refunded?: boolean
): Promise<boolean> {
    const reasonText = reason ? `\n\n📝 Motivo: ${reason}` : '';
    const refundText = refunded === false
        ? `❌ Tu crédito *no fue devuelto*. ${reason || ''}`
        : `✅ Tu crédito ha sido devuelto automáticamente.`;

    const message = `⚠️ *Reserva Cancelada*\n\n` +
        `Hola ${clientName},\n\n` +
        `Tu reserva ha sido cancelada:\n\n` +
        `📍 *${className}*\n` +
        `📅 ${date}${reasonText}\n\n` +
        `${refundText}`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar bienvenida a cliente nuevo (creado por admin)
 */
export async function sendClientWelcome(
    phone: string,
    clientName: string,
    email: string,
    tempPassword: string
): Promise<boolean> {
    const message = `🎉 *¡Bienvenido a Essenza del Flusso!*\n\n` +
        `Hola ${clientName}!\n\n` +
        `Tu cuenta ha sido creada. Aquí están tus datos de acceso:\n\n` +
        `📧 *Email:* ${email}\n` +
        `🔑 *Contraseña:* ${tempPassword}\n\n` +
        `Ingresa a la app y cambia tu contraseña en tu primer acceso.\n\n` +
        `¡Te esperamos en el studio! 🧘✨`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar bienvenida a cliente migrado
 */
export async function sendMigrationWelcome(
    phone: string,
    clientName: string,
    tempPassword: string
): Promise<boolean> {
    const message = `🎉 *Bienvenida a Essenza Digital*\n\n` +
        `Hola ${clientName}!\n\n` +
        `Tu cuenta ha sido creada en nuestra nueva plataforma.\n\n` +
        `📱 *Datos de acceso:*\n` +
        `🔑 Contraseña temporal: ${tempPassword}\n\n` +
        `Ingresa a la app y cambia tu contraseña en tu primer acceso.\n\n` +
        `¡Nos vemos en clase! 🧘✨`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar confirmación de membresía activada
 */
export async function sendMembershipActivatedNotice(
    phone: string,
    clientName: string,
    planName: string,
    classesIncluded: number | null,
    endDate: string
): Promise<boolean> {
    const classesText = classesIncluded ? `🎟️ Clases: ${classesIncluded}` : '🎟️ Clases: Ilimitadas';

    const message = `🎉 *¡Membresía Activada!*\n\n` +
        `Hola ${clientName}!\n\n` +
        `Tu membresía ha sido activada exitosamente:\n\n` +
        `📋 *${planName}*\n` +
        `${classesText}\n` +
        `📅 Vence: ${endDate}\n\n` +
        `Ya puedes reservar tus clases desde la app.\n\n` +
        `¡Te esperamos en el studio! 🧘✨`;

    return sendWhatsAppMessage(phone, message);
}

/**
 * Enviar notificación de membresía por vencer
 */
export async function sendExpiringMembershipNotice(
    phone: string,
    clientName: string,
    planName: string,
    daysRemaining: number,
    expirationDate: string
): Promise<boolean> {
    const message = `⏰ *Membresía por vencer*\n\n` +
        `Hola ${clientName}!\n\n` +
        `Tu membresía está por vencer:\n\n` +
        `📋 *${planName}*\n` +
        `📅 Vence: ${expirationDate}\n` +
        `⏳ Días restantes: ${daysRemaining}\n\n` +
        `Renueva para seguir disfrutando de tus clases.\n\n` +
        `¿Necesitas ayuda? Escríbenos 💬`;

    return sendWhatsAppMessage(phone, message);
}

