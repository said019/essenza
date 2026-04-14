import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/products - List products
router.get('/', authenticate, requireRole('admin', 'super_admin', 'reception'), async (req: Request, res: Response) => {
    try {
        const { search, category, active } = req.query;

        let queryStr = `
            SELECT p.*, pc.name as category_name
            FROM products p
            LEFT JOIN product_categories pc ON p.category_id = pc.id
            WHERE 1=1
        `;
        const params: any[] = [];
        let paramCount = 0;

        if (active === 'true') {
            queryStr += ` AND p.is_active = true`;
        }

        if (search) {
            paramCount++;
            queryStr += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (category && category !== 'all') {
            paramCount++;
            queryStr += ` AND p.category_id = $${paramCount}`;
            params.push(category);
        }

        queryStr += ` ORDER BY p.name ASC`;

        const products = await query(queryStr, params);
        res.json(products);
    } catch (error) {
        console.error('List products error:', error);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// GET /api/products/categories - List categories
router.get('/categories', authenticate, requireRole('admin', 'super_admin', 'reception'), async (req: Request, res: Response) => {
    try {
        const categories = await query(
            `SELECT * FROM product_categories WHERE is_active = true ORDER BY name ASC`
        );
        res.json(categories);
    } catch (error) {
        console.error('List categories error:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
});

// POST /api/products - Create product
router.post('/', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { name, description, price, cost, stock, sku, categoryId, isActive } = req.body;

        const product = await queryOne(`
            INSERT INTO products (name, description, price, cost, stock, sku, category_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [name, description || null, price, cost || 0, stock || 0, sku || null, categoryId || null, isActive !== false]);

        res.status(201).json(product);
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Error al crear producto' });
    }
});

// PUT /api/products/:id - Update product
router.put('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, price, cost, stock, sku, categoryId, isActive } = req.body;

        const product = await queryOne(`
            UPDATE products SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                price = COALESCE($3, price),
                cost = COALESCE($4, cost),
                stock = COALESCE($5, stock),
                sku = COALESCE($6, sku),
                category_id = $7,
                is_active = COALESCE($8, is_active),
                updated_at = NOW()
            WHERE id = $9
            RETURNING *
        `, [name, description, price, cost, stock, sku, categoryId || null, isActive, id]);

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json(product);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
});

// DELETE /api/products/:id - Soft delete product
router.delete('/:id', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await queryOne(
            'UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
            [id]
        );

        if (!result) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

export default router;
