-- ============================================
-- RESET / CREATE ADMIN — Essenza del Flusso
-- Email: admin@essenza.com
-- Password: Admin123!
-- ============================================
-- Hash bcrypt cost=12 verificado contra "Admin123!"

INSERT INTO users (
    email,
    password_hash,
    display_name,
    phone,
    role,
    accepts_communications,
    receive_reminders,
    receive_promotions,
    receive_weekly_summary
) VALUES (
    'admin@essenza.com',
    '$2a$12$ClifbKLKXy5b4SoC5IYJ2.fwRrCzVwHTU3EuojaNGE3eKUIcS8rhm',
    'Administrador Essenza',
    '+525512345678',
    'admin',
    true,
    true,
    true,
    true
)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = 'admin';

SELECT email, display_name, role FROM users WHERE email = 'admin@essenza.com';
