# CIFRA

**Tu banco te dice cuánto tienes. CIFRA te dice cuánto puedes gastar — y te hace rendir la plata donde ya compras.**

CIFRA es una plataforma financiera de dos lados diseñada para Bogotá y América Latina:

1. **Para las personas (`/` → `/app`) — Gratis siempre:** consolida saldos y movimientos sin pedir claves bancarias (extractos CSV/Excel/PDF leídos en el navegador, modo rápido en 60 segundos o conexión vía entidad aliada), calcula el **disponible seguro** hasta el próximo pago, responde **«¿Puedo hacer este gasto?»** antes de pagar, detecta **cobros recurrentes olvidados** con guía de cancelación y entrega **descuentos reales** en comercios de barrio donde ya compra.
2. **Para el micronegocio de barrio (`/negocio`) — Cobro solo por resultado (5 %):** sin mensualidades, sin tableros complejos y sin arriesgar capital por adelantado. Publica una oferta con control de canibalización, valida códigos o QR de un solo uso desde el celular en segundos y recibe clientes nuevos verificados más un **informe mensual de una página** con sus 4 cifras clave (redenciones, venta atribuida, clientes nuevos y retorno sin descuento).
3. **Para cooperativas, cajas y billeteras (`/desarrolladores`) — Canal B2B2C:** API REST v1 + sesiones embebidas de un solo uso para entregar CIFRA dentro de su propia app y participar del **30 % de la comisión** generada en su canal.
4. **Backoffice y Data Room (`/admin`):** operación de calle de micronegocios, conciliación de comisiones (Bre-B / Nequi / Wompi), monitoreo de umbrales de validación (retención, renovación de campañas, tiempo hasta la primera cifra) y telemetría de experimentación A/B.

---

## Estructura del repositorio

Toda la aplicación productiva (Next.js 16 + PostgreSQL + Drizzle ORM) vive en [`web/`](web/README.md), lista para desplegar en Vercel con `Root Directory = web` y base de datos PostgreSQL (Neon).

```bash
cd web
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev          # http://localhost:3000
npm test             # Suite de pruebas del motor, atribución, insights y lectores
npm run typecheck    # Verificación estricta de TypeScript
```

Consulta [`web/README.md`](web/README.md) para instrucciones detalladas de despliegue, variables de entorno e integración de aliados.
