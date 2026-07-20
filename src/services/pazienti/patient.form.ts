import type { Paziente, Sesso } from "@/types/clinico";

/**
 * Form Model per l'anagrafica paziente (pazienti.$id.edit.tsx).
 * Distinto dal Domain Model (`Paziente`): rappresenta solo i campi
 * editabili dal form, nella forma prodotta dai controlli UI (stringhe,
 * mai `undefined`; `null` solo dove il form lo usa esplicitamente come
 * valore "non impostato": sesso, data_nascita, studio_id).
 */
export interface PazienteFormValues {
  nome: string;
  cognome: string;
  sesso: Sesso | null;
  data_nascita: string | null;
  luogo_nascita: string;
  codice_fiscale: string;
  email: string;
  telefono: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
  professione: string;
  note: string;
  studio_id: string | null;
}

/** Payload pronto per l'insert/update Supabase sulla tabella `pazienti`. */
export interface PazienteWritePayload {
  nome: string;
  cognome: string;
  sesso: Sesso | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  codice_fiscale: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  professione: string | null;
  note: string | null;
  studio_id: string | null;
}

/** Mapper Domain → Form: valori di un paziente esistente pronti per il form. */
export function pazienteToFormValues(paziente: Paziente): PazienteFormValues {
  return {
    nome: paziente.nome ?? "",
    cognome: paziente.cognome ?? "",
    sesso: paziente.sesso,
    data_nascita: paziente.data_nascita,
    luogo_nascita: paziente.luogo_nascita ?? "",
    codice_fiscale: paziente.codice_fiscale ?? "",
    email: paziente.email ?? "",
    telefono: paziente.telefono ?? "",
    indirizzo: paziente.indirizzo ?? "",
    citta: paziente.citta ?? "",
    cap: paziente.cap ?? "",
    provincia: paziente.provincia ?? "",
    professione: paziente.professione ?? "",
    note: paziente.note ?? "",
    studio_id: paziente.studio_id,
  };
}

/**
 * Mapper Form → Domain: costruisce il payload di persistenza a partire dai
 * valori del form (trim e normalizzazione a `null` per i campi vuoti,
 * stessa logica già presente in precedenza nel componente).
 *
 * Il codice fiscale non viene validato/normalizzato qui: il chiamante deve
 * passare il valore già elaborato dalla logica di validazione esistente
 * (invariata, rimasta nel componente) prima di invocare questo mapper.
 */
export function formValuesToPazientePayload(values: PazienteFormValues): PazienteWritePayload {
  return {
    nome: values.nome.trim(),
    cognome: values.cognome.trim(),
    sesso: values.sesso ?? null,
    data_nascita: values.data_nascita || null,
    luogo_nascita: values.luogo_nascita?.trim() || null,
    codice_fiscale: values.codice_fiscale?.trim() || null,
    email: values.email?.trim() || null,
    telefono: values.telefono?.trim() || null,
    indirizzo: values.indirizzo?.trim() || null,
    citta: values.citta?.trim() || null,
    cap: values.cap?.trim() || null,
    provincia: values.provincia?.trim().toUpperCase() || null,
    professione: values.professione?.trim() || null,
    note: values.note?.trim() || null,
    studio_id: values.studio_id ?? null,
  };
}
