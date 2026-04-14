import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/sales - Create a POS sale
router.post('/', authenticate, requireRole('admin', 'super_admin', 'reception'), async (req: Request, res: Response) => {
    try {
        const { userId, items, paymentMethod, notes, discount } = req.body;
        const sellerId = req.user?.userId;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Calculate totals and validate stock
            let subtotal = 0;
            for (const item of items) {
                const product = await client.query(
                    'SELECT id, name, price, stock FROM products WHERE id = $1 AND is_active = true',
                    [item.productId]
                );

                if (product.rows.length === 0) {
                    throw new Error(`Producto no encontrado: ${item.productId}`);
                }

                if (product.rows[0].stock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${product.rows[0].name}`);
                }

                subtotal += item.unitPrice * item.quantity;
            }

            const discountAmount = discount || 0;
            const total = subtotal - discountAmount;

            // Create sale
            const sale = await client.query(`
                INSERT INTO sales (user_id, seller_id, subtotal, discount, total, payment_method, notes, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')
                RETURNING *
            `, [userId || null, sellerId, subtotal, discountAmount, total, paymentMethod, notes || null]);

            const saleId = sale.rows[0].id;

            // Create sale items and update stock
            for (const item of items) {
                const product = await client.query('SELECT name FROM products WHERE id = $1', [item.productId]);

                await client.query(`
                    INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [saleId, item.productId, product.rows[0].name, item.quantity, item.unitPrice, item.unitPrice * item.quantity]);

                // Decrement stock
                await client.query(
                    'UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2',
                    [item.quantity, item.productId]
                );
            }

            await client.query('COMMIT');

            res.status(201).json(sale.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Create sale error:', error);
        res.status(500).json({ error: error.message || 'Error al crear venta' });
    }
});

// GET /api/sales - List sales
router.get('/', authenticate, requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
    try {
        const sales = await query(`
            SELECT s.*, u.display_name as customer_name, seller.display_name as seller_name
            FROM sales s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN users seller ON s.seller_id = seller.id
            ORDER BY s.created_at DESC
            LIMIT 100
        `);
        res.json(sales);
    } catch (error) {
        console.error('List sales error:', error);
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

export default router;
