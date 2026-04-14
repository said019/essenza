import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

const notifications = [
  {
    id: '1',
    title: 'Reserva confirmada',
    body: 'Barre Studio • Mañana 9:00am',
    time: 'Hace 2h',
    unread: true,
  },
  {
    id: '2',
    title: 'Puntos acreditados',
    body: '+10 pts por asistencia',
    time: 'Ayer',
    unread: false,
  },
  {
    id: '3',
    title: 'Tu pase está listo',
    body: 'Agrega tu Membresía a tu Apple Wallet.',
    time: '3 Ene',
    unread: false,
  },
];

export default function Notifications() {
  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold">Notificaciones</h1>
              <p className="text-muted-foreground">Mantente al tanto de tu actividad.</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/app">Volver</Link>
            </Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                Recientes
              </CardTitle>
              <Button variant="outline" size="sm">Marcar todo leído</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {notifications.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.time}</p>
                  </div>
                  {item.unread && <Badge>Nuevo</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
