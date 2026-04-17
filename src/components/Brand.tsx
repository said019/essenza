import { cn } from '@/lib/utils';

interface BrandProps {
  className?: string;
  /** Usa 'signature' para hero/títulos grandes (BrittanySignature).
   *  Usa 'cinzel' para UI compacta (Cinzel uppercase con "del" lowercase italic). */
  variant?: 'signature' | 'cinzel';
  /** Solo "ESSENZA del FLUSSO" (sin "STUDIO") */
  compact?: boolean;
}

/**
 * Nombre de marca oficial: ESSENZA del FLUSSO STUDIO
 * "ESSENZA" y "FLUSSO STUDIO" en mayúsculas; "del" en minúsculas, italic, más chico.
 */
export function Brand({ className, variant = 'cinzel', compact = false }: BrandProps) {
  if (variant === 'signature') {
    return (
      <span
        className={cn(
          'font-signature text-primary inline-flex items-baseline gap-[0.15em] leading-[1.2]',
          className
        )}
      >
        <span>Essenza</span>
        <span className="italic text-[0.72em] opacity-90">del</span>
        <span>Flusso</span>
        {!compact && <span className="text-[0.65em] opacity-85 ml-[0.1em]">Studio</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'font-headline inline-flex items-baseline gap-[0.25em] tracking-[0.12em] uppercase leading-tight',
        className
      )}
    >
      <span>Essenza</span>
      <span className="font-body italic text-[0.72em] lowercase tracking-normal opacity-80">del</span>
      <span>Flusso</span>
      {!compact && <span className="text-[0.82em]">Studio</span>}
    </span>
  );
}
