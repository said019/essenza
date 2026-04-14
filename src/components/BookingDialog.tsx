import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

interface ClassItem {
  id: string;
  time: string;
  type: string;
  instructor: string;
  spots: number;
  duration: string;
  date?: Date;
}

interface BookingDialogProps {
  classData: ClassItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Membership {
  id: string;
  plan_name: string;
  status: string;
  credits_remaining: number | null;
  credits_total: number | null;
  end_date: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export function BookingDialog({ classData, open, onOpenChange }: BookingDialogProps) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch membresía actual
  const { data: membership, isLoading: loadingMembership } = useQuery<Membership>({
    queryKey: ['membership', user?.id],
    queryFn: async () => {
      const response = await api.get('/memberships/me');
      const d = response.data;
      return {
        ...d,
        credits_remaining: d.credits_remaining ?? d.classes_remaining ?? null,
        credits_total: d.credits_total ?? d.class_limit ?? null,
      };
    },
    enabled: isAuthenticated && open,
  });

  // Mutation para crear reserva
  const createBookingMutation = useMutation({
    mutationFn: async (classId: string) => {
      const response = await api.post('/bookings', { 
        classId,
        membershipId: membership?.id 
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership'] });
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      
      toast({
        title: '¡Clase Agendada! ✓',
        description: 'Tu reserva ha sido confirmada exitosamente.',
      });
      
      onOpenChange(false);
      
      // Redirect a mis reservas después de 1 segundo
      setTimeout(() => {
        navigate('/app/my-bookings');
      }, 1000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Error al crear reserva';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    },
  });

  const handleReserve = async () => {
    if (!classData) return;

    // CASO A: Sin Login
    if (!isAuthenticated) {
      onOpenChange(false);
      toast({
        title: 'Inicia sesión',
        description: 'Necesitas una cuenta para reservar clases.',
      });
      navigate('/login');
      return;
    }

    // CASO B: Login + Sin créditos de clases
    if (!membership || membership.status !== 'active') {
      onOpenChange(false);
      toast({
        title: 'Compra un pack de clases',
        description: 'Necesitas créditos para reservar. Te llevamos a los planes...',
      });
      setTimeout(() => {
        navigate('/pricing');
      }, 1500);
      return;
    }

    if (membership.credits_remaining !== null && membership.credits_remaining <= 0) {
      onOpenChange(false);
      toast({
        title: 'Sin créditos disponibles',
        description: 'Compra otro pack para seguir reservando clases.',
      });
      setTimeout(() => {
        navigate('/pricing');
      }, 1500);
      return;
    }

    // CASO C: Login + Con Créditos
    setIsSubmitting(true);
    try {
      await createBookingMutation.mutateAsync(classData.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!classData) return null;

  const hasCredits = membership?.credits_remaining === null || (membership?.credits_remaining ?? 0) > 0;
  const isUnlimited = membership?.credits_remaining === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Confirmar Reserva</DialogTitle>
          <DialogDescription className="font-body">
            Revisa los detalles de tu clase antes de confirmar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Detalles de la clase */}
          <div className="bg-muted/30 p-4 rounded-md space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Clase</span>
              <span className="font-medium">{classData.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Instructor</span>
              <span className="font-medium">{classData.instructor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Horario</span>
              <span className="font-medium">{classData.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Duración</span>
              <span className="font-medium">{classData.duration}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Lugares disponibles</span>
              <span className="font-medium">{classData.spots}</span>
            </div>
          </div>

          {/* Estado de membresía */}
          {loadingMembership ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : isAuthenticated ? (
            membership && membership.status === 'active' ? (
              <Alert className="bg-success/10 border-success/30">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription className="text-success">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{membership.plan_name}</span>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      <span className="font-bold">
                        {isUnlimited ? 'Ilimitado' : `${membership.credits_remaining} créditos`}
                      </span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No tienes una membresía activa. Necesitas comprar un plan para reservar.
                </AlertDescription>
              </Alert>
            )
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Debes iniciar sesión para reservar una clase.
              </AlertDescription>
            </Alert>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReserve}
              className="flex-1"
              disabled={isSubmitting || (isAuthenticated && !hasCredits)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reservando...
                </>
              ) : (
                'Confirmar Reserva'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
