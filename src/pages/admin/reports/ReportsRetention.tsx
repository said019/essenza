import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import api from '@/lib/api';
import { format, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsRetention() {
    const [period, setPeriod] = useState('30days');

    const getDateRange = () => {
        const end = new Date();
        let start = new Date();
        if (period === '7days') start = subDays(end, 7);
        if (period === '30days') start = subDays(end, 30);
        if (period === '90days') start = subDays(end, 90);
        return {
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd')
        };
    };

    const { startDate, endDate } = getDateRange();

    const { data: retentionStats, isLoading } = useQuery({
        queryKey: ['reports-retention', startDate, endDate],
        queryFn: async () => (await api.get(`/reports/retention?startDate=${startDate}&endDate=${endDate}`)).data
    });

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="space-y-4">
                    <Skeleton className="h-12 w-48" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Retención y Asistencia</h1>
                        <p className="text-muted-foreground">Análisis de compromiso y pérdidas.</p>
                    </div>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7days">Últimos 7 días</SelectItem>
                            <SelectItem value="30days">Últimos 30 días</SelectItem>
                            <SelectItem value="90days">Últimos 3 meses</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {/* Booking Flow Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Flujo de Asistencia</CardTitle>
                            <CardDescription>De {retentionStats?.summary.totalBookings} reservas totales</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-success" />
                                        <div>
                                            <p className="font-medium text-success">Asistieron</p>
                                            <p className="text-xs text-success">Check-in realizado</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-bold text-success">{retentionStats?.summary.attended}</span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                                    <div className="flex items-center gap-3">
                                        <XCircle className="h-5 w-5 text-red-600" />
                                        <div>
                                            <p className="font-medium text-red-900">No Shows</p>
                                            <p className="text-xs text-red-700">Sin cancelar, no asistió</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-bold text-red-700">{retentionStats?.summary.noShows}</span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                                    <div className="flex items-center gap-3">
                                        <Clock className="h-5 w-5 text-orange-600" />
                                        <div>
                                            <p className="font-medium text-orange-900">Cancelación Tardía</p>
                                            <p className="text-xs text-orange-700">Menos de 5h de anticipación</p>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-bold text-orange-700">{retentionStats?.summary.lateCancellations}</span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                                    <div className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full border-2 border-border" />
                                        <div>
                                            <p className="font-medium text-foreground">Reposiciones</p>
                                            <p className="text-xs text-foreground">Canceladas con tiempo</p>
                                        </div>
                                    </div>
                                    <span className="text-xl font-bold text-foreground">{retentionStats?.summary.earlyCancellations}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Retention Metrics */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Métricas de Lealtad</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-8">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-lg font-medium">Tasa de Renovación (90 días)</span>
                                        <span className="text-2xl font-bold text-primary">{retentionStats?.retentionMetrics.renewalRate}%</span>
                                    </div>
                                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: `${retentionStats?.retentionMetrics.renewalRate}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        De {retentionStats?.retentionMetrics.expiredLast90Days} membresías vencidas, {retentionStats?.retentionMetrics.renewedLast90Days} fueron renovadas.
                                    </p>
                                </div>

                                <div className="pt-4 border-t">
                                    <h4 className="font-medium mb-3">Reposiciones Totales</h4>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold">{retentionStats?.repositions.created}</div>
                                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Generadas</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Risky Users */}
                    <Card className="col-span-2">
                        <CardHeader>
                            <CardTitle className="text-red-600 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" />
                                Usuarios en Riesgo de Churn
                            </CardTitle>
                            <CardDescription>Top 10 usuarios con mayor número de inasistencias o cancelaciones tardías en el periodo.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="text-left">
                                            <th className="p-3 font-medium">Usuario</th>
                                            <th className="p-3 font-medium text-center">No Shows</th>
                                            <th className="p-3 font-medium text-center">Canc. Tardías</th>
                                            <th className="p-3 font-medium text-center">Total Incidencias</th>
                                            <th className="p-3 font-medium text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {retentionStats?.riskyUsers.length > 0 ? (
                                            retentionStats.riskyUsers.map((user: any) => (
                                                <tr key={user.id} className="border-t hover:bg-muted/50">
                                                    <td className="p-3">
                                                        <p className="font-medium">{user.display_name}</p>
                                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                                    </td>
                                                    <td className="p-3 text-center font-bold text-red-600 bg-red-50/50">{user.no_shows}</td>
                                                    <td className="p-3 text-center text-orange-600 bg-orange-50/50">{user.late_cancels}</td>
                                                    <td className="p-3 text-center font-bold">{parseInt(user.no_shows) + parseInt(user.late_cancels)}</td>
                                                    <td className="p-3 text-right">
                                                        <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90">
                                                            Contactar
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    No hay usuarios con incidencias en este periodo.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
