/**
 * � PÁGINA: Historial de Inscripciones Manuales
 * 
 * Muestra el historial de clientes inscritos manualmente.
 * Para inscribir nuevos clientes, usa /admin/members/new
 */

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MigrationHistory } from '@/components/admin/migration/MigrationHistory';
import { ArrowLeft, UserPlus, Info } from 'lucide-react';


export const ClientMigrationPage = () => {
  const navigate = useNavigate();

  const handleViewClient = (userId: string) => {
    navigate(`/admin/members/${userId}`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/reports')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">
              Historial de Inscripciones Manuales
            </h1>
            <p className="text-muted-foreground mt-1">
              Clientes inscritos manualmente (pagos previos al sistema)
            </p>
          </div>
        </div>
        
        {/* Botón para agregar nuevo */}
        <Button onClick={() => navigate('/admin/members/new')}>
          <UserPlus className="h-4 w-4 mr-2" />
          Inscribir Cliente
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>¿Necesitas inscribir un cliente manualmente?</strong> Ve a{' '}
          <button 
            onClick={() => navigate('/admin/members/new')}
            className="font-medium underline hover:text-primary"
          >
            Miembros → Agregar Miembro
          </button>{' '}
          y selecciona "Cliente Existente (Inscripción Manual)"
        </AlertDescription>
      </Alert>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle>Historial Completo</CardTitle>
          <CardDescription>
            Todos los clientes inscritos manualmente. NO generaron órdenes de venta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MigrationHistory onViewClient={handleViewClient} />
        </CardContent>
      </Card>
    </div>
  );
};
