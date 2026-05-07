## 1) Decisione clinica come step 0 di "Nuovo piano"

L'idea: il dialog "Nuovo piano" diventa "Decisione terapeutica". Prima di compilare qualunque cosa, chiediamo **"Come procedere?"** con 3 opzioni. La compilazione successiva cambia in base alla scelta. Tutte e 3 lasciano una **card visibile nel tab Piani**, così non si perde mai traccia clinica.

### Step 0 — Come procedere?

```text
Come procedere?
○ Procedi con un piano       → flow piano normale + campo "trattamento richiesto" opzionale
○ In attesa                  → documenti / approfondimenti, niente piano operativo
○ Non indicato               → motivo, niente piano
[Continua]
```

### Comportamenti per ogni scelta

**A. Procedi con un piano**

- Mostra il flow attuale (trattamenti, sedute, prodotti, zone, prezzi).
- Aggiunto un campo opzionale **"Trattamento richiesto dal paziente"** (testo libero o select su `trattamenti`). Se diverso da quello pianificato, il sistema sa che c'è stato un cambio di rotta.
- Stato risultante: `bozza` → `attivo` come oggi.

**B. In attesa**

- Niente compilazione piano.
- Mini-form:
  - tipo: `documentazione` | `approfondimento` | `rivalutazione`
  - descrizione (es. "esami coagulazione", "visita dermatologica")
  - scadenza opzionale
  - note
- Stato risultante: `in_attesa` (nuovo valore enum `piano_stato`).
- Card nel tab Piani: badge giallo "⏳ In attesa — esami coagulazione" + bottone **"Converti in piano"** quando il paziente porta quanto richiesto.

**C. Non indicato**

- Niente compilazione piano.
- Mini-form:
  - trattamento valutato (richiesto dal paziente, opzionale)
  - motivo: `anatomia_non_idonea` | `aspettative_non_realistiche` | `controindicazione` | `paziente_ha_rifiutato` | `altro`
  - nota libera
- Stato risultante: `non_indicato` (nuovo valore enum).
- Card nel tab Piani: badge rosso "❌ Filler non indicato — controindicazione" + bottone **"Riapri come piano"** se cambia idea.

### Tab "Piani" diventa de facto "Decisioni terapeutiche"

- Il nome resta "Piani" (zero attrito mentale per l'utente).
- Ogni card mostra il badge stato: bozza / attivo / sospeso / completato / annullato / **in_attesa** / **non_indicato**.
- Card "in_attesa" e "non_indicato" sono compatte: niente sedute, niente prezzo, solo badge + motivo + azioni (modifica / converti in piano / annulla / archivia).

### Diario auto-generato

Ogni decisione (anche non-piano) crea una nota diario tipo `clinica`:

- "Decisione: in attesa esami coagulazione (filler labbra)"
- "Decisione: filler non indicato — controindicazione anticoagulanti"
- "Piano creato: botox + biostimolazione (richiesto inizialmente: filler)"

### Calendario / nuovo evento

Se il paziente ha solo decisioni `in_attesa` o `non_indicato` aperte e nessun piano `attivo`, mostrare toast non-bloccante quando si tenta di prenotare una seduta: "Questo paziente ha solo decisioni in sospeso. Prenotare comunque?"

---

## 2) Modello dati (minimo invasivo)

Estendere `piano_trattamento` invece di creare nuove tabelle.

### Migrazione

```sql
-- nuovi valori enum
alter type piano_stato add value 'in_attesa';
alter type piano_stato add value 'non_indicato';

-- nuove colonne sul piano
alter table piano_trattamento
  add column tipo_decisione text not null default 'piano'
    check (tipo_decisione in ('piano','in_attesa','non_indicato')),
  add column trattamento_richiesto_id uuid references trattamenti(id),
  add column trattamento_richiesto_testo text,        -- fallback libero
  add column attesa_tipo text check (attesa_tipo in ('documentazione','approfondimento','rivalutazione')),
  add column attesa_descrizione text,
  add column attesa_scadenza date,
  add column non_indicato_motivo text
    check (non_indicato_motivo in ('anatomia_non_idonea','aspettative_non_realistiche','controindicazione','paziente_ha_rifiutato','altro')),
  add column decisione_nota text,
  add column convertito_da_piano_id uuid references piano_trattamento(id);
```

Vincolo logico (trigger):

- `tipo_decisione = 'piano'` → `numero_sedute_previste >= 1`, voci richieste.
- `tipo_decisione = 'in_attesa'` → `attesa_tipo` obbligatorio, niente voci.
- `tipo_decisione = 'non_indicato'` → `non_indicato_motivo` obbligatorio, niente voci.

### "Converti in piano"

Crea un nuovo `piano_trattamento` con `tipo_decisione='piano'`, `convertito_da_piano_id = <id originale>`, e marca l'originale come `annullato` (resta in archivio per memoria storica). Una riga di diario lega le due cose.

---

## 3) UI — file da toccare

- `**src/components/paziente/piani-panel.tsx**`: rendering card differenziato per `tipo_decisione`. Badge, azioni "Converti in piano" / "Riapri come piano".
- `**src/components/paziente/piano-form-dialog.tsx**` (o equivalente attuale del "Nuovo piano"): aggiungere step 0 "Come procedere?" con `RadioGroup`. Switch a sub-form in base alla scelta.
- **Nuovi sub-componenti**:
  - `src/components/paziente/piano-attesa-form.tsx`
  - `src/components/paziente/piano-non-indicato-form.tsx`
  - Il form "piano" attuale resta com'è, solo aggiunto il campo "trattamento richiesto dal paziente".
- `**src/types/trattamenti.ts**`: estendere `PianoStato` e `PianoTrattamento` con i nuovi campi.
- `**src/components/calendario/evento-edit-dialog.tsx**`: toast informativo se il paziente ha solo decisioni in sospeso.
- **Diario**: trigger lato DB o helper TS che crea la nota su insert/update di una decisione.

---

## 4) Toggle "Mostra archiviati" uniforme

Sostituire il bottone con `Switch + Label` (pattern già usato in `consensi.index.tsx`):

```tsx
<div className="flex items-center justify-end gap-2">
  <Switch id="mostra-archiviati-<scope>" checked={...} onCheckedChange={...} />
  <Label htmlFor="mostra-archiviati-<scope>" className="text-xs text-muted-foreground">
    Mostra archiviati
  </Label>
</div>
```

File:

- `src/routes/_authenticated/pazienti.index.tsx`
- `src/routes/_authenticated/trattamenti.index.tsx`
- `src/routes/_authenticated/magazzino.index.tsx`

---

## Ordine di esecuzione

1. Toggle archiviati uniforme (5 minuti, zero rischio).
2. Migrazione DB: nuovi enum + colonne + trigger di vincolo.
3. Step 0 "Come procedere?" nel dialog Nuovo piano.
4. Sub-form "In attesa" e "Non indicato" + rendering card differenziato nel tab Piani.
5. Conversione decisione → piano + scrittura diario automatica.
6. Toast non-bloccante in calendario.

## Domande

1. **Le decisioni "Non indicato" devono comparire di default nel tab Piani o nascoste dietro "Mostra archiviati"?** (Io direi: visibili sempre, è memoria clinica. Si archiviano solo manualmente.)  
  
ok visibili sempre
2. **Quando una decisione "In attesa" viene convertita in piano, la card originale resta visibile o sparisce?** (Io direi: resta come "annullato/convertito" se attivi "Mostra archiviati", altrimenti nascosta — c'è il link di tracciabilità.)  
  
ok resta come "annullato/convertito" se attivi "Mostra archiviati", altrimenti nascosta — c'è il link di tracciabilità