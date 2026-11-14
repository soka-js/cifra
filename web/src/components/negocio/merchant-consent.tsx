/**
 * Autorización de datos del tendero (Ley 1581 de 2012). La piden el registro del negocio y la
 * activación por enlace cuando crean una cuenta nueva; el servidor no crea la cuenta sin ella.
 */
export function MerchantConsent() {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3.5 text-[14px] leading-snug text-ink-muted">
      <input id="consent" type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#0B6B58]" />
      <span>
        Soy mayor de edad y autorizo a CIFRA a tratar mis datos y los de mi negocio para operar mi cuenta, mis ofertas y el
        cobro de la comisión, según la{' '}
        <a href="/privacidad" target="_blank" className="font-semibold text-ink underline">
          política de tratamiento de datos
        </a>{' '}
        (Ley 1581 de 2012), y acepto los{' '}
        <a href="/terminos" target="_blank" className="font-semibold text-ink underline">
          términos de uso
        </a>
        .
      </span>
    </label>
  );
}
