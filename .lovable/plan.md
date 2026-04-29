## Obiettivi

1. **Pulizia UI** nel dettaglio paziente / piani:
   - Rimuovere il bottone "Firma trattamento" dall'header paziente (lo si firma in seduta).
   - Eliminare il duplicato dell'alert "Consenso mancante" dentro l'accordion del piano: tenere solo quello con il pallino rosso accanto al singolo trattamento. Rimuovere quindi anche il pulsante "Firma consenso" della singola voce (la firma resta nel flusso seduta).

2. **Completare l'integrazione del modulo Foto Cliniche** (i 4 punti aperti dal turno precedente):
   - Sezione foto rapide PRIMA/DOPO in `consumo-step.tsx`.
   - Aggancio `FotoBaselineDialog` pre-seduta in `sedute-panel.tsx` quando si clicca "Esegui" e mancano foto baseline (non bloccante).
   - Toast post-completamento "Aggiungi foto DOPO?" con CTA che apre `FotoUploadDialog` (snooze 24h via localStorage).
   - Badge `FotoStatoBadge` accanto a ogni piano in `piani-panel.tsx` (header card piano).

## Modifiche file per file

### `src/routes/_authenticated/pazienti.$id.tsx`
- Rimuovere `<FirmaTrattamentoLauncher>` e relativo import nell'header (riga ~235).
- Lasciare solo "Firma visita & anamnesi" e "Modifica anagrafica".
- Nessun'altra modifica.

### `src/components/paziente/piani-panel.tsx`
- **Eliminare** il blocco `Alert` "Consenso mancante per N trattamento/i" (righe 1517–1528): è ridondante perché ogni voce mostra già il pallino rosso 🔴.
- **Eliminare** il bottone `Firma consenso` accanto alla singola voce (righe 1565–1576) — il pallino rosso resta come segnalazione, ma la firma viene fatta in seduta.
- **Aggiungere** `<FotoStatoBadge piano_id={p.id} />` accanto al badge stato del piano nell'header della card piano.
- Import: aggiungere `FotoStatoBadge`.

### `src/components/paziente/sedute-panel.tsx`
- Aggiungere stato locale `baselineDialog: { piano_id, paziente_id, sedutaToExec } | null` e `uploadDopoDialog: { … } | null`.
- Wrappare `onEsegui` della `SedutaCard`: prima di chiamare l'esecuzione, controllare `getStatoPiano(piano_id)`; se `stato === "baseline_mancante"` e non c'è snooze in `localStorage` (`foto-baseline-snooze:{piano_id}` < 24h), aprire `FotoBaselineDialog` con:
  - `onProcedi` → setta snooze 24h e prosegue con esecuzione originale.
  - `onCarica` → apre `FotoUploadDialog` precompilato (livello piano, momento `prima`).
  - `onNonEseguibile` → chiude tutto, ricarica.
- Dopo il `salva()` di `EseguiSedutaDialog` (riga 830), invece del solo `toast.success`, mostrare un toast con action "Aggiungi foto DOPO?" che apre `FotoUploadDialog` precompilato (livello seduta, momento `dopo`, `seduta_id` corrente, `data_scatto` = oggi). Snooze opzionale via dismiss.
- Import: `FotoBaselineDialog`, `FotoUploadDialog`, `getStatoPiano`.

### `src/components/magazzino/consumo-step.tsx`
- Aggiungere in fondo allo step una sezione compatta `Foto seduta (opzionale)` con due bottoni:
  - `+ PRIMA` → apre `FotoUploadDialog` con `momento="prima"`, `seduta_id`, `piano_id`, `paziente_id` precompilati.
  - `+ DOPO` → idem con `momento="dopo"`.
- Sotto i bottoni mostrare le miniature delle foto già caricate per quella seduta (riuso `FotoGrid` con filtro `seduta_id`).
- Nessun blocco operativo.

### `src/components/foto/foto-upload-dialog.tsx`
- Verificare che accetti props per pre-impostare `livello`/`seduta_id`/`momento` di default (probabilmente già supportato — se mancano default opzionali, aggiungerli).

## Comportamento atteso

- Header paziente: solo `Firma visita & anamnesi` e `Modifica anagrafica`.
- Card piano: badge stato piano + badge stato foto. Niente più alert duplicato consenso, solo pallini per voce.
- "Esegui seduta" su un piano con baseline mancante → dialog non bloccante (Procedi / Carica baseline / Non eseguibile [solo medico]).
- Completata la seduta → toast con CTA per upload foto DOPO.
- In `consumo-step` (durante esecuzione) → due bottoni rapidi PRIMA/DOPO + griglia foto della seduta.

## Punti che NON faccio

- Non tocco la logica di firma trattamento dentro la seduta (resta dov'è).
- Non tocco le RLS / migration foto (già in DB).
- Lascio invariato il pallino verde "Consenso ok" per coerenza visiva.

Procedo all'implementazione quando approvi.