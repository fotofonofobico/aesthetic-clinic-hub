# Piano fix conservativi — STEP 1 + STEP 2 (rev. 2)

Recepite le 4 prudenze: clear+invalidate al posto di invalidateQueries massivo, allSettled solo dove UI tollera assenza dati, logger.error senza PII, attenzione al nesting AlertDialog/Dialog.

---

## STEP 1 — Fix ultra-sicuri (nessun cambio UI/UX)

### 1A. Invalidazione cache al cambio sessione (#1)
**File:** `src/routes/__root.tsx`

Dentro `RootComponent`:
- importare `useRouter` da `@tanstack/react-router` e `useEffect` da react
- aggiungere un `useEffect` (deps: `[router, queryClient]`) che sottoscrive `supabase.auth.onAuthStateChange` e, su `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`, esegue:

```ts
queryClient.clear();      // svuota cache senza scatenare refetch a tappeto
router.invalidate();      // riesegue solo i loader delle route attive
```

NON usare `queryClient.invalidateQueries()`: rischia tempeste di fetch con realtime + dashboard. Su `TOKEN_REFRESHED` non fare nulla (è solo rinnovo bearer, stesso utente).

Cleanup: `subscription.unsubscribe()` nel return dell'effect. Il listener esistente in `auth-context.tsx` resta intatto: gestisce solo stato auth locale, il nuovo è additivo.

### 1B. Floating promises senza `.catch` (#8)
Aggiunta minima di `.catch((e) => logger.error("[<contesto>]", e))` (vedi 1C per il logger). Nessuna modifica di tipo, firma o comportamento positivo.

File toccati:
- `src/components/dashboard/alerts-section.tsx` — `.then(([pz, sd]) => ...)`
- `src/routes/_authenticated/pazienti.$id.tsx` (riga 41) — `Promise.all(...).then(...)` — NB: qui resta `Promise.all` (vedi 1D), aggiungo solo `.catch`
- `src/components/paziente/sedute-panel.tsx` (riga ~1520) — `void puoEseguireTrattamento(...).then(...)`
- `src/components/calendario/evento-edit-dialog.tsx` — `.then(({ data }) => ...)`
- `src/components/pdf-canvas-viewer.tsx` — `.then((db) => ...)`
- `src/components/paziente/anamnesi-panel.tsx` — `.then(({ data }) => setTrattamenti(...))`
- `src/components/calendario/calendario-vista.tsx` — eventuali `.then` senza catch

### 1C. Logger dev-only (#10)
Nuovo file `src/lib/logger.ts`:

```ts
const isDev = import.meta.env.DEV;
export const logger = {
  warn: (...a: unknown[]) => { if (isDev) console.warn(...a); },
  error: (...a: unknown[]) => console.error(...a), // sempre attivo
  debug: (...a: unknown[]) => { if (isDev) console.debug(...a); },
};
```

**Regola d'uso (vincolante):** `logger.error` riceve SOLO `(label: string, err: Error|unknown)` o messaggi sintetici. **Mai** payload completi, mai oggetti `paziente`, `consenso`, `seduta`, `anamnesi` o body insert. Su errori Supabase passare solo `{ code, message, details }`, niente `payload`.

Sostituzioni mirate (solo `console.warn` / log informativi; tutti gli `console.error` di vero errore restano):
- `src/lib/magazzino.ts:49,84` `console.warn(...)` → `logger.warn(...)`
- `src/lib/magazzino.ts:186` — rimuovere `payload` dal log: oggi è `console.error("[creaProdotto] error", { code, message, details, payload })`; diventa `logger.error("[creaProdotto]", { code, message, details })`. **Fix di PII.**
- `src/lib/calendario-followup.ts:48` `console.warn(...)` → `logger.warn(...)`
- `src/components/foto/foto-baseline-banner.tsx:49` `console.warn(e)` (in catch di `window.print`) → `logger.warn(e)`

Lasciati invariati: tutti gli `console.error` in `auth-context.tsx`, `audit.ts`, `pdf-*`, `calendario.tsx`, `pazienti.$id.tsx`, `pdf-canvas-viewer.tsx`, `consensi-panel.tsx`, `anamnesi-panel.tsx`. Già loggano solo messaggi/oggetti error.

### 1D. `Promise.allSettled` — applicato in modo selettivo (#14)
**SOLO** dove la UI già tollera assenza dati e dove il fallback non maschera errori critici:

- **APPLICATO** in `src/hooks/use-kpi-mese.ts` (KPI dashboard): `Promise.all` → `Promise.allSettled`. Per ciascun risultato `rejected`: il KPI relativo resta `null` (stato già gestito dalla UI come "–" / non disponibile). NON sostituire `null` con `0` (sarebbe "fake data"). `.catch` finale aggiunto.
- **APPLICATO** in `src/hooks/use-calendario-eventi.ts`: `Promise.all([sedutePromise, eventiPromise, scadenzePromise])` → `Promise.allSettled`, con fallback `[]` per ciascuna fonte fallita. Già oggi la UI gestisce array vuoti per sezione; un guasto del singolo canale non deve impedire la visualizzazione degli altri.

- **NON APPLICATO** in `src/routes/_authenticated/pazienti.$id.tsx:41` (`Promise.all([pz, sd])`): se il paziente non si carica la pagina DEVE mostrare errore, non un guscio vuoto. Lascio `Promise.all`, aggiungo solo `.catch` che logga (l'errore si propaga all'`errorComponent` esistente).
- **NON APPLICATO** in qualunque `Promise.all` su consensi/sedute/anamnesi dove un fallback `[]` rischierebbe di nascondere documenti firmati / piani attivi.

### Verifica STEP 1
- `bun run lint` pulito, TypeScript strict ok.
- Build dev + prod ok (file `logger.ts` creato in prima pos.).
- Smoke test: login → dashboard → logout → re-login con altro utente: cache pulita, niente dati del precedente utente.
- Console produzione: solo `console.error` reali, niente warn rumorosi né PII.

---

## STEP 2 — Sostituzione `window.confirm` con `AlertDialog`

Eseguito **solo dopo** verifica STEP 1.

**Componente target:** `src/components/ui/alert-dialog.tsx` (Radix, già nel progetto). Radix gestisce nativamente focus trap, scroll lock, escape, portal su `document.body`.

### File da convertire (10 occorrenze)

| # | File | Riga | Contesto |
|---|------|------|----------|
| 1 | `calendario/evento-edit-dialog.tsx` | 212 | **DENTRO Dialog** ⚠ |
| 2 | `foto/foto-piano-panel.tsx` | 78 | pagina |
| 3 | `foto/foto-grid.tsx` | 102 | pagina |
| 4 | `paziente/sedute-panel.tsx` | 658 | pagina (può aprire dialog) ⚠ |
| 5 | `paziente/misurazione-dialog.tsx` | 117 | **DENTRO Dialog** ⚠ |
| 6 | `paziente/diario-panel.tsx` | 413 | pagina |
| 7 | `paziente/consensi-panel.tsx` | 116 | pagina |
| 8 | `paziente/consensi-panel.tsx` | 155 | pagina (può essere in dialog) ⚠ |
| 9 | `impostazioni.studio.tsx` | 361 | pagina |
| 10 | `pazienti.$id.edit.tsx` | 174 | pagina |

### Pattern standard

```tsx
const [confirmId, setConfirmId] = useState<string|null>(null);

// vecchio: if (!confirm("Testo?")) return; doStuff(id);
// nuovo:   setConfirmId(id);

<AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{/* testo identico al vecchio confirm */}</AlertDialogTitle>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Annulla</AlertDialogCancel>
      <AlertDialogAction onClick={() => { doStuff(confirmId!); setConfirmId(null); }}>
        {/* "Elimina" o "Conferma" o "Revoca" o "Annulla seduta" coerente col contesto */}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Regole rigorose
- Testo del titolo **identico** al testo del vecchio `confirm`.
- Etichette pulsanti coerenti con la convenzione dell'app (`Annulla` + verbo dell'azione).
- Nessun cambio di flusso, nessuna nuova validazione, nessun toast aggiuntivo.

### Prudenze su nesting Dialog/AlertDialog (file con ⚠)
Per i 4 file marcati ⚠ (1, 4, 5, 8):
- Radix consente `AlertDialog` nidificato in `Dialog`: entrambi usano `Portal` su `document.body`, quindi z-index non confligge. **Ma** focus trap e scroll lock si stackano: alla chiusura dell'AlertDialog il focus deve tornare al Dialog padre (Radix lo fa di default, ma va verificato).
- **Test manuale obbligatorio per file ⚠:**
  1. aprire il Dialog padre
  2. triggerare l'AlertDialog
  3. premere `Esc` → solo l'AlertDialog si chiude, il Dialog padre resta aperto
  4. premere `Annulla` → idem
  5. premere `Conferma` → AlertDialog si chiude, azione eseguita, Dialog padre eventualmente si chiude da solo se la logica esistente lo prevedeva
  6. verificare niente overlay residui, scroll body sbloccato correttamente.
- Se in un file ⚠ il `confirm` veniva chiamato in un handler che chiudeva subito il Dialog padre, **mantenere lo stesso ordine**: prima azione, poi (eventuale) chiusura Dialog padre, esattamente come oggi.

### Procedura per file
1. modifica un solo file
2. `bun run lint` + verifica TS
3. smoke test del flusso modificato
4. solo allora passare al file successivo

### Esclusioni esplicite
- File toccati in STEP 1 non vengono rivisitati.
- Nuovi `confirm` scoperti durante l'esecuzione → segnalati al termine, non convertiti senza approvazione.

---

## Cosa NON viene toccato (riconfermato)
- Logica peso/altezza in `pazienti.$id.tsx` (#12).
- Query `select('*')` / paginazione (#5).
- Componenti monolitici (#4).
- `eslint-disable exhaustive-deps` (#7).
- Edge function `share-consenso` (#2).
- Pattern `createServerFn` (#3).
