Hai ragione a essere frustrato: il problema non è che non si possano creare PDF. I PDF vengono generati, ma il modo in cui li stiamo aprendo in Safari/nel preview Lovable è sbagliato: aprire una nuova scheda vuota e poi iniettarci dentro `blob:` / `data:application/pdf;base64` può far ricaricare la pagina principale o lasciare una scheda bianca/fittizia.

Piano per correggerlo in modo stabile:

1. Rimuovere il flusso con scheda vuota
   - Niente più `window.open("")` seguito da `document.write()` per i PDF.
   - Niente più navigazione diretta a `blob:` o iframe con PDF base64 dentro una scheda creata al volo.

2. Creare una pagina viewer PDF interna all’app
   - Aggiungere una route dedicata tipo `/pdf-viewer`.
   - La pagina resta dentro l’app normale, quindi non manda in crisi Safari/preview.
   - Mostra stato di caricamento, errore chiaro, pulsanti “Stampa” e “Scarica PDF”.

3. Passare al viewer solo riferimenti sicuri, non il blob
   - Per PDF firmati di anamnesi e consensi: aprire `/pdf-viewer?bucket=...&path=...&title=...`.
   - Il viewer scarica il PDF dallo storage autenticato e lo mostra.
   - Per la “Stampa bozza” dell’anamnesi, evitare nuova scheda: generare il PDF nella pagina e mostrarlo nello stesso viewer/modal oppure salvare temporaneamente la bozza e aprirla nel viewer.

4. Aggiungere fallback pratico se il browser non visualizza il PDF inline
   - Se l’anteprima PDF non viene renderizzata, il viewer mostra comunque “Scarica PDF”.
   - Il pulsante “Stampa” userà l’iframe solo quando disponibile; altrimenti invita ad aprire/scaricare il PDF.

5. Pulire il codice precedente
   - Sostituire l’utility `renderPdfInWindow` o limitarla solo a HTML stampabile non-PDF.
   - Aggiornare `PdfSignedLink`, anamnesi e consensi per usare il nuovo viewer.
   - Mantenere il blocco anti doppio-click per evitare doppie aperture.

Dettagli tecnici:

- File coinvolti previsti:
  - `src/routes/pdf-viewer.tsx` nuova pagina dedicata.
  - `src/components/pdf-signed-link.tsx` aggiornato per navigare al viewer invece di aprire schede vuote.
  - `src/components/paziente/anamnesi-panel.tsx` aggiornato per “Stampa bozza”.
  - Eventualmente `src/lib/pdf-viewer.ts` da rimuovere o ridurre.

- Per i PDF firmati si userà `supabase.storage.from(bucket).download(path)` dentro il viewer, poi si creerà un object URL solo dentro la stessa pagina viewer.
- Per la bozza anamnesi la soluzione più stabile è mostrarla in un dialog/viewer interno, senza pop-up. Se serve una vera nuova pagina per stampare, la apro tramite route app, non tramite pagina `about:blank` manipolata via script.

Risultato atteso:

```text
Click su “Apri PDF” o “Stampa bozza”
→ nessuna scheda fittizia about:blank
→ nessun blob nella barra indirizzi
→ la pagina principale non si riavvia
→ PDF visibile in viewer interno
→ pulsanti Stampa / Scarica disponibili
```

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>