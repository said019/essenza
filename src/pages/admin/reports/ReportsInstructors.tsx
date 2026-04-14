import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { format, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsInstructors() {
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

    const { data: instructorStats, isLoading } = useQuery({
        queryKey: ['reports-instructors', startDate, endDate],
        queryFn: async () => (await api.get(`/reports/instructors?startDate=${startDate}&endDate=${endDate}`)).data
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
                        <h1 className="text-3xl font-bold tracking-tight">Rendimiento de Instructores</h1>
                        <p className="text-muted-foreground">Comparativa de asistencia y ocupación.</p>
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

                <div className="grid gap-6">
                    {instructorStats?.map((inst: any) => (
                        <Card key={inst.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = `/admin/reports/instructors/${inst.id}`}>
                            <div className="flex flex-col md:flex-row">
                                <div className="bg-muted w-full md:w-48 p-6 flex flex-col items-center justify-center text-center">
                                    <div className="h-24 w-24 rounded-full bg-background flex items-center justify-center overflow-hidden mb-3 border-4 border-background shadow-sm">
                                        {inst.photo_url ? (
                                            <img src={inst.photo_url} alt={inst.display_name} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold text-muted-foreground">{inst.display_name[0]}</span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-lg">{inst.display_name}</h3>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="text-warning">★</span>
                                        <span className="font-bold">{inst.avg_rating ? Number(inst.avg_rating).toFixed(1) : '-'}</span>
                                        <span className="text-xs text-muted-foreground">({inst.total_reviews})</span>
                                    </div>
                                </div>

                                <div className="flex-1 p-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Clases</span>
                                            <div className="text-2xl font-bold">{inst.total_classes}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Alumnos</span>
                                            <div className="text-2xl font-bold">{inst.total_students}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Ocupación</span>
                                            <div className={`text-2xl font-bold ${inst.avg_occupancy >= 80 ? 'text-success' : inst.avg_occupancy < 50 ? 'text-warning' : ''}`}>
                                                {Math.round(inst.avg_occupancy)}%
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-sm font-medium text-muted-foreground">Recomendación</span>
                                            <div className="text-2xl font-bold">
                                                {inst.recommendation_rate ? `${Math.round(inst.recommendation_rate)}%` : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Visual bar for occupancy */}
                                    <div className="mt-6">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>Eficiencia de sala</span>
                                            <span>{Math.round(inst.avg_occupancy)}%</span>
                                        </div>
                                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${inst.avg_occupancy >= 80 ? 'bg-success' : inst.avg_occupancy < 50 ? 'bg-warning' : 'bg-primary'}`}
                                                style={{ width: `${inst.avg_occupancy}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {instructorStats?.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            No hay datos de instructores para este periodo.
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
