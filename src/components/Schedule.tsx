import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  addDays,
  startOfWeek,
  isSameDay,
  parseISO,
  isToday,
  isPast,
  addWeeks,
  subWeeks,
  differenceInMinutes,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BookingDialog } from './BookingDialog';
import api from '@/lib/api';

/* ── Types ─────────────────────────────────────── */
interface ScheduleClass {
  id: string;
  name: string;
  time: string;
  endTime: string;
  duration: number;
  instructor: string;
  spots: number;
  maxSpots: number;
  color: string;
}

interface ClassItem {
  id: string;
  time: string;
  type: string;
  instructor: string;
  spots: number;
  duration: string;
  date?: Date;
}

interface ApiClass {
  id: string;
  date: string;
  class_date: string;
  start_time: string;
  end_time: string;
  class_type_name: string;
  class_type_color: string;
  instructor_name: string;
  capacity: number;
  current_bookings: number;
  status: string;
}

const fallbackColors: Record<string, string> = {
  'Barré': '#8C8475',
  'Pilates Mat': '#A2A88B',
  'Yoga Sculpt': '#B7AE9B',
  'Sculpt': '#C4A882',
};

/* ── Component ─────────────────────────────────── */
export default function Schedule() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(new Date());

  /* Update "now" every 30 seconds so countdowns stay fresh */
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  /**
   * For today's classes: returns time status info
   * - past: class already ended
   * - in-progress: class is happening now
   * - upcoming: class hasn't started yet
   */
  const getTimeStatus = (cls: ScheduleClass) => {
    const classStart = parseISO(cls.time);
    if (!isToday(classStart)) return null;

    // Build end time
    const dateStr = cls.time.split('T')[0];
    const endDateTime = cls.endTime ? parseISO(`${dateStr}T${cls.endTime}`) : new Date(classStart.getTime() + cls.duration * 60_000);

    if (now >= endDateTime) {
      // Class already ended
      return { status: 'past' as const, label: 'Finalizada' };
    }
    if (now >= classStart && now < endDateTime) {
      // Class is happening now
      const minsLeft = differenceInMinutes(endDateTime, now);
      return { status: 'in-progress' as const, label: `En curso · ${minsLeft} min restantes` };
    }
    // Class hasn't started
    const minsUntil = differenceInMinutes(classStart, now);
    if (minsUntil < 60) {
      return { status: 'upcoming' as const, label: `En ${minsUntil} min` };
    }
    const hours = Math.floor(minsUntil / 60);
    const mins = minsUntil % 60;
    if (mins === 0) {
      return { status: 'upcoming' as const, label: `En ${hours}h` };
    }
    return { status: 'upcoming' as const, label: `En ${hours}h ${mins}m` };
  };

  /* API fetch */
  const startDate = format(weekStart, 'yyyy-MM-dd');
  const endDate = format(addDays(weekStart, 13), 'yyyy-MM-dd');

  const { data: apiClasses, isLoading } = useQuery<ApiClass[]>({
    queryKey: ['public-classes', startDate, endDate],
    queryFn: async () => {
      const { data } = await api.get(`/classes?start_date=${startDate}&end_date=${endDate}`);
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });

  /* Transform API → internal */
  const allClasses: ScheduleClass[] = useMemo(() => {
    if (!apiClasses) return [];
    return apiClasses
      .filter((cls) => cls.status !== 'cancelled')
      .map((cls) => {
        const dateStr = (cls.date || cls.class_date || '').split('T')[0];
        const available = cls.capacity - (cls.current_bookings || 0);
        return {
          id: cls.id,
          name: cls.class_type_name,
          time: `${dateStr}T${cls.start_time}`,
          endTime: cls.end_time || '',
          duration: 50,
          instructor: cls.instructor_name || 'Por confirmar',
          spots: Math.max(0, available),
          maxSpots: cls.capacity,
          color: cls.class_type_color || fallbackColors[cls.class_type_name] || '#717f9b',
        };
      });
  }, [apiClasses]);

  /* Week days */
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  /* Filtered classes */
  const dayClasses = useMemo(() => {
    return allClasses
      .filter((cls) => isSameDay(parseISO(cls.time), selectedDate))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, allClasses]);

  const filteredClasses = useMemo(() => {
    if (filter === 'all') return dayClasses;
    return dayClasses.filter((c) => c.name === filter);
  }, [dayClasses, filter]);

  const uniqueTypes = useMemo(() => [...new Set(dayClasses.map((c) => c.name))], [dayClasses]);

  const getClassCount = (day: Date) =>
    allClasses.filter((cls) => isSameDay(parseISO(cls.time), day)).length;

  /* Helpers */
  const formatTime = (t: string) => {
    try {
      return format(parseISO(t), 'HH:mm');
    } catch {
      return t;
    }
  };

  const handleBook = (cls: ScheduleClass) => {
    setSelectedClass({
      id: cls.id,
      time: formatTime(cls.time),
      type: cls.name,
      instructor: cls.instructor,
      spots: cls.spots,
      duration: `${cls.duration} min`,
      date: parseISO(cls.time),
    });
    setDialogOpen(true);
  };

  /* ── Render ──────────────────────────────────── */
  return (
    <section id="horarios" className="bg-background py-0">
      {/* ─── Elegant header with week selector ─── */}
      <div className="bg-gradient-to-br from-essenza-dark via-[#232323] to-essenza-dark relative overflow-hidden">
        {/* Decorative accents */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-essenza-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-essenza-olive/[0.08] blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 rounded-full bg-essenza-sand/[0.03] blur-3xl" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8 relative z-10">
          {/* Title */}
          <div className="text-center mb-10">
            <p className="text-[10px] sm:text-xs uppercase tracking-[4px] text-essenza-gold/60 font-semibold mb-2 font-body">
              Essenza del Flusso
            </p>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold text-white tracking-tight">
              Horario de clases
            </h2>
            <div className="w-12 h-0.5 bg-essenza-gold/40 mx-auto mt-4" />
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-center gap-5 mb-8">
            <button
              onClick={() => setWeekStart((prev) => subWeeks(prev, 1))}
              className="w-9 h-9 rounded-full bg-essenza-gold/10 border border-essenza-gold/20 flex items-center justify-center text-essenza-gold hover:bg-essenza-gold/20 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-essenza-sand text-sm font-semibold tracking-[2px] uppercase font-body min-w-[160px] text-center">
              {format(selectedDate, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={() => setWeekStart((prev) => addWeeks(prev, 1))}
              className="w-9 h-9 rounded-full bg-essenza-gold/10 border border-essenza-gold/20 flex items-center justify-center text-essenza-gold hover:bg-essenza-gold/20 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Week day pills — scrollable on mobile */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const dayIsToday = isToday(day);
              const dayIsPast = isPast(day) && !dayIsToday;
              const count = getClassCount(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    if (!dayIsPast) {
                      setSelectedDate(day);
                      setFilter('all');
                    }
                  }}
                  disabled={dayIsPast}
                  className={`
                    flex-shrink-0 min-w-[52px] sm:min-w-0 sm:flex-1 flex flex-col items-center py-3 sm:py-4 rounded-2xl transition-all duration-300
                    ${isSelected
                      ? 'bg-essenza-gold text-white shadow-lg shadow-essenza-gold/20 scale-[1.03]'
                      : dayIsToday && !isSelected
                        ? 'bg-essenza-gold/10 border border-essenza-gold/30 cursor-pointer hover:bg-essenza-gold/20'
                        : dayIsPast
                          ? 'bg-white/[0.03] opacity-30 cursor-not-allowed'
                          : 'bg-white/[0.05] hover:bg-white/[0.10] cursor-pointer border border-transparent hover:border-essenza-sand/20'
                    }
                  `}
                >
                  <span
                    className={`text-[9px] sm:text-[10px] font-semibold tracking-[1.5px] uppercase font-body ${
                      isSelected ? 'text-white/80' : dayIsToday ? 'text-essenza-gold/70' : 'text-white/35'
                    }`}
                  >
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span
                    className={`text-xl sm:text-2xl font-extrabold leading-tight mt-0.5 ${
                      isSelected ? 'text-white' : dayIsToday ? 'text-essenza-gold' : 'text-white/80'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {/* Dots */}
                  {count > 0 && !dayIsPast && (
                    <div className="flex gap-[3px] mt-1.5">
                      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? 'bg-white/60' : dayIsToday ? 'bg-essenza-gold/50' : 'bg-essenza-sand/30'
                          }`}
                        />
                      ))}
                      {count > 4 && (
                        <span
                          className={`text-[7px] font-bold leading-[4px] ${
                            isSelected ? 'text-white/60' : 'text-essenza-sand/30'
                          }`}
                        >
                          +
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Content area ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary + filter row */}
        <div className="flex items-center justify-between mb-4">
          <div className="font-body">
            <span className="text-sm font-bold text-foreground">
              {filteredClasses.length} clase{filteredClasses.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm text-muted-foreground ml-2">
              · {format(selectedDate, 'EEE d MMM', { locale: es })}
            </span>
          </div>
        </div>

        {/* Type filter chips */}
        {dayClasses.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFilter('all')}
              className={`shrink-0 px-5 py-2 rounded-full text-xs font-semibold font-body transition-all ${
                filter === 'all'
                  ? 'bg-essenza-gold text-white shadow-sm'
                  : 'bg-card text-muted-foreground border border-border hover:border-essenza-gold/40 hover:text-essenza-gold'
              }`}
            >
              Todas
            </button>
            {uniqueTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`shrink-0 px-5 py-2 rounded-full text-xs font-semibold font-body transition-all ${
                  filter === type
                    ? 'bg-essenza-gold text-white shadow-sm'
                    : 'bg-card text-muted-foreground border border-border hover:border-essenza-gold/40 hover:text-essenza-gold'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-essenza-gold" />
          </div>
        )}

        {/* Classes list / grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredClasses.map((cls, i) => {
              const isFull = cls.spots === 0;
              const isLow = cls.spots <= 2 && cls.spots > 0;
              const spotsPercent = ((cls.maxSpots - cls.spots) / cls.maxSpots) * 100;
              const timeStatus = getTimeStatus(cls);
              const classPast = timeStatus?.status === 'past';
              const classInProgress = timeStatus?.status === 'in-progress';

              return (
                <div
                  key={cls.id}
                  className={`
                    group relative bg-card rounded-2xl overflow-hidden
                    border border-border/80 shadow-sm
                    transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-essenza-gold/30
                    ${isFull || classPast ? 'opacity-55' : ''}
                    ${classInProgress ? 'ring-2 ring-essenza-gold/40 border-essenza-gold/30' : ''}
                  `}
                >
                  {/* Color accent top bar */}
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: classPast ? '#999' : cls.color }}
                  />

                  <div className="p-5">
                    {/* Time status badge — only for today */}
                    {timeStatus && (
                      <div className="mb-2.5">
                        <span
                          className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-body
                            ${classPast
                              ? 'bg-muted/80 text-muted-foreground'
                              : classInProgress
                                ? 'bg-essenza-gold/15 text-essenza-gold animate-pulse'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                            }
                          `}
                        >
                          {classInProgress && <span className="w-1.5 h-1.5 rounded-full bg-essenza-gold" />}
                          {!classPast && !classInProgress && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {timeStatus.label}
                        </span>
                      </div>
                    )}
                    {/* Top: name + book button */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-foreground font-heading tracking-tight truncate">
                          {cls.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-essenza-olive" />
                          <span className="text-[13px] font-semibold font-body">
                            {formatTime(cls.time)} — {cls.endTime}
                          </span>
                          <span className="w-[3px] h-[3px] rounded-full bg-essenza-sand/60" />
                          <span className="text-xs font-body flex items-center gap-1 truncate">
                            <User className="w-3 h-3 shrink-0 text-essenza-olive" />
                            {cls.instructor}
                          </span>
                        </div>
                      </div>

                      {/* Book CTA */}
                      {classPast ? (
                        <span className="shrink-0 px-3.5 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold font-body">
                          Finalizada
                        </span>
                      ) : isFull ? (
                        <span className="shrink-0 px-3.5 py-2 rounded-xl bg-muted text-muted-foreground text-xs font-semibold font-body">
                          Llena
                        </span>
                      ) : (
                        <button
                          onClick={() => handleBook(cls)}
                          className="shrink-0 px-5 py-2.5 rounded-xl bg-essenza-gold text-white text-xs font-bold font-body
                                     hover:bg-essenza-gold/90 active:scale-[0.97] transition-all shadow-sm"
                        >
                          Reservar
                        </button>
                      )}
                    </div>

                    {/* Capacity bar */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-essenza-sand/20 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${spotsPercent}%`,
                            backgroundColor: isFull ? '#E57373' : isLow ? '#F0A050' : cls.color,
                          }}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold font-body shrink-0 ${
                          isFull
                            ? 'text-destructive'
                            : isLow
                              ? 'text-orange-500'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {isFull ? (
                          'Sin lugares'
                        ) : (
                          <>
                            <span style={{ color: isLow ? '#F0A050' : cls.color }} className="font-extrabold">
                              {cls.spots}
                            </span>
                            <span className="text-muted-foreground/50"> / {cls.maxSpots}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredClasses.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🧘‍♀️</div>
            <p className="text-sm font-semibold text-muted-foreground font-body">
              No hay clases {filter !== 'all' ? `de ${filter} ` : ''}disponibles este día
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="mt-3 px-5 py-2 rounded-xl bg-essenza-gold text-white text-xs font-semibold font-body hover:bg-essenza-gold/90 transition-all"
              >
                Ver todas
              </button>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-essenza-cream to-essenza-sand/20 border border-essenza-sand/30 text-center">
          <p className="font-heading text-xl text-essenza-dark mb-1">
            ¿Primera vez en Essenza?
          </p>
          <p className="text-sm font-body text-essenza-olive mb-5">
            Prueba una clase sin compromiso
          </p>
          <Link
            to="/register?returnUrl=/app/book"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-essenza-gold text-white rounded-xl text-sm font-semibold font-body hover:bg-essenza-gold/90 transition-all shadow-md hover:shadow-lg"
          >
            Reservar clase de prueba
            <span className="text-white/70 font-normal">$150</span>
          </Link>
        </div>
      </div>

      {/* Booking Dialog */}
      <BookingDialog classData={selectedClass} open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  );
}
