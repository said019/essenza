import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '@/lib/api';
import type { User } from '@/types/auth';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, MoreHorizontal, Search, Eye, ShoppingCart, UserPlus, Trash2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface Plan {
    id: string;
    name: string;
    price: number;
    currency: string;
    duration_days: number;
    class_limit: number | null;
}

interface UserWithMembership extends User {
    membership_id?: string;
    membership_status?: string;
    membership_start_date?: string;
    membership_end_date?: string;
    classes_remaining?: number | null;
    plan_id?: string;
    plan_name?: string;
    class_limit?: number | null;
    is_active?: boolean;
}

interface UsersListResponse {
    users: UserWithMembership[];
    pagination: {
        total: number;
        limit?: number;
        offset?: number;
    };
}

const statusLabels: Record<string, string> = {
    active: 'Activo',
    expired: 'Vencido',
    cancelled: 'Cancelado',
    pending_payment: 'Pago pendiente',
    pending_activation: 'Pendiente',
    paused: 'Pausado',
};

const statusColors: Record<string, string> = {
    active: 'text-green-600 border-green-200 bg-green-50',
    expired: 'text-red-600 border-red-200 bg-red-50',
    cancelled: 'text-gray-600 border-gray-200 bg-gray-50',
    pending_payment: 'text-yellow-600 border-yellow-200 bg-yellow-50',
    pending_activation: 'text-blue-600 border-blue-200 bg-blue-50',
    paused: 'text-orange-600 border-orange-200 bg-orange-50',
};

export default function ClientsList() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithMembership | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<string>('cash');

    const debouncedSearch = useDebounce(search, 500);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery<UsersListResponse>({
        queryKey: ['users', debouncedSearch, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (debouncedSearch) params.append('search', debouncedSearch);
            params.append('role', 'client');
            params.append('withMembership', 'true');
            params.append('limit', '10');
            params.append('offset', String(page * 10));

            const { data } = await api.get(`/users?${params.toString()}`);
            return data;
        },
        placeholderData: (previousData) => previousData,
    });

    const { data: plans } = useQuery<Plan[]>({
        queryKey: ['plans'],
        queryFn: async () => {
            const { data } = await api.get('/plans');
            return data;
        },
    });

    const assignMutation = useMutation({
        mutationFn: async ({
            userId,
            planId,
            paymentMethod,
        }: {
            userId: string;
            planId: string;
            paymentMethod: string;
        }) => {
            return await api.post('/memberships/assign', {
                userId,
                planId,
                status: 'active',
                paymentMethod,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({
                title: 'Plan asignado',
                description: 'El plan ha sido asignado exitosamente al miembro.',
            });
            closeAssignDialog();
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: getErrorMessage(error),
            });
        },
    });

    const openAssignDialog = (user: UserWithMembership) => {
        setSelectedUser(user);
        setSelectedPlanId('');
        setPaymentMethod('cash');
        setAssignDialogOpen(true);
    };

    const closeAssignDialog = () => {
        setAssignDialogOpen(false);
        setSelectedUser(null);
        setSelectedPlanId('');
    };

    const handleAssignPlan = () => {
        if (!selectedUser || !selectedPlanId) return;
        assignMutation.mutate({
            userId: selectedUser.id,
            planId: selectedPlanId,
            paymentMethod,
        });
    };

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string): Promise<{ message?: string }> => {
            const response = await api.delete(`/users/${id}`);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast({
                title: 'Usuario procesado',
                description: data?.message || 'La cuenta ha sido eliminada/desactivada.'
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: getErrorMessage(error),
            });
        },
    });

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <AuthGuard requiredRoles={['admin', 'instructor']}>
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-heading font-bold">Miembros</h1>
                            <p className="text-muted-foreground">Gestiona miembros y asigna planes.</p>
                        </div>
                        <Button asChild>
                            <Link to="/admin/members/new">
                                <UserPlus className="mr-2 h-4 w-4" />
                                Agregar miembro
                            </Link>
                        </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nombre, email o telefono..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(0);
                                }}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Plan Actual</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Creditos</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : data?.users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No se encontraron clientes.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data?.users.map((user) => (
                                        <TableRow key={user.id} className={user.is_active === false ? 'opacity-50 bg-muted/50' : ''}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={user.photo_url || undefined} />
                                                        <AvatarFallback>{getInitials(user.display_name)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">
                                                            {user.display_name}
                                                            {user.is_active === false && <Badge variant="outline" className="ml-2 text-xs">Inactivo</Badge>}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Registrado: {new Date(user.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm">
                                                    <span>{user.email}</span>
                                                    <span className="text-muted-foreground">{user.phone}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.plan_name ? (
                                                    <span className="font-medium">{user.plan_name}</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">Sin plan</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {user.membership_status ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={statusColors[user.membership_status] || ''}
                                                    >
                                                        {statusLabels[user.membership_status] || user.membership_status}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-gray-500">
                                                        Sin membresia
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {user.membership_status === 'active' ? (
                                                    user.class_limit ? (
                                                        <span className="text-sm">
                                                            {user.classes_remaining ?? 0} / {user.class_limit}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">Ilimitado</span>
                                                    )
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Abrir menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild>
                                                            <Link to={`/admin/members/${user.id}`}>
                                                                <Eye className="mr-2 h-4 w-4" /> Ver Perfil
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openAssignDialog(user)}>
                                                            <ShoppingCart className="mr-2 h-4 w-4" /> Asignar Plan
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => {
                                                                if (confirm('¿Eliminar usuario? Si tiene historial será desactivado, si no, se borrará permanentemente.')) {
                                                                    deleteMutation.mutate(user.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {data && data.pagination.total > 10 && (
                        <div className="flex items-center justify-end space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={page === 0}
                            >
                                Anterior
                            </Button>
                            <div className="text-sm text-muted-foreground">
                                Pagina {page + 1} de {Math.ceil(data.pagination.total / 10)}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={(page + 1) * 10 >= data.pagination.total}
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </div>

                {/* Dialog para asignar plan */}
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Asignar Plan</DialogTitle>
                            <DialogDescription>
                                Asigna un plan de membresia a {selectedUser?.display_name}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="plan">Plan</Label>
                                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona un plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {plans?.map((plan) => (
                                            <SelectItem key={plan.id} value={plan.id}>
                                                {plan.name} - ${plan.price} {plan.currency} ({plan.duration_days} dias)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="paymentMethod">Metodo de pago</Label>
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona metodo de pago" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">Efectivo</SelectItem>
                                        <SelectItem value="transfer">Transferencia</SelectItem>
                                        <SelectItem value="card">Tarjeta</SelectItem>
                                        <SelectItem value="online">Pago en linea</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedPlanId && plans && (
                                <div className="p-3 bg-muted rounded-md text-sm">
                                    <p className="font-medium">Resumen:</p>
                                    {(() => {
                                        const plan = plans.find((p) => p.id === selectedPlanId);
                                        if (!plan) return null;
                                        return (
                                            <ul className="mt-1 space-y-1 text-muted-foreground">
                                                <li>Plan: {plan.name}</li>
                                                <li>Precio: ${plan.price} {plan.currency}</li>
                                                <li>Duracion: {plan.duration_days} dias</li>
                                                <li>
                                                    Creditos: {plan.class_limit ? `${plan.class_limit} clases` : 'Ilimitado'}
                                                </li>
                                            </ul>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={closeAssignDialog}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleAssignPlan}
                                disabled={!selectedPlanId || assignMutation.isPending}
                            >
                                {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Asignar Plan
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </AdminLayout>
        </AuthGuard>
    );
}
