import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar,
    Users,
    Clock
} from 'lucide-react';
import CoachLayout from '@/components/layout/CoachLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface ClassItem {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    current_bookings: number;
    status: string;
    class_type_name: string;
    class_type_color: string;
    facility_name: string | null;
    waitlist_count: number;
}

export default function CoachSchedule() {
    const { user } = useAuthStore();
    const [currentWeek, setCurrentWeek] = useState(new Date());

    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const isAdmin = user?.role === 'admin';

    // Get instructor ID from user (only needed for non-admin coaches)
    const { data: instructorData } = useQuery({
        queryKey: ['instructor-by-user', user?.id],
        queryFn: async () => {
            const response = await api.get(`/instructors?all=true`);
            const instructor = response.data.find((i: any) => i.user_id === user?.id);
            return instructor;
        },
        enabled: !!user?.id && !isAdmin,
    });

    const instructorId = instructorData?.id;

    // Fetch week's classes
    // Admin sees ALL classes, coaches see only their own
    const { data: classes, isLoading } = useQuery<ClassItem[]>({
        queryKey: ['coach-week-classes', isAdmin ? 'all' : instructorId, format(weekStart, 'yyyy-MM-dd')],
        queryFn: async () => {
            const from = format(weekStart, 'yyyy-MM-dd');
            const to = format(weekEnd, 'yyyy-MM-dd');
            if (isAdmin) {
                // Admin: fetch ALL classes for the week
                const response = await api.get(`/classes?start=${from}&end=${to}`);
                return response.data;
            } else {
                // Regular coach: fetch only their classes
                const response = await api.get(`/instructors/${instructorId}/classes?from=${from}&to=${to}`);
                return response.data;
            }
        },
        enabled: isAdmin || !!instructorId,
    });

    const goToPrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
    const goToNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
    const goToToday = () => setCurrentWeek(new Date());

    const getClassesForDay = (date: Date) => {
        if (!classes) return [];
        return classes.filter((c) => isSameDay(parseISO(c.date), date));
    };

    const formatTime = (time: string) => time.substring(0, 5);

    const isToday = (date: Date) => isSameDay(date, new Date());

    return (
        <AuthGuard requiredRoles={['instructor', 'admin']}>
            <CoachLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="font-heading text-3xl font-bold">Mi Horario</h1>
                            <p className="text-muted-foreground">
                                {isAdmin ? 'Todas las clases programadas' : 'Tus clases programadas'}
                            </p>
                        </div>

                        {/* Week Navigation */}
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={goToToday}>
                                Hoy
                            </Button>
                            <div className="flex items-center border rounded-lg">
                                <Button variant="ghost" size="icon" onClick={goToPrevWeek}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="px-4 text-sm font-medium min-w-[200px] text-center">
                                    {format(weekStart, "d 'de' MMM", { locale: es })} - {format(weekEnd, "d 'de' MMM yyyy", { locale: es })}
                                </span>
                                <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Week View */}
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                        {weekDays.map((day) => {
                            const dayClasses = getClassesForDay(day);
                            const todayClass = isToday(day);

                            return (
                                <Card 
                                    key={day.toISOString()} 
                                    className={`${todayClass ? 'ring-2 ring-primary' : ''}`}
                                >
                                    <CardHeader className={`py-3 px-4 ${todayClass ? 'bg-primary/5' : ''}`}>
                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground uppercase">
                                                {format(day, 'EEE', { locale: es })}
                                            </p>
                                            <p className={`text-2xl font-bold ${todayClass ? 'text-primary' : ''}`}>
                                                {format(day, 'd')}
                                            </p>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-2 min-h-[200px]">
                                        {isLoading ? (
                                            <div className="space-y-2">
                                                <Skeleton className="h-16 w-full" />
                                                <Skeleton className="h-16 w-full" />
                                            </div>
                                        ) : dayClasses.length === 0 ? (
                                            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                                                Sin clases
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {dayClasses.map((classItem) => (
                                                    <Link
                                                        key={classItem.id}
                                                        to={`/coach/class/${classItem.id}`}
                                                    >
                                                        <div 
                                                            className="p-2 rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                                                            style={{ 
                                                                borderLeftWidth: '3px',
                                                                borderLeftColor: classItem.class_type_color || '#6B7280'
                                                            }}
                                                        >
                                                            <p className="font-medium text-xs truncate">
                                                                {classItem.class_type_name}
                                                            </p>
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                                                <Clock className="h-3 w-3" />
                                                                {formatTime(classItem.start_time)}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-xs mt-1">
                                                                <Users className="h-3 w-3" />
                                                                <span className={
                                                                    classItem.current_bookings >= classItem.max_capacity 
                                                                        ? 'text-success font-medium' 
                                                                        : ''
                                                                }>
                                                                    {classItem.current_bookings}/{classItem.max_capacity}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Summary */}
                    {classes && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Calendar className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">
                                                {classes.length} clases esta semana
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {classes.reduce((acc, c) => acc + c.current_bookings, 0)} reservaciones totales
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="secondary">
                                        {Math.round(
                                            classes.length > 0
                                                ? (classes.reduce((acc, c) => acc + (c.current_bookings / c.max_capacity), 0) / classes.length) * 100
                                                : 0
                                        )}% ocupación promedio
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </CoachLayout>
        </AuthGuard>
    );
}
