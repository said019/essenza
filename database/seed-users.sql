-- ============================================
-- USUARIOS DE PRUEBA - Essenza del Flusso
-- ============================================

-- Primero eliminar usuarios de prueba existentes (si existen)
DELETE FROM users WHERE email IN ('admin@essenza.com', 'usuario@essenza.com');

-- Insertar usuario administrador de prueba
-- Email: admin@essenza.com
-- Password: Admin123!
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
    '$2a$12$ClifbKLKXy5b4SoC5IYJ2.fwRrCzVwHTU3EuojaNGE3eKUIcS8rhm', -- Admin123!
    'Administrador Essenza',
    '+525512345678',
    'admin',
    true,
    true,
    true,
    true
);

-- Insertar usuario normal de prueba
-- Email: usuario@essenza.com  
-- Password: Usuario123!
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
    'usuario@essenza.com',
    '$2a$12$skFzvo8H8170Xzxq5622MOduVZTNjDXvWAtNa9WBnjZiQQIghDdqq', -- Usuario123!
    'Usuario de Prueba',
    '+525587654321',
    'client',
    true,
    true,
    false,
    false
);

-- Insertar instructor de prueba
-- Email: instructor@essenza.com
-- Password: Instructor123!
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
    'instructor@essenza.com',
    '$2a$12$0oY1.3qm5vBDDLBpoyVi8un51Nnz5VwaoXYSVoiGD/mA9ZDqDmzSC', -- Instructor123!
    'Instructor de Prueba',
    '+525598765432',
    'instructor',
    true,
    true,
    true,
    true
);

-- Mostrar los usuarios creados
SELECT 
    email,
    display_name,
    role,
    phone,
    created_at
FROM users 
WHERE email IN ('admin@essenza.com', 'usuario@essenza.com', 'instructor@essenza.com')
ORDER BY role DESC;

-- ============================================
-- CREDENCIALES DE ACCESO:
-- ============================================
-- 
-- ADMINISTRADOR:
-- Email: admin@essenza.com
-- Password: Admin123!
-- 
-- USUARIO NORMAL:
-- Email: usuario@essenza.com
-- Password: Usuario123!
-- 
-- INSTRUCTOR:
-- Email: instructor@essenza.com
-- Password: Instructor123!
-- ============================================