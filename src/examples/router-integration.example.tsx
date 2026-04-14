/**
 * 🔗 EJEMPLO DE INTEGRACIÓN AL ROUTER
 * 
 * Este archivo muestra cómo integrar el módulo de migración
 * en el sistema de rutas de la aplicación.
 */

// ============================================================
// OPCIÓN 1: React Router v6
// ============================================================

import { Routes, Route, Navigate } from 'react-router-dom';
import { ClientMigrationPage } from '@/pages/admin/ClientMigrationPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// En tu componente de rutas de admin:
export const AdminRoutes = () => {
  return (
    <Routes>
      {/* Rutas existentes */}
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="clients" element={<ClientsPage />} />
      <Route path="schedule" element={<SchedulePage />} />
      <Route path="finances" element={<FinancesPage />} />
      
      {/* 🆕 NUEVA RUTA: Migración de Clientes */}
      <Route 
        path="migration" 
        element={
          <ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}>
            <ClientMigrationPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Rutas existentes */}
      <Route path="settings" element={<SettingsPage />} />
    </Routes>
  );
};

// ============================================================
// OPCIÓN 2: Configuración de rutas con objeto
// ============================================================

export const adminRoutes = [
  {
    path: '/admin/dashboard',
    component: AdminDashboard,
    requiredRoles: ['admin', 'owner', 'manager'],
  },
  {
    path: '/admin/clients',
    component: ClientsPage,
    requiredRoles: ['admin', 'owner', 'manager'],
  },
  // 🆕 NUEVA RUTA
  {
    path: '/admin/migration',
    component: ClientMigrationPage,
    requiredRoles: ['owner', 'admin', 'manager'],
    label: 'Migración de Clientes',
    icon: 'RefreshCcw',
  },
  {
    path: '/admin/settings',
    component: SettingsPage,
    requiredRoles: ['admin', 'owner'],
  },
];

// ============================================================
// INTEGRACIÓN AL MENÚ DE ADMIN
// ============================================================

import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  DollarSign, 
  RefreshCcw, // ← Icono para migración
  Settings 
} from 'lucide-react';

export const adminMenuItems = [
  {
    label: 'Dashboard',
    path: '/admin/dashboard',
    icon: LayoutDashboard,
    requiredRoles: ['admin', 'owner', 'manager'],
  },
  {
    label: 'Clientes',
    path: '/admin/clients',
    icon: Users,
    requiredRoles: ['admin', 'owner', 'manager'],
  },
  {
    label: 'Horarios',
    path: '/admin/schedule',
    icon: Calendar,
    requiredRoles: ['admin', 'owner', 'manager', 'instructor'],
  },
  {
    label: 'Finanzas',
    path: '/admin/finances',
    icon: DollarSign,
    requiredRoles: ['owner', 'admin'],
  },
  // 🆕 NUEVO ITEM DE MENÚ
  {
    label: 'Migración de Clientes',
    path: '/admin/migration',
    icon: RefreshCcw,
    requiredRoles: ['owner', 'admin', 'manager'],
    badge: 'Nuevo', // Opcional: badge de "nuevo"
    description: 'Registra clientes existentes', // Opcional: tooltip
  },
  {
    label: 'Configuración',
    path: '/admin/settings',
    icon: Settings,
    requiredRoles: ['owner', 'admin'],
  },
];

// ============================================================
// COMPONENTE DE SIDEBAR CON NUEVO ITEM
// ============================================================

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const AdminSidebar = () => {
  const location = useLocation();
  const { user } = useAuthStore();

  // Filtrar items según rol del usuario
  const visibleItems = adminMenuItems.filter(item =>
    item.requiredRoles.includes(user?.role || '')
  );

  return (
    <aside className="w-64 bg-white border-r">
      <nav className="p-4 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
              {item.badge && (
                <span className="ml-auto text-xs bg-info/10 text-info px-2 py-1 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

// ============================================================
// PROTECTED ROUTE COMPONENT (si no existe)
// ============================================================

import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute = ({ 
  children, 
  requiredRoles = [] 
}: ProtectedRouteProps) => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

// ============================================================
// VERIFICACIÓN DE PERMISOS (Hook)
// ============================================================

import { useAuthStore } from '@/stores/authStore';
import { MIGRATION_PERMISSIONS } from '@/types/migration.types';

export const useCanMigrate = () => {
  const { user } = useAuthStore();
  
  if (!user) return false;
  
  return MIGRATION_PERMISSIONS[user.role] === true;
};

// Uso en un componente:
export const SomeComponent = () => {
  const canMigrate = useCanMigrate();

  return (
    <div>
      {canMigrate && (
        <Button onClick={() => navigate('/admin/migration')}>
          Migrar Cliente
        </Button>
      )}
    </div>
  );
};

// ============================================================
// EJEMPLO COMPLETO DE App.tsx
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// Pages
import { Login } from '@/pages/Login';
import { AdminLayout } from '@/layouts/AdminLayout';
import { ClientLayout } from '@/layouts/ClientLayout';

// Admin Pages
import { AdminDashboard } from '@/pages/admin/Dashboard';
import { ClientsPage } from '@/pages/admin/Clients';
import { SchedulePage } from '@/pages/admin/Schedule';
import { FinancesPage } from '@/pages/admin/Finances';
import { ClientMigrationPage } from '@/pages/admin/ClientMigrationPage'; // ← NUEVO

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="finances" element={<FinancesPage />} />
          
          {/* 🆕 RUTA DE MIGRACIÓN */}
          <Route 
            path="migration" 
            element={
              <ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}>
                <ClientMigrationPage />
              </ProtectedRoute>
            } 
          />
        </Route>
        
        {/* Client Routes */}
        <Route path="/client" element={<ClientLayout />}>
          {/* ... otras rutas ... */}
        </Route>
        
        {/* Default */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// ============================================================
// INTEGRACIÓN EN EL DASHBOARD (Widget)
// ============================================================

import { MembershipStatsWidget } from '@/components/admin/dashboard/MembershipStatsWidget';

export const AdminDashboard = () => {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Widgets existentes */}
        <SalesWidget />
        <ClientsWidget />
        
        {/* 🆕 NUEVO WIDGET: Stats de Membresías */}
        <MembershipStatsWidget />
        
        {/* Más widgets */}
        <UpcomingClassesWidget />
      </div>
      
      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/admin/clients/new')}>
            Nuevo Cliente
          </Button>
          
          {/* 🆕 BOTÓN RÁPIDO: Migrar Cliente */}
          {canMigrate && (
            <Button 
              variant="outline"
              onClick={() => navigate('/admin/migration')}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Migrar Cliente Existente
            </Button>
          )}
          
          <Button variant="outline">
            Nueva Clase
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// NOTAS FINALES
// ============================================================

/**
 * CHECKLIST DE INTEGRACIÓN:
 * 
 * ✅ 1. Importar ClientMigrationPage en el router
 * ✅ 2. Agregar ruta /admin/migration
 * ✅ 3. Proteger con ProtectedRoute (roles: owner, admin, manager)
 * ✅ 4. Agregar item al menú de admin
 * ✅ 5. Agregar widget MembershipStatsWidget al dashboard
 * ✅ 6. (Opcional) Agregar botón rápido en dashboard
 * ✅ 7. Verificar que Firebase está configurado
 * ✅ 8. Crear índices en Firestore
 * 
 * URLS RESULTANTES:
 * - /admin/migration → Página principal
 * - /admin/migration?tab=register → Tab de registro
 * - /admin/migration?tab=history → Tab de historial
 */
