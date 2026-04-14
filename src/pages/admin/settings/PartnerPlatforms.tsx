import { useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';

type PartnerChannel = 'wellhub' | 'totalpass';

interface PartnerSettingsRow {
    channel: PartnerChannel;
    environment: 'sandbox' | 'production';
    is_enabled: boolean;
    api_base_url: string | null;
    booking_base_url: string | null;
    access_base_url: string | null;
    partner_api_key: string | null;
    place_api_key: string | null;
    api_key: string | null;
    api_secret: string | null;
    access_token: string | null;
    refresh_token: string | null;
    token_expires_at: string | null;
    webhook_secret: string | null;
    gym_id: string | null;
    webhook_url: string | null;
    extra_config: Record<string, any> | null;
}

interface PartnerMappingRow {
    id: string;
    class_id: string;
    channel: PartnerChannel;
    external_class_id: string | null;
    external_slot_id: string | null;
    external_event_id: string | null;
    external_occurrence_id: string | null;
    sync_enabled: boolean;
    sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
    sync_error: string | null;
    last_synced_at: string | null;
    metadata: Record<string, any> | null;
    class_date: string;
    start_time: string;
    class_name: string;
    inventory_max_spots: number | null;
    inventory_booked_spots: number | null;
}

interface UpcomingClassRow {
    id: string;
    date: string;
    start_time: string;
    max_capacity: number;
    current_bookings: number;
    status: string;
    class_type_name: string;
}

interface MappingDraftChannel {
    id?: string;
    channel: PartnerChannel;
    external_class_id: string;
    external_slot_id: string;
    external_event_id: string;
    external_occurrence_id: string;
    sync_enabled: boolean;
    metadataText: string;
    sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
    sync_error: string | null;
    last_synced_at: string | null;
    inventory_max_spots: number | null;
    inventory_booked_spots: number | null;
}

interface MappingDraftRow {
    classId: string;
    className: string;
    classDate: string;
    startTime: string;
    maxCapacity: number;
    currentBookings: number;
    channels: Record<PartnerChannel, MappingDraftChannel>;
}

interface MappingUpdatePayload {
    channel: PartnerChannel;
    external_class_id: string | null;
    external_slot_id: string | null;
    external_event_id: string | null;
    external_occurrence_id: string | null;
    sync_enabled: boolean;
    metadata: Record<string, any>;
}

const partnerChannels: PartnerChannel[] = ['wellhub', 'totalpass'];

const emptySettings: Record<PartnerChannel, PartnerSettingsRow> = {
    wellhub: {
        channel: 'wellhub',
        environment: 'sandbox',
        is_enabled: false,
        api_base_url: '',
        booking_base_url: '',
        access_base_url: '',
        partner_api_key: '',
        place_api_key: '',
        api_key: '',
        api_secret: '',
        access_token: '',
        refresh_token: '',
        token_expires_at: null,
        webhook_secret: '',
        gym_id: '',
        webhook_url: '',
        extra_config: {},
    },
    totalpass: {
        channel: 'totalpass',
        environment: 'sandbox',
        is_enabled: false,
        api_base_url: '',
        booking_base_url: '',
        access_base_url: '',
        partner_api_key: '',
        place_api_key: '',
        api_key: '',
        api_secret: '',
        access_token: '',
        refresh_token: '',
        token_expires_at: null,
        webhook_secret: '',
        gym_id: '',
        webhook_url: '',
        extra_config: {},
    },
};

function channelLabel(channel: PartnerChannel) {
    return channel === 'wellhub' ? 'Wellhub' : 'TotalPass';
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'synced') return 'default';
    if (status === 'failed') return 'destructive';
    if (status === 'pending') return 'secondary';
    return 'outline';
}

function emptyMappingChannel(channel: PartnerChannel): MappingDraftChannel {
    return {
        channel,
        external_class_id: '',
        external_slot_id: '',
        external_event_id: '',
        external_occurrence_id: '',
        sync_enabled: true,
        metadataText: '{}',
        sync_status: 'skipped',
        sync_error: null,
        last_synced_at: null,
        inventory_max_spots: null,
        inventory_booked_spots: null,
    };
}

function buildMappingDrafts(classes: UpcomingClassRow[], mappings: PartnerMappingRow[]): MappingDraftRow[] {
    const mappingsByKey = new Map(mappings.map((mapping) => [`${mapping.class_id}:${mapping.channel}`, mapping]));

    return classes
        .filter((item) => item.status !== 'cancelled')
        .map((item) => {
            const buildChannel = (channel: PartnerChannel): MappingDraftChannel => {
                const mapping = mappingsByKey.get(`${item.id}:${channel}`);

                return {
                    ...emptyMappingChannel(channel),
                    id: mapping?.id,
                    external_class_id: mapping?.external_class_id || '',
                    external_slot_id: mapping?.external_slot_id || '',
                    external_event_id: mapping?.external_event_id || '',
                    external_occurrence_id: mapping?.external_occurrence_id || '',
                    sync_enabled: mapping?.sync_enabled ?? true,
                    metadataText: JSON.stringify(mapping?.metadata || {}, null, 2),
                    sync_status: mapping?.sync_status || 'skipped',
                    sync_error: mapping?.sync_error || null,
                    last_synced_at: mapping?.last_synced_at || null,
                    inventory_max_spots: mapping?.inventory_max_spots ?? null,
                    inventory_booked_spots: mapping?.inventory_booked_spots ?? null,
                };
            };

            return {
                classId: item.id,
                className: item.class_type_name,
                classDate: item.date,
                startTime: item.start_time,
                maxCapacity: Number(item.max_capacity) || 0,
                currentBookings: Number(item.current_bookings) || 0,
                channels: {
                    wellhub: buildChannel('wellhub'),
                    totalpass: buildChannel('totalpass'),
                },
            };
        });
}

function formatClassMoment(classDate: string, startTime: string) {
    const parsed = new Date(`${classDate}T${startTime}`);

    if (Number.isNaN(parsed.getTime())) {
        return `${classDate} ${startTime}`;
    }

    return new Intl.DateTimeFormat('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
    }).format(parsed);
}

function hasMappingValue(channel: MappingDraftChannel) {
    return Boolean(
        channel.id
        || channel.external_class_id.trim()
        || channel.external_slot_id.trim()
        || channel.external_event_id.trim()
        || channel.external_occurrence_id.trim(),
    );
}

export default function PartnerPlatforms() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<Record<PartnerChannel, PartnerSettingsRow>>(emptySettings);
    const [extraConfigText, setExtraConfigText] = useState<Record<PartnerChannel, string>>({
        wellhub: '{}',
        totalpass: '{}',
    });
    const [mappingDrafts, setMappingDrafts] = useState<MappingDraftRow[]>([]);

    const { data, isLoading } = useQuery<PartnerSettingsRow[]>({
        queryKey: ['partner-settings'],
        queryFn: async () => {
            const response = await api.get('/partners/settings');
            return response.data;
        },
    });

    const classesQuery = useQuery<UpcomingClassRow[]>({
        queryKey: ['partner-classes'],
        queryFn: async () => {
            const start = format(new Date(), 'yyyy-MM-dd');
            const end = format(addDays(new Date(), 21), 'yyyy-MM-dd');
            const response = await api.get('/classes', { params: { start, end } });
            return response.data;
        },
    });

    const mappingsQuery = useQuery<PartnerMappingRow[]>({
        queryKey: ['partner-mappings'],
        queryFn: async () => {
            const response = await api.get('/partners/mappings', { params: { limit: 500 } });
            return response.data;
        },
    });

    useEffect(() => {
        if (!data) return;

        const next = { ...emptySettings };
        const nextExtra = { wellhub: '{}', totalpass: '{}' };

        for (const row of data) {
            next[row.channel] = {
                ...emptySettings[row.channel],
                ...row,
                extra_config: row.extra_config || {},
            };
            nextExtra[row.channel] = JSON.stringify(row.extra_config || {}, null, 2);
        }

        setSettings(next);
        setExtraConfigText(nextExtra);
    }, [data]);

    useEffect(() => {
        if (!classesQuery.data || !mappingsQuery.data) return;
        setMappingDrafts(buildMappingDrafts(classesQuery.data, mappingsQuery.data));
    }, [classesQuery.data, mappingsQuery.data]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = partnerChannels.map((channel) => ({
                ...settings[channel],
                extra_config: JSON.parse(extraConfigText[channel] || '{}'),
            }));
            return api.put('/partners/settings', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-settings'] });
            toast({
                title: 'Configuración guardada',
                description: 'Las credenciales y URLs de partners se actualizaron correctamente.',
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const renewMutation = useMutation({
        mutationFn: async () => api.post('/partners/totalpass/renew-token'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-settings'] });
            toast({
                title: 'Token renovado',
                description: 'El token de TotalPass se renovó correctamente.',
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const reconcileMutation = useMutation({
        mutationFn: async () => api.post('/partners/reconcile-inventory'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-mappings'] });
            toast({
                title: 'Inventario reconciliado',
                description: 'Los contadores de quotas por partner quedaron sincronizados.',
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const syncMutation = useMutation({
        mutationFn: async (classId?: string) => api.post('/partners/sync-availability', classId ? { classId } : {}),
        onSuccess: (_response, classId) => {
            queryClient.invalidateQueries({ queryKey: ['partner-mappings'] });
            toast({
                title: classId ? 'Clase sincronizada' : 'Disponibilidad sincronizada',
                description: classId
                    ? 'Se publicó la disponibilidad actual de la clase en los partners configurados.'
                    : 'Se publicó la disponibilidad actual para los partners configurados.',
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const saveMappingsMutation = useMutation({
        mutationFn: async ({ classId, rows }: { classId: string; rows: MappingUpdatePayload[] }) => (
            api.put(`/partners/mappings/${classId}`, rows)
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-mappings'] });
            toast({
                title: 'Mapeos guardados',
                description: 'Los identificadores externos de la clase se actualizaron.',
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const updateRow = (channel: PartnerChannel, patch: Partial<PartnerSettingsRow>) => {
        setSettings((current) => ({
            ...current,
            [channel]: {
                ...current[channel],
                ...patch,
            },
        }));
    };

    const updateMappingChannel = (
        classId: string,
        channel: PartnerChannel,
        patch: Partial<MappingDraftChannel>,
    ) => {
        setMappingDrafts((current) => current.map((item) => {
            if (item.classId !== classId) return item;

            return {
                ...item,
                channels: {
                    ...item.channels,
                    [channel]: {
                        ...item.channels[channel],
                        ...patch,
                    },
                },
            };
        }));
    };

    const handleSaveMappings = (classId: string) => {
        const draft = mappingDrafts.find((item) => item.classId === classId);
        if (!draft) return;

        try {
            const rows = partnerChannels.flatMap((channel) => {
                const channelDraft = draft.channels[channel];
                const metadata = JSON.parse(channelDraft.metadataText || '{}');
                const includeRow = (
                    hasMappingValue(channelDraft)
                    || channelDraft.id
                    || channelDraft.sync_enabled === false
                    || Object.keys(metadata || {}).length > 0
                );

                if (!includeRow) {
                    return [];
                }

                return [{
                    channel,
                    external_class_id: channelDraft.external_class_id.trim() || null,
                    external_slot_id: channelDraft.external_slot_id.trim() || null,
                    external_event_id: channelDraft.external_event_id.trim() || null,
                    external_occurrence_id: channelDraft.external_occurrence_id.trim() || null,
                    sync_enabled: channelDraft.sync_enabled,
                    metadata,
                }];
            });

            if (rows.length === 0) {
                toast({
                    title: 'Nada por guardar',
                    description: 'Esta clase todavía no tiene identificadores externos ni metadata capturada.',
                });
                return;
            }

            saveMappingsMutation.mutate({ classId, rows });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'JSON inválido',
                description: error?.message || 'Revisa el metadata JSON antes de guardar.',
            });
        }
    };

    const mappingStats = mappingDrafts.reduce((acc, item) => {
        acc.classes += 1;

        for (const channel of partnerChannels) {
            const channelDraft = item.channels[channel];
            if (hasMappingValue(channelDraft)) {
                acc[channel] += 1;
            }
            if (channelDraft.sync_enabled) {
                acc.enabled += 1;
            }
        }

        return acc;
    }, { classes: 0, wellhub: 0, totalpass: 0, enabled: 0 });

    if (isLoading || classesQuery.isLoading || mappingsQuery.isLoading) {
        return (
            <AuthGuard requiredRoles={['admin']}>
                <AdminLayout>
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                </AdminLayout>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard requiredRoles={['admin']}>
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-heading font-bold">Plataformas</h1>
                            <p className="text-muted-foreground">
                                Configura sandbox, producción, secretos y credenciales para Wellhub y TotalPass.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() => reconcileMutation.mutate()}
                                disabled={reconcileMutation.isPending}
                            >
                                {reconcileMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                )}
                                Reconciliar inventario
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => syncMutation.mutate(undefined)}
                                disabled={syncMutation.isPending}
                            >
                                {syncMutation.isPending && !syncMutation.variables ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCcw className="mr-2 h-4 w-4" />
                                )}
                                Sincronizar disponibilidad
                            </Button>
                            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Guardar configuración
                            </Button>
                        </div>
                    </div>

                    <Tabs defaultValue="credentials" className="space-y-6">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="credentials">Credenciales</TabsTrigger>
                            <TabsTrigger value="mappings">Mapeos y Sync</TabsTrigger>
                        </TabsList>

                        <TabsContent value="credentials" className="space-y-6">
                            {partnerChannels.map((channel) => {
                                const row = settings[channel];
                                return (
                                    <Card key={channel}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <CardTitle className="flex items-center gap-3">
                                                        {channelLabel(channel)}
                                                        <Badge variant={row.is_enabled ? 'default' : 'secondary'}>
                                                            {row.is_enabled ? 'Activo' : 'Inactivo'}
                                                        </Badge>
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Define el ambiente, secretos de webhook y credenciales para este partner.
                                                    </CardDescription>
                                                </div>
                                                {channel === 'totalpass' && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => renewMutation.mutate()}
                                                        disabled={renewMutation.isPending}
                                                    >
                                                        {renewMutation.isPending ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <RefreshCcw className="mr-2 h-4 w-4" />
                                                        )}
                                                        Renovar token
                                                    </Button>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-4">
                                                <div>
                                                    <p className="font-medium">Habilitar integración</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Activa este canal para aceptar webhooks y validaciones salientes.
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={row.is_enabled}
                                                    onCheckedChange={(checked) => updateRow(channel, { is_enabled: checked })}
                                                />
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Ambiente</Label>
                                                    <Select
                                                        value={row.environment}
                                                        onValueChange={(value: 'sandbox' | 'production') => updateRow(channel, { environment: value })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="sandbox">Sandbox</SelectItem>
                                                            <SelectItem value="production">Producción</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Token expira</Label>
                                                    <Input value={row.token_expires_at || ''} readOnly placeholder="Sin expiración registrada" />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Webhook secret</Label>
                                                    <Input
                                                        value={row.webhook_secret || ''}
                                                        onChange={(event) => updateRow(channel, { webhook_secret: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Webhook URL</Label>
                                                    <Input
                                                        value={row.webhook_url || ''}
                                                        onChange={(event) => updateRow(channel, { webhook_url: event.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>API base URL</Label>
                                                    <Input
                                                        value={row.api_base_url || ''}
                                                        onChange={(event) => updateRow(channel, { api_base_url: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Booking base URL</Label>
                                                    <Input
                                                        value={row.booking_base_url || ''}
                                                        onChange={(event) => updateRow(channel, { booking_base_url: event.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Access base URL</Label>
                                                    <Input
                                                        value={row.access_base_url || ''}
                                                        onChange={(event) => updateRow(channel, { access_base_url: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Gym ID / Place ID</Label>
                                                    <Input
                                                        value={row.gym_id || ''}
                                                        onChange={(event) => updateRow(channel, { gym_id: event.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Partner API Key</Label>
                                                    <Input
                                                        value={row.partner_api_key || ''}
                                                        onChange={(event) => updateRow(channel, { partner_api_key: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Place API Key</Label>
                                                    <Input
                                                        value={row.place_api_key || ''}
                                                        onChange={(event) => updateRow(channel, { place_api_key: event.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>API Key</Label>
                                                    <Input
                                                        value={row.api_key || ''}
                                                        onChange={(event) => updateRow(channel, { api_key: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>API Secret</Label>
                                                    <Input
                                                        value={row.api_secret || ''}
                                                        onChange={(event) => updateRow(channel, { api_secret: event.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label>Access Token</Label>
                                                    <Textarea
                                                        rows={3}
                                                        value={row.access_token || ''}
                                                        onChange={(event) => updateRow(channel, { access_token: event.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Refresh Token</Label>
                                                    <Textarea
                                                        rows={3}
                                                        value={row.refresh_token || ''}
                                                        onChange={(event) => updateRow(channel, { refresh_token: event.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Extra config (JSON)</Label>
                                                <Textarea
                                                    rows={8}
                                                    value={extraConfigText[channel]}
                                                    onChange={(event) => setExtraConfigText((current) => ({
                                                        ...current,
                                                        [channel]: event.target.value,
                                                    }))}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Puedes usar aquí flags extra, URLs auxiliares o parámetros operativos de sandbox.
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </TabsContent>

                        <TabsContent value="mappings" className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Clases próximas</CardDescription>
                                        <CardTitle>{mappingStats.classes}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Clases mapeadas Wellhub</CardDescription>
                                        <CardTitle>{mappingStats.wellhub}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Clases mapeadas TotalPass</CardDescription>
                                        <CardTitle>{mappingStats.totalpass}</CardTitle>
                                    </CardHeader>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Canales con sync activo</CardDescription>
                                        <CardTitle>{mappingStats.enabled}</CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            {(classesQuery.error || mappingsQuery.error) && (
                                <Card className="border-destructive/40">
                                    <CardContent className="pt-6">
                                        <p className="text-sm text-destructive">
                                            No se pudieron cargar todas las clases o mappings. Revisa el backend antes de editar esta sección.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}

                            {mappingDrafts.length === 0 ? (
                                <Card>
                                    <CardContent className="pt-6">
                                        <p className="text-sm text-muted-foreground">
                                            No hay clases próximas en la ventana de 21 días para configurar mappings.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                mappingDrafts.map((item) => (
                                    <Card key={item.classId}>
                                        <CardHeader>
                                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                <div className="space-y-2">
                                                    <CardTitle>{item.className}</CardTitle>
                                                    <CardDescription>
                                                        {formatClassMoment(item.classDate, item.startTime)}
                                                    </CardDescription>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge variant="outline">
                                                            Local {item.currentBookings}/{item.maxCapacity}
                                                        </Badge>
                                                        <Badge variant="secondary">{item.classId.slice(0, 8)}</Badge>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => syncMutation.mutate(item.classId)}
                                                        disabled={syncMutation.isPending}
                                                    >
                                                        {syncMutation.isPending && syncMutation.variables === item.classId ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <RefreshCcw className="mr-2 h-4 w-4" />
                                                        )}
                                                        Sync clase
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveMappings(item.classId)}
                                                        disabled={saveMappingsMutation.isPending}
                                                    >
                                                        {saveMappingsMutation.isPending && saveMappingsMutation.variables?.classId === item.classId ? (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Save className="mr-2 h-4 w-4" />
                                                        )}
                                                        Guardar mapeos
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="grid gap-4 2xl:grid-cols-2">
                                            {partnerChannels.map((channel) => {
                                                const draft = item.channels[channel];
                                                return (
                                                    <div key={channel} className="space-y-4 rounded-xl border border-border/60 p-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-semibold">{channelLabel(channel)}</h3>
                                                                    <Badge variant={statusVariant(draft.sync_status)}>
                                                                        {draft.sync_status}
                                                                    </Badge>
                                                                </div>
                                                                <p className="mt-1 text-sm text-muted-foreground">
                                                                    {draft.inventory_max_spots !== null
                                                                        ? `Cupo partner ${draft.inventory_booked_spots || 0}/${draft.inventory_max_spots}`
                                                                        : 'Sin inventario partner calculado todavía'}
                                                                </p>
                                                                {draft.last_synced_at && (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Último sync: {new Date(draft.last_synced_at).toLocaleString('es-MX')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-sm">Sync activo</Label>
                                                                <Switch
                                                                    checked={draft.sync_enabled}
                                                                    onCheckedChange={(checked) => updateMappingChannel(item.classId, channel, { sync_enabled: checked })}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-4 md:grid-cols-2">
                                                            <div className="space-y-2">
                                                                <Label>External class ID</Label>
                                                                <Input
                                                                    value={draft.external_class_id}
                                                                    onChange={(event) => updateMappingChannel(item.classId, channel, { external_class_id: event.target.value })}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>External slot ID</Label>
                                                                <Input
                                                                    value={draft.external_slot_id}
                                                                    onChange={(event) => updateMappingChannel(item.classId, channel, { external_slot_id: event.target.value })}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-4 md:grid-cols-2">
                                                            <div className="space-y-2">
                                                                <Label>External event ID</Label>
                                                                <Input
                                                                    value={draft.external_event_id}
                                                                    onChange={(event) => updateMappingChannel(item.classId, channel, { external_event_id: event.target.value })}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>External occurrence ID</Label>
                                                                <Input
                                                                    value={draft.external_occurrence_id}
                                                                    onChange={(event) => updateMappingChannel(item.classId, channel, { external_occurrence_id: event.target.value })}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>Metadata JSON</Label>
                                                            <Textarea
                                                                rows={6}
                                                                value={draft.metadataText}
                                                                onChange={(event) => updateMappingChannel(item.classId, channel, { metadataText: event.target.value })}
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Guarda aquí atributos opcionales como `availablePositions`, `gym_id` o referencias adicionales del sandbox.
                                                            </p>
                                                        </div>

                                                        {draft.sync_error && (
                                                            <p className="text-sm text-destructive">
                                                                Último error: {draft.sync_error}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </AdminLayout>
        </AuthGuard>
    );
}
