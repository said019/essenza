import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Sesión Muestra",
    description: "Primera vez / Individual",
    price: 150,
    period: "sesión única",
    features: [
      "1 clase de prueba",
      "Conoce nuestro método",
      "Acceso a vestuarios",
      "Sin compromiso",
    ],
    popular: false,
    cta: "Reservar Clase de Prueba",
  },
  {
    name: "Sesión Extra",
    description: "Socias o inscritas",
    price: 120,
    period: "por clase",
    features: [
      "1 clase adicional",
      "Requiere membresía activa",
      "Acceso a vestuarios",
      "Cualquier horario disponible",
    ],
    popular: false,
    cta: "Reservar Clase",
  },
  {
    name: "Una Sesión",
    description: "4 sesiones al mes",
    price: 570,
    period: "mensual",
    pricePerClass: 143,
    features: [
      "4 clases al mes",
      "Reserva prioritaria",
      "Acceso a vestuarios",
      "Válido 30 días",
    ],
    popular: false,
    cta: "Comprar Plan",
  },
  {
    name: "Dos Sesiones",
    description: "8 sesiones al mes",
    price: 870,
    period: "mensual",
    pricePerClass: 109,
    features: [
      "8 clases al mes",
      "Reserva prioritaria",
      "Acceso a vestuarios",
      "Válido 30 días",
    ],
    popular: false,
    cta: "Comprar Plan",
  },
  {
    name: "Tres Sesiones",
    description: "12 sesiones al mes",
    price: 1040,
    period: "mensual",
    pricePerClass: 87,
    features: [
      "12 clases al mes",
      "Reserva prioritaria",
      "Acceso a todas las clases",
      "Válido 30 días",
    ],
    popular: true,
    cta: "Comprar Plan",
  },
  {
    name: "Cuatro Sesiones",
    description: "16 sesiones al mes",
    price: 1230,
    period: "mensual",
    pricePerClass: 77,
    features: [
      "16 clases al mes",
      "Reserva prioritaria 48h",
      "Acceso a clases especiales",
      "Válido 30 días",
    ],
    popular: false,
    cta: "Comprar Plan",
  },
  {
    name: "Cinco Sesiones",
    description: "20 sesiones al mes",
    price: 1420,
    period: "mensual",
    pricePerClass: 71,
    features: [
      "20 clases al mes",
      "Reserva prioritaria 48h",
      "Acceso a clases especiales",
      "10% descuento en tienda",
      "Válido 30 días",
    ],
    popular: false,
    cta: "Comprar Plan",
  },
  {
    name: "Seis Sesiones",
    description: "24 sesiones al mes",
    price: 1600,
    period: "mensual",
    pricePerClass: 67,
    features: [
      "24 clases al mes",
      "Reserva prioritaria 48h",
      "Acceso a todas las clases",
      "10% descuento en tienda",
      "Invita a un amigo gratis/mes",
      "Válido 30 días",
    ],
    popular: false,
    cta: "Comprar Plan",
  },
  {
    name: "Siete Sesiones",
    description: "28 sesiones al mes",
    price: 1750,
    period: "mensual",
    pricePerClass: 63,
    features: [
      "28 clases al mes",
      "Reserva prioritaria 48h",
      "Acceso ilimitado a clases",
      "10% descuento en tienda",
      "Invita a un amigo gratis/mes",
      "Clase especial mensual",
      "Válido 30 días",
    ],
    popular: false,
    cta: "Comprar Plan",
  },
];

const Pricing = () => {
  const pricingLink = "/pricing";

  return (
    <section id="precios" className="py-24 lg:py-32 bg-muted/30">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm font-body text-essenza-olive tracking-widest uppercase mb-4 block">
            Membresías
          </span>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-light text-foreground mb-6">
            Invierte en ti
          </h2>
          <p className="font-body text-lg text-muted-foreground">
            Elige el plan que mejor se adapte a tu estilo de vida. Todos incluyen
            acceso completo a nuestras instalaciones premium.
          </p>
        </div>

        {/* First Time Banner */}
        <div className="bg-essenza-gold text-white rounded-xl sm:rounded-sm p-6 lg:p-8 mb-12 flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Star className="w-10 h-10 sm:w-12 sm:h-12 shrink-0" />
            <div>
              <h3 className="font-heading text-2xl font-semibold">
                ¿Primera vez en Essenza?
              </h3>
              <p className="font-body text-white/80">
                Sesión muestra por $150 · Inscripción anual $500
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="font-heading text-3xl font-bold">$150</span>
            <Button
              size="lg"
              className="bg-white text-essenza-gold hover:bg-white/90 font-semibold"
              asChild
            >
              <Link to="/register?returnUrl=/app/book">Reservar clase de prueba</Link>
            </Button>
          </div>
        </div>

        {/* Pricing Cards — horizontal scroll on mobile, grid on desktop */}
        {/* Mobile: snap-scroll carousel */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-none">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-background rounded-xl border flex-shrink-0 w-[280px] snap-center ${
                  plan.popular
                    ? "border-essenza-olive shadow-lg ring-2 ring-essenza-olive/20"
                    : "border-border"
                } p-6 flex flex-col`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-essenza-olive text-white px-4 py-1 rounded-full text-xs font-body tracking-wide whitespace-nowrap">
                    Más Popular
                  </div>
                )}

                <div className="mb-4">
                  <span className="text-[10px] font-body text-muted-foreground uppercase tracking-wider">
                    {plan.description}
                  </span>
                  <h3 className="font-heading text-xl font-semibold text-foreground mt-1">
                    {plan.name}
                  </h3>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-heading text-3xl font-bold text-foreground">
                      ${plan.price.toLocaleString()}
                    </span>
                    <span className="text-xs font-body text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                  {plan.pricePerClass && (
                    <span className="text-xs font-body text-essenza-olive font-medium">
                      ${plan.pricePerClass}/clase
                    </span>
                  )}
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm font-body text-foreground/80"
                    >
                      <Check className="w-4 h-4 text-essenza-olive flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "hero" : "outline"}
                  className="w-full"
                  size="sm"
                  asChild
                >
                  <Link to={pricingLink}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          {/* Scroll hint */}
          <div className="flex justify-center gap-1 mt-2">
            {plans.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-essenza-sand/40" />
            ))}
          </div>
        </div>

        {/* Desktop: grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-background rounded-sm border ${
                plan.popular
                  ? "border-essenza-olive shadow-lg scale-105"
                  : "border-border"
              } p-8 flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-essenza-olive text-white px-4 py-1 rounded-full text-xs font-body tracking-wide">
                  Más Popular
                </div>
              )}

              <div className="mb-6">
                <span className="text-xs font-body text-muted-foreground uppercase tracking-wider">
                  {plan.description}
                </span>
                <h3 className="font-heading text-2xl font-semibold text-foreground mt-1">
                  {plan.name}
                </h3>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-bold text-foreground">
                    ${plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm font-body text-muted-foreground">
                    /{plan.period}
                  </span>
                </div>
                {plan.pricePerClass && (
                  <span className="text-sm font-body text-essenza-olive font-medium">
                    ${plan.pricePerClass}/clase
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm font-body text-foreground/80"
                  >
                    <Check className="w-5 h-5 text-essenza-olive flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? "hero" : "outline"}
                className="w-full"
                asChild
              >
                <Link to={pricingLink}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Payment Note */}
        <p className="text-center font-body text-sm text-muted-foreground mt-8">
          Todos los precios en MXN. Pago seguro con tarjeta de crédito, débito o
          transferencia. Facturación disponible.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
