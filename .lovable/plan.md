
# Piano operativo

Tre blocchi di lavoro, in quest'ordine: **(A) Fix bloccanti** → **(B) Signature Session** → **(C) Fallback cartaceo + condivisione**.

Nessuna modifica alla struttura dati esistente di anamnesi/consensi/versioning. Solo un fix DB necessario (rimozione di un vincolo legacy che blocca proprio il versioning) e nuove tabelle accessorie per condivisione/upload cartaceo.

---

## A. FIX BLOCCANTI

### A1. Errore "duplicate key … anamnesi_paziente_id_key" alla modifica di un'anamnesi firmata

Causa: la tabella `anamnesi` ha ancora il vincolo legacy `UNIQUE (paziente_id)`, eredità del vecchio modello "1 anamnesi per paziente". Il fork in nuova versione inserisce una seconda riga e va in conflitto.

Migration:
- `ALTER TABLE public.anamnesi DROP CONSTRAINT anamnesi_paziente_id_key;`
- Aggiunge un indice unico parziale per evitare DRAFT multipli concorrenti per lo stesso paziente:
  `CREATE UNIQUE INDEX anamnesi_one_draft_per_paziente ON public.anamnesi(paziente_id) WHERE stato = 'draft';`
- Indice di supporto: `CREATE INDEX anamnesi_paziente_stato_idx ON public.anamnesi(paziente_id, stato);`

Effetto: il versioning funziona, restano protette dalle anomalie più di una bozza in parallelo.

### A2. Login "in crash" / utente non entra subito

Causa: in `auth-context.tsx`:
1. `setIsLoading(false)` viene chiamato dentro `getSession().then(...)` PRIMA che `loadRoles` finisca, quindi `_authenticated.tsx` può eseguire il redirect a `/login` mentre la sessione è in corso di idratazione (race su mount iniziale).
2. Il listener `onAuthStateChange` resetta `session` e schedula `loadRoles` in `setTimeout`, generando un breve frame con `isAuthenticated=true` ma `roles=[]` (componenti che usano `hasRole` mostrano UI sbagliata o reindirizzano).

Fix (solo `src/lib/auth-context.tsx`, nessun cambio API):
- Mantieni `isLoading=true` finché: (a) `getSession` ha risposto, (b) se c'è una sessione, `loadRoles` ha completato almeno una volta.
- Nel listener, aggiorna `session/user` immediatamente ma azzera `isLoading` solo dopo il primo bootstrap.
- Rimuovi il `setTimeout(0)` superfluo (era un workaround per deadlock che non serve sui client moderni di supabase-js v2; usiamo invece `void` direttamente).
- In `_authenticated.tsx`: già rispetta `isLoading`, nessun cambio necessario.

---

## B. SIGNATURE SESSION SYSTEM

Solo orchestrazione frontend. Nessuna nuova tabella, nessun nuovo trigger.

### B1. Modello logico (in memoria)

Nuovo modulo `src/lib/signature-session.ts`:

```ts
type DocKind =
  | { kind: 'gdpr', templateId: string }
  | { kind: 'uso_immagini', templateId: string }
  | { kind: 'anamnesi', anamnesiId: string, versione: number }
  | { kind: 'trattamento', templateId: string, trattamentoId: string, sedutaId?: string };

interface SessionDoc {
  id: string;          // uuid locale
  kind: DocKind;
  titolo: string;
  testo: string;       // snapshot per rendering
  versione: string;
  richiedeFirmaMedico: boolean;
  // stato runtime
  scelta?: 'acconsento' | 'non_acconsento';   // nessuna preselezione
  firmaPaziente?: string; // dataURL
  firmaMedico?: string;
  completato: boolean;
}

interface SignatureSession {
  tipo: 'visita' | 'trattamento';
  pazienteId: string;
  trattamentiSelezionati?: string[]; // solo 'trattamento'
  documenti: SessionDoc[];
  indiceCorrente: number;
}
```

### B2. Builder sessione

Funzioni pure (no UI):

- `buildVisitaSession(pazienteId)`:
  1. Carica `paziente_consensi_stato` + ultima anamnesi.
  2. Include GDPR se `ultimoPerCategoria('gdpr')` è null o `stato !== 'valid'`.
  3. Include Uso immagini se mai espresso o se template attivo è di versione diversa dall'ultima firma.
  4. Include anamnesi se ultima è in `draft` o esiste un draft più recente di una signed.
  5. Ordine fisso: GDPR → uso_immagini → anamnesi.
  6. Se la lista è vuota → ritorna `null` (nessuna firma necessaria), il chiamante mostra toast.

- `buildTrattamentoSession(pazienteId, trattamentoIds[])`:
  1. Per ogni `trattamentoId`, scarica i template di consenso attivi collegati.
  2. Per ogni template, chiama `has_consenso_valido(paziente, template)`. Se `true` → skip.
  3. Se trattamento è categoria "ciclo": una sola firma, `validita_mesi` dal template (default 12) → calcolato lato salvataggio.
  4. Se "singolo": una firma per seduta in arrivo (legare `seduta_id` a momento del salvataggio).
  5. Dedup per `templateId` quando più sedute dello stesso trattamento richiedono lo stesso consenso.

### B3. Esecutore sessione (UI)

Nuovo componente `src/components/signature-session-dialog.tsx`:

- Un solo Dialog full-screen su mobile/tablet con stepper: 1/N, 2/N, …
- Per ogni `SessionDoc`:
  - **STEP 1**: contenuto consenso (titolo + testo + versione) in scroll.
  - **STEP 2**: scelta obbligatoria con `RadioGroup` (Acconsento / Non acconsento), nessuna preselezione.
  - **STEP 3**: `SignaturePad` paziente (obbligatoria se Acconsento).
  - **STEP 4**: `SignaturePad` medico se `richiedeFirmaMedico` (solo se Acconsento).
  - **STEP 5**: pulsanti "Conferma firma" / "Ripeti firma".
- Bottone "Avanti" disabilitato se: scelta non fatta, oppure scelta=Acconsento e firma paziente vuota.
- "Non acconsento" è ammesso ma porta al documento successivo con flag `rifiutato=true` per quel record.
- Bottone "Annulla sessione" abbandona TUTTO senza salvare nulla (transazione client-side).

### B4. Persistenza fine sessione

Solo dopo che TUTTI i documenti sono `completato=true`, il dialog esegue le scritture in batch:

- Per ogni `gdpr / uso_immagini / trattamento` doc → INSERT in `consenso_firmato` (riusa logica già esistente: snapshot testo/versione, hash, valido_fino_a calcolato dal helper, `seduta_id` per singoli, `firma_immagine`, `firma_medico_immagine`, `rifiutato`).
- Per `anamnesi` → riusa `firmaAnamnesi` esistente (PDF + hash + signed). Se la corrente è `signed` + esistono modifiche → il fork è già stato fatto in fase di edit (v. A1), qui la sessione si limita a passare il dataURL firma e completare.
- Generazione PDF per ogni consenso firmato (usa `pdf-consenso.ts` esistente) e upload nel bucket `consensi-pdf`.
- Se una insert fallisce a metà → rollback "best effort": cancellazione delle insert già effettuate in questa sessione (raccolte in array di id) prima di propagare l'errore. Toast errore, sessione resta aperta.

### B5. Trigger UI

In `src/routes/_authenticated/pazienti.$id.tsx`, due pulsanti nella header del paziente:
- **Firma visita** → apre `SignatureSessionDialog` con `buildVisitaSession`. Se non c'è nulla da firmare: toast info "Tutto in regola".
- **Firma trattamento** → prima un piccolo dialog per scegliere quali trattamenti del piano firmare (checkbox sui trattamenti dei piani attivi), poi apre la sessione.

In `piani-panel.tsx`, prima di creare una seduta, se `puoEseguireTrattamento` ritorna `mancanti.length > 0`, invece di solo bloccare → propone "Firma ora" che apre direttamente la sessione trattamento per quel trattamento.

### B6. Comportamenti vietati garantiti dal builder

- Anamnesi firmata e non modificata → non rientra mai (filtro su stato + assenza di draft più recente).
- Consenso valido → mai reincluso (filtro su `has_consenso_valido`).
- Trattamento ciclo attivo → mai re-richiesto (consenso `trattamento_ciclo` con `valido_fino_a > now()` viene saltato).
- Nessun dialog separato chiede firme fuori dalla sessione: i dialog "Nuovo consenso" e "Firma e blocca" anamnesi restano per i casi avanzati/manuali ma in flusso normale si usa Signature Session.

---

## C. FALLBACK CARTACEO + CONDIVISIONE

### C1. Stampa consenso (PDF non firmato)

- Ogni `ConsensoTemplate` può generare un PDF "vuoto" pronto per la firma cartacea: estende `pdf-consenso.ts` con funzione `generaPdfConsensoVuoto({ paziente, template })`.
- Layout identico al firmato, con righe vuote dove andrebbero firme + spazio per spunta "Acconsento / Non acconsento" + data + nome operatore.
- Pulsante "Stampa consenso" nel dialog NuovoConsenso e nella lista template (`/consensi`).

### C2. Upload consenso cartaceo firmato

Riusa lo schema esistente: `consenso_firmato` con `modalita_firma='pdf_caricato'` e `pdf_url` già supportati. Aggiunte:

- Nel form upload (consensi-panel.tsx → NuovoConsensoDialog modalità `pdf_caricato`):
  - Campo **Acconsento / Non acconsento** obbligatorio (Radio) → mappato su `rifiutato`.
  - Campo **Data firma manuale** (default oggi) → scrive `firmato_il`.
  - Campo **Operatore presente** (auto: utente loggato, modificabile) → `operatore_testimone`.
  - Validazione: PDF obbligatorio, scelta obbligatoria, data ≤ oggi.
- Stato calcolato → `valid` se completo, esattamente come digitale (la RPC `paziente_consensi_stato` non distingue, già OK).

### C3. Anamnesi cartacea

Stesso pattern: estende `pdf-anamnesi.ts` con `generaPdfAnamnesiVuoto({ paziente, versione })`. Pulsante "Stampa anamnesi" nel pannello anamnesi. Upload del PDF firmato cartaceo va su un nuovo flusso "Carica anamnesi firmata":
- richiede selezione del draft corrente,
- scrive `pdf_url`, `firmata_il`, `stato='signed'`, `hash_integrita` calcolato sul file,
- non popola `firma_paziente` (nessuna immagine), il PDF stesso è la prova.

### C4. Condivisione consensi (email + link sicuro)

Nuova tabella `consenso_share_link`:
```sql
CREATE TABLE public.consenso_share_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consenso_id uuid NOT NULL REFERENCES public.consenso_firmato(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,           -- 32 bytes random base64url
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE TABLE public.consenso_share_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.consenso_share_link(id) ON DELETE CASCADE,
  ip text, user_agent text, accessed_at timestamptz NOT NULL DEFAULT now()
);
```
RLS:
- `consenso_share_link`: SELECT/INSERT/UPDATE solo per operatori attivi; nessuna policy public.
- Validazione + lettura per anonimi gestita da una **edge function** `consenso-share` che verifica token + scadenza, logga l'accesso e restituisce l'URL firmato del PDF (bucket `consensi-pdf`).

UI:
- Nel viewer di un consenso firmato (consensi-panel.tsx, dialog `viewing`), tre azioni:
  - **Invia per email**: chiama edge function `send-consenso-email` (usa Lovable Email se domain configurato, altrimenti Resend connector). Allega/linka il PDF firmato; richiede `paziente.email`.
  - **Crea link sicuro**: form per scegliere durata (1/7/30 giorni), genera token, copia URL `https://<app>/consenso/<token>` negli appunti.
  - **Revoca link**: lista dei link attivi con bottone revoca.

Route pubblica `/consenso/$token` (file route TanStack non-autenticato): chiama edge function, mostra metadati consenso + visualizzatore PDF inline + indicazione di scadenza.

### C5. Convivenza cartaceo/digitale

Già garantita: la RPC `paziente_consensi_stato` calcola lo stato indipendentemente da `modalita_firma`. Il guard `evaluateAccess` legge solo lo stato. Nessuna distinzione downstream.

---

## File toccati / creati

**Migration**
- `supabase/migrations/<ts>_anamnesi_unique_fix_and_share.sql`
  - drop unique `anamnesi_paziente_id_key`
  - unique parziale draft + index supporto
  - tabelle `consenso_share_link`, `consenso_share_access_log` + RLS

**Backend**
- `supabase/functions/consenso-share/index.ts` (verifica token, ritorna PDF firmato signed URL, logga accesso)
- `supabase/functions/send-consenso-email/index.ts` (invio email con link/allegato)

**Frontend nuovi**
- `src/lib/signature-session.ts` (builder + tipi)
- `src/components/signature-session-dialog.tsx` (UI sessione)
- `src/routes/consenso.$token.tsx` (route pubblica)

**Frontend modificati**
- `src/lib/auth-context.tsx` (fix race isLoading/loadRoles)
- `src/lib/pdf-consenso.ts` (+ `generaPdfConsensoVuoto`)
- `src/lib/pdf-anamnesi.ts` (+ `generaPdfAnamnesiVuoto`)
- `src/components/paziente/consensi-panel.tsx` (campi cartaceo: scelta+data+operatore; azioni share/email; pulsante stampa)
- `src/components/paziente/anamnesi-panel.tsx` (pulsante stampa + upload cartaceo, integrazione signature session opzionale)
- `src/components/paziente/piani-panel.tsx` (CTA "Firma ora" quando bloccato)
- `src/routes/_authenticated/pazienti.$id.tsx` (pulsanti "Firma visita" / "Firma trattamento")
- `src/routes/_authenticated/consensi.index.tsx` (pulsante "Stampa modello vuoto" per template)

---

## Flussi finali

**Visita**: medico clicca "Firma visita" → dialog elenca solo i documenti necessari (es. solo Anamnesi se GDPR/uso immagini già validi) → scelta + firma per ognuno → "Completa e salva" → tutto archiviato in transazione, paziente sblocca eventuali blocchi pendenti.

**Pre-trattamento**: medico apre piano → seleziona uno o più trattamenti → "Firma trattamento" → builder genera SOLO i consensi mancanti (cicli attivi saltati) → flusso firma → consensi creati, sedute creabili.

**Cartaceo**: stampa PDF vuoto, paziente firma su carta, operatore carica PDF + indica scelta + data → consenso entra in archivio identico a quello digitale.

**Condivisione**: operatore apre consenso firmato → "Invia email" o "Crea link sicuro 7gg" → paziente riceve link → edge function valida token → PDF visualizzabile, accesso loggato.
