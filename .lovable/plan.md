# Piano — Firma visita unificata + annulla modifiche + stampa modulo vuoto

## Obiettivi
1. Sessione firma "Visita" come wizard a **2 step**: STEP 1 GDPR+Uso immagini con UNA firma sola; STEP 2 anamnesi con firma separata.
2. Pulsante "Annulla modifiche" sull'anamnesi: cancella la draft e ripristina l'ultima signed senza richiedere firma.
3. Nel dialog "Nuovo consenso" aggiungere due pulsanti di stampa: "Stampa per questo paziente" (precompilato con anagrafica) e "Stampa modulo generico vuoto".

Regole confermate dall'utente:
- 1 immagine di firma → 2 record `consenso_firmato` (GDPR + uso_immagini), stesso timestamp e stessa firma.
- GDPR rifiutato = blocca avanzamento; uso immagini rifiutato = OK, prosegue.
- Stampa: due pulsanti distinti.

---

## STEP 1 — Wizard firma a 2 fasi

### Modifiche a `src/components/signature-session-dialog.tsx`
Sostituire il loop documento-per-documento con due "fasi" ben definite quando `session.tipo === "visita"`:

**Fase A — Consensi combinati** (visibile solo se nella sessione esistono doc `gdpr` e/o `uso_immagini`):
- Una sola schermata che mostra in due card affiancate (verticali su mobile) il testo di GDPR e Uso immagini, ciascuno con il proprio RadioGroup Acconsento/Non acconsento (scelte indipendenti).
- UN SOLO `SignaturePad` in fondo, etichettato "Firma del paziente — vale per entrambi i consensi sopra".
- Al click "Conferma e prosegui":
  - validazioni: entrambe le scelte selezionate, firma non vuota.
  - **se GDPR = `non_acconsento` → toast di errore bloccante** ("Il consenso GDPR è obbligatorio per proseguire la visita") e si rimane sulla schermata.
  - altrimenti la stessa `firmaPaziente` (dataURL) viene applicata ai SessionDoc dei due consensi e si passa alla fase B.

**Fase B — Anamnesi** (solo se presente nella sessione):
- Identica schermata attuale (testo + scelta + signature pad). Firma indipendente.

**Salvataggio (`salvaTutto`)**: già scrive un record `consenso_firmato` per documento. Niente da cambiare lato DB: i due record GDPR/Uso immagini condivideranno semplicemente `firma_immagine`, `firmato_il` e (best-effort) lo stesso `hash_integrita` finale. Aggiungere un secondo flag interno `firmaCondivisa: true` solo per UX (es. log), non necessario in DB.

**Stato componente**: introdurre `phase: "consensi" | "anamnesi" | "salvataggio" | "fatto"` invece di `step` numerico. Mantenere `Progress` calcolato come `phase === "consensi" ? 50 : 100`.

**Rimanere retrocompatibile**: se `session.tipo === "trattamento"` (firma trattamenti) il flusso resta documento-per-documento come ora — non viene toccato.

### Eventuale ritocco a `src/lib/signature-session.ts`
- `buildVisitaSession` resta com'è (produce SessionDoc separati GDPR / uso_immagini / anamnesi).
- Garantire l'ordine: GDPR prima, poi uso_immagini, poi anamnesi (già rispettato).

---

## STEP 2 — "Annulla modifiche" sull'anamnesi

### Modifiche a `src/components/paziente/anamnesi-panel.tsx`

Aggiungere bottone in fondo al pannello, visibile **solo** quando esiste una `draft` E una `signed` precedente per lo stesso paziente.

Logica:
1. Caricare in `load()` non solo il record corrente ma anche l'ultima `signed` (memorizzare `lastSigned: AnamnesiRow | null`).
2. Mostrare bottone "Annulla modifiche" rosso outline accanto a "Salva bozza" se `data.stato === "draft" && lastSigned`.
3. Handler `annullaModifiche()`:
   - `confirm("Eliminare le modifiche e tornare all'ultima versione firmata v{n}?")`.
   - `DELETE` della draft corrente: `supabase.from("anamnesi").delete().eq("id", data.id)`.
   - Ricaricare → `setData(lastSigned)`.
   - Toast "Modifiche annullate, ripristinata v{n}".
   - Chiamare `onSaved()` per refresh badge esterni.

**Verifica RLS**: la tabella `anamnesi` non ha policy DELETE → operatori non possono cancellare. Va aggiunta una policy DELETE limitata alle draft.

### Migration richiesta
```sql
CREATE POLICY "Draft anamnesi eliminabili da operatori attivi"
ON public.anamnesi
FOR DELETE
TO authenticated
USING (is_active_operator(auth.uid()) AND stato = 'draft');
```

---

## STEP 3 — Stampa modulo vuoto nel "Nuovo consenso"

### Modifiche a `src/components/paziente/consensi-panel.tsx` (`NuovoConsensoDialog`)

Stato attuale: c'è già una funzione `stampaTemplate()` che apre `window.open("")` con HTML inline → stesso pattern problematico già abbandonato per i PDF firmati.

Riscriverla generando un PDF con `jsPDF` (riusando i renderer di `src/lib/pdf-template.ts`) e mostrarlo nel `PdfBlobDialog` esistente — coerente con la nuova architettura PDF interna.

Due pulsanti nel dialog (visibili solo quando un template è selezionato):

1. **"Stampa per questo paziente"** — carica anagrafica del paziente corrente (`pazienti.nome/cognome/codice_fiscale/data_nascita`) e genera PDF con header precompilato.
2. **"Stampa modulo generico vuoto"** — passa anagrafica vuota (`{ nome: "_______", cognome: "_______", codice_fiscale: "_______", data_nascita: null }`) — sempre disponibile.

### Nuova helper `src/lib/pdf-consenso-vuoto.ts`
Funzione `generaPdfModuloVuoto({ paziente, titolo, testo, versione })` che produce un PDF con:
- intestazione paziente (riusa `renderHeaderPaziente`)
- titolo + versione
- testo del consenso
- riga "Data: ____________________"
- due checkbox: ☐ Acconsento  ☐ Non acconsento (disegnati come quadrati vuoti)
- due blocchi firma vuoti: "Firma paziente ____________________" / "Firma medico ____________________"

Il PDF viene mostrato nel `PdfBlobDialog` (preview canvas + bottoni Stampa / Scarica). **Non viene salvato in storage e non crea record DB**.

---

## File toccati

```text
NUOVI
- src/lib/pdf-consenso-vuoto.ts             (helper generazione PDF vuoto)
- supabase migration                         (policy DELETE su anamnesi draft)

MODIFICATI
- src/components/signature-session-dialog.tsx  (wizard 2-fasi per visita)
- src/components/paziente/anamnesi-panel.tsx   (bottone "Annulla modifiche" + load lastSigned)
- src/components/paziente/consensi-panel.tsx   (NuovoConsensoDialog: 2 pulsanti stampa via PdfBlobDialog)
```

Nessuna modifica a `signature-session.ts`, `pdf-consenso.ts`, schema DB (eccetto policy), routing.

---

## Note tecniche

- **Stessa firma su 2 record consenso**: l'hash di integrità rimane individuale per record (include titolo/testo/versione del singolo consenso) — corretto per la storicizzazione separata. La condivisione è solo a livello di `firma_immagine` + `firmato_il`.
- **GDPR obbligatorio**: il blocco è solo client-side nel wizard. Lato dato resta possibile salvare un GDPR rifiutato da altri flussi (è già così oggi).
- **Annulla modifiche**: limitato alle draft per design — la policy USING `stato = 'draft'` impedisce a chiunque di cancellare versioni firmate, in linea con il trigger `anamnesi_signed_protect`.
- **Stampa vuoto**: PDF generato client-side, mai uploadato. Il `PdfBlobDialog` già gestisce print + download.
- **Mobile (viewport 867×762)**: nella Fase A le 2 card consensi vanno in `grid md:grid-cols-2 gap-3` — su mobile stacked, su desktop affiancate. Il signature pad in fondo full-width.
