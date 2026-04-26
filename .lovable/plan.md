
## Obiettivo
Ristrutturare anagrafica e anamnesi secondo le tue specifiche, semplificare gli alert automatici, aggiungere il versioning e ripulire i dati esistenti.

---

## 1. Anagrafica — semplificazione

**Form `pazienti.$id.edit.tsx`:**
- Rimuovo dal form: `identita_genere`, `peso_kg`, `altezza_cm` (e relativo BMI).
- Campi visibili: nome, cognome, sesso, data nascita, luogo nascita, codice fiscale, email, telefono, indirizzo, città, CAP, provincia, professione, note.

**Scheda `pazienti.$id.tsx`:** rimuovo la card "Parametri corporei/BMI".

**DB:** le colonne `identita_genere`, `peso_kg`, `altezza_cm` restano nello schema (le riuseremo per Criolipolisi). Non vengono più scritte/lette dall'UI attuale.

---

## 2. Anamnesi — nuova struttura

Riscrivo completamente il form anamnesi e il payload JSONB. Nuova struttura:

### `generale` (jsonb)
- `allergie`: bool + `allergie_note` (string)
- `lidocaina_sensibile`: bool
- `fumo`: "si" | "no" | "occasionale"
- `alcol`: "si" | "no" | "occasionale"
- `caffe`: "si" | "no" | "occasionale"
- `sport`: bool + `sport_note`
- `alimentazione`: "sana" | "abbastanza" | "disequilibrata" | ""
- `acqua_litri`: number | null
- `condizioni_ormonali`: "nessuna" | "gravidanza" | "allattamento" | "menopausa" *(visibile solo se sesso = F)*
- `vaccino_recente`: bool + `vaccino_note`

### `patologica` (jsonb)
- `presenti`: bool
- Multi-select (visibile se `presenti`):
  - `diabete`, `ipertensione`, `tiroide`, `cardiopatia`, `varici`, `coagulopatia`, `asma_bpco`, `oncologico_attivo`, `neoplasia_pregressa`, `autoimmune`, `cheloidi`, `dermatopatie`, `hsv`, `altro`
- `altro_note` (visibile se `altro`)
- `interventi`: bool + `interventi_note`

### `farmacologica` (jsonb)
- `presenti`: bool
- Multi-select (visibile se `presenti`):
  - `anticoagulanti`, `cortisonici`, `isotretinoina`, `immunosoppressori`, `integratori`, `altro`
- `altro_note` (visibile se `altro`)
- *(rimuovo il campo "note terapie" generico)*

### `estetica` (jsonb)
- `fototipo`: I-VI
- `texture`: omogenea/parziale/disomogenea
- `abbronzatura`, `elastosi`, `spf_uso`: bool
- `trattamenti_pregressi`: bool + `trattamenti_pregressi_note`
- `reazioni_pregresse`: bool + `reazioni_pregresse_note`

### `note_libere` (text)
Invariato.

### Sezioni rimosse dal DB
Le colonne JSONB `abitudini`, `ostetrica`, `allergologica` vengono **droppate** (i loro contenuti si fondono in `generale`).

---

## 3. Alert automatici — semplificazione

Riscrivo `src/lib/flag-rischio.ts`. Solo questi 8 trigger, **tutti severity = "critico"**:

| Codice | Origine campo |
|---|---|
| `ALLERGIE` | `generale.allergie` |
| `LIDOCAINA` | `generale.lidocaina_sensibile` |
| `GRAVIDANZA` | `generale.condizioni_ormonali = "gravidanza"` |
| `ALLATTAMENTO` | `generale.condizioni_ormonali = "allattamento"` |
| `HSV` | `patologica` multi-select contiene `hsv` |
| `ANTICOAGULANTI` | `farmacologica` contiene `anticoagulanti` |
| `CORTISONICI` | `farmacologica` contiene `cortisonici` |
| `ISOTRETINOINA` | `farmacologica` contiene `isotretinoina` |
| `IMMUNOSOPPRESSORI` | `farmacologica` contiene `immunosoppressori` |

### Visibilità alert
- **Lista pazienti** (`pazienti.index.tsx`): icona ⚠️ rossa accanto al nome se il paziente ha ≥1 flag critico.
- **Scheda paziente** (`pazienti.$id.tsx`): banner rosso fisso in cima con elenco etichette flag critici, sempre visibile sopra ogni tab.
- **Tab Alert**: invariato (mostra già `anamnesi_flag_rischio` + `paziente_alert`).

---

## 4. Versioning anamnesi (Opzione A)

### Nuova tabella `anamnesi_versione`
```
id uuid pk
anamnesi_id uuid not null
paziente_id uuid not null
snapshot jsonb not null     -- copia integrale: generale/patologica/farmacologica/estetica/note_libere
created_at timestamptz default now()
created_by uuid             -- auth.uid() al momento del salvataggio
```

**RLS:**
- SELECT: operatori attivi
- INSERT: operatori attivi (write-only, automatico al salvataggio)
- UPDATE/DELETE: nessuno (immutabile)

**Logica:** ad ogni `UPDATE` su `anamnesi`, prima di scrivere salvo lo stato precedente in `anamnesi_versione`. Implemento via **trigger DB** `BEFORE UPDATE` su `anamnesi` così è atomico e non bypassabile dal client.

### UI: pannello "Cronologia anamnesi"
Nuovo componente `src/components/paziente/anamnesi-cronologia.tsx`, visibile come sotto-sezione del tab Anamnesi:
- Lista versioni (data/ora + nome operatore)
- Click su una riga → dialog read-only con il contenuto della versione
- Confronto fianco-a-fianco: NON in questa iterazione (nice-to-have futura)

---

## 5. Pulizia dati esistenti

Cancellazione completa dei dati clinici (resta solo te come paziente di prova, ma anche quello viene resettato così riparti pulito):

```sql
DELETE FROM anamnesi_flag_rischio;
DELETE FROM paziente_alert;
DELETE FROM paziente_nota;
DELETE FROM followup;
DELETE FROM seduta;
DELETE FROM piano_trattamento;
DELETE FROM consenso_firmato;
DELETE FROM anamnesi;
DELETE FROM pazienti;
```

*(profili operatori, ruoli, trattamenti e template consenso restano intatti)*

---

## 6. File toccati

**Nuovi:**
- `src/components/paziente/anamnesi-cronologia.tsx`
- migrazione SQL (drop colonne JSONB obsolete + nuova tabella `anamnesi_versione` + trigger versioning + delete dati)

**Modificati:**
- `src/types/clinico.ts` — nuovi tipi `AnamnesiPayload`, `AnamnesiVersione`, rimozione `Sesso` indipendente non necessaria
- `src/lib/flag-rischio.ts` — riscritto, solo 8 flag critici
- `src/components/paziente/anamnesi-panel.tsx` (o equivalente nel form edit) — UI rifatta con sezioni 1-4 + logiche condizionali
- `src/routes/_authenticated/pazienti.$id.tsx` — banner alert critici in cima + tab cronologia
- `src/routes/_authenticated/pazienti.$id.edit.tsx` — rimozione campi anagrafica
- `src/routes/_authenticated/pazienti.index.tsx` — icona ⚠️ accanto al nome
- `src/components/paziente/diario-panel.tsx` — adattamento eventi (le voci flag rischio cambiano)

---

## Conferma finale prima di procedere
Confermi tutto come sopra? In particolare:
1. **Pulizia totale dati** (compreso te come paziente test) ✅?
2. **Trigger DB** per versioning (più sicuro, automatico) invece che logica lato client ✅?
3. Drop colonne `abitudini` / `ostetrica` / `allergologica` da `anamnesi` ✅?
