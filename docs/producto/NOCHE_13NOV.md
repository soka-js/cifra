# Turno de noche, 12 y 13 de noviembre de 2026

Trabajo hecho por Claude (sesión en la nube de SOKA) mientras SOKA dormía, con su autorización del 12 nov a las 22:45. Rama `noche-13nov`, creada desde `producto-v1` en `7d240f9`. Solicitud de cambio en borrador hacia `producto-v1`, no hacia `main`.

No toqué `producto-v1`, `main`, producción, ni la vista previa que se usa en las demos del 13 nov. No borré ramas ni despliegues. No cambié claves ni variables.

Para Claude Code: revisa esto como revisarías un cambio de otra persona. Si lo apruebas, pasa el resumen a `BITACORA.md` (no la edité para no pisarte) y haz el merge de esta rama a `producto-v1`.

## Qué cambió

### 1. La franja de demo ya no tapa la barra superior (pendiente de la Etapa 5)

- Antes, `DemoBar` y `AppTopBar` eran cada una `sticky top-0`; al desplazar en el celular la franja quedaba encima de la barra.
- Ahora las dos van dentro de `StickyHeader` (`web/src/components/app/sticky-header.tsx`, nuevo), que es el único elemento pegado arriba. Quedan una debajo de la otra.
- Cambios: `web/src/app/app/layout.tsx`, `web/src/app/negocio/(portal)/layout.tsx`, `web/src/components/demo/demo-bar.tsx` (sin `sticky`), `web/src/components/app/app-top-bar.tsx` (sin `sticky`, con `data-testid="app-top-bar"`).
- En el portal del negocio, la franja ahora va dentro de la columna de contenido (a la derecha de la barra lateral en escritorio), igual que en la app de la persona.
- Paso nuevo **D3b** en `web/e2e/seguridad.e2e.mjs`: con la demo abierta, desplaza 900 px y comprueba que la franja queda en y = 0 y la barra empieza donde termina la franja.

### 2. Embudo de la feria en `/admin` (Etapa 7a)

- `web/src/lib/analytics/fair-funnel.ts` (nuevo): `loadFairFunnel(días)` cuenta visitantes distintos por día de Bogotá, de hoy hacia atrás, con ceros en los días sin visitas. Pasos: abrieron `/`, empezaron la prueba (`try_cifra_start`), vieron su cifra (`try_cifra_done`), tocaron "Guardar mi cifra" (`try_cifra_save`) y crearon su cuenta después de guardar (`sign_up` del mismo visitante).
- También cuenta, de quienes llenaron el campo opcional "¿cuánto crees que puedes gastar?", cuántos creían poder gastar más (la dirección `mas` que ya manda la prueba; nunca el monto). Si alguien calculó varias veces ese día, cuenta la última. Y la mediana de segundos de la primera prueba del día.
- `web/src/app/admin/fair-funnel-section.tsx` (nuevo): la sección "Feria: del QR a la cifra guardada", arriba de la pestaña de datos de `/admin`: cuatro cifras de hoy y una tabla de 7 días, con cada porcentaje sobre el paso anterior.
- `web/src/app/admin/page.tsx`: carga el embudo y muestra la sección. No toqué el embudo viejo de la landing ni el resto del tablero (eso sigue en la Etapa 5).
- Prueba nueva de integración `web/test/integration/feria.itest.ts` (4 casos): sin eventos; cinco visitantes con recorridos distintos (incluye uno que calcula dos veces y otro que crea cuenta sin pasar por "Guardar"); separación por día y periodo; límites de 1 a 31 días.
- Paso nuevo **D2b** en el e2e: `/admin` muestra la sección, la primera fila es "Hoy" y hay 7 filas.

### 3. `/admin/presentacion`, rehecha y honesta (Etapa 5)

- Lo que había: una landing de ventas con **testimonios inventados presentados como reales** ("Mariana V. · Chapinero", "Sebastián M.", "Andrés R. · Asociado Cooperativa Aliada"), métricas de las 21 sesiones descritas como "usuarios activos durante su primer ciclo", funciones que ya no existen (metas, misiones, "Mejor Siguiente Acción", contador de ahorro, "cobros vampiro"), el grupo de control que se quitó, una lista de bancos compatibles sin comprobar, "B2B2C" y un formulario de contacto comercial. SOKA la abre frente a profesores o inversores.
- Lo que hay ahora (`web/src/app/admin/presentacion/page.tsx`): botones para abrir la demo como persona o tendero; el problema (94 % y 23 %, 41 de 48) con su fuente; lo probado con gente (16 de 21, 14 de 21, 19 de 20) con su fuente; la cita de Karol Benavides y los tres cambios que salieron de esa conversación; lo que hace hoy el producto para la persona y para el negocio; el modelo (persona gratis, negocio 5 % de la venta, aliado 30 % de la comisión); un ejemplo de caja rotulado como ejemplo y calculado con `computeRedemptionSplit` del motor; y "lo que todavía no sabemos".
- Borré los componentes que solo usaba esa página: `web/src/components/landing/` completo (`testimonios`, `receipt`, `merchant-calculator`, `lead-form`, `faq`, `tracked-link`), siguiendo la decisión 4 de SOKA (borrar lo que se corta).
- `web/src/lib/__tests__/recibos.test.ts`: la entrada de `receipt.tsx` (3 montos) se reemplaza por una de `presentacion/page.tsx` (1 monto: la compra del ejemplo, rotulada en pantalla).
- Queda sin usar la acción `submitLead` de `web/src/app/actions/leads.ts` (sigue registrada en la matriz de permisos). Decide tú si se borra.

### 4. `docs/producto/FERIA.md` (nuevo)

Lista de revisión de la feria sin negocios reales: antes del 18, en el stand y después del stand.

## Verificación (en la nube, Linux, Node 22, Postgres 16 local en 127.0.0.1:54329)

Todo sobre el mismo árbol, después de los cambios:

- `npm run typecheck`: 0 errores.
- `npm test`: 16 archivos, **171 de 171**.
- `npm run test:int`: 5 archivos, **263 de 263** (259 de antes más los 4 de `feria.itest.ts`).
- `npm run build`: compilado sin errores.
- `npm run e2e`: 4 archivos, todo en verde: guardar cifra 6 de 6, Hoy 10 de 10, prueba sin cuenta 11 de 11, seguridad **30 de 30** (28 de antes más D2b y D3b).
- Línea base antes de tocar nada: typecheck sin errores, 171 de 171 unitarias y 259 de 259 de integración.
- Revisión visual en local (`next start` en el puerto 3200 contra `cifra_dev`, Chrome a 390x844 y a 1280 de ancho):
  - la captura `n1-demo-franja-y-barra` del e2e muestra la franja y la barra una debajo de la otra después de desplazar;
  - con eventos de ejemplo insertados solo en la base local (y borrados después), la sección de la feria mostró hoy 4 abrieron, 3 empezaron (75 %), 3 vieron su cifra, 1 tocó Guardar (33 %), 1 creó cuenta, "2 de 2" creían poder gastar más y 48 s de mediana. Coincide con los eventos insertados;
  - `/admin/presentacion` se ve completa en celular y escritorio, y su texto no contiene "Mariana V.", "B2B2C", "Next Best", "vampiro", "grupo de control" ni "Testimonio".

## Qué revisar en la vista previa de esta rama

1. Entra a `/admin` con tu cuenta de admin: arriba de la pestaña de datos debe estar "Feria: del QR a la cifra guardada", con la fila de hoy.
2. Abre la demo como persona y desplaza el Hoy hacia abajo en el celular: la franja negra queda arriba y la barra "Hoy > Tu cifra" debajo, sin taparse.
3. Abre `/admin/presentacion` y léela de punta a punta como si fueras el profesor.

## Pendientes que vi y no toqué

- El resto del tablero de `/admin` sigue con textos de la versión anterior: "Aliados B2B2C", "techo sostenible documentado: 41,1 %", "Hipótesis K", el embudo de la landing vieja con prueba A/B (la página pública ya no es esa landing). Es la Etapa 5.
- `NEXT_PUBLIC_SITE_URL` se fija al compilar: la dirección pública que muestra la presentación sale de la variable del entorno donde se construyó (en la vista previa, la de su rama).
