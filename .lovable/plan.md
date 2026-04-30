## Obiettivo

Quattro fix in un unico passaggio:

1. Alert "Consenso mancante" sotto al nome paziente non deve apparire per piani in **bozza** o **annullato**.
2. Banner "Foto baseline mancanti" non deve apparire per piani in **bozza** o **annullato**.
3. Dialog "Nuovo evento" calendario: dopo l'inizio, scelta tra **durata** (default, con preset) e **fine specifica**.
4. Dialog "Nuovo prodotto" magazzino: il combobox "Tipologia" deve scrollare quando le voci sono molte.

---

### 1. Alert consenso piani — `src/routes/_authenticated/pazienti.$id.tsx`

Funzione `load`, query piani (~riga 146-150). Sostituire:
```ts
.neq("stato", "annullato")
```
con:
```ts
.not("stato", "in", "(annullato,bozza)")
```

Risultato: il banner "Consenso mancante per N trattamento/i" scompare per le proposte e per i piani annullati.

---

### 2. Banner foto baseline — `src/components/foto/foto-baseline-banner.tsx`

Aggiungere filtro stato sui piani recuperati:
```ts
const { data: piani } = await supabase
  .from("piano_trattamento")
  .select("id")
  .eq("paziente_id", paziente_id)
  .not("stato", "in", "(bozza,annullato)");
```

Risultato: il banner appare solo per piani attivi/sospesi/completati.

---

### 3. Dialog evento calendario — `src/components/calendario/evento-edit-dialog.tsx`

Sostituire il campo "Fine" libero con un blocco a due modalità:

**UI (sotto a "Inizio"):**
```
[Inizio *: datetime-local]
Modo:  ⦿ Durata    ○ Fine
  ↳ Durata: [60 min ▾]   Preset: 15 30 45 60 90 120
  ↳ Fine:   [datetime-local]
```

**Stato aggiuntivo:**
- `modoFine: "durata" | "fine"` (default `"durata"`)
- `durataMinuti: number` (default 60)

**`useEffect` di apertura:**
- Nuovo evento → `modoFine="durata"`, `durataMinuti=60`, `dataFine=""`.
- Modifica evento esistente con `data_fine`: calcola `diffMin = (end-start)/60000`. Se multiplo di 5 e ≤ 480 → `modoFine="durata"`, `durataMinuti=diffMin`. Altrimenti `modoFine="fine"`, `dataFine=...`.
- Modifica evento senza `data_fine` → `modoFine="durata"`, `durataMinuti=60`.

**`handleSave`:**
- modo durata: se `durataMinuti > 0` → `data_fine = new Date(start + durataMinuti*60_000).toISOString()`, altrimenti `null`.
- modo fine: come oggi; se `dataFine && dataFine < dataInizio` → toast errore e stop.

Preset durata: bottoni piccoli `15, 30, 45, 60, 90, 120` che impostano `durataMinuti`.
Toggle modo: `RadioGroup` o due bottoni segmentati.

**Tutto il giorno:** se attivo, nasconde sia il blocco durata che il blocco fine (come comportamento attuale che ignora la fine, ma esplicitato visivamente).

---

### 4. Combobox Tipologia — `src/components/magazzino/prodotto-form-dialog.tsx`

`CommandList` (~riga 215) senza altezza massima → niente scroll. Aggiungere:
```tsx
<CommandList className="max-h-64 overflow-y-auto">
```

---

### File modificati

- `src/routes/_authenticated/pazienti.$id.tsx` — filtro query (1 riga)
- `src/components/foto/foto-baseline-banner.tsx` — filtro query (1 riga)
- `src/components/calendario/evento-edit-dialog.tsx` — refactor sezione date inizio/fine
- `src/components/magazzino/prodotto-form-dialog.tsx` — className su CommandList (1 riga)

Nessuna modifica DB.
