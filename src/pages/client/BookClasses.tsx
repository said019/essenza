import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, addDays, isSameDay, parseISO, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/lib/api';
import type { Class } from '@/types/class';
import type { BookingClient } from '@/types/booking';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export default function BookClasses() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
    const navigate = useNavigate();

    useEffect(() => {
        setWeekStart(startOfWeek(currentDate, { weekStartsOn: 0 }));
    }, [currentDate]);

    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const { data: classes } = useQuery<Class[]>({
        queryKey: ['classes-public', startStr, endStr],
        queryFn: async () => {
            const { data } = await api.get(`/classes?start=${startStr}&end=${endStr}`);
            return data;
        },
    });

    const { data: myBookings } = useQuery<BookingClient[]>({
        queryKey: ['my-bookings'],
        queryFn: async () => (await api.get('/bookings/my-bookings')).data,
    });

    const handlePrevWeek = () => setCurrentDate(addDays(currentDate, -7));
    const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));

    const getClassesForDay = (day: Date) => {
        return classes
            ?.filter(c => isSameDay(parseISO(c.date), day))
            .sort((a, b) => a.start_time.localeCompare(b.start_time)) || [];
    };

    const isBooked = (classId: string) => {
        return myBookings?.some(b => b.class_id === classId && b.booking_status !== 'cancelled');
    };

    return (
        <AuthGuard requiredRoles={['client']}>
            <ClientLayout>
                <div className="space-y-6 pb-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold font-heading">Reservar Clases</h1>
                            <p className="text-muted-foreground text-sm">Selecciona una clase para reservar</p>
                        </div>

                        <div className="flex items-center gap-2 bg-muted/50 rounded-full p-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handlePrevWeek}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="px-3 font-medium text-sm min-w-[120px] text-center capitalize">
                                {format(currentDate, 'MMMM yyyy', { locale: es })}
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleNextWeek}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Calendar Grid - Desktop: 7 cols, Mobile: horizontal scroll */}
                    {/* Mobile: horizontal scroll view */}
                    <div className="sm:hidden">
                        <div className="flex overflow-x-auto gap-2 pb-3 snap-x snap-mandatory -mx-4 px-4">
                            {Array.from({ length: 7 }).map((_, i) => {
                                const day = addDays(weekStart, i);
                                const isToday = isSameDay(day, new Date());
                                const isPastDay = isPast(day) && !isToday;
                                const dayClasses = getClassesForDay(day);

                                return (
                                    <div 
                                        key={`mobile-${i}`}
                                        className={cn(
                                            "flex-shrink-0 w-[160px] snap-start rounded-xl border overflow-hidden",
                                            isToday && "border-primary ring-2 ring-primary/20",
                                            !isToday && "border-border",
                                            isPastDay && "opacity-50"
                                        )}
                                    >
                                        {/* Day header */}
                                        <div className={cn(
                                            "text-center py-2",
                                            isToday && "bg-primary text-primary-foreground",
                                            !isToday && "bg-muted/50"
                                        )}>
                                            <div className={cn(
                                                "text-[10px] font-medium tracking-wider",
                                                isToday ? "text-primary-foreground/80" : "text-muted-foreground"
                                            )}>
                                                {DAYS[i]}
                                            </div>
                                            <div className={cn(
                                                "text-lg font-bold",
                                                isToday ? "text-primary-foreground" : "text-foreground"
                                            )}>
                                                {format(day, 'd')}
                                            </div>
                                        </div>

                                        {/* Classes */}
                                        <div className="p-2 space-y-2 min-h-[200px]">
                                            {dayClasses.map(c => {
                                                const booked = isBooked(c.id);
                                                const full = c.current_bookings >= c.max_capacity;
                                                const spotsLeft = c.max_capacity - c.current_bookings;
                                                const cancelled = c.status === 'cancelled';

                                                return (
                                                    <button
                                                        key={c.id}
                                                        disabled={cancelled || full || isPastDay}
                                                        onClick={() => !booked && !full && !cancelled && !isPastDay && navigate(`/app/book/${c.id}`)}
                                                        className={cn(
                                                            "w-full rounded-lg transition-all text-left overflow-hidden border shadow-sm",
                                                            booked && "bg-gradient-to-r from-success/10 to-success/10 border-success/30",
                                                            !booked && !full && !cancelled && !isPastDay && "bg-card hover:shadow-md cursor-pointer border-border",
                                                            (full || cancelled || isPastDay) && !booked && "bg-muted/50 border-border/50 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <div className="h-1 w-full" style={{ backgroundColor: c.class_type_color || '#9ca3af' }} />
                                                        <div className="p-2">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                                <span className="font-bold text-sm tabular-nums">{c.start_time.slice(0, 5)}</span>
                                                                {booked && <Check className="h-3 w-3 text-success ml-auto" />}
                                                            </div>
                                                            <p className="text-xs font-medium leading-tight mb-1">{c.class_type_name}</p>
                                                            {!booked && (
                                                                <div className="flex items-center gap-1 text-muted-foreground">
                                                                    <Users className="h-3 w-3" />
                                                                    <span className="text-[10px]">
                                                                        {cancelled ? 'Cancelada' : full ? 'Lleno' : `${spotsLeft} lugares`}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })}

                                            {dayClasses.length === 0 && (
                                                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
                                                    Sin clases
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desktop: 7-column grid */}
                    <div className="hidden sm:grid grid-cols-7 gap-2">
                        {/* Day Headers */}
                        {Array.from({ length: 7 }).map((_, i) => {
                            const day = addDays(weekStart, i);
                            const isToday = isSameDay(day, new Date());
                            const isPastDay = isPast(day) && !isToday;

                            return (
                                <div 
                                    key={`header-${i}`} 
                                    className={cn(
                                        "text-center py-3 rounded-t-xl",
                                        isToday && "bg-primary text-primary-foreground",
                                        !isToday && "bg-muted/50"
                                    )}
                                >
                                    <div className={cn(
                                        "text-[10px] font-medium tracking-wider",
                                        isToday ? "text-primary-foreground/80" : "text-muted-foreground",
                                        isPastDay && "opacity-50"
                                    )}>
                                        {DAYS[i]}
                                    </div>
                                    <div className={cn(
                                        "text-lg font-bold",
                                        isToday ? "text-primary-foreground" : "text-foreground",
                                        isPastDay && "opacity-50"
                                    )}>
                                        {format(day, 'd')}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Classes for each day */}
                        {Array.from({ length: 7 }).map((_, i) => {
                            const day = addDays(weekStart, i);
                            const isToday = isSameDay(day, new Date());
                            const isPastDay = isPast(day) && !isToday;
                            const dayClasses = getClassesForDay(day);

                            return (
                                <div 
                                    key={`classes-${i}`} 
                                    className={cn(
                                        "min-h-[280px] p-1 sm:p-2 rounded-b-xl border-x border-b",
                                        isToday && "bg-primary/5 border-primary/20",
                                        !isToday && "bg-card",
                                        isPastDay && "opacity-60"
                                    )}
                                >
                                    <div className="space-y-1.5">
                                        {dayClasses.map(c => {
                                            const booked = isBooked(c.id);
                                            const full = c.current_bookings >= c.max_capacity;
                                            const spotsLeft = c.max_capacity - c.current_bookings;
                                            const cancelled = c.status === 'cancelled';

                                            return (
                                                <button
                                                    key={c.id}
                                                    disabled={cancelled || full || isPastDay}
                                                    onClick={() => !booked && !full && !cancelled && !isPastDay && navigate(`/app/book/${c.id}`)}
                                                    className={cn(
                                                        "w-full rounded-lg transition-all text-left overflow-hidden",
                                                        "border shadow-sm",
                                                        booked && "bg-gradient-to-r from-success/10 to-success/10 border-success/30 dark:from-success/40 dark:to-success/40 dark:border-success/30",
                                                        !booked && !full && !cancelled && !isPastDay && "bg-card hover:shadow-md hover:scale-[1.02] cursor-pointer border-border",
                                                        (full || cancelled || isPastDay) && !booked && "bg-muted/50 border-border/50 cursor-not-allowed"
                                                    )}
                                                >
                                                    {/* Color bar */}
                                                    <div 
                                                        className="h-1 w-full"
                                                        style={{ backgroundColor: c.class_type_color || '#9ca3af' }}
                                                    />
                                                    
                                                    <div className="p-2 sm:p-2.5">
                                                        {/* Time */}
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                                <span className="font-bold text-sm tabular-nums">
                                                                    {c.start_time.slice(0, 5)}
                                                                </span>
                                                            </div>
                                                            {booked && (
                                                                <div className="flex items-center gap-0.5 text-success dark:text-success">
                                                                    <Check className="h-3 w-3" />
                                                                    <span className="text-[10px] font-medium hidden sm:inline">Reservado</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Class name */}
                                                        <p className={cn(
                                                            "text-xs font-medium truncate mb-1.5",
                                                            cancelled && "line-through text-muted-foreground"
                                                        )}>
                                                            {c.class_type_name}
                                                        </p>

                                                        {/* Spots */}
                                                        {!booked && (
                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                <Users className="h-3 w-3" />
                                                                <span className="text-[10px]">
                                                                    {cancelled ? 'Cancelada' : full ? 'Lleno' : `${spotsLeft} lugares`}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}

                                        {dayClasses.length === 0 && (
                                            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground italic">
                                                Sin clases
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-gradient-to-r from-success/10 to-success/10 border border-success/30" />
                            <span>Reservado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-card border border-border" />
                            <span>Disponible</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded bg-muted border border-border" />
                            <span>Lleno / Pasado</span>
                        </div>
                    </div>
                </div>
            </ClientLayout>
        </AuthGuard>
    );
}
