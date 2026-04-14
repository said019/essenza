import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { walletRewards } from '@/pages/client/walletData';
import { Link } from 'react-router-dom';

export default function WalletRewards() {
  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold">Recompensas</h1>
              <p className="text-muted-foreground">Canjea tus puntos por beneficios exclusivos.</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/app/wallet">Volver</Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {walletRewards.map((reward) => (
              <Card key={reward.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{reward.name}</CardTitle>
                    <Badge variant="secondary">{reward.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-3xl">{reward.icon}</div>
                  <p className="text-sm text-muted-foreground">{reward.points} pts</p>
                  <Button variant="outline" size="sm" className="w-full">
                    Canjear
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
