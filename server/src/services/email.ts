import { Resend } from 'resend';

// Initialize Resend client
let resendClient: Resend | null = null;

function getResend(): Resend {
    if (!resendClient) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('RESEND_API_KEY must be configured in environment variables.');
        }
        resendClient = new Resend(apiKey);
    }
    return resendClient;
}

// Get FROM email - Resend requires verified domain or use onboarding@resend.dev for testing
function getFromEmail(): string {
    return process.env.EMAIL_FROM || 'Essenza del Flusso <onboarding@resend.dev>';
}

// Get frontend URL - single source of truth for all email links
function getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'https://www.essenza-studio.com.mx';
}

// Get logo URL for emails
function getLogoUrl(): string {
    return `${getFrontendUrl()}/essenza.jpg`;
}

interface SendMagicLinkParams {
    to: string;
    instructorName: string;
    magicLink: string;
}

export async function sendInstructorMagicLink({ to, instructorName, magicLink }: SendMagicLinkParams) {
    const resend = getResend();

    const { data, error } = await resend.emails.send({
        from: getFromEmail(),
        to: [to],
        subject: '🔑 Acceso a tu Portal de Instructor - Essenza del Flusso',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .container { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { font-size: 28px; font-weight: bold; color: #8C8475; }
                    .button { display: inline-block; background: #8C8475; color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; margin: 25px 0; font-weight: 600; }
                    .info-box { background: #f8f8f8; border-left: 4px solid #8C8475; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
                    .warning { color: #e74c3c; font-size: 14px; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header"><img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 120px; height: auto;"></div>
                    <h1>¡Hola ${instructorName}! 👋</h1>
                    <p>Te damos la bienvenida al portal de instructores de Essenza del Flusso.</p>
                    <p>Haz clic en el botón de abajo para acceder a tu plataforma de instructor.</p>
                    <div style="text-align: center;">
                        <a href="${magicLink}" class="button">🔓 Acceder al Portal de Instructor</a>
                    </div>
                    <div class="info-box">
                        <strong>📋 En tu portal podrás:</strong>
                        <ul style="margin: 10px 0;">
                            <li>Ver tus clases programadas</li>
                            <li>Gestionar tu horario</li>
                            <li>Ver información de tus alumnos</li>
                        </ul>
                    </div>
                    <p class="warning">⚠️ Este enlace expira en 1 hora y solo puede usarse una vez.</p>
                    <div class="footer"><p>Con cariño,<br><strong>Equipo Essenza del Flusso</strong></p></div>
                </div>
            </body>
            </html>
        `,
    });

    if (error) {
        console.error('Error in sendInstructorMagicLink:', error);
        throw error;
    }

    console.log('Magic link email sent successfully:', data?.id);
    return { id: data?.id };
}

interface SendInstructorCredentialsParams {
    to: string;
    instructorName: string;
    email: string;
    temporaryPassword: string;
    loginUrl: string;
    coachNumber?: string;
}

export async function sendInstructorCredentials({
    to,
    instructorName,
    email,
    temporaryPassword,
    loginUrl,
    coachNumber
}: SendInstructorCredentialsParams) {
    const resend = getResend();

    const { data, error } = await resend.emails.send({
        from: getFromEmail(),
        to: [to],
        subject: '🎉 Bienvenido al Equipo de Essenza del Flusso - Tus Credenciales',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
                    .container { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #8C8475; }
                    .logo { font-size: 32px; font-weight: bold; color: #8C8475; }
                    .credentials-box { background: linear-gradient(135deg, #f8f8f8 0%, #e8e5dd 100%); border-left: 4px solid #8C8475; padding: 25px; margin: 25px 0; border-radius: 8px; }
                    .credential-item { margin: 15px 0; padding: 12px; background: white; border-radius: 6px; }
                    .credential-label { font-size: 12px; text-transform: uppercase; color: #8C8475; font-weight: 600; }
                    .credential-value { font-size: 16px; font-weight: 600; color: #1a1a1a; font-family: monospace; }
                    .button { display: inline-block; background: #8C8475; color: white !important; text-decoration: none; padding: 16px 40px; border-radius: 8px; margin: 25px 0; font-weight: 600; }
                    .security-note { background: #ffebee; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; }
                    .footer { text-align: center; margin-top: 40px; padding-top: 25px; border-top: 2px solid #eee; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 140px; height: auto; margin-bottom: 10px;">
                        <p style="color: #999; font-size: 14px;">Portal de Instructores</p>
                    </div>
                    <h1>🎉 ¡Bienvenido al equipo, ${instructorName}!</h1>
                    <p>Hemos creado tu cuenta en nuestro sistema. Aquí están tus credenciales:</p>
                    <div class="credentials-box">
                        <h3 style="margin-top: 0; color: #8C8475;">🔐 Tus Credenciales</h3>
                        ${coachNumber ? `<div class="credential-item"><div class="credential-label">🏷️ Número de Coach</div><div class="credential-value">${coachNumber}</div></div>` : ''}
                        <div class="credential-item"><div class="credential-label">📧 Email</div><div class="credential-value">${email}</div></div>
                        <div class="credential-item"><div class="credential-label">🔑 Contraseña Temporal</div><div class="credential-value">${temporaryPassword}</div></div>
                    </div>
                    <div style="text-align: center;">
                        <a href="${loginUrl}" class="button">🚀 Acceder al Portal</a>
                    </div>
                    <div class="security-note">
                        <strong>⚠️ Importante:</strong> Esta es una contraseña temporal. Cámbiala en tu primer inicio de sesión.
                    </div>
                    <div class="footer"><p><strong>¡Gracias por ser parte de Essenza del Flusso! 💜</strong></p></div>
                </div>
            </body>
            </html>
        `,
    });

    if (error) {
        console.error('Error in sendInstructorCredentials:', error);
        throw error;
    }

    console.log('Instructor credentials email sent successfully:', data?.id);
    return { id: data?.id };
}

interface SendClassAssignmentParams {
    to: string;
    coachName: string;
    className: string;
    classDate: string;
    startTime: string;
    endTime: string;
    capacity: number;
    portalUrl?: string;
}

export async function sendClassAssignmentNotification({
    to,
    coachName,
    className,
    classDate,
    startTime,
    endTime,
    capacity,
    portalUrl
}: SendClassAssignmentParams) {
    try {
        const resend = getResend();
        const finalPortalUrl = portalUrl || `${getFrontendUrl()}/coach`;

        const dateObj = new Date(classDate + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const { data, error } = await resend.emails.send({
            from: getFromEmail(),
            to: [to],
            subject: `📅 Nueva Clase Asignada: ${className} - ${formattedDate}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                        .container { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                        .header { text-align: center; margin-bottom: 25px; }
                        .logo { font-size: 28px; font-weight: bold; color: #8C8475; }
                        .class-card { background: linear-gradient(135deg, #f8f8f8 0%, #e8e5dd 100%); border-left: 4px solid #8C8475; padding: 25px; margin: 20px 0; border-radius: 8px; }
                        .class-name { font-size: 20px; font-weight: 700; color: #8C8475; margin-bottom: 15px; }
                        .button { display: inline-block; background: #8C8475; color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; margin: 20px 0; font-weight: 600; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header"><img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 120px; height: auto;"></div>
                        <h1>¡Hola ${coachName}! 👋</h1>
                        <p>Se te ha asignado una nueva clase:</p>
                        <div class="class-card">
                            <div class="class-name">🎯 ${className}</div>
                            <p>📅 <strong>Fecha:</strong> ${formattedDate}</p>
                            <p>🕐 <strong>Horario:</strong> ${startTime} - ${endTime}</p>
                            <p>👥 <strong>Capacidad:</strong> ${capacity} alumnos</p>
                        </div>
                        <div style="text-align: center;">
                            <a href="${finalPortalUrl}" class="button">📱 Ver en mi Portal</a>
                        </div>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error in sendClassAssignmentNotification:', error);
            return null;
        }

        console.log('Class assignment notification sent:', data?.id);
        return { id: data?.id };
    } catch (error) {
        console.error('Error in sendClassAssignmentNotification:', error);
        return null;
    }
}

// ============================================
// Membership Activated Email
// ============================================

interface SendMembershipActivatedParams {
    to: string;
    clientName: string;
    planName: string;
    classesIncluded: number | null;
    startDate: string;
    endDate: string;
    bookingUrl?: string;
}

export async function sendMembershipActivatedEmail({
    to,
    clientName,
    planName,
    classesIncluded,
    startDate,
    endDate,
    bookingUrl,
}: SendMembershipActivatedParams) {
    try {
        const resend = getResend();
        const finalBookingUrl = bookingUrl || `${getFrontendUrl()}/app/book`;

        const startObj = new Date(startDate + 'T12:00:00');
        const endObj = new Date(endDate + 'T12:00:00');
        const fmtStart = startObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
        const fmtEnd = endObj.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

        const classesText = classesIncluded
            ? `<p>🎟️ <strong>Clases incluidas:</strong> ${classesIncluded}</p>`
            : `<p>🎟️ <strong>Clases:</strong> Ilimitadas</p>`;

        const { data, error } = await resend.emails.send({
            from: getFromEmail(),
            to: [to],
            subject: `🎉 ¡Membresía activada! - ${planName} - Essenza del Flusso`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f5f0 0%, #e8e5dd 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" style="padding: 30px 0;">
                                            <img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 100px; height: auto;">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(140, 132, 117, 0.15); overflow: hidden;">
                                            <div style="height: 4px; background: linear-gradient(90deg, #B8A88A 0%, #8C8475 50%, #B8A88A 100%);"></div>
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 45px 40px;">
                                                        <div style="text-align: center; margin-bottom: 25px;">
                                                            <div style="display: inline-block; width: 70px; height: 70px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 50%; line-height: 70px; font-size: 32px;">
                                                                🎉
                                                            </div>
                                                        </div>
                                                        <h1 style="margin: 0 0 10px; font-size: 26px; font-weight: 600; color: #1a1a1a; text-align: center;">
                                                            ¡Bienvenida, ${clientName}!
                                                        </h1>
                                                        <p style="margin: 0 0 30px; font-size: 16px; color: #666; text-align: center;">
                                                            Tu membresía ha sido activada exitosamente
                                                        </p>
                                                        <div style="background: linear-gradient(135deg, #f8f8f8 0%, #e8e5dd 100%); border-left: 4px solid #8C8475; padding: 25px; margin: 20px 0; border-radius: 8px;">
                                                            <h3 style="margin: 0 0 15px; color: #8C8475;">📋 Tu Plan</h3>
                                                            <p style="margin: 5px 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">${planName}</p>
                                                            <p>📅 <strong>Inicio:</strong> ${fmtStart}</p>
                                                            <p>📅 <strong>Vence:</strong> ${fmtEnd}</p>
                                                            ${classesText}
                                                        </div>
                                                        <div style="text-align: center; margin: 35px 0;">
                                                            <a href="${finalBookingUrl}" style="display: inline-block; background: linear-gradient(135deg, #8C8475 0%, #73695e 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(140, 132, 117, 0.4);">
                                                                Reservar mi primera clase
                                                            </a>
                                                        </div>
                                                        <p style="margin: 25px 0 0; font-size: 13px; color: #999; text-align: center;">
                                                            ¿Dudas? Responde a este correo o escríbenos por WhatsApp.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 30px 20px; text-align: center;">
                                            <p style="margin: 0 0 5px; font-size: 13px; color: #8C8475; font-weight: 500;">Essenza del Flusso</p>
                                            <p style="margin: 0; font-size: 12px; color: #b0a89c;">Transformando vidas a través del movimiento</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error in sendMembershipActivatedEmail:', error);
            return null;
        }

        console.log('Membership activated email sent:', data?.id);
        return { id: data?.id };
    } catch (error) {
        console.error('Error in sendMembershipActivatedEmail:', error);
        return null;
    }
}

// ============================================
// New Event Announcement Email (bulk)
// ============================================

interface SendEventAnnouncementParams {
    to: string[];
    eventTitle: string;
    eventType: string;
    eventDate: string;
    startTime: string;
    endTime: string;
    location: string;
    price: number;
    instructor: string;
    description: string;
    eventUrl?: string;
}

export async function sendEventAnnouncementEmail({
    to,
    eventTitle,
    eventType,
    eventDate,
    startTime,
    endTime,
    location,
    price,
    instructor,
    description,
    eventUrl,
}: SendEventAnnouncementParams) {
    try {
        const resend = getResend();
        const finalEventUrl = eventUrl || `${getFrontendUrl()}/app/events`;

        const dateObj = new Date(eventDate + 'T12:00:00');
        const fmtDate = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        const priceText = price > 0 ? `$${price} MXN` : 'Gratis';

        const { data, error } = await resend.emails.send({
            from: getFromEmail(),
            to: to,
            subject: `✨ Nuevo evento: ${eventTitle} - Essenza del Flusso`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f5f0 0%, #e8e5dd 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" style="padding: 30px 0;">
                                            <img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 100px; height: auto;">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(140, 132, 117, 0.15); overflow: hidden;">
                                            <div style="height: 4px; background: linear-gradient(90deg, #EC4899 0%, #8B5CF6 50%, #EC4899 100%);"></div>
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 45px 40px;">
                                                        <div style="text-align: center; margin-bottom: 25px;">
                                                            <div style="display: inline-block; width: 70px; height: 70px; background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-radius: 50%; line-height: 70px; font-size: 32px;">
                                                                ✨
                                                            </div>
                                                        </div>
                                                        <h1 style="margin: 0 0 10px; font-size: 26px; font-weight: 600; color: #1a1a1a; text-align: center;">
                                                            ${eventTitle}
                                                        </h1>
                                                        <p style="margin: 0 0 25px; font-size: 14px; color: #8B5CF6; text-align: center; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                                                            ${eventType}
                                                        </p>
                                                        <p style="margin: 0 0 25px; font-size: 15px; color: #666; text-align: center; line-height: 1.6;">
                                                            ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}
                                                        </p>
                                                        <div style="background: linear-gradient(135deg, #f8f8f8 0%, #e8e5dd 100%); border-left: 4px solid #8C8475; padding: 20px; margin: 20px 0; border-radius: 8px;">
                                                            <p style="margin: 8px 0;">📅 <strong>${fmtDate}</strong></p>
                                                            <p style="margin: 8px 0;">⏰ ${startTime} - ${endTime}</p>
                                                            <p style="margin: 8px 0;">📍 ${location}</p>
                                                            <p style="margin: 8px 0;">👩‍🏫 ${instructor}</p>
                                                            <p style="margin: 8px 0; font-size: 20px; font-weight: 700; color: #8C8475;">${priceText}</p>
                                                        </div>
                                                        <div style="text-align: center; margin: 35px 0;">
                                                            <a href="${finalEventUrl}" style="display: inline-block; background: linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);">
                                                                Inscribirme ahora
                                                            </a>
                                                        </div>
                                                        <p style="margin: 25px 0 0; font-size: 13px; color: #999; text-align: center;">
                                                            Lugares limitados. ¡No te lo pierdas!
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 30px 20px; text-align: center;">
                                            <p style="margin: 0 0 5px; font-size: 13px; color: #8C8475; font-weight: 500;">Essenza del Flusso</p>
                                            <p style="margin: 0; font-size: 12px; color: #b0a89c;">Transformando vidas a través del movimiento</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error in sendEventAnnouncementEmail:', error);
            return null;
        }

        console.log(`Event announcement email sent to ${to.length} recipients:`, data?.id);
        return { id: data?.id };
    } catch (error) {
        console.error('Error in sendEventAnnouncementEmail:', error);
        return null;
    }
}

// ============================================
// Client Welcome Email (new client created by admin)
// ============================================

interface SendClientWelcomeParams {
    to: string;
    clientName: string;
    email: string;
    temporaryPassword: string;
    loginUrl?: string;
}

export async function sendClientWelcomeEmail({
    to,
    clientName,
    email,
    temporaryPassword,
    loginUrl,
}: SendClientWelcomeParams) {
    try {
        const resend = getResend();
        const finalLoginUrl = loginUrl || `${getFrontendUrl()}/app/login`;

        const { data, error } = await resend.emails.send({
            from: getFromEmail(),
            to: [to],
            subject: '🎉 Bienvenido a Essenza del Flusso - Tus datos de acceso',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f5f0 0%, #e8e5dd 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" style="padding: 30px 0;">
                                            <img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 100px; height: auto;">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(140, 132, 117, 0.15); overflow: hidden;">
                                            <div style="height: 4px; background: linear-gradient(90deg, #B8A88A 0%, #8C8475 50%, #B8A88A 100%);"></div>
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 45px 40px;">
                                                        <div style="text-align: center; margin-bottom: 25px;">
                                                            <div style="display: inline-block; width: 70px; height: 70px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 50%; line-height: 70px; font-size: 32px;">
                                                                🎉
                                                            </div>
                                                        </div>
                                                        <h1 style="margin: 0 0 10px; font-size: 26px; font-weight: 600; color: #1a1a1a; text-align: center;">
                                                            ¡Bienvenido, ${clientName}!
                                                        </h1>
                                                        <p style="margin: 0 0 30px; font-size: 16px; color: #666; text-align: center;">
                                                            Tu cuenta en Essenza del Flusso ha sido creada
                                                        </p>
                                                        <div style="background: linear-gradient(135deg, #f8f8f8 0%, #e8e5dd 100%); border-left: 4px solid #8C8475; padding: 25px; margin: 20px 0; border-radius: 8px;">
                                                            <h3 style="margin: 0 0 15px; color: #8C8475;">🔐 Tus datos de acceso</h3>
                                                            <div style="margin: 10px 0; padding: 12px; background: white; border-radius: 6px;">
                                                                <div style="font-size: 12px; text-transform: uppercase; color: #8C8475; font-weight: 600;">📧 Email</div>
                                                                <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; font-family: monospace;">${email}</div>
                                                            </div>
                                                            <div style="margin: 10px 0; padding: 12px; background: white; border-radius: 6px;">
                                                                <div style="font-size: 12px; text-transform: uppercase; color: #8C8475; font-weight: 600;">🔑 Contraseña</div>
                                                                <div style="font-size: 16px; font-weight: 600; color: #1a1a1a; font-family: monospace;">${temporaryPassword}</div>
                                                            </div>
                                                        </div>
                                                        <div style="text-align: center; margin: 35px 0;">
                                                            <a href="${finalLoginUrl}" style="display: inline-block; background: linear-gradient(135deg, #8C8475 0%, #73695e 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(140, 132, 117, 0.4);">
                                                                Iniciar sesión
                                                            </a>
                                                        </div>
                                                        <div style="background: #ffebee; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px;">
                                                            <strong>⚠️ Importante:</strong> Te recomendamos cambiar tu contraseña en tu primer inicio de sesión.
                                                        </div>
                                                        <p style="margin: 25px 0 0; font-size: 13px; color: #999; text-align: center;">
                                                            ¿Dudas? Responde a este correo o escríbenos por WhatsApp.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 30px 20px; text-align: center;">
                                            <p style="margin: 0 0 5px; font-size: 13px; color: #8C8475; font-weight: 500;">Essenza del Flusso</p>
                                            <p style="margin: 0; font-size: 12px; color: #b0a89c;">Transformando vidas a través del movimiento</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error in sendClientWelcomeEmail:', error);
            return null;
        }

        console.log('Client welcome email sent:', data?.id);
        return { id: data?.id };
    } catch (error) {
        console.error('Error in sendClientWelcomeEmail:', error);
        return null;
    }
}

// ============================================
// Order Rejected Email
// ============================================

interface SendOrderRejectedParams {
    to: string;
    clientName: string;
    orderNumber: string;
    planName: string;
    rejectionReason?: string;
}

export async function sendOrderRejectedEmail({
    to,
    clientName,
    orderNumber,
    planName,
    rejectionReason,
}: SendOrderRejectedParams) {
    try {
        const resend = getResend();
        const frontendUrl = getFrontendUrl();
        const reasonBlock = rejectionReason
            ? `<div style="background: #fff3cd; border-left: 4px solid #e6a23c; padding: 15px; margin: 20px 0; border-radius: 4px;">
                   <strong>Motivo:</strong> ${rejectionReason}
               </div>`
            : '';

        const { data, error } = await resend.emails.send({
            from: getFromEmail(),
            to: [to],
            subject: `❌ Pago no aprobado - Orden #${orderNumber} - Essenza del Flusso`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f5f0 0%, #e8e5dd 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td align="center" style="padding: 40px 20px;">
                                <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td align="center" style="padding: 30px 0;">
                                            <img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 100px; height: auto;">
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(140, 132, 117, 0.15); overflow: hidden;">
                                            <div style="height: 4px; background: linear-gradient(90deg, #e74c3c 0%, #c0392b 50%, #e74c3c 100%);"></div>
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 45px 40px;">
                                                        <div style="text-align: center; margin-bottom: 25px;">
                                                            <div style="display: inline-block; width: 70px; height: 70px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 50%; line-height: 70px; font-size: 32px;">
                                                                ❌
                                                            </div>
                                                        </div>
                                                        <h1 style="margin: 0 0 10px; font-size: 26px; font-weight: 600; color: #1a1a1a; text-align: center;">
                                                            Pago no aprobado
                                                        </h1>
                                                        <p style="margin: 0 0 25px; font-size: 16px; color: #666; text-align: center;">
                                                            Hola ${clientName}, tu comprobante de pago necesita atención
                                                        </p>
                                                        <div style="background: linear-gradient(135deg, #f8f8f8 0%, #e8e5dd 100%); border-left: 4px solid #8C8475; padding: 20px; margin: 20px 0; border-radius: 8px;">
                                                            <p style="margin: 5px 0;"><strong>Orden:</strong> #${orderNumber}</p>
                                                            <p style="margin: 5px 0;"><strong>Plan:</strong> ${planName}</p>
                                                        </div>
                                                        ${reasonBlock}
                                                        <p style="margin: 20px 0; font-size: 15px; color: #666; line-height: 1.6;">
                                                            Puedes subir un nuevo comprobante desde tu cuenta o contactarnos para resolver cualquier duda.
                                                        </p>
                                                        <div style="text-align: center; margin: 35px 0;">
                                                            <a href="${frontendUrl}/app/orders" style="display: inline-block; background: linear-gradient(135deg, #8C8475 0%, #73695e 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(140, 132, 117, 0.4);">
                                                                Ver mis ordenes
                                                            </a>
                                                        </div>
                                                        <p style="margin: 25px 0 0; font-size: 13px; color: #999; text-align: center;">
                                                            ¿Dudas? Responde a este correo o escríbenos por WhatsApp.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 30px 20px; text-align: center;">
                                            <p style="margin: 0 0 5px; font-size: 13px; color: #8C8475; font-weight: 500;">Essenza del Flusso</p>
                                            <p style="margin: 0; font-size: 12px; color: #b0a89c;">Transformando vidas a través del movimiento</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error in sendOrderRejectedEmail:', error);
            return null;
        }

        console.log('Order rejected email sent:', data?.id);
        return { id: data?.id };
    } catch (error) {
        console.error('Error in sendOrderRejectedEmail:', error);
        return null;
    }
}

interface SendPasswordResetParams {
    to: string;
    resetLink: string;
}

export async function sendPasswordResetEmail({ to, resetLink }: SendPasswordResetParams) {
    const resend = getResend();

    const { data, error } = await resend.emails.send({
        from: getFromEmail(),
        to: [to],
        subject: '🔐 Restablecer contraseña - Essenza del Flusso',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f5f0 0%, #e8e5dd 100%); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td align="center" style="padding: 40px 20px;">
                            <table role="presentation" style="max-width: 500px; width: 100%; border-collapse: collapse;">
                                <!-- Logo Header -->
                                <tr>
                                    <td align="center" style="padding: 30px 0;">
                                        <img src="${getLogoUrl()}" alt="Essenza del Flusso" style="width: 100px; height: auto;">
                                    </td>
                                </tr>
                                <!-- Main Card -->
                                <tr>
                                    <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 10px 40px rgba(140, 132, 117, 0.15); overflow: hidden;">
                                        <!-- Gold Accent Bar -->
                                        <div style="height: 4px; background: linear-gradient(90deg, #B8A88A 0%, #8C8475 50%, #B8A88A 100%);"></div>
                                        
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 45px 40px;">
                                                    <!-- Icon -->
                                                    <div style="text-align: center; margin-bottom: 25px;">
                                                        <div style="display: inline-block; width: 70px; height: 70px; background: linear-gradient(135deg, #f8f6f3 0%, #e8e5dd 100%); border-radius: 50%; line-height: 70px; font-size: 32px;">
                                                            🔐
                                                        </div>
                                                    </div>
                                                    
                                                    <!-- Title -->
                                                    <h1 style="margin: 0 0 15px; font-size: 26px; font-weight: 600; color: #1a1a1a; text-align: center; letter-spacing: -0.5px;">
                                                        Recupera tu acceso
                                                    </h1>
                                                    
                                                    <!-- Subtitle -->
                                                    <p style="margin: 0 0 30px; font-size: 16px; color: #666; text-align: center; line-height: 1.6;">
                                                        Recibimos una solicitud para restablecer la contraseña de tu cuenta en Essenza del Flusso.
                                                    </p>
                                                    
                                                    <!-- Button -->
                                                    <div style="text-align: center; margin: 35px 0;">
                                                        <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #8C8475 0%, #73695e 100%); color: #ffffff; text-decoration: none; padding: 16px 45px; border-radius: 50px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(140, 132, 117, 0.4);">
                                                            Restablecer Contraseña
                                                        </a>
                                                    </div>
                                                    
                                                    <!-- Timer Notice -->
                                                    <div style="background: linear-gradient(135deg, #fff8f0 0%, #fef5ec 100%); border-radius: 12px; padding: 16px 20px; margin: 25px 0; border-left: 4px solid #e6a23c;">
                                                        <p style="margin: 0; font-size: 14px; color: #8a6d3b;">
                                                            <strong>⏱️ Este enlace expira en 1 hora</strong><br>
                                                            <span style="color: #a67c00;">Por tu seguridad, solicita uno nuevo si no alcanzas a usarlo.</span>
                                                        </p>
                                                    </div>
                                                    
                                                    <!-- Security Note -->
                                                    <p style="margin: 25px 0 0; font-size: 13px; color: #999; text-align: center; line-height: 1.5;">
                                                        Si no solicitaste este cambio, puedes ignorar este correo.<br>
                                                        Tu contraseña seguirá siendo la misma.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <!-- Footer -->
                                <tr>
                                    <td style="padding: 30px 20px; text-align: center;">
                                        <p style="margin: 0 0 10px; font-size: 13px; color: #8C8475; font-weight: 500;">
                                            Essenza del Flusso
                                        </p>
                                        <p style="margin: 0; font-size: 12px; color: #b0a89c;">
                                            Transformando vidas a través del movimiento
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `,
    });

    if (error) {
        console.error('Error in sendPasswordResetEmail:', error);
        throw error;
    }

    console.log('Password reset email sent:', data?.id);
    return { id: data?.id };
}
