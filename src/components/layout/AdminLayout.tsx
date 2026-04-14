import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LayoutDashboard,
    Calendar,
    Users,
    CreditCard,
    Gift,
    Settings,
    Dumbbell,
    UserCog,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Menu,
    Bell,
    Search,
    ClipboardList,
    BadgeCheck,
    TrendingUp,
    Building2,
    RefreshCcw,
    DollarSign,
    CalendarCheck,
    UserPlus,
    Video,
    PartyPopper,
    Tag,
    ShoppingBag,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminBreadcrumbs } from '@/components/layout/AdminBreadcrumbs';
import api from '@/lib/api';

interface AdminLayoutProps {
    children: ReactNode;
}

const sidebarItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/events', label: 'Eventos', icon: PartyPopper },
    { href: '/admin/discount-codes', label: 'Descuentos', icon: Tag },
    { href: '/admin/calendar', label: 'Calendario', icon: Calendar },
    {
        label: 'Reservas',
        icon: ClipboardList,
        children: [
            { href: '/admin/bookings', label: 'Todas las Reservas' },
            { href: '/admin/bookings/waitlist', label: 'Lista de Espera' },
            { href: '/admin/bookings/partners-checkins', label: 'Check-ins Partners' },
        ],
    },
    {
        label: 'Clases',
        icon: Dumbbell,
        children: [
            { href: '/admin/classes/schedules', label: 'Horarios' },
            { href: '/admin/classes/types', label: 'Tipos de Clase' },
            { href: '/admin/classes/templates', label: 'Plantillas de Rutinas' },
        ],
    },
    {
        label: 'Miembros',
        icon: Users,
        children: [
            { href: '/admin/members', label: 'Todos los Miembros' },
        ],
    },
    { href: '/admin/memberships', label: 'Membresías', icon: BadgeCheck },
    { href: '/admin/instructors', label: 'Instructores', icon: UserCog },
    {
        label: 'Videos',
        icon: Video,
        children: [
            { href: '/admin/videos', label: 'Biblioteca' },
            { href: '/admin/videos/upload', label: 'Subir Video' },
            { href: '/admin/videos/sales', label: 'Ventas por Transferencia' },
        ],
    },
    { href: '/admin/pos', label: 'Punto de Venta', icon: ShoppingBag },
    { href: '/admin/payments', label: 'Pagos', icon: CreditCard },
    {
        label: 'Lealtad',
        icon: Gift,
        children: [
            { href: '/admin/loyalty/config', label: 'Configuración' },
            { href: '/admin/loyalty/rewards', label: 'Recompensas' },
            { href: '/admin/loyalty/redemptions', label: 'Canjes' },
            { href: '/admin/loyalty/adjust', label: 'Ajustes' },
        ],
    },
    {
        label: 'Reportes',
        icon: TrendingUp,
        children: [
            { href: '/admin/reports/overview', label: 'Overview' },
            { href: '/admin/reports/classes', label: 'Clases' },
            { href: '/admin/reports/revenue', label: 'Ingresos' },
            { href: '/admin/reports/retention', label: 'Retención' },
            { href: '/admin/reports/instructors', label: 'Instructores' },
            { href: '/admin/reports/egresos', label: 'Egresos' },
            { href: '/admin/migrations/history', label: 'Historial de Inscripciones' },
        ],
    },
    {
        label: 'Configuración',
        icon: Settings,
        children: [
            { href: '/admin/settings/general', label: 'General' },
            { href: '/admin/settings/studio', label: 'Estudio' },
            { href: '/admin/settings/payments', label: 'Pagos' },
            { href: '/admin/settings/platforms', label: 'Plataformas' },
            { href: '/admin/settings/policies', label: 'Políticas' },
            { href: '/admin/settings/notifications', label: 'Notificaciones' },
            { href: '/admin/settings/whatsapp', label: 'WhatsApp' },
            { href: '/admin/settings/closed-days', label: 'Días Cerrados' },
        ],
    },
];

export function AdminLayout({ children }: AdminLayoutProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifOpen, setNotifOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    // Prevent background scroll/jump when mobile menu is open
    useEffect(() => {
        if (!mobileMenuOpen) return;
        if (window.matchMedia('(min-width: 768px)').matches) return;

        const body = document.body;
        const html = document.documentElement;
        const scrollY = window.scrollY;

        const prev = {
            bodyOverflow: body.style.overflow,
            bodyPosition: body.style.position,
            bodyTop: body.style.top,
            bodyLeft: body.style.left,
            bodyRight: body.style.right,
            bodyWidth: body.style.width,
            htmlOverflow: html.style.overflow,
        };

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = '0';
        body.style.right = '0';
        body.style.width = '100%';

        return () => {
            html.style.overflow = prev.htmlOverflow;
            body.style.overflow = prev.bodyOverflow;
            body.style.position = prev.bodyPosition;
            body.style.top = prev.bodyTop;
            body.style.left = prev.bodyLeft;
            body.style.right = prev.bodyRight;
            body.style.width = prev.bodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, [mobileMenuOpen]);

    // Fetch notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const { data } = await api.get('/admin/notifications');
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            } catch {
                // silently fail
            }
        };
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleExpand = (label: string) => {
        setExpandedItems((prev) =>
            prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
        );
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getTimeAgo = (date: Date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'ahora';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    };

    const isActive = (href: string) =>
        location.pathname === href || location.pathname.startsWith(`${href}/`);
    const isParentActive = (children: { href: string }[]) =>
        children.some((child) =>
            location.pathname === child.href || location.pathname.startsWith(`${child.href}/`)
        );

    const SidebarContent = () => (
        <div className="h-full overflow-y-auto overflow-x-hidden py-4">
            <div className="space-y-1 px-3">
                {sidebarItems.map((item) => {
                    const Icon = item.icon;

                    if ('children' in item) {
                        const isExpanded = expandedItems.includes(item.label);
                        const hasActiveChild = isParentActive(item.children);

                        return (
                            <div key={item.label}>
                                    <button
                                    onClick={() => toggleExpand(item.label)}
                                    className={cn(
                                        'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                        hasActiveChild
                                            ? 'bg-essenza-gold/10 text-essenza-gold'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className="h-5 w-5" />
                                        {!sidebarCollapsed && <span>{item.label}</span>}
                                    </div>
                                    {!sidebarCollapsed && (
                                        <ChevronRight
                                            className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')}
                                        />
                                    )}
                                </button>
                                {isExpanded && !sidebarCollapsed && (
                                    <div className="ml-8 mt-1 space-y-1">
                                        {item.children.map((child) => (
                                            <Link
                                                key={child.href}
                                                to={child.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={cn(
                                                    'block rounded-xl px-3 py-2 text-sm transition-all duration-200',
                                                    isActive(child.href)
                                                        ? 'bg-essenza-gold/10 text-essenza-gold font-medium'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                )}
                                            >
                                                {child.label}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={item.href}
                            to={item.href!}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                isActive(item.href!)
                                    ? 'bg-essenza-gold/10 text-essenza-gold'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {!sidebarCollapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 hidden md:flex flex-col border-r bg-card transition-all duration-300',
                    sidebarCollapsed ? 'w-16' : 'w-64'
                )}
            >
                {/* Sidebar Header */}
                <div className="flex h-16 items-center justify-between border-b px-4">
                    {!sidebarCollapsed && (
                        <Link to="/admin/dashboard" className="flex items-center space-x-2.5">
                            <img
                                src="/essenza.jpg"
                                alt="Essenza del Flusso"
                                className="h-9 w-9 rounded-xl object-cover ring-2 ring-essenza-gold/20"
                            />
                            <div className="flex flex-col">
                                <span className="font-heading text-lg font-bold text-essenza-gold leading-none">Essenza</span>
                                <span className="font-body text-[10px] uppercase tracking-[2px] text-muted-foreground">Admin</span>
                            </div>
                        </Link>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="h-8 w-8"
                    >
                        {sidebarCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronLeft className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                {/* Sidebar Navigation */}
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-[60] flex w-72 flex-col border-r bg-card transition-transform duration-300 ease-out md:hidden shadow-2xl',
                    mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex h-16 items-center justify-between border-b px-4">
                    <Link to="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center space-x-2">
                        <img
                            src="/essenza.jpg"
                            alt="Essenza del Flusso"
                            className="h-8 w-8 rounded-full object-cover"
                        />
                        <div className="flex flex-col">
                            <span className="font-heading text-lg font-bold text-essenza-olive leading-none">Essenza</span>
                            <span className="font-heading text-xs text-muted-foreground">Admin</span>
                        </div>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                <SidebarContent />
            </aside>

            {/* Main Content Area */}
            <div
                className={cn(
                    'flex flex-1 flex-col transition-all duration-300',
                    sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'
                )}
            >
                {/* Top Header */}
                <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
                    {/* Mobile Menu Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden h-10 w-10"
                        onClick={() => setMobileMenuOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    {/* Search */}
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="Buscar clientes, clases..."
                                className="h-9 w-full rounded-xl border border-input bg-muted/30 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-essenza-gold/30 focus:border-essenza-gold/40 transition-all font-body"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notifications Popover */}
                        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-96 p-0" align="end">
                                <div className="flex items-center justify-between px-4 py-3 border-b">
                                    <h4 className="font-semibold text-sm">Actividad Reciente</h4>
                                    <span className="text-xs text-muted-foreground">{unreadCount} nuevas (24h)</span>
                                </div>
                                <ScrollArea className="h-[380px]">
                                    {notifications.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                            <Bell className="h-8 w-8 mb-2 opacity-40" />
                                            <p className="text-sm">Sin actividad reciente</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {notifications.map((n: any) => {
                                                const isRecent = new Date(n.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);
                                                const icon = n.type === 'payment' ? (
                                                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                                                        <DollarSign className="h-4 w-4 text-success" />
                                                    </div>
                                                ) : n.type === 'membership' ? (
                                                    <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center shrink-0">
                                                        <UserPlus className="h-4 w-4 text-info" />
                                                    </div>
                                                ) : (
                                                    <div className="h-8 w-8 rounded-full bg-essenza-olive/10 flex items-center justify-center shrink-0">
                                                        <CalendarCheck className="h-4 w-4 text-essenza-olive" />
                                                    </div>
                                                );

                                                const label = n.type === 'payment'
                                                    ? `Pago de $${parseFloat(n.title).toLocaleString('es-MX')} (${n.detail})`
                                                    : n.type === 'membership'
                                                        ? `Membresía "${n.title}" — ${n.detail}`
                                                        : `Reserva: ${n.title}`;

                                                const timeAgo = getTimeAgo(new Date(n.created_at));

                                                return (
                                                    <div
                                                        key={`${n.type}-${n.id}`}
                                                        className={cn(
                                                            "flex items-start gap-3 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors",
                                                            isRecent && "bg-essenza-olive/5"
                                                        )}
                                                        onClick={() => {
                                                            setNotifOpen(false);
                                                            if (n.user_id) navigate(`/admin/members/${n.user_id}`);
                                                        }}
                                                    >
                                                        {icon}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{n.user_name}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{label}</p>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">{timeAgo}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>
                            </PopoverContent>
                        </Popover>

                        {/* User Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                    <Avatar className="h-9 w-9 ring-2 ring-offset-2 ring-offset-background ring-essenza-olive/20">
                                        <AvatarImage src={user?.photo_url || undefined} alt={user?.display_name} />
                                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                            {user?.display_name ? getInitials(user.display_name) : 'A'}
                                        </AvatarFallback>
                                    </Avatar>
                                    {user?.is_instructor && (
                                        <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success border-2 border-background flex items-center justify-center">
                                            <Dumbbell className="h-2.5 w-2.5 text-white" />
                                        </span>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex items-center gap-3 py-1">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user?.photo_url || undefined} alt={user?.display_name} />
                                            <AvatarFallback className="bg-primary text-primary-foreground">
                                                {user?.display_name ? getInitials(user.display_name) : 'A'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user?.display_name}</p>
                                            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="inline-flex items-center rounded-md bg-essenza-olive/10 px-2 py-0.5 text-xs font-medium text-essenza-olive capitalize">
                                                    {user?.role}
                                                </span>
                                                {user?.is_instructor && (
                                                    <span className="inline-flex items-center rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                                                        <Dumbbell className="mr-1 h-3 w-3" />
                                                        Coach
                                                    </span>
                                                )}
                                            </div>
                                            {user?.coach_number && (
                                                <p className="text-xs text-muted-foreground font-mono">{user.coach_number}</p>
                                            )}
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {user?.is_instructor && (
                                    <>
                                        <DropdownMenuItem asChild>
                                            <Link to="/admin/calendar" className="cursor-pointer">
                                                <Calendar className="mr-2 h-4 w-4" />
                                                <span>Mis Clases</span>
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <DropdownMenuItem asChild>
                                    <Link to="/admin/settings/general" className="cursor-pointer">
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Configuración</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Cerrar Sesión</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 md:p-6">
                    <div className="mb-4">
                        <AdminBreadcrumbs />
                    </div>
                    {children}
                </main>
            </div>
        </div>
    );
}
