import { LegalPage } from '@/components/legal/page';

export const metadata = { title: 'Términos de uso' };

export default function TermsPage() {
  return (
    <LegalPage title="Términos de uso" updated="1 de noviembre de 2026">
      <h2>Qué es CIFRA</h2>
      <p>
        CIFRA es una herramienta que hace cuentas con tus movimientos para estimar cuánto puedes gastar hasta tu próximo ingreso. No
        es un banco ni una entidad vigilada por la Superintendencia Financiera, no guarda ni mueve dinero y no da asesoría financiera,
        de inversión ni de crédito.
      </p>
      <h2>La cifra es un estimado</h2>
      <p>
        La cifra depende de los datos que tú o tu entidad comparten: saldo, movimientos y fecha de ingreso. Usa promedios de tu gasto
        reciente y cobros que se repiten detectados automáticamente, que pueden no coincidir con lo que pase en el futuro. Tú decides
        en qué gastas. CIFRA te muestra cada parte del cálculo para que puedas revisarlo.
      </p>
      <h2>Tu cuenta</h2>
      <ul>
        <li>Debes ser mayor de edad para crear una cuenta.</li>
        <li>Eres responsable de mantener tu contraseña en secreto.</li>
        <li>Solo subas extractos de cuentas tuyas o que tengas permiso de usar.</li>
        <li>Puedes borrar tu cuenta y todos tus datos en cualquier momento desde Ajustes.</li>
      </ul>
      <h2>Uso permitido</h2>
      <p>No intentes acceder a datos de otras personas, saturar el servicio ni usarlo para fines ilegales. Podemos suspender cuentas que lo hagan.</p>
      <h2>Disponibilidad y continuidad del servicio</h2>
      <p>
        CIFRA opera con alta disponibilidad sobre infraestructura en la nube con respaldos cifrados y monitoreo continuo. En caso de
        ventanas programadas de mantenimiento o actualizaciones de seguridad, tus datos permanecen íntegros y disponibles para
        exportación en cualquier momento desde la sección «Tus datos».
      </p>
      <h2>Ley aplicable</h2>
      <p>Estos términos se rigen por las leyes de la República de Colombia.</p>
    </LegalPage>
  );
}
