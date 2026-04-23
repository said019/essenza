import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import api from '@/lib/api';
import type { AdminStats, Membership } from '@/types/auth';
import type { Order } from '@/types/order';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Calendar,
    Users,
    CreditCard,
    TrendingUp,
    AlertCircle,
    ChevronRight,
    CheckCircle2,
    UserPlus,
    Receipt,
    Clock,
    Banknote,
    Sparkles,
    Ticket,
    Cake,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminDashboard() {
    const { user } = useAuthStore();

    // Fetch Stats
    const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
        queryKey: ['admin-stats'],
        queryFn: async () => {
            const { data } = await api.get('/admin/stats');
            return data;
        },
    });

    // Fetch Pending/Recent Memberships
    const { data: memberships, isLoading: membershipsLoading } = useQuery<Membership[]>({
        queryKey: ['recent-memberships'],
        queryFn: async () => {
            const { data } = await api.get('/memberships');
            return data;
        },
    });

    // Fetch Pending Orders (payments to verify)
    const { data: pendingOrders, isLoading: ordersLoading } = useQuery<Order[]>({
        queryKey: ['pending-orders'],
        queryFn: async () => {
            const { data } = await api.get('/orders/pending');
            return data;
        },
    });

    // Fetch Pending Event Registrations
    const { data: pendingEventRegs = [] } = useQuery<any[]>({
        queryKey: ['pending-event-registrations'],
        queryFn: async () => {
            const { data } = await api.get('/events/registrations/pending');
            return data;
        },
    });

    // Fetch Birthdays this month
    const { data: birthdays = [] } = useQuery<any[]>({
        queryKey: ['admin-birthdays'],
        queryFn: async () => {
            const { data } = await api.get('/admin/birthdays');
            return data;
        },
    });

    const recentMemberships = memberships?.slice(0, 5) || [];
    const pendingMemberships = memberships?.filter(m =>
        m.status === 'pending_payment' || m.status === 'pending_activation'
    ).length || 0;
    
    const pendingVerificationOrders = pendingOrders?.filter(o => o.status === 'pending_verification' || o.status === 'pending_payment') || [];

    return (
        <AuthGuard requiredRoles={['admin', 'instructor']}>
            <AdminLayout>
                <div className="space-y-6">
                    {/* ═══ Header with flowing gradient ═══ */}
                    <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
                        {/* Animated flowing background */}
                        <div className="absolute inset-0 flow-gradient-dark rounded-2xl" />

                        {/* Decorative blobs */}
                        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-essenza-gold/[0.08] blur-3xl animate-drift" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-40 animate-breathe" style={{ background: 'radial-gradient(circle, hsla(210,40%,72%,0.3) 0%, transparent 70%)' }} />
                        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-essenza-gold/[0.05] blur-2xl animate-float-slow" />

                        {/* Animated wave line */}
                        <div className="absolute inset-0 opacity-10 overflow-hidden rounded-2xl">
                            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                                <path d="M0,100 Q200,60 400,100 T800,100" fill="none" stroke="rgba(201,169,110,0.4)" strokeWidth="1">
                                    <animate attributeName="d" dur="8s" repeatCount="indefinite"
                                        values="M0,100 Q200,60 400,100 T800,100;M0,100 Q200,140 400,100 T800,100;M0,100 Q200,60 400,100 T800,100" />
                                </path>
                                <path d="M0,120 Q300,80 600,120 T800,120" fill="none" stroke="rgba(155,181,204,0.3)" strokeWidth="0.5">
                                    <animate attributeName="d" dur="10s" repeatCount="indefinite"
                                        values="M0,120 Q300,80 600,120 T800,120;M0,120 Q300,160 600,120 T800,120;M0,120 Q300,80 600,120 T800,120" />
                                </path>
                            </svg>
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="h-4 w-4 text-essenza-gold/60 animate-breathe" />
                                <p className="text-[10px] uppercase tracking-[3px] text-essenza-gold/60 font-semibold font-body">
                                    Panel de Control
                                </p>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white animate-fade-in">
                                Bienvenido, {user?.display_name?.split(' ')[0]}
                            </h1>
                            <p className="text-white/40 font-body text-sm mt-1 animate-fade-in delay-100">
                                {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                            </p>
                        </div>
                    </div>

                    {/* ═══ Alerts ═══ */}
                    {pendingVerificationOrders.length > 0 && (
                        <div className="bg-essenza-sage/10 border border-essenza-sage/30 text-foreground p-4 rounded-xl flex items-center justify-between animate-fade-up shimmer-border">
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="h-10 w-10 rounded-full bg-essenza-sage/15 flex items-center justify-center shrink-0 animate-breathe">
                                    <Banknote className="h-5 w-5 text-essenza-sage" />
                                </div>
                                <span className="font-medium text-sm">
                                    {pendingVerificationOrders.length} pago{pendingVerificationOrders.length > 1 ? 's' : ''} pendiente{pendingVerificationOrders.length > 1 ? 's' : ''} de verificación
                                </span>
                            </div>
                            <Button variant="default" size="sm" className="bg-essenza-sage hover:bg-essenza-sage/90 rounded-xl relative z-10 ripple-btn" asChild>
                                <Link to="/admin/orders">
                                    Verificar <ChevronRight className="ml-1 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}
                    
                    {pendingMemberships > 0 && (
                        <div className="bg-warning/10 border border-warning/30 text-warning-foreground p-4 rounded-xl flex items-center justify-between animate-fade-up delay-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-warning/15 flex items-center justify-center shrink-0 animate-breathe">
                                    <AlertCircle className="h-5 w-5 text-warning" />
                                </div>
                                <span className="font-medium text-sm">
                                    {pendingMemberships} membresías requieren atención
                                </span>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-warning-foreground hover:bg-warning/20 rounded-xl">
                                <Link to="/admin/memberships/pending">
                                    Ver <ChevronRight className="ml-1 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    )}

                    {/* ═══ KPIs — with flow effects ═══ */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
                        {[
                            {
                                title: 'Clases Hoy',
                                value: stats?.scheduledClasses || 0,
                                subtitle: 'programadas',
                                icon: Calendar,
                                color: 'bg-essenza-gold/10 text-essenza-gold',
                                border: 'border-essenza-gold/20',
                                glow: 'hover:shadow-[0_8px_30px_rgba(201,169,110,0.12)]',
                            },
                            {
                                title: 'Reservas',
                                value: stats?.confirmedBookings || 0,
                                subtitle: 'confirmadas',
                                icon: Users,
                                color: 'bg-essenza-flow/10 text-essenza-flowDeep',
                                border: 'border-essenza-flow/20',
                                glow: 'hover:shadow-[0_8px_30px_rgba(155,181,204,0.15)]',
                            },
                            {
                                title: 'Membresías Activas',
                                value: stats?.activeMemberships || 0,
                                subtitle: 'clientes activos',
                                icon: CheckCircle2,
                                color: 'bg-essenza-sage/10 text-essenza-sage',
                                border: 'border-essenza-sage/20',
                                glow: 'hover:shadow-[0_8px_30px_rgba(143,174,148,0.15)]',
                            },
                            {
                                title: 'Ingresos Hoy',
                                value: `$${stats?.revenue?.toLocaleString() || '0'}`,
                                subtitle: 'hoy',
                                subtitleIcon: TrendingUp,
                                icon: CreditCard,
                                color: 'bg-violet-500/10 text-violet-600',
                                border: 'border-violet-500/20',
                                glow: 'hover:shadow-[0_8px_30px_rgba(139,92,246,0.12)]',
                            },
                        ].map((kpi) => (
                            <Card key={kpi.title} className={`border ${kpi.border} ${kpi.glow} hover-float transition-all duration-500`}>
                                <CardContent className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-medium text-muted-foreground font-body">{kpi.title}</span>
                                        <div className={`h-9 w-9 rounded-xl ${kpi.color} flex items-center justify-center transition-transform duration-500 hover:scale-110`}>
                                            <kpi.icon className="h-4.5 w-4.5" />
                                        </div>
                                    </div>
                                    {statsLoading ? (
                                        <Skeleton className="h-9 w-20" />
                                    ) : (
                                        <div className="text-3xl font-bold font-heading tracking-tight animate-fade-in">
                                            {kpi.value}
                                        </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 font-body">
                                        {kpi.subtitleIcon && <kpi.subtitleIcon className="h-3 w-3 text-emerald-500" />}
                                        {kpi.subtitle}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* ═══ Recent Memberships ═══ */}
                        <Card className="border-border/60 hover:shadow-md transition-all duration-500 hover:border-essenza-gold/20">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-heading">Membresías Recientes</CardTitle>
                                        <CardDescription className="font-body">Últimas asignaciones y cambios</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" className="rounded-xl font-body hover:border-essenza-gold/40 transition-colors" asChild>
                                        <Link to="/admin/memberships">Ver todas</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {membershipsLoading ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <div key={i} className="flex items-center gap-4 p-3">
                                                <Skeleton className="h-10 w-10 rounded-xl" />
                                                <div className="space-y-2 flex-1">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Skeleton className="h-3 w-20" />
                                                </div>
                                            </div>
                                        ))
                                    ) : recentMemberships.length > 0 ? (
                                        recentMemberships.map((membership, i) => (
                                            <div
                                                key={membership.id}
                                                className="flex items-start gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"
                                                style={{ animationDelay: `${i * 80}ms` }}
                                            >
                                                <div className="h-9 w-9 rounded-xl bg-essenza-gold/10 flex items-center justify-center mt-0.5 shrink-0">
                                                    <UserPlus className="h-4 w-4 text-essenza-gold" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold font-body">{membership.user_name}</p>
                                                    <p className="text-xs text-muted-foreground font-body">
                                                        {membership.plan_name} •{' '}
                                                        <span className={
                                                            membership.status === 'active' ? 'text-essenza-sage font-medium' :
                                                                membership.status === 'pending_payment' ? 'text-warning' :
                                                                    'text-muted-foreground'
                                                        }>
                                                            {membership.status === 'active' ? 'Activa' :
                                                                membership.status === 'pending_payment' ? 'Pendiente Pago' :
                                                                    membership.status === 'pending_activation' ? 'Pendiente Activación' :
                                                                        membership.status}
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground whitespace-nowrap font-body">
                                                    {new Date(membership.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 text-muted-foreground">
                                            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm font-body">No hay actividad reciente</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ═══ Payments to verify ═══ */}
                        <Card className="border-border/60 hover:shadow-md transition-all duration-500 hover:border-essenza-flow/20">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg font-heading">Pagos Pendientes</CardTitle>
                                        <CardDescription className="font-body">Pagos por verificar o cobrar</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" className="rounded-xl font-body hover:border-essenza-gold/40 transition-colors" asChild>
                                        <Link to="/admin/orders">Ver todos</Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {ordersLoading ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <div key={i} className="flex items-center gap-4 p-3">
                                                <Skeleton className="h-10 w-10 rounded-xl" />
                                                <div className="space-y-2 flex-1">
                                                    <Skeleton className="h-4 w-40" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                        ))
                                    ) : (pendingVerificationOrders.length > 0 || pendingEventRegs.length > 0) ? (
                                        <>
                                        {pendingVerificationOrders.slice(0, 5).map((order, i) => (
                                            <Link
                                                key={order.id}
                                                to="/admin/orders"
                                                className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-sm"
                                                style={{ animationDelay: `${i * 80}ms` }}
                                            >
                                                <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center mt-0.5 shrink-0">
                                                    <Receipt className="h-4 w-4 text-warning" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold font-body group-hover:text-essenza-gold transition-colors">
                                                        {order.user_name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-body">
                                                        {order.plan_name} • ${Number(order.total).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <Badge variant="outline" className={`text-[10px] rounded-lg ${order.status === 'pending_verification' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-essenza-sage/10 text-essenza-sage border-essenza-sage/30'}`}>
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {order.status === 'pending_verification' ? 'Verificar' : 'Por cobrar'}
                                                    </Badge>
                                                    <p className="text-[11px] text-muted-foreground mt-1 font-body">
                                                        {format(parseISO(order.created_at), "d MMM", { locale: es })}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                        {pendingEventRegs.slice(0, 5).map((reg: any, i: number) => (
                                            <Link
                                                key={reg.id}
                                                to="/admin/events"
                                                className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-sm"
                                                style={{ animationDelay: `${i * 80}ms` }}
                                            >
                                                <div className="h-9 w-9 rounded-xl bg-pink-500/10 flex items-center justify-center mt-0.5 shrink-0">
                                                    <Ticket className="h-4 w-4 text-pink-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold font-body group-hover:text-essenza-gold transition-colors">
                                                        {reg.user_name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground font-body">
                                                        {reg.event_title} • ${Number(reg.amount).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <Badge variant="outline" className="text-[10px] rounded-lg bg-pink-500/10 text-pink-600 border-pink-300">
                                                        <Ticket className="h-3 w-3 mr-1" />
                                                        Evento
                                                    </Badge>
                                                    <p className="text-[11px] text-muted-foreground mt-1 font-body">
                                                        {format(parseISO(reg.created_at), "d MMM", { locale: es })}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 text-center">
                                            <div className="h-14 w-14 rounded-2xl bg-essenza-sage/10 flex items-center justify-center mb-3 animate-breathe">
                                                <CheckCircle2 className="h-7 w-7 text-essenza-sage" />
                                            </div>
                                            <p className="text-sm font-semibold font-body">
                                                ¡Todo al día!
                                            </p>
                                            <p className="text-xs text-muted-foreground font-body mt-1">
                                                No hay pagos pendientes de verificar 🎉
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                {/* ═══ Birthdays this month ═══ */}
                {birthdays.length > 0 && (
                    <Card className="rounded-2xl border-pink-200/50 bg-gradient-to-br from-pink-50/50 to-orange-50/30 hover:shadow-md transition-all duration-500">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-heading flex items-center gap-2">
                                <div className="h-8 w-8 rounded-xl bg-pink-500/10 flex items-center justify-center animate-float-slow">
                                    <Cake className="h-4 w-4 text-pink-500" />
                                </div>
                                Cumpleaños del mes
                                <Badge variant="secondary" className="ml-auto text-xs rounded-lg bg-pink-100 text-pink-700">
                                    {birthdays.length}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {birthdays.map((b: any) => {
                                    const bday = new Date(b.date_of_birth);
                                    const day = bday.getUTCDate();
                                    const today = new Date();
                                    const isToday = day === today.getDate();
                                    const isPast = day < today.getDate();

                                    return (
                                        <Link
                                            key={b.id}
                                            to={`/admin/members/${b.id}`}
                                            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5 ${
                                                isToday
                                                    ? 'bg-pink-100 border border-pink-300 ring-2 ring-pink-200 breathe-glow'
                                                    : isPast
                                                    ? 'bg-white/50 border border-border/30 opacity-60'
                                                    : 'bg-white/80 border border-border/40 hover:border-pink-200'
                                            }`}
                                        >
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                                isToday ? 'bg-pink-500 text-white animate-breathe' : 'bg-pink-100 text-pink-600'
                                            }`}>
                                                {day}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold truncate">{b.display_name}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {isToday ? '🎉 ¡Hoy cumple años!' : `${day} de ${format(bday, 'MMMM', { locale: es })}`}
                                                </p>
                                            </div>
                                            {isToday && <span className="text-lg">🎂</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
                </div>
            </AdminLayout>
        </AuthGuard>
    );
}
