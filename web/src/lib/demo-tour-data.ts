export interface TourStep {
  id: string;
  role: 'persona' | 'negocio';
  actor: 'Mariana · 26 años (Cliente)' | 'Rosa · Panadería La Espiga (Tendero)';
  section: string;
  title: string;
  path: string;
  badge: string;
  badgeColor: 'primary' | 'terra';
  problem: string;
  valueProp: string;
  keyMetric: string;
  interactiveTip: string;
  durationSeconds: number;
}

export const DEMO_TOUR_STEPS: TourStep[] = [
  // ==========================================
  // BLOQUE 1: PROPUESTA DE VALOR DEL CLIENTE
  // ==========================================
  {
    id: 'persona-cifra-hoy',
    role: 'persona',
    actor: 'Mariana · 26 años (Cliente)',
    section: 'Tu Cifra de Hoy',
    title: 'Tu Disponible Real sin Ansiedad de Deuda',
    path: '/app',
    badge: 'PROPUESTA DE VALOR · CLIENTE',
    badgeColor: 'primary',
    problem:
      'Los bancos muestran el saldo bruto de la cuenta y la deuda total de la tarjeta, asustando a la persona sin decirle cuánto puede gastar hoy con tranquilidad.',
    valueProp:
      'CIFRA calcula en vivo tu Disponible Seguro restando cobros fijos de la quincena ($181,150), tu ritmo habitual de vida ($100,125) y un colchón de imprevistos ($80,000). Todos los números con separador de miles por comas.',
    keyMetric: '$1,500,725 disponibles seguros hasta el 15 nov',
    interactiveTip:
      'Mira el desglose en cascada y el contador de $40,900 ahorrados en comercios de tu barrio este mes.',
    durationSeconds: 10,
  },
  {
    id: 'persona-tope-captura',
    role: 'persona',
    actor: 'Mariana · 26 años (Cliente)',
    section: 'Tope Diario y Captura 3s',
    title: 'Tope de Hoy Vivo y Registro en 3 Segundos',
    path: '/app',
    badge: 'CERO HOJAS DE CÁLCULO',
    badgeColor: 'primary',
    problem:
      'Nadie llena hojas de Excel ni guarda facturas manuales. Las apps de presupuesto tradicionales se abandonan en la primera semana.',
    valueProp:
      'Un tope dinámico ($28,588 libres hoy) que premia al usuario si gasta menos, aumentando su cifra de mañana. Permite capturar gastos en 3 segundos pegando SMS de Bancolombia, Nequi, Daviplata o escribiendo texto informal.',
    keyMetric: '$28,588 de tope diario + recompensa al cierre',
    interactiveTip:
      'Haz clic en el botón negro «+ Anotar gasto / SMS» para ver el reconocedor inteligente de mensajes bancarios colombianos.',
    durationSeconds: 10,
  },
  {
    id: 'persona-puedo-cuotas',
    role: 'persona',
    actor: 'Mariana · 26 años (Cliente)',
    section: 'Decisiones Inteligentes',
    title: 'Simulador ¿Puedo? y Trampa de Cuotas con Tarjeta',
    path: '/app/gasto',
    badge: 'SIMULADOR EN TIEMPO REAL',
    badgeColor: 'primary',
    problem:
      'Las compras impulsivas se difieren a 6 o 12 cuotas con tarjeta de crédito sin entender cuántos intereses se le regalan al banco.',
    valueProp:
      'Pregunta en lenguaje natural antes de pasar la tarjeta. El simulador analiza el impacto en tu margen diario y compara de contado vs. 3, 6 y 12 cuotas, mostrando en pesos los intereses que perderías frente a opciones de barrio.',
    keyMetric: 'Entrada con comas ($ 350,000) y chips rápidos',
    interactiveTip:
      'Digita un valor usando los chips (+$20,000, +$50,000) y mira la tabla de cuotas que te muestra el sobrecosto real.',
    durationSeconds: 10,
  },
  {
    id: 'persona-ofertas-mapa',
    role: 'persona',
    actor: 'Mariana · 26 años (Cliente)',
    section: 'Beneficios en tu Cuadra',
    title: 'Cross-Reference: Tus Gastos Cruzados con tu Barrio',
    path: '/app/ofertas',
    badge: 'CROSS-REFERENCE & MAPA GPS',
    badgeColor: 'primary',
    problem:
      'Las plataformas de domicilios cobran hasta un 28 % de sobrecosto por pedir a comercios que quedan a 3 cuadras caminando.',
    valueProp:
      'CIFRA cruza lo que habitualmente consumes con panaderías, fruvers y cafeterías de tu zona que tienen descuentos en horas valle. Generas un código de 6 letras / QR de un solo uso que redimes en el mostrador.',
    keyMetric: 'Descuentos de $2,000 a $6,000 con código de 6 letras',
    interactiveTip:
      'Toca «Desplegar mapa y descuentos» para explorar los comercios georreferenciados con filtros de horario.',
    durationSeconds: 10,
  },

  // ==========================================
  // BLOQUE 2: PROPUESTA DE VALOR DEL TENDERO
  // ==========================================
  {
    id: 'negocio-cuadre-insumos',
    role: 'negocio',
    actor: 'Rosa · Panadería La Espiga (Tendero)',
    section: 'Operación del Local',
    title: 'Cuadre Diario, Punto de Equilibrio y Costos',
    path: '/negocio/cuadre',
    badge: 'PROPUESTA DE VALOR · TENDERO',
    badgeColor: 'terra',
    problem:
      'El tendero o pequeño comerciante no sabe si hoy libró el día o está perdiendo plata, y no se entera cuando los proveedores le suben la materia prima.',
    valueProp:
      'Termómetro en vivo de meta diaria ($493,000 de $450,000 librados). Rosa registra ventas e insumos en 5 segundos con números formateados por comas y recibe alertas automáticas ante alzas en harina o mantequilla.',
    keyMetric: '$493,000 en ventas hoy (110 % del punto de equilibrio)',
    interactiveTip:
      'Observa cómo el tendero puede encender una Oferta Relámpago con 1 clic si las ventas van flojas en la tarde.',
    durationSeconds: 10,
  },
  {
    id: 'negocio-ofertas-margen',
    role: 'negocio',
    actor: 'Rosa · Panadería La Espiga (Tendero)',
    section: 'Margen Protegido',
    title: 'Calculadora Honesta de Margen y Cero Merma',
    path: '/negocio/ofertas',
    badge: '5 % CIFRA VS 28 % APPS',
    badgeColor: 'terra',
    problem:
      'Las aplicaciones de delivery cobran hasta 28 % de comisión y las promociones masivas queman el margen del comerciante sin fidelizar.',
    valueProp:
      'CIFRA cobra solo el 5 % de comisión por éxito y únicamente después de vender. Permite crear Ofertas Relámpago de Horas Muertas (ej. 2:00 a 5:00 PM) con cupos controlados para no botar pan ni comida fresca (cero merma).',
    keyMetric: 'Rosa conserva $17,100 netos de una venta de $20,000',
    interactiveTip:
      'Revisa la calculadora de margen honesto comparando mostrador directo, CIFRA y aplicaciones de domicilio.',
    durationSeconds: 10,
  },
  {
    id: 'negocio-vitrina-afiche',
    role: 'negocio',
    actor: 'Rosa · Panadería La Espiga (Tendero)',
    section: 'Presencia Digital',
    title: 'Vitrina Móvil Pública y Afiche QR Imprimible',
    path: '/negocio/vitrina',
    badge: 'MOSTRADOR DIGITAL EN 1 CLIC',
    badgeColor: 'terra',
    problem:
      'Un micronegocio de barrio no tiene dinero para pagar desarrolladores web ni software costoso de catálogos.',
    valueProp:
      'CIFRA genera una vitrina web pública optimizada para celular (/b/demo-panaderia-la-espiga) lista para compartir en WhatsApp Business e Instagram, más un afiche QR de alta definición listo para imprimir y pegar en la puerta o mesas.',
    keyMetric: 'Afiche QR vectorial listo para imprimir en 1 clic',
    interactiveTip:
      'Haz clic en «Ver vitrina pública» para ver cómo un vecino consulta tus productos estrella desde su teléfono.',
    durationSeconds: 10,
  },
  {
    id: 'negocio-caja-pos',
    role: 'negocio',
    actor: 'Rosa · Panadería La Espiga (Tendero)',
    section: 'Caja del Mostrador',
    title: 'Cobro de Códigos POS en 5 Segundos',
    path: '/negocio/caja',
    badge: 'VALIDACIÓN BILATERAL EN VIVO',
    badgeColor: 'terra',
    problem:
      'Validar cupones en papel o manejar códigos engorrosos en el mostrador hace perder tiempo en las horas de fila.',
    valueProp:
      'Rosa digita las 6 letras del cliente (como PAN10K) o escanea el QR desde la cámara del celular. CIFRA liquida el reparto exacto al instante, descuenta el cupo de la oferta y suma los pesos ahorrados a la cuenta de Mariana.',
    keyMetric: 'Reparto transparente: $18,000 cobrado, $900 comisión',
    interactiveTip:
      'Prueba consultar el código PAN10K en la caja para ver el cálculo bilateral en vivo.',
    durationSeconds: 10,
  },
  {
    id: 'negocio-informe-1pagina',
    role: 'negocio',
    actor: 'Rosa · Panadería La Espiga (Tendero)',
    section: 'Resultados Transparentes',
    title: 'Informe Mensual de 1 Página sin Jerga Contable',
    path: '/negocio/informe',
    badge: 'CERO JERGA CONTABLE',
    badgeColor: 'terra',
    problem:
      'Los informes contables tradicionales son incomprensibles y no le dicen al tendero si sus clientes están regresando.',
    valueProp:
      'Un resumen mensual limpio de 1 página con las 4 cifras reales: Ventas generadas, Clientes que volvieron sin descuento (19 este mes), Insumos y Gastos pagados, y Utilidad operativa. Listo para enviar por WhatsApp o imprimir.',
    keyMetric: '19 clientes fidelizados volvieron a comprar sin descuento',
    interactiveTip:
      'Revisa la métrica de retención real y el botón para compartir el informe listo para WhatsApp.',
    durationSeconds: 10,
  },
];
