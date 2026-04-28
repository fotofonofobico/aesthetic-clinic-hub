## Problema

Quando firmi la **bozza v2** dell'anamnesi:
1. Compare l'alert "Trattamenti bloccati — Anamnesi non firmata" anche se la firma è andata a buon fine.
2. La pagina sembra "tornare alla home del paziente" (in realtà la tab attiva si resetta su "Diario").

## Causa (due bug indipendenti)

**Bug 1 — `src/lib/access-guard.ts` (logica errata di valutazione anamnesi)**

`evaluateAccess` ordina le righe `anamnesi` per `updated_at DESC` e considera solo `anamRows[0]`. Quando firmo v2:
- Il trigger `anamnesi_auto_supersede` aggiorna v1 a `superseded` **dopo** l'update di v2.
- Il trigger `trg_anamnesi_updated_at` rimette `updated_at = now()` su v1.
- Risultato: v1 (`superseded`) ha `updated_at` più recente di v2 (`signed`) → `ultima.stato !== 'signed'` → viene aggiunto erroneamente "Anamnesi non firmata" e `bloccoTrattamenti = true`.

La logica corretta è: **se esiste una riga `signed`, l'anamnesi è firmata**, indipendentemente da quante draft/superseded esistono. Una "draft posteriore" indica solo che il medico sta preparando una nuova versione (warning, non blocco).

**Bug 2 — `src/routes/_authenticated/pazienti.$id.tsx` (perdita stato tab)**

Dopo `firmaAnamnesi`, viene invocato `onSaved → load()`. `load()` esegue `setLoading(true)` che smonta tutto il blocco `<Tabs>`. Al rimontaggio, `<Tabs defaultValue="diario">` torna sulla tab "Diario", quindi l'utente perde il contesto e pensa di essere stato "rimandato alla homepage del paziente".

## Modifiche

### 1. `src/lib/access-guard.ts` — fix logica anamnesi

Sostituire il blocco "Anamnesi (firma)" con una logica basata sulla presenza di una riga `signed`:

```ts
const anamRows = (anamRes.data ?? []) as Array<{
  stato: "draft" | "signed" | "superseded";
  firmata_il: string | null;
  updated_at: string;
}>;

const signed = anamRows.find((a) => a.stato === "signed");
const draft = anamRows.find((a) => a.stato === "draft");

let anamnesiStato: AccessEvaluation["anamnesiStato"] = "missing";
let anamnesiObsoleta = false;

if (anamRows.length === 0) {
  bloccoTrattamenti = true;
  motivi.push("Anamnesi non compilata");
} else if (signed) {
  anamnesiStato = "signed";
  // draft posteriore = nuova versione in lavorazione (non blocca)
  if (draft) anamnesiObsoleta = true;
} else {
  // solo draft/superseded, nessuna signed
  anamnesiStato = draft ? "draft" : "superseded";
  bloccoTrattamenti = true;
  motivi.push("Anamnesi non firmata");
}
```

### 2. `src/routes/_authenticated/pazienti.$id.tsx` — preservare la tab attiva

Due modifiche minimali:

a) Trasformare `<Tabs>` in **controlled component** con stato locale, così il valore corrente sopravvive a un re-render anche se l'albero viene smontato:

```tsx
const [tab, setTab] = useState<string>("diario");
// ...
<Tabs value={tab} onValueChange={setTab} className="space-y-4">
```

b) In `load()`, evitare di forzare `setLoading(true)` sui refresh successivi al primo (così non smontiamo l'intera UI per un semplice refresh post-firma):

```ts
async function load(opts: { silent?: boolean } = {}) {
  if (!opts.silent) setLoading(true);
  // ...
}
```

E passare `load({ silent: true })` da tutti i callback di refresh (`onSaved`, `onChanged`, `onCompleted` di `SignatureSessionDialog`, `FirmaTrattamentoLauncher`).

## File toccati

- `src/lib/access-guard.ts` (logica anamnesi)
- `src/routes/_authenticated/pazienti.$id.tsx` (tab controllata + `load({ silent })`)

## Cosa NON tocchiamo

- Schema DB, trigger, RLS — restano invariati.
- Flusso di firma in `anamnesi-panel.tsx` (`firmaAnamnesi`, fork, upload PDF) — già corretto.
- `consensi-panel.tsx` e altri panel.

## Risultato atteso

- Firma v2 → toast "Anamnesi firmata e bloccata", banner "Trattamenti bloccati / Anamnesi non firmata" sparisce, l'utente resta sulla tab "Anamnesi".
- Se esiste sia una `signed` sia una `draft` v+1 in lavorazione, nessun blocco trattamenti (solo flag `anamnesiObsoleta` per UI futura).
