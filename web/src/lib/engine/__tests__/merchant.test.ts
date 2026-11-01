import { describe, expect, it } from 'vitest';
import { categoryOf, cleanDescription, flowOf, identifyMerchant } from '../merchant';

describe('comercios', () => {
  it('reconoce suscripciones aunque traigan códigos', () => {
    expect(identifyMerchant('COMPRA INTL SPOTIFY P3F2A1 STOCKHOLM').key).toBe('spotify');
    expect(identifyMerchant('COMPRA INTL NETFLIX.COM').name).toBe('Netflix');
    expect(identifyMerchant('Pago en Rappi Prime').key).toBe('rappi_prime');
    expect(identifyMerchant('PAGO PSE ENEL COLOMBIA').category).toBe('servicios_hogar');
  });
  it('limpia descripciones desconocidas a una llave estable', () => {
    expect(cleanDescription('COMPRA POS TIENDA DONA ROSA 12345 BOGOTA')).toBe('TIENDA DONA ROSA');
    expect(identifyMerchant('COMPRA POS TIENDA DONA ROSA 12345').key).toBe(identifyMerchant('COMPRA POS TIENDA DONA ROSA 99881').key);
  });
  it('distingue el tipo de movimiento', () => {
    expect(flowOf('PAGO NOMINA EMPRESA SAS', 250000000)).toBe('ingreso');
    expect(flowOf('TRANSFERENCIA A JUAN PEREZ', -90000000)).toBe('transferencia');
    expect(flowOf('PAGO TARJETA CREDITO VISA', -50000000)).toBe('pago_tarjeta');
    expect(flowOf('RETIRO CAJERO EXITO', -20000000)).toBe('efectivo');
    expect(categoryOf('IMPTO GOBIERNO 4X1000', -4000)).toBe('comisiones');
    expect(categoryOf('COMPRA EN D1 SAS', -3500000)).toBe('mercado');
  });
});
