import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, XCircle, RefreshCw, Send, QrCode, PowerOff, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/api';

interface WhatsAppStatus {
    provider: string;
    connected: boolean;
    state: string;
    number?: string;
    lastUpdated?: string;
}

interface ConnectionResult {
    success: boolean;
    qrCode?: string;
    message?: string;
    status?: any;
}

export default function WhatsAppSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('');
    const [qrCode, setQrCode] = useState<string | null>(null);

    // Query: Estado de conexión
    const { data: status, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery<WhatsAppStatus>({
        queryKey: ['whatsapp-status'],
        queryFn: async () => {
            try {
                const response = await api.get('/evolution/status');
                return response.data;
            } catch {
                // Evolution API not configured on backend
                return { provider: 'evolution', connected: false, state: 'not_configured' } as WhatsAppStatus;
            }
        },
        refetchInterval: qrCode ? 3000 : 60000,
        retry: false,
    });

    // Mutation: Conectar (obtener QR)
    const connectMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/evolution/connect');
            return response.data as ConnectionResult;
        },
        onSuccess: (data) => {
            if (data.qrCode) {
                setQrCode(data.qrCode);
                toast({
                    title: 'QR Generado',
                    description: 'Escanea el código QR con WhatsApp',
                });
            } else if (data.status?.connected) {
                toast({
                    title: 'Ya conectado',
                    description: 'WhatsApp ya está conectado',
                });
            }
            queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Error conectando WhatsApp',
                variant: 'destructive',
            });
        },
    });

    // Mutation: Logout
    const logoutMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/evolution/logout');
            return response.data;
        },
        onSuccess: () => {
            setQrCode(null);
            toast({
                title: 'Sesión cerrada',
                description: 'WhatsApp desconectado correctamente',
            });
            queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Error cerrando sesión',
                variant: 'destructive',
            });
        },
    });

    // Mutation: Enviar mensaje de prueba
    const testMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/evolution/test', {
                phone: testPhone,
                message: testMessage || undefined,
            });
            return response.data;
        },
        onSuccess: () => {
            toast({
                title: 'Mensaje enviado',
                description: `Mensaje de prueba enviado a ${testPhone}`,
            });
            setTestPhone('');
            setTestMessage('');
        },
        onError: (error: any) => {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Error enviando mensaje',
                variant: 'destructive',
            });
        },
    });

    // Limpiar QR cuando se conecte
    useEffect(() => {
        if (status?.connected && qrCode) {
            setQrCode(null);
            toast({
                title: '¡Conectado!',
                description: 'WhatsApp conectado exitosamente',
            });
        }
    }, [status?.connected, qrCode]);

    const getStatusBadge = () => {
        if (isLoadingStatus) {
            return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Cargando...</Badge>;
        }
        if (status?.connected) {
            return <Badge variant="default" className="bg-success"><CheckCircle className="w-3 h-3 mr-1" />Conectado</Badge>;
        }
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Desconectado</Badge>;
    };

    return (
        <AdminLayout>
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">WhatsApp Business</h2>
                <p className="text-muted-foreground">
                    Configura la conexión de WhatsApp para enviar notificaciones automáticas
                </p>
            </div>

            {/* Estado de conexión */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5" />
                                Estado de Conexión
                            </CardTitle>
                            <CardDescription>
                                Proveedor: {status?.provider || 'evolution'}
                            </CardDescription>
                        </div>
                        {getStatusBadge()}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status?.connected && (
                        <Alert>
                            <CheckCircle className="w-4 h-4" />
                            <AlertTitle>WhatsApp Activo</AlertTitle>
                            <AlertDescription>
                                {status.number && (
                                    <span className="block">Número: +{status.number}</span>
                                )}
                                Las notificaciones se enviarán automáticamente.
                            </AlertDescription>
                        </Alert>
                    )}

                    {!status?.connected && !qrCode && (
                        <Alert variant="destructive">
                            <XCircle className="w-4 h-4" />
                            <AlertTitle>WhatsApp No Conectado</AlertTitle>
                            <AlertDescription>
                                Conecta WhatsApp para habilitar las notificaciones automáticas.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchStatus()}
                            disabled={isLoadingStatus}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                            Actualizar
                        </Button>

                        {!status?.connected && (
                            <Button
                                onClick={() => connectMutation.mutate()}
                                disabled={connectMutation.isPending}
                            >
                                {connectMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <QrCode className="w-4 h-4 mr-2" />
                                )}
                                Conectar WhatsApp
                            </Button>
                        )}

                        {status?.connected && (
                            <Button
                                variant="destructive"
                                onClick={() => logoutMutation.mutate()}
                                disabled={logoutMutation.isPending}
                            >
                                {logoutMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <PowerOff className="w-4 h-4 mr-2" />
                                )}
                                Desconectar
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* QR Code para escanear */}
            {qrCode && !status?.connected && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <QrCode className="w-5 h-5" />
                            Escanea el Código QR
                        </CardTitle>
                        <CardDescription>
                            Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center space-y-4">
                        <div className="p-4 bg-white rounded-lg shadow-md">
                            <img 
                                src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                                alt="QR Code WhatsApp" 
                                className="w-64 h-64"
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            El código se actualiza automáticamente cada 30 segundos
                        </p>
                        <Button 
                            variant="outline"
                            onClick={() => connectMutation.mutate()}
                            disabled={connectMutation.isPending}
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${connectMutation.isPending ? 'animate-spin' : ''}`} />
                            Regenerar QR
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Separator />

            {/* Test de mensaje */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        Mensaje de Prueba
                    </CardTitle>
                    <CardDescription>
                        Envía un mensaje de prueba para verificar la conexión
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Número de teléfono</label>
                            <Input
                                placeholder="4271234567"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                10 dígitos (sin 52 ni +)
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mensaje (opcional)</label>
                            <Input
                                placeholder="Mensaje personalizado..."
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button
                        onClick={() => testMutation.mutate()}
                        disabled={!testPhone || !status?.connected || testMutation.isPending}
                    >
                        {testMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar Prueba
                    </Button>
                </CardContent>
            </Card>
        </div>
        </AdminLayout>
    );
}
