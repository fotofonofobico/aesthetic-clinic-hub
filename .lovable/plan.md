## Obiettivo

1. Rimuovere ovunque il pulsante **"Scarica PDF"** lasciando solo **"Stampa"**.
2. Mostrare l'export "Esporta cartella PDF" del paziente nella **stessa videata** di anteprima usata oggi per anamnesi/consensi (header con titolo + tasto Stampa, viewer canvas sotto), invece del download diretto.

## Modifiche

### 1. `src/components/pdf-blob-dialog.tsx` (anteprima usata da anamnesi e consensi)
- Rimuovere il bottone **Scarica PDF** e la funzione `downloadPdf`.
- Rimuovere import non più usati: `Download`, `triggerBlobDownload`.
- Tenere solo il bottone **Stampa** che apre il blob in una nuova tab tramite `openBlobInNewTab` (da lì il browser permette la stampa nativa).
- La prop `filename` resta (serve come titolo eventuale) ma non viene più usata per il download.

### 2. `src/routes/_authenticated/pdf-viewer.tsx` (visualizzatore PDF da Storage)
- Rimuovere bottone **Scarica PDF** e funzione `downloadPdf`.
- Rimuovere import `Download` e l'helper `safeFilename` se inutilizzato.
- Tenere solo **Indietro** + **Stampa**. La stampa userà `openBlobInNewTab(blob)` (più affidabile di `window.print()` su iframe esterni).
- Aggiornare il messaggio di errore dentro `pdf-canvas-viewer.tsx` da "usa Scarica PDF" a "usa Stampa".

### 3. `src/components/pdf-canvas-viewer.tsx`
- Aggiornare il testo di fallback rimuovendo il riferimento a "Scarica PDF" → "usa il pulsante Stampa".

### 4. `src/routes/_authenticated/pazienti.$id.tsx` — Esporta cartella PDF come anteprima
- Sostituire il flusso di download diretto con apertura del **`PdfBlobDialog`** (lo stesso usato da anamnesi/consensi):
  - Aggiungere stato `cartellaBlob: Blob | null` e `cartellaOpen: boolean`.
  - In `esportaCartella()`: generare il PDF con `generaPdfCartellaPaziente`, salvare `blob` nello stato, aprire il dialog. Niente più chiamata a `triggerBlobDownload`.
  - Rimuovere import `triggerBlobDownload` (non più usato qui).
  - Rendere `<PdfBlobDialog>` in fondo al componente, con titolo "Cartella paziente — {cognome nome}" e `filename` = filename ritornato dal generatore (per coerenza, anche se non scaricabile).
- Il bottone in header diventa: "Apri cartella PDF" (più coerente con anteprima + stampa). Icona `FileText` invece di `Download`.

### 5. Pulizia `src/lib/download.ts`
- `triggerBlobDownload` non viene più chiamata da nessuna parte. La rimuoviamo per mantenere il codice pulito. Resta solo `openBlobInNewTab`.
- Verificare con `rg "triggerBlobDownload"` post-edit che non ci siano import orfani.

## Comportamento finale per l'utente
- Su qualsiasi PDF (anamnesi firmata, consenso firmato, cartella paziente, PDF da storage) si apre **un'unica videata di anteprima** identica a quella in screenshot, con header **Indietro / titolo / Stampa**.
- Nessun "Scarica PDF" da nessuna parte. La stampa usa la nuova tab nativa del browser (lì è anche disponibile "Salva come PDF" del sistema operativo, quindi l'utente non perde la possibilità di archiviare).

## File toccati
- `src/components/pdf-blob-dialog.tsx`
- `src/routes/_authenticated/pdf-viewer.tsx`
- `src/components/pdf-canvas-viewer.tsx`
- `src/routes/_authenticated/pazienti.$id.tsx`
- `src/lib/download.ts`
