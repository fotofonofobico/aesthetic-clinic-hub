## Cosa cambia

**Principio**: ovunque compaia il **trackpad bianco** per firmare (paziente o medico), deve esserci subito accanto un'alternativa **"Invia a tablet"** che chiude il flusso locale e delega la firma al device in modalità firma. Inoltre rimuovo le doppie esposizioni del bottone fatte nello step precedente in `AnamnesiPanel` / `ConsensiPanel` (header), perché vanno **dentro** ai dialog di firma, non fuori.

### 1. Rinomina universale del bottone
Tutte le occorrenze di **"📱 Invia a tablet"** diventano **"Invia a tablet"** (l'icona `Tablet` di lucide è già nel `SendToTabletButton`).

### 2. Rimozione bottoni dagli header dei panel paziente
- `src/components/paziente/anamnesi-panel.tsx`: rimuovo il `SendToTabletButton` aggiunto accanto a "Firma e blocca" nell'header.
- `src/components/paziente/consensi-panel.tsx`: rimuovo l'intera sezione "Sessione visita" (sia "Firma sul Mac" sia "Invia a tablet") nell'header.
- La prop `pazienteNome` resta in entrambi i panel — la useremo nei punti inline (vedi 4 e 5).

### 3. "Invia a tablet" dentro `SignatureSessionDialog`
File: `src/components/signature-session-dialog.tsx`.

In ognuna delle tre fasi che mostrano un `SignaturePad` (consensi combinati, anamnesi singolo, trattamento singolo), aggiungo subito sotto il pad una riga separatore con testo "oppure" e un `<SendToTabletButton>` che:
- usa `buildSession={async () => session}` (passa la stessa sessione corrente);
- `pazienteNome` ricavato dalla sessione (passata già al dialog);
- `onSent`: chiude il dialog locale (`onClose()`) — la finalizzazione avverrà via `MedicoFinalizeDialog` aperto dal SendToTabletButton stesso;
- `onCompleted`: invoca l'`onCompleted()` del dialog per aggiornare i panel a monte.

Il dialog locale viene chiuso appena la sessione tablet è creata, così non ci sono due flussi sovrapposti.

Il `pazienteNome` non è in `SignatureSession`: aggiungo una prop opzionale `pazienteNome?: string` al componente `SignatureSessionDialog` (default ricavato come stringa vuota → fallback "Paziente"); viene passato dai chiamanti (`AnamnesiPanel`, `ConsensiPanel`, `SeduteList`, `PianiPanel`, `FirmaTrattamentoLauncher`).

### 4. "Invia a tablet" accanto al `SignaturePad` inline in `consensi-panel.tsx`
Riga ~857 (firma del singolo consenso compilato inline, fuori dal SessionDialog). Aggiungo `SendToTabletButton` con una `buildSession` lazy che costruisce una mini-sessione monodocumento per quel consenso (riusando la riga di template già caricata). Su `onSent` chiudo il dialog/sezione di firma inline. `onCompleted` ricarica.

### 5. "Invia a tablet" accanto ai `SignaturePad` di `anamnesi-panel.tsx` (righe 1017–1023)
Sezione di firma anamnesi inline (paziente + medico). Aggiungo `SendToTabletButton` con `buildSession` che ritorna `buildVisitaSession(pazienteId)` (già usato qui). Su `onSent` chiude la sezione di firma; `onCompleted` ricarica.

### 6. `sedute-panel.tsx` e `piani-panel.tsx` e `firma-trattamento-launcher.tsx`
Usano già `SignatureSessionDialog`. Coperti automaticamente dal punto 3. Devo solo:
- passare `pazienteNome` al dialog dove disponibile;
- rinominare eventuali stringhe "📱 Invia a tablet" → "Invia a tablet" se presenti come bottoni esterni nel launcher.

## Note tecniche

- `SendToTabletButton` è già self-contained: gestisce creazione sessione, `WaitForTabletDialog`, `MedicoFinalizeDialog`. Riutilizzato così com'è.
- Nessuna modifica DB, edge functions, RLS, route, sidebar, types.
- Nessun cambio al `SignaturePad`.

## File modificati (stima)

```text
src/components/signature-session-dialog.tsx          +70  (3 blocchi "oppure invia a tablet" + prop pazienteNome)
src/components/paziente/anamnesi-panel.tsx           +12 / -8   (rimozione header bottone, aggiunta inline pad, pass-through)
src/components/paziente/consensi-panel.tsx           +15 / -55  (rimozione sezione visita header, aggiunta inline pad, pass-through)
src/components/paziente/sedute-panel.tsx             +1         (passa pazienteNome al dialog)
src/components/paziente/piani-panel.tsx              +1         (passa pazienteNome al dialog)
src/components/firma-trattamento-launcher.tsx        +2 / -1    (passa pazienteNome + rinomina)
```

## Risultato per l'utente

Ogni volta che vede il **trackpad bianco** — sia nel SessionDialog (visita/trattamento), sia nel form anamnesi inline, sia nella firma di un singolo consenso — trova subito sotto un bottone "Invia a tablet" che trasferisce la firma al device del paziente. I bottoni nell'header dei tab Anamnesi/Consensi spariscono.