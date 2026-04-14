import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import api from '@/lib/api';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, CreditCard, Calendar, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Reports() {
    const [period, setPeriod] = useState('30days');

    // Helper date calculators
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

    // Queries
    const { data: overview, isLoading: loadingOverview } = useQuery({
        queryKey: ['reports-overview'],
        queryFn: async () => (await api.get('/reports/overview')).data
    });

    const { data: classesStats, isLoading: loadingClasses } = useQuery({
        queryKey: ['reports-classes', startDate, endDate],
        queryFn: async () => (await api.get(`/reports/classes?startDate=${startDate}&endDate=${endDate}`)).data
    });

    const { data: instructorStats, isLoading: loadingInstructors } = useQuery({
        queryKey: ['reports-instructors', startDate, endDate],
        queryFn: async () => (await api.get(`/reports/instructors?startDate=${startDate}&endDate=${endDate}`)).data
    });

    const { data: retentionStats, isLoading: loadingRetention } = useQuery({
        queryKey: ['reports-retention', startDate, endDate],
        queryFn: async () => (await api.get(`/reports/retention?startDate=${startDate}&endDate=${endDate}`)).data
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <AuthGuard requiredRoles={['admin']}>
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Reportes y Analytics</h1>
                            <p className="text-muted-foreground">Métricas clave del estudio</p>
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

                    <Tabs defaultValue="overview" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="overview">General</TabsTrigger>
                            <TabsTrigger value="classes">Clases</TabsTrigger>
                            <TabsTrigger value="instructors">Instructores</TabsTrigger>
                            <TabsTrigger value="retention">Retención</TabsTrigger>
                        </TabsList>

                        {/* OVERVIEW TAB */}
                        <TabsContent value="overview" className="space-y-4">
                            {loadingOverview ? <Skeleton className="h-40 w-full" /> : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Miembros Activos</CardTitle>
                                            <Users className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overview?.activeMembers}</div>
                                            <p className="text-xs text-muted-foreground">
                                                +{overview?.newMembers} este mes
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Ingresos Mes</CardTitle>
                                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{formatCurrency(overview?.monthlyRevenue)}</div>
                                            <p className="text-xs text-muted-foreground">
                                                {overview?.monthlyBookings} reservas totales
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Asistencia Promedio</CardTitle>
                                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overview?.attendanceRate}%</div>
                                            <p className="text-xs text-muted-foreground">
                                                Tasa de check-in
                                            </p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Clases Semanales</CardTitle>
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-2xl font-bold">{overview?.weeklyClasses}</div>
                                            <p className="text-xs text-muted-foreground">
                                                Programadas esta semana
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>

                        {/* CLASSES TAB */}
                        <TabsContent value="classes" className="space-y-4">
                            {loadingClasses ? <Skeleton className="h-96 w-full" /> : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card className="col-span-2">
                                        <CardHeader>
                                            <CardTitle>Ocupación por día de la semana</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={classesStats?.byDayOfWeek}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis
                                                        dataKey="day_of_week"
                                                        tickFormatter={(val) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][val]}
                                                    />
                                                    <YAxis />
                                                    <Tooltip labelFormatter={(val) => ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][val]} />
                                                    <Bar dataKey="avg_attendance" name="Asistencia Promedio" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Horarios más populares</CardTitle>
                                            <CardDescription>Top 5 horarios con mayor asistencia</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {classesStats?.byTime.map((item: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-sm">{item.start_time.substring(0, 5)}</span>
                                                            {i < 2 && <span className="text-xs bg-warning/10 text-warning-foreground px-2 py-0.5 rounded-full">🔥 Hot</span>}
                                                        </div>
                                                        <div className="text-sm font-medium">{Math.round(item.avg_attendance)} asistentes avg</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Desglose por Tipo de Clase</CardTitle>
                                        </CardHeader>
                                        <CardContent className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={classesStats?.byType}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="total_bookings"
                                                        nameKey="name"
                                                    >
                                                        {classesStats?.byType.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>

                        {/* INSTRUCTORS TAB */}
                        <TabsContent value="instructors" className="space-y-4">
                            {loadingInstructors ? <Skeleton className="h-96 w-full" /> : (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Rendimiento de Instructores</CardTitle>
                                        <CardDescription>Basado en asistencia y ocupación de sus clases</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-8">
                                            {instructorStats?.map((inst: any) => (
                                                <div key={inst.id} className="flex items-center">
                                                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                                        {inst.photo_url ? (
                                                            <img src={inst.photo_url} alt={inst.display_name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="text-xl font-bold text-muted-foreground">{inst.display_name[0]}</span>
                                                        )}
                                                    </div>
                                                    <div className="ml-4 space-y-1 flex-1">
                                                        <p className="text-sm font-medium leading-none">{inst.display_name}</p>
                                                        <p className="text-sm text-muted-foreground">{inst.total_classes} clases impartidas</p>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4 text-center">
                                                        <div>
                                                            <p className="text-sm font-medium">{inst.total_students}</p>
                                                            <p className="text-xs text-muted-foreground">Alumnas</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium">{Math.round(inst.avg_attendance)}</p>
                                                            <p className="text-xs text-muted-foreground">Prom. Asist.</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-medium text-success">{Math.round(inst.avg_occupancy)}%</p>
                                                            <p className="text-xs text-muted-foreground">Ocupación</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        {/* RETENTION TAB */}
                        <TabsContent value="retention" className="space-y-4">
                            {loadingRetention ? <Skeleton className="h-96 w-full" /> : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Estadísticas de Asistencia</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-success/10 rounded-lg">
                                                    <p className="text-sm text-success font-medium">Asistieron</p>
                                                    <p className="text-2xl font-bold text-success">{retentionStats?.summary.attended}</p>
                                                </div>
                                                <div className="p-4 bg-red-50 rounded-lg">
                                                    <p className="text-sm text-red-600 font-medium">No Shows</p>
                                                    <p className="text-2xl font-bold text-red-700">{retentionStats?.summary.noShows}</p>
                                                </div>
                                                <div className="p-4 bg-orange-50 rounded-lg">
                                                    <p className="text-sm text-orange-600 font-medium">Cancelación Tardía</p>
                                                    <p className="text-2xl font-bold text-orange-700">{retentionStats?.summary.lateCancellations}</p>
                                                </div>
                                                <div className="p-4 bg-info/10 rounded-lg">
                                                    <p className="text-sm text-info font-medium">Reposiciones Disp.</p>
                                                    <p className="text-2xl font-bold text-info">{retentionStats?.repositions.created}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Métricas de Retención</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium">Tasa de Renovación (90 días)</span>
                                                        <span className="font-bold">{retentionStats?.retentionMetrics.renewalRate}%</span>
                                                    </div>
                                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary"
                                                            style={{ width: `${retentionStats?.retentionMetrics.renewalRate}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {retentionStats?.retentionMetrics.renewedLast90Days} renovadas de {retentionStats?.retentionMetrics.expiredLast90Days} vencidas
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="col-span-2">
                                        <CardHeader>
                                            <CardTitle className="text-red-600 flex items-center gap-2">
                                                <AlertCircle className="h-5 w-5" />
                                                Usuarios en Riesgo
                                            </CardTitle>
                                            <CardDescription>Top 10 usuarios con más inasistencias o cancelaciones tardías</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b text-left">
                                                            <th className="py-2">Usuario</th>
                                                            <th className="py-2 text-center text-red-600">No Shows</th>
                                                            <th className="py-2 text-center text-orange-600">Late Cancels</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {retentionStats?.riskyUsers.map((user: any) => (
                                                            <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50">
                                                                <td className="py-3">
                                                                    <p className="font-medium">{user.display_name}</p>
                                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                                </td>
                                                                <td className="py-3 text-center font-bold">{user.no_shows}</td>
                                                                <td className="py-3 text-center">{user.late_cancels}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </AdminLayout>
        </AuthGuard>
    );
}
