import { describe, expect, it } from 'vitest';
import { cop } from '../format';
import { offerTemplates } from '../offer-templates';

const CATEGORIES = ['panaderia', 'tienda', 'cafeteria', 'restaurante', 'fruver', 'papeleria', 'drogueria', 'peluqueria', 'servicios', 'otro'];
const SIN_PRODUCTO_DEL_DIA = ['papeleria', 'drogueria', 'peluqueria', 'servicios', 'otro'];

describe('plantillas de la primera oferta según el tipo de negocio', () => {
  it('todo tipo de negocio tiene plantillas, empezando por la de primera visita, sin ids repetidos', () => {
    for (const cat of CATEGORIES) {
      const tpls = offerTemplates(cat);
      expect(tpls[0]!.id).toBe('bienvenida-10');
      expect(new Set(tpls.map((t) => t.id)).size).toBe(tpls.length);
    }
  });

  it('la de "antes del cierre" solo sale donde hay producto del día, y habla de lo que ese negocio vende', () => {
    for (const cat of SIN_PRODUCTO_DEL_DIA) {
      const tpls = offerTemplates(cat);
      expect(tpls.map((t) => t.id)).not.toContain('por-horas-cierre');
      expect(tpls.map((t) => `${t.title} ${t.description}`).join(' ')).not.toMatch(/horneados|pan |fruta|menú/i);
    }
    const cierre = (cat: string) => offerTemplates(cat).find((t) => t.id === 'por-horas-cierre')?.title;
    expect(cierre('panaderia')).toMatch(/horneados/);
    expect(cierre('fruver')).toMatch(/frutas y verduras/);
    expect(cierre('restaurante')).toMatch(/menú del día/);
  });

  it('un tipo desconocido no hereda nada raro', () => {
    expect(offerTemplates('toString').map((t) => t.id)).toEqual(['bienvenida-10', 'por-horas-tarde', 'bono-fijo']);
  });

  it('en español: sin "OFF" ni emojis', () => {
    for (const cat of CATEGORIES) {
      for (const t of offerTemplates(cat)) {
        const text = `${t.badge} ${t.title} ${t.description}`;
        expect(text).not.toMatch(/\bOFF\b/);
        expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it('los montos del título de monto fijo son los mismos que llena en el formulario', () => {
    const fixed = offerTemplates('tienda').find((t) => t.id === 'bono-fijo')!;
    expect(fixed.title).toBe(`${cop(Number(fixed.fixedPesos) * 100)} de descuento por compras desde ${cop(Number(fixed.minPesos) * 100)}`);
  });
});
