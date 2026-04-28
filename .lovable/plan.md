Ho verificato il caso: i PDF vengono effettivamente generati e caricati nello storage (anche per il paziente nuovo), e il file risponde come `application/pdf`. Il problema reale è l'apertura tramite link firmato esterno: nel preview/browser si apre una pagina nera/vuota e il pulsante può aprire due tab perché usa `window.open` più fallback. Quindi non basta rigenerare: va cambiato il modo in cui li mostriamo.

Piano di correzione immediata:

1. Sostituire l'apertura con link firmato
   - Modificare `PdfSignedLink` per non usare più `createSignedUrl` + `window.open` verso URL esterno.
   - Scaricare il PDF tramite Storage API autenticata con `download(path)`.
   - Creare un Blob locale `application/pdf` e aprire quello con `URL.createObjectURL(blob)`, come già succede per la stampa bozza anamnesi.
   - Risultato: niente link esterno vuoto, niente token scaduti, niente pagina nera del viewer esterno.

2. Eliminare la doppia apertura
   - Rimuovere il doppio meccanismo `window.open(...)` + fallback anchor che può aprire due schede.
   - Usare una sola strategia controllata: apertura di una singola scheda Blob locale.
   - Proteggere il click con un lock immediato via `useRef`, non solo con stato React, così doppi click o rerender non avviano due aperture.

3. Mantenere verifica e messaggi chiari
   - Prima del download continuare a verificare che il file esista nello storage.
   - Se manca, mostrare errore e usare l'eventuale rigenerazione già prevista per i consensi.
   - Se il download fallisce, mostrare un messaggio esplicito: “PDF presente ma non scaricabile”.

4. Applicare la correzione a tutti i PDF firmati
   - Anamnesi: `Apri PDF anamnesi firmata` userà il nuovo flusso Blob.
   - Consensi: `Apri PDF firmato` userà lo stesso componente corretto.
   - Non cambiare il flusso di generazione, perché il database e lo storage indicano che la generazione avviene già.

Dettagli tecnici:

```text
Click pulsante
  -> verifica file in storage
  -> download autenticato del PDF
  -> Blob locale application/pdf
  -> URL.createObjectURL(blob)
  -> apertura singola scheda
```

File da modificare:
- `src/components/pdf-signed-link.tsx`

Se vuoi, dopo l'approvazione lo implemento subito come priorità assoluta.