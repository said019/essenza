import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import type { User } from '@/types/auth';
import { Calendar, Phone, Shield, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProfileResponse {
  user: User;
}

export default function Profile() {
  const { user: authUser } = useAuthStore();

  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['profile', authUser?.id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${authUser?.id}`);
      return data;
    },
    enabled: Boolean(authUser?.id),
  });

  const profile = data?.user ?? authUser;

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold">Mi Perfil</h1>
              <p className="text-muted-foreground">Administra tu información personal.</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/profile/edit">Editar perfil</Link>
            </Button>
          </div>

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : profile ? (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5 text-muted-foreground" />
                    Datos del miembro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-semibold">{profile.display_name}</p>
                      <p className="text-muted-foreground">{profile.email}</p>
                    </div>
                    <Badge variant="secondary">Cliente</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.phone || 'Sin teléfono'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {profile.date_of_birth
                          ? format(new Date(profile.date_of_birth), 'dd MMM yyyy', { locale: es })
                          : 'Sin fecha de nacimiento'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Contacto de emergencia</p>
                      <p className="text-muted-foreground">
                        {profile.emergency_contact_name
                          ? `${profile.emergency_contact_name} • ${profile.emergency_contact_phone || 'Sin teléfono'}`
                          : 'No registrado'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Atajos rápidos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/app/profile/membership">Ver membresía</Link>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/app/profile/preferences">Preferencias</Link>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/app/wallet">Membresía</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No pudimos cargar tu perfil.
              </CardContent>
            </Card>
          )}
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
