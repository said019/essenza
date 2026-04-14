import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    User, 
    Mail, 
    Phone, 
    Award,
    Calendar,
    Users,
    TrendingUp,
    CheckCircle2
} from 'lucide-react';
import CoachLayout from '@/components/layout/CoachLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface InstructorProfile {
    id: string;
    user_id: string;
    display_name: string;
    bio: string | null;
    photo_url: string | null;
    specialties: string[];
    certifications: string[];
    email: string;
    phone: string;
    is_active: boolean;
}

interface InstructorStats {
    total_classes_taught: number;
    total_bookings: number;
    total_checkins: number;
    attendance_rate: number;
    classes_this_week: number;
    bookings_this_week: number;
    avg_occupancy: number;
}

export default function CoachProfile() {
    const { user } = useAuthStore();

    // Get instructor profile
    const { data: instructor, isLoading } = useQuery<InstructorProfile>({
        queryKey: ['instructor-profile', user?.id],
        queryFn: async () => {
            const response = await api.get(`/instructors?all=true`);
            const inst = response.data.find((i: any) => i.user_id === user?.id);
            return inst;
        },
        enabled: !!user?.id,
    });

    // Get stats
    const { data: stats, isLoading: loadingStats } = useQuery<InstructorStats>({
        queryKey: ['instructor-stats', instructor?.id],
        queryFn: async () => {
            const response = await api.get(`/instructors/${instructor?.id}/stats`);
            return response.data;
        },
        enabled: !!instructor?.id,
    });

    const getInitials = (name: string) =>
        name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

    if (isLoading) {
        return (
            <AuthGuard requiredRoles={['instructor', 'admin']}>
                <CoachLayout>
                    <div className="max-w-4xl mx-auto space-y-6">
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                </CoachLayout>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard requiredRoles={['instructor', 'admin']}>
            <CoachLayout>
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Profile Header */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                                <Avatar className="h-32 w-32">
                                    <AvatarImage src={instructor?.photo_url || undefined} />
                                    <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                                        {getInitials(instructor?.display_name || user?.display_name || 'U')}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-2">
                                        <h1 className="font-heading text-3xl font-bold">
                                            {instructor?.display_name || user?.display_name}
                                        </h1>
                                        {instructor?.is_active && (
                                            <Badge className="bg-success">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Activo
                                            </Badge>
                                        )}
                                    </div>

                                    {instructor?.bio && (
                                        <p className="text-muted-foreground mt-2 max-w-lg">
                                            {instructor.bio}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Mail className="h-4 w-4" />
                                            {instructor?.email || user?.email}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-4 w-4" />
                                            {instructor?.phone || user?.phone}
                                        </span>
                                    </div>

                                    {/* Specialties */}
                                    {instructor?.specialties && instructor.specialties.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                                            {instructor.specialties.map((specialty, index) => (
                                                <Badge key={index} variant="secondary">
                                                    {specialty}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Calendar className="h-8 w-8 mx-auto text-primary mb-2" />
                                <p className="text-3xl font-bold">
                                    {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats?.total_classes_taught || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Clases impartidas</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 text-center">
                                <Users className="h-8 w-8 mx-auto text-info mb-2" />
                                <p className="text-3xl font-bold">
                                    {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : stats?.total_checkins || 0}
                                </p>
                                <p className="text-xs text-muted-foreground">Check-ins totales</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 text-center">
                                <TrendingUp className="h-8 w-8 mx-auto text-success mb-2" />
                                <p className="text-3xl font-bold">
                                    {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : `${stats?.attendance_rate || 0}%`}
                                </p>
                                <p className="text-xs text-muted-foreground">Tasa de asistencia</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4 text-center">
                                <Award className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                                <p className="text-3xl font-bold">
                                    {loadingStats ? <Skeleton className="h-8 w-12 mx-auto" /> : `${stats?.avg_occupancy || 0}%`}
                                </p>
                                <p className="text-xs text-muted-foreground">Ocupación promedio</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Certifications */}
                    {instructor?.certifications && instructor.certifications.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="h-5 w-5" />
                                    Certificaciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3">
                                    {instructor.certifications.map((cert, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                            <CheckCircle2 className="h-5 w-5 text-success" />
                                            <span>{cert}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* This Week */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Esta Semana</CardTitle>
                            <CardDescription>Tu actividad de los últimos 7 días</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="text-center p-4 rounded-lg bg-primary/5">
                                    <p className="text-4xl font-bold text-primary">
                                        {loadingStats ? <Skeleton className="h-10 w-12 mx-auto" /> : stats?.classes_this_week || 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">Clases programadas</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-info/5">
                                    <p className="text-4xl font-bold text-info">
                                        {loadingStats ? <Skeleton className="h-10 w-12 mx-auto" /> : stats?.bookings_this_week || 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">Reservaciones</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </CoachLayout>
        </AuthGuard>
    );
}
