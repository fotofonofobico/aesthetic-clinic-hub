## Diagnosi

Ho verificato direttamente sul backend e sullo storage:

- Il file `8ebca852-…/0656caa9-…-v4.pdf` **esiste** in `anamnesi-pdf` (1.097.838 byte, mimetype `application/pdf`).
- Il signed URL che hai incollato risponde **HTTP 200**, content-type `application/pdf`, content-length corretto. Quindi il PDF c'è e Supabase lo serve correttamente.
- In `anamnesi-pdf` ci sono 8 file, in `consensi-pdf` solo 2 → molti consensi vecchi sono stati creati prima dell'introduzione dell'upload automatico e quindi hanno `pdf_url` valorizzato verso file inesistenti, oppure `pdf_url` NULL → di qui il "link vuoto" sui consensi.

Quindi i problemi reali sono due, non uno:

1. **UX confusa**: nel pannello anamnesi convivono "Stampa anamnesi" (genera al volo un PDF cartaceo via blob, senza firme) e "Apri PDF anamnesi firmata" (signed URL allo storage). Sono effettivamente ridondanti quando l'anamnesi è già firmata: l'utente non capisce la differenza e percepisce uno dei due come "rotto".
2. **Apertura inaffidabile dei PDF firmati**:
   - Il componente `PdfSignedLink` crea il signed URL, fa una `HEAD` in fetch, e poi mostra un `<a target="_blank">`. Su alcuni browser/Cloudflare la `HEAD` può fallire per CORS o restituire stato non-200 anche quando il file esiste, e il componente mostra "PDF non disponibile" pur avendo il file.
   - Inoltre il signed URL viene generato al **mount** del componente con TTL 10 minuti: se l'utente clicca dopo aver lasciato la pagina aperta, il link è scaduto → si apre una pagina vuota / errore JSON.
   - Per i consensi vecchi senza `pdf_url` (o con path che punta a un file mai caricato) non c'è alcuna possibilità di rigenerare il PDF on-demand.

## Cosa farò

### 1. Pulizia UI anamnesi (rimuovi ridondanza)

In `src/components/paziente/anamnesi-panel.tsx`:

- Quando l'anamnesi è **firmata** (`stato === "signed"` con `pdf_url`): mostra **un solo pulsante** "Apri PDF firmato" (no più "Stampa anamnesi" duplicato).
- Quando è in **bozza** (non firmata): mostra "Stampa bozza" (per il flusso cartaceo) + "Carica PDF firmato" + "Firma e blocca", come oggi.
- Se firmata ma manca `pdf_url` (record vecchi): mostra "Rigenera PDF" che chiama lo stesso flusso di `generaPdfAnamnesi` con i dati salvati e fa l'upload nello storage, poi aggiorna `pdf_url` sul record (la trigger `anamnesi_signed_protect` ammette aggiornamento di `pdf_url` solo se il record è in stato compatibile → in realtà la trigger blocca, quindi farò il fallback come "Stampa copia non firmata" come oggi, senza scrivere su DB).

### 2. `PdfSignedLink` robusto e on-demand

Riscrivo `src/components/pdf-signed-link.tsx` così:

- Niente più HEAD pre-flight (è la causa principale dei falsi "PDF non disponibile"). Le HEAD su signed URL Cloudflare sono inaffidabili.
- Niente più generazione del signed URL al mount. Bottone immediato; al **click** genero il signed URL fresco (TTL 10 min) e apro `window.open(url, "_blank")`. Così non scade mai prima dell'apertura.
- Prima di generare il signed URL, controllo l'esistenza del file via `supabase.storage.from(bucket).list(parentPath, { search: filename })`. Questa è una chiamata API autenticata, non soggetta a CORS, e ci dice in modo affidabile se il file c'è.
- Se non c'è: mostro "PDF non disponibile (file mancante)" e — solo per i consensi — un pulsante "Rigenera PDF" se è disponibile uno snapshot completo del consenso (titolo/testo/firma_immagine).

### 3. Rigenerazione PDF consenso per record vecchi

In `consensi-panel.tsx`, nel dialog di dettaglio:

- Se `pdf_url` è NULL o il file non esiste in storage e `firma_immagine` è presente, mostro "Genera PDF firmato ora": ricostruisce il PDF dagli snapshot (`titolo_snapshot`, `testo_snapshot`, `versione_snapshot`, `firmato_il`, `firma_immagine`, `categoria_snapshot`) usando `generaPdfConsenso`, lo carica in `consensi-pdf`, aggiorna `consenso_firmato.pdf_url`. La trigger `consenso_firmato_immutable` non protegge `pdf_url` quindi è consentito.
- Se `firma_immagine` è NULL (consensi cartacei vecchi senza file): mostro un avviso chiaro "PDF originale non recuperabile — ricaricare manualmente".

### 4. Tasto "Stampa" coerente in anamnesi bozza

Il bottone "Stampa anamnesi" oggi rigenera al volo un PDF marcato "cartaceo" anche quando l'anamnesi è già firmata (creando il blob link che ti appariva accanto). Lo nascondo quando `stato === "signed"`. Nelle bozze resta utile per stampare e far firmare a mano.

## File toccati

- `src/components/pdf-signed-link.tsx` — riscrittura: click-time signed URL + check via `storage.list`.
- `src/components/paziente/anamnesi-panel.tsx` — nasconde "Stampa anamnesi" quando firmata; lascia un solo bottone "Apri PDF firmato".
- `src/components/paziente/consensi-panel.tsx` — nel detail dialog, aggiunge "Rigenera PDF" quando il file manca ma c'è la firma snapshot.

## Nessuna migrazione DB

Tutto si risolve lato client + storage. Non servono modifiche allo schema o alle policy (le policy storage attuali permettono già insert/update agli operatori attivi).

## Note finali

Il PDF v4 che credevi rotto in realtà funziona: il problema era il timeout del signed URL e la HEAD fallita in `PdfSignedLink` che mostrava il fallback "non disponibile" anche con file presente. Dopo il fix il link cliccato aprirà sempre il PDF reale, finché esiste in storage.