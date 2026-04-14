import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Loader2, DollarSign, TrendingUp, CreditCard, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { format, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsRevenue() {
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

    const { data: revenueStats, isLoading } = useQuery({
        queryKey: ['reports-revenue', startDate, endDate],
        queryFn: async () => (await api.get(`/reports/revenue?startDate=${startDate}&endDate=${endDate}`)).data
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const methodLabels: Record<string, string> = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia',
        bank_transfer: 'Transferencia',
    };

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
                        <h1 className="text-3xl font-bold tracking-tight">Reporte de Ingresos</h1>
                        <p className="text-muted-foreground">Desglose de ventas y métodos de pago.</p>
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

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(revenueStats?.total || 0)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {Array.isArray(revenueStats?.daily)
                                    ? revenueStats.daily.reduce((acc: number, curr: any) => acc + (parseInt(curr.count) || 0), 0)
                                    : 0}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {/* Simple avg calculation if not provided */}
                                {formatCurrency(revenueStats?.total > 0 ? (revenueStats.total / (revenueStats?.daily?.length || 1)) : 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">Est. diario</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Card className="col-span-2">
                        <CardHeader>
                            <CardTitle>Tendencia de Ingresos</CardTitle>
                            <CardDescription>Ventas diarias</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueStats?.daily || []}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => format(new Date(val), 'dd MMM')}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        labelFormatter={(val) => format(new Date(val), 'dd MMM yyyy')}
                                        formatter={(val: number) => [formatCurrency(val), 'Ventas']}
                                    />
                                    <Line type="monotone" dataKey="total" stroke="#8884d8" activeDot={{ r: 8 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Por Método de Pago</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={(revenueStats?.byMethod || []).map((m: any) => ({ ...m, label: methodLabels[m.payment_method] || m.payment_method }))} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="label" type="category" width={120} />
                                    <Tooltip formatter={(val: number) => [formatCurrency(val), 'Total']} />
                                    <Bar dataKey="total" fill="#82ca9d" radius={[0, 4, 4, 0]}>
                                        {revenueStats?.byMethod?.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Por Plan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {revenueStats?.byPlan?.slice(0, 5).map((plan: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{plan.name}</p>
                                            <p className="text-xs text-muted-foreground">{plan.count} {Number(plan.count) === 1 ? 'venta' : 'ventas'}</p>
                                        </div>
                                        <div className="font-bold">{formatCurrency(plan.total)}</div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
