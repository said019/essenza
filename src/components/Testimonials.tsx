import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Itzel Rodriguez",
    role: "Miembro verificado",
    quote:
      "Excelente estudio de pilates en mat. Las rutinas están muy bien planeadas, son retadoras y se adaptan a distintos niveles. Las coaches son muy pacientes y cuidan mucho tu postura.",
    rating: 5,
  },
  {
    name: "Nancy Paloma Ramirez",
    role: "Miembro verificado",
    quote:
      "Un lugar muy bonito, con coaches profesionales y atentas. La coach Pao es una persona muy linda, amable y profesional. Definitivamente el mejor lugar para conectar con tu cuerpo.",
    rating: 5,
  },
  {
    name: "Yurithzia Rodriguez",
    role: "Miembro verificado",
    quote:
      "Un lugar bonito y seguro. Las coaches son muy amables, las clases son muy buenas y te brindan los accesorios necesarios para cada clase. Si vas empezando, te prestan tapetes.",
    rating: 5,
  },
  {
    name: "Mariana Rodríguez",
    role: "Miembro verificado",
    quote:
      "Es un lugar increíble, te sientes acompañada en cualquier momento. Pao es una gran persona y coach que te hace sentir parte desde el minuto uno. Las instalaciones son muy bonitas y cómodas.",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 lg:py-32 bg-background">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-body text-essenza-olive tracking-widest uppercase mb-4 block">
            Testimonios
          </span>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-light text-foreground">
            Lo que dicen
            <br />
            <span className="font-semibold text-essenza-olive">nuestros miembros</span>
          </h2>
        </div>

        {/* Testimonials Grid */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="bg-card border border-border rounded-sm p-6 sm:p-8 hover:shadow-lg transition-shadow duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-essenza-olive text-essenza-olive"
                  />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="font-body text-lg text-foreground/90 mb-6 leading-relaxed">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <span className="font-heading text-lg font-semibold text-foreground">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <span className="block font-body font-semibold text-foreground">
                    {testimonial.name}
                  </span>
                  <span className="text-sm font-body text-muted-foreground">
                    {testimonial.role}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Instagram Feed Placeholder */}
        <div className="mt-20">
          <div className="text-center mb-8">
            <h3 className="font-heading text-2xl font-semibold text-foreground mb-2">
              Síguenos en Instagram
            </h3>
            <a
              href="https://www.instagram.com/essenza.barre"
              target="_blank"
              rel="noopener noreferrer"
              className="text-essenza-olive font-body hover:underline"
            >
              @essenza.barre
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-muted rounded-sm overflow-hidden hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-full h-full bg-gradient-to-br from-muted to-card flex items-center justify-center">
                  <span className="text-4xl opacity-50">📷</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
