# Fix consensi + anamnesi: firma, PDF, versioning, cartaceo

Tutto il lavoro è puntuale: niente refactor, niente nuove tabelle. Riusa colonne e componenti già presenti (`anamnesi.firma_paziente/firma_medico/pdf_url/firmata_il/stato`, indice unique `anamnesi_one_draft_per_paziente`, bucket `anamnesi-pdf` / `consensi-pdf`, `SignaturePad`, `generaPdfConsenso`, `generaPdfAnamnesi`).

## 1. Consensi — firma sempre obbligatoria + radio allineati

File: `src/components/signature-session-dialog.tsx`

- Rimuovere il blocco `{scelta === "acconsento" && (...)}` attorno ai SignaturePad: il pad firma paziente è **sempre** renderizzato (sia per "Acconsento" sia per "Non acconsento"). Il pad medico resta visibile solo se `current.richiedeFirmaMedico`.
- In `confermaDocumento()`: la firma del paziente è obbligatoria in entrambi i casi (rimuovere il check `if (scelta === "acconsento")` attorno alla validazione firma; tenere però la firma medico obbligatoria solo se `richiedeFirmaMedico`). La firma viene allegata al record anche in caso di rifiuto.
- In `salvaTutto`: passare `firmaPaziente` anche se `rifiutato=true` (oggi `firma_immagine` finisce nel DB già — ok). Per anamnesi: anche con `non_acconsento` la firma del paziente è registrata, ma lo stato anamnesi resta `draft` e non si firma il record (comportamento attuale invariato). Solo aggiungere validazione "firma sempre richiesta".
- Disabled del bottone "Conferma": basato su `!scelta || !firmaReady || (richiedeFirmaMedico && !firmaMedReady)` — togliere il vincolo "scelta === acconsento".
- UI radio (lines 344–351): sostituire `flex items-center gap-2 ... p-2` con `flex items-center gap-3 px-3 py-2 min-h-[44px]` e wrapping label per allineamento perfetto baseline radio/testo.

## 2. PDF consensi — generazione e upload garantiti

File: `src/components/signature-session-dialog.tsx` (loop `salvaTutto`) + `src/components/paziente/consensi-panel.tsx` (`NuovoConsensoDialog.salva` per modalità tablet).

- Nel `NuovoConsensoDialog` modalità "tablet": **manca la generazione PDF** (oggi salva solo `firma_immagine`, `pdf_url=null`). Aggiungere chiamata a `generaPdfConsenso(...)` + upload in `consensi-pdf` con path `${pazienteId}/${Date.now()}-${crypto.randomUUID()}.pdf`. Se upload fallisce → `toast.error` + `return` senza insert.
- In `signature-session-dialog.salvaTutto`: dopo `supabase.storage.upload`, verificare con `await supabase.storage.from('consensi-pdf').list(...)` o equivalente check su `up.data?.path`; se `up.error || !up.data?.path` → throw (già throwa, ma aggiungere log esplicito `console.error('[consensi-pdf upload]', ...)`).
- Garantire `pdf_url` non vuoto: `if (!pdfPath) throw new Error('pdf_url vuoto, abort')` prima dell'insert.

## 3. PDF template unificato (consensi + anamnesi)

File: `src/lib/pdf-consenso.ts` e `src/lib/pdf-anamnesi.ts`.

Estrarre helper condiviso `src/lib/pdf-template.ts` con:
- `renderHeaderPaziente(doc, paziente, margin, y)` → "Paziente: COGNOME NOME / CF: ... / Data nascita: dd/mm/yyyy". Sempre in cima, blocca generazione se `cognome` o `nome` mancanti.
- `renderMetadata(doc, { tipoDocumento, titolo, versione, firmatoIl })` → "Documento: ... / Titolo: ... / Versione: ... / Firmato il: dd/mm/yyyy HH:mm".
- `renderSignatureBlock(doc, { firmaPazienteDataUrl, firmaMedicoDataUrl, firmatoIl, modalita })` → due colonne (paziente sx / medico dx). Se `modalita==='cartaceo'` o immagine assente → linea vuota; sotto sempre "Data: dd/mm/yyyy HH:mm".
- Validazione: throw `Error("PDF invalido: header paziente mancante")` se manca cognome/nome; throw se manca firmatoIl.

`generaPdfConsenso` e `generaPdfAnamnesi` riusano questi helper invece dell'attuale codice duplicato (rimosso il vecchio rendering inline).

## 4. Anamnesi — versioning corretto su record firmato

File: `src/components/paziente/anamnesi-panel.tsx`.

`forkFromSigned` esiste già. Problemi attuali:
- `ensureEditable` viene chiamato in ogni `patch`, ma è `async`. Funziona, ma il `setData` dentro `patch` può perdere modifiche concorrenti se l'utente digita in fretta. Aggiungere lock: se `forking===true`, aspettare la stessa promise (memoizzare la promise di fork in una `useRef<Promise|null>`).
- Garantire che dopo fork, `data.id` punti SEMPRE al nuovo draft prima di applicare update (già fatto, ma il `setData` con callback potrebbe operare ancora sull'OLD se React batcha). Soluzione: `setData(draft)` dentro `forkFromSigned` PRIMA di tornare e usare `await new Promise(r => setTimeout(r,0))` non serve — invece, fare in modo che `patch`/`setNoteLibere` ricevano `editable` e applichino patch direttamente su `editable` (non su `d`).
- `save()`: già blocca se `signed`. OK.
- Il trigger DB `anamnesi_signed_protect` impedisce update di un record signed → corretto. L'unique partial index garantisce un solo draft. Nessuna migrazione necessaria.

## 5. Anamnesi cartacea (nuova feature)

File: `src/components/paziente/anamnesi-panel.tsx`.

Aggiungere accanto a "Firma e blocca" due bottoni:

1. **"Stampa anamnesi"** → genera PDF con `generaPdfAnamnesi(... firmaPazienteDataUrl=null, firmaMedicoDataUrl=null ...)` e apre/scarica il blob (URL.createObjectURL + window.open). Il template a livello signature-block lascia linee vuote.
2. **"Carica PDF firmato"** → apre piccolo dialog con: `<Input type="file" accept="application/pdf">` + `<Input type="date">` per data firma. Validazione: file presente, data non futura.
   - Su conferma: upload in `anamnesi-pdf` path `${pazienteId}/${data.id}-v${data.versione_numero}-cartaceo.pdf`; se upload fallisce → abort.
   - Update record corrente: `stato='signed'`, `firmata_il=<data scelta>`, `pdf_url=<path>`, `firma_paziente=null`, `firma_medico=null`, `hash_integrita=sha256(filename+size+date)`. **Niente uso di `consenso_firmato`**.
   - Aggiungere colonna `modalita` a `anamnesi`? **NO** — vincolo "non rinominare/aggiungere campi". Useremo invece `note_libere` con prefisso `[CARTACEO]` opzionale, ma più pulito: salvare l'indicazione cartacea inferendola da `firma_paziente IS NULL AND pdf_url IS NOT NULL AND stato='signed'`. Helper `isCartaceo(row)`.
3. Visualizzazione: nel banner stato firma, se `isCartaceo(data)` mostrare badge "Cartaceo" + link "Apri PDF" (signed URL su `anamnesi-pdf`). Riusare pattern `PdfLink` già esistente in `consensi-panel.tsx` (estratto in `src/components/pdf-signed-link.tsx` per non duplicare).

## 6. File toccati

- `src/components/signature-session-dialog.tsx` — firma sempre visibile, validazione, radio align, log upload.
- `src/components/paziente/consensi-panel.tsx` — `NuovoConsensoDialog.salva` genera PDF anche in tablet; uso di `PdfSignedLink` condiviso.
- `src/components/paziente/anamnesi-panel.tsx` — fork lock, bottoni Stampa + Carica cartaceo, badge cartaceo.
- `src/lib/pdf-template.ts` (NEW) — helper header/metadata/firma condivisi.
- `src/lib/pdf-consenso.ts` — usa helper, rimuove duplicazione.
- `src/lib/pdf-anamnesi.ts` — usa helper, supporta firma null (cartaceo).
- `src/components/pdf-signed-link.tsx` (NEW) — componente riusato per link PDF firmati (sostituisce `PdfLink` interno).

Nessuna migrazione DB. Nessuna nuova tabella. Nessuna modifica a schema o policy.

## Acceptance check

- Firma paziente sempre obbligatoria, indipendentemente da scelta.
- Radio "Acconsento / Non acconsento" allineati, area cliccabile ≥44px.
- Ogni record `consenso_firmato` ha `pdf_url` valorizzato e file effettivamente presente in storage.
- Modificare un'anamnesi `signed` crea un nuovo record `draft` con `versione_numero+1`; signed resta immutabile.
- Workflow cartaceo: stampa template senza firma, upload PDF firmato, record diventa `signed` con `pdf_url` valorizzato e firme digitali nulle.
- Tutti i PDF generati contengono header paziente + metadata + sezione firma in fondo.
