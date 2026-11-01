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
  'view_cifra',
  'ask_spend',
  'begin_lead',
  'generate_lead',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export const VISITOR_COOKIE = 'cf_vid';
export const VARIANT_COOKIE = 'cf_ab';
export const UTM_COOKIE = 'cf_utm';
export const CONSENT_COOKIE = 'cf_consent';

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type Variant = 'A' | 'B';
