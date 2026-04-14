import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
    ChevronLeft, 
    Clock, 
    MapPin, 
    Users, 
    CheckCircle2,
    AlertTriangle,
    UserCheck,
    Loader2,
    Phone,
    Mail,
    AlertCircle,
    QrCode,
    Camera,
    Search
} from 'lucide-react';
import CoachLayout from '@/components/layout/CoachLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface Attendee {
    booking_id: string;
    status: string;
    waitlist_position: number | null;
    checked_in_at: string | null;
    user_id: string;
    display_name: string;
    email: string;
    phone: string;
    photo_url: string | null;
    health_notes: string | null;
    instructor_notes: string | null;
    alert_flag: boolean;
    alert_message: string | null;
}

interface ClassDetail {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_bookings: number;
    status: string;
    notes: string | null;
    level: string | null;
    class_type_name: string;
    class_type_color: string;
    class_type_description: string;
    facility_name: string | null;
}

export default function CoachClassDetail() {
    const { classId } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
    const [checkingIn, setCheckingIn] = useState(false);
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
    const [qrResult, setQrResult] = useState<{ success: boolean; member?: { name: string }; message?: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');

    const isAdmin = user?.role === 'admin';

    // Get instructor ID (for non-admin coaches)
    const { data: instructorData } = useQuery({
        queryKey: ['instructor-by-user', user?.id],
        queryFn: async () => {
            const response = await api.get(`/instructors?all=true`);
            return response.data.find((i: any) => i.user_id === user?.id);
        },
        enabled: !!user?.id && !isAdmin,
    });

    // Fetch class details first (needed to get instructor_id for admin)
    const { data: classDetail, isLoading: loadingClass } = useQuery<ClassDetail & { instructor_id?: string }>({
        queryKey: ['class-detail', classId],
        queryFn: async () => {
            const response = await api.get(`/classes/${classId}`);
            return response.data;
        },
        enabled: !!classId,
    });

    // For admin: use the class's own instructor_id; for coaches: use their own
    const instructorId = isAdmin 
        ? (classDetail as any)?.instructor_id || instructorData?.id 
        : instructorData?.id;

    // Fetch attendees
    const { data: attendeesData, isLoading: loadingAttendees } = useQuery<{ confirmed: Attendee[]; waitlist: Attendee[] }>({
        queryKey: ['class-attendees', classId, instructorId],
        queryFn: async () => {
            const response = await api.get(`/instructors/${instructorId}/classes/${classId}/attendees`);
            return response.data;
        },
        enabled: !!classId && !!instructorId,
    });

    // Check-in mutation
    const checkinMutation = useMutation({
        mutationFn: async (bookingIds: string[]) => {
            return await api.post(`/instructors/${instructorId}/classes/${classId}/checkin`, {
                bookingIds,
            });
        },
        onSuccess: (data) => {
            toast({ title: 'Check-in exitoso', description: data.data.message });
            queryClient.invalidateQueries({ queryKey: ['class-attendees', classId] });
            setSelectedBookings([]);
        },
        onError: () => {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo registrar la asistencia' });
        },
    });

    // Mass check-in mutation
    const massCheckinMutation = useMutation({
        mutationFn: async () => {
            return await api.post(`/instructors/${instructorId}/classes/${classId}/checkin`, { all: true });
        },
        onSuccess: (data) => {
            toast({ title: 'Check-in masivo exitoso', description: data.data.message });
            queryClient.invalidateQueries({ queryKey: ['class-attendees', classId] });
        },
        onError: () => {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo registrar la asistencia' });
        },
    });

    // QR Check-in mutation
    const qrCheckinMutation = useMutation({
        mutationFn: async (qrPayload: string) => {
            return await api.post('/checkin/qr', { qrPayload });
        },
        onSuccess: (response) => {
            setQrResult(response.data);
            toast({ title: 'Check-in exitoso', description: response.data?.message || 'Asistencia registrada.' });
            queryClient.invalidateQueries({ queryKey: ['class-attendees', classId] });
        },
        onError: (err: any) => {
            setQrResult(null);
            const message = err.response?.data?.error || 'Error al procesar el QR';
            toast({ variant: 'destructive', title: 'Error', description: message });
        },
    });

    const handleCheckin = async () => {
        if (selectedBookings.length === 0) return;
        setCheckingIn(true);
        try {
            await checkinMutation.mutateAsync(selectedBookings);
        } finally {
            setCheckingIn(false);
        }
    };

    const handleMassCheckin = async () => {
        setCheckingIn(true);
        try {
            await massCheckinMutation.mutateAsync();
        } finally {
            setCheckingIn(false);
        }
    };

    const toggleBooking = (bookingId: string) => {
        setSelectedBookings((prev) =>
            prev.includes(bookingId)
                ? prev.filter((id) => id !== bookingId)
                : [...prev, bookingId]
        );
    };

    const selectAll = () => {
        const notCheckedIn = attendeesData?.confirmed
            .filter((a) => a.status !== 'checked_in')
            .map((a) => a.booking_id) || [];
        setSelectedBookings(notCheckedIn);
    };

    const handleQrScan = (result: { rawValue: string }[]) => {
        if (result && result.length > 0) {
            const qrPayload = result[0].rawValue;
            qrCheckinMutation.mutate(qrPayload);
        }
    };

    const handleManualQrSubmit = (payload: string) => {
        if (payload.trim()) {
            qrCheckinMutation.mutate(payload.trim());
        }
    };

    const getInitials = (name: string) => 
        name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

    const formatTime = (time: string) => time?.substring(0, 5) || '';

    const confirmed = attendeesData?.confirmed || [];
    const waitlist = attendeesData?.waitlist || [];
    const checkedInCount = confirmed.filter((a) => a.status === 'checked_in').length;
    const pendingCount = confirmed.filter((a) => a.status === 'confirmed').length;

    // Filter attendees by search
    const filteredConfirmed = confirmed.filter((a) => 
        a.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.phone.includes(searchQuery)
    );

    if (loadingClass) {
        return (
            <AuthGuard requiredRoles={['instructor', 'admin']}>
                <CoachLayout>
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                </CoachLayout>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard requiredRoles={['instructor', 'admin']}>
            <CoachLayout>
                <div className="space-y-6">
                    {/* Back Button */}
                    <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Volver
                    </Button>

                    {/* Class Header */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div 
                                        className="w-2 h-16 rounded-full"
                                        style={{ backgroundColor: classDetail?.class_type_color || '#6B7280' }}
                                    />
                                    <div>
                                        <h1 className="font-heading text-2xl font-bold">
                                            {classDetail?.class_type_name}
                                        </h1>
                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                {classDetail && format(parseISO(classDetail.date), "EEEE d 'de' MMMM", { locale: es })}
                                            </span>
                                            <span>
                                                {formatTime(classDetail?.start_time || '')} - {formatTime(classDetail?.end_time || '')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-4 w-4" />
                                                {classDetail?.facility_name || 'Sala Principal'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-3xl font-bold text-primary">
                                            {classDetail?.current_bookings}/{classDetail?.max_capacity}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Reservados</p>
                                    </div>
                                    {classDetail && classDetail.current_bookings >= classDetail.max_capacity && (
                                        <Badge className="bg-success">
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Lleno
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Attendees */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Asistentes ({confirmed.length})
                                    </CardTitle>
                                    <CardDescription>
                                        {checkedInCount} registrados • {pendingCount} pendientes
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {/* QR Scanner Button */}
                                    <Button 
                                        size="sm" 
                                        variant="secondary"
                                        onClick={() => {
                                            setIsQrScannerOpen(true);
                                            setQrResult(null);
                                        }}
                                        className="bg-primary/10 hover:bg-primary/20 text-primary"
                                    >
                                        <QrCode className="h-4 w-4 mr-2" />
                                        Escanear QR
                                    </Button>
                                    
                                    {pendingCount > 0 && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={selectAll}>
                                                Seleccionar pendientes
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                onClick={handleMassCheckin}
                                                disabled={checkingIn || pendingCount === 0}
                                            >
                                                {checkingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                <UserCheck className="h-4 w-4 mr-2" />
                                                Check-in todos
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            {/* Search Bar */}
                            <div className="relative mt-4">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nombre, email o teléfono..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingAttendees ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : confirmed.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No hay asistentes registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredConfirmed.map((attendee) => {
                                        const isCheckedIn = attendee.status === 'checked_in';
                                        const isSelected = selectedBookings.includes(attendee.booking_id);

                                        return (
                                            <div
                                                key={attendee.booking_id}
                                                className={`flex items-center gap-4 p-3 rounded-lg border ${
                                                    isCheckedIn ? 'bg-success/10 border-success/30' : 'hover:bg-muted/50'
                                                }`}
                                            >
                                                {!isCheckedIn && (
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleBooking(attendee.booking_id)}
                                                    />
                                                )}
                                                {isCheckedIn && (
                                                    <CheckCircle2 className="h-5 w-5 text-success" />
                                                )}

                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={attendee.photo_url || undefined} />
                                                    <AvatarFallback>{getInitials(attendee.display_name)}</AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium truncate">{attendee.display_name}</p>
                                                        {attendee.alert_flag && (
                                                            <Badge variant="destructive" className="shrink-0">
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                                {attendee.alert_message || 'Alerta'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Mail className="h-3 w-3" />
                                                            {attendee.email}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="h-3 w-3" />
                                                            {attendee.phone}
                                                        </span>
                                                    </div>
                                                    {(attendee.health_notes || attendee.instructor_notes) && (
                                                        <p className="text-xs text-warning mt-1 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {attendee.instructor_notes || attendee.health_notes}
                                                        </p>
                                                    )}
                                                </div>

                                                {!isCheckedIn && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => checkinMutation.mutate([attendee.booking_id])}
                                                        disabled={checkinMutation.isPending}
                                                    >
                                                        Check-in
                                                    </Button>
                                                )}
                                                {isCheckedIn && (
                                                    <span className="text-xs text-success">
                                                        {attendee.checked_in_at && format(new Date(attendee.checked_in_at), 'HH:mm')}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Selected Actions */}
                            {selectedBookings.length > 0 && (
                                <div className="mt-4 p-4 bg-primary/5 rounded-lg flex items-center justify-between">
                                    <span className="text-sm">
                                        {selectedBookings.length} seleccionados
                                    </span>
                                    <Button onClick={handleCheckin} disabled={checkingIn}>
                                        {checkingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        Registrar asistencia
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Waitlist */}
                    {waitlist.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Lista de Espera ({waitlist.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {waitlist.map((attendee, index) => (
                                        <div
                                            key={attendee.booking_id}
                                            className="flex items-center gap-4 p-3 rounded-lg border bg-warning/10/50"
                                        >
                                            <span className="text-sm font-medium text-muted-foreground w-6">
                                                #{index + 1}
                                            </span>
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={attendee.photo_url || undefined} />
                                                <AvatarFallback className="text-xs">
                                                    {getInitials(attendee.display_name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{attendee.display_name}</p>
                                                <p className="text-xs text-muted-foreground">{attendee.phone}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* QR Scanner Dialog */}
                <Dialog 
                    open={isQrScannerOpen} 
                    onOpenChange={(open) => {
                        setIsQrScannerOpen(open);
                        if (!open) {
                            setQrResult(null);
                            setScanMode('camera');
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <QrCode className="h-5 w-5" />
                                Escanear QR del Pase
                            </DialogTitle>
                            <DialogDescription>
                                Escanea el código QR del pase de Wallet del cliente para registrar su asistencia.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Mode Toggle */}
                        <div className="flex gap-2 mb-4">
                            <Button
                                variant={scanMode === 'camera' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setScanMode('camera')}
                                className="flex-1"
                            >
                                <Camera className="h-4 w-4 mr-2" />
                                Cámara
                            </Button>
                            <Button
                                variant={scanMode === 'manual' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setScanMode('manual')}
                                className="flex-1"
                            >
                                <QrCode className="h-4 w-4 mr-2" />
                                Manual
                            </Button>
                        </div>

                        {/* Camera Scanner */}
                        {scanMode === 'camera' && (
                            <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
                                <Scanner
                                    onScan={handleQrScan}
                                    onError={(error) => {
                                        console.error('QR Scanner error:', error);
                                        toast({ 
                                            variant: 'destructive', 
                                            title: 'Error de cámara', 
                                            description: 'No se pudo acceder a la cámara. Intenta el modo manual.' 
                                        });
                                    }}
                                    styles={{
                                        container: { width: '100%', height: '100%' },
                                        video: { width: '100%', height: '100%', objectFit: 'cover' }
                                    }}
                                />
                                {qrCheckinMutation.isPending && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Manual Input */}
                        {scanMode === 'manual' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Código QR</Label>
                                    <Input
                                        id="qrPayload"
                                        placeholder="Pega el contenido del QR aquí"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleManualQrSubmit((e.target as HTMLInputElement).value);
                                            }
                                        }}
                                    />
                                </div>
                                <Button 
                                    className="w-full"
                                    onClick={() => {
                                        const input = document.getElementById('qrPayload') as HTMLInputElement;
                                        handleManualQrSubmit(input?.value || '');
                                    }}
                                    disabled={qrCheckinMutation.isPending}
                                >
                                    {qrCheckinMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Verificar y Registrar
                                </Button>
                            </div>
                        )}

                        {/* Result */}
                        {qrResult?.success && (
                            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
                                <div className="flex items-center gap-2 text-success font-medium">
                                    <CheckCircle2 className="h-5 w-5" />
                                    Check-in exitoso
                                </div>
                                {qrResult.member && (
                                    <p className="text-success mt-1">
                                        {qrResult.member.name}
                                    </p>
                                )}
                                {qrResult.message && (
                                    <p className="text-success/80 text-xs mt-1">
                                        {qrResult.message}
                                    </p>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <Button 
                                variant="outline" 
                                onClick={() => setIsQrScannerOpen(false)}
                            >
                                Cerrar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CoachLayout>
        </AuthGuard>
    );
}
