import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '@/lib/api';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, Clock, User } from 'lucide-react';

interface BookingDetail {
  booking_id: string;
  booking_status: string;
  created_at: string;
  checked_in_at: string | null;
  class_date: string;
  class_start_time: string;
  class_end_time: string;
  class_name: string;
  class_type_color?: string;
  instructor_name: string;
}

const statusLabel: Record<string, string> = {
  confirmed: 'Confirmada',
  waitlist: 'Lista de espera',
  checked_in: 'Check-in',
  no_show: 'No show',
  cancelled: 'Cancelada',
};

export default function ClassBookingDetail() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<BookingDetail>({
    queryKey: ['booking-detail', bookingId],
    queryFn: async () => {
      const { data } = await api.get(`/bookings/${bookingId}`);
      return data;
    },
    enabled: Boolean(bookingId),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/bookings/${bookingId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      toast({ title: 'Reserva cancelada', description: 'Tu crédito ha sido devuelto (si aplica).' });
      navigate('/app/classes');
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(err) });
    },
  });

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-heading">Detalle de clase</h1>
              <p className="text-muted-foreground">Información de tu reserva.</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/app/classes">Volver</Link>
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : isError || !data ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No pudimos cargar la reserva.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden relative">
              {data.class_type_color && (
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: data.class_type_color }}
                />
              )}
              <CardHeader className="pl-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    {data.class_type_color && (
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: data.class_type_color }}
                      />
                    )}
                    {data.class_name}
                  </CardTitle>
                  <Badge variant="outline">{statusLabel[data.booking_status] || data.booking_status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pl-6">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">
                    {format(parseISO(data.class_date), 'EEEE d MMMM', { locale: es })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {data.class_start_time} - {data.class_end_time}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{data.instructor_name}</span>
                </div>
                {data.checked_in_at && (
                  <div className="text-xs text-muted-foreground">
                    Check-in: {new Date(data.checked_in_at).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {data?.booking_status === 'confirmed' && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar reserva'}
            </Button>
          )}
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
