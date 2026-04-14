import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// GET /api/loyalty/config - Get loyalty configuration
// ============================================
router.get('/config', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const result = await queryOne(
            `SELECT value FROM system_settings WHERE key = 'loyalty_config'`
        );
        
        const defaultConfig = {
            points_per_class: 10,
            points_per_peso: 1,
            enabled: true,
            welcome_bonus: 50,
            birthday_bonus: 100,
            referral_bonus: 200,
        };
        
        res.json(result?.value || defaultConfig);
    } catch (error) {
        console.error('Get loyalty config error:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

// ============================================
// PUT /api/loyalty/config - Update loyalty configuration
// ============================================
router.put('/config', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const config = req.body;
        
        await query(
            `INSERT INTO system_settings (key, value, updated_by)
             VALUES ('loyalty_config', $1, $2)
             ON CONFLICT (key) DO UPDATE
             SET value = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2`,
            [JSON.stringify(config), req.user?.userId]
        );
        
        res.json({ message: 'Configuración actualizada' });
    } catch (error) {
        console.error('Update loyalty config error:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// ============================================
// GET /api/loyalty/my-history - Get current user's points history
// ============================================
router.get('/my-history', authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'No autorizado' });

        const history = await query(
            `SELECT lp.id, lp.points, lp.type, lp.description, lp.created_at,
                    ct.name as class_name
             FROM loyalty_points lp
             LEFT JOIN bookings b ON lp.related_booking_id = b.id
             LEFT JOIN classes c ON b.class_id = c.id
             LEFT JOIN class_types ct ON c.class_type_id = ct.id
             WHERE lp.user_id = $1
             ORDER BY lp.created_at DESC
             LIMIT 50`,
            [userId]
        );

        const balance = await queryOne<{ loyalty_points: number }>(
            `SELECT loyalty_points FROM users WHERE id = $1`,
            [userId]
        );

        res.json({
            history: history || [],
            totalPoints: balance?.loyalty_points || 0,
        });
    } catch (error) {
        console.error('Get my history error:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// ============================================
// GET /api/loyalty/points/:userId - Get user points
// ============================================
router.get('/points/:userId', authenticate, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        
        if (req.user?.role !== 'admin' && req.user?.userId !== userId) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        
        const result = await queryOne(
            `SELECT loyalty_points FROM users WHERE id = $1`,
            [userId]
        );
        
        res.json({ userId, totalPoints: result?.loyalty_points || 0 });
    } catch (error) {
        console.error('Get points error:', error);
        res.status(500).json({ error: 'Error al obtener puntos' });
    }
});

// ============================================
// POST /api/loyalty/points/:userId/adjust - Adjust user points (admin)
// ============================================
router.post('/points/:userId/adjust', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { points, reason } = req.body;
        
        if (points === undefined) {
            return res.status(400).json({ error: 'points es requerido' });
        }
        
        // Update user points
        const result = await queryOne(
            `UPDATE users 
             SET loyalty_points = GREATEST(0, COALESCE(loyalty_points, 0) + $1)
             WHERE id = $2
             RETURNING loyalty_points`,
            [points, userId]
        );
        
        if (!result) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({ 
            message: 'Puntos ajustados',
            newBalance: result.loyalty_points,
            adjustment: points,
            reason
        });
    } catch (error) {
        console.error('Adjust points error:', error);
        res.status(500).json({ error: 'Error al ajustar puntos' });
    }
});

// ============================================
// GET /api/loyalty/rewards - Get all rewards
// ============================================
router.get('/rewards', authenticate, async (req: Request, res: Response) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        
        const rewards = await query(
            `SELECT id, name, description, points_cost, reward_type, reward_value, is_active, stock
             FROM loyalty_rewards
             ${!isAdmin ? 'WHERE is_active = true' : ''}
             ORDER BY points_cost ASC`
        );
        
        res.json(rewards);
    } catch (error) {
        console.error('Get rewards error:', error);
        res.status(500).json({ error: 'Error al obtener recompensas' });
    }
});

// ============================================
// POST /api/loyalty/rewards - Create reward (admin)
// ============================================
router.post('/rewards', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { name, description, points_cost, reward_type, reward_value, is_active, stock } = req.body;
        
        const result = await queryOne(
            `INSERT INTO loyalty_rewards (name, description, points_cost, reward_type, reward_value, is_active, stock)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, description, points_cost, reward_type || 'discount', reward_value, is_active ?? true, stock]
        );
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Create reward error:', error);
        res.status(500).json({ error: 'Error al crear recompensa' });
    }
});

// ============================================
// PUT /api/loyalty/rewards/:id - Update reward (admin)
// ============================================
router.put('/rewards/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, points_cost, reward_type, reward_value, is_active, stock } = req.body;
        
        const result = await queryOne(
            `UPDATE loyalty_rewards
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 points_cost = COALESCE($3, points_cost),
                 reward_type = COALESCE($4, reward_type),
                 reward_value = COALESCE($5, reward_value),
                 is_active = COALESCE($6, is_active),
                 stock = COALESCE($7, stock),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8
             RETURNING *`,
            [name, description, points_cost, reward_type, reward_value, is_active, stock, id]
        );
        
        if (!result) {
            return res.status(404).json({ error: 'Recompensa no encontrada' });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Update reward error:', error);
        res.status(500).json({ error: 'Error al actualizar recompensa' });
    }
});

// ============================================
// DELETE /api/loyalty/rewards/:id - Delete reward (admin)
// ============================================
router.delete('/rewards/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        const result = await queryOne(
            `DELETE FROM loyalty_rewards WHERE id = $1 RETURNING id`,
            [id]
        );
        
        if (!result) {
            return res.status(404).json({ error: 'Recompensa no encontrada' });
        }
        
        res.json({ message: 'Recompensa eliminada' });
    } catch (error) {
        console.error('Delete reward error:', error);
        res.status(500).json({ error: 'Error al eliminar recompensa' });
    }
});

// ============================================
// GET /api/loyalty/redemptions - Get all redemptions (admin)
// ============================================
router.get('/redemptions', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const redemptions = await query(
            `SELECT lr.*, 
                    u.first_name || ' ' || u.last_name as user_name,
                    u.email as user_email,
                    lrw.name as reward_name
             FROM loyalty_redemptions lr
             LEFT JOIN users u ON lr.user_id = u.id
             LEFT JOIN loyalty_rewards lrw ON lr.reward_id = lrw.id
             ORDER BY lr.redeemed_at DESC
             LIMIT 100`
        );
        
        res.json(redemptions);
    } catch (error) {
        console.error('Get redemptions error:', error);
        res.status(500).json({ error: 'Error al obtener canjes' });
    }
});

// ============================================
// POST /api/loyalty/redeem - Redeem a reward
// ============================================
router.post('/redeem', authenticate, async (req: Request, res: Response) => {
    try {
        const { rewardId } = req.body;
        const userId = req.user?.userId;
        
        // Get reward
        const reward = await queryOne(
            `SELECT * FROM loyalty_rewards WHERE id = $1 AND is_active = true`,
            [rewardId]
        );
        
        if (!reward) {
            return res.status(404).json({ error: 'Recompensa no encontrada o no disponible' });
        }
        
        // Check stock
        if (reward.stock !== null && reward.stock <= 0) {
            return res.status(400).json({ error: 'Recompensa agotada' });
        }
        
        // Get user points
        const user = await queryOne(
            `SELECT loyalty_points FROM users WHERE id = $1`,
            [userId]
        );
        
        if (!user || user.loyalty_points < reward.points_cost) {
            return res.status(400).json({ error: 'Puntos insuficientes' });
        }
        
        // Deduct points and create redemption
        await query(
            `UPDATE users SET loyalty_points = loyalty_points - $1 WHERE id = $2`,
            [reward.points_cost, userId]
        );
        
        // Update stock if applicable
        if (reward.stock !== null) {
            await query(
                `UPDATE loyalty_rewards SET stock = stock - 1 WHERE id = $1`,
                [rewardId]
            );
        }
        
        // Create redemption record
        const redemption = await queryOne(
            `INSERT INTO loyalty_redemptions (user_id, reward_id, points_spent, status)
             VALUES ($1, $2, $3, 'completed')
             RETURNING *`,
            [userId, rewardId, reward.points_cost]
        );
        
        res.json({
            message: 'Recompensa canjeada exitosamente',
            redemption,
            newBalance: user.loyalty_points - reward.points_cost
        });
    } catch (error) {
        console.error('Redeem error:', error);
        res.status(500).json({ error: 'Error al canjear recompensa' });
    }
});

export default router;
