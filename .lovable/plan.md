# Fix bug e rifiniture (12 punti)

## 1 · Tasto "Scarica PDF" non funziona (anteprima consenso/anamnesi)
In `src/components/pdf-blob-dialog.tsx` il flusso usa `URL.createObjectURL` + `<a download>`, ma in alcuni browser/embed il click programmatico non parte se il blob non è "noto". Sostituisco con:
- usare un `Blob` esplicito con MIME `application/pdf`,
- per Safari/iOS aprire in nuovo tab (già c'è) **e** anche per desktop Safari,
- aggiungere fallback `window.location.href = url` se `link.click()` non genera download entro 1s,
- log esplicito `console.warn` per capire cosa succede in produzione.

## 2 · Dashboard "Alert" sempre verde
La logica attuale conta solo: anamnesi >12 mesi, lotti sotto soglia con `qta > 0`, consensi mancanti per sedute nei prossimi 7gg. In uno studio nuovo è normale sia tutto vuoto. Espando in `src/components/dashboard/alerts-section.tsx`:
- **Lotti scaduti / in scadenza < 30gg** (oggi non li conta);
- **Consensi obsoleti** (template con `versione` diversa dallo snapshot firmato) e **consensi in scadenza < 30gg**;
- **Pazienti senza anamnesi firmata**;
- Mantengo gli alert esistenti.
Aggiungo anche tooltip "Tutto in regola" che spiega *cosa* è stato controllato, così si capisce che non è un bug.

## 3 · Piano "completato (auto)" annullabile manualmente
In `src/components/paziente/piani-panel.tsx` il `Select` permette di passare `completato → annullato` perché `richiediCambioStato` non blocca quel caso. Modifico:
- se `p.stato === "completato"`, il `Select` resta abilitato **solo** se ci sono ancora sedute future programmate (caso raro). Nel caso normale, il select diventa read‑only con tooltip "Piano completato — non più modificabile".
- nascondo l'opzione "Annullato" quando `p.stato === "completato"`.

## 4 · Banner "Foto baseline mancanti" — testo sbordato
In `src/components/foto/foto-baseline-banner.tsx` il problema è il padding sinistro forzato da `[&>svg~*]:pl-7` di `Alert` quando il contenuto è lungo su viewport stretti. Cambio struttura:
- uso `min-w-0`, `flex-wrap` + `break-words` su titolo e descrizione,
- rimuovo l'icona dentro `<Alert>` come prefix e la metto inline dentro il flex per evitare il padding fisso `pl-7` su ogni riga,
- testo accorciato: "{n} piani senza foto pre‑trattamento".

## 5 · Diario: ora non si aggiorna automaticamente
In `src/components/paziente/diario-panel.tsx` `dataEvento` viene inizializzato una sola volta (al mount). Quando l'utente arriva sul tab dopo qualche minuto, l'ora è vecchia. Soluzione:
- al focus dell'input data o all'apertura del tab Diario, riallineo `dataEvento = now()` se l'utente non l'ha modificato manualmente,
- aggiungo bottone "Ora" accanto all'input datetime che resetta a `new Date()`.

## 6 · Export cartella PDF non parte il download
Stesso problema del punto 1: `esportaCartella` in `src/routes/_authenticated/pazienti.$id.tsx` usa il pattern `<a download>` che a volte non triggera. Refactor:
- estraggo helper `triggerBlobDownload(blob, filename)` in `src/lib/download.ts` con: `URL.createObjectURL`, link `download`, fallback `window.open` per Safari/iOS, fallback finale `location.href = url` con `target="_blank"`,
- uso lo stesso helper in `pdf-blob-dialog.tsx` (punto 1) e ovunque serva.

## 7‑8‑9 · Modifiche non visibili in Magazzino / Trattamenti / Pazienti
Nelle conversazioni precedenti l'UI di archiviazione e altri fix sono stati applicati **solo a Consensi**. Estendo lo stesso pattern alle altre sezioni:
- **Magazzino** (`src/routes/_authenticated/magazzino.index.tsx`): bottoni Archivia/Ripristina sui prodotti (usano `archiviato_il` già a DB), toggle "Mostra archiviati", uso hook `useArchivioFilter` esistente.
- **Trattamenti** (`src/routes/_authenticated/trattamenti.index.tsx`): stesso pattern (la migrazione precedente ha aggiunto `archiviato_il` a `trattamenti`).
- **Pazienti** (`src/routes/_authenticated/pazienti.index.tsx`): l'archiviazione esiste già via `deleted_at`. Aggiungo toggle "Mostra archiviati" (per medici, già policy esistente) + bottone Ripristina.
Confermo all'utente quali modifiche risultano applicate, perché probabilmente vedeva solo Consensi.

## 10 · Magazzino: tipologie principali con flag + "altro"
In `src/components/magazzino/prodotto-form-dialog.tsx` il combobox tipologia mostra solo quelle già usate. Aggiungo:
- elenco predefinito (filler, biostimolante, tossina, peeling, anestetico, ago/cannula, materiale di consumo, skincare, integratore),
- merge con tipologie già presenti nel DB,
- input libero "altro" (già supportato dal Combobox quando si digita un nuovo valore).

## 11 · "Errore caricamento prodotto" alla creazione
Probabilmente è errore RLS o validazione. In `src/lib/magazzino.ts → creaProdotto` aggiungo:
- check `requireUserId` (già presente ma migliorare messaggi),
- log dettagliato dell'errore Postgres (`error.message`, `error.code`) → `toast.error(error.message)` invece di un generico,
- gestione esplicita di `unita_misura` e `modalita_tracking` (la migrazione recente potrebbe aver introdotto vincoli più stretti — verifico col dev server log dopo).
Verifico anche il trigger `archiviato_il` non blocchi gli `INSERT`.

## 12 · Rinominare "Solo uso..." in "Solo uso"
In `src/types/magazzino.ts` la label è già "Solo uso", ma in `magazzino.index.tsx` riga 168 e nel `Select` del prodotto‑form si vede "Solo uso (registra senza decremento)" o simile. Uniformo a **"Solo uso"** ovunque (label corta) lasciando la descrizione sotto come testo secondario.

---

## Dettagli tecnici (per chi vuole leggere il diff)

**File principali modificati:**
- `src/components/pdf-blob-dialog.tsx` (download robusto)
- `src/lib/download.ts` (nuovo helper)
- `src/routes/_authenticated/pazienti.$id.tsx` (usa helper)
- `src/components/dashboard/alerts-section.tsx` (più check)
- `src/components/paziente/piani-panel.tsx` (blocca completato→annullato)
- `src/components/foto/foto-baseline-banner.tsx` (layout fix)
- `src/components/paziente/diario-panel.tsx` (ora auto‑aggiornata + bottone "Ora")
- `src/routes/_authenticated/magazzino.index.tsx` (archivio + label)
- `src/routes/_authenticated/trattamenti.index.tsx` (archivio)
- `src/routes/_authenticated/pazienti.index.tsx` (toggle archiviati)
- `src/components/magazzino/prodotto-form-dialog.tsx` (tipologie predefinite + error log)
- `src/lib/magazzino.ts` (creaProdotto: messaggi errore espliciti)
- `src/types/magazzino.ts` (label uniformi)

**Nessuna migrazione DB necessaria** — i campi `archiviato_il` esistono già su `prodotto`, `trattamenti`, `consenso_template` dalle migrazioni precedenti.

Dopo l'implementazione provo manualmente: creazione prodotto, archivia/ripristina in magazzino e trattamenti, annullamento piano completato (deve essere bloccato), download PDF cartella + consenso, e verifico la dashboard alert con dati reali.
