import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api, { getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2, ArrowLeft, Mail, Phone, Calendar, Heart,
    MessageSquare, User, CreditCard, DollarSign, UserX, Trash2, Power, Pencil, Check, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MonthBookingDialog } from '@/components/admin/MonthBookingDialog';

const statusLabels: Record<string, string> = {
    active: 'Activo',
    expired: 'Vencido',
    cancelled: 'Cancelado',
    pending_payment: 'Pago pendiente',
    pending_activation: 'Pendiente',
    paused: 'Pausado',
};

const statusColors: Record<string, string> = {
    active: 'bg-essenza-olive/10 text-essenza-olive',
    expired: 'bg-red-100 text-red-800',
    cancelled: 'bg-muted text-foreground',
    pending_payment: 'bg-yellow-100 text-yellow-800',
    pending_activation: 'bg-info/10 text-info',
    paused: 'bg-orange-100 text-orange-800',
};

const noteSchema = z.object({
    content: z.string().min(1, 'La nota no puede estar vacia'),
});

type NoteForm = z.infer<typeof noteSchema>;

export default function ClientDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<NoteForm>({
        resolver: zodResolver(noteSchema),
    });

    const { data: client, isLoading } = useQuery({
        queryKey: ['client', id],
        queryFn: async () => {
            const { data } = await api.get(`/admin/clients/${id}/full-profile`);
            return data;
        },
        enabled: !!id,
    });

    const addNoteMutation = useMutation({
        mutationFn: async (data: NoteForm) => {
            return await api.post(`/admin/clients/${id}/notes`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client', id] });
            toast({ title: 'Nota agregada', description: 'La nota se ha guardado correctamente.' });
            reset();
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    // Mutation para cambiar estado activo/inactivo
    const toggleStatusMutation = useMutation({
        mutationFn: async (isActive: boolean) => {
            return await api.patch(`/users/${id}/status`, { is_active: isActive });
        },
        onSuccess: (_, isActive) => {
            queryClient.invalidateQueries({ queryKey: ['client', id] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({
                title: isActive ? 'Usuario activado' : 'Usuario desactivado',
                description: isActive ? 'El usuario puede iniciar sesión nuevamente.' : 'El usuario no podrá iniciar sesión.'
            });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    // Mutation para eliminar usuario
    const deleteUserMutation = useMutation({
        mutationFn: async () => {
            return await api.delete(`/users/${id}`);
        },
        onSuccess: () => {
            toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado permanentemente.' });
            navigate('/admin/members');
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    // Edit profile state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        displayName: '',
        phone: '',
        dateOfBirth: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        healthNotes: '',
    });

    const openEditDialog = () => {
        setEditForm({
            displayName: client?.display_name || '',
            phone: client?.phone || '',
            dateOfBirth: client?.date_of_birth ? client.date_of_birth.split('T')[0] : '',
            emergencyContactName: client?.emergency_contact_name || '',
            emergencyContactPhone: client?.emergency_contact_phone || '',
            healthNotes: client?.health_notes || '',
        });
        setEditDialogOpen(true);
    };

    const updateProfileMutation = useMutation({
        mutationFn: async (data: typeof editForm) => {
            return await api.put(`/users/${id}`, {
                displayName: data.displayName,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth || null,
                emergencyContactName: data.emergencyContactName || null,
                emergencyContactPhone: data.emergencyContactPhone || null,
                healthNotes: data.healthNotes || null,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client', id] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast({ title: 'Datos actualizados', description: 'El perfil del alumno se ha actualizado correctamente.' });
            setEditDialogOpen(false);
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    // Birthday edit state
    const [editingBirthday, setEditingBirthday] = useState(false);
    const [birthdayValue, setBirthdayValue] = useState('');

    const updateBirthdayMutation = useMutation({
        mutationFn: async (dateOfBirth: string) => {
            return await api.put(`/users/${id}`, { dateOfBirth: dateOfBirth || null });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client', id] });
            toast({ title: 'Fecha de nacimiento actualizada' });
            setEditingBirthday(false);
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
        },
    });

    const onSubmitNote = (data: NoteForm) => {
        addNoteMutation.mutate(data);
    };

    if (isLoading) {
        return (
            <AuthGuard requiredRoles={['admin', 'instructor']}>
                <AdminLayout>
                    <div className="space-y-6">
                        <Skeleton className="h-8 w-64" />
                        <div className="grid md:grid-cols-3 gap-6">
                            <Skeleton className="h-64 md:col-span-1" />
                            <Skeleton className="h-64 md:col-span-2" />
                        </div>
                    </div>
                </AdminLayout>
            </AuthGuard>
        );
    }

    if (!client) {
        return (
            <AuthGuard requiredRoles={['admin', 'instructor']}>
                <AdminLayout>
                    <div className="text-center py-12">
                        <h2 className="text-xl font-semibold">Miembro no encontrado</h2>
                        <Button variant="link" onClick={() => navigate('/admin/members')}>
                            Volver a la lista
                        </Button>
                    </div>
                </AdminLayout>
            </AuthGuard>
        );
    }

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CL';
    };

    return (
        <AuthGuard requiredRoles={['admin', 'instructor']}>
            <AdminLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/members')} className="rounded-xl hover:bg-muted/50">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-heading font-bold">{client.display_name}</h1>
                            <p className="text-muted-foreground font-body flex items-center gap-2 text-sm">
                                Miembro desde {new Date(client.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button
                                variant="outline"
                                className="rounded-xl font-body border-border/60 hover:border-essenza-gold/50 hover:text-essenza-gold transition-colors"
                                onClick={openEditDialog}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar Datos
                            </Button>
                            <Button
                                variant="outline"
                                className="rounded-xl font-body border-border/60 hover:border-essenza-gold/50 hover:text-essenza-gold transition-colors"
                                onClick={() => navigate(`/admin/members/${id}/assign-membership`)}
                            >
                                <User className="mr-2 h-4 w-4" />
                                Inscripción Manual
                            </Button>

                            <MonthBookingDialog
                                userId={client.id}
                                userName={client.display_name}
                            />

                            <Button 
                                className="rounded-xl font-body bg-essenza-gold hover:bg-essenza-gold/90 text-white shadow-sm"
                                onClick={() => navigate(`/admin/members/${id}/physical-sale`)}
                            >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Venta en Físico
                            </Button>

                            {/* Botón Desactivar/Activar */}
                            <Button
                                variant="outline"
                                className={`rounded-xl font-body transition-colors ${
                                    client.is_active === false 
                                        ? 'border-essenza-olive/50 text-essenza-olive hover:bg-essenza-olive/10' 
                                        : 'border-orange-300/60 text-orange-600 hover:bg-orange-50'
                                }`}
                                onClick={() => toggleStatusMutation.mutate(client.is_active === false)}
                                disabled={toggleStatusMutation.isPending}
                            >
                                <Power className="mr-2 h-4 w-4" />
                                {client.is_active === false ? 'Activar' : 'Desactivar'}
                            </Button>

                            {/* Botón Eliminar con confirmación */}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="rounded-xl font-body border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="font-heading">¿Eliminar usuario permanentemente?</AlertDialogTitle>
                                        <AlertDialogDescription className="font-body">
                                            Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta de <strong>{client.display_name}</strong> y todos sus datos asociados (membresías, reservaciones, etc.).
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="rounded-xl font-body">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => deleteUserMutation.mutate()}
                                            className="bg-red-600 text-white hover:bg-red-700 rounded-xl font-body"
                                        >
                                            {deleteUserMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-12 gap-6">
                        {/* Sidebar / Profile Card */}
                        <div className="md:col-span-4 lg:col-span-3 space-y-6">
                            <Card className="rounded-2xl border-border/40 overflow-hidden">
                                <CardContent className="pt-6 flex flex-col items-center text-center">
                                    <Avatar className="h-24 w-24 mb-4 ring-2 ring-essenza-gold/20 ring-offset-2">
                                        <AvatarImage src={client.photo_url} />
                                        <AvatarFallback className="text-lg bg-essenza-gold/10 text-essenza-gold font-heading">{getInitials(client.display_name)}</AvatarFallback>
                                    </Avatar>
                                    <h2 className="text-xl font-heading font-bold">{client.display_name}</h2>

                                    {/* Account Status Badge */}
                                    {client.is_active === false && (
                                        <Badge variant="destructive" className="mt-2">
                                            <Power className="h-3 w-3 mr-1" />
                                            Usuario Desactivado
                                        </Badge>
                                    )}

                                    {/* Current Membership Status */}
                                    {client.currentMembership ? (
                                        <Badge className={`mt-2 ${statusColors[client.currentMembership.status] || ''}`}>
                                            {statusLabels[client.currentMembership.status] || client.currentMembership.status}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="mt-2 text-muted-foreground">
                                            Sin membresia
                                        </Badge>
                                    )}

                                    {/* Current Plan Info */}
                                    {client.currentMembership && (
                                        <div className="w-full mt-4 p-3.5 bg-essenza-olive/5 rounded-xl text-sm text-left border border-essenza-olive/10">
                                            <div className="flex items-center gap-2 font-semibold mb-2 font-heading">
                                                <CreditCard className="h-4 w-4 text-essenza-olive" /> Plan Actual
                                            </div>
                                            <p className="font-medium font-body">{client.currentMembership.plan_name}</p>
                                            <div className="text-muted-foreground mt-1 space-y-1 font-body">
                                                <p>Vence: {client.currentMembership.end_date
                                                    ? new Date(client.currentMembership.end_date).toLocaleDateString()
                                                    : 'Sin fecha'}</p>
                                                <p>
                                                    Creditos: {client.currentMembership.class_limit && client.currentMembership.class_limit > 0
                                                        ? `${client.currentMembership.classes_remaining ?? 0} / ${client.currentMembership.class_limit}`
                                                        : 'Ilimitado'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="w-full mt-6 space-y-4 text-left">
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground font-body">
                                            <Mail className="h-4 w-4 text-essenza-gold/70" />
                                            <span className="truncate">{client.email}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground font-body">
                                            <Phone className="h-4 w-4 text-essenza-gold/70" />
                                            <span>{client.phone}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground font-body">
                                            <Calendar className="h-4 w-4 text-essenza-gold/70" />
                                            {editingBirthday ? (
                                                <div className="flex items-center gap-1 flex-1">
                                                    <Input
                                                        type="date"
                                                        value={birthdayValue}
                                                        onChange={(e) => setBirthdayValue(e.target.value)}
                                                        className="h-7 text-xs"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                        onClick={() => updateBirthdayMutation.mutate(birthdayValue)}
                                                        disabled={updateBirthdayMutation.isPending}
                                                    >
                                                        <Check className="h-3 w-3 text-green-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                        onClick={() => setEditingBirthday(false)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span
                                                    className="cursor-pointer hover:text-foreground flex items-center gap-1 group"
                                                    onClick={() => {
                                                        setBirthdayValue(client.date_of_birth ? client.date_of_birth.split('T')[0] : '');
                                                        setEditingBirthday(true);
                                                    }}
                                                >
                                                    {client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString() : 'Sin fecha nac.'}
                                                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {client.health_notes && (
                                        <div className="w-full mt-6 p-3.5 bg-red-50 text-red-800 rounded-xl text-sm text-left border border-red-100">
                                            <div className="flex items-center gap-2 font-semibold mb-1 font-heading">
                                                <Heart className="h-4 w-4" /> Notas de Salud
                                            </div>
                                            <p className="font-body">{client.health_notes}</p>
                                        </div>
                                    )}

                                    {/* Loyalty Points */}
                                    <div className="w-full mt-4 p-3.5 bg-essenza-gold/5 text-essenza-gold rounded-xl text-sm text-left border border-essenza-gold/10">
                                        <p className="font-semibold font-heading">Puntos de Lealtad</p>
                                        <p className="text-2xl font-bold font-heading">{client.loyaltyPoints || 0}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Emergency Contact */}
                            {(client.emergency_contact_name || client.emergency_contact_phone) && (
                                <Card className="rounded-2xl border-border/40">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-heading font-medium">Contacto de Emergencia</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm space-y-2 font-body">
                                        <div className="font-medium">{client.emergency_contact_name}</div>
                                        <div className="text-muted-foreground">{client.emergency_contact_phone}</div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Main Content Area */}
                        <div className="md:col-span-8 lg:col-span-9 space-y-6">
                            <Tabs defaultValue="memberships">
                                <TabsList className="rounded-xl bg-muted/50">
                                    <TabsTrigger value="memberships" className="rounded-lg font-body data-[state=active]:bg-essenza-gold data-[state=active]:text-white">Membresias</TabsTrigger>
                                    <TabsTrigger value="history" className="rounded-lg font-body data-[state=active]:bg-essenza-gold data-[state=active]:text-white">Historial Clases</TabsTrigger>
                                    <TabsTrigger value="notes" className="rounded-lg font-body data-[state=active]:bg-essenza-gold data-[state=active]:text-white">Notas Internas</TabsTrigger>
                                </TabsList>

                                {/* Memberships Tab */}
                                <TabsContent value="memberships" className="space-y-4 mt-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-lg font-heading font-semibold">Historial de Membresias</h3>
                                    </div>

                                    {client.memberships?.length > 0 ? (
                                        <div className="space-y-3">
                                            {client.memberships.map((m: any) => (
                                                <Card key={m.id} className="rounded-xl border-border/40 hover:border-border/60 transition-colors">
                                                    <CardContent className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                                        <div>
                                                            <div className="font-semibold font-heading flex items-center gap-2">
                                                                {m.plan_name}
                                                                <Badge className={`rounded-lg text-xs font-body ${statusColors[m.status] || 'bg-muted'}`}>
                                                                    {statusLabels[m.status] || m.status}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-sm text-muted-foreground mt-1 font-body">
                                                                {m.start_date && m.end_date ? (
                                                                    <>
                                                                        Inicio: {new Date(m.start_date).toLocaleDateString()} -
                                                                        Fin: {new Date(m.end_date).toLocaleDateString()}
                                                                    </>
                                                                ) : (
                                                                    'Fechas pendientes'
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right font-body">
                                                            <div className="text-sm font-medium">
                                                                {m.class_limit && m.class_limit > 0 ?
                                                                    `${m.credits_remaining ?? m.classes_remaining ?? 0} / ${m.credits_total ?? m.class_limit} creditos` :
                                                                    'Ilimitado'
                                                                }
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                ${m.price_paid ?? m.plan_price ?? 0} MXN
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center border rounded-xl bg-muted/10 text-muted-foreground font-body border-dashed border-border/50">
                                            No hay historial de membresias.
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Notes Tab */}
                                <TabsContent value="notes" className="mt-4">
                                    <div className="space-y-6">
                                        <Card className="rounded-2xl border-border/40">
                                            <CardHeader>
                                                <CardTitle className="text-base font-heading">Agregar Nota</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <form onSubmit={handleSubmit(onSubmitNote)} className="space-y-4">
                                                    <Textarea
                                                        {...register('content')}
                                                        placeholder="Escribe una nota interna sobre el cliente..."
                                                        className="rounded-xl font-body"
                                                    />
                                                    <div className="flex justify-end">
                                                        <Button type="submit" disabled={isSubmitting} size="sm" className="rounded-xl font-body bg-essenza-gold hover:bg-essenza-gold/90">
                                                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                            Guardar Nota
                                                        </Button>
                                                    </div>
                                                </form>
                                            </CardContent>
                                        </Card>

                                        <div className="space-y-4">
                                            {client.notes?.length > 0 ? (
                                                client.notes.map((note: any) => (
                                                    <div key={note.id} className="flex gap-4 p-4 border border-border/40 rounded-xl bg-card hover:border-border/60 transition-colors">
                                                        <div className="h-8 w-8 rounded-lg bg-essenza-olive/10 flex items-center justify-center shrink-0">
                                                            <MessageSquare className="h-4 w-4 text-essenza-olive" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex justify-between items-start">
                                                                <div className="text-sm font-medium text-muted-foreground font-body">
                                                                    {note.author_name || 'Admin'} {note.created_by === user?.id ? '(Tu)' : ''}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground font-body">
                                                                    {new Date(note.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <p className="text-sm font-body">{note.note || note.content}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center border rounded-xl bg-muted/10 text-muted-foreground font-body border-dashed border-border/50">
                                                    No hay notas internas.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* History Tab */}
                                <TabsContent value="history" className="mt-4">
                                    <Card className="rounded-2xl border-border/40">
                                        <CardContent className="p-6">
                                            <h3 className="text-lg font-heading font-semibold mb-4">Clases Recientes</h3>
                                            {client.recentBookings?.length > 0 ? (
                                                <div className="space-y-3">
                                                    {client.recentBookings.map((b: any) => (
                                                        <div key={b.id} className="flex items-center justify-between p-3.5 bg-muted/20 rounded-xl border border-border/30 hover:border-border/50 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-8 w-8 rounded-lg bg-essenza-gold/10 flex items-center justify-center">
                                                                    <Calendar className="h-4 w-4 text-essenza-gold" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium font-body text-sm">{b.class_name}</div>
                                                                    <div className="text-xs text-muted-foreground font-body">
                                                                        {new Date(b.date).toLocaleDateString()} - {b.start_time?.substring(0, 5)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Badge className={`rounded-lg text-xs font-body ${statusColors[b.status] || 'bg-muted'}`}>
                                                                {b.status === 'confirmed' ? 'Confirmada' :
                                                                    b.status === 'checked_in' ? 'Asistió' :
                                                                        b.status === 'cancelled' ? 'Cancelada' :
                                                                            b.status === 'no_show' ? 'No asistió' :
                                                                                b.status}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-muted-foreground font-body text-sm">No hay clases registradas recientemente.</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>

                {/* Edit Profile Dialog */}
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent className="rounded-2xl sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="font-heading">Editar Datos del Alumno</DialogTitle>
                            <DialogDescription className="font-body">
                                Modifica los datos de {client.display_name}.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                updateProfileMutation.mutate(editForm);
                            }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="edit-name" className="font-body">Nombre completo</Label>
                                <Input
                                    id="edit-name"
                                    value={editForm.displayName}
                                    onChange={(e) => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                                    className="rounded-xl font-body"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-phone" className="font-body">Teléfono</Label>
                                <Input
                                    id="edit-phone"
                                    value={editForm.phone}
                                    onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                    className="rounded-xl font-body"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-dob" className="font-body">Fecha de nacimiento</Label>
                                <Input
                                    id="edit-dob"
                                    type="date"
                                    value={editForm.dateOfBirth}
                                    onChange={(e) => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                                    className="rounded-xl font-body"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-ec-name" className="font-body">Contacto emergencia</Label>
                                    <Input
                                        id="edit-ec-name"
                                        value={editForm.emergencyContactName}
                                        onChange={(e) => setEditForm(f => ({ ...f, emergencyContactName: e.target.value }))}
                                        placeholder="Nombre"
                                        className="rounded-xl font-body"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-ec-phone" className="font-body">Tel. emergencia</Label>
                                    <Input
                                        id="edit-ec-phone"
                                        value={editForm.emergencyContactPhone}
                                        onChange={(e) => setEditForm(f => ({ ...f, emergencyContactPhone: e.target.value }))}
                                        placeholder="Teléfono"
                                        className="rounded-xl font-body"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-health" className="font-body">Notas de salud</Label>
                                <Textarea
                                    id="edit-health"
                                    value={editForm.healthNotes}
                                    onChange={(e) => setEditForm(f => ({ ...f, healthNotes: e.target.value }))}
                                    placeholder="Alergias, lesiones, condiciones médicas..."
                                    className="rounded-xl font-body"
                                    rows={3}
                                />
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditDialogOpen(false)}
                                    className="rounded-xl font-body"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={updateProfileMutation.isPending}
                                    className="rounded-xl font-body bg-essenza-gold hover:bg-essenza-gold/90 text-white"
                                >
                                    {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Cambios
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </AdminLayout>
        </AuthGuard>
    );
}
