## Fix Piani: prezzo per ciclo, riassunto voce, totale paziente, alert consenso globale

### 1. Bug calcolo prezzo (root cause)

`src/lib/piano-prezzo.ts → calcolaTotaleRighe` fa sempre `prezzo_indicativo * numero_sedute`. Per i trattamenti con `tipo = "ciclo"`, il `prezzo_indicativo` rappresenta già il prezzo dell'**intero ciclo** (es. Biostimolazione viso 3 sedute = 750 €), quindi va contato **una sola volta**, non moltiplicato per le sedute.

Nuova regola di pricing:
- `tipo === "ciclo"` → `prezzo_riga = prezzo_indicativo` (il numero di sedute è informativo, il prezzo del ciclo è fisso)
- `tipo === "singolo"` (o null) → `prezzo_riga = prezzo_indicativo * numero_sedute` (comportamento attuale)
- prezzo nullo → 0 + warning inline come oggi

Modifiche in `src/lib/piano-prezzo.ts`:
- `calcolaTotaleRighe(righe, trattamenti)` → applica la regola sopra
- nuova funzione esportata `prezzoRiga(trattamento, numeroSedute): number` riusabile in UI

### 2. Riassunto prezzo per voce (vista piano espansa)

In `src/components/paziente/piani-panel.tsx`, dentro il render di ogni `voce` (sezione `{voci.map((v) => …)}`, ~riga 1232), aggiungere accanto al nome trattamento un piccolo blocco prezzo:

```text
[Trattamento]  [badge consenso]                    € 750,00 · 3 sedute
```

Il prezzo mostrato per voce è `prezzoRiga(trattamento, v.numero_sedute)` calcolato lato client dal `prezzo_indicativo` corrente (i piani non hanno il prezzo per voce salvato in DB — `prezzo_unitario`/`prezzo_riga` esistono ma sono sempre 0). Mostriamo SEMPRE il prezzo derivato live dal trattamento.

Sotto la lista voci, aggiungere un riepilogo del piano:
- "Totale base: €X"
- se `sconto_tipo !== 'nessuno' && sconto_valore > 0`: "Sconto: − €Y (10% / fisso)"
- "Totale finale: €Z" (in evidenza)

Lo sconto viene letto da `p.sconto_tipo` / `p.sconto_valore`; il finale viene ricalcolato live (più affidabile del `prezzo_finale` salvato, in caso il prezzo del trattamento cambi).

L'header del piano collassato continua a mostrare `prezzo_finale` salvato (sintesi rapida).

### 3. Totale generale speso dal paziente

Sopra la lista piani in `PianiPanel`, aggiungere una piccola card riassuntiva:

```text
Totale piani paziente: € 2.450,00       Attivi: 2 · Completati: 1
```

Calcolo: somma `prezzo_finale` (fallback `prezzo_totale`) su tutti i piani con `stato !== 'annullato'`. Visualizzata solo se ci sono piani.

### 4. Alert consenso globale (in alto, accanto ad allergie)

Estendere `CriticalBanner` in `src/routes/_authenticated/pazienti.$id.tsx`:
- caricare in `load()` una nuova query: tutti i piani **non annullati** del paziente con relative voci, calcolando per ogni voce `puoEseguireTrattamento`. Per evitare un fan-out di chiamate, aggregare i `trattamento_id` distinti delle voci di piani attivi/sospesi e chiamare `puoEseguireTrattamento` una volta per ciascuno (cache locale). Risultato: lista di nomi trattamenti senza consenso valido.
- se la lista non è vuota, aggiungere un nuovo banner DISTINTO da quello critico allergie/flag, con icona e colori diversi:

```text
[FileSignature icon] Consensi mancanti — banner ambra/warning
"Il piano include 2 trattamenti senza consenso firmato:
Botox glabella, Biostimolazione viso. Firma prima di iniziare."
```

Stile: `border-warning/40 bg-warning/10` con icona `FileSignature` (lucide) per distinguerlo visivamente dal banner allergie (`ShieldAlert` rosso). Posizione: dopo il banner critici, prima del banner blocchi consensi access-guard (che è più generico).

NB: il banner "Avvisi consensi" già esistente proviene da `access-guard` ed è basato sull'anamnesi/consensi generali; il nuovo è specificamente "questo paziente ha PIANI con voci senza consenso firmato". Sono complementari.

### 5. File toccati

- `src/lib/piano-prezzo.ts` — fix `calcolaTotaleRighe`, export nuova `prezzoRiga`
- `src/components/paziente/piani-panel.tsx` — riassunto prezzo per voce + riepilogo piano + card totale paziente
- `src/routes/_authenticated/pazienti.$id.tsx` — caricamento voci piani + computazione consensi mancanti + nuovo banner in `CriticalBanner`

### 6. Nessuna migrazione DB

Non servono modifiche schema. I piani esistenti continuano a funzionare; il prezzo viene ricalcolato live dal `prezzo_indicativo` corrente del trattamento (piani vecchi salvati con il bug mostreranno comunque il valore corretto in vista perché ricalcolato).

Eventuale ricalcolo retroattivo del campo `prezzo_finale` salvato nei piani esistenti: opzionale, da fare solo su esplicita richiesta (lasciamo i valori in DB invariati).

### 7. Domanda aperta

Per i trattamenti `tipo = "ciclo"` con `numero_sedute` MODIFICATO rispetto a `durata_ciclo_valore` (es. ciclo standard 3 sedute, paziente vuole 5): manteniamo prezzo_indicativo fisso? Proposta: sì, fisso = prezzo del ciclo a prescindere da quante sedute si pianificano. Se in futuro serve "prezzo per seduta extra" lo aggiungeremo come campo separato sul trattamento. Procedo con questa assunzione salvo diversa indicazione.
