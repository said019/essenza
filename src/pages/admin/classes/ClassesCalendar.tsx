import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import api, { getErrorMessage } from '@/lib/api';
import type { Class, ClassType, Instructor } from '@/types/class';
import { AdminLayout } from '@/components/layout/AdminLayout';

// Type for Facility
interface Facility {
    id: string;
    name: string;
    description: string | null;
    capacity: number;
    is_active: boolean;
}
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
    Plus, Repeat, Users, Trash2, QrCode, Check, X, Edit, Phone, Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const generateSchema = z.object({
    startDate: z.date(),
    endDate: z.date(),
});

const classSchema = z.object({
    date: z.date(),
    classTypeId: z.string().uuid(),
    instructorId: z.string().uuid(),
    facilityId: z.string().uuid().optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    maxCapacity: z.coerce.number().int().positive(),
});

const editClassSchema = z.object({
    classTypeId: z.string().uuid(),
    instructorId: z.string().uuid(),
    facilityId: z.string().uuid().optional(),
    date: z.date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    maxCapacity: z.coerce.number().int().positive(),
});

type GenerateForm = z.infer<typeof generateSchema>;
type ClassForm = z.infer<typeof classSchema>;
type EditClassForm = z.infer<typeof editClassSchema>;

const qrSchema = z.object({
    qrPayload: z.string().min(1, 'Escanea o pega el QR'),
});

type QrForm = z.infer<typeof qrSchema>;

interface Attendee {
    booking_id: string;
    status: string;
    checked_in_at: string | null;
    user_id: string;
    display_name: string;
    email: string;
    photo_url: string | null;
    phone: string;
    plan_name: string | null;
}

interface ClassesCalendarProps {
    initialGenerateOpen?: boolean;
}

export default function ClassesCalendar({ initialGenerateOpen = false }: ClassesCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const [isGenerateOpen, setIsGenerateOpen] = useState(initialGenerateOpen);
    const [isClassOpen, setIsClassOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isQrOpen, setIsQrOpen] = useState(false);
    const [isAttendeesOpen, setIsAttendeesOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [qrResult, setQrResult] = useState<any>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useEffect(() => {
        setWeekStart(startOfWeek(currentDate, { weekStartsOn: 0 }));
    }, [currentDate]);

    const { data: classTypes } = useQuery<ClassType[]>({
        queryKey: ['class-types'],
        queryFn: async () => (await api.get('/class-types')).data,
    });

    const { data: instructors } = useQuery<Instructor[]>({
        queryKey: ['instructors'],
        queryFn: async () => (await api.get('/instructors')).data,
    });

    const { data: facilities } = useQuery<Facility[]>({
        queryKey: ['facilities'],
        queryFn: async () => (await api.get('/facilities')).data,
    });

    const { data: attendees, isLoading: attendeesLoading, refetch: refetchAttendees } = useQuery<Attendee[]>({
        queryKey: ['attendees', selectedClass?.id],
        queryFn: async () => (await api.get(`/bookings/class/${selectedClass?.id}`)).data,
        enabled: !!selectedClass?.id && isAttendeesOpen,
    });

    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const { data: classes, isLoading } = useQuery<Class[]>({
        queryKey: ['classes', startStr, endStr],
        queryFn: async () => {
            const { data } = await api.get(`/classes?start=${startStr}&end=${endStr}`);
            return data;
        },
    });

    // Closed days for visual indicator
    const { data: closedDays = [] } = useQuery<{ id: string; date: string; reason: string }[]>({
        queryKey: ['closed-days-range', startStr, endStr],
        queryFn: async () => (await api.get(`/closed-days/range?start=${startStr}&end=${endStr}`)).data,
    });
    const closedDaySet = new Set(closedDays.map(d => d.date));
    const getClosedReason = (day: Date) => closedDays.find(d => d.date === format(day, 'yyyy-MM-dd'))?.reason;

    // Mutations
    const generateMutation = useMutation({
        mutationFn: async (data: GenerateForm) => {
            return await api.post('/classes/generate', {
                startDate: format(data.startDate, 'yyyy-MM-dd'),
                endDate: format(data.endDate, 'yyyy-MM-dd'),
            });
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            toast({ title: 'Generacion completada', description: `${data.data.count} clases creadas.` });
            setIsGenerateOpen(false);
            setCurrentDate(variables.startDate);
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) }),
    });

    const createMutation = useMutation({
        mutationFn: async (data: ClassForm) => {
            return await api.post('/classes', {
                ...data,
                date: format(data.date, 'yyyy-MM-dd'),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            toast({ title: 'Clase creada', description: 'La clase se agrego al calendario.' });
            setIsClassOpen(false);
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) }),
    });

    const editMutation = useMutation({
        mutationFn: async (data: EditClassForm & { id: string }) => {
            const { id, ...rest } = data;
            return await api.put(`/classes/${id}`, {
                classTypeId: rest.classTypeId,
                instructorId: rest.instructorId,
                facilityId: rest.facilityId || null,
                date: format(rest.date, 'yyyy-MM-dd'),
                startTime: rest.startTime,
                endTime: rest.endTime,
                maxCapacity: rest.maxCapacity,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            toast({ title: 'Clase actualizada', description: 'Los cambios se guardaron correctamente.' });
            setIsEditOpen(false);
            setSelectedClass(null);
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) }),
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: string) => api.delete(`/classes/${id}`),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            const data = response.data;
            toast({
                title: 'Clase cancelada',
                description: `${data.cancelledBookings || 0} reservas canceladas, ${data.refundedCredits || 0} creditos reembolsados.`
            });
            setIsAttendeesOpen(false);
            setSelectedClass(null);
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) }),
    });

    const checkInMutation = useMutation({
        mutationFn: async (bookingId: string) => {
            return await api.post(`/bookings/${bookingId}/check-in`);
        },
        onSuccess: () => {
            refetchAttendees();
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            toast({ title: 'Check-in realizado', description: 'Asistencia registrada.' });
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) }),
    });

    const qrCheckinMutation = useMutation({
        mutationFn: async (data: QrForm) => api.post('/checkin/qr', data),
        onSuccess: (response) => {
            setQrResult(response.data);
            toast({ title: 'Check-in realizado', description: response.data?.message || 'Asistencia registrada.' });
        },
        onError: (err) => {
            setQrResult(null);
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
        },
    });

    // Forms
    // Calculate next full week (Sunday to Saturday)
    const nextSunday = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 0 });
    const nextSaturday = addDays(nextSunday, 6);

    const generateForm = useForm<GenerateForm>({
        resolver: zodResolver(generateSchema),
        defaultValues: {
            startDate: nextSunday,
            endDate: nextSaturday
        }
    });

    const classForm = useForm<ClassForm>({
        resolver: zodResolver(classSchema),
        defaultValues: { maxCapacity: 8 }
    });

    const editForm = useForm<EditClassForm>({
        resolver: zodResolver(editClassSchema),
    });

    const qrForm = useForm<QrForm>({
        resolver: zodResolver(qrSchema),
        defaultValues: { qrPayload: '' }
    });

    const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
    const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const handleToday = () => setCurrentDate(new Date());

    const handleDayClick = (day: Date) => {
        classForm.reset({ date: day, maxCapacity: 8, startTime: '09:00', endTime: '10:00' });
        setIsClassOpen(true);
    };

    const handleClassClick = (c: Class) => {
        setSelectedClass(c);
        setIsAttendeesOpen(true);
    };

    const handleEditClass = () => {
        if (!selectedClass) return;
        editForm.reset({
            classTypeId: selectedClass.class_type_id || '',
            instructorId: selectedClass.instructor_id || '',
            facilityId: selectedClass.facility_id || undefined,
            date: parseISO((selectedClass.date || '').split('T')[0] + 'T00:00:00'),
            startTime: selectedClass.start_time,
            endTime: selectedClass.end_time,
            maxCapacity: selectedClass.max_capacity,
        });
        setIsEditOpen(true);
    };

    const getClassesForDay = (day: Date) => {
        // Parse date safely — handle both "YYYY-MM-DD" and "YYYY-MM-DDT00:00:00.000Z" formats
        return classes?.filter(c => {
            const dateStr = (c.date || '').split('T')[0]; // Extract YYYY-MM-DD from any format
            return isSameDay(parseISO(dateStr + 'T00:00:00'), day);
        }) || [];
    };

    const getInitials = (name: string) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
    };

    const confirmedCount = attendees?.filter(a => a.status === 'confirmed' || a.status === 'checked_in').length || 0;
    const checkedInCount = attendees?.filter(a => a.status === 'checked_in').length || 0;

    const bulkDeleteMutation = useMutation({
        mutationFn: async () => {
            return await api.post('/classes/bulk-delete', {
                startDate: startStr,
                endDate: endStr
            });
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            toast({
                title: 'Calendario limpiado',
                description: res.data.message
            });
        },
        onError: (err) => toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) }),
    });

    // ... existing logic ...

    return (
        <AuthGuard requiredRoles={['admin', 'instructor']}>
            <AdminLayout>
                <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-heading font-bold capitalize">
                                {format(currentDate, 'MMMM yyyy', { locale: es })}
                            </h1>
                            <div className="flex items-center border rounded-md bg-card ml-4">
                                <Button variant="ghost" size="icon" onClick={handlePrevWeek}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" className="px-3" onClick={handleToday}>
                                    Hoy
                                </Button>
                                <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsQrOpen(true)}>
                                <QrCode className="mr-2 h-4 w-4" /> Check-in QR
                            </Button>

                            <Button
                                variant="outline"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                onClick={() => {
                                    if (confirm('¿Estás seguro de BORRAR todas las clases vacías de esta semana visible?')) {
                                        bulkDeleteMutation.mutate();
                                    }
                                }}
                                disabled={bulkDeleteMutation.isPending}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {bulkDeleteMutation.isPending ? 'Borrando...' : 'Limpiar Semana'}
                            </Button>

                            <Button variant="outline" onClick={() => setIsGenerateOpen(true)}>
                                <Repeat className="mr-2 h-4 w-4" /> Generar Semanal
                            </Button>
                            <Button onClick={() => handleDayClick(new Date())}>
                                <Plus className="mr-2 h-4 w-4" /> Nueva Clase
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
                        {/* Header Days */}
                        <div className="grid grid-cols-7 border-b divide-x">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const day = addDays(weekStart, i);
                                const isToday = isSameDay(day, new Date());
                                const isClosed = closedDaySet.has(format(day, 'yyyy-MM-dd'));
                                return (
                                    <div key={i} className={cn("p-3 text-center", isToday && "bg-primary/5", isClosed && "bg-destructive/5")}>
                                        <div className="text-sm font-medium text-muted-foreground">{DAYS[i]}</div>
                                        <div className={cn("text-xl font-bold rounded-full w-8 h-8 mx-auto flex items-center justify-center mt-1", isToday && "bg-primary text-primary-foreground")}>
                                            {format(day, 'd')}
                                        </div>
                                        {isClosed && (
                                            <div className="text-[10px] font-semibold text-destructive mt-1">Cerrado</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 flex-1 divide-x overflow-y-auto">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const day = addDays(weekStart, i);
                                const dayClasses = getClassesForDay(day);
                                const isClosed = closedDaySet.has(format(day, 'yyyy-MM-dd'));
                                const closedReason = getClosedReason(day);
                                return (
                                    <div key={i} className={cn("min-h-[500px] p-2 space-y-2 hover:bg-muted/10 transition-colors", isClosed && "bg-destructive/5")}>
                                        {isClosed && (
                                            <div className="text-xs text-destructive font-medium text-center py-1.5 bg-destructive/10 rounded-md">
                                                {closedReason || 'Cerrado'}
                                            </div>
                                        )}
                                        {dayClasses.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleClassClick(c)}
                                                className={cn(
                                                    "p-2 rounded-md border text-sm shadow-sm transition-all hover:shadow-md cursor-pointer group hover:scale-[1.02]",
                                                    c.status === 'cancelled' ? "opacity-50 bg-muted" : "bg-card"
                                                )}
                                                style={{ borderLeftColor: c.class_type_color || '#ccc', borderLeftWidth: '4px' }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="font-semibold">{c.start_time}</div>
                                                    {c.status === 'cancelled' && (
                                                        <Badge variant="destructive" className="text-[10px] h-4">Cancelada</Badge>
                                                    )}
                                                </div>
                                                <div className="font-medium truncate mt-1">{c.class_type_name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{c.instructor_name}</div>
                                                <div className="text-xs mt-2 flex items-center justify-between">
                                                    <span className="flex items-center gap-1 text-muted-foreground">
                                                        <Users className="h-3 w-3" /> {c.current_bookings}/{c.max_capacity}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        <Button
                                            variant="ghost"
                                            className="w-full h-8 text-xs border-dashed border opacity-0 hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDayClick(day);
                                            }}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Attendees Sheet */}
                    <Sheet open={isAttendeesOpen} onOpenChange={setIsAttendeesOpen}>
                        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    {selectedClass?.class_type_name}
                                    {selectedClass?.status === 'cancelled' && (
                                        <Badge variant="destructive">Cancelada</Badge>
                                    )}
                                </SheetTitle>
                                <SheetDescription>
                                    {selectedClass && format(parseISO((selectedClass.date || '').split('T')[0] + 'T00:00:00'), 'EEEE d MMMM', { locale: es })} - {selectedClass?.start_time} a {selectedClass?.end_time}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="mt-6 space-y-6">
                                {/* Class Info */}
                                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Instructor</p>
                                        <p className="font-medium">{selectedClass?.instructor_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted-foreground">Capacidad</p>
                                        <p className="font-medium">{selectedClass?.current_bookings}/{selectedClass?.max_capacity}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                {selectedClass?.status !== 'cancelled' && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1" onClick={handleEditClass}>
                                            <Edit className="mr-2 h-4 w-4" /> Editar
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="flex-1"
                                            onClick={() => {
                                                if (confirm('¿Cancelar esta clase? Se cancelaran todas las reservas y se reembolsaran los creditos.')) {
                                                    cancelMutation.mutate(selectedClass.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" /> Cancelar Clase
                                        </Button>
                                    </div>
                                )}

                                {/* Attendees Stats */}
                                <div className="flex gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-info" />
                                        <span>Confirmados: {confirmedCount}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-success" />
                                        <span>Check-in: {checkedInCount}</span>
                                    </div>
                                </div>

                                {/* Attendees List */}
                                <div className="space-y-3">
                                    <h3 className="font-semibold">Asistentes</h3>
                                    {attendeesLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                        </div>
                                    ) : attendees?.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No hay reservas para esta clase.
                                        </div>
                                    ) : (
                                        attendees?.map((attendee) => (
                                            <div
                                                key={attendee.booking_id}
                                                className={cn(
                                                    "flex items-center justify-between p-3 border rounded-lg",
                                                    attendee.status === 'checked_in' && "bg-success/10 border-success/30"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={attendee.photo_url || undefined} />
                                                        <AvatarFallback>{getInitials(attendee.display_name)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{attendee.display_name}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {attendee.plan_name && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    {attendee.plan_name}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Phone className="h-3 w-3" /> {attendee.phone}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {attendee.status === 'checked_in' ? (
                                                        <Badge className="bg-success">
                                                            <Check className="h-3 w-3 mr-1" /> Check-in
                                                        </Badge>
                                                    ) : attendee.status === 'confirmed' ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => checkInMutation.mutate(attendee.booking_id)}
                                                            disabled={checkInMutation.isPending}
                                                        >
                                                            {checkInMutation.isPending ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Check className="h-4 w-4 mr-1" /> Check-in
                                                                </>
                                                            )}
                                                        </Button>
                                                    ) : (
                                                        <Badge variant="secondary">{attendee.status}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Generate Dialog */}
                    <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Generar Clases</DialogTitle>
                                <DialogDescription>
                                    Crea clases masivamente usando la Plantilla Semanal.
                                    Las clases existentes no se duplicaran.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={generateForm.handleSubmit(d => generateMutation.mutate(d))} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Fecha Inicio</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {format(generateForm.watch('startDate'), 'P', { locale: es })}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={generateForm.watch('startDate')}
                                                    onSelect={(d) => d && generateForm.setValue('startDate', d)}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha Fin</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {format(generateForm.watch('endDate'), 'P', { locale: es })}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={generateForm.watch('endDate')}
                                                    onSelect={(d) => d && generateForm.setValue('endDate', d)}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsGenerateOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={generateMutation.isPending}>
                                        {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Generar
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Create Class Dialog */}
                    <Dialog open={isClassOpen} onOpenChange={setIsClassOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Nueva Clase</DialogTitle>
                                <DialogDescription>Agrega una clase individual al calendario.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={classForm.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {classForm.watch('date') ? format(classForm.watch('date'), 'P', { locale: es }) : 'Seleccionar'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={classForm.watch('date')}
                                                onSelect={(d) => d && classForm.setValue('date', d)}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipo de Clase</Label>
                                    <Select onValueChange={(val) => classForm.setValue('classTypeId', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar tipo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classTypes?.map(ct => (
                                                <SelectItem key={ct.id} value={ct.id}>
                                                    {ct.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Instructor</Label>
                                    <Select onValueChange={(val) => classForm.setValue('instructorId', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar instructor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {instructors?.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id}>
                                                    {inst.display_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Sala</Label>
                                    <Select onValueChange={(val) => classForm.setValue('facilityId', val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar sala (opcional)..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {facilities?.map(f => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.name} ({f.capacity} lugares)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Inicio</Label>
                                        <Input type="time" {...classForm.register('startTime')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fin</Label>
                                        <Input type="time" {...classForm.register('endTime')} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Capacidad</Label>
                                    <Input type="number" {...classForm.register('maxCapacity')} />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsClassOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={createMutation.isPending}>
                                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Crear Clase
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Class Dialog */}
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Editar Clase</DialogTitle>
                                <DialogDescription>Modifica los detalles de la clase.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={editForm.handleSubmit(d => selectedClass && editMutation.mutate({ ...d, id: selectedClass.id }))} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {editForm.watch('date') ? format(editForm.watch('date'), 'P', { locale: es }) : 'Seleccionar'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={editForm.watch('date')}
                                                onSelect={(d) => d && editForm.setValue('date', d)}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipo de Clase</Label>
                                    <Select
                                        value={editForm.watch('classTypeId')}
                                        onValueChange={(val) => editForm.setValue('classTypeId', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar tipo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classTypes?.map(ct => (
                                                <SelectItem key={ct.id} value={ct.id}>
                                                    {ct.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Instructor</Label>
                                    <Select
                                        value={editForm.watch('instructorId')}
                                        onValueChange={(val) => editForm.setValue('instructorId', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar instructor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {instructors?.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id}>
                                                    {inst.display_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Sala</Label>
                                    <Select
                                        value={editForm.watch('facilityId') || ''}
                                        onValueChange={(val) => editForm.setValue('facilityId', val || undefined)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar sala (opcional)..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {facilities?.map(f => (
                                                <SelectItem key={f.id} value={f.id}>
                                                    {f.name} ({f.capacity} lugares)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Inicio</Label>
                                        <Input type="time" {...editForm.register('startTime')} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fin</Label>
                                        <Input type="time" {...editForm.register('endTime')} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Capacidad</Label>
                                    <Input type="number" {...editForm.register('maxCapacity')} />
                                </div>

                                <DialogFooter>
                                    <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={editMutation.isPending}>
                                        {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Guardar Cambios
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* QR Check-in Dialog */}
                    <Dialog
                        open={isQrOpen}
                        onOpenChange={(open) => {
                            setIsQrOpen(open);
                            if (!open) {
                                setQrResult(null);
                                qrForm.reset();
                            }
                        }}
                    >
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Check-in con QR</DialogTitle>
                                <DialogDescription>
                                    Escanea o pega el QR del pase del cliente para registrar asistencia.
                                </DialogDescription>
                            </DialogHeader>
                            <form
                                onSubmit={qrForm.handleSubmit((data) => qrCheckinMutation.mutate(data))}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label>QR Payload</Label>
                                    <Textarea
                                        rows={4}
                                        placeholder="Pega el contenido del QR aqui"
                                        {...qrForm.register('qrPayload')}
                                    />
                                    {qrForm.formState.errors.qrPayload && (
                                        <p className="text-xs text-destructive">
                                            {qrForm.formState.errors.qrPayload.message}
                                        </p>
                                    )}
                                </div>

                                {qrResult?.success && qrResult.member && qrResult.class && (
                                    <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                                        <div className="font-medium">Check-in exitoso: {qrResult.member.name}</div>
                                        <div>
                                            {qrResult.class.name} - {qrResult.class.date} - {qrResult.class.start_time}
                                        </div>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsQrOpen(false)}
                                    >
                                        Cerrar
                                    </Button>
                                    <Button type="submit" disabled={qrCheckinMutation.isPending}>
                                        {qrCheckinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Registrar Check-in
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
