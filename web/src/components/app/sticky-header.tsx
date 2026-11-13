/**
 * Lo que queda pegado arriba al desplazar: la franja de demo (si la hay) y la barra superior,
 * una debajo de la otra. Antes cada una era `sticky top-0` por su cuenta y, en el celular,
 * la franja tapaba la barra.
 */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  return <div className="no-print sticky top-0 z-30">{children}</div>;
}
