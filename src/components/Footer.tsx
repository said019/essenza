import { MapPin, Phone, Mail, Instagram } from "lucide-react";
import { Link } from 'react-router-dom';
import { Brand } from "@/components/Brand";

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div>
            <div className="mb-6">
              <Brand
                variant="logo"
                className="h-20 w-auto brightness-0 invert opacity-90"
              />
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
                  href="tel:+525574034316"
                  className="font-body text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  +52 55 7403 4316
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
            © 2026 Essenza del Flusso Studio. Todos los derechos reservados.
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
