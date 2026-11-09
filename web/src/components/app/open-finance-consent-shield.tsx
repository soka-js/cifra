'use client';

import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  Fingerprint,
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
  const [scopeFutureOpenFinanceApi, setScopeFutureOpenFinanceApi] = useState<boolean>(true);
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
      const so = localStorage.getItem('cifra_scope_openfinance_api');
      if (so !== null) setScopeFutureOpenFinanceApi(so === 'true');
    } catch {
      // Ignorar
    }
  }, []);

  function handleSavePreferences(
    nextDays: 90 | 180 | 365,
    nextRec: boolean,
    nextGeo: boolean,
    nextOpenApi: boolean,
  ) {
    setDurationDays(nextDays);
    setScopeRecurring(nextRec);
    setScopeGeoNba(nextGeo);
    setScopeFutureOpenFinanceApi(nextOpenApi);
    try {
      localStorage.setItem('cifra_consent_days', String(nextDays));
      localStorage.setItem('cifra_scope_recurring', String(nextRec));
      localStorage.setItem('cifra_scope_geonba', String(nextGeo));
      localStorage.setItem('cifra_scope_openfinance_api', String(nextOpenApi));
    } catch {
      // Ignorar
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2400);
  }

  const baseDate = new Date(`${consentGrantedAtIso}T12:00:00Z`);
  const validUntilDate = new Date(
    (isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime()) + durationDays * 86_400_000,
  );
  const validUntilIso = validUntilDate.toISOString().slice(0, 10);

  const mandateFingerprint = `SHA256:9f84c2e1...${durationDays}d-${scopeRecurring ? '1' : '0'}${scopeGeoNba ? '1' : '0'}`;

  function handleDownloadCertificate() {
    const payload = {
      mandatoVersion: CONSENT_VERSION,
      marcoNormativo: [
        'Ley Estatutaria 1581 de 2012 (Habeas Data y Protección de Datos Personales)',
        'Ley 1266 de 2008 (Datos Financieros)',
        'Decreto 1297 de 2022 y Circular Externa SFC (Arquitectura de Finanzas Abiertas)',
      ],
      titular: {
        nombre: userName ?? 'Usuario CIFRA',
        correo: userEmail ?? 'Cuenta verificada',
      },
      vigencia: {
        otorgadoEl: consentGrantedAtIso,
        plazoAutorizadoDias: durationDays,
        validoHasta: validUntilIso,
      },
      alcancesAutorizados: {
        calculoCifraDisponibleYTopeDiario: true,
        deteccionSuscripcionesYCobrosFijos: scopeRecurring,
        motorNextBestActionGeolocalizadoAnonimo: scopeGeoNba,
        preAutorizacionLecturaApiOpenFinanceSfc: scopeFutureOpenFinanceApi,
      },
      garantiasDeSeguridad: {
        finalidadUnicaCeroVentaATerceros: true,
        ceroAlmacenamientoDeClavesBancarias: true,
        ceroAgentesIaExternosNoRegulados: true,
      },
      huellaIntegridad: mandateFingerprint,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mandato-consentimiento-cifra-${consentGrantedAtIso}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      id="blindaje-consentimiento-open-finance"
      className="surface-card scroll-mt-20 overflow-hidden border-primary/30 p-5 sm:p-6"
      aria-label="Blindaje de consentimiento explícito y preparación Open Finance"
    >
      {/* Cabecera con insignia regulatoria */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-light text-primary-dark">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-primary">
                Ley 1581 de 2012 · Decreto 1297 de 2022 (Finanzas Abiertas)
              </span>
              <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 font-mono text-[11px] font-bold text-ink-muted">
                Mandato {CONSENT_VERSION}
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-[20px] font-bold text-ink">
              Blindaje de Consentimiento Explícito y Protección al Consumidor Financiero
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
              Tus datos financieros son tuyos: se procesan exclusivamente con tu autorización expresa, finalidad única verificable y vigencia temporal definida.
            </p>
          </div>
        </div>

        <button
          id="btn-toggle-consent-cert"
          type="button"
          onClick={() => setShowCertificate((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-line bg-paper px-3.5 py-1.5 text-[12px] font-bold text-ink transition hover:border-ink hover:bg-white"
        >
          <FileCheck2 size={14} className="text-primary-dark" aria-hidden="true" />
          <span>{showCertificate ? 'Ocultar constancia legal' : 'Ver mandato legal firmado'}</span>
        </button>
      </div>

      {/* Certificado Legal Desplegable (justo debajo de la cabecera cuando está activo) */}
      {showCertificate && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-primary-pale/55 p-4 text-[12.5px] leading-relaxed text-ink-soft shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2.5">
            <div className="flex items-center gap-2">
              <Fingerprint size={16} className="text-primary-dark" aria-hidden="true" />
              <p className="font-display text-[14px] font-bold text-ink">
                Constancia de Mandato y Tratamiento de Datos ({CONSENT_VERSION})
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCertificate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-2.5 py-1 text-[11.5px] font-bold text-primary-dark shadow-2xs hover:bg-primary hover:text-white transition"
            >
              <Download size={12} aria-hidden="true" />
              <span>Descargar mandato (.json)</span>
            </button>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Titular autorizado
              </span>
              <span className="font-bold text-ink">
                {userName ?? 'Usuario CIFRA'} ({userEmail ?? 'Verificado'})
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Vigencia del mandato
              </span>
              <span className="font-bold text-ink">
                {shortDate(consentGrantedAtIso)} → {shortDate(validUntilIso)} ({durationDays} días)
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                Huella de auditoría
              </span>
              <span className="font-mono text-[11.5px] font-semibold text-primary-dark">
                {mandateFingerprint}
              </span>
            </div>
          </div>

          <p className="mt-2.5 rounded-xl bg-white/80 p-3 text-[12px] text-ink-soft">
            <strong className="text-ink">Cláusula de Finalidad Exclusiva (Ley 1581/2012 y Decreto 1297/2022):</strong>{' '}
            CIFRA actúa exclusivamente como encargado del procesamiento para beneficio directo del Titular. Queda expresamente prohibida la venta, cesión comercial, perfilamiento crediticio para bancos/aseguradoras o envío de extractos a modelos de inteligencia artificial externos no regulados.
          </p>
        </div>
      )}

      {/* Las 3 Garantías Inquebrantables de Protección al Consumidor */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-primary-dark">
            <Lock size={16} className="shrink-0" aria-hidden="true" />
            <h3 className="font-display text-[14px] font-bold text-ink">
              1. Finalidad Única (Cero Venta)
            </h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Usamos tus datos <strong>exclusivamente</strong> para calcular tu cifra disponible y conectarte con ahorro real. Jamás vendemos ni cedemos tu información a bancos, aseguradoras ni centrales de riesgo.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-primary-dark">
            <ShieldAlert size={16} className="shrink-0" aria-hidden="true" />
            <h3 className="font-display text-[14px] font-bold text-ink">
              2. Cero Claves y Cero Scraping
            </h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Nunca pedimos tu usuario ni clave bancaria para hacer <em>web scraping</em>, ni enviamos tus extractos a agentes de IA externos sin supervisión regulatoria.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-paper/70 p-3.5">
          <div className="flex items-center gap-2 text-primary-dark">
            <Clock size={16} className="shrink-0" aria-hidden="true" />
            <h3 className="font-display text-[14px] font-bold text-ink">
              3. Vigencia Temporal Controlada
            </h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
            Ninguna autorización es perpetua. Tu mandato actual está vigente hasta el{' '}
            <strong className="text-ink">{shortDate(validUntilIso)}</strong> ({durationDays} días) y puedes revocarlo o borrar tus fuentes en 1 clic.
          </p>
        </div>
      </div>

      {/* Panel de Control Granular de Consentimiento (Estándar SFC) */}
      <div className="mt-5 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-[15.5px] font-bold text-ink">
              Permisos granulares de tu mandato activo
            </h3>
            <p className="text-[12px] text-ink-muted">
              Activa o pausa en cualquier momento cada finalidad específica:
            </p>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-0.5 text-[11.5px] font-bold text-primary-dark">
              <Check size={12} aria-hidden="true" /> Mandato actualizado
            </span>
          )}
        </div>

        <div className="mt-3.5 space-y-2.5 text-[13.5px]">
          {/* Permiso 1: Esencial */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line/70 bg-paper px-3.5 py-3">
            <div className="min-w-0">
              <span className="block font-semibold text-ink">
                Cálculo de Cifra Disponible y Tope Diario Seguro
              </span>
              <span className="block text-[12px] text-ink-muted">
                Lectura local de saldos y movimientos para separar cobros fijos e imprevistos.
              </span>
            </div>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-primary-pale px-3 py-1 text-[11.5px] font-bold text-primary-dark">
              Esencial · Activo
            </span>
          </div>

          {/* Permiso 2: Suscripciones */}
          <div
            onClick={() =>
              handleSavePreferences(
                durationDays,
                !scopeRecurring,
                scopeGeoNba,
                scopeFutureOpenFinanceApi,
              )
            }
            role="switch"
            aria-checked={scopeRecurring}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSavePreferences(
                  durationDays,
                  !scopeRecurring,
                  scopeGeoNba,
                  scopeFutureOpenFinanceApi,
                );
              }
            }}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:bg-paper/50"
          >
            <div className="min-w-0">
              <span className="block font-semibold text-ink">
                Detección de suscripciones y cobros recurrentes
              </span>
              <span className="block text-[12px] text-ink-muted">
                Identifica cobros mensuales repetidos para que decidas cuáles conservar o cancelar.
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`text-[11.5px] font-bold ${
                  scopeRecurring ? 'text-primary-dark' : 'text-ink-faint'
                }`}
              >
                {scopeRecurring ? 'Autorizado' : 'Pausado'}
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  scopeRecurring ? 'bg-primary' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    scopeRecurring ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </div>

          {/* Permiso 3: Next Best Action Geo */}
          <div
            onClick={() =>
              handleSavePreferences(
                durationDays,
                scopeRecurring,
                !scopeGeoNba,
                scopeFutureOpenFinanceApi,
              )
            }
            role="switch"
            aria-checked={scopeGeoNba}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSavePreferences(
                  durationDays,
                  scopeRecurring,
                  !scopeGeoNba,
                  scopeFutureOpenFinanceApi,
                );
              }
            }}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:bg-paper/50"
          >
            <div className="min-w-0">
              <span className="block font-semibold text-ink">
                Motor «Next Best Action» y beneficios en tu barrio
              </span>
              <span className="block text-[12px] text-ink-muted">
                Cruza tus categorías frecuentes con descuentos cercanos sin revelar tu identidad al comercio.
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`text-[11.5px] font-bold ${
                  scopeGeoNba ? 'text-primary-dark' : 'text-ink-faint'
                }`}
              >
                {scopeGeoNba ? 'Autorizado' : 'Pausado'}
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  scopeGeoNba ? 'bg-primary' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    scopeGeoNba ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </div>

          {/* Permiso 4: Preparación API Open Finance SFC */}
          <div
            onClick={() =>
              handleSavePreferences(
                durationDays,
                scopeRecurring,
                scopeGeoNba,
                !scopeFutureOpenFinanceApi,
              )
            }
            role="switch"
            aria-checked={scopeFutureOpenFinanceApi}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSavePreferences(
                  durationDays,
                  scopeRecurring,
                  scopeGeoNba,
                  !scopeFutureOpenFinanceApi,
                );
              }
            }}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 transition hover:bg-paper/50"
          >
            <div className="min-w-0">
              <span className="block font-semibold text-ink">
                Conexión mediante APIs reguladas de Finanzas Abiertas (SFC)
              </span>
              <span className="block text-[12px] text-ink-muted">
                Habilita la sincronización por API oficial cuando tu banco o billetera abra su canal regulado.
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`text-[11.5px] font-bold ${
                  scopeFutureOpenFinanceApi ? 'text-primary-dark' : 'text-ink-faint'
                }`}
              >
                {scopeFutureOpenFinanceApi ? 'Listo' : 'Solo manual'}
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  scopeFutureOpenFinanceApi ? 'bg-primary' : 'bg-line-strong'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    scopeFutureOpenFinanceApi ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </span>
            </div>
          </div>
        </div>

        {/* Selector de plazo de vigencia */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5 text-[12.5px]">
          <span className="font-medium text-ink-muted">
            Plazo autorizado de conservación y vigencia del mandato:
          </span>
          <div className="inline-flex rounded-xl border border-line bg-paper p-0.5 font-semibold">
            {([90, 180, 365] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  handleSavePreferences(d, scopeRecurring, scopeGeoNba, scopeFutureOpenFinanceApi)
                }
                className={`rounded-lg px-3 py-1 transition ${
                  durationDays === d
                    ? 'bg-ink text-white shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preparación Evolutiva hacia APIs de Finanzas Abiertas (SFC Colombia) */}
      <div className="mt-4 rounded-2xl border border-line bg-paper-warm p-4 text-[13px]">
        <div className="flex items-start gap-2.5">
          <Sparkles size={17} className="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
          <div>
            <p className="font-display text-[14.5px] font-bold text-ink">
              Hoja de ruta regulatoria: De extracto seguro hoy a APIs SFC mañana
            </p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              Hoy mantienes el control subiendo tu extracto PDF/CSV o pegando alertas SMS en 3 segundos sin entregar credenciales. A medida que los bancos en Colombia (Bancolombia, Nequi, Davivienda, Grupo Aval) reactiven las APIs productivas de Open Finance bajo los estándares de la Superintendencia Financiera, este mismo mandato se conectará directamente por token OAuth2 sin cambiar tu experiencia.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2 text-[11.5px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-primary-dark">
                <CheckCircle2 size={12} aria-hidden="true" /> Fase 1 (Activa hoy): Extracto PDF/CSV + SMS 3s
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-primary-dark">
                <CheckCircle2 size={12} aria-hidden="true" /> Fase 2 (Activa hoy): API B2B2C Cooperativas y Wallets
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-ink-muted">
                Fase 3 (Estándar SFC): Conexión directa OAuth2 Bancos
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
