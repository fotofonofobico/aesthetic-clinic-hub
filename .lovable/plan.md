## Obiettivo

1. In ogni flusso "firma" mostrare al paziente **solo l'ultima versione** del template per categoria/trattamento (oggi se restano attive più versioni vengono firmate tutte).
2. Rimuovere **definitivamente** la colonna "Firma del medico" da **tutti i consensi e le anamnesi** (GDPR, uso immagini, trattamento singolo, ciclo, altro, anamnesi). Il medico non firma sul tablet — firma solo il paziente.
3. Eliminare lo **spazio bianco enorme** tra una pagina e l'altra del PDF (page break troppo prematuro).

Tutto frontend, nessuna migrazione DB.

---

## 1. Selezione "ultima versione"

### `src/lib/signature-session.ts` — `buildVisitaSession`
Oggi: `templates.find((t) => t.categoria === "gdpr")` prende il primo attivo. Se sono attive più versioni (es. GDPR v1.0 e v1.1), può prendere la vecchia o produrne più di una.

Fix: aggiungere helper `pickLatest` che ordina per `versione` (numeric `localeCompare`) e ritorna **una sola** entry. Usare per GDPR e per Uso immagini.

### `src/lib/signature-session.ts` — `buildTrattamentoSession`
Oggi: itera **tutti** i template attivi con `trattamento_id ∈ ids` e li include tutti.

Fix: raggruppare per `trattamento_id + categoria` e tenere solo la versione più alta. Le versioni vecchie vengono ignorate dalla sessione di firma.

### `src/components/paziente/consensi-panel.tsx`
Nelle list di template selezionabili (firma manuale + invio tablet), filtrare con gli stessi criteri: latest per `categoria` globale (gdpr / uso_immagini / altro) e latest per `trattamento_id + categoria`. Le versioni superate restano in DB ma non sono più proposte come "da firmare".

### Helper condiviso
Aggiungere in `src/lib/consensi-engine.ts`:
```ts
export function ultimaVersione<T extends { versione: string; updated_at?: string }>(
  list: T[],
): T | null
```
Ordinamento: `localeCompare` numeric su `versione`, fallback su `updated_at`.

---

## 2. Rimozione firma medico — TUTTI i documenti

Il medico non firma più sul tablet, mai. Si elimina la colonna "Firma del medico" da ogni PDF.

### `src/lib/pdf-template.ts`
- `renderSignatureBlock`: rendere il rendering della colonna medico **opt-in esplicito** invece che opt-out. Cambiare default `mostraFirmaMedico` a `false`.
- Quando `false`, la colonna paziente occupa tutta la larghezza utile (label, riquadro firma, linea, nome) — già parzialmente implementato, da verificare visivamente.
- Rimuovere `firmaMedicoDataUrl` e `operatoreLabel` dal rendering quando `mostraFirmaMedico=false` (oggi sono già condizionati, ok).

### `src/lib/pdf-consenso.ts`
- Rimuovere completamente la logica `noFirmaMedico = categoria === "gdpr" || ...` e l'override per categoria.
- Passare sempre `mostraFirmaMedico: false` (o omettere il flag, sfruttando il nuovo default).
- Mantenere comunque il parametro `firmaMedicoDataUrl` nell'input per retrocompatibilità con i caller, ma non usarlo nel PDF.

### `src/lib/pdf-anamnesi.ts`
- Già passa `mostraFirmaMedico: false`. Confermato OK, nessun cambio.

### UI firma (tablet / Mac)
Verificare e rimuovere la richiesta/cattura della firma medico anche nella UI:
- `src/components/firma/medico-finalize-dialog.tsx` — dialog dedicato alla firma medico: se diventa inutile, lasciare come no-op o ridurlo a sola conferma di archiviazione (decidere in fase di implementazione, possibile eliminazione).
- `src/components/signature-session-dialog.tsx` — non chiedere firma medico anche per template con `richiede_firma_medico=true`.
- `src/lib/signature-session-save.ts` — `firma_medico_immagine`, `firmato_da_medico` salvati come `null`.

> Nota: il campo DB `firma_medico_immagine` resta nello schema ma non viene più popolato. Nessuna migrazione necessaria.

---

## 3. Spazio bianco tra pagine PDF

`src/lib/pdf-consenso.ts`: il loop body ha `if (y > pageH - 200) { addPage }`. Con A4 (842pt), ogni pagina riempie solo fino a y≈642 lasciando ~200pt di vuoto in fondo. Stessa soglia per il blocco "Esito".

Fix:
- Body: soglia `pageH - margin - 20` (≈ 774pt), riempie tutta la pagina lasciando solo il footer.
- Blocco "Esito + note": soglia `pageH - 80` (basta riga + margine).
- `renderSignatureBlock` già fa check di 160pt — lasciare intatto, garantisce che il signature block resti atomico sull'ultima pagina.

Risultato: niente più mezza pagina vuota; signature block resta integro a fine documento.

---

## File toccati

- `src/lib/consensi-engine.ts` — helper `ultimaVersione`
- `src/lib/signature-session.ts` — pick latest in `buildVisitaSession` / `buildTrattamentoSession`
- `src/components/paziente/consensi-panel.tsx` — filtro latest sui template proposti
- `src/lib/pdf-template.ts` — default `mostraFirmaMedico=false`, layout single-column quando assente
- `src/lib/pdf-consenso.ts` — sempre senza firma medico + soglie page break
- `src/lib/signature-session-save.ts` — non passare firma medico
- `src/components/signature-session-dialog.tsx` + `medico-finalize-dialog.tsx` — saltare richiesta firma medico

Nessuna modifica a DB, RLS, edge functions.