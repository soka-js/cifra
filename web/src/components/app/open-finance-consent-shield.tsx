'use client';

import {
  Check,
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CONSENT_VERSION, shortDate } from '@/lib/format';

interface OpenFinanceConsentShieldProps {
  userName: string | null;
  userEmail: string | null;
  consentGrantedAtIso: string;
}

export function OpenFinanceConsentShield({
  userName,
  userEmail,
  consentGrantedAtIso,
}: OpenFinanceConsentShieldProps) {
  const [durationDays, setDurationDays] = useState<90 | 180 | 365>(180);
  const [scopeRecurring, setScopeRecurring] = useState<boolean>(true);
  const [scopeGeoNba, setScopeGeoNba] = useState<boolean>(true);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem('cifra_consent_days');
      if (d === '90' || d === '180' || d === '365') setDurationDays(Number(d) as 90 | 180 | 365);
      const sr = localStorage.getItem('cifra_scope_recurring');
      if (sr !== null) setScopeRecurring(sr === 'true');
      const sg = localStorage.getItem('cifra_scope_geonba');
      if (sg !== null) setScopeGeoNba(sg === 'true');
    } catch {
      // Ignorar
    }
  }, []);

  function handleSavePreferences(nextDays: 90 | 180 | 365, nextRec: boolean, nextGeo: boolean) {
    setDurationDays(nextDays);
    setScopeRecurring(nextRec);
    setScopeGeoNba(nextGeo);
    try {
      localStorage.setItem('cifra_consent_days', String(nextDays));
      localStorage.setItem('cifra_scope_recurring', String(nextRec));
      localStorage.setItem('cifra_scope_geonba', String(nextGeo));
    } catch {
      // Ignorar
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2200);
  }

  const baseDate = new Date(`${consentGrantedAtIso}T12:00:00Z`);
  const validUntilDate = new Date(
    (isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime()) + durationDays * 86_400_000,
  );
  const validUntilIso = validUntilDate.toISOString().slice(0, 10);

  return (
    <section
      id="blindaje-consentimiento-open-finance"
      className="surface-card overflow-hidden border-primary/30 p-5 sm:p-6"
      aria-label="Blindaje de consentimiento explícito y preparación Open Finance"
    >
      {/* Cabecera con insignia regulatoria */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary-dark">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-primary">
                Ley 1581 de 2012 · Decreto 1297 de 2022 (Finanzas Abiertas)
              </span>
              <span className="rounded-full bg-paper px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                Mandato {CONSENT_VERSION}
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-[20px] font-bold text-ink">
              Blindaje de Consentimiento Explícito y Protección al Consumidor Financiero
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
              Tus datos son tuyos y solo se procesan bajo tu consentimiento expreso, con finalidad única y vigencia definida.
            </p>
          </div>
        </div>

        <button
          id="btn-toggle-consent-cert"
          type="button"
          onClick={() => setShowCertificate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 py-1.5 text-[12px] font-bold text-ink transition hover:border-ink hover:bg-white"
        >
          <FileCheck2 size={14} className="text-primary-dark" aria-hidden="true" />
          <span>{showCertificate ? 'Ocultar mandato legal' : 'Ver mandato legal firmado'}</span>
        </button>
      </div>

      {/* Las 3 Garantías Inquebrantables de Protección al Consumidor */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-primary-dark">
            <Lock size={16} aria-hidden="true" />
            <h3 className="font-display text-[14px] font-bold text-ink">
              1. Finalidad Única (Cero Venta)
            </h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Usamos tus datos <strong>exclusivamente</strong> para entregarte tu cifra disponible y recomendarte ahorro. Jamás vendemos ni cedemos tu información a bancos, aseguradoras ni centrales de riesgo.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-primary-dark">
            <ShieldAlert size={16} aria-hidden="true" />
            <h3 className="font-display text-[14px] font-bold text-ink">
              2. Cero Scraping y Cero Claves
            </h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            No usamos robots de <em>web scraping</em> que pidan tu usuario y clave bancaria, ni exponemos tus extractos a agentes de IA externos sin control regulatorio.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-primary-dark">
            <Clock size={16} aria-hidden="true" />
            <h3 className="font-display text-[14px] font-bold text-ink">
              3. Vigencia Temporal Controlada
            </h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Ninguna autorización es perpetua. Tu mandato actual está vigente hasta el{' '}
            <strong className="text-ink">{shortDate(validUntilIso)}</strong> ({durationDays} días) y puedes revocarlo hoy mismo en 1 clic.
          </p>
        </div>
      </div>

      {/* Panel de Control Granular de Consentimiento (Estándar SFC) */}
      <div className="mt-5 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-[15.5px] font-bold text-ink">
            Configuración granular de tu consentimiento
          </h3>
          {savedNotice && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-[11.5px] font-bold text-primary-dark">
              <Check size={12} aria-hidden="true" /> Preferencias actualizadas
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2.5 text-[13.5px]">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3.5 py-2.5">
            <div>
              <span className="font-semibold text-ink">
                Cálculo de Cifra Disponible y Tope de Hoy
              </span>
              <span className="block text-[12px] text-ink-muted">
                Lectura de saldos y movimientos para separar fijos e imprevistos.
              </span>
            </div>
            <span className="rounded-full bg-primary-pale px-2.5 py-1 text-[11.5px] font-bold text-primary-dark">
              Esencial · Activo
            </span>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:bg-paper/50">
            <div>
              <span className="font-semibold text-ink">
                Detección de suscripciones y cobros recurrentes
              </span>
              <span className="block text-[12px] text-ink-muted">
                Identifica cobros mensuales repetidos para que decidas cuáles cancelar.
              </span>
            </div>
            <input
              type="checkbox"
              checked={scopeRecurring}
              onChange={(e) =>
                handleSavePreferences(durationDays, e.target.checked, scopeGeoNba)
              }
              className="h-4 w-4 accent-[#0E6E63]"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:bg-paper/50">
            <div>
              <span className="font-semibold text-ink">
                Recomendaciones contextuales «Next Best Action» en tu barrio
              </span>
              <span className="block text-[12px] text-ink-muted">
                Cruza tus categorías frecuentes con ofertas de tiendas cercanas sin revelar tu identidad al comercio.
              </span>
            </div>
            <input
              type="checkbox"
              checked={scopeGeoNba}
              onChange={(e) =>
                handleSavePreferences(durationDays, scopeRecurring, e.target.checked)
              }
              className="h-4 w-4 accent-[#0E6E63]"
            />
          </label>
        </div>

        {/* Selector de plazo de vigencia */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[12.5px]">
          <span className="font-medium text-ink-muted">
            Plazo autorizado de conservación y tratamiento:
          </span>
          <div className="inline-flex rounded-xl border border-line bg-paper p-0.5 font-semibold">
            {([90, 180, 365] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleSavePreferences(d, scopeRecurring, scopeGeoNba)}
                className={`rounded-lg px-2.5 py-1 transition ${
                  durationDays === d
                    ? 'bg-ink text-white'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Certificado Legal Desplegable */}
      {showCertificate && (
        <div className="mt-4 rounded-2xl border border-primary/35 bg-primary-pale/45 p-4 text-[12.5px] leading-relaxed text-ink-soft">
          <p className="font-display text-[14px] font-bold text-ink">
            Constancia de Autorización Expresa de Tratamiento de Datos Financieros ({CONSENT_VERSION})
          </p>
          <p className="mt-1.5">
            <strong>Titular:</strong> {userName ?? 'Usuario CIFRA'} ({userEmail ?? 'Cuenta verificada'}) ·{' '}
            <strong>Fecha de otorgamiento:</strong> {shortDate(consentGrantedAtIso)} ·{' '}
            <strong>Vigencia hasta:</strong> {shortDate(validUntilIso)}.
          </p>
          <p className="mt-1.5">
            <strong>Cláusula de Finalidad Exclusiva (Ley 1581/2012 y Ley 1266/2008):</strong> CIFRA actúa exclusivamente como encargado del procesamiento para beneficio directo del Titular. Queda expresamente prohibida la comercialización, perfilamiento crediticio para terceros, cesión a entidades financieras o entrenamiento de modelos externos con los extractos o movimientos del Titular.
          </p>
        </div>
      )}

      {/* Preparación Evolutiva hacia APIs de Finanzas Abiertas (SFC Colombia) */}
      <div className="mt-4 rounded-2xl border border-line bg-paper-warm p-4 text-[13px]">
        <div className="flex items-start gap-2.5">
          <Sparkles size={17} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
          <div>
            <p className="font-display text-[14.5px] font-bold text-ink">
              Preparado para el estándar de APIs de Finanzas Abiertas (Superintendencia Financiera)
            </p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              Hoy mantienes el control subiendo tu extracto o anotando tus alertas por SMS sin entregar claves. A medida que los bancos y billeteras en Colombia (Bancolombia, Nequi, Davivienda, Grupo Aval) habiliten las APIs reguladas de Open Finance bajo estándares de la SFC, este mismo panel de consentimiento te permitirá activar la sincronización automática con 1 clic.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-[11.5px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-primary-dark border border-line">
                <CheckCircle2 size={12} aria-hidden="true" /> Hoy: Extracto PDF/CSV + Captura SMS 3s
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-primary-dark border border-line">
                <CheckCircle2 size={12} aria-hidden="true" /> Hoy: API B2B2C Cooperativas y Billeteras
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-ink-muted border border-line">
                Próximo paso regulatorio: APIs Abiertas SFC (12–24m)
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
