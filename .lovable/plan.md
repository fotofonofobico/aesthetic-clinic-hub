
# Sezione "Sedute" - esecuzione clinica reale

## Decisioni recepite

- **Date**: opzionali in fase di piano, modificabili nella sezione Sedute
- **Sedute spot**: ammesse, senza piano (richiede migrazione: `seduta.piano_id` nullable)
- **Modifica post-firma**: libera entro 48h da chi l'ha eseguita; oltre 48h serve ruolo medico + motivo obbligatorio + audit completo
- **Data retroattiva**: possibile inserire data di esecuzione passata, ma il sistema registra anche data di inserimento reale
- **Diario**: ogni seduta completata genera automaticamente una voce nel diario (`paziente_nota` tipo `clinica`), aggiornata se la seduta viene modificata

## 1. Modifiche database

### Migrazione schema (`seduta`)

```text
ALTER TABLE seduta:
  - piano_id DROP NOT NULL                       (sedute spot)
  - data_esecuzione_effettiva timestamptz NULL   (quando il trattamento è stato fatto davvero)
  - data_registrazione timestamptz DEFAULT now() (quando l'operatore l'ha inserita nel sistema)
  - firmata_il timestamptz NULL                  (timestamp del "completata = true")
  - firmata_da uuid NULL                         (operatore che ha firmato)
  - bloccata boolean DEFAULT false               (true dopo 48h dalla firma)
  - nota_diario_id uuid NULL                     (FK logica a paziente_nota auto-generata)
  - trattamento_id valorizzato anche per spot
```

`data_seduta` resta come "data programmata/prevista". `data_esecuzione_effettiva` è la data clinica reale (può essere nel passato).

### Nuova tabella audit `seduta_modifica`

```text
seduta_modifica:
  id uuid PK
  seduta_id uuid NOT NULL
  modificata_da uuid NOT NULL
  modificata_il timestamptz DEFAULT now()
  campo text NOT NULL              (es. "note_cliniche", "prodotti_previsti")
  valore_precedente jsonb
  valore_nuovo jsonb
  motivo text NOT NULL             (obbligatorio per modifiche oltre 48h)
  oltre_48h boolean DEFAULT false
```

RLS: insert da operatori attivi, select da operatori attivi, no update/delete (immutabile).

### Trigger DB

- **`seduta_blocca_dopo_48h`**: trigger BEFORE UPDATE che, se `firmata_il` è più vecchio di 48h e l'utente non è medico, blocca le modifiche se `motivo` non è fornito (passato via session var o gestito lato app).
- **`seduta_sync_diario`**: AFTER INSERT/UPDATE quando `completata = true` → upsert in `paziente_nota` con riassunto strutturato; salva l'id in `seduta.nota_diario_id`. AFTER UPDATE quando `completata` torna false → marca la nota come "annullata" o la elimina.
- Trigger `piano_auto_stato` esistente continua a funzionare.

## 2. UI - nuovo tab "Sedute"

Aggiunto nella scheda paziente accanto a Diario / Piani / Anamnesi / Consensi.

### Layout principale (`src/components/paziente/sedute-panel.tsx`)

```text
[ Card riepilogo                                              ]
[ Programmate: 5 · Eseguite: 12 · In ritardo: 1               ]
[                                       [+ Nuova seduta spot] ]

[ Filtri: Tutte | Programmate | Eseguite | Per piano ▾        ]

╔══ PROGRAMMATE ═════════════════════════════════════════════╗
║ ⚠ Botox glabella · Piano "Ringiovanimento viso"           ║
║   Prevista: 15 mag 2026 · zone: glabella, fronte           ║
║   Prodotti previsti: Botox 50U · Consenso ✓                ║
║   [Sposta data] [Esegui ora] [Annulla]                    ║
╠════════════════════════════════════════════════════════════╣
║ ⚠ Biostimolazione viso (2/3) · Consenso MANCANTE          ║
║   [Firma consenso] [Sposta data] [Esegui ora]             ║
╚════════════════════════════════════════════════════════════╝

╔══ ESEGUITE ════════════════════════════════════════════════╗
║ ✓ Filler labbra · 12 apr 2026 (registrata 13 apr)         ║
║   Operatore: Dr. Rossi · zone: labbro sup/inf              ║
║   Prodotti: Juvederm Volift 1ml                            ║
║   [Vedi dettagli] [Modifica] (entro 48h)                   ║
╚════════════════════════════════════════════════════════════╝
```

### Dialog "Esegui seduta" (`src/components/paziente/sedute/esegui-seduta-dialog.tsx`)

```text
┌─ Esegui seduta · Botox glabella ──────────────────────┐
│ ⚠ Consenso mancante  [Firma ora]  (blocca salvataggio)│
│                                                        │
│ Data esecuzione *  [15/05/2026 ▾] (default: oggi)     │
│ ℹ Inserisci data passata se stai registrando a poste- │
│   riori. Sistema registrerà anche data di inserimento.│
│                                                        │
│ Operatore *        [Dr. Rossi ▾]                       │
│ Durata (min)       [30]                                │
│                                                        │
│ Zone trattate                                          │
│ Previste: glabella, fronte                             │
│ [chip: glabella ✓] [chip: fronte ✓] [+ aggiungi]      │
│                                                        │
│ Prodotti utilizzati                                    │
│ ┌────────────────────────────────────────┐            │
│ │ Botox     [- 1 +]   lotto: [____]      │            │
│ │ [+ aggiungi prodotto]                   │            │
│ └────────────────────────────────────────┘            │
│                                                        │
│ Parametri tecnici (opzionale)                          │
│ [textarea libero]                                      │
│                                                        │
│ Note cliniche                                          │
│ [textarea]                                             │
│                                                        │
│ ☑ Aggiungi voce automatica al diario                  │
│                                                        │
│        [Annulla]  [Salva bozza]  [Firma e completa]   │
└────────────────────────────────────────────────────────┘
```

### Dialog "Modifica seduta firmata"

Se `firmata_il < 48h` e utente è chi ha firmato → form normale, ogni campo cambiato salva entry in `seduta_modifica`.

Se `firmata_il > 48h` o utente diverso:
- Solo medici possono procedere
- Campo **"Motivo della modifica" obbligatorio**
- Banner rosso: "Questa modifica verrà registrata permanentemente nell'audit"
- Ogni delta salva entry in `seduta_modifica` con `oltre_48h = true`

### Dialog "Nuova seduta spot"

Form rapido: trattamento, data esecuzione, operatore, zone, prodotti, note, consenso. Crea seduta con `piano_id = NULL`.

### Card "Sposta data"

Mini-popover con date picker per modificare `data_seduta` (data prevista) di una seduta non ancora completata. Disabilitato per sedute già firmate.

## 3. Diario automatico

Ogni seduta completata genera/aggiorna una `paziente_nota` con questo formato:

```text
[Data esecuzione - Trattamento]
Operatore: Dr. X
Zone: glabella, fronte
Prodotti: Botox 50U
Durata: 30 min
Note cliniche: <testo>

(registrata il <data_registrazione> se diversa da data esecuzione)
```

Tipo nota = `clinica`. La nota porta un riferimento alla seduta (campo `seduta_id` da aggiungere a `paziente_nota` via migrazione, nullable).

Nel diario panel, le note auto-generate hanno un badge "🩺 Seduta" e sono cliccabili per aprire il dettaglio della seduta. Non sono modificabili direttamente (si modifica la seduta).

## 4. Banner globali (estensione esistente)

In `src/routes/_authenticated/pazienti.$id.tsx` aggiungo al `CriticalBanner`:

- **Sedute in ritardo**: rosso, se ci sono sedute programmate con `data_seduta < oggi - 7gg` e non completate
- **Sedute oggi senza consenso**: rosso, se ci sono sedute previste oggi con consenso mancante

Il banner consenso esistente resta come è.

## 5. File da creare/modificare

**Nuovi:**
- `supabase/migrations/<ts>_sedute_esecuzione.sql` - schema seduta + tabella audit + trigger
- `src/components/paziente/sedute-panel.tsx` - tab principale
- `src/components/paziente/sedute/esegui-seduta-dialog.tsx` - dialog esecuzione
- `src/components/paziente/sedute/modifica-seduta-dialog.tsx` - dialog modifica con audit
- `src/components/paziente/sedute/nuova-seduta-spot-dialog.tsx` - seduta libera
- `src/components/paziente/sedute/sposta-data-popover.tsx` - reschedule
- `src/components/paziente/sedute/seduta-card.tsx` - card riusabile
- `src/lib/seduta-helpers.ts` - util (puoModificare, formatRiassuntoDiario, etc.)
- `src/types/seduta.ts` - tipi estesi

**Modificati:**
- `src/routes/_authenticated/pazienti.$id.tsx` - nuovo tab + banner sedute in ritardo
- `src/components/paziente/diario-panel.tsx` - badge "Seduta" per note auto-generate
- `src/integrations/supabase/types.ts` - rigenerato dalle migrazioni
- `src/types/trattamenti.ts` - aggiornare interfaccia `Seduta`

## 6. Cosa NON faccio in questo turno

- Calendario visuale completo (vista mese/settimana) - per ora solo lista cronologica con date editabili
- Promemoria via email/SMS - servirà cron job dopo
- Magazzino prodotti (scarico automatico lotti) - quando faremo magazzino
- Followup post-seduta strutturato - tabella `followup` esiste ma resta scollegata fino a un turno dedicato
- Firma digitale del paziente sulla seduta - per ora "firma" = operatore conferma esecuzione

## Punto da confermare

Sul **diario automatico** non hai risposto direttamente, ma dal tuo commento finale assumo: **scrittura automatica sempre, con riga nel diario non modificabile direttamente** (si modifica la seduta, la nota si aggiorna). Se preferisci la versione con checkbox opzionale "Aggiungi voce diario" prima di salvare, dimmelo prima dell'approvazione.
