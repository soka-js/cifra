/** Eventos que se aceptan. Todo lo demás se ignora para que nadie llene la tabla con basura. */
export const EVENT_NAMES = [
  'page_view',
  'click_cta',
  'scroll_depth',
  'engaged_time',
  'faq_open',
  'begin_signup',
  'sign_up',
  'begin_import',
  'import_statement',
  'quick_start',
  'update_balance',
  'view_cifra',
  'ask_spend',
  'reclassify_category',
  'cancel_recurring',
  'generate_offer_code',
  'redeem_offer',
  'close_cycle',
  'demo_enter',
  'begin_lead',
  'generate_lead',
  'quick_capture',
  'merchant_ledger_add',
  'launch_flash_offer',
  // Prueba sin cuenta en la página pública. Nunca llevan montos.
  'try_cifra_start',
  'try_cifra_done',
  'try_cifra_save',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Eventos que en GA4 están marcados como eventos clave. */
export type GaKeyEvent = 'sign_up' | 'generate_lead' | 'import_statement' | 'quick_start';

export const VISITOR_COOKIE = 'cf_vid';
export const VARIANT_COOKIE = 'cf_ab';
export const UTM_COOKIE = 'cf_utm';
export const CONSENT_COOKIE = 'cf_consent';

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type Variant = 'A' | 'B';
