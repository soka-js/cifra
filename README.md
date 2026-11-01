# CIFRA

> **El producto real está en [`web/`](web/README.md)** (Next.js + Postgres, cuentas, extractos, API para entidades y landing con analítica). Lo que sigue describe el prototipo de demostración que se usó en las entrevistas.

Prototipo interactivo de alta fidelidad de un ecosistema financiero hiperlocal para Bogotá, con dos lados:

- **Consumidor** (`/user/*`): una sola respuesta clara sobre cuánto puede gastar, sin tableros financieros.
- **Tendero** (`/merchant/*`): conversación por WhatsApp con acciones en un toque y un panel web secundario.

## Entrada pública

`/` es la portada para quien llega por el QR: el problema, qué hace CIFRA, los cuatro pasos y el botón **Empezar el recorrido**. Cualquier ruta desconocida vuelve ahí. En las pantallas del consumidor, la barra de demo (fuera del teléfono) muestra el paso actual del recorrido con flechas de anterior y siguiente. `vercel.json` reescribe todas las rutas a `index.html` para que los enlaces profundos funcionen al recargar.

## Preparar una entrevista (YODA)

Antes de cada entrevista, abre `/setup` (ícono de ajustes en la barra superior, fuera del marco del teléfono) y carga los datos del entrevistado: nombre, ingreso mensual, monto comprometido, gasto proyectado, colchón, día de corte, días restantes y sus cobros que se repiten. **Guardar** los aplica a todas las pantallas y los deja en `localStorage`, así que sobreviven a una recarga. **Restaurar valores de ejemplo** vuelve a cargar el caso de Mariana en el formulario.

El recorrido de la sesión es conexión → inicio → simular → respuesta → cobros. El colchón no está en el documento del proyecto: la fórmula lo admite, pero va en 0 por defecto y en 0 no se muestra.

## Correr

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + build de producción en dist/
```

## Stack

Vite + React 18 + TypeScript, Tailwind CSS 3, React Router 6, Zustand y Lucide Icons. Tipografía Plus Jakarta Sans vía Google Fonts.

## Estructura

```
src/
  components/
    layout/    AppShell (barra demo + cambio de rol), PhoneFrame, BottomNav, layouts por rol
    setup/     Panel de datos de la sesión (/setup)
    welcome/   Portada pública en / (fuera del marco del teléfono)
    ui/        Button, Pill, BottomSheet, Toast, Logo, ScreenHeader…
    user/      6 pantallas del consumidor
    merchant/  7 pantallas del tendero + whatsapp/ (chat, burbujas, nota de voz)
  store/useAppStore.ts   estado global, datos de la sesión y cálculo del disponible
  lib/                   formato COP, lista de pantallas, datos de comercio
```

## Pantallas

| Consumidor | Tendero |
| --- | --- |
| `/user/connect` Conexión de cuentas | `/merchant/onboarding` Alta rápida por WhatsApp |
| `/user/home` Saldo disponible | `/merchant/weekly-report` Reporte semanal |
| `/user/simulate` Simular un gasto | `/merchant/create-offer-1` Crear oferta · producto |
| `/user/response-positive` Sí te alcanza | `/merchant/create-offer-2` Crear oferta · descuento |
| `/user/response-negative` No te alcanza | `/merchant/campaign-results` Resultados |
| `/user/subscriptions` Cobros que se repiten | `/merchant/chat-query` Consulta conversacional |
| | `/merchant/dashboard` Panel web de tendencias |

La barra superior permite cambiar de rol, saltar a cualquier pantalla y abrir `/setup`.

La cifra grande del Inicio es el disponible seguro:

```
disponibleSeguro = ingreso − comprometido − proyectado − colchón
```

El simulador compara el monto contra ese mismo número: si cabe, responde "Sí, te alcanza" con lo que quedaría (`disponibleSeguro − monto`) y cuánto da por día en los días restantes; si no, "No te alcanza" con lo que faltaría (`monto − disponibleSeguro`).
