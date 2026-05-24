Ok mi sono spiegato bene, e l'idea della visita dentro il piano è la strada giusta: niente banner, tutto dentro il piano stesso. Propongo questi 3 interventi minimi, tutti reversibili e senza toccare il flow esistente.

---

## 1) Piano combinato: prezzo unico pacchetto + storno visita

Oggi `piano.prezzo_totale` è la somma delle righe e `prezzo_finale` applica uno sconto globale (`euro` / `percento`). Funziona ma non copre i tuoi 2 casi.

**Aggiunte (solo additive, nessuna rottura):**

- **A. "Prezzo pacchetto" sul piano** — nuovo campo `prezzo_pacchetto_override` (numero, opzionale) sul piano.
  - Se valorizzato → il totale del piano diventa quello (ignora la somma delle righe).
  - Se vuoto → comportamento attuale (somma righe).
  - UI: nel form piano, sotto al totale, un toggle "Prezzo pacchetto fisso" con campo €. Quando attivo, mostra "Risparmio rispetto ai singoli: X €" calcolato dalla differenza.
- **B. Riga "storno visita precedente"** — nuovo flag `storna_se_in_piano` sui trattamenti tipo Visita, + un campo `visita_da_stornare_id` sul piano (FK opzionale a una visita/incontro già pagata di quel paziente).
  - In fase di creazione piano, se il paziente ha una "Prima visita" o "Visita di controllo" registrata e non ancora stornata, appare un checkbox: *"Scala € 60 della visita del 12/05 già pagata"*.
  - Lo storno diventa una riga negativa nel piano (visibile e tracciata) → niente magia nascosta, contabilmente pulito.
  - La visita di origine viene marcata come "stornata in piano X" per non poterla applicare due volte.

**Esempio del tuo caso:**

```
1× Visita (in piano)            60,00
1× Criolipolisi                100,00
4× Onde d'urto                 400,00
─────────────────────────────────────
Subtotale righe                560,00
Prezzo pacchetto fisso         450,00  ← override
Storno visita 12/05 già pagata −60,00
─────────────────────────────────────
Da incassare                   390,00
```

(o, se la visita la stai mettendo dentro il piano *prima* di pagarla, semplicemente non aggiungi lo storno e paga 450).

**Niente alert / banner**: la visita è una riga normale del piano. Lo "sconto visita" è una tick esplicita nel form. Zero pasticci.

---

## 2) Badge "Consenso ok" illeggibile

Nel componente `piani-panel.tsx` il badge verde usa testo bianco su sfondo verde chiaro → invisibile. Fix: forzare testo scuro (`text-success-foreground` o `text-foreground`) sul badge "Consenso ok". Modifica di 1 riga.

---

## 3) Alert dashboard — riepilogo e proposta "intelligenti"

**Cosa c'è ora** (`alerts-section.tsx`):


| #   | Alert                              | Severità | Logica attuale                                                |
| --- | ---------------------------------- | -------- | ------------------------------------------------------------- |
| 1   | Anamnesi mancanti o > 12 mesi      | warning  | nessuna anamnesi, o `updated_at` > 12 mesi                    |
| 2   | Lotti scaduti                      | critical | `data_scadenza < oggi`                                        |
| 3   | Lotti in scadenza < 30gg           | warning  | `data_scadenza` entro 30 gg                                   |
| 4   | Scorte sotto soglia                | warning  | `quantita_disponibile ≤ soglia_minima`                        |
| 5   | **Consensi con versione obsoleta** | warning  | `template.versione ≠ versione_snapshot` (qualunque sia l'età) |
| 6   | Consensi in scadenza < 30gg        | warning  | `valido_fino_a` entro 30 gg                                   |
| 7   | Consensi mancanti (sedute < 7gg)   | critical | seduta programmata entro 7gg + paziente senza alcun consenso  |


**Problemi che hai segnalato — proposte:**

- **#5 (versione obsoleta) — oggi è "stupido":** segnala anche un consenso firmato 3 anni fa per cui ora esiste una v2 di forma. Proposta: il consenso firmato **resta valido** finché:
  - non scade (`valido_fino_a`),
  - non è revocato,
  - non è esaurito (sedute consumate ≥ sedute max).
  La versione del template diventa rilevante **solo** se il template ha un flag `richiede_rifirma_su_nuova_versione = true` (default: false). Così tu decidi caso per caso: una correzione tipografica non forza rifirma, un cambio sostanziale di clausole sì.
  Aggiungo anche un campo opzionale `motivo_nuova_versione` sul template, mostrato nel dialog "Consensi obsoleti".
- **#7 (mancanti per sedute < 7gg) — oggi è grossolano:** segnala "manca un consenso qualsiasi". Proposta: segnala solo se manca *il consenso pertinente al trattamento di quella seduta* (match per `trattamento_id` → `consenso_template_id`). Niente falsi positivi per pazienti che hanno solo GDPR ma stanno facendo crio senza consenso specifico.
- **#1 (anamnesi > 12 mesi):** ok così, ma aggiungerei la soglia configurabile in Impostazioni (default 12 mesi).
- Tutti gli alert restano **non bloccanti** (solo segnalazione cliccabile).

---

## Cosa NON faccio in questo giro

- Non tocco il flow di firma né i PDF.
- Non rimuovo il banner baseline criolipolisi (resta come reminder soft).
- Non introduco nuove entità "Incontro" — la visita resta un trattamento normale dentro il piano, come hai proposto tu.

---

## Ordine di esecuzione suggerito

1. **Fix badge** (1 min, zero rischio).
2. **Alert consensi intelligenti** (#5 e #7) — solo logica frontend + 1 campo opzionale su template.
3. **Piano: prezzo pacchetto override + storno visita** — 2 campi nuovi sul piano, UI nel form, aggiornamento calcolo totale.

Confermi l'approccio? In particolare:

- ti va bene che **la rifirma alla nuova versione sia opt-in** (flag sul template) invece che automatica?
- per lo **storno visita**, ti basta il checkbox "scala la visita XYZ" o vuoi anche poter inserire uno storno manuale a importo libero (es. "−40 per fidelity")?  
  
Confermo praticamente tutto l’approccio.
  Unica modifica che farei: eviterei `visita_da_stornare_id` sul piano.
  Preferirei mantenere il piano indipendente e segnare invece direttamente sulla visita/prestazione se è già stata usata come storno (`scalata_in_piano_id` nullable).
  Workflow desiderato:
  - la visita resta una prestazione/riga normale;
  - quando creo un nuovo piano il sistema rileva eventuali visite pagate non ancora scalate;
  - propone checkbox “Scala visita iniziale da 60€”;
  - se confermo:
    - aggiunge riga negativa esplicita nel piano;
    - marca quella visita come già scalata.
  Così otteniamo:
  - zero memoria manuale;
  - niente doppio utilizzo;
  - auditabilità;
  - nessuna logica contabile complessa;
  - nessuna dipendenza forte tra piani.