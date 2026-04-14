import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Minus, Star } from 'lucide-react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import api from '@/lib/api';

interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    loyalty_points: number;
}

export default function LoyaltyAdjust() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [adjustment, setAdjustment] = useState({
        type: 'add',
        points: 0,
        reason: '',
    });
    const { toast } = useToast();

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const response = await api.get('/users');
            setUsers(response.data || []);
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdjust = async () => {
        if (!selectedUser || adjustment.points <= 0) return;

        setSaving(true);
        try {
            const pointsToAdd = adjustment.type === 'add' ? adjustment.points : -adjustment.points;
            
            await api.post(`/loyalty/points/${selectedUser.id}/adjust`, {
                points: pointsToAdd,
                reason: adjustment.reason || (adjustment.type === 'add' ? 'Ajuste manual (suma)' : 'Ajuste manual (resta)'),
            });

            toast({
                title: 'Puntos ajustados',
                description: `Se ${adjustment.type === 'add' ? 'agregaron' : 'restaron'} ${adjustment.points} puntos a ${selectedUser.first_name}.`,
            });

            // Refresh user data
            loadUsers();
            setSelectedUser(null);
            setAdjustment({ type: 'add', points: 0, reason: '' });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron ajustar los puntos.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = users.filter(user =>
        `${user.first_name} ${user.last_name} ${user.email}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
    );

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
                    <h1 className="text-2xl font-bold">Ajustar Puntos</h1>
                    <p className="text-muted-foreground">
                        Suma o resta puntos de lealtad a los clientes manualmente.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Seleccionar Cliente</CardTitle>
                            <CardDescription>
                                Busca y selecciona al cliente
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="search">Buscar cliente</Label>
                                <Input
                                    id="search"
                                    placeholder="Nombre o correo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto border rounded-md">
                                {filteredUsers.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground">
                                        No se encontraron clientes
                                    </div>
                                ) : (
                                    filteredUsers.map(user => (
                                        <div
                                            key={user.id}
                                            className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                                                selectedUser?.id === user.id ? 'bg-muted' : ''
                                            }`}
                                            onClick={() => setSelectedUser(user)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="font-medium">
                                                        {user.first_name} {user.last_name}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {user.email}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 text-yellow-600">
                                                    <Star className="h-4 w-4 fill-current" />
                                                    <span className="font-semibold">
                                                        {user.loyalty_points || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Realizar Ajuste</CardTitle>
                            <CardDescription>
                                {selectedUser
                                    ? `Ajustando puntos de ${selectedUser.first_name} ${selectedUser.last_name}`
                                    : 'Selecciona un cliente primero'
                                }
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedUser && (
                                <>
                                    <div className="p-4 bg-muted rounded-lg">
                                        <div className="text-sm text-muted-foreground">Puntos actuales</div>
                                        <div className="text-3xl font-bold flex items-center gap-2">
                                            <Star className="h-6 w-6 text-yellow-500 fill-current" />
                                            {selectedUser.loyalty_points || 0}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Tipo de ajuste</Label>
                                        <Select
                                            value={adjustment.type}
                                            onValueChange={(value) => setAdjustment({ ...adjustment, type: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="add">
                                                    <span className="flex items-center gap-2">
                                                        <Plus className="h-4 w-4 text-success" />
                                                        Sumar puntos
                                                    </span>
                                                </SelectItem>
                                                <SelectItem value="subtract">
                                                    <span className="flex items-center gap-2">
                                                        <Minus className="h-4 w-4 text-red-500" />
                                                        Restar puntos
                                                    </span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="points">Cantidad de puntos</Label>
                                        <Input
                                            id="points"
                                            type="number"
                                            min={1}
                                            value={adjustment.points}
                                            onChange={(e) => setAdjustment({
                                                ...adjustment,
                                                points: parseInt(e.target.value) || 0
                                            })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="reason">Motivo (opcional)</Label>
                                        <Textarea
                                            id="reason"
                                            placeholder="Razón del ajuste..."
                                            value={adjustment.reason}
                                            onChange={(e) => setAdjustment({
                                                ...adjustment,
                                                reason: e.target.value
                                            })}
                                        />
                                    </div>

                                    {adjustment.points > 0 && (
                                        <div className="p-4 bg-muted rounded-lg">
                                            <div className="text-sm text-muted-foreground">Nuevo balance</div>
                                            <div className="text-2xl font-bold">
                                                {adjustment.type === 'add'
                                                    ? (selectedUser.loyalty_points || 0) + adjustment.points
                                                    : Math.max(0, (selectedUser.loyalty_points || 0) - adjustment.points)
                                                } puntos
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        className="w-full"
                                        onClick={handleAdjust}
                                        disabled={saving || adjustment.points <= 0}
                                    >
                                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {adjustment.type === 'add' ? (
                                            <>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Sumar {adjustment.points} puntos
                                            </>
                                        ) : (
                                            <>
                                                <Minus className="mr-2 h-4 w-4" />
                                                Restar {adjustment.points} puntos
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}

                            {!selectedUser && (
                                <div className="text-center py-8 text-muted-foreground">
                                    Selecciona un cliente de la lista para ajustar sus puntos.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminLayout>
    );
}
