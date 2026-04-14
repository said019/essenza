import { useEffect, useState } from 'react';
import { AlertCircle, CreditCard, KeyRound, Loader2, Save, ShieldCheck, Webhook } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import api, { getErrorMessage } from '@/lib/api';

interface MercadoPagoSettings {
    access_token: string;
    public_key: string;
    webhook_secret: string;
    frontend_url: string;
    api_url: string;
    statement_descriptor: string;
    app_id: string;
    client_secret: string;
}

interface MercadoPagoSettingsMeta {
    source: Record<keyof MercadoPagoSettings, 'env' | 'stored' | 'default' | 'missing'>;
    has_env_overrides: boolean;
}

const defaultFrontendUrl = typeof window !== 'undefined' ? window.location.origin : '';
const defaultApiUrl = String(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/i, '');

const defaultSettings: MercadoPagoSettings = {
    access_token: '',
    public_key: '',
    webhook_secret: '',
    frontend_url: defaultFrontendUrl,
    api_url: defaultApiUrl,
    statement_descriptor: 'WALLETCLUB',
    app_id: '',
    client_secret: '',
};

function normalizeBaseUrl(url: string, fallback = '') {
    const value = (url || fallback).trim();
    if (!value) return '';
    return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeStoredSettings(value: unknown): MercadoPagoSettings {
    const raw = value && typeof value === 'object' ? value as Record<string, any> : {};

    return {
        access_token: String(raw.access_token || raw.accessToken || ''),
        public_key: String(raw.public_key || raw.publicKey || ''),
        webhook_secret: String(raw.webhook_secret || raw.webhookSecret || ''),
        frontend_url: String(raw.frontend_url || raw.frontendUrl || defaultFrontendUrl),
        api_url: String(raw.api_url || raw.apiUrl || defaultApiUrl),
        statement_descriptor: String(
            raw.statement_descriptor || raw.statementDescriptor || defaultSettings.statement_descriptor,
        ),
        app_id: String(raw.app_id || raw.appId || ''),
        client_secret: String(raw.client_secret || raw.clientSecret || ''),
    };
}

export default function PaymentGatewaySettings() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<MercadoPagoSettings>(defaultSettings);
    const [settingsMeta, setSettingsMeta] = useState<MercadoPagoSettingsMeta | null>(null);

    useEffect(() => {
        void loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const response = await api.get('/settings/mercadopago_config/effective').catch((error) => {
                if (error?.response?.status === 404) {
                    return null;
                }
                throw error;
            });

            if (response?.data?.value) {
                setSettings((prev) => ({
                    ...prev,
                    ...normalizeStoredSettings(response.data.value),
                }));
                setSettingsMeta(response.data.meta || null);
                return;
            }

            const fallbackResponse = await api.get('/settings/mercadopago_config').catch((error) => {
                if (error?.response?.status === 404) {
                    return null;
                }
                throw error;
            });

            if (fallbackResponse?.data?.value) {
                setSettings((prev) => ({
                    ...prev,
                    ...normalizeStoredSettings(fallbackResponse.data.value),
                }));
                setSettingsMeta(null);
            }
        } catch (error) {
            toast({
                title: 'No se pudo cargar la configuración',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field: keyof MercadoPagoSettings, value: string) => {
        setSettings((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const normalizedFrontendUrl = normalizeBaseUrl(settings.frontend_url, defaultFrontendUrl);
    const normalizedApiUrl = normalizeBaseUrl(settings.api_url, defaultApiUrl).replace(/\/api$/i, '');
    const statementDescriptor = settings.statement_descriptor.trim().slice(0, 22);

    const missingFields = [];
    if (!settings.access_token.trim()) missingFields.push('Access token');
    if (!settings.webhook_secret.trim()) missingFields.push('Webhook secret');

    const webhookUrl = normalizedApiUrl ? `${normalizedApiUrl}/webhooks/mercadopago` : '';
    const successUrl = normalizedFrontendUrl
        ? `${normalizedFrontendUrl}/app/orders/:orderId?provider=mercadopago&checkout=success`
        : '';
    const failureUrl = normalizedFrontendUrl
        ? `${normalizedFrontendUrl}/app/orders/:orderId?provider=mercadopago&checkout=failure`
        : '';
    const pendingUrl = normalizedFrontendUrl
        ? `${normalizedFrontendUrl}/app/orders/:orderId?provider=mercadopago&checkout=pending`
        : '';
    const oauthCallbackUrl = normalizedFrontendUrl
        ? `${normalizedFrontendUrl}/auth/mp/callback`
        : '';

    const handleSave = async () => {
        setSaving(true);

        try {
            const payload: MercadoPagoSettings = {
                access_token: settings.access_token.trim(),
                public_key: settings.public_key.trim(),
                webhook_secret: settings.webhook_secret.trim(),
                frontend_url: normalizedFrontendUrl,
                api_url: normalizedApiUrl,
                statement_descriptor: statementDescriptor || defaultSettings.statement_descriptor,
                app_id: settings.app_id.trim(),
                client_secret: settings.client_secret.trim(),
            };

            await api.put('/settings/mercadopago_config', { value: payload });
            setSettings(payload);
            await loadSettings();

            toast({
                title: 'Configuración guardada',
                description: 'Mercado Pago quedó actualizado en system settings.',
            });
        } catch (error) {
            toast({
                title: 'No se pudo guardar la configuración',
                description: getErrorMessage(error),
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Pagos y Mercado Pago</h1>
                        <p className="text-muted-foreground">
                            Configura el checkout con tarjeta de WalletClub y deja listos los datos base
                            para la siguiente fase de marketplace.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant={missingFields.length === 0 ? 'default' : 'secondary'}>
                            {missingFields.length === 0 ? 'Checkout listo' : 'Configuración incompleta'}
                        </Badge>
                        {settingsMeta?.has_env_overrides && (
                            <Badge variant="secondary">
                                Variables de entorno activas
                            </Badge>
                        )}
                        <Badge variant="outline">
                            {statementDescriptor || defaultSettings.statement_descriptor}
                        </Badge>
                    </div>
                </div>

                <Alert variant={missingFields.length > 0 ? 'destructive' : 'default'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                        {missingFields.length === 0 ? 'Mercado Pago puede procesar pagos' : 'Faltan datos para operar'}
                    </AlertTitle>
                    <AlertDescription>
                        {missingFields.length === 0
                            ? 'El slice actual de Checkout Pro con tarjeta ya tiene los campos mínimos para crear preferencias y validar webhooks.'
                            : `Completa ${missingFields.join(' y ')} para habilitar pagos con tarjeta y confirmación automática por webhook.`}
                        {' '}Las variables de entorno siguen teniendo prioridad sobre lo que guardes aquí.
                    </AlertDescription>
                </Alert>

                {settingsMeta?.has_env_overrides && (
                    <Alert>
                        <ShieldCheck className="h-4 w-4" />
                        <AlertTitle>La app está leyendo Railway antes que system settings</AlertTitle>
                        <AlertDescription>
                            Esta vista ya muestra la configuración efectiva. Si cambias un campo aquí pero existe
                            la misma variable en Railway, seguirá mandando la variable de entorno hasta que la cambies o la elimines.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Checkout activo hoy
                            </CardTitle>
                            <CardDescription>
                                Estos campos sí los usa la integración actual de órdenes con Checkout Pro.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="mp-access-token">Access token</Label>
                                    <Input
                                        id="mp-access-token"
                                        placeholder="APP_USR-..."
                                        value={settings.access_token}
                                        onChange={(event) => handleFieldChange('access_token', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mp-public-key">Public key</Label>
                                    <Input
                                        id="mp-public-key"
                                        placeholder="APP_USR-..."
                                        value={settings.public_key}
                                        onChange={(event) => handleFieldChange('public_key', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="mp-webhook-secret">Webhook secret</Label>
                                    <Input
                                        id="mp-webhook-secret"
                                        placeholder="secret para x-signature"
                                        value={settings.webhook_secret}
                                        onChange={(event) => handleFieldChange('webhook_secret', event.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mp-statement-descriptor">Statement descriptor</Label>
                                    <Input
                                        id="mp-statement-descriptor"
                                        maxLength={22}
                                        placeholder="WALLETCLUB"
                                        value={settings.statement_descriptor}
                                        onChange={(event) => handleFieldChange('statement_descriptor', event.target.value.toUpperCase())}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Máximo 22 caracteres. Lo que vea el cliente en el cargo.
                                    </p>
                                    {settingsMeta?.source.statement_descriptor && (
                                        <p className="text-xs text-muted-foreground">
                                            Fuente activa: {settingsMeta.source.statement_descriptor}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="mp-frontend-url">Frontend URL</Label>
                                    <Input
                                        id="mp-frontend-url"
                                        placeholder="https://walletclub.mx"
                                        value={settings.frontend_url}
                                        onChange={(event) => handleFieldChange('frontend_url', event.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Base para `back_urls` y retorno a detalle de orden.
                                    </p>
                                    {settingsMeta?.source.frontend_url && (
                                        <p className="text-xs text-muted-foreground">
                                            Fuente activa: {settingsMeta.source.frontend_url}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mp-api-url">API URL</Label>
                                    <Input
                                        id="mp-api-url"
                                        placeholder="https://api.walletclub.mx"
                                        value={settings.api_url}
                                        onChange={(event) => handleFieldChange('api_url', event.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Guarda la base del backend. Si pegas `.../api`, la normalizamos al guardar.
                                    </p>
                                    {settingsMeta?.source.api_url && (
                                        <p className="text-xs text-muted-foreground">
                                            Fuente activa: {settingsMeta.source.api_url}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Webhook className="h-5 w-5" />
                                URLs y señales
                            </CardTitle>
                            <CardDescription>
                                Vista previa de los enlaces que la integración usará al crear preferencias.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Webhook final</Label>
                                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                                {settingsMeta?.source.webhook_secret && (
                                    <p className="text-xs text-muted-foreground">
                                        Firma `x-signature`: {settingsMeta.source.webhook_secret === 'missing' ? 'faltante' : `tomada desde ${settingsMeta.source.webhook_secret}`}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Back URL éxito</Label>
                                <Input readOnly value={successUrl} className="font-mono text-xs" />
                            </div>

                            <div className="space-y-2">
                                <Label>Back URL pendiente</Label>
                                <Input readOnly value={pendingUrl} className="font-mono text-xs" />
                            </div>

                            <div className="space-y-2">
                                <Label>Back URL falla</Label>
                                <Input readOnly value={failureUrl} className="font-mono text-xs" />
                            </div>

                            <Alert>
                                <ShieldCheck className="h-4 w-4" />
                                <AlertTitle>Estado esperado del flujo</AlertTitle>
                                <AlertDescription>
                                    La orden se crea en WalletClub, se abre Checkout Pro y, cuando Mercado Pago
                                    notifica un `payment approved`, la membresía se activa automáticamente.
                                </AlertDescription>
                            </Alert>

                            <div className="grid gap-2 md:grid-cols-2">
                                <Badge variant={settingsMeta?.source.access_token === 'missing' ? 'destructive' : 'outline'}>
                                    Access token: {settingsMeta?.source.access_token || 'stored'}
                                </Badge>
                                <Badge variant={settingsMeta?.source.public_key === 'missing' ? 'secondary' : 'outline'}>
                                    Public key: {settingsMeta?.source.public_key || 'stored'}
                                </Badge>
                                <Badge variant={settingsMeta?.source.webhook_secret === 'missing' ? 'secondary' : 'outline'}>
                                    Webhook secret: {settingsMeta?.source.webhook_secret || 'stored'}
                                </Badge>
                                <Badge variant="outline">
                                    SDK frontend: no requerido para este redirect
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5" />
                            Preparación para marketplace OAuth
                        </CardTitle>
                        <CardDescription>
                            Estos campos quedan listos para la fase del addendum que conecta cuentas por estudio.
                            Aún no participan en el checkout actual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="mp-app-id">App ID</Label>
                                <Input
                                    id="mp-app-id"
                                    placeholder="tu_app_id"
                                    value={settings.app_id}
                                    onChange={(event) => handleFieldChange('app_id', event.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mp-client-secret">Client secret</Label>
                                <Input
                                    id="mp-client-secret"
                                    placeholder="tu_client_secret"
                                    value={settings.client_secret}
                                    onChange={(event) => handleFieldChange('client_secret', event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>OAuth callback sugerido</Label>
                            <Input readOnly value={oauthCallbackUrl} className="font-mono text-xs" />
                            <p className="text-xs text-muted-foreground">
                                Referencia tomada del addendum. La conexión OAuth estudio-por-estudio sigue pendiente.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="animate-spin" /> : <Save />}
                        Guardar configuración
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
}
