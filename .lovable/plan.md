Diviso in due step indipendenti. Lo STEP A è pronto da implementare. Lo STEP B richiede la tua conferma sui dettagli. La "prima visita / visita di controllo" la lasciamo apposta fuori: la affrontiamo dopo in una mini-discussione dedicata (vedi in fondo).

---

## STEP A — Fix UI e bug rapidi

### A1. Bug "input Sedute" nel nuovo piano

Oggi `value={r.numero_sedute}` è un number controllato che ad ogni keystroke fa `Math.max(1, Math.floor(n||1))`. Quando cancelli "1" la stringa diventa vuota, `Number("") = 0`, viene risostituito da `1` e l'8 si attacca dopo → "18".

Fix:

- Nuovo componente `NumberInputSedute` (interno a `piani-panel.tsx`) con state stringa locale.
- Durante digitazione lo state è libero (anche vuoto). Su `onBlur` (o Invio) committa: clamp tra `min` e valore valido, fallback al min se vuoto/non valido.
- Stesso pattern riusato nei posti in cui c'è `type="number"` con clamp aggressivo (verifica anche `magazzino` e `lotto-form-dialog`, se applicabile).

### A2. Sfarfallio "Something went wrong" durante navigazione

Il `defaultErrorComponent` in `src/router.tsx` mostra subito il full-screen rosso. Tra una rotta e l'altra capita un breve errore transitorio (es. query cancellata, Suspense che ricarica) → flash.

Fix:

- Mostrare la UI di errore solo dopo un delay (es. 250 ms): se nel frattempo arriva un nuovo render (errore sparito) non si vede nulla.
- Sopprimere completamente errori "innocui": `AbortError`, `CancelledError`, `Failed to fetch dynamically imported module` (già gestito a parte con reload).
- Aggiungere `key={location.pathname}` al boundary in `__root.tsx` se necessario per resettarlo al cambio rotta.

### A3. Grafici Insights — niente "nero"

In `src/routes/_authenticated/insights.tsx`:

- `BarChart` "Costi magazzino" usa `fill="hsl(var(--muted-foreground))"` → cambio a un accent più morbido (definisco token semantico `--chart-cost` in `src/styles.css` con `oklch` neutro/ambra).
- Aggiungo nei tokens 2–3 colori chart coerenti (`--chart-1` primary, `--chart-2` teal, `--chart-3` ambra, `--chart-4` viola tenue), riusati in tutti i `Bar/Line/Pie`.
- Verifico anche tick assi: tengo `muted-foreground` per testo (è grigio non nero).

### A4. Consensi obsoleti — apertura filtrata

- Cambio il link dell'alert dashboard da `/consensi` a `/consensi?filtro=obsoleti`.
- In `src/routes/_authenticated/consensi.index.tsx` leggo il search param e applico filtro pre-impostato (badge "Obsoleti" attivo). La sezione mostra elenco: paziente · template · versione firmata → versione attuale · azione "Rifirma" già esistente.
- Nessuna nuova entità.

---

## STEP B — Protocolli e parametri clinici (richiede tua conferma)

Aderisce esattamente alla tua specifica: **niente nuova entità "Pacchetto"**, le righe del piano restano la base, i "protocolli" sono solo template che generano righe standard.

### B1. Protocolli preimpostati (template righe piano)

Schema:

- `protocollo_template` ( id, nome, descrizione, attivo, created_by, ... )
- `protocollo_template_riga` ( id, protocollo_id, trattamento_id, numero_sedute, ordine, note )

Nessuna scrittura su `piano_trattamento`: il protocollo serve solo a precompilare il dialog "Nuovo piano".

UI:

- In `piani-panel.tsx`, nel dialog di creazione, in alto un selettore "Applica protocollo…" (combobox). Selezionandolo, vengono aggiunte le righe del template ai dati già presenti (non sostituisce: si appende, con possibilità di rimuovere). Resta tutto modificabile.
- In "Impostazioni → Trattamenti" nuova tab "Protocolli" per CRUD.

Esempio "Body shaping" = 1 criolipolisi + 8 onde d'urto + 4 carbossi → genera 3 righe piano standard.

### B2. Parametri clinici dinamici per trattamento

Schema:

- `trattamenti` → nuova colonna `schema_parametri jsonb` (array di campi: `{ key, label, tipo: 'number'|'text'|'select'|'bool', unita?, options?, obbligatorio? }`).
- `seduta` ha già `parametri_tecnici jsonb` — lo usiamo come storage senza modifiche.
- Storico per paziente: query già fattibile join `seduta.parametri_tecnici` per trattamento (no nuova tabella).

UI:

- In "Impostazioni → Trattamenti" editor schema parametri (lista campi drag-friendly, semplice).
- Nel dialog di completamento seduta (`sedute-panel.tsx` → completa): se il trattamento ha `schema_parametri`, mostra una mini-form generata; salva in `parametri_tecnici`.
- Sulla scheda paziente, sotto "Storico parametri" (collapsible) per ciascun trattamento: tabella semplice (data · valori). Niente grafici qui per non gonfiare.

> Importante: peso/altezza/BMI/circonferenze restano dove sono (Anamnesi → Misurazioni). Il sistema di parametri NON li duplica; sono concettualmente dati paziente, non di seduta.

### B3. Sedute combinate nello stesso appuntamento

La struttura attuale già lo consente: più sedute (di righe piano diverse) possono condividere lo stesso `evento_calendario` o avere stesso `data_seduta`. Non servono modifiche di schema.

- Piccolo miglioramento UX: nel calendario raggruppo le sedute con stessa data/ora/paziente in un'unica card con badge "+N trattamenti". Solo presentazione.

---

## Tabella riassuntiva tecnica (per chi conosce il codice)


| Fix                 | File principali                                                                               | Tipo  |
| ------------------- | --------------------------------------------------------------------------------------------- | ----- |
| A1 numero sedute    | `src/components/paziente/piani-panel.tsx`                                                     | UI    |
| A2 flash errore     | `src/router.tsx`, `src/routes/__root.tsx`                                                     | UI    |
| A3 colori grafici   | `src/routes/_authenticated/insights.tsx`, `src/styles.css`                                    | UI    |
| A4 filtro consensi  | `src/components/dashboard/alerts-section.tsx`, `src/routes/_authenticated/consensi.index.tsx` | UI    |
| B1 protocolli       | nuova migration + tab impostazioni + dialog piano                                             | DB+UI |
| B2 parametri        | migration `trattamenti.schema_parametri` + editor + form seduta                               | DB+UI |
| B3 sedute combinate | `src/components/calendario/calendario-vista.tsx` (raggruppamento)                             | UI    |


---

## Prima visita / Visita di controllo — lasciata FUORI dal piano

Hai chiesto esplicitamente di ragionarci prima. Riassunto delle opzioni che valuteremo dopo la tua approvazione di A/B:

1. **Prestazione collegata all'appuntamento** (semplice ma slegata da piano e KPI economici).
2. **Voce nel piano** (coerente con incassi, ma rigida se non c'è piano).
3. **Entità "incontro" leggera** (anamnesi/visita/controllo) con prezzo, slegata dalle sedute, che alimenta KPI e si può "scontare" su un piano futuro.
4. **Suggerimento contestuale**: alla creazione del piano si chiede "questo paziente ha fatto una prima visita non ancora scalata? → applica sconto".

La discussione la apro dopo, con pro/contro dettagliati e flussi.

---

## Cosa ti chiedo prima di passare in build

- Confermi STEP A intero? (lo posso fare subito, basso rischio) sì
- Confermi STEP B così com'è (protocolli + parametri dinamici + raggruppamento calendario)? Posso anche fare solo B1 prima e B2/B3 in un secondo round se preferisci procedere a piccoli passi. facciamo tutto dopo step by step. magari ci stiamo perdendo la soluzione più semplice