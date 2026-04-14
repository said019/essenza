import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '../types/auth.js';
import { queryOne } from '../config/database.js';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

// Verify JWT token middleware
export function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No autorizado',
                message: 'Token de autenticación no proporcionado'
            });
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error('JWT_SECRET not configured');
            return res.status(500).json({ error: 'Error de configuración del servidor' });
        }

        const decoded = jwt.verify(token, secret) as JwtPayload;
        req.user = decoded;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                error: 'Sesión expirada',
                message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
            });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                error: 'Token inválido',
                message: 'El token de autenticación es inválido'
            });
        }
        return res.status(500).json({ error: 'Error de autenticación' });
    }
}

// Require specific roles middleware
export function requireRole(...roles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        if (!roles.includes(req.user.role as UserRole)) {
            return res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tienes permisos para acceder a este recurso'
            });
        }

        next();
    };
}

// Optional authentication (for routes that work with or without auth)
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET;

        if (secret) {
            const decoded = jwt.verify(token, secret) as JwtPayload;
            req.user = decoded;
        }
    } catch {
        // Invalid token, but continue anyway for optional auth
    }

    next();
}

// Generate JWT token
export function generateToken(payload: JwtPayload): string {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

// Generate password reset token (shorter expiry)
export function generateResetToken(userId: string): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign({ userId, purpose: 'reset' }, secret, { expiresIn: '1h' });
}

// Verify password reset token
export function verifyResetToken(token: string): { userId: string } | null {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) return null;

        const decoded = jwt.verify(token, secret) as { userId: string; purpose: string };

        if (decoded.purpose !== 'reset') return null;

        return { userId: decoded.userId };
    } catch {
        return null;
    }
}

// Generate magic link token for instructors (1 hour expiry)
export function generateMagicLinkToken(email: string): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET not configured');
    }

    return jwt.sign({ email, purpose: 'magic-link' }, secret, { expiresIn: '1h' });
}

// Verify magic link token
export function verifyMagicLinkToken(token: string): { email: string } | null {
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) return null;

        const decoded = jwt.verify(token, secret) as { email: string; purpose: string };

        if (decoded.purpose !== 'magic-link') return null;

        return { email: decoded.email };
    } catch {
        return null;
    }
}
