export interface StudioClassType {
  name: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  durationMinutes: number;
  maxCapacity: number;
  icon?: string;
}

export interface StudioPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  heroGradient: string;
  cardGradient: string;
  overlayDark: string;
  glowSage: string;
  glowWarm: string;
}

export interface StudioInfo {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  mapUrl: string;
  classTypes: StudioClassType[];
  bank: {
    name: string;
    account: string;
    clabe: string;
    beneficiary: string;
  };
  businessHours: Array<{ label: string; hours: string }>;
  palette: StudioPalette;
}

const studioDirectory: Record<string, StudioInfo> = {
  balance: {
    slug: 'balance',
    name: 'Balance Studio',
    tagline: 'Essenza, Pilates Mat y Yoga Sculpt en un espacio sereno.',
    description:
      'Sesiones íntimas, ritmo consciente y membresías digitales con nuestra Membresía.',
    addressLine: 'Av. Presidente Masaryk 123',
    city: 'Polanco',
    state: 'CDMX',
    postalCode: '11560',
    phone: '+52 55 5555 1234',
    whatsapp: '+52 55 8000 1122',
    email: 'hola@balancestudio.com',
    instagram: '@balancestudio',
    mapUrl: 'https://maps.google.com/?q=Balance+Studio+Polanco',
    classTypes: [
      {
        name: 'Essenza',
        description:
          'Combina lo mejor del ballet, pilates y ejercicios funcionales. Se realizan ejercicios isométricos y pulsos, cuidando siempre el equilibrio y la carga. El objetivo principal es aislar grupos de músculos para llegar al punto de máxima tensión permitiendo tonificar, alargar y compactar todo el cuerpo. Es una práctica efectiva que se siente como un entrenamiento y una danza a la vez.',
        level: 'all',
        durationMinutes: 50,
        maxCapacity: 12,
        icon: '🩰',
      },
      {
        name: 'Pilates Mat',
        description:
          'A diferencia del pilates reformer, la resistencia proviene principalmente del peso corporal, la gravedad y la contracción muscular. Es una práctica en el piso diseñada para fortalecer y tonificar tu cuerpo, especialmente los músculos más profundos del core (abdomen, espalda baja y pelvis). Combina elongación y contracción, buscando siempre la conexión mente-cuerpo.',
        level: 'all',
        durationMinutes: 50,
        maxCapacity: 12,
        icon: '🧘',
      },
      {
        name: 'Yoga Sculpt',
        description:
          'Es una versión más dinámica y energizante del yoga tradicional. Con secuencias rápidas y posturas retadoras, yoga sculpt te hará sudar mientras te diviertes. Es ideal para aumentar tu fuerza, flexibilidad y concentración, además de brindarte un desafío emocionante que te hará sentirte lleno de energía.',
        level: 'all',
        durationMinutes: 50,
        maxCapacity: 12,
        icon: '🌿',
      },
      {
        name: 'Sculpt',
        description:
          'Entrenamiento de cuerpo completo (full body) o enfocado en grupos musculares específicos con movimientos controlados, sentadillas, planchas y ejercicios con resistencia para tonificar. Fusiona elementos de fuerza, entrenamiento funcional, pilates y a veces yoga o HIIT. Mejora la fuerza, potencia, resistencia, flexibilidad y quema calorías.',
        level: 'all',
        durationMinutes: 50,
        maxCapacity: 12,
        icon: '🔥',
      },
    ],
    bank: {
      name: 'BBVA',
      account: '0123456789',
      clabe: '012345678901234567',
      beneficiary: 'Balance Studio MX',
    },
    businessHours: [
      { label: 'Lunes, Miércoles y Viernes', hours: 'Barré' },
      { label: 'Martes y Jueves', hours: 'Pilates Mat' },
      { label: 'Sábado', hours: 'Yoga Sculpt' },
      { label: 'Domingo', hours: 'Sculpt' },
    ],
    palette: {
      background: '60 11% 96%',
      foreground: '204 20% 19%',
      card: '0 0% 100%',
      cardForeground: '204 20% 19%',
      popover: '0 0% 100%',
      popoverForeground: '204 20% 19%',
      primary: '202 32% 76%',
      primaryForeground: '204 20% 19%',
      secondary: '39 46% 61%',
      secondaryForeground: '204 20% 19%',
      muted: '198 37% 84%',
      mutedForeground: '201 14% 40%',
      accent: '101 16% 70%',
      accentForeground: '204 20% 19%',
      border: '98 12% 84%',
      input: '98 12% 84%',
      ring: '39 46% 61%',
      heroGradient:
        'linear-gradient(135deg, hsl(60 11% 96%) 0%, hsl(198 37% 84%) 54%, hsl(42 50% 86%) 100%)',
      cardGradient:
        'linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(60 11% 96%) 100%)',
      overlayDark:
        'linear-gradient(180deg, hsla(204, 20%, 19%, 0.14) 0%, hsla(204, 20%, 19%, 0.6) 100%)',
      glowSage: '0 12px 32px hsla(101, 16%, 70%, 0.18)',
      glowWarm: '0 12px 32px hsla(39, 46%, 61%, 0.2)',
    },
  },
};

const formatSlugName = (slug: string) =>
  slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getStudioBySlug = (slug?: string): StudioInfo => {
  if (!slug) {
    return studioDirectory.balance;
  }

  const normalized = slug.toLowerCase();
  if (studioDirectory[normalized]) {
    return studioDirectory[normalized];
  }

  return {
    ...studioDirectory.balance,
    slug: normalized,
    name: formatSlugName(normalized),
  };
};
