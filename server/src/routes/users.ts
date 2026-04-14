import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { UpdateProfileSchema, User } from '../types/auth.js';
import { z } from 'zod';
import { sendClientWelcomeEmail } from '../services/email.js';
import { sendClientWelcome } from '../lib/whatsapp.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// POST /api/users - Create new user (admin only)
// ============================================
const CreateMemberSchema = z.object({
    email: z.string().email('Email inválido'),
    displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    phone: z.string().min(8, 'Teléfono inválido'),
    password: z.string().min(8).optional(),
    dateOfBirth: z.string().optional(),
    acceptsCommunications: z.boolean().optional().default(false),
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const validation = CreateMemberSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { email, displayName, phone, password, dateOfBirth, acceptsCommunications } = validation.data;

        const existingUser = await queryOne<User>('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser) {
            return res.status(409).json({ error: 'Email ya registrado' });
        }

        const existingPhone = await queryOne<User>('SELECT id FROM users WHERE phone = $1', [phone]);
        if (existingPhone) {
            return res.status(409).json({ error: 'Teléfono ya registrado' });
        }

        const generatedPassword = password || randomBytes(6).toString('base64url');
        const passwordHash = await bcrypt.hash(generatedPassword, 12);

        const user = await queryOne<User>(
            `INSERT INTO users (
        email, password_hash, display_name, phone, role, accepts_communications, date_of_birth
      ) VALUES ($1, $2, $3, $4, 'client', $5, $6)
      RETURNING
        id, email, phone, display_name, photo_url, role,
        emergency_contact_name, emergency_contact_phone, health_notes,
        accepts_communications, date_of_birth, receive_reminders,
        receive_promotions, receive_weekly_summary, created_at, updated_at`,
            [email.toLowerCase(), passwordHash, displayName, phone, acceptsCommunications ?? false, dateOfBirth || null]
        );

        if (!user) {
            throw new Error('Failed to create user');
        }

        // Send welcome email + WhatsApp with credentials (fire and forget)
        const actualPassword = password || generatedPassword;

        sendClientWelcomeEmail({
            to: email.toLowerCase(),
            clientName: displayName,
            email: email.toLowerCase(),
            temporaryPassword: actualPassword,
        }).catch(err => console.error('Error sending welcome email:', err));

        sendClientWelcome(
            phone,
            displayName,
            email.toLowerCase(),
            actualPassword,
        ).catch(err => console.error('Error sending welcome WhatsApp:', err));

        res.status(201).json({
            user,
            ...(password ? {} : { tempPassword: generatedPassword }),
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// ============================================
// GET /api/users/:id - Get user by ID
// ============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Users can only view their own profile unless admin
        if (req.user!.userId !== id && req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const user = await queryOne<User>(
            `SELECT 
        id, email, phone, display_name, photo_url, role,
        emergency_contact_name, emergency_contact_phone, health_notes,
        accepts_communications, date_of_birth, receive_reminders,
        receive_promotions, receive_weekly_summary, created_at, updated_at
      FROM users 
      WHERE id = $1`,
            [id]
        );

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
});

// ============================================
// PUT /api/users/:id - Update user profile
// ============================================
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Users can only update their own profile unless admin
        if (req.user!.userId !== id && req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Handle direct is_active update (Admin only)
        if (req.body.isActive !== undefined && req.user!.role === 'admin') {
            const user = await queryOne<User>(
                'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                [req.body.isActive, id]
            );
            return res.json({ message: 'Estado de usuario actualizado', user });
        }

        // Validate input

        const validation = UpdateProfileSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.displayName !== undefined) {
            updates.push(`display_name = $${paramCount++}`);
            values.push(data.displayName);
        }
        if (data.phone !== undefined) {
            updates.push(`phone = $${paramCount++}`);
            values.push(data.phone);
        }
        if (data.dateOfBirth !== undefined) {
            updates.push(`date_of_birth = $${paramCount++}`);
            values.push(data.dateOfBirth || null);
        }
        if (data.emergencyContactName !== undefined) {
            updates.push(`emergency_contact_name = $${paramCount++}`);
            values.push(data.emergencyContactName || null);
        }
        if (data.emergencyContactPhone !== undefined) {
            updates.push(`emergency_contact_phone = $${paramCount++}`);
            values.push(data.emergencyContactPhone || null);
        }
        if (data.healthNotes !== undefined) {
            updates.push(`health_notes = $${paramCount++}`);
            values.push(data.healthNotes || null);
        }
        if (data.receiveReminders !== undefined) {
            updates.push(`receive_reminders = $${paramCount++}`);
            values.push(data.receiveReminders);
        }
        if (data.receivePromotions !== undefined) {
            updates.push(`receive_promotions = $${paramCount++}`);
            values.push(data.receivePromotions);
        }
        if (data.receiveWeeklySummary !== undefined) {
            updates.push(`receive_weekly_summary = $${paramCount++}`);
            values.push(data.receiveWeeklySummary);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay datos para actualizar' });
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        const user = await queryOne<User>(
            `UPDATE users 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING 
        id, email, phone, display_name, photo_url, role,
        emergency_contact_name, emergency_contact_phone, health_notes,
        accepts_communications, date_of_birth, receive_reminders,
        receive_promotions, receive_weekly_summary, created_at, updated_at`,
            values
        );

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            message: 'Perfil actualizado exitosamente',
            user
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// ============================================
// GET /api/users - List all users (admin only)
// ============================================
router.get('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { role, search, limit = 50, offset = 0, withMembership } = req.query;

        // Base query - optionally join with current membership
        let queryStr = `
      SELECT
        u.id, u.email, u.phone, u.display_name, u.photo_url, u.role, u.is_active,
        u.created_at, u.updated_at
        ${withMembership === 'true' ? `,
        m.id as membership_id,
        m.status as membership_status,
        m.start_date as membership_start_date,
        m.end_date as membership_end_date,
        m.classes_remaining,
        p.id as plan_id,
        p.name as plan_name,
        p.class_limit` : ''}
      FROM users u
      ${withMembership === 'true' ? `
      LEFT JOIN LATERAL (
        SELECT * FROM memberships
        WHERE user_id = u.id
        ORDER BY
          CASE WHEN status = 'active' THEN 0
               WHEN status = 'pending_activation' THEN 1
               WHEN status = 'pending_payment' THEN 2
               ELSE 3 END,
          created_at DESC
        LIMIT 1
      ) m ON true
      LEFT JOIN plans p ON m.plan_id = p.id
      ` : ''}
      WHERE 1=1
    `;
        const params: any[] = [];
        let paramCount = 1;

        if (role) {
            queryStr += ` AND u.role = $${paramCount++}`;
            params.push(role);
        }

        if (search) {
            queryStr += ` AND (
        u.display_name ILIKE $${paramCount} OR
        u.email ILIKE $${paramCount} OR
        u.phone ILIKE $${paramCount}
      )`;
            params.push(`%${search}%`);
            paramCount++;
        }

        queryStr += ` ORDER BY u.created_at DESC`;
        queryStr += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
        params.push(Number(limit), Number(offset));

        const users = await query<User>(queryStr, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const countParams: any[] = [];
        let countParamNum = 1;

        if (role) {
            countQuery += ` AND role = $${countParamNum++}`;
            countParams.push(role);
        }
        if (search) {
            countQuery += ` AND (display_name ILIKE $${countParamNum} OR email ILIKE $${countParamNum})`;
            countParams.push(`%${search}%`);
        }

        const countResult = await queryOne<{ total: string }>(countQuery, countParams);
        const total = parseInt(countResult?.total || '0', 10);

        res.json({
            users,
            pagination: {
                total,
                limit: Number(limit),
                offset: Number(offset),
            }
        });
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

// ============================================
// DELETE /api/users/:id - Delete user account
// ============================================
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Only admin can delete users (or self? allowing only admin for now for safety)
        if (req.user!.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden eliminar usuarios.' });
        }

        // 1. Check for history to decide Soft vs Hard delete
        // We check bookings, memberships, and payments/transactions
        const historyChecks = await Promise.all([
            queryOne<{ count: string }>('SELECT COUNT(*) as count FROM bookings WHERE user_id = $1', [id]),
            queryOne<{ count: string }>('SELECT COUNT(*) as count FROM memberships WHERE user_id = $1', [id]),
            // Check transactions if table exists (assuming yes based on schema)
            queryOne<{ count: string }>('SELECT COUNT(*) as count FROM transactions WHERE user_id = $1', [id]),
        ]);

        const hasHistory = historyChecks.some(check => parseInt(check?.count || '0', 10) > 0);

        if (hasHistory) {
            // SOFT DELETE
            const result = await queryOne(
                'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
                [id]
            );

            if (!result) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            return res.json({
                message: 'Usuario desactivado debido a historial existente (clases/pagos).',
                type: 'soft_delete'
            });
        } else {
            // HARD DELETE
            const result = await queryOne(
                'DELETE FROM users WHERE id = $1 RETURNING id',
                [id]
            );

            if (!result) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }

            return res.json({
                message: 'Usuario eliminado permanentemente.',
                type: 'hard_delete'
            });
        }
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Error al eliminar cuenta' });
    }
});

export default router;
