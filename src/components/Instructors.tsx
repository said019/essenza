import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { Loader2, User } from "lucide-react";
import { useSearchParams } from "react-router-dom";

interface Instructor {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
  is_active: boolean;
  visible_public: boolean;
}

const Instructors = () => {
  const [_, setSearchParams] = useSearchParams();

  const { data: instructors, isLoading } = useQuery<Instructor[]>({
    queryKey: ['public-instructors'],
    queryFn: async () => {
      const response = await api.get('/instructors');
      // Filter only active AND visible_public instructors
      return response.data.filter((i: Instructor) => i.is_active && i.visible_public);
    },
  });

  const scrollToSchedule = (instructorId: string) => {
    setSearchParams({ instructorId });
    const scheduleSection = document.getElementById('horarios');
    if (scheduleSection) {
      scheduleSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Don't show section if no instructors
  if (!isLoading && (!instructors || instructors.length === 0)) {
    return null;
  }

  return (
    <section id="instructores" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-body text-essenza-olive tracking-widest uppercase mb-4 block">
            Nuestro Equipo
          </span>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-light text-foreground mb-6">
            Instructores que
            <br />
            <span className="font-semibold text-essenza-olive">transforman vidas</span>
          </h2>
          <p className="font-body text-lg text-muted-foreground">
            Cada uno de nuestros instructores está certificado internacionalmente
            y trae su propia pasión única al estudio.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Instructor Cards */}
        {!isLoading && instructors && (
          <div className={`grid gap-8 ${instructors.length <= 2
              ? 'md:grid-cols-2 max-w-3xl mx-auto'
              : instructors.length === 3
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2 lg:grid-cols-4'
            }`}>
            {instructors.map((instructor, index) => (
              <div
                key={instructor.id}
                className="group relative"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm mb-6 bg-muted">
                  {instructor.photo_url ? (
                    <img
                      src={instructor.photo_url}
                      alt={instructor.display_name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-24 w-24 text-muted-foreground/40" />
                    </div>
                  )}
                  {/* Always-visible bottom gradient + button */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-6 pt-16">
                    <Button
                      variant="heroOutline"
                      size="sm"
                      className="w-full bg-white/90 backdrop-blur-sm text-foreground hover:bg-white border-0"
                      onClick={() => scrollToSchedule(instructor.id)}
                    >
                      Ver clases de {instructor.display_name.split(" ")[0]}
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div>
                  <span className="text-xs font-body text-essenza-olive tracking-widest uppercase">
                    Instructor
                  </span>
                  <h3 className="font-heading text-2xl font-semibold text-foreground mt-1 mb-2">
                    {instructor.display_name}
                  </h3>
                  {instructor.specialties && instructor.specialties.length > 0 && (
                    <span className="text-sm font-body text-essenza-olive mb-3 block">
                      {instructor.specialties.slice(0, 2).join(' & ')}
                    </span>
                  )}
                  {instructor.bio && (
                    <p className="font-body text-muted-foreground text-sm">
                      {instructor.bio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Instructors;
