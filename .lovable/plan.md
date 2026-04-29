# Piano finale — refactor UI

## Decisioni recepite
- Sidebar: rimuovo Audit & Sicurezza e Impostazioni dalla lista (no placeholder "Presto")
- KPI: opzione 3 → 2 KPI reali subito (nuovi pazienti mese, n. trattamenti mese), gli altri 2 dopo
- Alert "Follow-up necessari": **non implementato** ora, in sospeso
- Diario→Calendario: checkbox **default OFF** sempre, l'utente lo attiva esplicitamente

## 1. Sidebar (`src/components/app-layout.tsx`)

Voci finali:
- Dashboard
- **Calendario** (nuovo, icona `CalendarDays`)
- Pazienti
- Trattamenti
- Consensi
- Magazzino

Rimosse: Anamnesi (resta tab paziente), nessun placeholder.
Footer sidebar: lascio com'è (Impostazioni placeholder solo per medico).

## 2. Dashboard operativa (`src/routes/_authenticated/dashboard.tsx`)

Layout 2 colonne desktop, stack mobile:

```text
┌─────────────────────────┬───────────────────┐
│ Agenda 7 giorni         │ Azioni rapide     │
│ (colonna principale)    │ Alerts            │
│                         │ KPI 2 card        │
├─────────────────────────┴───────────────────┤
│ Attività recente (pazienti | sedute)        │
└─────────────────────────────────────────────┘
```

Rimosso: blocco "Iterazione 1", tutte le `ModuleCard`, funzione helper.

### Sezioni

**Agenda (`agenda-section.tsx`)**
- `useCalendarioEventi(oggi → +7gg)`
- Lista raggruppata per giorno, max 10 item visibili
- Empty: "Nessun appuntamento nei prossimi 7 giorni"
- CTA "Aggiungi appuntamento" → apre `EventoEditDialog`
- Click evento → `/calendario` (o paziente se collegato)

**Azioni rapide (`azioni-rapide.tsx`)**
- 3 bottoni: Nuovo paziente → `/pazienti`, Nuovo trattamento → `/trattamenti`, Nuovo consenso → `/consensi`

**Alerts (`alerts-section.tsx`)**
Calcolati al volo:
- **Consensi mancanti** (rosso): paziente con seduta pianificata nei prossimi 7gg senza consenso firmato collegato
- **Anamnesi incomplete** (giallo): paziente senza riga in `anamnesi` o `updated_at > 12 mesi`
- **Scorte basse** (rosso se 0, giallo se sotto soglia): da `prodotto_lotto`
- ~~Follow-up necessari~~ → in sospeso

Render: pallino colorato + testo + count, click → vista filtrata.
Tutto ok → singola riga "Tutto in regola" con pallino verde.

**KPI (`kpi-griglia.tsx` + `use-kpi-mese.ts`)**
2 card reali:
- **Nuovi pazienti del mese**: count `pazienti` con `created_at >= inizio_mese`
- **Trattamenti del mese**: count `seduta` con `data_seduta >= inizio_mese AND completata = true`

Card structure pronta per accettare 4 valori in futuro (fatturato, ticket medio quando ci sarà fatturazione).
Skeleton durante loading. No mock.

**Attività recente (`attivita-recente.tsx`)**
- Ultimi 5 pazienti (`order by created_at desc limit 5`) → click `/pazienti/$id`
- Ultime 5 sedute completate con nome paziente → click paziente
- Empty state per ciascuna lista

## 3. Ricerca paziente (`src/components/paziente/paziente-search.tsx`)

Combobox riusabile basato su `Command` + `Popover` (pattern di `prodotto-combobox`).
- Input con debounce 200ms
- Query Supabase `pazienti` filtrata `cognome ilike` o `nome ilike`, limit 20
- Voce "— nessuno —" sempre in cima
- Trigger mostra "Cognome Nome" se selezionato

Sostituisce il `<Select>` paziente in `EventoEditDialog`.

## 4. Diario → Calendario (`src/components/paziente/diario-panel.tsx`)

Aggiungo checkbox **"Aggiungi anche al calendario"** sotto il textarea — **default OFF sempre**.

Quando attivo, alla creazione nota inserisce anche `evento_calendario`:
- `titolo` = primi 60 char del testo
- `descrizione` = testo completo
- `tipo` = `promemoria`
- `data_inizio` = `data_evento`
- `paziente_id` = pazienteId
- `sincronizza_diario` = true
- `nota_diario_id` = id nota appena creata

Errore evento NON blocca creazione nota (toast warning).
Eliminazione nota NON elimina l'evento (calendario non vincolante).

## 5. UX globali

- Card e item liste cliccabili (cursor-pointer + hover bg)
- Indicatori stato: `bg-success`, `bg-warning`, `bg-destructive`
- Niente testi descrittivi superflui
- Nessuna modifica a routing, RLS, logica clinica

## File

**Modificati:**
- `src/components/app-layout.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/calendario/evento-edit-dialog.tsx`
- `src/components/paziente/diario-panel.tsx`

**Creati:**
- `src/components/paziente/paziente-search.tsx`
- `src/components/dashboard/agenda-section.tsx`
- `src/components/dashboard/azioni-rapide.tsx`
- `src/components/dashboard/alerts-section.tsx`
- `src/components/dashboard/kpi-griglia.tsx`
- `src/components/dashboard/attivita-recente.tsx`
- `src/hooks/use-kpi-mese.ts`

Nessuna migration DB.
