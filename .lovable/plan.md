## Obiettivo

Tre cambi strutturali importanti + due rifiniture UX. Riguardano: prodotti per seduta vs per ciclo, durata consensi misurata in sedute, default "data da definire" per le sedute programmate, pulizia UI lista pazienti.

---

## 1. Prodotti per seduta (non più per ciclo intero)

**Problema attuale**: nel piano si inseriscono i prodotti totali del trattamento (es. 3 fiale per la biostimolazione). Nella generazione delle sedute, lo stesso array `prodotti_previsti` viene clonato su OGNI seduta → 3 sedute × 3 fiale = 9 fiale "previste".

**Cambio di modello**: i prodotti diventano **per singola seduta** + opzionalmente differenziati seduta per seduta.

### Modifica al form Piano (componente `piani-panel.tsx`)
- Per ogni voce di trattamento, l'utente vede una sezione "Prodotti per seduta" con due modalità:
  - **Stessi prodotti su tutte le sedute** (default, semplice): un'unica lista applicata a ogni seduta del ciclo.
  - **Prodotti diversi per seduta** (toggle "Personalizza per seduta"): mostra N tab/righe (1 per ogni seduta prevista), ognuna con la propria lista prodotti.
- Etichetta chiara: "Prodotti per ciascuna seduta (×N sedute previste)".
- Riepilogo a fine voce: "Totale fiale ciclo: 3 × 3 sedute = 9 fiale" così si capisce subito il consumo aggregato.

### Modifica DB
- `piano_trattamento_voce.prodotti_previsti` resta com'è (è lo "schema base" della seduta tipo).
- Aggiunta colonna nuova: `piano_trattamento_voce.prodotti_per_seduta jsonb` nullable. Quando valorizzato è `[ [prodotti_seduta1], [prodotti_seduta2], … ]`. Quando NULL si replica la lista base.
- La generazione sedute prende, per la seduta n, l'array all'indice n-1 di `prodotti_per_seduta` se presente, altrimenti `prodotti_previsti`.

### Modifica visualizzazione
- Nel pannello Piani (sia card collassata che riepilogo voce) si mostra: "1.8% × 1 fiala · 2.2% × 0 fiale" come prodotti **per seduta**, con sotto in muted "totale ciclo: 3 fiale".
- Nel pannello Sedute, ogni card seduta mostra solo i propri prodotti (che già è così — il bug era nella generazione).

---

## 2. Durata consenso ciclo misurata in numero sedute

**Problema attuale**: i template consenso "ciclo" hanno `validita_mesi` (es. 12 mesi). Per cicli brevi è poco coerente: il consenso dovrebbe scadere quando finisce il ciclo, non per data.

### Cambio modello
- Aggiunta a `consenso_template`: colonna `durata_tipo text` con valori `mesi` | `sedute` (default `mesi` per retrocompatibilità). Aggiunta `durata_sedute integer` nullable.
- Aggiunta a `consenso_firmato`: colonna `durata_tipo_snapshot`, `durata_sedute_snapshot`, `sedute_consumate integer default 0`, `sedute_max_snapshot integer` nullable.
- La RPC `paziente_consensi_stato` viene aggiornata per gestire entrambi i casi:
  - `mesi`: come oggi (confronta `valido_fino_a` con `now()`).
  - `sedute`: il consenso è `expired` se `sedute_consumate >= sedute_max_snapshot`, `expiring` quando ne resta 1, altrimenti `valid`.
- Trigger su `seduta` (after update completata=true): incrementa `sedute_consumate` sul consenso firmato collegato (lookup via paziente + template del trattamento + consenso valido più recente).

### Modifica UI
- **Form template consenso (Consensi → nuovo/modifica)**: per categoria `trattamento_ciclo` mostra radio "Validità" → `Per N mesi` | `Per N sedute`. Selezionando "sedute", l'input chiede il numero (default = numero sedute previste dal trattamento collegato, se uno solo).
- **Form trattamento ciclo**: il messaggio già presente ("✔ Consenso ciclo: valido per tutta la durata del trattamento") diventa accurato — mostra "valido per N sedute" o "per N mesi" letto dal template.
- **Cronologia consensi paziente**: mostra "Validità: 3 sedute (1/3 usate)" oltre alla data.

---

## 3. Sedute programmate: data "da definire" di default

**Problema attuale**: alla creazione del piano, le sedute vengono inserite con `data_seduta = now()` (default DB), così risultano "in ritardo" subito dopo.

### Cambio
- `seduta.data_seduta` diventa nullable.
- Quando si genera una seduta dal piano (`piani-panel.tsx` → `creaPiano`/`modificaPiano` → `insertSed`), `data_seduta` viene esplicitamente passata come `null`.
- `statoSeduta()` in `seduta-helpers.ts` aggiunge il caso `da_definire` (badge neutro grigio) e NON la conta più tra "in ritardo" finché la data è null.
- Card seduta nel pannello Sedute mostra "Data da definire" con bottone inline "Pianifica" (apre il dialog reschedule esistente).
- Filtri/contatori della card riepilogo: `programmate` resta uguale, `in ritardo` esclude le `da_definire`, aggiunto contatore `da pianificare` se > 0.

---

## 4. Lista pazienti: rimuovere icone severity a sinistra del nome

In `pazienti.index.tsx` (lista) il componente `SeverityBadge` viene renderizzato accanto al nome. Va rimosso:
- Eliminare il rendering del badge severity nella riga lista.
- Rimuovere import `AlertTriangle, ShieldAlert, Info` non più usati e funzione `SeverityBadge`.
- Mantenuto invece il banner "stato" critico nella **scheda paziente** (`CriticalBanner` in `pazienti.$id.tsx`) — quello resta com'è.

> Nota: se per "schermata pazienti" intendi invece la scheda del singolo paziente (icona allergie accanto al nome in alto), dimmelo e in fase di implementazione tolgo quella invece. Dalla descrizione "logo a sn del nome … mantenere solo banner stato" interpreto la lista, perché nella scheda non c'è un'icona accanto al nome ma solo il banner critico.

---

## 5. Pulizia UX trasversale

- Tooltip/help nel form piano: "I prodotti indicati sono PER SEDUTA. Verranno usati su tutte le sedute generate."
- Riepilogo voce piano (sia card collassata che modifica) mostra tre dati in linea: `Prezzo riga · Sedute · Prodotti/seduta · Totale fiale ciclo`.
- Pannello sedute: stesso tag stato seduta in card e in audit dialog.
- Scheda paziente: il banner stato critico (consensi/anamnesi) resta in cima; aggiunto chip "Sedute da pianificare: N" quando > 0 (non blocca, solo informativo).

---

## Sezione tecnica

**File da modificare**:
- `supabase/migrations/<ts>_prodotti_per_seduta_e_consensi_per_sedute.sql`
  - `ALTER TABLE piano_trattamento_voce ADD COLUMN prodotti_per_seduta jsonb`
  - `ALTER TABLE consenso_template ADD COLUMN durata_tipo text DEFAULT 'mesi' CHECK (durata_tipo IN ('mesi','sedute')), ADD COLUMN durata_sedute int`
  - `ALTER TABLE consenso_firmato ADD COLUMN durata_tipo_snapshot text DEFAULT 'mesi', ADD COLUMN durata_sedute_snapshot int, ADD COLUMN sedute_consumate int NOT NULL DEFAULT 0, ADD COLUMN sedute_max_snapshot int`
  - `ALTER TABLE seduta ALTER COLUMN data_seduta DROP NOT NULL, ALTER COLUMN data_seduta DROP DEFAULT`
  - Aggiornamento RPC `paziente_consensi_stato` per gestire `durata_tipo='sedute'`
  - Trigger `trg_consenso_consuma_seduta` after update on seduta when (NEW.completata=true and OLD.completata=false): incrementa `sedute_consumate` sul consenso firmato attivo del paziente per quel trattamento
- `src/types/trattamenti.ts`: aggiungere campi a `ConsensoTemplate`, `ConsensoFirmato`, `PianoVoce`; estendere `Seduta.data_seduta` a `string | null`
- `src/lib/piano-prezzo.ts`: invariato (il prezzo per ciclo era già corretto, è solo il display dei prodotti che era confuso)
- `src/lib/seduta-helpers.ts`: aggiungere stato `da_definire` in `StatoSeduta` e gestirlo in `statoSeduta()`
- `src/lib/consensi-engine.ts`: aggiornare `STATO_BADGE` se serve nuovo wording, helper per "sedute residue"
- `src/components/paziente/piani-panel.tsx`:
  - UI prodotti con toggle "Personalizza per seduta"
  - `buildVocePayload` produce `prodotti_per_seduta` quando in modalità custom
  - `creaPiano`/`modificaPiano`: per ogni seduta n, scegli prodotti dall'array `prodotti_per_seduta[n-1]` se presente
  - Inserisci sedute con `data_seduta: null`
  - Riepilogo voce mostra "totale fiale ciclo"
- `src/components/paziente/sedute-panel.tsx`:
  - Card seduta gestisce `data_seduta === null` → "Data da definire" + bottone Pianifica
  - Filtro/conteggio in_ritardo esclude da_definire
- `src/routes/_authenticated/trattamenti.index.tsx`:
  - In `TrattamentoDialog`, aggiornare il messaggio consenso ciclo per leggere `durata_tipo` del template
- `src/components/paziente/consensi-panel.tsx`:
  - Form template: radio mesi/sedute per categoria ciclo
  - Cronologia: mostra "X/N sedute usate" per consensi a sedute
  - Snapshot al momento della firma copia anche `durata_tipo`/`sedute`
- `src/routes/_authenticated/pazienti.index.tsx`:
  - Rimuovere `SeverityBadge` dalla riga lista e import non usati

**Migrazioni dati legacy**: i piani esistenti restano con `prodotti_previsti` come prodotti-per-seduta (come fossero stati creati col modello nuovo). Le sedute già generate NON vengono toccate dalla migration — i prodotti già moltiplicati restano (è dato storico). Solo nuove generazioni useranno il nuovo modello. I template consenso esistenti restano `durata_tipo='mesi'`, nessun impatto.
