## Refactor "Nuovo trattamento" → Catalogo trattamenti standardizzato

Trasformiamo il dialog in un form compatto con campi dinamici e collegamento obbligatorio a un consenso template.

### Nota su DB (richiede conferma)

Il vincolo dice "NON modificare tabelle esistenti", ma i nuovi campi obbligatori (`tipo`, `durata_ciclo`, `consenso_template_id`) non hanno colonne dove salvarsi. Senza persistenza, il dato si perde a ogni reload e la logica firma non può leggerlo.

Proposta minima **additiva** (nessuna modifica a colonne esistenti, nessuna nuova tabella, nessuna FK rotta, nessun RLS toccato):

```sql
ALTER TABLE trattamenti
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('singolo','ciclo')),
  ADD COLUMN IF NOT EXISTS durata_ciclo_valore integer,
  ADD COLUMN IF NOT EXISTS durata_ciclo_unita text CHECK (durata_ciclo_unita IN ('giorni','settimane','mesi')),
  ADD COLUMN IF NOT EXISTS consenso_template_id uuid REFERENCES consenso_template(id);
```

Tutte nullable per non rompere righe esistenti. Se questa aggiunta non è accettabile, l'unica alternativa è degradare i nuovi campi a "solo UI" (non persistiti) — sconsigliato.

### Modifiche UI (`src/routes/_authenticated/trattamenti.index.tsx`)

Form `TrattamentoDialog` ricostruito, compatto, in quest'ordine:

1. **Nome trattamento** — `Input` testo, obbligatorio.
2. **Tipo trattamento** — `RadioGroup` (`singolo` | `ciclo`), obbligatorio.
3. **Durata ciclo** — visibile **solo se** `tipo === 'ciclo'`:
   - input numerico (obbligatorio in quel caso)
   - `Select` unità: `giorni` / `settimane` / `mesi`
4. **Categoria** — `Select` chiuso con valori fissi:
   `tossina_botulinica`, `filler`, `biostimolazione`, `peeling`, `device`, `altro`.
5. **Consenso associato** — `Select` da `consenso_template` (solo `attivo = true`), obbligatorio.
6. **Durata (minuti)** — `Input` numerico opzionale.
7. **Prezzo indicativo (€)** — `Input` numerico opzionale.

Rimossi: campo `Descrizione` (Textarea) e categoria libera in input testo.

### Validazioni in `save()`

- `nome` non vuoto
- `tipo` ∈ {singolo, ciclo}
- se `tipo === 'ciclo'` → `durata_ciclo_valore > 0` e `durata_ciclo_unita` selezionata
- `consenso_template_id` non vuoto
- toast errore italiano per ogni regola

### Card list (sezione catalogo)

Aggiornata per mostrare i nuovi metadati in modo discreto:
- badge `Singolo` / `Ciclo Nx unità`
- nome del consenso collegato (subtitle piccolo)
- categoria già presente, ora dal set chiuso

Nessuna modifica a stili globali.

### Tipi (`src/types/trattamenti.ts`)

Estendere l'interfaccia `Trattamento` con i nuovi campi opzionali e aggiungere:

```ts
export type TrattamentoTipo = 'singolo' | 'ciclo';
export type DurataUnita = 'giorni' | 'settimane' | 'mesi';
export const TRATTAMENTO_CATEGORIE = [
  'tossina_botulinica','filler','biostimolazione','peeling','device','altro'
] as const;
```

Label map italiana per il dropdown.

### Cosa NON tocco

- `consenso_template`, `consenso_firmato`, signature session, `anamnesi*`, RLS, edge functions, share link.
- Logica firma esistente: il campo `consenso_template_id` su `trattamenti` viene **solo letto** dal flusso firma trattamento in iterazioni future; in questo task lo persistiamo soltanto.

### File toccati

- `supabase/migrations/<timestamp>_trattamenti_catalogo.sql` (additivo)
- `src/integrations/supabase/types.ts` (rigenerato)
- `src/types/trattamenti.ts`
- `src/routes/_authenticated/trattamenti.index.tsx`

### Conferma richiesta

Procedo con la migrazione additiva sopra? È l'unico modo per rispettare sia "campi obbligatori persistiti" sia "nessuna nuova entità / nessuna modifica strutturale alle tabelle esistenti" (aggiunge solo colonne nullable).