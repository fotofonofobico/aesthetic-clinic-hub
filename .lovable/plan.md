
# Modulo Foto Cliniche — Piano + Seduta

## Architettura dati

**Bucket storage privato**: `foto-cliniche` (RLS: solo operatori attivi).

**Tabella `foto_clinica`** — un'unica tabella, livello determinato da quali FK sono valorizzate:

| Campo | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `paziente_id` | uuid NOT NULL | sempre |
| `piano_id` | uuid NOT NULL | sempre (foto sempre legata a un piano) |
| `seduta_id` | uuid NULL | NULL → foto **piano**; valorizzato → foto **seduta** |
| `momento` | enum `prima` \| `dopo` | flag obbligatorio (no campo libero) |
| `livello` | enum generato `piano` \| `seduta` | computed: NULL → piano |
| `zona` | text NULL | facoltativo, da lista `ZONE_TRATTAMENTO` esistente |
| `storage_path` | text NOT NULL | path in bucket |
| `data_scatto` | date NOT NULL | retroattiva ammessa, default oggi |
| `data_caricamento` | timestamptz default now() | |
| `note` | text NULL | unico campo libero, opzionale |
| `created_by` | uuid | |

**Tabella `piano_foto_stato`** (1:1 col piano, gestita da trigger):

| Campo | Tipo |
|---|---|
| `piano_id` PK | uuid |
| `stato` | enum `completo` \| `baseline_mancante` \| `non_eseguibile` |
| `motivazione` | text NULL (richiesta solo per `non_eseguibile`) |
| `cambiato_da` | uuid |
| `cambiato_il` | timestamptz |
| `incoerenza_data` | bool (foto PRIMA con data > prima seduta) |

**Tabella `piano_foto_stato_log`**: audit di ogni cambio (stato precedente/nuovo, utente, timestamp, motivazione).

## Logica automatica (trigger su `foto_clinica` + `seduta`)

1. **Sblocco automatico**: all'INSERT di una foto con `livello=piano`, `momento=prima`, `data_scatto <= MIN(data_seduta della seduta #1)` → stato torna `completo`.
2. **Incoerenza**: se data_scatto > data prima seduta → stato resta `baseline_mancante` + flag `incoerenza_data=true` (alert giallo dedicato).
3. **Init**: alla creazione del piano, riga in `piano_foto_stato` con stato `baseline_mancante`.
4. **`non_eseguibile`**: settabile solo via RPC `piano_foto_marca_non_eseguibile(_piano_id, _motivazione)` con check `has_role(auth.uid(), 'medico')` + motivazione obbligatoria. Loggato.

## UI — integrazione con quanto esiste

### A. Tab "Foto" nel dettaglio piano (`piani-panel.tsx`)
Nuova sezione `FotoPianoPanel` con due aree:
- **Baseline (PRIMA piano)**: griglia thumbnail. CTA "Carica foto baseline" → dialog upload multiplo.
- **Finali (DOPO piano)**: griglia thumbnail, opzionale.
- **Timeline sedute**: accordion per seduta con eventuali foto prima/dopo della seduta (read-only qui, si caricano dalla seduta).

**Badge stato piano** sempre visibile in header:
- 🟢 `Completo` · 🟡 `Baseline mancante` · ⚫ `Non eseguibile`
- Click sul badge giallo → dropdown: "Carica foto ora" / "Marca non eseguibile" (solo medico).

### B. In `consumo-step.tsx` / step esecuzione seduta
Sezione compatta **"Foto seduta (opzionale)"** con due bottoni rapidi: `+ PRIMA` `+ DOPO`. Nessun blocco.

### C. Alert non bloccanti (riuso pattern `Alert` esistente)
- **Su `pazienti.$id.tsx`** in cima: banner persistente giallo se almeno un piano del paziente è in `baseline_mancante`.
- **Apertura "Esegui seduta"** (prima volta del piano): dialog non bloccante con due CTA → `Procedi comunque` / `Marca non eseguibile` (medico) / `Carica baseline ora`. Se "Procedi comunque" → stato resta giallo, seduta parte normalmente.
- **Post-seduta** (al completamento): toast con "Aggiungi foto DOPO seduta?" + link rapido (snoozable per 24h via localStorage).
- **Pre-seduta successiva**: stesso dialog non bloccante della prima volta finché baseline manca.

### D. Upload foto — dialog unificato `FotoUploadDialog`
Zero campi liberi tranne `note`:
- Drop zone / file picker (multi)
- Radio obbligatorio: `Prima` / `Dopo`
- Date picker `data_scatto` (default oggi, retroattiva ammessa) — usa shadcn-datepicker con `pointer-events-auto`
- Select `zona` (facoltativo) — opzioni da `ZONE_TRATTAMENTO`
- Textarea `note` (opzionale, l'unico libero)
- Submit → upload a storage + insert riga + trigger ricalcola stato

## Reminder (solo in-app, come da scelta)

| Trigger | UI |
|---|---|
| Apertura scheda paziente | Banner giallo persistente se ≥1 piano `baseline_mancante` |
| Apertura tab piano | Badge stato + alert in cima al tab |
| Click "Esegui seduta" con baseline mancante | Dialog non bloccante (Procedi / Carica / Non eseguibile) |
| Completamento seduta | Toast "Aggiungi foto DOPO?" |
| Foto PRIMA con data > prima seduta | Alert dedicato "Incoerenza data — questa foto non funge da baseline" |

Nessuna edge function, nessun cron — tutto reattivo.

## Sicurezza

- RLS `foto_clinica`: SELECT/INSERT operatori attivi, UPDATE solo `created_by` o medico, DELETE solo medico.
- RLS bucket `foto-cliniche`: privato, path pattern `{paziente_id}/{piano_id}/...`, signed URL on demand (1h).
- RPC `piano_foto_marca_non_eseguibile`: SECURITY DEFINER + `has_role(... 'medico')`.
- Audit completo in `piano_foto_stato_log`.

## File coinvolti

**Nuovi**:
- migration: tabelle `foto_clinica`, `piano_foto_stato`, `piano_foto_stato_log`, bucket, RLS, trigger, RPC
- `src/types/foto-clinica.ts`
- `src/lib/foto-clinica.ts` (CRUD + signed URL)
- `src/components/foto/foto-upload-dialog.tsx`
- `src/components/foto/foto-grid.tsx` (thumbnail + lightbox + zona/data/momento overlay)
- `src/components/foto/foto-piano-panel.tsx` (tab piano)
- `src/components/foto/foto-stato-badge.tsx`
- `src/components/foto/foto-baseline-alert.tsx` (dialog non bloccante riusabile)

**Modificati**:
- `src/components/paziente/piani-panel.tsx` — aggiunta tab "Foto" + badge stato
- `src/components/paziente/sedute-panel.tsx` — gancio dialog pre-seduta + toast post-seduta
- `src/components/magazzino/consumo-step.tsx` — sezione "Foto seduta (opzionale)"
- `src/routes/_authenticated/pazienti.$id.tsx` — banner globale piani con baseline mancante

## Punti che NON faccio (per restare snelli)

- ❌ Zona obbligatoria (hai scelto facoltativa)
- ❌ Notifiche email/push (solo in-app)
- ❌ Auto-tag AI / face detection
- ❌ Confronto side-by-side avanzato (in v1: tap sulla foto PRIMA + tap sulla DOPO della stessa zona apre lightbox affiancato — semplice)
- ❌ Versioning foto (ogni foto è immutabile, eliminazione solo medico con audit)

Procedo con questa architettura quando approvi.
