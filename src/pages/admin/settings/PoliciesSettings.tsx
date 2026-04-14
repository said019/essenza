import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/api';

interface BookingPolicies {
    cancellation_hours: number;
    no_show_penalty: boolean;
    max_advance_days: number;
    min_hours_before_booking: number;
    max_bookings_per_day: number;
    allow_waitlist: boolean;
    auto_promote_waitlist: boolean;
}

export default function PoliciesSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [policies, setPolicies] = useState<BookingPolicies>({
        cancellation_hours: 8,
        no_show_penalty: true,
        max_advance_days: 7,
        min_hours_before_booking: 0,
        max_bookings_per_day: 1,
        allow_waitlist: true,
        auto_promote_waitlist: true,
    });
    const { toast } = useToast();

    useEffect(() => {
        loadPolicies();
    }, []);

    const loadPolicies = async () => {
        try {
            const response = await api.get('/settings/booking_policies');
            if (response.data?.value) {
                setPolicies(prev => ({ ...prev, ...response.data.value }));
            }
        } catch (error) {
            console.error('Error loading policies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/settings/booking_policies', { value: policies });
            toast({
                title: 'Políticas guardadas',
                description: 'Las políticas de reservación se han actualizado correctamente.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron guardar las políticas.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Políticas de Reservación</h1>
                    <p className="text-muted-foreground">
                        Configura las reglas para las reservaciones de clases.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Cancelaciones</CardTitle>
                        <CardDescription>
                            Reglas para cancelación de reservaciones
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="cancellation_hours">
                                    Horas mínimas para cancelar sin penalización
                                </Label>
                                <Input
                                    id="cancellation_hours"
                                    type="number"
                                    min={1}
                                    max={48}
                                    value={policies.cancellation_hours}
                                    onChange={(e) => setPolicies({
                                        ...policies,
                                        cancellation_hours: parseInt(e.target.value) || 12
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Si cancela después de este tiempo, se aplicará penalización
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Penalización por no presentarse</Label>
                                <p className="text-sm text-muted-foreground">
                                    Descontar clase si el cliente no se presenta
                                </p>
                            </div>
                            <Switch
                                checked={policies.no_show_penalty}
                                onCheckedChange={(checked) => setPolicies({
                                    ...policies,
                                    no_show_penalty: checked
                                })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Restricciones de Reserva</CardTitle>
                        <CardDescription>
                            Límites y reglas para hacer reservaciones
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="max_advance_days">
                                    Días máximos de anticipación
                                </Label>
                                <Input
                                    id="max_advance_days"
                                    type="number"
                                    min={1}
                                    max={60}
                                    value={policies.max_advance_days}
                                    onChange={(e) => setPolicies({
                                        ...policies,
                                        max_advance_days: parseInt(e.target.value) || 14
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Con cuántos días de anticipación se puede reservar
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="min_hours_before">
                                    Horas mínimas antes de la clase
                                </Label>
                                <Input
                                    id="min_hours_before"
                                    type="number"
                                    min={0}
                                    max={24}
                                    value={policies.min_hours_before_booking}
                                    onChange={(e) => setPolicies({
                                        ...policies,
                                        min_hours_before_booking: parseInt(e.target.value) || 1
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Tiempo mínimo antes de la clase para poder reservar
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="max_bookings">
                                Máximo de reservas por día por cliente
                            </Label>
                            <Input
                                id="max_bookings"
                                type="number"
                                min={1}
                                max={10}
                                value={policies.max_bookings_per_day}
                                onChange={(e) => setPolicies({
                                    ...policies,
                                    max_bookings_per_day: parseInt(e.target.value) || 2
                                })}
                                className="max-w-xs"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Lista de Espera</CardTitle>
                        <CardDescription>
                            Configuración de la lista de espera
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Permitir lista de espera</Label>
                                <p className="text-sm text-muted-foreground">
                                    Los clientes pueden anotarse si la clase está llena
                                </p>
                            </div>
                            <Switch
                                checked={policies.allow_waitlist}
                                onCheckedChange={(checked) => setPolicies({
                                    ...policies,
                                    allow_waitlist: checked
                                })}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Promoción automática</Label>
                                <p className="text-sm text-muted-foreground">
                                    Promover automáticamente cuando se libere un lugar
                                </p>
                            </div>
                            <Switch
                                checked={policies.auto_promote_waitlist}
                                onCheckedChange={(checked) => setPolicies({
                                    ...policies,
                                    auto_promote_waitlist: checked
                                })}
                                disabled={!policies.allow_waitlist}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Guardar Cambios
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
}
