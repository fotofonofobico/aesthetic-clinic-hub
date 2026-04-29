Propongo di risolverla così: togliamo rumore dalla testata paziente, spostiamo le azioni nel punto giusto e sistemiamo la logica che tiene acceso l’avviso “consenso mancante”.

## Cosa cambio

1. **Rimuovere i pulsanti dalla testata paziente**
   - Tolgo da in alto:
     - “Firma visita & anamnesi”
     - “Modifica anagrafica”
   - La testata rimane pulita: nome, età, sesso e dati essenziali del paziente.

2. **Spostare “Modifica anagrafica” nella sezione Anagrafica**
   - Dentro la tab “Anagrafica” aggiungo un pulsante “Modifica anagrafica”.
   - In questo modo l’azione resta dove ha senso trovarla, senza occupare spazio sopra.

3. **Eliminare il concetto di firma “visita & anamnesi” come pulsante globale**
   - L’anamnesi resta firmabile dalla sezione “Anamnesi”, che è il contesto corretto.
   - Il GDPR/Privacy continua a essere incluso nel flusso di firma anamnesi quando serve.
   - Per i consensi trattamento resta la sezione “Consensi” e/o il flusso dalla seduta/piano.
   - Quindi niente pulsante generico in alto che rischia di far firmare “un pacchetto” non chiaro.

4. **Fix dell’alert “Consenso mancante nei piani” che resta anche dopo firma**
   - Attualmente l’alert in alto usa `puoEseguireTrattamento`, che controlla il consenso collegato in modo diverso rispetto a come viene creato/salvato in alcuni flussi.
   - Uniformo la logica in modo che il controllo usi il consenso realmente collegato al trattamento.
   - Dopo una firma completata, forzo il ricalcolo dello stato consensi e aggiorno anche i badge dentro “Piani”.
   - Se il consenso esiste ed è valido, l’alert sparisce.

5. **Correggere la pagina tablet dopo “firma inviata al medico”**
   - Dopo la conferma firma sul tablet, la pagina deve tornare alla schermata di attesa “Modalità firma”, non riaprire la stessa sessione o tornare al primo step.
   - Aggiungo un meccanismo locale per ignorare subito la sessione appena completata, anche se il backend impiega qualche istante a marcarla come consumata dal Mac.
   - Risultato: il paziente vede la home della firma/attesa, senza loop.

6. **Miglioria mobile generale iniziale**
   - Rendo più mobile-friendly la scheda paziente principale:
     - tab orizzontali scrollabili su iPhone/iPad;
     - header e pulsanti più compatti;
     - card dei piani con azioni impilate meglio su schermi piccoli;
     - dialog “Nuovo/Modifica piano” più adatto al mobile.
   - Non rifaccio tutta l’app in una sola passata, ma imposto una base concreta sulle schermate che stai usando ora.

## Dettagli tecnici

- Modificherò principalmente:
  - `src/routes/_authenticated/pazienti.$id.tsx`
  - `src/routes/firma.tsx`
  - `src/lib/access-guard.ts`
  - `src/lib/signature-session.ts`
  - `src/components/paziente/piani-panel.tsx`
- Potrebbe servire anche una piccola migrazione database per aggiornare la funzione che decide se un consenso trattamento è valido, così considera correttamente il consenso collegato al trattamento anche quando il template è raggiunto tramite `trattamenti.consenso_template_id`.
- Non tocco i file auto-generati dell’integrazione backend.

## Risultato atteso

- Sopra la scheda paziente non ci sono più azioni rumorose.
- “Modifica anagrafica” si trova nella tab Anagrafica.
- L’anamnesi si firma dalla tab Anamnesi e include GDPR/Privacy quando necessario.
- L’alert “consenso mancante” sparisce quando il consenso è stato davvero firmato.
- Il tablet, dopo aver inviato la firma, torna alla schermata di attesa corretta.
- La scheda paziente diventa più usabile da iPhone/iPad.