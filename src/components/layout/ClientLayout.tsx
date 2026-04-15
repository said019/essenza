import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
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

const bottomNavItems = [
    { href: '/app', label: 'Home', icon: LayoutDashboard },
    { href: '/app/book', label: 'Reservar', icon: Calendar },
    { href: '/app/classes', label: 'Clases', icon: ClipboardList },
    { href: '/app/wallet', label: 'Wallet', icon: Gift },
    { href: '/app/profile', label: 'Perfil', icon: User },
];

export function ClientLayout({ children }: ClientLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name: string) =>
        name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="min-h-screen bg-surface text-on-surface pb-32">
            {/* ═══ Top App Bar — blurred, transparent ═══ */}
            <header
                className="fixed top-0 w-full z-50 bg-surface/70 backdrop-blur-xl transition-colors duration-300"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="flex justify-between items-center px-6 py-4 w-full max-w-7xl mx-auto">
                    <Link to="/app" className="flex items-center gap-3">
                        <img
                            src="/essenza-logo.jpeg"
                            alt=""
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-primary/20"
                        />
                        <span className="font-headline text-lg font-semibold text-primary tracking-tight hidden sm:inline">
                            Essenza del Flusso
                        </span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <Link
                            to="/app/notifications"
                            aria-label="Notificaciones"
                            className="p-2 rounded-full text-on-surface/60 hover:text-primary hover:scale-105 transition-all"
                        >
                            <Bell className="h-5 w-5" />
                        </Link>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    aria-label="Menú de cuenta"
                                    className="relative h-9 w-9 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                                >
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user?.photo_url || undefined} alt={user?.display_name} />
                                        <AvatarFallback className="bg-primary text-white font-semibold text-sm">
                                            {user?.display_name ? getInitials(user.display_name) : 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user?.display_name}</p>
                                        <p className="text-xs leading-none text-essenza-secondary">{user?.email}</p>
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
                                        <Receipt className="mr-2 h-4 w-4" />
                                        <span>Mis Órdenes</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to="/app/videos" className="cursor-pointer">
                                        <Play className="mr-2 h-4 w-4" />
                                        <span>Videos</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link to="/app/events" className="cursor-pointer">
                                        <PartyPopper className="mr-2 h-4 w-4" />
                                        <span>Eventos</span>
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
                </div>
            </header>

            {/* ═══ Main Content ═══ */}
            <main className="pt-24 px-6 max-w-2xl mx-auto">{children}</main>

            {/* ═══ Bottom Nav — rounded, blurred ═══ */}
            <nav
                className="fixed bottom-0 left-0 w-full z-50 rounded-t-[2rem] bg-surface/80 backdrop-blur-2xl shadow-[0px_-20px_40px_rgba(175,139,59,0.08)] border-t border-essenza-outlineVariant/30"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
                <div className="flex justify-around items-center px-4 pt-2 pb-3 w-full max-w-2xl mx-auto">
                    {bottomNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            location.pathname === item.href ||
                            (item.href !== '/app' && location.pathname.startsWith(`${item.href}/`));
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={cn(
                                    'flex flex-col items-center justify-center min-w-[56px] transition-all duration-300 ease-out relative',
                                    isActive ? 'text-primary scale-110' : 'text-on-surface/50 hover:text-primary'
                                )}
                            >
                                <div
                                    className={cn(
                                        'flex items-center justify-center rounded-full p-2.5 transition-all',
                                        isActive ? 'bg-primary/10' : 'hover:bg-primary/5'
                                    )}
                                >
                                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className="text-[10px] font-medium tracking-wide mt-0.5">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
