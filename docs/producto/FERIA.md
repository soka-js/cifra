# Lista de revisión de la feria (Semana de la Innovación, jueves 19 de noviembre)

Parte de la Etapa 7a: lo que no depende de negocios reales. Cada punto se marca cuando alguien lo comprobó, con fecha y quién.

## Antes del miércoles 18 en la noche

- [ ] Producción tiene `producto-v1` (etapas 1 a 4) desplegada y revisada con `DESPLIEGUE.md`.
- [ ] Variables en Vercel, proyecto `cifra`: `RESEND_API_KEY` y `EMAIL_FROM` (Production y Preview), `CRON_SECRET` (Production).
- [ ] El QR del afiche y de la diapositiva de cierre abre `micifra.vercel.app`. Con la rama desplegada, esa dirección cae en la prueba sin cuenta. Escanearlo con dos celulares distintos (uno Android, uno iPhone) sin sesión: debe aparecer "¿Cuánto puedes gastar hasta tu próximo pago?".
- [ ] Hacer la prueba completa desde el QR en un celular: cuatro respuestas, la cifra, "¿Puedo gastar?" y "Guardar mi cifra". Anotar cuánto tardó una persona que no es del equipo (el guion de prueba no mide personas).
- [ ] En `/admin`, la sección "Feria: del QR a la cifra guardada" muestra esa visita en la fila de hoy (abrieron, empezaron, vieron su cifra, tocaron Guardar, crearon cuenta).
- [ ] Las ofertas no tienen grupo de control (migración `0009`): una persona de la zona ve todas las ofertas activas.
- [ ] Si se muestra alguna oferta de ejemplo en el stand, dice que es de ejemplo. Hoy no hay negocios reales confirmados (Etapa 7b).
- [ ] La demo de `/admin` abre como persona y como tendero, y "Salir" vuelve a la cuenta del admin. La franja de demo no tapa la barra de arriba al desplazar.
- [ ] `/admin/presentacion` se revisó en el computador que se va a usar en el stand.

## En el stand

- Un celular del equipo con `/admin` abierto en la sección de la feria, para ver en vivo cuántos calcularon su cifra.
- Nadie del equipo abre `/admin` en una pantalla que vea el público.
- Para mostrar la demo con datos, se abre desde `/admin` ("Ver como persona"); para que alguien pruebe con sus propios números, el QR.
- Si alguien pregunta por sus datos: la prueba se calcula en su celular y ningún monto sale de ahí hasta que decide guardar su cifra. Para guardarla crea una cuenta; desde la app puede descargar o borrar sus datos.
- Si alguien olvida su clave en la feria: con el remitente de prueba de Resend (`onboarding@resend.dev`) el correo solo llega a la cuenta de Resend de SOKA. La app le dice a la persona que no se pudo enviar. Para que funcione con cualquiera hace falta un dominio verificado (ver `DESPLIEGUE.md`).

## Después del stand, el mismo día

- [ ] Copiar los números de la fila de hoy del embudo (captura de pantalla de `/admin`) para el pitch del 26.
- [ ] Anotar cuántos de los que llenaron "¿cuánto crees que puedes gastar?" creían poder gastar más. Es el mismo hallazgo de las 21 sesiones (19 de 20), ahora medido en el stand.
