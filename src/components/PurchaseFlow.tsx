import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, CreditCard, Building2, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration_days: number;
  class_limit: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

type PaymentMethod = 'card' | 'transfer';
type Step = 'select-plan' | 'payment-method' | 'processing';

export function PurchaseFlow() {
  const [step, setStep] = useState<Step>('select-plan');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch planes disponibles
  const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: async () => {
      const response = await api.get('/plans');
      return response.data.filter((p: Plan) => p.is_active);
    },
  });

  // Mutation para crear membresía
  const createMembershipMutation = useMutation({
    mutationFn: async ({ planId, paymentMethod }: { planId: string; paymentMethod: PaymentMethod }) => {
      const response = await api.post('/memberships', { planId, paymentMethod });
      return response.data;
    },
    onSuccess: async (data, variables) => {
      if (variables.paymentMethod === 'card') {
        // Simular procesamiento de tarjeta (2 segundos) y auto-activar
        setTimeout(async () => {
          try {
            await api.post(
              `/memberships/complete-payment/${data.membershipId}`,
              { reference: `CARD-${Date.now()}` }
            );

            queryClient.invalidateQueries({ queryKey: ['membership'] });
            setIsProcessing(false);

            toast({
              title: '¡Pago exitoso! ✓',
              description: 'Tus créditos han sido activados. Redirigiendo al calendario...',
            });

            setTimeout(() => {
              navigate('/');
            }, 1500);
          } catch (error) {
            setIsProcessing(false);
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Error al activar membresía',
            });
          }
        }, 2000);
      } else {
        // Transferencia - mostrar mensaje de espera
        setIsProcessing(false);
        setStep('processing');
      }
    },
    onError: (error: any) => {
      setIsProcessing(false);
      const message = error.response?.data?.error || 'Error al procesar compra';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    },
  });

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep('payment-method');
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);

    if (paymentMethod === 'card') {
      toast({
        title: 'Procesando pago...',
        description: 'Por favor espera mientras procesamos tu tarjeta.',
      });
    }

    await createMembershipMutation.mutateAsync({
      planId: selectedPlan.id,
      paymentMethod,
    });
  };

  // Paso 1: Selección de Plan
  if (step === 'select-plan') {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-2">
            Elige tu plan
          </h2>
          <p className="text-muted-foreground font-body">
            Selecciona el plan que mejor se adapte a tu rutina
          </p>
        </div>

        {loadingPlans ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isPopular = plan.name === 'Tres Sesiones';
              const pricePerClass = plan.class_limit ? (plan.price / plan.class_limit).toFixed(0) : null;

              return (
                <Card
                  key={plan.id}
                  className={`relative cursor-pointer transition-all hover:shadow-lg ${
                    isPopular ? 'border-primary shadow-md' : ''
                  }`}
                  onClick={() => handlePlanSelect(plan)}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-medium">
                      Más Popular
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-xl font-heading">{plan.name}</CardTitle>
                    <CardDescription className="font-body">{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold font-heading">
                          ${plan.price.toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">MXN</span>
                      </div>
                      {pricePerClass && (
                        <p className="text-sm text-primary font-medium">
                          ${pricePerClass} por clase
                        </p>
                      )}
                    </div>

                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="font-body">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button className="w-full" variant={isPopular ? 'default' : 'outline'}>
                      Seleccionar Plan
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Paso 2: Método de Pago
  if (step === 'payment-method') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => setStep('select-plan')}
          className="mb-4"
        >
          ← Volver a planes
        </Button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-heading font-bold text-foreground mb-2">
            Método de pago
          </h2>
          <p className="text-muted-foreground font-body">
            Selecciona cómo deseas pagar tu membresía
          </p>
        </div>

        {/* Plan seleccionado */}
        {selectedPlan && (
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-lg">{selectedPlan.name}</h3>
                  <p className="text-sm text-muted-foreground font-body">
                    {selectedPlan.class_limit 
                      ? `${selectedPlan.class_limit} clases`
                      : 'Clases ilimitadas'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-heading font-bold">
                    ${selectedPlan.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">MXN</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métodos de pago */}
        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
          <Card className={`cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-primary' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <RadioGroupItem value="card" id="card" />
                <div className="flex-1">
                  <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="w-5 h-5" />
                    <span className="font-heading font-semibold">Tarjeta de Crédito/Débito</span>
                  </Label>
                  <p className="text-sm text-muted-foreground font-body mt-1">
                    Pago instantáneo. Tus créditos se activan inmediatamente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all ${paymentMethod === 'transfer' ? 'border-primary' : ''}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <RadioGroupItem value="transfer" id="transfer" />
                <div className="flex-1">
                  <Label htmlFor="transfer" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="w-5 h-5" />
                    <span className="font-heading font-semibold">Transferencia Bancaria</span>
                  </Label>
                  <p className="text-sm text-muted-foreground font-body mt-1">
                    Verificación manual. Créditos activados en 1-2 horas hábiles.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </RadioGroup>

        {/* Datos bancarios para transferencia */}
        {paymentMethod === 'transfer' && (
          <Alert className="bg-info/10 border-info/30">
            <Building2 className="h-4 w-4 text-info" />
            <AlertDescription className="text-foreground space-y-2">
              <p className="font-semibold font-heading">Datos bancarios:</p>
              <div className="space-y-1 text-sm font-body">
                <p><strong>Banco:</strong> BBVA</p>
                <p><strong>CLABE:</strong> 012 180 0123 4567 8901</p>
                <p><strong>Titular:</strong> Essenza del Flusso SA de CV</p>
                <p><strong>Concepto:</strong> Membresía {selectedPlan?.name}</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handlePaymentSubmit}
          disabled={isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Procesando...
            </>
          ) : paymentMethod === 'card' ? (
            'Pagar Ahora'
          ) : (
            'Ya realicé el pago'
          )}
        </Button>
      </div>
    );
  }

  // Paso 3: Procesamiento (solo para transferencia)
  if (step === 'processing' && paymentMethod === 'transfer') {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12">
        <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-warning" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-heading font-bold">Pago en revisión</h2>
          <p className="text-muted-foreground font-body">
            Tu pago está en proceso de verificación
          </p>
        </div>

        <Alert className="text-left">
          <AlertDescription className="font-body">
            <p className="font-semibold mb-2">¿Qué sigue?</p>
            <ul className="space-y-1 text-sm">
              <li>• Nuestro equipo verificará tu transferencia</li>
              <li>• Tus créditos se activarán en 1-2 horas hábiles</li>
              <li>• Recibirás una confirmación por email</li>
              <li>• Podrás reservar clases una vez activados los créditos</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="flex-1"
          >
            Volver al inicio
          </Button>
          <Button
            onClick={() => navigate('/app/my-bookings')}
            className="flex-1"
          >
            Ver mis reservas
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
