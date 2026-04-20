import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, startOfWeek, addDays, isSameDay, parseISO, isToday, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Users, ArrowRight, Calendar, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import type { Class } from '@/types/class';
import { cn } from '@/lib/utils';

const loginReturnUrl = '/login?returnUrl=/app/classes';

function getDayLabel(date: Date) {
    return format(date, 'EEE', { locale: es }).slice(0, 3).toUpperCase();
}

function formatTime(t: string) {
    return t.slice(0, 5);
}

function ClassRow({ klass, featured = false }: { klass: Class; featured?: boolean }) {
    const accent = klass.class_type_color || '#af8b3b';
    const full = (klass.current_bookings ?? 0) >= klass.max_capacity;
    const spots = klass.max_capacity - (klass.current_bookings ?? 0);

    return (
        <Link
            to={loginReturnUrl}
            className={cn(
                'group relative block rounded-3xl border border-essenza-outlineVariant/40 bg-surface-container-lowest overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-[0_20px_50px_-24px_rgba(175,139,59,0.3)] active:scale-[0.99]',
                featured ? 'p-6 md:p-8' : 'p-5'
            )}
        >
            <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: accent }}
                aria-hidden="true"
            />

            <div className={cn('flex gap-5', featured ? 'flex-col md:flex-row md:items-center' : 'items-start')}>
                <div className={cn('flex-shrink-0', featured ? 'md:w-40' : 'w-24')}>
                    <div className="flex items-baseline gap-1.5">
                        <span className={cn('font-headline text-primary leading-none', featured ? 'text-3xl md:text-4xl' : 'text-xl')}>
                            {formatTime(klass.start_time)}
                        </span>
                        <span className="text-[10px] text-essenza-secondary uppercase tracking-widest">
                            {klass.start_time >= '12:00' ? 'PM' : 'AM'}
                        </span>
                    </div>
                    <p className="text-[10px] text-essenza-secondary uppercase tracking-[0.2em] mt-1">
                        {formatTime(klass.start_time)} – {formatTime(klass.end_time)}
                    </p>
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className={cn('font-heading text-foreground leading-tight mb-1', featured ? 'text-2xl md:text-3xl' : 'text-lg')}>
                        {klass.class_type_name || 'Clase'}
                    </h3>
                    <p className="text-sm text-essenza-secondary">
                        {klass.instructor_name || 'Coach por asignar'}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-xs text-essenza-secondary">
                        <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {full ? (
                                <span className="font-semibold text-foreground/70">Lista de espera</span>
                            ) : (
                                <span>
                                    <span className="font-semibold text-foreground/80">{spots}</span> {spots === 1 ? 'lugar' : 'lugares'}
                                </span>
                            )}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {klass.max_capacity - spots}/{klass.max_capacity}
                        </span>
                    </div>
                </div>

                <div className="hidden md:flex items-center text-primary/60 group-hover:text-primary transition-colors">
                    <ArrowRight className="h-5 w-5 -translate-x-1 group-hover:translate-x-0 transition-transform" />
                </div>
            </div>

            {featured && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Próxima</span>
                </div>
            )}
        </Link>
    );
}

export function ClassesCalendarPreview() {
    const now = useMemo(() => new Date(), []);
    const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now]);
    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

    const initialDay = days.find((d) => !isBefore(d, new Date(now.setHours(0, 0, 0, 0)))) || days[0];
    const [selectedDay, setSelectedDay] = useState<Date>(initialDay);

    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

    const { data: classes = [], isLoading } = useQuery<Class[]>({
        queryKey: ['landing-classes', startStr, endStr],
        queryFn: async () => {
            const { data } = await api.get(`/classes?start=${startStr}&end=${endStr}`);
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const dayClasses = useMemo(() => {
        return classes
            .filter((c) => isSameDay(parseISO(c.date), selectedDay) && c.status !== 'cancelled')
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [classes, selectedDay]);

    const [featured, ...rest] = dayClasses;

    return (
        <section id="clases" className="py-24 md:py-32 px-6 bg-surface-container-lowest">
            <div className="container mx-auto max-w-7xl">
                <div className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                    <div data-reveal className="opacity-0 translate-y-8">
                        <span className="font-label text-[11px] uppercase tracking-[0.4em] text-primary/80 mb-4 block">
                            Esta semana
                        </span>
                        <h2 className="font-signature text-[clamp(2.25rem,5.5vw,4rem)] text-primary mb-4 leading-[1.05]">
                            Reserva tu lugar
                        </h2>
                        <p className="text-essenza-secondary text-base md:text-lg font-light max-w-[50ch]">
                            Clases en vivo, cupos reales. Los lugares se llenan rápido — ve la semana completa y aparta el tuyo.
                        </p>
                    </div>
                    <Link
                        to={loginReturnUrl}
                        className="inline-flex items-center gap-2 self-start md:self-end rounded-full border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                        Ver todas
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                <div
                    className="flex gap-2 md:gap-3 overflow-x-auto pb-2 mb-8 snap-x -mx-6 px-6 md:mx-0 md:px-0 scrollbar-none"
                    role="tablist"
                    aria-label="Seleccionar día"
                >
                    {days.map((day) => {
                        const active = isSameDay(day, selectedDay);
                        const past = isBefore(day, new Date(now.setHours(0, 0, 0, 0)));
                        const count = classes.filter((c) => isSameDay(parseISO(c.date), day) && c.status !== 'cancelled').length;

                        return (
                            <button
                                key={day.toISOString()}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setSelectedDay(day)}
                                disabled={past && count === 0}
                                className={cn(
                                    'snap-start flex-shrink-0 flex flex-col items-center justify-center gap-1 min-w-[72px] md:min-w-[92px] rounded-2xl border px-4 py-3 md:py-4 transition-all duration-300',
                                    active
                                        ? 'border-primary bg-primary text-white shadow-[0_18px_40px_-20px_rgba(175,139,59,0.55)]'
                                        : past
                                            ? 'border-essenza-outlineVariant/30 bg-surface-container-lowest text-foreground/30 cursor-not-allowed'
                                            : 'border-essenza-outlineVariant/50 bg-surface-container-lowest text-foreground hover:border-primary/40 hover:-translate-y-0.5 active:scale-[0.98]'
                                )}
                            >
                                <span className={cn('text-[10px] font-semibold uppercase tracking-[0.2em]', active ? 'text-white/85' : 'text-essenza-secondary')}>
                                    {getDayLabel(day)}
                                </span>
                                <span className={cn('font-headline text-2xl leading-none', isToday(day) && !active && 'text-primary')}>
                                    {format(day, 'd')}
                                </span>
                                <span className={cn('text-[10px] uppercase tracking-wider', active ? 'text-white/75' : 'text-essenza-secondary/70')}>
                                    {count > 0 ? `${count} clase${count === 1 ? '' : 's'}` : '—'}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        <div className="h-36 rounded-3xl bg-essenza-outlineVariant/20 animate-pulse" />
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="h-28 rounded-3xl bg-essenza-outlineVariant/20 animate-pulse" />
                            <div className="h-28 rounded-3xl bg-essenza-outlineVariant/20 animate-pulse" />
                        </div>
                    </div>
                ) : dayClasses.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-essenza-outlineVariant/40 bg-surface-container-lowest p-12 md:p-16 text-center">
                        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-4">
                            <Calendar className="h-6 w-6 text-primary/70" />
                        </div>
                        <h3 className="font-heading text-xl text-foreground mb-2">Sin clases este día</h3>
                        <p className="text-sm text-essenza-secondary max-w-md mx-auto mb-6">
                            Prueba con otro día de la semana — tenemos clases todos los días hábiles.
                        </p>
                        <Link
                            to={loginReturnUrl}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                        >
                            Ver semana completa <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4" data-reveal>
                        {featured && <ClassRow klass={featured} featured />}
                        {rest.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rest.map((c) => (
                                    <ClassRow key={c.id} klass={c} />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <p className="mt-12 text-center text-xs text-essenza-secondary uppercase tracking-[0.3em]">
                    Inicia sesión o regístrate para reservar
                </p>
            </div>
        </section>
    );
}
