import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole, optionalAuth } from '../middleware/auth.js';
import { sendInstructorCredentials } from '../services/email.js';
import { z } from 'zod';

const router = Router();

// Helper to coerce various truthy/falsy values to boolean
const coerceBool = z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
        if (['true', '1', 'on', 'yes'].includes(val.toLowerCase())) return true;
        if (['false', '0', 'off', 'no', ''].includes(val.toLowerCase())) return false;
    }
    return val;
}, z.boolean());

// Schema for Instructor validation (existing user)
const InstructorSchema = z.object({
    userId: z.string().uuid(),
    displayName: z.string().min(2, 'El nombre es obligatorio'),
    bio: z.string().optional(),
    priorities: z.array(z.string()).default([]), // specificities JSONB
    certifications: z.array(z.string()).default([]),
    phone: z.string().optional(),
    isActive: coerceBool.default(true),
    visiblePublic: coerceBool.default(true),
});

// Schema for creating instructor with new user (no existing account)
const InstructorCreateNewSchema = z.object({
    email: z.string().email('Email inválido'),
    displayName: z.string().min(2, 'El nombre es obligatorio'),
    bio: z.string().optional(),
    priorities: z.array(z.string()).default([]),
    certifications: z.array(z.string()).default([]),
    phone: z.string().optional(),
    isActive: coerceBool.default(true),
    visiblePublic: coerceBool.default(true),
});

// Update schema (partial)
const InstructorUpdateSchema = InstructorSchema.omit({ userId: true }).partial();

// ============================================
// GET /api/instructors - List all active instructors (Public)
// ============================================
router.get('/', optionalAuth, async (req: Request, res: Response) => {
    try {
        const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
        const { all } = req.query;

        // Admin gets full data, public gets safe fields only
        const selectFields = isAdmin
            ? `i.id, i.user_id, i.display_name, i.bio, i.photo_url,
               i.specialties, i.certifications, i.is_active, i.visible_public,
               i.coach_number, i.temp_password, i.last_login, i.phone as instructor_phone,
               u.email, u.phone as user_phone`
            : `i.id, i.user_id, i.display_name, i.bio, i.photo_url,
               i.specialties, i.certifications, i.is_active, i.visible_public`;

        let queryStr = `
      SELECT ${selectFields}
      FROM instructors i
      JOIN users u ON i.user_id = u.id
    `;

        if (!(isAdmin && all === 'true')) {
            queryStr += ` WHERE i.is_active = true`;
        }

        queryStr += ` ORDER BY i.display_name ASC`;

        const instructors = await query(queryStr);
        res.json(instructors);
    } catch (error) {
        console.error('List instructors error:', error);
        res.status(500).json({ error: 'Error al obtener instructores' });
    }
});

// ============================================
// POST /api/instructors - Create instructor (Admin)
// Supports two flows:
//   1) userId provided → link existing user as instructor
//   2) email provided (no userId) → create user + instructor automatically
// ============================================
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const hasUserId = req.body.userId && req.body.userId !== '';

        let userId: string;
        let displayName: string;
        let bio: string | undefined;
        let priorities: string[] = [];
        let certifications: string[] = [];
        let phone: string | undefined;
        let isActive = true;
        let visiblePublic = true;
        let createdCredentials: { email: string; password: string; coachNumber: string } | null = null;

        if (hasUserId) {
            // ── Flow 1: Link existing user ──
            const validation = InstructorSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: 'Datos inválidos',
                    details: validation.error.flatten().fieldErrors,
                });
            }
            const data = validation.data;
            userId = data.userId;
            displayName = data.displayName;
            bio = data.bio;
            priorities = data.priorities;
            certifications = data.certifications;
            phone = data.phone;
            isActive = data.isActive;
            visiblePublic = data.visiblePublic;
        } else {
            // ── Flow 2: Create new user from email ──
            const validation = InstructorCreateNewSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    error: 'Datos inválidos',
                    details: validation.error.flatten().fieldErrors,
                });
            }
            const data = validation.data;
            const email = data.email.toLowerCase().trim();

            // Check if email already exists
            const existingUser = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser) {
                // User exists but wasn't found via search — use them
                userId = existingUser.id;
            } else {
                // Create new user with random password
                const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
                const passwordHash = await bcrypt.hash(tempPassword, 12);

                const newUser = await queryOne<{ id: string }>(
                    `INSERT INTO users (email, phone, display_name, role, password_hash)
                     VALUES ($1, $2, $3, 'instructor', $4)
                     RETURNING id`,
                    [email, data.phone || '', data.displayName, passwordHash]
                );

                if (!newUser) {
                    return res.status(500).json({ error: 'Error al crear el usuario' });
                }

                userId = newUser.id;

                // Generate coach number
                const coachNum = await queryOne<{ generate_coach_number: string }>('SELECT generate_coach_number()');
                const coachNumber = coachNum?.generate_coach_number || `COACH-${Date.now()}`;

                createdCredentials = { email, password: tempPassword, coachNumber };

                // We'll set the coach_number after creating the instructor record
            }

            displayName = data.displayName;
            bio = data.bio;
            priorities = data.priorities;
            certifications = data.certifications;
            phone = data.phone;
            isActive = data.isActive;
            visiblePublic = data.visiblePublic;
        }

        // Check if user is already an instructor
        const existing = await queryOne('SELECT id FROM instructors WHERE user_id = $1', [userId]);
        if (existing) {
            return res.status(400).json({ error: 'El usuario ya es instructor' });
        }

        // Update user role to instructor if not already
        await query('UPDATE users SET role = $1 WHERE id = $2', ['instructor', userId]);

        // Get user photo (default to profile photo)
        const user = await queryOne<{ photo_url: string | null }>('SELECT photo_url FROM users WHERE id = $1', [userId]);

        const newInstructor = await queryOne<any>(
            `INSERT INTO instructors (
                user_id, display_name, bio, photo_url, specialties, certifications, 
                is_active, visible_public, phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                userId,
                displayName,
                bio || null,
                user?.photo_url || null,
                JSON.stringify(priorities),
                JSON.stringify(certifications),
                isActive,
                visiblePublic,
                phone || null,
            ]
        );

        // If we created credentials, set coach_number and password on the instructor record
        if (createdCredentials && newInstructor) {
            const passwordHash = await bcrypt.hash(createdCredentials.password, 12);
            await query(
                `UPDATE instructors SET coach_number = $1, password_hash = $2, temp_password = true WHERE id = $3`,
                [createdCredentials.coachNumber, passwordHash, newInstructor.id]
            );
            newInstructor.coach_number = createdCredentials.coachNumber;
        }

        res.status(201).json({
            ...newInstructor,
            credentials: createdCredentials ? {
                email: createdCredentials.email,
                password: createdCredentials.password,
                coachNumber: createdCredentials.coachNumber,
            } : undefined,
        });
    } catch (error) {
        console.error('Create instructor error:', error);
        res.status(500).json({ error: 'Error al crear instructor' });
    }
});

// ============================================
// PUT /api/instructors/:id - Update instructor (Admin)
// ============================================
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log(`[UPDATE INSTRUCTOR] Starting update for ID: ${id}`);
        console.log(`[UPDATE INSTRUCTOR] Body keys: ${Object.keys(req.body)}`);
        console.log(`[UPDATE INSTRUCTOR] Body size: ${JSON.stringify(req.body).length} bytes`);

        const validation = InstructorUpdateSchema.safeParse(req.body);

        if (!validation.success) {
            console.log(`[UPDATE INSTRUCTOR] Validation failed:`, validation.error.flatten().fieldErrors);
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const data = validation.data;
        console.log(`[UPDATE INSTRUCTOR] Validation passed, data keys: ${Object.keys(data)}`);

        const existing = await queryOne<{ id: string; user_id: string }>(
            'SELECT id, user_id FROM instructors WHERE id = $1',
            [id]
        );
        if (!existing) {
            console.log(`[UPDATE INSTRUCTOR] Instructor not found for ID: ${id}`);
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }

        console.log(`[UPDATE INSTRUCTOR] Found existing instructor: ${existing.id}`);

        // Update email in users table if provided
        if (req.body.email) {
            const emailLower = req.body.email.toLowerCase();
            console.log(`[UPDATE INSTRUCTOR] Updating email: ${emailLower}`);

            // Check if email is already taken by another user
            const emailTaken = await queryOne<{ id: string; role: string }>(
                'SELECT id, role FROM users WHERE email = $1 AND id != $2',
                [emailLower, existing.user_id]
            );
            if (emailTaken) {
                // If the email belongs to a client, reassign that user to this instructor
                if (emailTaken.role === 'client') {
                    console.log(`[UPDATE INSTRUCTOR] Reassigning client user ${emailTaken.id} to instructor`);

                    // Update the client user's role to instructor
                    await query('UPDATE users SET role = $1 WHERE id = $2', ['instructor', emailTaken.id]);

                    // Point this instructor to the existing user
                    await query('UPDATE instructors SET user_id = $1, email = $2 WHERE id = $3', [emailTaken.id, emailLower, id]);

                    // If the old user_id was different and has no other references, leave it
                    // (the old user record stays but is no longer linked)
                } else {
                    return res.status(409).json({ error: 'Este email ya está en uso por otro usuario con rol ' + emailTaken.role });
                }
            } else {
                // Email is free or same user — just update
                if (existing.user_id) {
                    await query(
                        'UPDATE users SET email = $1 WHERE id = $2',
                        [emailLower, existing.user_id]
                    );
                }

                // Also update email in instructors table for consistency
                await query(
                    'UPDATE instructors SET email = $1 WHERE id = $2',
                    [emailLower, id]
                );
            }
        }

        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.displayName !== undefined) {
            updates.push(`display_name = $${paramCount++}`);
            values.push(data.displayName);
            console.log(`[UPDATE INSTRUCTOR] Will update display_name`);
        }
        if (data.bio !== undefined) {
            updates.push(`bio = $${paramCount++}`);
            values.push(data.bio);
            console.log(`[UPDATE INSTRUCTOR] Will update bio`);
        }

        // Allow admin to update photo_url directly (external URL or base64)
        if (req.body.photoUrl !== undefined) {
            const photoSize = req.body.photoUrl ? req.body.photoUrl.length : 0;
            console.log(`[UPDATE INSTRUCTOR] Will update photo_url, size: ${photoSize} bytes`);
            updates.push(`photo_url = $${paramCount++}`);
            values.push(req.body.photoUrl);
        }

        if (data.priorities !== undefined) {
            updates.push(`specialties = $${paramCount++}`);
            values.push(JSON.stringify(data.priorities));
            console.log(`[UPDATE INSTRUCTOR] Will update specialties/priorities`);
        }
        if (data.certifications !== undefined) {
            updates.push(`certifications = $${paramCount++}`);
            values.push(JSON.stringify(data.certifications));
            console.log(`[UPDATE INSTRUCTOR] Will update certifications`);
        }
        if (data.phone !== undefined) {
            updates.push(`phone = $${paramCount++}`);
            values.push(data.phone);
            console.log(`[UPDATE INSTRUCTOR] Will update phone`);
        }
        if (data.isActive !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(data.isActive);
            console.log(`[UPDATE INSTRUCTOR] Will update is_active`);
        }
        if (data.visiblePublic !== undefined) {
            updates.push(`visible_public = $${paramCount++}`);
            values.push(data.visiblePublic);
            console.log(`[UPDATE INSTRUCTOR] Will update visible_public`);
        }

        if (updates.length > 0) {
            console.log(`[UPDATE INSTRUCTOR] Executing ${updates.length} updates: ${updates.join(', ')}`);
            values.push(id);
            const result = await queryOne(
                `UPDATE instructors SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
                values
            );
            console.log(`[UPDATE INSTRUCTOR] Update successful for ID: ${id}`);
            return res.json(result);
        }

        console.log(`[UPDATE INSTRUCTOR] No updates needed for ID: ${id}`);
        res.json(existing);
    } catch (error) {
        console.error(`[UPDATE INSTRUCTOR] Error for ID: ${req.params.id}`, error);
        res.status(500).json({ error: 'Error al actualizar instructor' });
    }
});

// ============================================
// DELETE /api/instructors/:id - Deactivate instructor
// ============================================
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await queryOne(
            'UPDATE instructors SET is_active = false WHERE id = $1 RETURNING id',
            [id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }

        res.json({ message: 'Instructor desactivado exitosamente' });
    } catch (error) {
        console.error('Delete instructor error:', error);
        res.status(500).json({ error: 'Error al eliminar instructor' });
    }
});

// ============================================
// POST /api/instructors/:id/photo - Upload instructor photo
// ============================================
router.post('/:id/photo', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { photoData } = req.body; // base64 image data or URL

        if (!photoData) {
            return res.status(400).json({ error: 'No se proporcionó imagen' });
        }

        // Validate it's either a URL or base64
        const isValidUrl = photoData.startsWith('http://') || photoData.startsWith('https://');
        const isBase64 = photoData.startsWith('data:image/');

        if (!isValidUrl && !isBase64) {
            return res.status(400).json({ error: 'Formato de imagen inválido. Debe ser URL o base64.' });
        }

        const result = await queryOne(
            'UPDATE instructors SET photo_url = $1 WHERE id = $2 RETURNING id, photo_url',
            [photoData, id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }

        res.json({ message: 'Foto actualizada', photo_url: result.photo_url });
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ error: 'Error al subir foto' });
    }
});

// ============================================
// POST /api/instructors/:id/generate-access - Generate coach portal credentials
// ============================================
router.post('/:id/generate-access', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Check if instructor exists and get user email
        const instructor = await queryOne<{
            id: string;
            display_name: string;
            coach_number: string | null;
            user_id: string;
        }>(
            'SELECT i.id, i.display_name, i.coach_number, i.user_id FROM instructors i WHERE i.id = $1',
            [id]
        );

        if (!instructor) {
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }

        // Get user email
        const user = await queryOne<{ email: string }>(
            'SELECT email FROM users WHERE id = $1',
            [instructor.user_id]
        );

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Check if already has coach access
        if (instructor.coach_number) {
            return res.status(400).json({
                error: 'El instructor ya tiene acceso al portal',
                email: user.email,
                coachNumber: instructor.coach_number
            });
        }

        // Generate coach number
        const coachNumber = await queryOne<{ generate_coach_number: string }>(
            'SELECT generate_coach_number()',
            []
        );

        if (!coachNumber?.generate_coach_number) {
            throw new Error('Failed to generate coach number');
        }

        // Generate temporary secure password (12 chars, mixed)
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
        let tempPassword = '';
        for (let i = 0; i < 12; i++) {
            tempPassword += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        // Update instructor with credentials
        await queryOne(
            `UPDATE instructors 
             SET coach_number = $1, password_hash = $2, temp_password = true 
             WHERE id = $3`,
            [coachNumber.generate_coach_number, passwordHash, id]
        );

        // Update user password as well
        await queryOne(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [passwordHash, instructor.user_id]
        );

        // Return credentials (password shown only once)
        res.json({
            message: 'Credenciales generadas exitosamente',
            email: user.email,
            coachNumber: coachNumber.generate_coach_number,
            tempPassword: tempPassword,
            instructorName: instructor.display_name,
            warning: 'Guarda esta contraseña. No se mostrará nuevamente.',
        });
    } catch (error) {
        console.error('Generate access error:', error);
        res.status(500).json({ error: 'Error al generar acceso' });
    }
});

// ============================================
// POST /api/instructors/:id/reset-password - Reset coach password (admin)
// ============================================
router.post('/:id/reset-password', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const instructor = await queryOne<{
            id: string;
            display_name: string;
            coach_number: string;
            user_id: string;
        }>(
            'SELECT i.id, i.display_name, i.coach_number, i.user_id FROM instructors i WHERE i.id = $1',
            [id]
        );

        if (!instructor || !instructor.coach_number) {
            return res.status(404).json({ error: 'Instructor sin acceso al portal' });
        }

        // Get user email
        const user = await queryOne<{ email: string }>(
            'SELECT email FROM users WHERE id = $1',
            [instructor.user_id]
        );

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Generate new temporary password
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
        let tempPassword = '';
        for (let i = 0; i < 12; i++) {
            tempPassword += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        const passwordHash = await bcrypt.hash(tempPassword, 12);

        await queryOne(
            `UPDATE instructors 
             SET password_hash = $1, temp_password = true 
             WHERE id = $2`,
            [passwordHash, id]
        );

        // Also update user password
        await queryOne(
            'UPDATE users SET password_hash = $1 WHERE id = $2',
            [passwordHash, instructor.user_id]
        );

        res.json({
            message: 'Contraseña restablecida',
            email: user.email,
            coachNumber: instructor.coach_number,
            tempPassword: tempPassword,
            warning: 'Guarda esta contraseña. No se mostrará nuevamente.',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error al restablecer contraseña' });
    }
});

// ============================================
// GET /api/instructors/:id/availability - Get instructor availability
// ============================================
router.get('/:id/availability', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const availability = await query(
            `SELECT * FROM instructor_availability 
             WHERE instructor_id = $1 AND is_available = true
             ORDER BY day_of_week, start_time`,
            [id]
        );

        res.json(availability);
    } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({ error: 'Error al obtener disponibilidad' });
    }
});

// ============================================
// PUT /api/instructors/:id/availability - Update instructor availability
// ============================================
router.put('/:id/availability', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { availability } = req.body; // Array of { day_of_week, start_time, end_time, is_available }

        if (!Array.isArray(availability)) {
            return res.status(400).json({ error: 'Formato de disponibilidad inválido' });
        }

        // Delete existing availability
        await query('DELETE FROM instructor_availability WHERE instructor_id = $1', [id]);

        // Insert new availability
        for (const slot of availability) {
            await queryOne(
                `INSERT INTO instructor_availability (instructor_id, day_of_week, start_time, end_time, is_available)
                 VALUES ($1, $2, $3, $4, $5)`,
                [id, slot.day_of_week, slot.start_time, slot.end_time, slot.is_available ?? true]
            );
        }

        // Return updated availability
        const updated = await query(
            `SELECT * FROM instructor_availability 
             WHERE instructor_id = $1 
             ORDER BY day_of_week, start_time`,
            [id]
        );

        res.json(updated);
    } catch (error) {
        console.error('Update availability error:', error);
        res.status(500).json({ error: 'Error al actualizar disponibilidad' });
    }
});

// ============================================
// GET /api/instructors/:id/stats - Get instructor statistics
// ============================================
router.get('/:id/stats', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get basic stats
        const stats = await queryOne(`
            SELECT 
                i.id AS instructor_id,
                i.display_name,
                COUNT(DISTINCT c.id) AS total_classes_taught,
                COUNT(DISTINCT b.id) AS total_bookings,
                COUNT(DISTINCT CASE WHEN b.status = 'checked_in' THEN b.id END) AS total_checkins,
                ROUND(
                    CASE 
                        WHEN COUNT(DISTINCT b.id) > 0 
                        THEN (COUNT(DISTINCT CASE WHEN b.status = 'checked_in' THEN b.id END)::DECIMAL / COUNT(DISTINCT b.id)) * 100 
                        ELSE 0 
                    END, 
                    1
                ) AS attendance_rate,
                COUNT(DISTINCT CASE WHEN c.date = CURRENT_DATE THEN c.id END) AS classes_today,
                COUNT(DISTINCT CASE WHEN c.date >= date_trunc('week', CURRENT_DATE) AND c.date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' THEN c.id END) AS classes_this_week,
                SUM(CASE WHEN c.date >= date_trunc('week', CURRENT_DATE) AND c.date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' THEN c.current_bookings ELSE 0 END) AS bookings_this_week
            FROM instructors i
            LEFT JOIN classes c ON c.instructor_id = i.id AND c.status != 'cancelled'
            LEFT JOIN bookings b ON b.class_id = c.id AND b.status != 'cancelled'
            WHERE i.id = $1
            GROUP BY i.id, i.display_name
        `, [id]);

        if (!stats) {
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }

        // Calculate average occupancy for this week
        const occupancyStats = await queryOne(`
            SELECT 
                COALESCE(AVG(
                    CASE WHEN c.max_capacity > 0 
                    THEN (c.current_bookings::DECIMAL / c.max_capacity) * 100 
                    ELSE 0 END
                ), 0) AS avg_occupancy
            FROM classes c
            WHERE c.instructor_id = $1 
              AND c.date >= date_trunc('week', CURRENT_DATE)
              AND c.date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
              AND c.status != 'cancelled'
        `, [id]);

        res.json({
            ...stats,
            avg_occupancy: Math.round(occupancyStats?.avg_occupancy || 0)
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// ============================================
// GET /api/instructors/:id/classes - Get instructor's classes (for coach portal)
// ============================================
router.get('/:id/classes', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { date, from, to } = req.query;

        let whereClause = 'WHERE c.instructor_id = $1 AND c.status != $2';
        const params: any[] = [id, 'cancelled'];
        let paramCount = 3;

        if (date) {
            whereClause += ` AND c.date = $${paramCount++}`;
            params.push(date);
        } else if (from && to) {
            whereClause += ` AND c.date >= $${paramCount++} AND c.date <= $${paramCount++}`;
            params.push(from, to);
        } else {
            // Default: today and future classes
            whereClause += ` AND c.date >= CURRENT_DATE`;
        }

        const classes = await query(`
            SELECT 
                c.id,
                c.date,
                c.start_time,
                c.end_time,
                c.max_capacity,
                c.current_bookings,
                c.status,
                c.notes,
                c.level,
                ct.id AS class_type_id,
                ct.name AS class_type_name,
                ct.description AS class_type_description,
                ct.color AS class_type_color,
                ct.icon AS class_type_icon,
                f.id AS facility_id,
                f.name AS facility_name,
                (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status = 'waitlist') AS waitlist_count
            FROM classes c
            JOIN class_types ct ON c.class_type_id = ct.id
            LEFT JOIN facilities f ON c.facility_id = f.id
            ${whereClause}
            ORDER BY c.date, c.start_time
        `, params);

        res.json(classes);
    } catch (error) {
        console.error('Get instructor classes error:', error);
        res.status(500).json({ error: 'Error al obtener clases' });
    }
});

// ============================================
// GET /api/instructors/:id/classes/:classId/attendees - Get class attendees
// ============================================
router.get('/:id/classes/:classId/attendees', authenticate, async (req: Request, res: Response) => {
    try {
        const { id, classId } = req.params;

        // Verify the class belongs to this instructor
        const classData = await queryOne(
            'SELECT id, instructor_id FROM classes WHERE id = $1',
            [classId]
        );

        if (!classData) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }

        // If user is instructor, verify it's their class
        if (req.user?.role === 'instructor' && classData.instructor_id !== id) {
            return res.status(403).json({ error: 'No tienes acceso a esta clase' });
        }

        const attendees = await query(`
            SELECT 
                b.id AS booking_id,
                b.status,
                b.waitlist_position,
                b.checked_in_at,
                u.id AS user_id,
                u.display_name,
                u.email,
                u.phone,
                u.photo_url,
                u.health_notes,
                u.instructor_notes,
                u.alert_flag,
                u.alert_message
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.class_id = $1 AND b.status != 'cancelled'
            ORDER BY 
                CASE b.status 
                    WHEN 'waitlist' THEN 2 
                    ELSE 1 
                END,
                b.waitlist_position NULLS LAST,
                b.created_at
        `, [classId]);

        const confirmed = attendees.filter((a: any) => a.status !== 'waitlist');
        const waitlist = attendees.filter((a: any) => a.status === 'waitlist');

        res.json({ confirmed, waitlist });
    } catch (error) {
        console.error('Get attendees error:', error);
        res.status(500).json({ error: 'Error al obtener asistentes' });
    }
});

// ============================================
// POST /api/instructors/:id/classes/:classId/checkin - Check in attendee(s)
// ============================================
router.post('/:id/classes/:classId/checkin', authenticate, async (req: Request, res: Response) => {
    try {
        const { id, classId } = req.params;
        const { bookingIds, all } = req.body; // bookingIds array or all=true for mass check-in

        // Verify instructor has access to this class
        const classData = await queryOne(
            'SELECT id, instructor_id FROM classes WHERE id = $1',
            [classId]
        );

        if (!classData) {
            return res.status(404).json({ error: 'Clase no encontrada' });
        }

        // Check permissions
        const userRole = req.user?.role;
        const isInstructor = userRole === 'instructor';

        if (isInstructor && classData.instructor_id !== id) {
            return res.status(403).json({ error: 'No tienes acceso a esta clase' });
        }

        let checkedIn = 0;

        if (all) {
            // Mass check-in
            const result = await query(`
                UPDATE bookings 
                SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1
                WHERE class_id = $2 AND status = 'confirmed'
                RETURNING id
            `, [req.user?.userId, classId]);
            checkedIn = result.length;
        } else if (Array.isArray(bookingIds) && bookingIds.length > 0) {
            // Individual check-ins
            for (const bookingId of bookingIds) {
                await queryOne(`
                    UPDATE bookings 
                    SET status = 'checked_in', checked_in_at = CURRENT_TIMESTAMP, checked_in_by = $1
                    WHERE id = $2 AND class_id = $3 AND status = 'confirmed'
                `, [req.user?.userId, bookingId, classId]);
                checkedIn++;
            }
        } else {
            return res.status(400).json({ error: 'Se requiere bookingIds o all=true' });
        }

        res.json({ message: `${checkedIn} asistente(s) registrado(s)`, checked_in: checkedIn });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: 'Error al registrar asistencia' });
    }
});

// ============================================
// GET /api/instructors/available - Get available instructors for a time slot
// ============================================
router.get('/available/slot', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { date, start_time, end_time, exclude_instructor_id } = req.query;

        if (!date || !start_time) {
            return res.status(400).json({ error: 'Se requiere fecha y hora de inicio' });
        }

        // Get day of week from date
        const dayOfWeek = new Date(date as string).getDay();

        // Find instructors available at this time
        let queryStr = `
            SELECT DISTINCT 
                i.id, 
                i.display_name, 
                i.photo_url, 
                i.specialties,
                CASE WHEN ia.id IS NOT NULL THEN true ELSE false END AS has_availability
            FROM instructors i
            LEFT JOIN instructor_availability ia ON i.id = ia.instructor_id 
                AND ia.day_of_week = $1 
                AND ia.start_time <= $2::TIME 
                AND ia.end_time >= COALESCE($3::TIME, $2::TIME + INTERVAL '1 hour')
                AND ia.is_available = true
            WHERE i.is_active = true
        `;

        const params: any[] = [dayOfWeek, start_time, end_time || null];
        let paramCount = 4;

        // Exclude instructor if specified (for substitutions)
        if (exclude_instructor_id) {
            queryStr += ` AND i.id != $${paramCount++}`;
            params.push(exclude_instructor_id);
        }

        // Check they don't have another class at this time
        queryStr += `
            AND NOT EXISTS (
                SELECT 1 FROM classes c 
                WHERE c.instructor_id = i.id 
                  AND c.date = $${paramCount++}::DATE
                  AND c.status != 'cancelled'
                  AND (
                      (c.start_time <= $${paramCount++}::TIME AND c.end_time > $${paramCount++}::TIME)
                      OR (c.start_time < COALESCE($${paramCount++}::TIME, $${paramCount++}::TIME + INTERVAL '1 hour') AND c.end_time >= COALESCE($${paramCount++}::TIME, $${paramCount++}::TIME + INTERVAL '1 hour'))
                  )
            )
        `;
        params.push(date, start_time, start_time, end_time, start_time, end_time, start_time);

        queryStr += ` ORDER BY has_availability DESC, i.display_name`;

        const instructors = await query(queryStr, params);
        res.json(instructors);
    } catch (error) {
        console.error('Get available instructors error:', error);
        res.status(500).json({ error: 'Error al buscar instructores disponibles' });
    }
});

// ============================================
// POST /api/instructors/:id/send-credentials - Send credentials email to instructor (Admin)
// ============================================
const SendCredentialsSchema = z.object({
    email: z.string().email('Email inválido'),
    generatePassword: z.boolean().default(true),
    customPassword: z.string().optional(),
});

router.post('/:id/send-credentials', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const validation = SendCredentialsSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { email, generatePassword, customPassword } = validation.data;

        // Get instructor info
        const instructor = await queryOne<{
            id: string;
            user_id: string;
            display_name: string;
        }>(
            'SELECT id, user_id, display_name FROM instructors WHERE id = $1',
            [id]
        );

        if (!instructor) {
            return res.status(404).json({ error: 'Instructor no encontrado' });
        }

        // Update user email if different
        await query(
            'UPDATE users SET email = $1 WHERE id = $2',
            [email.toLowerCase(), instructor.user_id]
        );

        // Generate or use custom password
        const temporaryPassword = generatePassword
            ? Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase()
            : customPassword || Math.random().toString(36).slice(-8);

        // Hash password and save to INSTRUCTOR table (coach login uses instructors.password_hash)
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);

        // Generate coach number if doesn't exist
        const coachNumber = await queryOne<{ coach_number: string }>(
            `SELECT coach_number FROM instructors WHERE id = $1`,
            [id]
        );

        let newCoachNumber = coachNumber?.coach_number;
        if (!newCoachNumber) {
            const lastCoach = await queryOne<{ coach_number: string }>(
                `SELECT coach_number FROM instructors WHERE coach_number IS NOT NULL ORDER BY coach_number DESC LIMIT 1`
            );
            const nextNum = lastCoach?.coach_number
                ? parseInt(lastCoach.coach_number.replace('COACH-', '')) + 1
                : 1;
            newCoachNumber = `COACH-${nextNum.toString().padStart(4, '0')}`;
        }

        // Update instructor with credentials
        await query(
            `UPDATE instructors 
             SET password_hash = $1, temp_password = true, coach_number = $2 
             WHERE id = $3`,
            [passwordHash, newCoachNumber, id]
        );

        // Send email with credentials
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const loginUrl = `${frontendUrl}/coach/login`;

        console.log('Attempting to send credentials email to:', email);
        console.log('Instructor name:', instructor.display_name);
        console.log('Login URL:', loginUrl);

        try {
            await sendInstructorCredentials({
                to: email,
                instructorName: instructor.display_name,
                email: email,
                temporaryPassword: temporaryPassword,
                loginUrl: loginUrl,
                coachNumber: newCoachNumber,
            });
            console.log('✅ Credentials email sent successfully to:', email);
        } catch (emailError: any) {
            console.error('❌ Failed to send credentials email:', emailError);

            // Check if it's a Gmail error
            const warningMessage = emailError.message?.includes('GMAIL') || emailError.code === 'EAUTH'
                ? `⚠️ Email no enviado: Verifica las credenciales de Gmail en las variables de entorno.`
                : 'Credenciales guardadas pero el email no pudo enviarse.';

            // Still return success since credentials were saved, but note the email failed
            return res.json({
                success: true,
                warning: warningMessage,
                email: email,
                coachNumber: newCoachNumber,
                tempPassword: temporaryPassword, // Return password so admin can copy it manually
            });
        }

        res.json({
            success: true,
            message: `Credenciales enviadas a ${email}`,
            email: email,
            coachNumber: newCoachNumber,
        });
    } catch (error) {
        console.error('Send instructor credentials error:', error);
        res.status(500).json({ error: 'Error al enviar credenciales' });
    }
});

// ============================================
// GET /api/instructors/:id/history - Get class history (Coach)
// ============================================
router.get('/:id/history', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { from, to, classTypeId, page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const offset = (pageNum - 1) * limitNum;

        let queryStr = `
            SELECT 
                c.id,
                c.date,
                c.start_time,
                c.end_time,
                c.max_capacity,
                c.current_bookings,
                c.status,
                ct.name as class_type_name,
                ct.color as class_type_color,
                f.name as facility_name,
                (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status = 'checked_in') as checked_in_count,
                (SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status = 'no_show') as no_show_count
            FROM classes c
            JOIN class_types ct ON c.class_type_id = ct.id
            LEFT JOIN facilities f ON c.facility_id = f.id
            WHERE c.instructor_id = $1
            AND c.date < CURRENT_DATE
        `;

        const params: any[] = [id];
        let paramIndex = 2;

        if (from) {
            queryStr += ` AND c.date >= $${paramIndex}`;
            params.push(from);
            paramIndex++;
        }
        if (to) {
            queryStr += ` AND c.date <= $${paramIndex}`;
            params.push(to);
            paramIndex++;
        }
        if (classTypeId) {
            queryStr += ` AND c.class_type_id = $${paramIndex}`;
            params.push(classTypeId);
            paramIndex++;
        }

        // Count total
        const countQuery = queryStr.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
        const countResult = await queryOne<{ total: string }>(countQuery, params);
        const total = parseInt(countResult?.total || '0');

        queryStr += ` ORDER BY c.date DESC, c.start_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limitNum, offset);

        const classes = await query(queryStr, params);

        res.json({
            classes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Get class history error:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// ============================================
// GET /api/instructors/:id/history/:classId/attendees - Get attendees for past class
// ============================================
router.get('/:id/history/:classId/attendees', authenticate, async (req: Request, res: Response) => {
    try {
        const { classId } = req.params;

        const attendees = await query(`
            SELECT 
                b.id as booking_id,
                b.status,
                b.checked_in_at,
                u.id as user_id,
                u.display_name,
                u.email,
                u.phone,
                u.photo_url
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            WHERE b.class_id = $1
            ORDER BY b.status DESC, u.display_name ASC
        `, [classId]);

        res.json(attendees);
    } catch (error) {
        console.error('Get history attendees error:', error);
        res.status(500).json({ error: 'Error al obtener asistentes' });
    }
});

// ============================================
// GET /api/instructors/:id/stats/by-class-type - Stats by class type
// ============================================
router.get('/:id/stats/by-class-type', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const stats = await query(`
            SELECT 
                ct.id,
                ct.name,
                ct.color,
                COUNT(c.id) as total_classes,
                COALESCE(SUM(c.current_bookings), 0) as total_bookings,
                COALESCE(SUM((SELECT COUNT(*) FROM bookings b WHERE b.class_id = c.id AND b.status = 'checked_in')), 0) as total_checkins,
                ROUND(AVG(c.current_bookings::decimal / NULLIF(c.max_capacity, 0) * 100), 1) as avg_occupancy
            FROM classes c
            JOIN class_types ct ON c.class_type_id = ct.id
            WHERE c.instructor_id = $1
            AND c.date < CURRENT_DATE
            AND c.status = 'completed'
            GROUP BY ct.id, ct.name, ct.color
            ORDER BY total_classes DESC
        `, [id]);

        res.json(stats);
    } catch (error) {
        console.error('Get stats by class type error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// ============================================
// SUBSTITUTIONS ROUTES
// ============================================

// GET /api/instructors/:id/substitutions - Get substitution requests
router.get('/:id/substitutions', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { type = 'all' } = req.query; // 'requested' | 'available' | 'all'

        let queryStr = `
            SELECT 
                cs.id,
                cs.class_id,
                cs.original_instructor_id,
                cs.substitute_instructor_id,
                cs.reason,
                cs.status,
                cs.requested_at,
                cs.responded_at,
                cs.response_note,
                c.date,
                c.start_time,
                c.end_time,
                ct.name as class_type_name,
                ct.color as class_type_color,
                oi.display_name as original_instructor_name,
                si.display_name as substitute_instructor_name
            FROM class_substitutions cs
            JOIN classes c ON cs.class_id = c.id
            JOIN class_types ct ON c.class_type_id = ct.id
            JOIN instructors oi ON cs.original_instructor_id = oi.id
            LEFT JOIN instructors si ON cs.substitute_instructor_id = si.id
            WHERE c.date >= CURRENT_DATE
        `;

        if (type === 'requested') {
            queryStr += ` AND cs.original_instructor_id = $1`;
        } else if (type === 'available') {
            queryStr += ` AND cs.original_instructor_id != $1 AND cs.status = 'pending'`;
        } else {
            queryStr += ` AND (cs.original_instructor_id = $1 OR cs.substitute_instructor_id = $1 OR (cs.status = 'pending' AND cs.original_instructor_id != $1))`;
        }

        queryStr += ` ORDER BY c.date ASC, c.start_time ASC`;

        const substitutions = await query(queryStr, [id]);
        res.json(substitutions);
    } catch (error) {
        console.error('Get substitutions error:', error);
        res.status(500).json({ error: 'Error al obtener sustituciones' });
    }
});

// POST /api/instructors/:id/substitutions - Request substitution
router.post('/:id/substitutions', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { classId, reason } = req.body;

        // Verify class belongs to this instructor
        const classData = await queryOne<{ instructor_id: string }>(
            'SELECT instructor_id FROM classes WHERE id = $1',
            [classId]
        );

        if (!classData || classData.instructor_id !== id) {
            return res.status(403).json({ error: 'No puedes solicitar sustitución para esta clase' });
        }

        // Check if already requested
        const existing = await queryOne(
            'SELECT id FROM class_substitutions WHERE class_id = $1 AND status = $2',
            [classId, 'pending']
        );

        if (existing) {
            return res.status(400).json({ error: 'Ya existe una solicitud pendiente para esta clase' });
        }

        const substitution = await queryOne(`
            INSERT INTO class_substitutions (class_id, original_instructor_id, reason)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [classId, id, reason]);

        res.status(201).json(substitution);
    } catch (error) {
        console.error('Request substitution error:', error);
        res.status(500).json({ error: 'Error al solicitar sustitución' });
    }
});

// PUT /api/instructors/:id/substitutions/:subId/accept - Accept substitution
router.put('/:id/substitutions/:subId/accept', authenticate, async (req: Request, res: Response) => {
    try {
        const { id, subId } = req.params;
        const { note } = req.body;

        const substitution = await queryOne<{ class_id: string; original_instructor_id: string }>(
            'SELECT class_id, original_instructor_id FROM class_substitutions WHERE id = $1 AND status = $2',
            [subId, 'pending']
        );

        if (!substitution) {
            return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
        }

        if (substitution.original_instructor_id === id) {
            return res.status(400).json({ error: 'No puedes aceptar tu propia solicitud' });
        }

        // Update substitution
        await queryOne(`
            UPDATE class_substitutions 
            SET substitute_instructor_id = $1, status = 'accepted', responded_at = NOW(), response_note = $2
            WHERE id = $3
        `, [id, note, subId]);

        // Update class instructor
        await queryOne(
            'UPDATE classes SET instructor_id = $1 WHERE id = $2',
            [id, substitution.class_id]
        );

        res.json({ message: 'Sustitución aceptada exitosamente' });
    } catch (error) {
        console.error('Accept substitution error:', error);
        res.status(500).json({ error: 'Error al aceptar sustitución' });
    }
});

// PUT /api/instructors/:id/substitutions/:subId/cancel - Cancel substitution request
router.put('/:id/substitutions/:subId/cancel', authenticate, async (req: Request, res: Response) => {
    try {
        const { id, subId } = req.params;

        const result = await queryOne(`
            UPDATE class_substitutions 
            SET status = 'cancelled'
            WHERE id = $1 AND original_instructor_id = $2 AND status = 'pending'
            RETURNING id
        `, [subId, id]);

        if (!result) {
            return res.status(404).json({ error: 'Solicitud no encontrada o no puedes cancelarla' });
        }

        res.json({ message: 'Solicitud cancelada' });
    } catch (error) {
        console.error('Cancel substitution error:', error);
        res.status(500).json({ error: 'Error al cancelar solicitud' });
    }
});

// ============================================
// PLAYLISTS ROUTES
// ============================================

// GET /api/instructors/:id/playlists - Get playlists
router.get('/:id/playlists', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { classTypeId, includePublic = 'true' } = req.query;

        let queryStr = `
            SELECT 
                p.id,
                p.instructor_id,
                p.class_type_id,
                p.name,
                p.description,
                p.platform,
                p.url,
                p.duration_minutes,
                p.is_public,
                p.is_favorite,
                p.created_at,
                i.display_name as instructor_name,
                ct.name as class_type_name,
                ct.color as class_type_color
            FROM coach_playlists p
            JOIN instructors i ON p.instructor_id = i.id
            LEFT JOIN class_types ct ON p.class_type_id = ct.id
            WHERE (p.instructor_id = $1 ${includePublic === 'true' ? 'OR p.is_public = true' : ''})
        `;

        const params: any[] = [id];

        if (classTypeId) {
            queryStr += ` AND p.class_type_id = $2`;
            params.push(classTypeId);
        }

        queryStr += ` ORDER BY p.is_favorite DESC, p.created_at DESC`;

        const playlists = await query(queryStr, params);
        res.json(playlists);
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ error: 'Error al obtener playlists' });
    }
});

// POST /api/instructors/:id/playlists - Create playlist
router.post('/:id/playlists', authenticate, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        let { name, description, classTypeId, platform, url, durationMinutes, isPublic, thumbnailUrl } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL es requerida' });
        }

        // Auto-fetch metadata if name or thumbnail is missing
        if (!name || !thumbnailUrl) {
            try {
                const metadata = await fetchPlaylistMetadata(url);
                if (!name && metadata.title) name = metadata.title;
                if (!thumbnailUrl && metadata.thumbnail) thumbnailUrl = metadata.thumbnail;

                // If platform wasn't provided, try to detect it from metadata author or logic
                if (!platform) {
                    if (url.includes('spotify.com')) platform = 'spotify';
                    else if (url.includes('apple.com')) platform = 'apple_music';
                    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
                }
            } catch (e) {
                console.error('Error fetching metadata on create:', e);
            }
        }

        if (!name) {
            return res.status(400).json({ error: 'Nombre es requerido' });
        }

        const playlist = await queryOne(`
            INSERT INTO coach_playlists (instructor_id, class_type_id, name, description, platform, url, duration_minutes, is_public, thumbnail_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [id, classTypeId || null, name, description, platform || 'spotify', url, durationMinutes, isPublic || false, thumbnailUrl || null]);

        res.status(201).json(playlist);
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ error: 'Error al crear playlist' });
    }
});

// PUT /api/instructors/:id/playlists/:playlistId - Update playlist
router.put('/:id/playlists/:playlistId', authenticate, async (req: Request, res: Response) => {
    try {
        const { id, playlistId } = req.params;
        let { name, description, classTypeId, platform, url, durationMinutes, isPublic, isFavorite, thumbnailUrl } = req.body;

        // Auto-fetch metadata if URL changes/exists and thumbnail is missing
        if (url && !thumbnailUrl) {
            try {
                const metadata = await fetchPlaylistMetadata(url);
                if (!name && metadata.title) name = metadata.title;
                if (metadata.thumbnail) thumbnailUrl = metadata.thumbnail;

                if (!platform) {
                    if (url.includes('spotify.com')) platform = 'spotify';
                    else if (url.includes('apple.com')) platform = 'apple_music';
                    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
                }
            } catch (e) {
                console.error('Error fetching metadata on update:', e);
            }
        }

        const playlist = await queryOne(`
            UPDATE coach_playlists 
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                class_type_id = $3,
                platform = COALESCE($4, platform),
                url = COALESCE($5, url),
                duration_minutes = COALESCE($6, duration_minutes),
                is_public = COALESCE($7, is_public),
                is_favorite = COALESCE($8, is_favorite),
                thumbnail_url = COALESCE($9, thumbnail_url),
                updated_at = NOW()
            WHERE id = $10 AND instructor_id = $11
            RETURNING *
        `, [name, description, classTypeId, platform, url, durationMinutes, isPublic, isFavorite, thumbnailUrl || null, playlistId, id]);

        if (!playlist) {
            return res.status(404).json({ error: 'Playlist no encontrada' });
        }

        res.json(playlist);
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({ error: 'Error al actualizar playlist' });
    }
});

// DELETE /api/instructors/:id/playlists/:playlistId - Delete playlist
router.delete('/:id/playlists/:playlistId', authenticate, async (req: Request, res: Response) => {
    try {
        const { id, playlistId } = req.params;

        const result = await queryOne(
            'DELETE FROM coach_playlists WHERE id = $1 AND instructor_id = $2 RETURNING id',
            [playlistId, id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Playlist no encontrada' });
        }

        res.json({ message: 'Playlist eliminada' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ error: 'Error al eliminar playlist' });
    }
});

import { fetchPlaylistMetadata } from '../services/metadata.js';

// ... (existing imports)

// GET /api/instructors/playlist-metadata - Get metadata from playlist URL using oEmbed
router.get('/playlist-metadata', async (req: Request, res: Response) => {
    try {
        const url = req.query.url as string;
        if (!url) {
            return res.status(400).json({ error: 'URL requerida' });
        }

        const metadata = await fetchPlaylistMetadata(url);
        res.json(metadata);
    } catch (error) {
        console.error('Get playlist metadata error:', error);
        res.status(500).json({ error: 'Error al obtener metadata' });
    }
});

export default router;
