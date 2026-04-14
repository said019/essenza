import { useState, useEffect, useRef } from "react";
import { Menu, X, User, Wallet, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface Membership {
  classes_remaining: number | null;
  plan_name: string;
}

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch créditos del usuario (polling cada 30 segundos)
  const { data: membership } = useQuery<Membership | null>({
    queryKey: ['membership', user?.id],
    queryFn: async () => {
      try {
        const response = await api.get('/memberships/me');
        return response.data;
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock background scroll without visual jump
  useEffect(() => {
    if (!isMobileMenuOpen) return;

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
  }, [isMobileMenuOpen]);

  const navLinks = [
    { label: "Clases", href: "#clases" },
    { label: "Videos", href: "#videos" },
    { label: "Horarios", href: "#horarios" },
    { label: "Instructores", href: "#instructores" },
    { label: "Precios", href: "#precios" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-sm py-3"
          : "bg-gradient-to-b from-black/40 to-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4 lg:px-8">
        <nav className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3">
            <img 
              src="/essenza.jpg" 
              alt="Essenza del Flusso" 
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="flex flex-col">
              <span className={`font-heading text-xl md:text-2xl font-semibold tracking-tight leading-none transition-colors duration-500 ${
                isScrolled ? 'text-foreground' : 'text-white'
              }`}>
                Essenza
              </span>
              <span className={`text-[10px] font-body tracking-[0.2em] uppercase transition-colors duration-500 ${
                isScrolled ? 'text-muted-foreground' : 'text-white/60'
              }`}>
                Studio
              </span>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-body transition-colors duration-300 tracking-wide ${
                  isScrolled
                    ? 'text-foreground/80 hover:text-foreground'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated && membership && (
              <Link to="/app/my-bookings">
                <Badge 
                  variant={
                    membership.classes_remaining !== null && membership.classes_remaining <= 2 
                      ? "destructive" 
                      : "secondary"
                  }
                  className="cursor-pointer hover:opacity-80 transition-opacity px-3 py-1.5 gap-2"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    {membership.classes_remaining === null 
                      ? 'Ilimitado' 
                      : `${membership.classes_remaining} créditos`
                    }
                  </span>
                </Badge>
              </Link>
            )}

            <a
              href="#wallet"
              className={`flex items-center gap-2 text-sm font-body transition-colors ${
                isScrolled ? 'text-foreground/80 hover:text-foreground' : 'text-white/80 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>WalletClub</span>
            </a>

            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild className={isScrolled ? '' : 'text-white hover:text-white hover:bg-white/10'}>
                  <Link to="/app">
                    <User className="w-4 h-4 mr-2" />
                    Hola, {user?.display_name?.split(' ')[0]}
                  </Link>
                </Button>
                <Button variant="hero" size="lg" asChild className="bg-essenza-olive hover:bg-essenza-olive/90">
                  <a href="#horarios">Reservar Ahora</a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="icon" asChild className={isScrolled ? '' : 'text-white hover:text-white hover:bg-white/10'}>
                  <Link to="/login" aria-label="Iniciar sesión">
                    <User className="w-5 h-5" />
                  </Link>
                </Button>
                <Button variant="hero" size="lg" asChild className="bg-essenza-olive hover:bg-essenza-olive/90">
                  <Link to="/login">Iniciar Sesión</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle — 44px min touch */}
          <button
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl active:scale-95 transition-transform"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isMobileMenuOpen ? (
              <X className={`w-6 h-6 ${isScrolled ? 'text-foreground' : 'text-white'}`} />
            ) : (
              <Menu className={`w-6 h-6 ${isScrolled ? 'text-foreground' : 'text-white'}`} />
            )}
          </button>
        </nav>
      </div>

      {/* Mobile Menu — slide down with backdrop */}
      <div
        className={`lg:hidden fixed inset-0 top-0 z-[60] transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Menu panel */}
        <div
          ref={menuRef}
          className={`absolute top-0 right-0 w-[85%] max-w-sm h-full bg-[#717f9b] shadow-2xl transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Close button */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <img src="/essenza.jpg" alt="Essenza" className="h-8 w-8 rounded-full object-cover" />
              <span className="font-heading text-lg font-semibold text-white">Essenza</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Auth state — show user info or login prompt */}
          <div className="px-6 mb-4">
            {isAuthenticated ? (
              <Link
                to="/app"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/10 active:bg-white/15 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.display_name || 'Mi cuenta'}
                  </p>
                  {membership && (
                    <p className="text-xs text-white/60 flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      {membership.classes_remaining === null 
                        ? 'Clases ilimitadas' 
                        : `${membership.classes_remaining} créditos`
                      }
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/10 active:bg-white/15 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Iniciar Sesión</p>
                  <p className="text-xs text-white/50">Accede a tu cuenta</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </Link>
            )}
          </div>

          {/* Navigation links — larger touch targets */}
          <div className="px-6 space-y-1">
            {navLinks.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center justify-between py-3.5 px-2 text-base font-body text-white/90 hover:text-white active:bg-white/10 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {link.label}
                <ChevronRight className="w-4 h-4 text-white/30" />
              </a>
            ))}
            <a
              href="#wallet"
              className="flex items-center justify-between py-3.5 px-2 text-base font-body text-white/90 hover:text-white active:bg-white/10 rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                WalletClub
              </span>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </a>
          </div>

          {/* CTA at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)' }}>
            <Button 
              variant="hero" 
              size="lg" 
              className="w-full bg-white text-essenza-olive hover:bg-white/90 font-semibold text-base h-12 rounded-xl shadow-lg" 
              asChild
            >
              <a href="#horarios" onClick={() => setIsMobileMenuOpen(false)}>
                Reservar Ahora
              </a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
