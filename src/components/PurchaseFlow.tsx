import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, CreditCard, Building2, AlertCircle, Copy, Upload, X, FileImage } from 'lucide-react';
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
type Step = 'select-plan' | 'payment-method' | 'upload-proof' | 'processing';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PurchaseFlow() {
  const [step, setStep] = useState<Step>('select-plan');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transferOrderId, setTransferOrderId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [transferReference, setTransferReference] = useState('');
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

  // Para transferencia: crea una orden pendiente y avanza a subir comprobante
  const createOrderMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await api.post('/orders', {
        plan_id: planId,
        payment_method: 'transfer',
      });
      return response.data;
    },
    onSuccess: (data) => {
      setTransferOrderId(data.id);
      setIsProcessing(false);
      setStep('upload-proof');
    },
    onError: (error: any) => {
      setIsProcessing(false);
      const existingId = error.response?.data?.existingOrderId;
      if (existingId) {
        setTransferOrderId(existingId);
        setStep('upload-proof');
        toast({
          title: 'Continúa con tu orden pendiente',
          description: 'Ya tenías una orden para este plan. Sube el comprobante para activarla.',
        });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'No se pudo crear la orden',
        description: error.response?.data?.error || 'Intenta nuevamente.',
      });
    },
  });

  const uploadProofMutation = useMutation({
    mutationFn: async ({ orderId, file, reference }: { orderId: string; file: File; reference: string }) => {
      const file_data = await fileToBase64(file);
      const response = await api.post(`/orders/${orderId}/upload-proof`, {
        file_data,
        file_name: file.name,
        file_type: file.type,
        transfer_reference: reference || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      setStep('processing');
    },
    onError: (error: any) => {
      setIsProcessing(false);
      toast({
        variant: 'destructive',
        title: 'Error al subir comprobante',
        description: error.response?.data?.error || 'Intenta con otra imagen.',
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
      await createMembershipMutation.mutateAsync({
        planId: selectedPlan.id,
        paymentMethod,
      });
    } else {
      // Transferencia → crea orden y ve a paso de subir comprobante
      await createOrderMutation.mutateAsync(selectedPlan.id);
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Formato no válido',
        description: 'Usa una imagen (JPG/PNG/WebP) o PDF.',
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: 'El máximo es 5 MB.',
      });
      return;
    }

    setProofFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const handleProofSubmit = async () => {
    if (!transferOrderId || !proofFile) return;
    setIsProcessing(true);
    await uploadProofMutation.mutateAsync({
      orderId: transferOrderId,
      file: proofFile,
      reference: transferReference.trim(),
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
            <AlertDescription className="text-foreground space-y-3">
              <p className="font-semibold font-heading">Datos para transferencia:</p>
              <div className="space-y-2 text-sm font-body">
                <div className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2 border border-info/20">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CLABE</p>
                    <p className="font-mono text-sm font-semibold break-all">722969010028531627</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 flex-shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText('722969010028531627');
                      toast({ title: 'CLABE copiada', description: 'Ya puedes pegarla en tu banco' });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p><strong>Beneficiario:</strong> Erika Novoa Campos</p>
                <p><strong>Institución:</strong> Mercado Pago W</p>
                <p><strong>Concepto:</strong> Membresía {selectedPlan?.name}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Al confirmar, envía tu comprobante por WhatsApp al <strong>55 7403 4312</strong>. Tus créditos
                se activan en 1–2 horas hábiles.
              </p>
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
            'Continuar y subir comprobante'
          )}
        </Button>
      </div>
    );
  }

  // Paso 3a: Subir comprobante (solo transferencia)
  if (step === 'upload-proof' && transferOrderId) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-1">Sube tu comprobante</h2>
          <p className="text-sm text-muted-foreground font-body">
            Adjunta tu comprobante de transferencia para que el equipo active tus créditos.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-4 text-sm">
          <p className="font-medium mb-1">Plan: {selectedPlan?.name}</p>
          <p className="text-muted-foreground text-xs">
            Monto: ${selectedPlan?.price} {selectedPlan?.currency || 'MXN'}
          </p>
        </div>

        <div className="space-y-3">
          <Label htmlFor="proof-file" className="text-sm font-medium">
            Comprobante (imagen o PDF, máx 5 MB)
          </Label>

          {!proofFile ? (
            <label
              htmlFor="proof-file"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Toca para seleccionar</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP o PDF</p>
              <input
                id="proof-file"
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleProofFileChange}
              />
            </label>
          ) : (
            <div className="rounded-xl border bg-card p-3 space-y-3">
              {proofPreview ? (
                <img
                  src={proofPreview}
                  alt="Vista previa del comprobante"
                  className="w-full max-h-72 object-contain rounded-lg bg-muted/40"
                />
              ) : (
                <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                  <FileImage className="h-10 w-10 text-primary/60 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{proofFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(proofFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setProofFile(null);
                  setProofPreview(null);
                }}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Cambiar archivo
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="transfer-ref" className="text-sm font-medium">
            Referencia (opcional)
          </Label>
          <Input
            id="transfer-ref"
            type="text"
            placeholder="Ej. 00012345"
            value={transferReference}
            onChange={(e) => setTransferReference(e.target.value)}
            maxLength={40}
          />
          <p className="text-xs text-muted-foreground">
            Número de referencia o clave de rastreo de tu transferencia.
          </p>
        </div>

        <Button
          onClick={handleProofSubmit}
          disabled={!proofFile || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar comprobante'
          )}
        </Button>

        <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
          Al enviar, tu orden pasa a <strong>revisión</strong>. Recibirás notificación por email y WhatsApp cuando se apruebe.
        </p>
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
          <h2 className="text-2xl font-heading font-bold">Comprobante enviado</h2>
          <p className="text-muted-foreground font-body">
            Recibimos tu comprobante y está en revisión.
          </p>
        </div>

        <Alert className="text-left">
          <AlertDescription className="font-body">
            <p className="font-semibold mb-2">¿Qué sigue?</p>
            <ul className="space-y-1 text-sm">
              <li>• Nuestro equipo verificará tu transferencia (1–2 hrs hábiles)</li>
              <li>• Te notificamos por email y WhatsApp cuando se apruebe</li>
              <li>• Tus créditos se activan automáticamente al aprobar</li>
              <li>• Puedes consultar el estado en "Mis órdenes"</li>
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
            onClick={() => navigate('/app/orders')}
            className="flex-1"
          >
            Ver mis órdenes
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
