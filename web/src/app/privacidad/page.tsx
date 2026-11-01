import { LegalPage } from '@/components/legal/page';

export const metadata = { title: 'Política de tratamiento de datos' };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function PrivacyPage() {
  const mail = contact ? <a href={`mailto:${contact}`} className="font-semibold text-ink underline">{contact}</a> : 'el correo de contacto publicado en este sitio';
  return (
    <LegalPage title="Política de tratamiento de datos personales" updated="1 de noviembre de 2026">
      <p>
        Esta política explica qué datos trata CIFRA, para qué y cómo puedes ejercer tus derechos, en cumplimiento de la Ley 1581 de
        2012 y el Decreto 1074 de 2015 (que compila el Decreto 1377 de 2013).
      </p>

      <h2>Responsable</h2>
      <p>
        CIFRA es un proyecto académico desarrollado en el curso Diseño de Productos e Innovación en TI de la Universidad de los Andes,
        Bogotá, por Samuel Rozen, Camilo Molina, Jose Miguel Angel y Sebastián Socarrás. Contacto para cualquier asunto de datos
        personales: {mail}.
      </p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li><strong>Cuenta:</strong> nombre, correo y contraseña (guardada como un resumen criptográfico argon2id; nadie puede leerla).</li>
        <li>
          <strong>Movimientos:</strong> fecha, descripción y valor de los movimientos que tú subes en un extracto o que comparte la
          entidad donde tienes tu cuenta, si activaste CIFRA allí. También el saldo que escribes o que comparte esa entidad.
        </li>
        <li><strong>Ajustes:</strong> frecuencia y días de tu ingreso, colchón, compromisos que escribas y tus marcas sobre cobros que se repiten.</li>
        <li>
          <strong>Uso de la página:</strong> un identificador anónimo por navegador, las páginas vistas y acciones como clics en botones,
          para medir qué partes del sitio sirven. Si aceptas cookies de medición, también Google Analytics.
        </li>
      </ul>
      <p>
        No pedimos ni guardamos claves de bancos, números de tarjeta ni datos sensibles en los términos del artículo 5 de la Ley 1581.
        El archivo del extracto se lee en tu dispositivo y no se envía: solo se envían los movimientos ya leídos.
      </p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Calcular tu cifra, responder si un gasto te alcanza y encontrar cobros que se repiten.</li>
        <li>Mostrarte de dónde vienen tus datos y quién los ha tocado.</li>
        <li>Responder las solicitudes de demo de entidades (solo con los datos que esas personas dejan en el formulario).</li>
        <li>Medir el uso del sitio de forma agregada para mejorarlo.</li>
      </ul>
      <p>No vendemos tus datos, no los usamos para publicidad y no los compartimos con terceros distintos a los encargados de abajo.</p>

      <h2>Encargados y ubicación</h2>
      <p>
        Los datos se alojan en proveedores de infraestructura en la nube (Vercel para la aplicación y Neon para la base de datos) que
        pueden tener servidores fuera de Colombia. Actúan como encargados del tratamiento y solo procesan los datos para prestar ese
        servicio. Al aceptar esta política autorizas esa transmisión.
      </p>

      <h2>Datos que comparte tu entidad</h2>
      <p>
        Si usas CIFRA dentro de la app de tu cooperativa o banco, esa entidad nos envía tus cuentas y movimientos porque tú lo
        autorizaste en su app. Puedes ver esa fuente en Tus datos y revocar la autorización en la app de tu entidad; cuando lo haces,
        la entidad nos pide borrar tus datos y los borramos.
      </p>

      <h2>Tus derechos</h2>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que nos diste.</li>
        <li>Saber qué uso les hemos dado.</li>
        <li>Revocar la autorización y pedir que se borren. Lo puedes hacer tú mismo en Ajustes, con efecto inmediato.</li>
        <li>Acceder gratis a tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio después de haber hecho tu solicitud ante nosotros.</li>
      </ul>

      <h2>Cómo hacer consultas y reclamos</h2>
      <p>
        Escribe a {mail} desde el correo de tu cuenta. Respondemos las consultas en máximo diez (10) días hábiles y los reclamos en
        máximo quince (15) días hábiles, como lo establece la ley. Si necesitamos más tiempo, te avisamos el motivo y la nueva fecha.
      </p>

      <h2 id="cookies">Cookies</h2>
      <ul>
        <li><strong>cf_session:</strong> mantiene tu sesión abierta. Necesaria.</li>
        <li><strong>cf_vid y cf_ab:</strong> identificador anónimo y versión de la página que te mostramos, para medir. No contienen datos personales.</li>
        <li><strong>cf_utm:</strong> de qué campaña llegaste, si viniste por un enlace con parámetros UTM.</li>
        <li><strong>Google Analytics:</strong> solo si aceptas en el aviso de cookies.</li>
      </ul>

      <h2>Conservación</h2>
      <p>
        Guardamos tus datos mientras tengas cuenta. Si la borras, se eliminan de inmediato de la base de datos. Las copias de
        seguridad del proveedor se sobrescriben en sus ciclos normales.
      </p>

      <h2>Cambios</h2>
      <p>Si cambiamos esta política, lo publicamos aquí con la nueva fecha y te lo avisamos dentro de la app antes de que aplique.</p>
    </LegalPage>
  );
}
