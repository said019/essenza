import { useEffect, useState } from 'react';
import { Smartphone, Share, PlusSquare, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Platform = 'ios' | 'android' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectPlatform(): Platform {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
}

function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

export function InstallAppCard() {
    const [platform, setPlatform] = useState<Platform>('desktop');
    const [installed, setInstalled] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [expanded, setExpanded] = useState<'ios' | 'android' | null>(null);

    useEffect(() => {
        setPlatform(detectPlatform());
        setInstalled(isStandalone());

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);

        const onInstalled = () => setInstalled(true);
        window.addEventListener('appinstalled', onInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const handleAndroidInstall = async () => {
        if (!deferredPrompt) {
            setExpanded('android');
            return;
        }
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setInstalled(true);
        setDeferredPrompt(null);
    };

    if (installed) {
        return (
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">App instalada</p>
                    <p className="text-xs text-muted-foreground">Ya estás usando Essenza desde la pantalla de inicio</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] p-5 space-y-4">
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white shadow-sm shadow-primary/10 border border-primary/10 flex items-center justify-center overflow-hidden">
                    <img src="/essenza-192.png" alt="" className="h-10 w-10 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-heading font-semibold text-foreground">Instalar Essenza</p>
                    <p className="text-xs text-muted-foreground leading-tight">Abre la app con un toque desde tu celular</p>
                </div>
                <Smartphone className="h-5 w-5 text-primary/60 flex-shrink-0" />
            </div>

            {platform === 'android' && (
                <Button
                    type="button"
                    onClick={handleAndroidInstall}
                    className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-transform"
                >
                    <Download className="mr-2 h-4 w-4" />
                    {deferredPrompt ? 'Instalar app' : 'Ver cómo instalar'}
                </Button>
            )}

            {platform === 'ios' && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => (v === 'ios' ? null : 'ios'))}
                    className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                    <Download className="h-4 w-4" />
                    {expanded === 'ios' ? 'Ocultar instrucciones' : 'Cómo instalar en iPhone'}
                </button>
            )}

            {platform === 'desktop' && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => (v === 'ios' ? null : 'ios'))}
                        className={`rounded-xl border text-xs font-semibold py-2.5 px-3 transition-colors ${
                            expanded === 'ios'
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-primary/20 bg-white text-foreground hover:border-primary/40'
                        }`}
                    >
                        iPhone / iPad
                    </button>
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => (v === 'android' ? null : 'android'))}
                        className={`rounded-xl border text-xs font-semibold py-2.5 px-3 transition-colors ${
                            expanded === 'android'
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-primary/20 bg-white text-foreground hover:border-primary/40'
                        }`}
                    >
                        Android
                    </button>
                </div>
            )}

            {expanded === 'ios' && (
                <ol className="space-y-2 rounded-xl bg-white/60 border border-primary/10 p-3 text-xs text-foreground/80 leading-relaxed">
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">1.</span>
                        <span>Abre esta página en <strong>Safari</strong> (no Chrome)</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">2.</span>
                        <span>Toca el botón <Share className="inline h-3.5 w-3.5 -mt-0.5 text-primary" /> <strong>Compartir</strong> en la barra inferior</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">3.</span>
                        <span>Desplázate y toca <strong>"Agregar a pantalla de inicio"</strong></span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">4.</span>
                        <span>Confirma con <strong>Agregar</strong> — el ícono aparecerá como app</span>
                    </li>
                </ol>
            )}

            {expanded === 'android' && !deferredPrompt && (
                <ol className="space-y-2 rounded-xl bg-white/60 border border-primary/10 p-3 text-xs text-foreground/80 leading-relaxed">
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">1.</span>
                        <span>Abre el menú <PlusSquare className="inline h-3.5 w-3.5 -mt-0.5 text-primary" /> de tu navegador (Chrome)</span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">2.</span>
                        <span>Toca <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla"</strong></span>
                    </li>
                    <li className="flex gap-2">
                        <span className="font-semibold text-primary">3.</span>
                        <span>Confirma — el ícono de Essenza aparecerá en tu inicio</span>
                    </li>
                </ol>
            )}
        </div>
    );
}
