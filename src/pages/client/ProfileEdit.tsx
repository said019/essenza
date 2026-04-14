import { useEffect, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/authStore';
import api, { getErrorMessage } from '@/lib/api';
import type { UpdateProfileData, User } from '@/types/auth';
import { Link } from 'react-router-dom';

const profileSchema = z.object({
  displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z
    .string()
    .regex(/^\+52[0-9]{10}$/, 'Formato: +52 seguido de 10 dígitos')
    .optional()
    .or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  healthNotes: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

interface ProfileResponse {
  user: User;
}

export default function ProfileEdit() {
  const { toast } = useToast();
  const { user: authUser, updateUser } = useAuthStore();

  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['profile', authUser?.id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${authUser?.id}`);
      return data;
    },
    enabled: Boolean(authUser?.id),
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: authUser?.display_name || '',
      phone: authUser?.phone || '',
      dateOfBirth: authUser?.date_of_birth ? authUser.date_of_birth.slice(0, 10) : '',
      emergencyContactName: authUser?.emergency_contact_name || '',
      emergencyContactPhone: authUser?.emergency_contact_phone || '',
      healthNotes: authUser?.health_notes || '',
    },
  });

  useEffect(() => {
    if (data?.user) {
      reset({
        displayName: data.user.display_name || '',
        phone: data.user.phone || '',
        dateOfBirth: data.user.date_of_birth ? data.user.date_of_birth.slice(0, 10) : '',
        emergencyContactName: data.user.emergency_contact_name || '',
        emergencyContactPhone: data.user.emergency_contact_phone || '',
        healthNotes: data.user.health_notes || '',
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (payload: UpdateProfileData) => {
      const { data } = await api.put(`/users/${authUser?.id}`, payload);
      return data.user as User;
    },
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      toast({ title: 'Perfil actualizado', description: 'Tus datos se guardaron correctamente.' });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: getErrorMessage(error),
      });
    },
  });

  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    let value = event.target.value;
    value = value.replace(/[^\d+]/g, '');
    if (!value.startsWith('+52') && value.length > 0) {
      if (value.startsWith('52')) {
        value = `+${value}`;
      } else if (value.startsWith('+')) {
        value = `+52${value.substring(1)}`;
      } else {
        value = `+52${value}`;
      }
    }
    if (value.length > 13) {
      value = value.substring(0, 13);
    }
    event.target.value = value;
    setValue('phone', value, { shouldValidate: true });
  };

  const onSubmit = (values: ProfileForm) => {
    if (!authUser?.id) return;
    const payload: UpdateProfileData = {
      displayName: values.displayName,
      phone: values.phone?.trim() ? values.phone : undefined,
      dateOfBirth: values.dateOfBirth || undefined,
      emergencyContactName: values.emergencyContactName || undefined,
      emergencyContactPhone: values.emergencyContactPhone || undefined,
      healthNotes: values.healthNotes || undefined,
    };
    mutation.mutate(payload);
  };

  return (
    <AuthGuard requiredRoles={['client']}>
      <ClientLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold">Editar perfil</h1>
              <p className="text-muted-foreground">Actualiza tus datos personales.</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/app/profile">Volver</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Información personal</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Nombre completo</Label>
                    <Input id="displayName" {...register('displayName')} />
                    {errors.displayName && (
                      <p className="text-xs text-destructive">{errors.displayName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" {...register('phone', { onChange: handlePhoneChange })} />
                    {errors.phone && (
                      <p className="text-xs text-destructive">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Fecha de nacimiento</Label>
                    <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactName">Contacto de emergencia</Label>
                    <Input id="emergencyContactName" {...register('emergencyContactName')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactPhone">Teléfono de emergencia</Label>
                    <Input id="emergencyContactPhone" {...register('emergencyContactPhone')} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="healthNotes">Notas de salud</Label>
                    <Textarea id="healthNotes" {...register('healthNotes')} rows={4} />
                  </div>

                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    </AuthGuard>
  );
}
