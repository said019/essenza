import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import api, { getErrorMessage } from '@/lib/api';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2, Calendar, Clock, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import type { BookingClient } from '@/types/booking';

export default function MyBookings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: bookings, isLoading } = useQuery<BookingClient[]>({
        queryKey: ['my-bookings'],
        queryFn: async () => (await api.get('/bookings/my-bookings')).data,
    });

    const cancelMutation = useMutation({
        mutationFn: async (bookingId: string) => {
            return await api.post(`/bookings/${bookingId}/cancel`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
            queryClient.invalidateQueries({ queryKey: ['classes-public'] }); // Refresh calendar
            toast({ title: 'Reserva cancelada', description: 'Tu crédito ha sido devuelto (si aplica).' });
        },
        onError: (err) => {
            toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
        },
    });

    const upcoming = bookings?.filter(b => !isPast(parseISO(`${b.date}T${b.end_time}`)) && b.booking_status !== 'cancelled') || [];
    const history = bookings?.filter(b => isPast(parseISO(`${b.date}T${b.end_time}`)) || b.booking_status === 'cancelled') || [];

    const BookingCard = ({ booking, isHistory = false }: { booking: BookingClient, isHistory?: boolean }) => (
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-card gap-4 overflow-hidden relative",
            booking.booking_status === 'cancelled' && "opacity-60 bg-muted/20"
        )}>
            {/* Color indicator bar */}
            {booking.class_type_color && (
                <div 
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: booking.class_type_color }}
                />
            )}
            <div className="flex gap-4 items-start pl-2">
                <div 
                    className="flex flex-col items-center justify-center min-w-[60px] p-2 rounded-md"
                    style={{ 
                        backgroundColor: booking.class_type_color ? `${booking.class_type_color}20` : 'hsl(var(--muted) / 0.2)',
                        color: booking.class_type_color || 'inherit'
                    }}
                >
                    <span className="text-xs uppercase font-medium">{format(parseISO(booking.date), 'MMM', { locale: es })}</span>
                    <span className="text-xl font-bold">{format(parseISO(booking.date), 'd')}</span>
                </div>
                <div>
                    <h3 className="font-semibold text-lg">{booking.class_type_name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
                        </div>
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {booking.instructor_name}
                        </div>
                    </div>
                    {booking.booking_status === 'cancelled' && <Badge variant="destructive" className="mt-2 text-[10px]">Cancelada</Badge>}
                    {booking.booking_status === 'checked_in' && <Badge variant="secondary" className="mt-2 text-[10px] bg-success/10 text-success">Asististe</Badge>}
                    {booking.booking_status === 'no_show' && <Badge variant="destructive" className="mt-2 text-[10px]">No asististe</Badge>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link to={`/app/classes/${booking.booking_id}`}>Ver detalle</Link>
                </Button>
                {!isHistory && booking.booking_status === 'confirmed' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                Cancelar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Si cancelas con anticipación, es posible que se te devuelva el crédito.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Volver</AlertDialogCancel>
                                <AlertDialogAction onClick={() => cancelMutation.mutate(booking.booking_id)} className="bg-destructive hover:bg-destructive/90">
                                    {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Sí, Cancelar
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        </div>
    );

    return (
        <AuthGuard requiredRoles={['client']}>
            <ClientLayout>
                <div className="space-y-6">
                    <h1 className="text-2xl font-bold font-heading">Mis Clases</h1>

                    <Tabs defaultValue="upcoming">
                        <TabsList>
                            <TabsTrigger value="upcoming">Próximas ({upcoming.length})</TabsTrigger>
                            <TabsTrigger value="history">Historial</TabsTrigger>
                        </TabsList>

                        <TabsContent value="upcoming" className="mt-4 space-y-4">
                            {isLoading && <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>}

                            {!isLoading && upcoming.length === 0 && (
                                <div className="text-center py-12 border rounded-lg bg-muted/10">
                                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-medium">No tienes clases próximas</h3>
                                    <p className="text-muted-foreground mb-4">Explora el calendario y reserva tu próxima sesión.</p>
                                    <Button asChild>
                                        <Link to="/app/book">Reservar Clase</Link>
                                    </Button>
                                </div>
                            )}

                            {upcoming.map(b => (
                                <BookingCard key={b.booking_id} booking={b} />
                            ))}
                        </TabsContent>

                        <TabsContent value="history" className="mt-4 space-y-4">
                            {!isLoading && history.length === 0 && (
                                <p className="text-center text-muted-foreground py-8">No tienes historial aún.</p>
                            )}
                            {history.map(b => (
                                <BookingCard key={b.booking_id} booking={b} isHistory />
                            ))}
                        </TabsContent>
                    </Tabs>
                </div>
            </ClientLayout>
        </AuthGuard>
    );
}
