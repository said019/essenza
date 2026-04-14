import { ReactNode, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
    children?: ReactNode; // Make optional
    requiredRoles?: UserRole[];
    redirectTo?: string;
}

export function AuthGuard({ children, requiredRoles, redirectTo = '/login' }: AuthGuardProps) {
    const navigate = useNavigate();
    const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();

    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    // Handle redirects
    useEffect(() => {
        if (isLoading) return;

        // Not authenticated
        if (!isAuthenticated) {
            navigate(redirectTo, { replace: true });
            return;
        }

        // Check role if specified
        if (requiredRoles && user && !requiredRoles.includes(user.role)) {
            // Redirect to appropriate dashboard based on role
            if (user.role === 'admin' || user.role === 'super_admin') {
                navigate('/admin/dashboard', { replace: true });
            } else if (user.role === 'instructor') {
                navigate('/coach', { replace: true });
            } else if (user.role === 'reception') {
                navigate('/admin/bookings', { replace: true });
            } else {
                navigate('/app', { replace: true });
            }
        }
    }, [isLoading, isAuthenticated, user, requiredRoles, navigate, redirectTo]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    // Not authenticated or wrong role
    if (!isAuthenticated) {
        return null;
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
        return null;
    }

    // Render children if provided (wrapper mode), otherwise Outlet (layout mode)
    return children ? <>{children}</> : <Outlet />;
}

// HOC version for simpler usage
export function withAuthGuard<P extends object>(
    Component: React.ComponentType<P>,
    requiredRoles?: UserRole[]
) {
    return function WrappedComponent(props: P) {
        return (
            <AuthGuard requiredRoles={requiredRoles}>
                <Component {...props} />
            </AuthGuard>
        );
    };
}
