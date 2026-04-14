import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api, { getErrorMessage } from '@/lib/api';
import type { Plan } from '@/types/auth'; // Ensure this type matches backend
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react';

// Form Schema
const planSchema = z.object({
    name: z.string().min(2, 'El nombre es requerido'),
    description: z.string().optional(),
    price: z.coerce.number().positive('El precio debe ser mayor a 0'),
    currency: z.string().default('MXN'),
    durationDays: z.coerce.number().int().positive('La duración debe ser positiva'),
    classLimit: z.coerce.number().int().positive().nullable().optional(),
    features: z.string().optional(), // We'll handle splitting by newline/comma
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
});

type PlanForm = z.infer<typeof planSchema>;

export default function PlansList() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<PlanForm>({
        resolver: zodResolver(planSchema),
        defaultValues: {
            currency: 'MXN',
            isActive: true,
            sortOrder: 0,
        },
    });

    // Fetch Plans
    const { data: plans, isLoading } = useQuery<Plan[]>({
        queryKey: ['plans'],
        queryFn: async () => {
            const { data } = await api.get('/plans?all=true');
            return data;
        },
    });

    // Create Mutation
    const createPlanMutation = useMutation({
        mutationFn: async (data: any) => {
            return await api.post('/plans', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plans'] });
            toast({ title: 'Plan creado', description: 'El plan se ha creado exitosamente.' });
            setIsDialogOpen(false);
            reset();
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    // Update Mutation
    const updatePlanMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            return await api.put(`/plans/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plans'] });
            toast({ title: 'Plan actualizado', description: 'El plan se ha actualizado exitosamente.' });
            setIsDialogOpen(false);
            setEditingPlan(null);
            reset();
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    // Delete Mutation
    const deletePlanMutation = useMutation({
        mutationFn: async (id: string) => {
            return await api.delete(`/plans/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['plans'] });
            toast({ title: 'Plan desactivado', description: 'El plan ha sido desactivado.' });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const onSubmit = (data: PlanForm) => {
        // Convert features string to array
        const featuresArray = data.features
            ? data.features.split('\n').map(f => f.trim()).filter(f => f !== '')
            : [];

        const payload = {
            ...data,
            features: featuresArray,
        };

        if (editingPlan) {
            updatePlanMutation.mutate({ id: editingPlan.id, data: payload });
        } else {
            createPlanMutation.mutate(payload);
        }
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setValue('name', plan.name);
        setValue('description', plan.description || '');
        setValue('price', plan.price);
        setValue('currency', plan.currency);
        setValue('durationDays', plan.duration_days);
        setValue('classLimit', plan.class_limit);
        setValue('features', plan.features.join('\n'));
        setValue('isActive', plan.is_active);
        setValue('sortOrder', plan.sort_order);
        setIsDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingPlan(null);
        reset();
        setIsDialogOpen(true);
    };

    return (
        <AuthGuard requiredRoles={['admin']}>
            <AdminLayout>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-heading font-bold">Planes de Membresía</h1>
                            <p className="text-muted-foreground">Configura los paquetes y suscripciones.</p>
                        </div>
                        <Button onClick={handleCreate}>
                            <Plus className="mr-2 h-4 w-4" /> Nuevo Plan
                        </Button>
                    </div>

                    <div className="rounded-md border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Precio</TableHead>
                                    <TableHead>Duración</TableHead>
                                    <TableHead>Clases</TableHead>
                                    <TableHead>Estado</TableHead>
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
                                ) : plans?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No hay planes configurados
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    plans?.map((plan) => (
                                        <TableRow key={plan.id}>
                                            <TableCell className="font-medium">
                                                <div>{plan.name}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {plan.description}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                ${plan.price.toLocaleString()} {plan.currency}
                                            </TableCell>
                                            <TableCell>{plan.duration_days} días</TableCell>
                                            <TableCell>
                                                {plan.class_limit === null ? 'Ilimitadas' : plan.class_limit}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                                                    {plan.is_active ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Abrir menú</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(plan)}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => {
                                                                if (confirm('¿Estás seguro de desactivar este plan?')) {
                                                                    deletePlanMutation.mutate(plan.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Desactivar
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

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>{editingPlan ? 'Editar Plan' : 'Crear Nuevo Plan'}</DialogTitle>
                                <DialogDescription>
                                    Configura los detalles del plan de membresía.
                                </DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Nombre del Plan</Label>
                                        <Input id="name" {...register('name')} placeholder="Ej. Pack 10 Clases" />
                                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="price">Precio (MXN)</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            {...register('price')}
                                            placeholder="0.00"
                                        />
                                        {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Descripción Corta</Label>
                                    <Input id="description" {...register('description')} placeholder="Breve descripción para el cliente" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="durationDays">Duración (Días)</Label>
                                        <Input
                                            id="durationDays"
                                            type="number"
                                            {...register('durationDays')}
                                            placeholder="30"
                                        />
                                        {errors.durationDays && <p className="text-xs text-destructive">{errors.durationDays.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="classLimit">Límite de Clases (vacío = ilimitado)</Label>
                                        <Input
                                            id="classLimit"
                                            type="number"
                                            {...register('classLimit')}
                                            placeholder="Ilimitado"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="features">Características (una por línea)</Label>
                                    <Textarea
                                        id="features"
                                        {...register('features')}
                                        placeholder="Acceso a todas las sedes&#10;Toalla incluida&#10;..."
                                        rows={4}
                                    />
                                </div>

                                <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                    <Label htmlFor="isActive" className="flex flex-col space-y-1">
                                        <span>Plan Activo</span>
                                        <span className="font-normal text-xs text-muted-foreground">
                                            Visible para compra por clientes
                                        </span>
                                    </Label>
                                    <Switch
                                        id="isActive"
                                        checked={editingPlan ? undefined : true} // default true for new
                                        {...register('isActive')}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="sortOrder">Orden de visualización</Label>
                                    <Input
                                        id="sortOrder"
                                        type="number"
                                        {...register('sortOrder')}
                                        placeholder="0"
                                    />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {editingPlan ? 'Guardar Cambios' : 'Crear Plan'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </AdminLayout>
        </AuthGuard>
    );
}
