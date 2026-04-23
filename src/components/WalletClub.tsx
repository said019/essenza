import { Button } from "@/components/ui/button";
import { Smartphone, Gift, CalendarCheck } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Smartphone,
    title: "Pase digital",
    description: "Tu membresía en Apple Wallet o Google Pay.",
  },
  {
    icon: Gift,
    title: "Puntos por clase",
    description: "Acumula puntos y canjéalos por recompensas.",
  },
  {
    icon: CalendarCheck,
    title: "Reserva al instante",
    description: "Agenda y gestiona tus clases desde tu teléfono.",
  },
];

const WalletClub = () => {
  return (
    <section id="wallet" className="py-16 lg:py-20 bg-essenza-blue text-on-surface">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-10 items-center">
          {/* Content - takes 2 cols */}
          <div className="lg:col-span-2 text-center lg:text-left">
            <h2 className="font-heading text-3xl md:text-4xl font-light mb-4">
              Tu membresía,
              <br />
              <span className="font-semibold italic">en el bolsillo</span>
            </h2>
            <p className="font-body text-sm text-on-surface/70 mb-6 max-w-md mx-auto lg:mx-0">
              Pase digital, puntos y reservas desde tu teléfono. Sin plásticos ni filas.
            </p>
            <div className="flex gap-3 justify-center lg:justify-start">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white text-on-surface hover:bg-white/90 font-semibold"
                asChild
              >
                <Link to="/app/wallet">Descargar pase</Link>
              </Button>
              <Button
                variant="heroOutline"
                size="sm"
                className="border-on-surface/30 text-on-surface hover:bg-white/20"
                asChild
              >
                <Link to="/app/wallet/rewards">Ver recompensas</Link>
              </Button>
            </div>
          </div>

          {/* Features - takes 3 cols */}
          <div className="lg:col-span-3 grid sm:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white/20 border border-white/35 rounded-sm p-5 hover:bg-white/30 transition-colors"
              >
                <feature.icon className="w-7 h-7 text-on-surface/75 mb-3" />
                <h3 className="font-heading text-base font-semibold text-on-surface mb-1">
                  {feature.title}
                </h3>
                <p className="font-body text-xs text-on-surface/65 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default WalletClub;
