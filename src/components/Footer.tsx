import { MapPin, Phone, Mail, Instagram } from "lucide-react";
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <img 
                src="/essenza.jpg" 
                alt="Essenza del Flusso" 
                className="h-12 w-12 rounded-full object-cover"
              />
              <div className="flex flex-col">
                <span className="font-heading text-xl font-semibold text-primary-foreground leading-none">
                  Essenza
                </span>
                <span className="text-[10px] font-body text-primary-foreground/60 tracking-[0.2em] uppercase">
                  Studio
                </span>
              </div>
            </div>
            <p className="font-body text-sm text-primary-foreground/70 mb-6">
              Barré, Pilates Mat, Yoga Sculpt y Sculpt en un espacio pensado para el
              movimiento consciente.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/essenza.barre?igsh=MXRyb240Ym9lcGJiNg=="
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading text-lg font-semibold text-primary-foreground mb-6">
              Enlaces Rápidos
            </h4>
            <ul className="space-y-3">
              {[
                "Mi Cuenta",
                "Comprar Gift Card",
                "Trabaja con nosotros",
                "Blog",
              ].map((link) => (
                <li key={link}>
                  <a
                    href="#"
                    className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-lg font-semibold text-primary-foreground mb-6">
              Contacto
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary-foreground/50 flex-shrink-0 mt-0.5" />
                <a
                  href="https://maps.google.com/?q=Hermenegildo+Galeana+Int+Local+4+Centro+76803+San+Juan+del+Rio+Qro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  Hermenegildo Galeana Int. Local 4
                  <br />
                  Centro, 76803 San Juan del Río, Qro.
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary-foreground/50" />
                <a
                  href="tel:+524271007347"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  +52 427 100 7347
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary-foreground/50" />
                <a
                  href="mailto:hola@essenza-studio.com.mx"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  hola@essenza-studio.com.mx
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading text-lg font-semibold text-primary-foreground mb-6">
              Legal
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/privacy"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  Términos y Condiciones
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  Política de Cancelación
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-sm text-primary-foreground/50">
            © 2026 Essenza del Flusso. Todos los derechos reservados.
          </p>
          <p className="font-body text-sm text-primary-foreground/50">
            Powered by{" "}
            <span className="text-essenza-olive font-semibold">WalletClub</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
