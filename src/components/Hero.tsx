import { Button } from "@/components/ui/button";
import { Play, ChevronDown } from "lucide-react";
import heroImage from "@/assets/hero.jpeg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-end overflow-hidden">
      {/* Background Image — full quality, minimal overlay */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="Essenza del Flusso — Barré, Pilates, Yoga Sculpt"
          className="w-full h-full object-cover"
        />
        {/* Subtle gradient only at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        {/* Very light vignette for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.2)_100%)]" />
      </div>

      {/* Content — positioned at bottom */}
      <div className="relative z-10 w-full pb-28 pt-40">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl">
            {/* Main Heading */}
            <h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-light text-white leading-[1.1] mb-5 animate-fade-up">
              Tu mejor versión
              <br />
              <span className="font-semibold italic text-essenza-olive">
                empieza aquí
              </span>
            </h1>

            {/* Subheading */}
            <p className="font-body text-base md:text-lg text-white/60 max-w-lg mb-8 animate-fade-up delay-100 leading-relaxed">
              Barré, Pilates Mat, Yoga Sculpt y Sculpt en un espacio diseñado
              para transformarte.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 animate-fade-up delay-200">
              <Button variant="hero" size="xl" asChild className="bg-essenza-olive hover:bg-essenza-olive/90 w-full sm:w-auto text-center justify-center">
                <a href="#precios">Prueba tu primera clase — $150</a>
              </Button>
              <Button
                variant="heroOutline"
                size="xl"
                className="gap-2 border-white/20 text-white hover:bg-white/10 w-full sm:w-auto justify-center"
                asChild
              >
                <a href="#videos">
                  <Play className="w-4 h-4" />
                  Ver experiencia
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
          <a
            href="#clases"
            className="flex flex-col items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors"
          >
            <span className="text-[10px] font-body tracking-[0.2em] uppercase">
              Descubre
            </span>
            <ChevronDown className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
