import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Sparkles, Target, Leaf, Flame } from "lucide-react";
import api from "@/lib/api";

interface ClassType {
  id: string;
  name: string;
  description: string;
  level: string;
  duration_minutes: number;
  icon: string;
  color: string;
}

// Canonical class definitions with exact copy from brand materials
const canonicalClasses = [
  {
    id: "1",
    name: "Barré",
    level: "all",
    duration_minutes: 50,
    description:
      "Barré combina lo mejor del ballet, pilates y ejercicios funcionales. Se realizan ejercicios isométricos y pulsos, cuidando siempre el equilibrio y la carga. Las series serán de repeticiones altas con cargas prolongadas, los movimientos más cortos y controlados para poder trabajar más a fondo los músculos. El objetivo principal es aislar grupos de músculos para llegar así al punto de máxima tensión permitiendo tonificar, alargar y compactar todo el cuerpo, activarás y esculpirás tus músculos de una forma precisa, tonificando tu cuerpo y mejorando tu postura. Es una práctica efectiva que se siente como un entrenamiento y una danza a la vez.",
    icon: "sparkles",
    color: "#8C8475",
    days: "Lunes, Miércoles y Viernes",
    tagline: "elegance in motion",
  },
  {
    id: "2",
    name: "Pilates Mat",
    level: "all",
    duration_minutes: 50,
    description:
      "A diferencia del pilates reformer, la resistencia proviene principalmente del peso corporal, la gravedad y la contracción muscular. Es una práctica en el piso diseñada para fortalecer y tonificar tu cuerpo, especialmente los músculos más profundos del core (abdomen, espalda baja y pelvis) fundamentales para el movimiento. Combina elongación y contracción, buscando siempre la conexión mente-cuerpo y una ejecución lenta y controlada con esto mejoras tu flexibilidad, postura y equilibrio, mientras trabajas con precisión y concentración.",
    icon: "target",
    color: "#A2A88B",
    days: "Martes y Jueves",
    tagline: "strength meets precision",
  },
  {
    id: "3",
    name: "Yoga Sculpt",
    level: "all",
    duration_minutes: 50,
    description:
      "Es una versión más dinámica y energizante del yoga tradicional. Con secuencias rápidas y posturas retadoras, yoga sculpt te hará sudar mientras te diviertes. Es ideal para aumentar tu fuerza, flexibilidad y concentración, además de brindarte un desafío emocionante que te hará sentirte lleno de energía.",
    icon: "leaf",
    color: "#D4A574",
    days: "Sábados",
    tagline: "energy unleashed",
  },
  {
    id: "4",
    name: "Sculpt",
    level: "all",
    duration_minutes: 50,
    description:
      "Es un entrenamiento de cuerpo completo (full body) o enfocado en grupos musculares específicos con movimientos controlados, sentadillas, planchas y ejercicios con resistencia para tonificar. Fusiona elementos de fuerza, entrenamiento funcional, pilates y a veces yoga o HIIT. Nuestras sesiones pueden incluir cardio ligero o intervalos para acelerar el metabolismo y la quema de grasa. Trabaja músculos que a veces se pasan por alto, especialmente en glúteos y cadera, con movimientos lentos y controlados. Mejora la fuerza, potencia, resistencia, flexibilidad y quema calorías, ayudando a la definición muscular.",
    icon: "flame",
    color: "#C6A77A",
    days: "Domingos",
    tagline: "energy unleashed",
  },
];

const levelLabels: Record<string, string> = {
  all: "Todos los niveles",
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

// Map icon names to Lucide components
const iconComponents: Record<string, React.ElementType> = {
  sparkles: Sparkles,
  target: Target,
  "circle-dot": Target,
  leaf: Leaf,
  flame: Flame,
};

// Map class names to icon components as fallback
const nameToIcon: Record<string, React.ElementType> = {
  "barré": Sparkles,
  "barre": Sparkles,
  "pilates mat": Target,
  "pilates": Target,
  "yoga sculpt": Leaf,
  "yoga": Leaf,
  "sculpt": Flame,
};

const ClassTypes = () => {
  const { data: classTypes, isLoading } = useQuery<ClassType[]>({
    queryKey: ["class-types-public"],
    queryFn: async () => {
      const { data } = await api.get("/class-types");
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Only show the 4 canonical classes — ignore API data, use curated content
  const displayClassTypes = canonicalClasses;

  // Helper to get Lucide icon component for a class
  const getIcon = (classType: any) => {
    if (classType.icon && iconComponents[classType.icon]) return iconComponents[classType.icon];
    const nameKey = classType.name.toLowerCase();
    return nameToIcon[nameKey] || Sparkles;
  };

  return (
    <section id="clases" className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-sm font-body text-essenza-olive tracking-widest uppercase mb-4 block">
            Nuestro Método
          </span>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-light text-foreground mb-6">
            Clases diseñadas para
            <br />
            <span className="font-semibold text-essenza-olive">cada objetivo</span>
          </h2>
          <p className="font-body text-lg text-muted-foreground">
            Barré, Pilates Mat, Yoga Sculpt y Sculpt conviven en un mismo
            espacio. Todas nuestras sesiones están limitadas a 12 personas para
            garantizar atención personalizada.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Class Cards Grid */}
        {!isLoading && (
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {displayClassTypes.map((classType, index) => (
              <div
                key={classType.id}
                className="group relative bg-card rounded-sm p-5 sm:p-8 border border-border hover:border-essenza-olive/40 transition-all duration-500 hover:shadow-lg cursor-pointer overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Color accent bar */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5"
                  style={{ backgroundColor: classType.color }}
                />
                
                <div className="flex items-start justify-between mb-4 pl-3">
                  {(() => {
                    const IconComp = getIcon(classType);
                    return (
                      <span 
                        className="w-12 h-12 flex items-center justify-center rounded-full"
                        style={{ backgroundColor: `${classType.color}20` }}
                      >
                        <IconComp className="w-5 h-5" style={{ color: classType.color }} />
                      </span>
                    );
                  })()}
                  <span
                    className="px-3 py-1 rounded-full text-xs font-body tracking-wide"
                    style={{ 
                      backgroundColor: `${classType.color}20`,
                      color: classType.color
                    }}
                  >
                    {levelLabels[classType.level] || classType.level}
                  </span>
                </div>

                <div className="pl-3">
                  <h3 className="font-heading text-2xl font-semibold text-foreground mb-1">
                    {classType.name}
                  </h3>

                  {(classType as any).tagline && (
                    <span className="text-xs font-heading italic text-essenza-olive mb-2 block">
                      {(classType as any).tagline}
                    </span>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-body text-muted-foreground">
                      {classType.duration_minutes} min
                    </span>
                    {(classType as any).days && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-sm font-body font-medium text-foreground/60">
                          {(classType as any).days}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="font-body text-foreground/70 mb-6 line-clamp-3">
                    {classType.description}
                  </p>

                  <div 
                    className="flex items-center gap-2 font-body text-sm group-hover:gap-4 transition-all duration-300"
                    style={{ color: classType.color }}
                  >
                    <span>Ver horarios</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAQ for Beginners — with studio photo */}
        <div className="mt-20 rounded-sm overflow-hidden">
          <div className="grid lg:grid-cols-2">
            {/* Photo side */}
            <div className="relative min-h-[300px] lg:min-h-[400px]">
              <img 
                src="/studio-neon.jpg" 
                alt="Essenza del Flusso — This is where the magic happens"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* FAQ side */}
            <div className="bg-muted p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
              <h3 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mb-8">
                ¿Primera vez en el estudio?
              </h3>
              <div className="space-y-6">
                <div>
                  <h4 className="font-body font-semibold text-foreground mb-2">
                    ¿Qué ropa llevo?
                  </h4>
                  <p className="font-body text-muted-foreground text-sm">
                    Ropa cómoda y ajustada. Evita cremalleras y cierres que puedan
                    dañar el equipo.
                  </p>
                </div>
                <div>
                  <h4 className="font-body font-semibold text-foreground mb-2">
                    ¿Necesito calcetines?
                  </h4>
                  <p className="font-body text-muted-foreground text-sm">
                    Sí, calcetines con grip antideslizante. Los vendemos en
                    recepción si no tienes.
                  </p>
                </div>
                <div>
                  <h4 className="font-body font-semibold text-foreground mb-2">
                    ¿Cuándo llego?
                  </h4>
                  <p className="font-body text-muted-foreground text-sm">
                    Llega 15 minutos antes de tu primera clase para hacer tu
                    check-in y conocer el estudio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClassTypes;
