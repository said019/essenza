import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// GET /api/reports/overview - Dashboard overview stats
// ============================================
router.get('/overview', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        // Default: current month
        const periodStart = startDate as string || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const periodEnd = endDate as string || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

        // Total active members
        const activeMembers = await queryOne(
            `SELECT COUNT(DISTINCT user_id) as count FROM memberships WHERE status = 'active'`
        );

        // Total bookings in period
        const monthlyBookings = await queryOne(
            `SELECT COUNT(*) as count FROM bookings
             WHERE created_at >= $1::date AND created_at < ($2::date + 1)`,
            [periodStart, periodEnd]
        );

        // Revenue in period (payments + events + orders)
        const monthlyRevenue = await queryOne(
            `SELECT COALESCE(SUM(total), 0) as total FROM (
                SELECT SUM(amount) as total FROM payments
                WHERE created_at >= $1::date AND created_at < ($2::date + 1) AND status = 'completed'
                UNION ALL
                SELECT SUM(amount) as total FROM event_registrations
                WHERE paid_at >= $1::date AND paid_at < ($2::date + 1) AND status = 'confirmed' AND amount > 0
                UNION ALL
                SELECT SUM(total_amount) as total FROM orders
                WHERE approved_at >= $1::date AND approved_at < ($2::date + 1) AND status = 'approved'
            ) combined`,
            [periodStart, periodEnd]
        );

        // Classes this week
        const weeklyClasses = await queryOne(
            `SELECT COUNT(*) as count FROM classes
             WHERE date >= CURRENT_DATE AND date < CURRENT_DATE + 7 AND status = 'scheduled'`
        );

        // New members in period
        const newMembers = await queryOne(
            `SELECT COUNT(*) as count FROM users
             WHERE role = 'client' AND created_at >= $1::date AND created_at < ($2::date + 1)`,
            [periodStart, periodEnd]
        );

        // Attendance rate in period
        const attendanceRate = await queryOne(
            `SELECT
                COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in,
                COUNT(CASE WHEN status IN ('confirmed', 'checked_in') THEN 1 END) as total
             FROM bookings
             WHERE created_at >= $1::date AND created_at < ($2::date + 1)`,
            [periodStart, periodEnd]
        );

        const rate = attendanceRate?.total > 0
            ? Math.round((attendanceRate.checked_in / attendanceRate.total) * 100)
            : 0;

        // Egresos in period
        const monthlyExpenses = await queryOne(
            `SELECT COALESCE(SUM(amount), 0) as total FROM egresos
             WHERE date >= $1::date AND date < ($2::date + 1) AND status != 'cancelado'`,
            [periodStart, periodEnd]
        );

        // Revenue vs Expenses trend (last 6 months)
        const financialTrend = await query(
            `SELECT
                TO_CHAR(month_date, 'YYYY-MM') as month,
                TO_CHAR(month_date, 'Mon') as label,
                COALESCE(rev.total, 0)::numeric as revenue,
                COALESCE(exp.total, 0)::numeric as expenses
            FROM generate_series(
                DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
                DATE_TRUNC('month', CURRENT_DATE),
                '1 month'
            ) AS month_date
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(total), 0) as total FROM (
                    SELECT SUM(amount) as total FROM payments
                    WHERE status = 'completed'
                      AND created_at >= month_date
                      AND created_at < month_date + INTERVAL '1 month'
                    UNION ALL
                    SELECT SUM(amount) as total FROM event_registrations
                    WHERE status = 'confirmed' AND amount > 0
                      AND paid_at >= month_date
                      AND paid_at < month_date + INTERVAL '1 month'
                    UNION ALL
                    SELECT SUM(total_amount) as total FROM orders
                    WHERE status = 'approved'
                      AND approved_at >= month_date
                      AND approved_at < month_date + INTERVAL '1 month'
                ) combined
            ) rev ON true
            LEFT JOIN LATERAL (
                SELECT SUM(amount) as total FROM egresos
                WHERE status != 'cancelado'
                  AND date >= month_date
                  AND date < month_date + INTERVAL '1 month'
            ) exp ON true
            ORDER BY month_date ASC`
        );

        const revenue = parseFloat(monthlyRevenue?.total || '0');
        const expenses = parseFloat(monthlyExpenses?.total || '0');

        res.json({
            activeMembers: parseInt(activeMembers?.count || '0'),
            monthlyBookings: parseInt(monthlyBookings?.count || '0'),
            monthlyRevenue: revenue,
            monthlyExpenses: expenses,
            netProfit: revenue - expenses,
            weeklyClasses: parseInt(weeklyClasses?.count || '0'),
            newMembers: parseInt(newMembers?.count || '0'),
            attendanceRate: rate,
            financialTrend: financialTrend.map(r => ({
                month: r.month,
                label: r.label,
                revenue: parseFloat(r.revenue),
                expenses: parseFloat(r.expenses),
                profit: parseFloat(r.revenue) - parseFloat(r.expenses),
            })),
        });
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

// ============================================
// GET /api/reports/classes - Class stats
// ============================================
router.get('/classes', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        // Classes by type
        const byType = await query(
            `SELECT ct.name, ct.color, COUNT(c.id) as total_classes,
                    SUM(c.current_bookings) as total_bookings
             FROM classes c
             JOIN class_types ct ON c.class_type_id = ct.id
             WHERE c.date BETWEEN $1 AND $2
             GROUP BY ct.id, ct.name, ct.color
             ORDER BY total_bookings DESC`,
            [start, end]
        );

        // Average attendance by day of week
        const byDayOfWeek = await query(
            `SELECT EXTRACT(DOW FROM date) as day_of_week,
                    AVG(current_bookings) as avg_attendance
             FROM classes
             WHERE date BETWEEN $1 AND $2
             GROUP BY EXTRACT(DOW FROM date)
             ORDER BY day_of_week`,
            [start, end]
        );

        // Popular times
        const byTime = await query(
            `SELECT start_time, AVG(current_bookings) as avg_attendance
             FROM classes
             WHERE date BETWEEN $1 AND $2
             GROUP BY start_time
             ORDER BY avg_attendance DESC
             LIMIT 5`,
            [start, end]
        );

        // Occupancy rate
        const occupancy = await queryOne(
            `SELECT 
                SUM(current_bookings) as total_bookings,
                SUM(max_capacity) as total_capacity
             FROM classes
             WHERE date BETWEEN $1 AND $2`,
            [start, end]
        );

        const occupancyRate = occupancy?.total_capacity > 0
            ? Math.round((occupancy.total_bookings / occupancy.total_capacity) * 100)
            : 0;

        res.json({
            byType,
            byDayOfWeek,
            byTime,
            occupancyRate
        });
    } catch (error) {
        console.error('Get class stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de clases' });
    }
});

// ============================================
// GET /api/reports/revenue - Revenue stats
// ============================================
router.get('/revenue', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        // Daily revenue (payments + events)
        const daily = await query(
            `SELECT date, SUM(total) as total, SUM(count) as count FROM (
                SELECT created_at::date as date, SUM(amount) as total, COUNT(*) as count
                FROM payments
                WHERE created_at >= $1::date AND created_at < ($2::date + 1) AND status = 'completed'
                GROUP BY created_at::date
                UNION ALL
                SELECT paid_at::date as date, SUM(amount) as total, COUNT(*) as count
                FROM event_registrations
                WHERE paid_at >= $1::date AND paid_at < ($2::date + 1) AND status = 'confirmed' AND amount > 0
                GROUP BY paid_at::date
             ) combined GROUP BY date ORDER BY date`,
            [start, end]
        );

        // Revenue by payment method (payments + events)
        const byMethod = await query(
            `SELECT payment_method, SUM(total) as total, SUM(count) as count FROM (
                SELECT payment_method, SUM(amount) as total, COUNT(*) as count
                FROM payments
                WHERE created_at >= $1::date AND created_at < ($2::date + 1) AND status = 'completed'
                GROUP BY payment_method
                UNION ALL
                SELECT payment_method, SUM(amount) as total, COUNT(*) as count
                FROM event_registrations
                WHERE paid_at >= $1::date AND paid_at < ($2::date + 1) AND status = 'confirmed' AND amount > 0
                GROUP BY payment_method
             ) combined GROUP BY payment_method`,
            [start, end]
        );

        // Revenue by plan
        const byPlan = await query(
            `SELECT name, SUM(total) as total, SUM(count) as count FROM (
                SELECT p.name, SUM(pay.amount) as total, COUNT(*) as count
                FROM payments pay
                JOIN memberships m ON pay.membership_id = m.id
                JOIN plans p ON m.plan_id = p.id
                WHERE pay.created_at >= $1::date AND pay.created_at < ($2::date + 1) AND pay.status = 'completed'
                GROUP BY p.id, p.name
                UNION ALL
                SELECT e.title as name, SUM(r.amount) as total, COUNT(*) as count
                FROM event_registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.paid_at >= $1::date AND r.paid_at < ($2::date + 1) AND r.status = 'confirmed' AND r.amount > 0
                GROUP BY e.id, e.title
             ) combined GROUP BY name ORDER BY total DESC`,
            [start, end]
        );

        // Total (payments + events)
        const total = await queryOne(
            `SELECT SUM(total) as total FROM (
                SELECT SUM(amount) as total FROM payments
                WHERE created_at >= $1::date AND created_at < ($2::date + 1) AND status = 'completed'
                UNION ALL
                SELECT SUM(amount) as total FROM event_registrations
                WHERE paid_at >= $1::date AND paid_at < ($2::date + 1) AND status = 'confirmed' AND amount > 0
             ) combined`,
            [start, end]
        );

        res.json({
            daily,
            byMethod,
            byPlan,
            total: parseFloat(total?.total || '0')
        });
    } catch (error) {
        console.error('Get revenue stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de ingresos' });
    }
});

// ============================================
// GET /api/reports/retention - Retention stats (Detailed)
// ============================================
router.get('/retention', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        // 1. General Booking Stats (Attendance Flow)
        const bookingStats = await queryOne(
            `SELECT 
                COUNT(*) as total_bookings,
                COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as attended,
                COUNT(CASE WHEN status = 'cancelled' AND cancellation_reason ILIKE '%menos de%' THEN 1 END) as late_cancellations,
                COUNT(CASE WHEN status = 'cancelled' AND cancellation_reason NOT ILIKE '%menos de%' AND cancellation_reason NOT ILIKE '%admin%' THEN 1 END) as early_cancellations,
                COUNT(CASE WHEN status = 'confirmed' AND date < NOW() THEN 1 END) as no_shows
             FROM bookings b
             JOIN classes c ON b.class_id = c.id
             WHERE c.date BETWEEN $1 AND $2`,
            [start, end]
        );

        // 2. Economic Impact (Approximate lost revenue)
        // Calculating based on average class price or specific logic if available.
        // For now, we return counts so frontend can multiply by avg price.

        // 3. Reposition Stats
        // Assuming repositions are identified via specific plan categories or tracking. 
        // If not explicit, we skip specific reposition logic or approximate.
        // We can track 'cancellations_used' increments from memberships update.
        const repositions = await queryOne(
            `SELECT SUM(cancellations_used) as created FROM memberships`
        );

        // 4. Users with most No-Shows/Late Cancels
        const riskyUsers = await query(
            `SELECT u.id, u.display_name, u.email,
                    COUNT(CASE WHEN b.status = 'confirmed' AND c.date < NOW() THEN 1 END) as no_shows,
                    COUNT(CASE WHEN b.status = 'cancelled' AND b.cancellation_reason ILIKE '%menos de%' THEN 1 END) as late_cancels
             FROM bookings b
             JOIN classes c ON b.class_id = c.id
             JOIN users u ON b.user_id = u.id
             WHERE c.date BETWEEN $1 AND $2
             GROUP BY u.id, u.display_name, u.email
             HAVING COUNT(CASE WHEN b.status = 'confirmed' AND c.date < NOW() THEN 1 END) > 0 
                OR COUNT(CASE WHEN b.status = 'cancelled' AND b.cancellation_reason ILIKE '%menos de%' THEN 1 END) > 0
             ORDER BY no_shows DESC, late_cancels DESC
             LIMIT 10`,
            [start, end]
        );

        // 5. Membership Retention (Renewal Rate)
        const renewalData = await queryOne(
            `WITH expired AS (
                 SELECT user_id FROM memberships 
                 WHERE end_date < CURRENT_DATE 
                 AND end_date >= CURRENT_DATE - 90
              ),
              renewed AS (
                 SELECT DISTINCT m.user_id FROM memberships m
                 JOIN expired e ON m.user_id = e.user_id
                 WHERE m.created_at >= CURRENT_DATE - 90
                 AND m.id != (SELECT id FROM memberships WHERE user_id = e.user_id ORDER BY end_date DESC LIMIT 1)
              )
              SELECT 
                 (SELECT COUNT(*) FROM expired) as expired_count,
                 (SELECT COUNT(*) FROM renewed) as renewed_count`
        );

        const renewalRate = renewalData?.expired_count > 0
            ? Math.round((renewalData.renewed_count / renewalData.expired_count) * 100)
            : 0;

        res.json({
            summary: {
                totalBookings: parseInt(bookingStats?.total_bookings || '0'),
                attended: parseInt(bookingStats?.attended || '0'),
                lateCancellations: parseInt(bookingStats?.late_cancellations || '0'),
                earlyCancellations: parseInt(bookingStats?.early_cancellations || '0'),
                noShows: parseInt(bookingStats?.no_shows || '0'),
            },
            repositions: {
                created: parseInt(repositions?.created || '0'),
                // tracked elsewhere if needed
            },
            riskyUsers,
            retentionMetrics: {
                renewalRate,
                expiredLast90Days: parseInt(renewalData?.expired_count || '0'),
                renewedLast90Days: parseInt(renewalData?.renewed_count || '0')
            }
        });
    } catch (error) {
        console.error('Get retention stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de retención' });
    }
});

// ============================================
// GET /api/reports/instructors - Instructor stats
// ============================================
router.get('/instructors', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];

        const stats = await query(
            `SELECT 
                i.id,
                i.display_name,
                i.photo_url,
                -- Statistics regarding Classes
                COUNT(DISTINCT c.id) as total_classes,
                COALESCE(SUM(c.current_bookings), 0) as total_students,
                COALESCE(AVG(c.current_bookings), 0) as avg_attendance,
                COALESCE(AVG(c.current_bookings::float / NULLIF(c.max_capacity, 0) * 100), 0) as avg_occupancy,
                -- Statistics regarding Reviews
                (
                    SELECT COUNT(*)
                    FROM reviews r
                    WHERE r.instructor_id = i.id
                    AND r.created_at >= $1::timestamp 
                    AND r.created_at <= $2::timestamp + INTERVAL '1 day'
                    AND r.status = 'published'
                ) as total_reviews,
                (
                    SELECT COALESCE(AVG(overall_rating), 0)
                    FROM reviews r
                    WHERE r.instructor_id = i.id
                    AND r.created_at >= $1::timestamp 
                    AND r.created_at <= $2::timestamp + INTERVAL '1 day'
                    AND r.status = 'published'
                ) as avg_rating
             FROM instructors i
             LEFT JOIN classes c ON i.id = c.instructor_id 
                AND c.date >= $1 
                AND c.date <= $2
                AND c.status != 'cancelled'
             WHERE i.is_active = true
             GROUP BY i.id
             ORDER BY avg_rating DESC NULLS LAST`,
            [start, end]
        );

        res.json(stats);
    } catch (error) {
        console.error('Get instructor stats error:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas de instructores' });
    }
});

export default router;
