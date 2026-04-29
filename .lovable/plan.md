# Modulo Magazzino — Piano definitivo (con modalità beta-friendly)

## Decisioni consolidate
- **Lotti separati** come righe magazzino (per medico-legale).
- **Scarico automatico FEFO** alla firma seduta, con override e dialog di conferma.
- **3 modalità per prodotto** (vedi sotto) → convive col fatto che il magazzino è condiviso.
- **Creazione lotto/prodotto inline** durante la seduta.
- **Funzione inventario** per rettifiche con motivazione.
- Permessi: tutti operatori attivi gestiscono e consumano. Solo medico DELETE. Audit log su tutto.

## Le 3 modalità di tracking (per prodotto)

| Modalità | Scorte? | Scarico auto seduta? | Lotto registrato? | Caso d'uso |
|---|---|---|---|---|
| **`tracciato`** | Sì, conta unità reali | Sì (FEFO) | Sì | Prodotti tuoi, controllo pieno |
| **`solo_uso`** | No, qta sempre infinita | No (ma registra il consumo come movimento informativo, senza decremento) | Sì (numero lotto + scadenza richiesti) | Prodotti condivisi: documenti cosa hai usato su quel paziente per medico-legale, ma non ti preoccupi delle scorte |
| **`standby`** | No | No | No | Disattivato/dismesso, resta visibile ma escluso ovunque |

- Modalità si cambia in qualsiasi momento dalla scheda prodotto.
- In UI: badge colorato accanto al nome (verde/giallo/grigio).
- Filtro globale "Mostra solo tracciati" nella tabella prodotti.

### Implementazione DB
Aggiunta colonna su `prodotto`:
```
modalita_tracking text not null default 'solo_uso'
  check (modalita_tracking in ('tracciato','solo_uso','standby'))
```
- Default `solo_uso` → coerente con la tua fase beta (parti soft).
- Trigger `trg_movimento_aggiorna_lotto`: aggiorna `quantita_disponibile` SOLO se `modalita_tracking = 'tracciato'`. Per `solo_uso`, il movimento viene comunque registrato ma non decrementa nulla.
- Per `standby`: il prodotto non compare nei combobox di seduta/piano (ma resta visibile in `/magazzino` con filtro).

## Creazione lotto inline in seduta

Nel `<ConsumoMagazzinoStep>`, ogni riga prodotto ha:
1. **Combobox lotto** con lotti esistenti per quel prodotto, ordinati FEFO.
2. Voce in fondo: **"+ Nuovo lotto…"** → mini-form inline (numero lotto + scadenza, costo opzionale) → al "Conferma seduta" il lotto viene creato e immediatamente consumato (un movimento `carico` + un movimento `scarico` nello stesso transaction).
3. **Combobox prodotto** ha analogamente una voce **"+ Nuovo prodotto…"** → form rapido (nome + marca + tipologia + unità + modalità). Default modalità: `solo_uso` (così non blocca nulla).

Tutto in una sola transazione server-side: o tutto va, o tutto rolled back.

## Funzione inventario (rettifica)

In `/magazzino` tab Lotti, ogni riga ha bottone **"Rettifica"**:
- Modal: "Quantità reale rilevata" + textarea **motivazione obbligatoria** (≥10 caratteri).
- Crea un movimento `rettifica` con `quantita = abs(reale − sistema)` e `tipo` interno `rettifica_pos` o `rettifica_neg`.
- Audit log con motivazione.
- Disponibile anche per prodotti `solo_uso`? No, non ha senso (non hanno scorte). Solo per `tracciato`.

In dashboard, contatore "# rettifiche ultimo mese" come segnale di disallineamento.

## 1. Database (1 migration)

### Tabelle nuove

**`prodotto_marca`** — `id`, `nome unique`, `attiva bool`, `created_at`

**`prodotto_fornitore`** — `id`, `nome`, `contatti jsonb`, `attivo bool`, audit cols

**`prodotto`**
- `id`, `nome`, `tipologia text`, `marca_id fk null`, `fornitore_id fk null`,
- `unita_misura text` (pz/ml/fiale/U…),
- `costo_unitario_default numeric`,
- `soglia_minima numeric default 0`,
- **`modalita_tracking text default 'solo_uso'`**,
- `attivo bool default true` (soft-delete diverso da standby: `attivo=false` = nascosto totalmente),
- audit cols
- Unique `(lower(nome), marca_id)`.

**`prodotto_lotto`**
- `id`, `prodotto_id fk`, `numero_lotto text`, `data_scadenza date null`,
- `quantita_iniziale numeric`, `quantita_disponibile numeric`,
- `costo_unitario numeric` (snapshot ingresso),
- `note text`, `created_at/by`,
- Unique `(prodotto_id, numero_lotto)`.

**`magazzino_movimento`** (append-only)
- `id`, `prodotto_id`, `lotto_id null` (null per prodotti `solo_uso` senza lotto registrato — ma di solito c'è),
- `tipo` ∈ `carico|scarico|rettifica_pos|rettifica_neg|scarto_scadenza`,
- `quantita numeric` (sempre positiva),
- `costo_unitario numeric`,
- `seduta_id null`, `paziente_id null` (tracciabilità lotto→paziente),
- `operatore_id`, `note text`, `motivazione text` (obbligatoria per rettifiche),
- `data_movimento timestamptz default now()`,
- `modalita_snapshot text` (snapshot della modalità prodotto al momento del movimento, per storico).

### Trigger
1. `trg_movimento_aggiorna_lotto` — aggiorna `prodotto_lotto.quantita_disponibile` solo se prodotto è `tracciato`. RAISE se diventa < 0.
2. `trg_audit_magazzino` — log su prodotto/lotto/marca/fornitore.

### Estensione `seduta`
- `magazzino_scaricato bool default false` — anti doppio scarico se la seduta viene de-completata e ri-firmata.

### Funzione `magazzino_consuma_seduta(seduta_id)` (SECURITY DEFINER)
- Per ogni prodotto previsto:
  - Se `tracciato`: applica FEFO o usa lotto specificato in input → movimento `scarico`.
  - Se `solo_uso`: crea movimento `scarico` informativo (senza decremento).
  - Se `standby`: ignora con warning.
- Idempotente.

### RLS (pattern coerente con esistente)
- SELECT/INSERT/UPDATE: operatori attivi
- DELETE prodotto/lotto/marca/fornitore: solo medico
- `magazzino_movimento`: INSERT operatori, no UPDATE, DELETE solo medico

## 2. Backend (`src/server/magazzino.functions.ts`)
- `listProdotti({ search, modalita?, marca_id? })`
- `creaProdotto / aggiornaProdotto / cambiaModalita(prodotto_id, nuova) / disattivaProdotto`
- `creaProdottoInline` — versione veloce per modal seduta (richiede solo nome + unita)
- `listMarche / creaMarca / disattivaMarca`
- `listFornitori / creaFornitore / aggiornaFornitore`
- `listLotti({ prodotto_id?, includiEsauriti })` (esclude di default `quantita=0`)
- `creaLotto(prodotto_id, numero, scadenza, qta, costo)` — = carico iniziale + movimento
- `aggiungiCarico(lotto_id, qta, costo)` — ricarico stesso lotto
- `creaLottoInline(prodotto_id, numero, scadenza)` — carico + scarico same-tx (per inline seduta)
- `registraScaricoManuale(lotto_id, qta, motivo)` — sprechi/scaduti
- `rettificaInventario(lotto_id, qta_reale, motivazione)`
- `listMovimenti({ prodotto_id?, lotto_id?, paziente_id?, dal, al, tipo? })`
- `dashboardMagazzino()` → valore totale, # in scadenza <30gg, # sotto soglia, top 10 usati 90gg, # rettifiche mese
- `consumaSeduta(seduta_id, righe)` — chiamata dal flusso seduta, accetta override per riga (lotto_id scelto, qta finale, lotto inline)
- `ripristinaSeduta(seduta_id)` — se seduta de-completata, crea movimenti reverse
- `exportExcel({ tipo, dal?, al? })`

## 3. UI

### Nuova route `/magazzino` (voce in `app-layout.tsx`)
4 tab:

**Prodotti** — tabella: nome, marca, modalità (badge), qta totale (solo tracciati), # lotti, costo medio, soglia, stato.
- Filtri: ricerca, marca, modalità, "nascondi standby"
- Click → drawer dettaglio: lista lotti + storico movimenti + bottone "Cambia modalità"
- "+ Nuovo prodotto", "+ Carico lotto"

**Lotti** — vista per lotto: prodotto, lotto, scadenza, qta, costo, badge.
- Badge: rosso (scade <30gg), giallo (sotto soglia), grigio (esaurito), verde (ok)
- Azioni: "Scarico manuale", "Rettifica inventario"

**Movimenti** — log filtrabile (data, prodotto, tipo, operatore, paziente, seduta).
- Per movimenti su `solo_uso` icona distintiva "informativo".

**Dashboard** — card: valore totale (€, solo tracciati), # in scadenza, # sotto soglia, # rettifiche mese, top 5 usati 90gg. Bottoni export Excel.

### Anagrafiche (modali)
- Marche e Fornitori: lista + add + soft-delete (toggle attivo).

### `<ProdottoCombobox>`
- Riusato in `piani-panel` e `consumo-step`.
- Mostra modalità come piccolo badge.
- Esclude `standby`.
- Voce "+ Nuovo prodotto" inline.

### `<ConsumoMagazzinoStep>` (in `sedute-panel`)
- Mostrato PRIMA della firma seduta.
- Pre-popolato con `prodotti_previsti` del piano (tenendo conto di `prodotti_per_seduta`).
- Per ogni riga:
  - Prodotto (modificabile, con badge modalità)
  - Lotto (combobox FEFO + opzione "+ Nuovo lotto" inline)
  - Quantità (modificabile)
  - Bottone "rimuovi"
- "+ Aggiungi prodotto extra"
- Avvisi inline:
  - Lotto scade <30gg → warning giallo
  - Quantità richiesta > disponibile su lotto → warning + offre split su più lotti o "ignora scarico (richiede motivazione)"
  - Prodotto `solo_uso` → info: "registrato senza decremento"
- Bottone "Conferma e firma" → consuma + procede al flusso firma esistente.

### Accesso rapido
- Sidebar voce "Magazzino"
- Scheda paziente → tab Sedute → su seduta completata bottone "Aggiungi consumo retroattivo"
- Da `/piani` → combobox pesca da magazzino

## 4. Integrazione flussi esistenti

### `sedute-panel.tsx`
- Hook attuale "Esegui seduta" → ora apre ConsumoMagazzinoStep → poi firma esistente.
- Su de-completamento → chiama `ripristinaSeduta` (reverse movimenti tracciati).

### `piani-panel.tsx`
- `<ProdottoCombobox>` sostituisce il selettore basato su `PRODOTTI_DEMO`.
- Migrazione dati: nella migration, mappo gli `id` demo (vistabex-50, profhilo, …) creando i `prodotto` reali corrispondenti (modalità default `solo_uso`) e riscrivo i JSONB di `piano_trattamento_voce.prodotti_previsti` e `prodotti_per_seduta` con i nuovi UUID. `seduta.prodotti_previsti` analogamente.

### `seduta_sync_diario`
- Aggiornato: include nome lotto consumato accanto al prodotto. Es: "Profhilo (lotto P24-15) x1".

### `prodotti-demo.ts`
- Marcato deprecato, mantenuto come fallback solo se DB vuoto.

### `trattamenti.ts` types
- `ProdottoPrevisto.lotto_id?: string | null` — opzionale, per snapshot a posteriori.

## 5. Export Excel
3 fogli: Stato magazzino (solo tracciati con qta), Movimenti (range data), Costi mensili per tipologia.
Generato server-side con `xlsx` skill, ritornato come blob → download browser.

## 6. Validazioni
Zod su tutti gli input. Quantità > 0, costi ≥ 0, motivazione rettifica ≥ 10 char. Lotto al volo richiede almeno numero_lotto.

## 7. Out of scope (chiedimi se vuoi inclusi)
- Kit predefiniti per trattamento (oggi i prodotti previsti sul piano fanno già da kit)
- Report margine per trattamento (facile aggiungere in dashboard: prezzo seduta − somma costi scaricati)
- Riordino automatico, barcode

## 8. File

### Nuovi
- `supabase/migrations/<ts>_magazzino.sql`
- `src/server/magazzino.server.ts`, `src/server/magazzino.functions.ts`
- `src/types/magazzino.ts`
- `src/routes/_authenticated/magazzino.index.tsx`
- `src/components/magazzino/` → `prodotti-tab.tsx`, `lotti-tab.tsx`, `movimenti-tab.tsx`, `dashboard-tab.tsx`, `prodotto-form-dialog.tsx`, `lotto-form-dialog.tsx`, `marca-fornitore-manager.tsx`, `prodotto-combobox.tsx`, `consumo-step.tsx`, `rettifica-dialog.tsx`
- `src/lib/magazzino-export.ts`

### Modificati
- `src/components/app-layout.tsx` — voce sidebar
- `src/components/paziente/sedute-panel.tsx` — ConsumoStep prima firma
- `src/components/paziente/piani-panel.tsx` — combobox reale
- `src/types/trattamenti.ts` — `lotto_id?` opzionale
- `src/lib/prodotti-demo.ts` — deprecato

## 9. Ordine esecuzione
1. Migration DB (tabelle, trigger, funzioni, migrazione dati demo)
2. Server functions + types
3. Route `/magazzino` con 4 tab + anagrafiche
4. ProdottoCombobox + integrazione piani
5. ConsumoMagazzinoStep + integrazione sedute (con creazione inline)
6. Funzione inventario/rettifica
7. Export Excel

---

**Procedi?** Default modalità prodotto = `solo_uso` → puoi iniziare a usare il modulo subito senza dover caricare niente, e promuovi a `tracciato` solo i prodotti che vuoi davvero contare.