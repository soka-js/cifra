# CIFRA — Aplicación de Producción (`web/`)

Claridad diaria sobre cuánto puedes gastar hasta tu próximo pago, conectada con una red de comercios independientes de barrio que pagan comisión únicamente después de vender.

## Arquitectura de tres actores

1. **Personas (`/app`)**:
   - Onboarding de confianza explícita en menos de 5 minutos (importación local en el navegador de extractos CSV, Excel o PDF digital de bancos colombianos, o arranque rápido en 60 segundos).
   - **Hoy**: disponible seguro con la resta a la vista, contador verificable de **pesos ahorrados con CIFRA**, alerta temprana de desvío semanal y ofertas cercanas relevantes (sin mostrar deuda total de golpe).
   - **¿Puedo?** (`/app/gasto`): simulador en español natural con veredicto empático (*Sí / Justo / No*), impacto diario y alternativas accionables.
   - **En qué se me va** (`/app/movimientos`): comparativo 30d vs 30d previos, detección de gastos hormiga y **reclasificación en 1 toque** con aprendizaje personal y colectivo (`merchantCatalog`).
   - **Cobros recurrentes** (`/app/cobros`): detección automática, **acumulado histórico pagado**, guías paso a paso de cancelación en Colombia y registro de ahorro mensual real.
   - **Ofertas cerca de ti** (`/app/ofertas`): mapa interactivo (Leaflet + OpenStreetMap), generación de código único de 6 letras + QR de mostrador y confirmación bilateral.
   - **Cierre de ciclo** (`/app/cierre`) y **Tus datos — Ley 1581** (`/app/datos` + exportación JSON/CSV + revocación inmediata).

2. **Micronegocios de Barrio (`/negocio`)**:
   - Activación en 1 toque por enlace de WhatsApp (`/negocio/activar/[token]`) o auto-registro web (`/negocio/unirse`).
   - **Las 4 cifras claras del mes** (cero jerga técnica): ventas con oferta, plata libre en caja, clientes nuevos y retorno orgánico posterior sin descuento.
   - **Caja / POS** (`/negocio/caja`): validación de código de 6 letras o escaneo de QR con cámara y desglose exacto al centavo (ej. pedido $20.000 → descuento 10 % → cobro $18.000 → comisión CIFRA 5 % = $900 → negocio conserva $17.100).
   - **Creador de ofertas en 3 pasos** (`/negocio/ofertas`) con controles anti-canibalización (*solo clientes nuevos* + grupo de control determinístico del 10 %) y renovación medible.
   - **Informe mensual de 1 sola página** (`/negocio/informe`) listo para imprimir/PDF y compartir por WhatsApp.
   - **Estado de cuenta y pagos** (`/negocio/cuenta`) por llave Bre-B / Nequi con comprobante conciliable + adaptador opcional Wompi Colombia (`/api/webhooks/wompi`).

3. **Operación, Aliados B2B2C y Data Room (`/admin` y `/desarrolladores`)**:
   - **Data Room de Inversión**: seguimiento en vivo de hipótesis falsables (retención ≥ 40 %, renovación de campañas ≥ 50 %, primera cifra < 5 min, GMV atribuido, ingreso neto CIFRA y embudo A/B).
   - **CRM de Calle y Moderación**: creación de comercios, emisión de enlaces de WhatsApp y curaduría del diccionario colombiano aprendido.
   - **Canal B2B2C**: API REST (`/api/v1/members/...`), sesiones embebidas de 2 minutos (`/e/[token]`) y libro mayor de reparto automático del **30 %** de las comisiones generadas por asociados.
   - **Demo con datos de ejemplo**: ecosistema de Bogotá (Chapinero, Parkway y Las Aguas) marcado con `is_demo = true`. Solo un admin la abre, desde `/admin`, sobre su propia sesión; los usuarios de ejemplo no tienen clave.

## Desarrollo local

Requiere Node 20+ y PostgreSQL 14+.

```bash
cd web
cp .env.example .env.local   # Configura DATABASE_URL y ADMIN_EMAILS
npm install
npm run db:migrate
npm run dev                  # http://localhost:3000
npm test                     # Pruebas unitarias del motor, atribución e importadores
npm run test:int             # Pruebas de permisos contra la base local (requiere devdb corriendo)
npm run typecheck
npm run build
```

## Despliegue en Vercel + Neon

1. Importa el repositorio en Vercel con **Root Directory = `web`**.
2. Conecta una base PostgreSQL de **Neon** (`DATABASE_URL`).
3. Configura `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAILS`, `CRON_SECRET` y las variables opcionales listadas en `.env.example` (`RESEND_API_KEY` o `SMTP_URL`, `GOOGLE_CLIENT_ID`/`SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `CIFRA_BREB_KEY`, `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`).
4. El comando `vercel-build` ejecuta las migraciones aditivas antes de compilar Next.js, y `vercel.json` programa `/api/cron/daily` todos los días a las 8:00 a. m. (hora Colombia).
