// Logger minimale: warn/debug silenziati in produzione, error sempre attivo.
//
// REGOLA D'USO (vincolante):
// `logger.error` deve ricevere SOLO una label sintetica + l'oggetto Error
// (o {code, message, details} per errori Supabase). MAI passare payload completi,
// oggetti paziente/consenso/seduta/anamnesi o body di insert: rischio PII.
const isDev = import.meta.env.DEV;

export const logger = {
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
};
