import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/components/ui/use-toast';
import api, { getErrorMessage } from '@/lib/api';
import type { BookingAdmin } from '@/types/booking';
import { CheckCircle2, Loader2, Search } from 'lucide-react';

interface BookingsListProps {
  title?: string;
  description?: string;
  initialStatus?: string;
  statusLocked?: boolean;
}

const statusLabel: Record<string, string> = {
  confirmed: 'Confirmada',
  waitlist: 'Lista de espera',
  checked_in: 'Check-in',
  no_show: 'No show',
  cancelled: 'Cancelada',
};

const statusStyles: Record<string, string> = {
  confirmed: 'bg-success/10 text-success border-success/30',
  waitlist: 'bg-warning/10 text-warning border-warning/30',
  checked_in: 'bg-info/10 text-info border-info/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function BookingsList({
  title = 'Reservas',
  description = 'Gestión de reservas y check-ins.',
  initialStatus = 'all',
  statusLocked = false,
}: BookingsListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<BookingAdmin[]>({
    queryKey: ['admin-bookings', status, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      const { data } = await api.get(`/bookings?${params.toString()}`);
      return data;
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (bookingId: string) => api.post(`/bookings/${bookingId}/check-in`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({ title: 'Check-in realizado', description: 'Asistencia registrada.' });
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Error', description: getErrorMessage(error) });
    },
  });

  const bookings = useMemo(() => data || [], [data]);

  return (
    <AuthGuard requiredRoles={['admin', 'instructor']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o clase..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={status} onValueChange={setStatus} disabled={statusLocked}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="confirmed">Confirmadas</SelectItem>
                <SelectItem value="waitlist">Lista de espera</SelectItem>
                <SelectItem value="checked_in">Check-in</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="no_show">No show</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Clase</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Check-in</TableHead>
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
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No se encontraron reservas.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.booking_id}>
                      <TableCell>
                        <div className="font-medium">{booking.user_name}</div>
                        <div className="text-xs text-muted-foreground">{booking.user_email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{booking.class_name}</div>
                        <div className="text-xs text-muted-foreground">{booking.instructor_name}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {format(parseISO(booking.class_date), "EEE d MMM", { locale: es })}
                        </div>
                        <div className="text-muted-foreground">
                          {booking.class_start_time?.slice(0, 5)} - {booking.class_end_time?.slice(0, 5)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[booking.booking_status]}>
                          {statusLabel[booking.booking_status] || booking.booking_status}
                        </Badge>
                        {booking.booking_status === 'waitlist' && booking.waitlist_position !== null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Posición #{booking.waitlist_position}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {booking.checked_in_at ? (
                          new Date(booking.checked_in_at).toLocaleTimeString()
                        ) : (
                          <span className="text-muted-foreground">Sin check-in</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {booking.booking_status === 'confirmed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-success hover:text-success hover:bg-success/10"
                            onClick={() => checkInMutation.mutate(booking.booking_id)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Check-in
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
