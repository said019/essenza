import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Gift, Star } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/api';

interface LoyaltyConfig {
    points_per_class: number;
    points_per_peso: number;
    enabled: boolean;
    welcome_bonus: number;
    birthday_bonus: number;
    referral_bonus: number;
}

export default function LoyaltyConfig() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<LoyaltyConfig>({
        points_per_class: 10,
        points_per_peso: 1,
        enabled: true,
        welcome_bonus: 50,
        birthday_bonus: 100,
        referral_bonus: 200,
    });
    const { toast } = useToast();

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const response = await api.get('/loyalty/config');
            if (response.data) {
                setConfig(prev => ({ ...prev, ...response.data }));
            }
        } catch (error) {
            console.error('Error loading config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/loyalty/config', config);
            toast({
                title: 'Configuración guardada',
                description: 'La configuración de lealtad se ha guardado correctamente.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudo guardar la configuración.',
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
                    <h1 className="text-2xl font-bold">Configuración de Lealtad</h1>
                    <p className="text-muted-foreground">
                        Configura cómo los clientes ganan puntos.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Star className="h-5 w-5" />
                            Estado del Programa
                        </CardTitle>
                        <CardDescription>
                            Activa o desactiva el programa de lealtad
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Programa de Lealtad Activo</Label>
                                <p className="text-sm text-muted-foreground">
                                    Los clientes pueden ganar y canjear puntos
                                </p>
                            </div>
                            <Switch
                                checked={config.enabled}
                                onCheckedChange={(checked) => setConfig({
                                    ...config,
                                    enabled: checked
                                })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Puntos por Actividad</CardTitle>
                        <CardDescription>
                            Define cuántos puntos ganan los clientes por sus acciones
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="points_per_class">Puntos por asistir a clase</Label>
                                <Input
                                    id="points_per_class"
                                    type="number"
                                    min={0}
                                    value={config.points_per_class}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        points_per_class: parseInt(e.target.value) || 0
                                    })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="points_per_peso">Puntos por cada $100 pagados</Label>
                                <Input
                                    id="points_per_peso"
                                    type="number"
                                    min={0}
                                    value={config.points_per_peso}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        points_per_peso: parseInt(e.target.value) || 0
                                    })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gift className="h-5 w-5" />
                            Bonos Especiales
                        </CardTitle>
                        <CardDescription>
                            Puntos adicionales por eventos especiales
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="welcome_bonus">Bono de Bienvenida</Label>
                                <Input
                                    id="welcome_bonus"
                                    type="number"
                                    min={0}
                                    value={config.welcome_bonus}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        welcome_bonus: parseInt(e.target.value) || 0
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Puntos al registrarse
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="birthday_bonus">Bono de Cumpleaños</Label>
                                <Input
                                    id="birthday_bonus"
                                    type="number"
                                    min={0}
                                    value={config.birthday_bonus}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        birthday_bonus: parseInt(e.target.value) || 0
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Puntos en su cumpleaños
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="referral_bonus">Bono por Referido</Label>
                                <Input
                                    id="referral_bonus"
                                    type="number"
                                    min={0}
                                    value={config.referral_bonus}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        referral_bonus: parseInt(e.target.value) || 0
                                    })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Puntos por referir amigos
                                </p>
                            </div>
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
                        Guardar Configuración
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
}
