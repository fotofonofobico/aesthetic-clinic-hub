## Obiettivo

Rendere la creazione di un piano un atto leggero ("una proposta"). Solo quando il paziente accetta, con **un singolo click**, il piano diventa attivo e genera sedute + alert consenso.

## Flusso utente (zero attriti in più)

1. **Crei piano** dal pannello Piani come ora → nasce come **Proposta**. Nessuna seduta creata, nessun alert consenso, nessuno scarico magazzino. Badge giallo "Proposta" sulla card.
2. Sulla card della proposta compare **un solo bottone evidenziato: "Attiva piano"** (verde, accanto a Modifica).
3. Click su **Attiva piano** → il piano diventa **Attivo**, vengono generate tutte le sedute e partono gli alert consenso (esattamente come oggi al momento della creazione). Una toast conferma "Piano attivato, N sedute generate".
4. Se il paziente rifiuta → "Annulla piano" come oggi.

Quindi: **stesso numero di click di oggi se il paziente accetta subito** (creazione + attivazione = 2 azioni, come oggi creazione + eventuale firma consenso). Se il paziente non conferma, semplicemente non clicchi "Attiva" e non hai alert spuri.

## Stato badge

```text
Proposta   → giallo (bozza)
Attivo     → verde
Completato → grigio
Sospeso    → arancio
Annullato  → rosso
```

## Cambiamenti tecnici

**Database** (`piano_stato` enum ha già `bozza`, va solo usato):
- Nessuna migrazione DB necessaria. Lo stato `bozza` esiste già.

**`src/components/paziente/piani-panel.tsx`**:
- `creaPiano()`: 
  - Inserisci il piano con `stato: 'bozza'`
  - **Rimuovi** la creazione delle sedute alla fine (le `sedutePayload.push` e l'insert su `seduta`)
  - Toast: "Proposta creata. Clicca 'Attiva piano' quando il paziente conferma."
- Nuova funzione `attivaPiano(p)`:
  - Update `piano_trattamento` → `stato: 'attivo'`
  - Genera le sedute (sposta qui la logica oggi in `creaPiano`, leggendo voci + prodotti dal piano salvato)
  - Inserisce nota diario "Piano attivato"
  - Trigger riavvio della valutazione consensi sulle voci
- Nella lista piani:
  - Aggiungi mapping label: `bozza → "Proposta"`
  - Per piani in `bozza`: badge giallo + bottone primario **"Attiva piano"** (icona CheckCircle), nascondi il bottone "Stato" o nascondine l'opzione "attivo" dal menu (sostituito dal click diretto)
  - Per piani non-bozza: comportamento attuale invariato
- `vociMancanti` / alert consenso: già di fatto inerti per piani in bozza (nessuna seduta = nessun alert). Aggiungo un guard esplicito per non mostrare il banner "Consenso mancante" sulle proposte.
- `Modifica` resta disponibile per le proposte.

**`src/components/paziente/sedute-panel.tsx`** (verifico in implementazione):
- Filtra eventuali alert/badge basati su sedute in modo che le proposte (zero sedute) non mostrino warning fuorvianti.

**Piani esistenti**:
- Nessuna migrazione dati. Tutti i piani attuali restano `attivo`. Il nuovo flusso vale solo per i piani futuri.

## Cosa NON cambia

- Tabelle, RLS, trigger
- PDF cartella paziente
- Stati `attivo`, `completato`, `sospeso`, `annullato` e relativa logica
- Magazzino, foto cliniche, calendario
- Alert consenso (logica identica, scatta solo quando ci sono sedute → cioè da Attivo in poi)
