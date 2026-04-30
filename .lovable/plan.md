# Piano operativo definitivo — 15 fix + archivio + versioning consensi

## 1. Bug & UX rapidi

**#1 Scarica PDF non scarica**
- `pdf-blob-dialog.tsx`: rimpiazzare `window.print()` con apertura del blob in nuovo tab + fallback download (`<a download>` su iOS). Stesso fix sul tasto "Stampa".
- Verifica anche pulsanti "Scarica" in `consensi-panel.tsx` e nella pagina firma.

**#2 Rinomina**
- "Nuovo template consensi" → "Nuovo consenso" in `src/routes/_authenticated/consensi.tsx` e `consensi-panel.tsx`.

**#5 Testo decentrato / overflow**
- `foto-baseline-banner.tsx`: aggiungere `flex-wrap` + `min-w-0 break-words` al contenitore testo.
- Pass generale di micro-fix tipografici: spazi mancanti nei badge "Seduta#1", "x2ml", header pannelli paziente.

**#14 Tipologia prodotto libera**
- `prodotto-form-dialog.tsx`: sostituire Select fissa con Combobox (cmdk) che mostra tipologie esistenti + opzione "Crea «X»".

## 2. Piani & Sedute

**#3 Annullare un piano completato**
- In `piani-panel.tsx` rimuovere il check che disabilita "Annulla" quando `stato='completato'`.

**#7 Motivazione cambio stato piano (annulla / riattiva)**
- Nuovo dialog `piano-cambio-stato-dialog.tsx` con textarea obbligatoria (≥5 caratteri).
- Al submit: update `piano_trattamento.stato` + insert in `paziente_nota` (tipo `clinica`, `auto_generata=true`) con testo tipo "Piano «X» annullato — motivo: …".

**#6 Sedute non erogate cancellate quando piano annullato**
- Trigger `piano_annulla_sedute_pendenti` su `piano_trattamento` AFTER UPDATE: se `NEW.stato='annullato'` → `DELETE FROM seduta WHERE piano_id=NEW.id AND completata=false`.
- (Sedute completate restano per tracciabilità.)

## 3. Diario

**#4 Allegati nel diario**
- Aggiungere colonna `allegati jsonb DEFAULT '[]'` a `paziente_nota` (array di `{path, nome, mime, size}`).
- Nuovo bucket privato `nota-allegati` con RLS analoga a `foto-cliniche`.
- `diario-panel.tsx`: input file multiplo + chip allegati cliccabili (signed URL).

**#8 Diario più ricco**
- Hook `useDiarioTimeline` che unisce: `paziente_nota`, eventi creazione/modifica anagrafica (da `audit_log`), nuove versioni `anamnesi_versione`, firme/revoche `consenso_firmato`, cambi stato piano.
- Render unificato con icona per tipo evento.

## 4. Consensi — versioning automatico

**Comportamento attuale**: versione testo libero, modificata a mano nel form template.

**Nuovo comportamento**:
- Trigger `consenso_template_bump_version` BEFORE UPDATE su `consenso_template`: se `titolo`, `testo`, `categoria`, `durata_*`, `validita_mesi` o `richiede_firma_medico` cambiano → incrementa `versione` con regola semver minor (`1.0` → `1.1`, `1.9` → `1.10`, oppure se contiene solo intero `2` → `2.1`).
- Campo "Versione" nel form template diventa **read-only** con tooltip "Aggiornata automaticamente ad ogni modifica".
- I consensi già firmati restano legati al loro `versione_snapshot` (immutabilità garantita dal trigger esistente `consenso_firmato_immutable`), quindi nessun impatto sullo storico.

## 5. Magazzino

**#15 Lotto/scadenza su prodotti `solo_uso`**
- `consumo-step.tsx`: per modalità `solo_uso` mostrare comunque input lotto + scadenza (oggi nascosti).
- `magazzino_consuma_seduta` (DB function): nel ramo `solo_uso`, se arrivano `numero_lotto` + `data_scadenza` ma `lotto_id` è null → trovare/creare riga in `prodotto_lotto` (con `quantita_iniziale=0`, `quantita_disponibile=0` perché solo informativo) e linkarla al movimento.
- Se il lotto esiste già con scadenza diversa → aggiornare `data_scadenza`.

## 6. Export PDF cartella paziente (#11, #12)

- Nuovo `src/lib/pdf-cartella-paziente.ts` (jsPDF) che assembla: anagrafica, anamnesi firmata corrente, lista consensi con stato, piani + sedute, ultime note diario.
- Pulsante "Esporta cartella" nella tab Documenti del paziente.
- Versione "blank" (senza intestazione studio) per stampa neutra dei consensi (#10).

## 7. Archivio unificato (la parte grossa)

Adotto la struttura suggerita da ChatGPT, **integrandola** con quello che già abbiamo, **senza rinominare** colonne (evitiamo refactor a rischio).

### 7.1 Modello dati (3 livelli sempre distinti)

| Concetto | Dove vive oggi | Cosa cambia |
|---|---|---|
| **Tipo di gestione** (come tracciamo) | `prodotto.modalita_tracking` (`tracciato`/`solo_uso`/`standby`) | **Resta così**. È giusto che sia sul prodotto. ChatGPT lo chiamerebbe `management_type` ma il rename costa molto e rende poco — lasciamo `modalita_tracking`. |
| **Stato operativo** (attivo / archiviato) | `prodotto.attivo`, `consenso_template.attivo`, `trattamenti.attivo`, `pazienti.deleted_at` | Sostituiamo con un campo unico `archiviato_il timestamptz NULL` su tutte le entità "di catalogo". `attivo` resta per retro-compatibilità (calcolato come `archiviato_il IS NULL`). Per `pazienti` riusiamo il `deleted_at` esistente. |
| **Versioning** (storia immutabile) | `consenso_template.versione` + `consenso_firmato.versione_snapshot` | Già c'è per consensi e anamnesi. Lo estendiamo con auto-bump (vedi §4). Per trattamenti/prodotti **non** introduciamo versioning ora: non serve clinicamente. |

### 7.2 Migrazione

```sql
ALTER TABLE prodotto             ADD COLUMN archiviato_il timestamptz;
ALTER TABLE trattamenti          ADD COLUMN archiviato_il timestamptz;
ALTER TABLE consenso_template    ADD COLUMN archiviato_il timestamptz;
-- pazienti: usiamo deleted_at esistente come "archivio soft"
```

Indici parziali per performance:
```sql
CREATE INDEX prodotto_attivi_idx        ON prodotto(id)          WHERE archiviato_il IS NULL;
CREATE INDEX trattamenti_attivi_idx     ON trattamenti(id)       WHERE archiviato_il IS NULL;
CREATE INDEX consenso_template_attivi_idx ON consenso_template(id) WHERE archiviato_il IS NULL;
```

### 7.3 Regole UI

- Tutti i Select operativi (nuovo piano, nuova seduta, scelta consenso da firmare) → solo `archiviato_il IS NULL`.
- Liste catalogo (Magazzino, Trattamenti, Consensi, Pazienti) → toggle "Mostra archiviati" (default off). Riga archiviata: badge grigio "Archiviato" + data.
- Azione "Archivia" / "Ripristina" sostituisce la cancellazione. Eliminazione fisica resta solo per medico, dopo conferma esplicita.
- Storico (sedute/firme già fatte) **continua a vedere** i nomi anche se archiviati: il join non viene filtrato, solo i picker.

### 7.4 Helper condiviso

`src/hooks/useArchivioFilter.ts` — restituisce `{ mostraArchiviati, toggle, queryFilter }` riutilizzabile in tutte le liste catalogo.

## 8. Adattamento al prompt di ChatGPT — cosa accetto e cosa cambio

| Suggerimento ChatGPT | Decisione |
|---|---|
| Separare stato / tipo gestione / versioning | ✅ Adottato come architettura |
| Rinominare `modalita_tracking` → `management_type` | ❌ Costo/beneficio sfavorevole, lasciamo così |
| Usare enum dedicato per stato | ⚠️ Useremo timestamp `archiviato_il` (più semplice, già pattern usato per `deleted_at`) |
| Versioning su tutte le entità | ⚠️ Solo dove serve clinicamente: consensi (auto-bump) e anamnesi (già c'è). Prodotti/trattamenti no. |
| Mai cancellazione fisica | ✅ Default archivio. Cancellazione solo come azione esplicita medico. |
| Coerenza cross-sistema | ✅ Stesso pattern e stesso helper UI ovunque |

## 9. File toccati (sintesi)

DB migration: nuove colonne + 2 trigger (`piano_annulla_sedute_pendenti`, `consenso_template_bump_version`) + bucket `nota-allegati` con policy.

Frontend:
- `src/components/pdf-blob-dialog.tsx`
- `src/components/paziente/piani-panel.tsx` + nuovo `piano-cambio-stato-dialog.tsx`
- `src/components/paziente/diario-panel.tsx` + hook `useDiarioTimeline`
- `src/components/paziente/foto-baseline-banner.tsx`
- `src/components/magazzino/prodotto-form-dialog.tsx`, `consumo-step.tsx`
- `src/components/consensi/template-form-dialog.tsx` (versione read-only)
- `src/routes/_authenticated/consensi.tsx`, `magazzino.tsx`, `trattamenti.tsx` (toggle archiviati)
- `src/lib/pdf-cartella-paziente.ts` (nuovo)
- `src/hooks/useArchivioFilter.ts` (nuovo)
- `src/lib/magazzino.ts` (lotto su solo_uso)

Codice esistente non viene riscritto: aggiungiamo accanto, filtriamo dove serve.

---

Confermi e procedo con l'implementazione?
