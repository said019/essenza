import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import api, { getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCcw, ShieldCheck } from 'lucide-react';

interface PartnerCheckin {
    id: string;
    booking_id: string | null;
    created_at: string;
    validated_at: string | null;
    channel: 'wellhub' | 'totalpass';
    validation_method: string;
    status: 'pending' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
    last_validation_error: string | null;
    user_name: string;
    wellhub_id: string | null;
    totalpass_token: string | null;
    class_date: string | null;
    start_time: string | null;
    class_name: string | null;
    external_ref: string | null;
    expires_at: string;
    remaining_minutes: number;
}

export default function PartnerCheckins() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<string>('all');
    const [channel, setChannel] = useState<string>('all');
    const [date, setDate] = useState('');

    const queryString = useMemo(() => {
        const params = new URLSearchParams();
        if (status !== 'all') params.set('status', status);
        if (channel !== 'all') params.set('channel', channel);
        if (date) params.set('date', date);
        return params.toString();
    }, [status, channel, date]);

    const { data, isLoading, refetch } = useQuery<PartnerCheckin[]>({
        queryKey: ['partner-checkins', queryString],
        queryFn: async () => {
            const response = await api.get(`/partners/checkins${queryString ? `?${queryString}` : ''}`);
            return response.data;
        },
    });

    const confirmMutation = useMutation({
        mutationFn: async (checkinId: string) => {
            return api.post(`/partners/checkins/${checkinId}/confirm`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partner-checkins'] });
            toast({
                title: 'Check-in confirmado',
                description: 'La validación manual se realizó correctamente.',
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const summary = useMemo(() => {
        const rows = data || [];
        return {
            total: rows.length,
            pending: rows.filter((row) => row.status === 'pending').length,
            confirmed: rows.filter((row) => row.status === 'confirmed').length,
            failed: rows.filter((row) => row.status === 'failed').length,
            expired: rows.filter((row) => row.status === 'expired').length,
        };
    }, [data]);

    const statusVariant = (value: PartnerCheckin['status']) => {
        if (value === 'confirmed') return 'default';
        if (value === 'pending') return 'secondary';
        return 'destructive';
    };

    return (
        <AuthGuard requiredRoles={['admin']}>
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h1 className="text-2xl font-heading font-bold">Check-ins Partners</h1>
                            <p className="text-muted-foreground">
                                Supervisa validaciones de Wellhub y TotalPass, y confirma manualmente si alguna API falla.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCcw className="mr-2 h-4 w-4" />
                            )}
                            Actualizar
                        </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-5">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total</CardDescription>
                                <CardTitle>{summary.total}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Pendientes</CardDescription>
                                <CardTitle>{summary.pending}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Confirmados</CardDescription>
                                <CardTitle>{summary.confirmed}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Fallidos</CardDescription>
                                <CardTitle>{summary.failed}</CardTitle>
                            </CardHeader>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Expirados</CardDescription>
                                <CardTitle>{summary.expired}</CardTitle>
                            </CardHeader>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Filtros</CardTitle>
                            <CardDescription>Refina la vista por plataforma, estado o fecha.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                                <Label>Estado</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="pending">Pendiente</SelectItem>
                                        <SelectItem value="confirmed">Confirmado</SelectItem>
                                        <SelectItem value="failed">Fallido</SelectItem>
                                        <SelectItem value="expired">Expirado</SelectItem>
                                        <SelectItem value="cancelled">Cancelado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Plataforma</Label>
                                <Select value={channel} onValueChange={setChannel}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="wellhub">Wellhub</SelectItem>
                                        <SelectItem value="totalpass">TotalPass</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                            </div>

                            <div className="flex items-end">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setStatus('all');
                                        setChannel('all');
                                        setDate('');
                                    }}
                                >
                                    Limpiar filtros
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Clase</TableHead>
                                    <TableHead>Plataforma</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Tiempo restante</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Error</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : !data?.length ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            No hay check-ins de partners para los filtros seleccionados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium">{row.user_name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.channel === 'wellhub' ? row.wellhub_id : row.totalpass_token}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium">{row.class_name || 'Sin clase ligada'}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.class_date || 'Sin fecha'} {row.start_time?.slice(0, 5) || ''}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="capitalize">{row.channel}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {row.status === 'confirmed'
                                                    ? 'Confirmado'
                                                    : row.status === 'expired'
                                                        ? 'Expirado'
                                                        : `${row.remaining_minutes} min`}
                                            </TableCell>
                                            <TableCell>{row.validation_method}</TableCell>
                                            <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                                                {row.last_validation_error || 'Sin error'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                        row.status === 'confirmed'
                                                        || row.status === 'cancelled'
                                                        || confirmMutation.isPending
                                                    }
                                                    onClick={() => confirmMutation.mutate(row.id)}
                                                >
                                                    {confirmMutation.isPending ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                                    )}
                                                    Confirmar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </AdminLayout>
        </AuthGuard>
    );
}
