# Modalità firma su tablet

Il medico lavora dal Mac. Quando deve far firmare un documento al paziente, clicca **"📱 Invia a tablet"**: l'iPad (sempre loggato come lo stesso medico) esce dallo schermo di attesa, mostra il documento con caselle "Acconsento/Non acconsento" + canvas firma. Quando il paziente conferma, il Mac riceve l'evento in tempo reale e — se il documento richiede firma medico — apre un piccolo dialog dedicato per apporla. Il salvataggio finale (PDF, hash, snapshot RLS) usa la pipeline esistente.

## Cosa è già pronto

- Tabella `firma_sessione` (tipo, target_id, payload, stato `pending|signed|refused|expired|cancelled`, scadenza 15 min, realtime attivo, RLS).
- `src/lib/firma-sessione.ts`: helper `creaFirmaSessione`, `salvaRispostePaziente`, `rifiutaFirmaSessione`, `annullaFirmaSessione`, `marcaConsumed`, hook `useFirmaSessione` (singola sessione realtime), `useSessioniInArrivo` (lista per il tablet).

## Cosa costruire ora

### 1. Componenti Mac (lato medico)

**`src/components/firma/wait-for-tablet-dialog.tsx`** — dialog "In attesa di firma sul tablet"
- Header con nome paziente + tipo documento.
- Spinner + countdown 15:00 → 0:00 (calcolato da `expires_at`).
- Stato realtime: `pending` → "In attesa che il paziente firmi", `signed` → chiude e apre il finalize, `refused` → mostra motivo + "Chiudi", `expired` → "Sessione scaduta, riprova".
- Bottone **Annulla sessione** (chiama `annullaFirmaSessione` → l'iPad torna in attesa).
- Riceve `sessionId` e callback `onSigned(risposte, sessionRow)` / `onCancel`.

**`src/components/firma/medico-finalize-dialog.tsx`** — finalizzazione sul Mac
- Apre quando l'iPad ha firmato. Mostra elenco documenti firmati dal paziente con scelte (✓ Acconsento / ✗ Non acconsento).
- Per ogni documento che richiede firma medico → un canvas firma medico distinto.
- Bottone "Conferma e salva". Riusa la **stessa logica di salvataggio** già presente in `SignatureSessionDialog.salvaTutto()` — la estraiamo in una funzione esportata `salvaSessioneFirme(session, finalDocs, user, paziente)` nel file `lib/signature-session-save.ts` per riusarla sia dal flusso locale che da quello tablet.
- A fine salvataggio chiama `marcaConsumed(sessionId)` e `onCompleted()`.

**Bottone "Invia a tablet"** nei tre punti esistenti:
- `src/components/firma-trattamento-launcher.tsx`
- `src/components/paziente/consensi-panel.tsx` (sezione "Avvia sessione di firma — Visita")
- `src/components/paziente/anamnesi-panel.tsx`

In ognuno: accanto al bottone esistente "Apri sessione firma" aggiungiamo `<Button variant="outline">📱 Invia a tablet</Button>`. Crea la sessione con `creaFirmaSessione`, apre `WaitForTabletDialog`, poi `MedicoFinalizeDialog`.

### 2. Modalità tablet (lato iPad)

**`src/routes/_authenticated/firma.tsx`** — route protetta ma fullscreen senza sidebar
- Usa un layout proprio (non `AppLayout`): sfondo soft brand, logo studio centrato, titolo grande "Modalità firma".
- Sotto: nome del medico loggato + "Pronto a ricevere documenti" + indicatore di connessione realtime.
- Bottone "Esci dalla modalità firma" in alto a destra (torna a `/dashboard`).
- Hook `useSessioniInArrivo(user.id)` → quando arriva una sessione `pending`, apre automaticamente `TabletPazienteSignDialog` con quella sessione.

**`src/components/firma/tablet-paziente-sign-dialog.tsx`** — UI firma paziente
- Dialog fullscreen. Mostra in sequenza i documenti del payload.
- Per ogni doc: titolo grande, testo scrollabile, **due bottoni grandi tap-friendly "Acconsento" / "Non acconsento"** (touch-target ≥ 56px).
- Dopo la scelta sull'ultimo doc, una **firma unica** sul canvas grande (riusa `SignaturePad` con `height=320`).
- Bottoni grandi "Conferma firma" / "Annulla" / "Indietro".
- Vincolo: GDPR rifiutato → blocca con messaggio.
- Su conferma → `salvaRispostePaziente(id, risposte)`. Su rifiuto totale → `rifiutaFirmaSessione`.
- Timer di scadenza visibile in alto.

### 3. Sidebar

Aggiungo voce **"Modalità firma"** (icona `Tablet` da lucide) nel menu principale di `src/components/app-layout.tsx`, prima di "Impostazioni".

## Flusso completo

```text
MAC                                    DB                              IPAD (/firma)
 │                                      │                               │
 │ Click "Invia a tablet"               │                               │  Schermo attesa
 ├─ creaFirmaSessione(session) ────────►│ INSERT pending                │
 │                                      │ ─── realtime ────────────────►│  Apre TabletDialog
 │ WaitDialog (countdown 15 min)        │                               │  Paziente sceglie + firma
 │                                      │ ◄─── salvaRispostePaziente ───┤  
 │                                      │ UPDATE signed                  │  Torna a schermo attesa
 │ ◄─── realtime UPDATE ─────────────── │                                │
 │ MedicoFinalizeDialog                 │                                │
 │  - mostra scelte paziente            │                                │
 │  - canvas firma medico (se serve)    │                                │
 │ Click "Conferma e salva"             │                                │
 ├─ salvaSessioneFirme() ──────────────►│ INSERT consenso_firmato +      │
 │                                      │ UPDATE anamnesi (logica esist.)│
 ├─ marcaConsumed(sessionId) ──────────►│ UPDATE consumed_at             │
 │ Toast "Firmato"                      │                                │
```

## Note tecniche

- **Riuso massimo**: la funzione di salvataggio finale (PDF + hash + insert RLS-compliant) viene **estratta** dall'attuale `SignatureSessionDialog` in un modulo `lib/signature-session-save.ts`. Sia il dialog locale che `MedicoFinalizeDialog` la chiamano. Zero duplicazione di logica critica.
- **Sicurezza pairing**: nessun QR code/link pubblico. L'iPad è già autenticato come operatore attivo. La sessione è visibile a tutti gli operatori attivi (RLS), ma in pratica il tablet filtra per `created_by = current_user`, quindi un medico vede solo le proprie richieste. Per studi multi-medico in futuro: aggiungere `device_pairing_code`.
- **Scadenza**: il countdown è client-side dal campo `expires_at`. La RPC `firma_sessione_marca_scadute` può essere chiamata on-demand o via cron futuro.
- **Firma medico**: come da decisione, il dialog dedicato sul Mac appare automaticamente subito dopo la firma del paziente, con solo i canvas necessari.
- **Build pulito**: tutti i nuovi file restano sotto le 250 righe; `signature-session-save.ts` riceverà ~150 righe estratte da `signature-session-dialog.tsx` (il dialog esistente continua a funzionare invariato).
