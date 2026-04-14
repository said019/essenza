import { useState } from 'react';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';

export default function ReferFriends() {
  const { toast } = useToast();
  const [referralCode] = useState('BALANCE-2024');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast({ title: 'Código copiado', description: 'Compártelo con tus amigos.' });
    } catch {
      toast({ variant: 'destructive', title: 'No se pudo copiar', description: 'Intenta de nuevo.' });
    }
  };

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold">Referir amigos</h1>
              <p className="text-muted-foreground">Gana puntos cuando tus amigos se registren.</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/app/profile">Volver</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tu código</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input value={referralCode} readOnly />
                <Button onClick={handleCopy} className="sm:w-auto">
                  Copiar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Comparte tu código y recibe recompensas cuando tus invitados activen su membresía.
              </p>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
