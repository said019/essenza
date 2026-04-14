import { ReactNode, useState } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    LayoutDashboard,
    Calendar,
    ClipboardList,
    Gift,
    User,
    LogOut,
    Menu,
    X,
    Bell,
    Play,
    PartyPopper,
    ShoppingBag,
    Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientLayoutProps {
    children: ReactNode;
}

const navItems = [
    { href: '/app', label: 'Inicio', icon: LayoutDashboard },
    { href: '/app/book', label: 'Reservar', icon: Calendar },
    { href: '/app/classes', label: 'Mis Clases', icon: ClipboardList },
    { href: '/app/orders', label: 'Mis Órdenes', icon: Receipt },
    { href: '/app/checkout', label: 'Comprar', icon: ShoppingBag },
    { href: '/app/events', label: 'Eventos', icon: PartyPopper },
    { href: '/app/videos', label: 'Videos', icon: Play },
    { href: '/app/wallet', label: 'Wallet', icon: Gift },
];

// Bottom nav: only 5 most important items for mobile
const bottomNavItems = [
    { href: '/app', label: 'Inicio', icon: LayoutDashboard },
    { href: '/app/book', label: 'Reservar', icon: Calendar },
    { href: '/app/checkout', label: 'Comprar', icon: ShoppingBag },
    { href: '/app/classes', label: 'Clases', icon: ClipboardList },
    { href: '/app/wallet', label: 'Wallet', icon: Gift },
];

export function ClientLayout({ children }: ClientLayoutProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Top Header */}
            <header className="sticky z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ top: '0', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
                <div className="container flex h-16 items-center justify-between">
                    {/* Logo */}
                    <Link to="/app" className="flex items-center space-x-3">
                        <img 
                            src="/essenza.jpg" 
                            alt="Essenza del Flusso" 
                            className="h-8 w-8 rounded-full object-cover"
                        />
                        <div className="flex items-baseline space-x-1">
                            <span className="font-heading text-xl font-bold text-primary">Essenza</span>
                            <span className="font-heading text-sm text-muted-foreground">Studio</span>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-6">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    className={cn(
                                        'flex items-center space-x-1 text-sm font-medium transition-colors hover:text-primary',
                                        isActive ? 'text-primary' : 'text-muted-foreground'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Menu */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild>
                            <Link to="/app/notifications" aria-label="Notificaciones">
                                <Bell className="h-5 w-5" />
                            </Link>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user?.photo_url || undefined} alt={user?.display_name} />
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            {user?.display_name ? getInitials(user.display_name) : 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user?.display_name}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link to="/app/profile" className="cursor-pointer">
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Mi Perfil</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to="/app/orders" className="cursor-pointer">
                                        <ClipboardList className="mr-2 h-4 w-4" />
                                        <span>Mis Órdenes</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Cerrar Sesión</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Mobile Menu Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {mobileMenuOpen && (
                    <nav className="md:hidden border-t bg-background p-4">
                        <div className="flex flex-col space-y-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                                return (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                            'flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                            isActive
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                )}
            </header>

            {/* Main Content */}
            <main className="container py-6">{children}</main>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="flex items-center justify-around py-1.5 px-1">
                    {bottomNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    'flex flex-col items-center gap-0.5 min-w-[56px] py-2 text-[10px] font-medium transition-all duration-200 rounded-xl relative active:scale-95',
                                    isActive ? 'text-essenza-gold' : 'text-muted-foreground'
                                )}
                            >
                                <div className={cn(
                                    'p-1.5 rounded-xl transition-all duration-200',
                                    isActive ? 'bg-essenza-gold/10 scale-110' : ''
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <span className="font-body">{item.label}</span>
                                {isActive && (
                                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-essenza-gold" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Spacer for mobile bottom nav — accounts for safe-area */}
            <div className="md:hidden" style={{ height: 'calc(80px + env(safe-area-inset-bottom, 0px))' }} />
        </div>
    );
}
