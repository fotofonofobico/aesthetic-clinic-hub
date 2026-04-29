# Fix bug "Invia a tablet"

Tre problemi distinti, una causa comune di fondo (dialog Mac che si smonta troppo presto), più due problemi di UI sul tablet.

## Bug 1 — Mac non riceve la firma → loop apparente (causa principale)

**Cosa succede oggi.** Quando dentro `SignatureSessionDialog` (sul Mac) si clicca "Invia a tablet" del helper interno `OppureInviaTablet`, l'`onSent` chiama `onClose()` del dialog padre. Questo smonta `SignatureSessionDialog` e con esso anche il `SendToTabletButton` interno, che è l'unico componente che ha montato `WaitForTabletDialog` + `MedicoFinalizeDialog`. Risultato: l'iPad firma, scrive `stato=signed` su `firma_sessione`, ma sul Mac non c'è più nessun listener Realtime → nessun popup di finalizzazione, niente salvataggio. L'utente ripreme "Firma consenso", crea una NUOVA sessione, l'iPad la apre → sembra un loop.

**Fix.** Promuovere la gestione "invio a tablet" a livello del **chiamante** del `SignatureSessionDialog`, non dentro al dialog. Concretamente:

1. In `signature-session-dialog.tsx` rimuovere il helper interno `OppureInviaTablet` accanto ai trackpad. Al suo posto un bottone semplice "Invia a tablet" che invoca una nuova prop `onInviaTablet?: (session) => void`. Quando cliccato:
   - chiude il dialog locale (chiamando `onClose()`)
   - delega al genitore la creazione della sessione tablet

2. Aggiungere nei componenti chiamanti (sedute-panel, anamnesi-panel, consensi-panel, piani-panel, firma-trattamento-launcher) uno stato `tabletSession` e renderizzare **fuori** dal `SignatureSessionDialog` il `SendToTabletButton` "headless" — cioè un wrapper che riceve già la sessione costruita e apre direttamente i suoi `WaitForTabletDialog` e `MedicoFinalizeDialog`. Un piccolo componente `TabletSessionRunner` può incapsulare questa logica per non duplicarla.

3. Conseguenza: anche se il dialog locale si chiude, `TabletSessionRunner` resta montato → riceve l'evento Realtime `signed` → apre `MedicoFinalizeDialog` → l'utente conferma, viene chiamato `salvaSessioneFirme` + `marcaConsumed`. Loop risolto.

## Bug 2 — Pulsante X morto sul tablet

In `tablet-paziente-sign-dialog.tsx` il `<Dialog open={open}>` non ha `onOpenChange`, quindi il bottone X di shadcn (`DialogPrimitive.Close`) chiama un handler inesistente. In più non esiste alcun modo per il paziente di "passare" o per l'operatore di interrompere lato tablet.

**Fix.** Aggiungere `onOpenChange` al `Dialog` che, se l'utente chiude, chiama `rifiutaFirmaSessione(sessId, "Sessione interrotta dal tablet")` e poi `onCompleted()` per liberare la schermata. Mostrare un piccolo `AlertDialog` di conferma ("Sicuro di interrompere la sessione di firma?") prima di rifiutare, così un tocco accidentale non perde tutto.

## Bug 3 — Layout iPhone non si adatta

Cause:
- Il `DialogContent` standard ha `w-full max-w-lg`, ma il dialog usa `!max-w-3xl` (forza larghezza grande) → su iPhone la classe `w-full` lo riporta a 100% del viewport, ma con il padding fisso `px-6` e i bottoni `grid-cols-2` di altezza `min-h-[64px]` la viewport verticale diventa troppo piena.
- Il `SignaturePad` con `height={280}` ha un canvas con larghezza misurata in pixel al primo render: se la dialog è ancora in animazione la larghezza viene sottocalcolata → overflow orizzontale.
- Il pulsante X di shadcn si sovrappone al pulsante "Documento 1 di 1" del header custom.

**Fix UI.**
1. Rimuovere `!max-w-3xl` e usare `w-[100vw] sm:w-auto sm:max-w-3xl`, aggiungere `h-[100dvh] sm:h-auto sm:max-h-[95vh]` e `flex flex-col` per dare un layout a colonne (header / body scrollabile / footer fisso) — pattern "fullscreen su mobile, dialog su desktop".
2. Body con `flex-1 overflow-y-auto`, footer con `shrink-0`.
3. Sul mobile portare i due bottoni "Acconsento / Non acconsento" da `grid-cols-2` a `grid-cols-1 sm:grid-cols-2`, riducendo `min-h-[64px]` a `min-h-[56px]`.
4. SignaturePad: aggiungere un `ResizeObserver` (o `key={step}` + un breve `requestAnimationFrame`) per ridimensionare il canvas dopo il mount. Già esiste in `signature-pad.tsx`? Da verificare e se manca aggiungere ridisegno on-resize. In ogni caso ridurre `height` su mobile (es. `height={220}` con `sm:height={280}` via prop responsive o calcolata).
5. Spostare il bottone X del dialog: aggiungere `[&>button]:hidden` sul `DialogContent` per disabilitare il close shadcn nativo, e mettere un nostro bottone "Chiudi" nell'header custom, allineato a destra accanto al countdown.

## File toccati

- `src/components/signature-session-dialog.tsx` — rimuovere `OppureInviaTablet`, sostituire con bottone che chiama nuova prop `onInviaTablet`.
- `src/components/firma/tablet-paziente-sign-dialog.tsx` — fix layout responsive, X funzionante con conferma, rifiuto sessione.
- `src/components/firma/send-to-tablet-button.tsx` — esporre anche una variante "headless" (oppure aggiungere prop `autoStart`) che non renderizza il bottone ma solo i due dialog di attesa/finalizzazione, comandata da una sessione esterna.
- `src/components/paziente/sedute-panel.tsx`, `consensi-panel.tsx`, `anamnesi-panel.tsx`, `piani-panel.tsx`, `firma-trattamento-launcher.tsx` — montare il runner tablet a livello pannello e gestire `onInviaTablet` del SignatureSessionDialog.
- (eventuale) `src/components/signature-pad.tsx` — ridisegno canvas su resize se manca.

## Note

- Nessuna modifica al DB o alle Edge Function: la pipeline `firma_sessione` → Realtime → `salvaSessioneFirme` resta uguale, fixiamo solo il ciclo di vita lato React.
- L'X del tablet rifiuta la sessione (stato `refused`): il Mac la vede e chiude il `WaitForTabletDialog` mostrando "il paziente ha rifiutato".
