import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api, { getErrorMessage } from '@/lib/api';
import type { Membership, Plan, User } from '@/types/auth'; // Ensure these types exist
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { MembershipActivationDialog, ActivationForm } from '@/components/memberships/MembershipActivationDialog';

// Schema for assigning membership
const assignSchema = z.object({
    userId: z.string().uuid('Selecciona un usuario'),
    planId: z.string().uuid('Selecciona un plan'),
    status: z.enum(['active', 'pending_payment', 'pending_activation']),
    paymentMethod: z.string().optional(),
});

type AssignForm = z.infer<typeof assignSchema>;

interface MembershipsListProps {
    initialFilter?: 'all' | 'active' | 'pending_payment' | 'pending_activation';
    title?: string;
    description?: string;
    hideTabs?: boolean;
}

export default function MembershipsList({
    initialFilter = 'all',
    title = 'Membresías',
    description = 'Gestión de suscripciones y activaciones.',
    hideTabs = false,
}: MembershipsListProps) {
    const [filter, setFilter] = useState(initialFilter);
    const [search, setSearch] = useState('');
    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [activationMembership, setActivationMembership] = useState<Membership | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting, errors } } = useForm<AssignForm>({
        resolver: zodResolver(assignSchema),
        defaultValues: {
            status: 'active',
        }
    });

    // Fetch Memberships
    const { data: memberships, isLoading } = useQuery<Membership[]>({
        queryKey: ['memberships', filter],
        queryFn: async () => {
            // Logic to filter by params if needed, or filter client side.
            // Backend supports filtering by status.
            const params = new URLSearchParams();
            if (filter !== 'all') params.append('status', filter);
            const { data } = await api.get(`/memberships?${params.toString()}`);
            return data;
        },
    });

    // Fetch Plans (for assignment)
    const { data: plans } = useQuery<Plan[]>({
        queryKey: ['plans'],
        queryFn: async () => {
            const { data } = await api.get('/plans');
            return data;
        },
        enabled: isAssignDialogOpen,
    });

    // Fetch Users (for assignment) - simple version, fetches all clients (optimize later)
    const { data: users } = useQuery<User[]>({
        queryKey: ['users-list'],
        queryFn: async () => {
            // We can reuse the users endpoint with limit=100 or something
            const { data } = await api.get('/users?role=client&limit=100');
            return data.users;
        },
        enabled: isAssignDialogOpen,
    });


    // Mutations
    const activateMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: ActivationForm }) => {
            return await api.post(`/memberships/${id}/activate`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memberships'] });
            toast({ title: 'Membresía activada', description: 'La membresía está ahora activa.' });
            setActivationMembership(null);
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: string) => {
            return await api.post(`/memberships/${id}/cancel`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memberships'] });
            toast({ title: 'Membresía cancelada', description: 'La membresía ha sido cancelada.' });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const assignMutation = useMutation({
        mutationFn: async (data: AssignForm) => {
            return await api.post('/memberships/assign', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['memberships'] });
            toast({ title: 'Membresía asignada', description: 'La membresía se ha creado exitosamente.' });
            setIsAssignDialogOpen(false);
            reset();
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const filteredMemberships = memberships?.filter(m =>
        m.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        m.user_email?.toLowerCase().includes(search.toLowerCase())
    );

    const onSubmitAssign = (data: AssignForm) => {
        assignMutation.mutate(data);
    };

    const handleActivate = (membershipId: string, data: ActivationForm) => {
        activateMutation.mutate({ id: membershipId, payload: data });
    };

    return (
        <AuthGuard requiredRoles={['admin']}>
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-heading font-bold">{title}</h1>
                            <p className="text-muted-foreground">{description}</p>
                        </div>
                        <Button onClick={() => setIsAssignDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Asignar Membresía
                        </Button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        {!hideTabs && (
                            <Tabs value={filter} className="w-full md:w-auto" onValueChange={(val) => setFilter(val)}>
                                <TabsList>
                                    <TabsTrigger value="all">Todas</TabsTrigger>
                                    <TabsTrigger value="active">Activas</TabsTrigger>
                                    <TabsTrigger value="pending_payment">Pend. Pago</TabsTrigger>
                                    <TabsTrigger value="pending_activation">Por Activar</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        )}

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar cliente..."
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Vigencia</TableHead>
                                    <TableHead>Créditos</TableHead>
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
                                ) : filteredMemberships?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No se encontraron membresías.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMemberships?.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell>
                                                <div className="font-medium">{m.user_name}</div>
                                                <div className="text-xs text-muted-foreground">{m.user_email}</div>
                                            </TableCell>
                                            <TableCell>{m.plan_name}</TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    m.status === 'active' ? 'default' :
                                                        m.status.includes('pending') ? 'outline' : 'secondary'
                                                } className={
                                                    m.status === 'active' ? 'bg-success/10 text-success hover:bg-success/10 border-success/30' :
                                                        m.status === 'pending_payment' ? 'text-warning border-warning/30 bg-warning/10' :
                                                            ''
                                                }>
                                                    {m.status === 'active' ? 'Activa' :
                                                        m.status === 'pending_payment' ? 'Pendiente Pago' :
                                                            m.status === 'pending_activation' ? 'Por Activar' :
                                                                m.status === 'cancelled' ? 'Cancelada' :
                                                                    m.status === 'expired' ? 'Vencida' : m.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {m.start_date ? (
                                                    <>
                                                        <div className="text-muted-foreground">Inicio: {new Date(m.start_date).toLocaleDateString()}</div>
                                                        <div>Fin: {new Date(m.end_date!).toLocaleDateString()}</div>
                                                    </>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {m.credits_total ? `${m.credits_remaining} / ${m.credits_total}` : 'Ilimitado'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {(m.status === 'pending_activation' || m.status === 'pending_payment') && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-success hover:text-success hover:bg-success/10"
                                                            onClick={() => setActivationMembership(m)}
                                                        >
                                                            <CheckCircle2 className="h-4 w-4 mr-1" /> Activar
                                                        </Button>
                                                    )}
                                                    {m.status === 'active' && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => {
                                                                if (confirm('¿Cancelar esta membresía?')) cancelMutation.mutate(m.id);
                                                            }}
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Asignar Membresía Manual</DialogTitle>
                                <DialogDescription>
                                    Asigna un plan a un cliente existente.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmitAssign)} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Cliente</Label>
                                    <Select onValueChange={(val) => setValue('userId', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar cliente" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users?.map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.display_name} ({u.email})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.userId && <p className="text-xs text-destructive">{errors.userId.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>Plan</Label>
                                    <Select onValueChange={(val) => setValue('planId', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {plans?.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.name} - ${p.price}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.planId && <p className="text-xs text-destructive">{errors.planId.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>Estado Inicial</Label>
                                    <Select onValueChange={(val: any) => setValue('status', val)} defaultValue="active">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar estado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">Activa (Inicia hoy)</SelectItem>
                                            <SelectItem value="pending_payment">Pendiente de Pago</SelectItem>
                                            <SelectItem value="pending_activation">Pendiente de Activación</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Método de Pago (Opcional)</Label>
                                    <Select onValueChange={(val) => setValue('paymentMethod', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar método" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Efectivo</SelectItem>
                                            <SelectItem value="card">Tarjeta</SelectItem>
                                            <SelectItem value="transfer">Transferencia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsAssignDialogOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Asignar
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <MembershipActivationDialog
                        open={Boolean(activationMembership)}
                        membership={activationMembership}
                        isSubmitting={activateMutation.isPending}
                        onOpenChange={(nextOpen) => {
                            if (!nextOpen) setActivationMembership(null);
                        }}
                        onActivate={handleActivate}
                    />
                </div>
            </AdminLayout>
        </AuthGuard>
    );
}
