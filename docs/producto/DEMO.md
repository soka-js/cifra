# Demo de CIFRA en 5 minutos

Guion para mostrar CIFRA compartiendo pantalla. Dos partes: la persona (de `/` a su cifra, sin cuenta) y el tendero (registro, oferta y código en caja). No usa `/admin` ni la demo de ejemplo: todo se crea en vivo, con números que escribes tú.

Los montos de este guion son **de ejemplo**: los escribes tú en pantalla, y CIFRA hace las cuentas con ellos.

## Dónde

| | Dirección | Notas |
| --- | --- | --- |
| Plan A: vista previa | `https://cifra-git-producto-v1-proyects-soka.vercel.app` | Solo sirve cuando su base ya tenga las migraciones (ver la bitácora del 12 nov, noche). Vercel pide iniciar sesión con tu cuenta (la vista previa está protegida). Su base es una rama de Neon copiada de producción: lo que crees ahí no toca producción y se conserva entre subidas, pero en Ofertas pueden aparecer negocios que existen en producción. |
| Plan B: tu computador | `http://localhost:3000` | `cd web && npm run demo`. Pasos al final. |

## Antes de la llamada (15 minutos antes)

1. Abre dos ventanas de Chrome, angostas, lado a lado:
   - **Izquierda, ventana normal: la persona.** Abre la dirección.
   - **Derecha, ventana de incógnito: el tendero.** Abre la misma dirección y, si es la vista previa, inicia sesión en Vercel ahí mismo. Así las dos cuentas no se pisan.
2. En la ventana de la persona, si ya habías entrado antes, sal de la cuenta: `/` debe mostrar "¿Cada cuánto te pagan?". Si muestra el Hoy de otra cuenta, ve a `/app/ajustes` y toca "Cerrar sesión". Haz lo mismo en la ventana del tendero si ya tiene una sesión abierta.
3. Ten a mano dos correos que no hayas usado. Cada demo crea cuentas nuevas, así que para la segunda llamada usa otros (por ejemplo `persona.demo2@…` y `tendero.demo2@…`).
4. En Meet, comparte la pantalla completa, no una pestaña: vas a pasar de una ventana a la otra.
5. No abras `/admin` mientras compartes pantalla.
6. Si haces un ensayo completo antes, crea el negocio del ensayo con otro nombre y, al terminar, en la ventana del tendero ve a Ofertas y toca "Pausar" en su oferta. Así no aparece en la lista de la persona durante la llamada.

## Guion

### Persona (3 minutos)

**0:00. La idea, en una frase.** "Tu banco te dice cuánto tienes. CIFRA te dice cuánto puedes gastar hoy sin quedarte corto antes del próximo pago."

**0:15. De `/` a la cifra, sin cuenta.** En la ventana de la persona:

| Pregunta en pantalla | Qué haces |
| --- | --- |
| ¿Cada cuánto te pagan? | Toca "Cada quincena" (ya trae los días 15 y 30) y "Seguir" |
| ¿Cuánto tienes hoy? | Escribe `1.200.000` y "Seguir" |
| ¿Qué pagas fijo cada mes? | Toca "Arriendo", escribe `450.000`, elige "Día 14" y "Seguir" |
| ¿Cuánto se te va en el día a día? | Escribe `25.000` (por día) y toca "Ver mi cifra" |

Qué decir mientras aparece el resultado: "No pedí cédula, ni banco, ni crear cuenta. Y nada de lo que escribí sale del celular hasta que la persona decide guardarlo."

Qué debe verse el **viernes 13**: "Puedes gastar hasta el 15 nov" con **$700.000**, y la resta debajo: $1.200.000 que tienes, menos $450.000 de arriendo, menos $50.000 de tu día a día (2 días a $25.000). Equivale a $350.000 por día. Si haces la demo otro día, el número cambia porque cambian los días que faltan.

**1:15. ¿Puedo gastar?** En la misma pantalla, escribe `120.000` y toca "Preguntar". Debe responder "Sí" y que te quedarían $580.000. Luego prueba con `750.000`: "No te alcanza", te faltan $50.000. Qué decir: "Antes de pagar, no después."

**1:45. Guardar.** Toca "Guardar mi cifra". La pantalla dice "Guarda tu cifra". Escribe el nombre, el correo de la persona y una clave de 10 o más caracteres, acepta la autorización y crea la cuenta. Qué decir: "Lo que escribió se guarda solo. No tiene que volver a contestar nada."

**2:15. El Hoy.** Cae en el Hoy con el mismo número: $700.000, la misma resta, "¿Puedo gastar?" a la mano y "Anotar un gasto" debajo. Si quieres mostrar que el número se mueve: "Anotar un gasto", escribe `almuerzo 18000` y guarda; la cifra baja exactamente $18.000.

### Tendero (2 minutos)

**3:00. Registro.** En la ventana del tendero, abre `/negocio`. Lleva solo al registro de negocio. Llena:

| Campo | Ejemplo |
| --- | --- |
| Nombre del negocio | `Café de ejemplo` (que se note que es de prueba) |
| Tipo de comercio | Cafetería / Onces |
| Tu nombre (dueño o encargado), WhatsApp de contacto | El tuyo, o `3105550000` |
| Zona en Bogotá | Las Aguas · Centro / Uniandes |
| Dirección del local | `Cra 3 # 18-45` |
| Compra promedio de un cliente | `20.000` |
| Horario, llave Bre-B o Nequi, mapa | Déjalos como están (la llave es opcional) |
| Correo y contraseña | El correo del tendero y una clave de 10 o más caracteres |

Toca "Registrar mi negocio y crear primera oferta". Qué decir: "El tendero se registra solo, desde el celular, en un minuto."

**3:40. La oferta.** Cae en Ofertas. Escribe el título `10 % en café y pan del día`, deja el 10 % que trae y toca "Publicar oferta ahora".

**4:00. El código.** Pasa a la ventana de la persona, ve a Ofertas (abajo), busca "Café de ejemplo" y toca "Generar código y QR para usar en caja". Aparece un código de 6 letras.

**4:20. La caja.** Pasa a la ventana del tendero, toca "Caja" (abajo), escribe el código, toca "Verificar código", escribe `20.000` como valor de la compra y toca "Confirmar venta y aplicar descuento". Debe verse "Venta registrada": la persona paga **$18.000**, la comisión de CIFRA es **$900** (el 5 % de lo que se cobró) y al negocio le quedan **$17.100**. Si vuelves a escribir el mismo código, dice que ya fue usado.

Qué decir: "El negocio paga el 5 % solo de la venta que CIFRA le trae. Si nadie llega, no paga nada."

**4:45. Cierre.** En la ventana de la persona, toca la campana de arriba (Avisos): "Ahorraste $2.000". "La persona sabe cuánto puede gastar, y gasta en el barrio."

## Para cada llamada

- **Bold (10:30, datáfonos para comercios):** dale más tiempo al tendero, sobre todo a la caja. Lo que conecta con ellos es que la validación del código y el cobro del 5 % pasan en el mostrador.
- **Comultrasan (3:00 p.m., para sus asociados):** dale más tiempo a la persona: la cifra sin cuenta, "¿Puedo gastar?" y el Hoy. Si preguntan por integrar, existe `/desarrolladores` (documentación de la API), pero no la abras sin haberla revisado antes.

## Si algo falla

| Qué pasa | Qué hacer |
| --- | --- |
| La vista previa pide iniciar sesión en Vercel | Inicia sesión con tu cuenta. Prepáralo antes de compartir pantalla. |
| "Ya hay una cuenta con este correo. Entra con tu contraseña." | Usa otro correo. |
| La persona no ve "Café de ejemplo" en Ofertas | Recarga la página de Ofertas. Si sigue sin aparecer, revisa que el tendero haya tocado "Publicar oferta ahora" y haya caído en el resumen del negocio. |
| El código no aparece en la caja | Revisa que no tenga espacios. El código sirve una sola vez. |
| La vista previa no responde | Pasa al plan B. |

## Plan B: en tu computador

Solo si la vista previa no está lista. Usa la base local, no producción.

Un solo comando, en una terminal que se queda abierta durante la llamada:

```bash
cd web && npm run demo
```

Levanta la base local si no está corriendo, aplica las migraciones, compila (tarda un minuto) y, cuando dice **"✓ Lista: abre http://localhost:3000"**, ya puedes usarla. Se niega a correr si `web/.env.local` no apunta a la base local. Para apagar todo: Ctrl+C en esa terminal.

Hazlo una vez antes de la llamada (a las 10:00) para ver que arranca, y déjalo corriendo.

Abre `http://localhost:3000` en las dos ventanas, como arriba. En local no hay inicio de sesión de Vercel.

Si algo se traba:
- "La base local no arrancó": `cd devdb && npm run stop` y vuelve a `npm run demo`.
- "El puerto 3000 está ocupado": cierra la otra app (por ejemplo, una terminal con `npm run dev`) o reinicia la terminal, y vuelve a intentar.
