import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import type { Membership } from '@/types/auth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const activationSchema = z.object({
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'online'], {
    required_error: 'Selecciona un método de pago',
  }),
  paymentReference: z.string().max(255).optional(),
  startDate: z.string().min(1, 'Selecciona la fecha de inicio'),
  notes: z.string().max(500).optional(),
  notifyMember: z.boolean().default(true),
  generateWalletPass: z.boolean().default(true),
});

export type ActivationForm = z.infer<typeof activationSchema>;

interface MembershipActivationDialogProps {
  open: boolean;
  membership: Membership | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: (membershipId: string, data: ActivationForm) => void;
}

const paymentLabels: Record<ActivationForm['paymentMethod'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  online: 'Pago en línea',
};

const formatCurrency = (amount?: number | null, currency = 'MXN') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
};

export function MembershipActivationDialog({
  open,
  membership,
  isSubmitting,
  onOpenChange,
  onActivate,
}: MembershipActivationDialogProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { register, setValue, watch, handleSubmit, reset, formState: { errors } } = useForm<ActivationForm>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      paymentMethod: 'transfer',
      startDate: today,
      notifyMember: true,
      generateWalletPass: true,
    },
  });

  useEffect(() => {
    register('paymentMethod');
    register('notifyMember');
    register('generateWalletPass');
  }, [register]);

  useEffect(() => {
    if (!membership) return;
    const resolvedPaymentMethod =
      membership.payment_method && Object.prototype.hasOwnProperty.call(paymentLabels, membership.payment_method)
        ? (membership.payment_method as ActivationForm['paymentMethod'])
        : 'transfer';
    reset({
      paymentMethod: resolvedPaymentMethod,
      paymentReference: membership.payment_reference || '',
      startDate: today,
      notes: '',
      notifyMember: true,
      generateWalletPass: true,
    });
  }, [membership, reset, today]);

  const paymentMethod = watch('paymentMethod');
  const notifyMember = watch('notifyMember');
  const generateWalletPass = watch('generateWalletPass');

  const amount = membership?.price_paid ?? membership?.plan_price ?? null;
  const currency = membership?.plan_currency || 'MXN';

  const onSubmit = (data: ActivationForm) => {
    if (!membership) return;
    onActivate(membership.id, data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Activar Membresía</DialogTitle>
          <DialogDescription>
            Confirma el pago y define la fecha de inicio.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
          <p className="text-base font-medium">{membership?.user_name || '—'}</p>
          <p className="text-sm text-muted-foreground">{membership?.plan_name || '—'}</p>
          <p className="text-sm text-muted-foreground">
            Monto: {formatCurrency(amount, currency)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Método de pago recibido *</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setValue('paymentMethod', value as ActivationForm['paymentMethod'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.paymentMethod && (
              <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Referencia (opcional)</Label>
            <Input placeholder="Folio o referencia" {...register('paymentReference')} />
          </div>

          <div className="space-y-2">
            <Label>Fecha de inicio *</Label>
            <Input type="date" {...register('startDate')} />
            {errors.startDate && (
              <p className="text-xs text-destructive">{errors.startDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Notas internas sobre el pago"
              rows={3}
              {...register('notes')}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={notifyMember}
                onCheckedChange={(checked) => setValue('notifyMember', checked === true)}
                id="notify-member"
              />
              <Label htmlFor="notify-member" className="text-sm leading-5">
                Enviar notificación al cliente
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                checked={generateWalletPass}
                onCheckedChange={(checked) => setValue('generateWalletPass', checked === true)}
                id="generate-wallet-pass"
              />
              <Label htmlFor="generate-wallet-pass" className="text-sm leading-5">
                Generar Wallet Pass
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !membership}>
              Activar Membresía
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
