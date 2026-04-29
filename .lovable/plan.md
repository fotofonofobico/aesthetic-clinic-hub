## Problema

Il bottone **📱 Invia a tablet** esiste oggi solo nel launcher "Firma trattamento". Manca nei due punti principali della pagina paziente dove si avvia una firma:

1. **Tab Anamnesi** — accanto a "Firma e blocca" (che apre la sessione visita unificata: GDPR + uso immagini + anamnesi).
2. **Tab Consensi** — non esiste alcun avvio sessione visita; c'è solo "Nuovo consenso" puntuale.

## Cosa aggiungo

### 1. `src/components/paziente/anamnesi-panel.tsx`

Accanto al bottone esistente "Firma e blocca" (riga ~564), aggiungo `<SendToTabletButton>` con `buildSession` lazy che chiama `buildVisitaSession(pazienteId)`.

- Etichetta: **📱 Invia a tablet**.
- Disabilitato se `signing || forking` o `data.stato === "signed"`.
- `pazienteNome` ricavato dalle props (passo `nomeCognome` come nuova prop al panel — già disponibile in `pazienti.$id.tsx` dove leggo `paziente.nome` e `paziente.cognome`).
- `onCompleted`: ricarico l'anamnesi (`load()`) e chiamo `onSaved()`.

### 2. `src/components/paziente/consensi-panel.tsx`

Nell'header, accanto al bottone "Nuovo consenso", aggiungo una nuova zona **"Sessione di firma — Visita"** con:

- Bottone **Firma sul Mac** → apre `SignatureSessionDialog` con `buildVisitaSession(pazienteId)` (mostrato se la sessione contiene documenti).
- Bottone **📱 Invia a tablet** (`SendToTabletButton` con `buildSession` lazy).
- Toast "Tutti i consensi richiesti sono già validi" se la sessione costruita è vuota.

Aggiungo nuova prop `pazienteNome` al componente, passata da `pazienti.$id.tsx`.

### 3. `src/routes/_authenticated/pazienti.$id.tsx`

Passo `pazienteNome={`${paziente.nome} ${paziente.cognome}`}` ad `AnamnesiPanel` e `ConsensiPanel`.

## Note tecniche

- Riuso completo di `SendToTabletButton` esistente: gestisce già creazione sessione, `WaitForTabletDialog`, `MedicoFinalizeDialog`.
- Per Anamnesi e Consensi-Visita uso lo stesso `buildVisitaSession` già impiegato dall'anamnesi: una sola sessione coerente per entrambi i tab.
- Nessuna modifica a DB, a `signature-session-save.ts`, alla route `/firma`, alla sidebar.
- Tutti i bottoni rispettano gli stati di disabilita esistenti (saving, signed).

## Diff stimato

```text
src/components/paziente/anamnesi-panel.tsx   +12 / -1   (import + bottone)
src/components/paziente/consensi-panel.tsx   +60 / -2   (prop + nuova sezione visita)
src/routes/_authenticated/pazienti.$id.tsx   +2  / -2   (passa pazienteNome)
```
