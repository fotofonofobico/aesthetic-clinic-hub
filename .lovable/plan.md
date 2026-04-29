## Problema

Cliccando **"+ Riga"** in *Consumo magazzino* dentro il dialog *Esegui seduta* la scheda paziente va in errore con:

> `null is not an object (evaluating 'resolveDispatcher().useMemo')`

È un errore React interno: un hook (`useMemo`) viene invocato fuori da un render valido. La causa più probabile, leggendo il codice attuale, è il sotto-componente `ProdottoCombobox` che monta `<Popover>` + `<Command>` (cmdk) **dentro un `<Dialog>` Radix nidificato** (il dialog "Esegui seduta") e fa partire subito un `useEffect` con `listProdotti()`. La combinazione (Popover/Command + portal in dialog + render multipli all'aggiunta di righe) fa esplodere cmdk in modo non recuperabile.

In più:
- Il `useEffect` di `ProdottoCombobox` ha `[open]` come deps ⇒ rifà la query a ogni apertura, e parte subito al mount. Più righe = più fetch in parallelo, e ogni nuovo prodotto creato non aggiorna le altre combobox.
- Il `<Select>` lotto usa il valore sentinella `"__auto__"` / `"__new__"` ma è dentro un Dialog — funziona, ma l'errore ne impedisce l'apertura.
- `ProdottoFormDialog` è renderizzato **dentro** `ConsumoMagazzinoStep` ⇒ Dialog dentro Dialog dentro Popover. Anche questo contribuisce alla fragilità.

## Soluzione

Sostituisco la combobox con un **componente più semplice e robusto** dedicato all'uso *inline in seduta*, eliminando Popover+Command annidati nel Dialog. Il selettore prodotto diventa:

- **`<Select>` Radix** (stesso pattern già usato altrove nel dialog seduta, quindi sicuro).
- Una **`<Input>` di ricerca** sopra al Select per filtrare la lista (no cmdk).
- Pulsante **"+ Nuovo prodotto"** che apre `ProdottoFormDialog` **a livello del dialog seduta** (non dentro al Popover), così non ci sono nesting strani.

Carico la lista prodotti **una sola volta** a livello di `ConsumoMagazzinoStep` (non per ogni riga) e la passo per props alle righe → meno fetch, refresh corretto dopo creazione di un nuovo prodotto.

### Cosa cambia in concreto

1. **`src/components/magazzino/consumo-step.tsx`**
   - `useEffect` unico che carica `listProdotti({ includiStandby: false })` e mantiene `prodotti` in stato locale.
   - Funzione `refreshProdotti()` chiamata dopo creazione inline.
   - Ogni riga riceve `prodotti` per props e usa un nuovo `<ProdottoSelectInline>` (vedi sotto) al posto di `ProdottoCombobox`.
   - `ProdottoFormDialog` montato **una sola volta** nel componente, fuori dal mapping delle righe.
   - Per il select lotto: aggiungo guardia: se `r._lotti` non è array lo tratto come `[]`; valori sentinella restano `__auto__` / `__new__` (mai stringa vuota).
   - Migliore gestione errori in `onProdottoSelect` (try/catch con toast).

2. **Nuovo `src/components/magazzino/prodotto-select-inline.tsx`**
   - Riceve `prodotti`, `value`, `onChange(id, prodotto)`, `onCreaNuovo`.
   - Render: piccolo `Input` di ricerca + `Select` con opzioni filtrate + opzione finale "➕ Nuovo prodotto…" (sentinella `__new__`).
   - Usa solo Radix `Select` (no cmdk, no Popover) → niente conflitti dentro Dialog.
   - Mostra badge modalità (Tracciato/Solo uso) accanto al nome.

3. **`src/components/magazzino/prodotto-combobox.tsx`** — **lasciato com'è** per la pagina `/magazzino` (lì funziona, non è dentro un Dialog).

### File toccati

- `src/components/magazzino/consumo-step.tsx` (refactor)
- `src/components/magazzino/prodotto-select-inline.tsx` (nuovo)

### Cosa NON cambio

- Logica di `consumaSeduta`, RPC, RLS, tipi, schema DB.
- Comportamento FEFO, lotto inline, "solo uso".
- Pagina `/magazzino` e gli altri dialog magazzino.

## Risultato atteso

- "+ Riga" non crasha più.
- Selezione prodotto funzionante anche con tastiera.
- Creazione "Nuovo prodotto" inline funzionante; il prodotto compare subito nella select.
- Selezione lotto FEFO/manuale/nuovo lotto invariata e funzionante.

## Test manuale dopo il fix

1. Apri scheda paziente → seduta → **Esegui**.
2. Premi **+ Riga** in *Consumo magazzino* — deve aggiungere la riga senza errore.
3. Seleziona un prodotto esistente *tracciato* → compare dropdown lotto con FEFO/lotti.
4. **+ Nuovo prodotto** → crea → torna alla riga col prodotto già selezionato.
5. Su un tracciato senza lotti scegli **+ Nuovo lotto inline** → compila → completa la seduta → verifica scarico.
