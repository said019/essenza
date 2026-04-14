import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import api from '@/lib/api';
import type { PaymentRecord } from '@/types/payment';
import { Loader2, Search } from 'lucide-react';

interface PaymentsListProps {
  title?: string;
  description?: string;
  initialStatus?: string;
  statusLocked?: boolean;
  embedded?: boolean;
}

const statusLabels: Record<string, string> = {
  completed: 'Completado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};

const statusStyles: Record<string, string> = {
  completed: 'bg-success/10 text-success border-success/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  refunded: 'bg-muted text-muted-foreground border-border',
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

export default function PaymentsTransactions({
  title = 'Transacciones',
  description = 'Historial de pagos registrados.',
  initialStatus = 'all',
  statusLocked = false,
  embedded = false,
}: PaymentsListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);

  const { data, isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ['payments', status, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      const { data } = await api.get(`/payments/transactions?${params.toString()}`);
      return data;
    },
  });

  const payments = useMemo(() => data || [], [data]);

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
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
            <SelectItem value="completed">Completadas</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="failed">Fallidas</SelectItem>
            <SelectItem value="refunded">Reembolsadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Membresía</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No hay pagos registrados.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div className="font-medium">{payment.user_name}</div>
                    <div className="text-xs text-muted-foreground">{payment.user_email}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {payment.plan_name || '—'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatCurrency(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell className="text-sm capitalize">{payment.payment_method}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusStyles[payment.status]}>
                      {statusLabels[payment.status] || payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <AuthGuard requiredRoles={['admin']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          {content}
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}

/** Embeddable version without layout wrapper */
export function TransactionsContent() {
  return <PaymentsTransactions embedded />;
}

export function PendingPaymentsContent() {
  return <PaymentsTransactions initialStatus="pending" statusLocked embedded />;
}
