# Fix "Errore creazione prodotto" (RLS prodotto_marca)

## Diagnosi

Dai network log:
- `POST /prodotto_marca` → **401** `new row violates row-level security policy`
- Header `authorization` = anon key (HS256), **non** il JWT utente (ES256)
- Body inviato: `{"nome":"Allergan","created_by":null}`

La policy `INSERT` richiede `is_active_operator(auth.uid())`. Poiché il bearer è la sola anon key, `auth.uid()` è `NULL` → policy fallisce.

Il profilo è `attivo=true` (verificato in DB), quindi la policy in sé è corretta. Il problema è che la chiamata parte **senza sessione utente allegata**: in alcune chiamate REST recenti (`prodotto_marca`, `prodotto`, `magazzino_movimento`) il client supabase non sta inviando il JWT, mentre `user_roles` lo invia. Questo capita tipicamente quando il modulo viene importato/eseguito prima che la sessione sia ripristinata da `localStorage`, oppure quando il token è scaduto silenziosamente.

## Strategia in 2 livelli

### 1) Garanzia di sessione prima di ogni write magazzino
In `src/lib/magazzino.ts`, sostituire le `await supabase.auth.getUser()` con un helper:

```ts
async function requireUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    // tenta refresh esplicito
    const { data: r } = await supabase.auth.refreshSession();
    if (!r.session?.user) throw new Error("Sessione scaduta — rifai il login");
    return r.session.user.id;
  }
  return session.user.id;
}
```

Usato in: `creaMarca`, `creaFornitore`, `creaProdotto`, `creaLotto`, `aggiungiCarico`, `registraScaricoManuale`, `rettificaInventario`. Il refresh forza supabase-js a rigenerare gli header per le richieste successive.

### 2) UX: messaggi chiari + invalidazione cache
- In `ProdottoFormDialog` (e `LottoFormDialog`, `RettificaDialog`): se l'errore contiene "row-level security" o "Sessione scaduta", mostrare toast "Sessione scaduta, ricarica la pagina" con un bottone Reload.
- Aggiungere un effetto in `magazzino.index.tsx` che al mount chiami `supabase.auth.getSession()` per "scaldare" il token prima delle prime query.

## Bonus: reattivazione sessione automatica all'apertura del modulo
In `src/routes/_authenticated/magazzino.index.tsx`, all'inizio del componente:

```ts
React.useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) supabase.auth.refreshSession();
  });
}, []);
```

Così se l'utente arriva alla pagina con un token "lazy", lo riallinea prima di triggerare il form.

## File da modificare

1. `src/lib/magazzino.ts` — aggiungere `requireUserId()`, sostituire le `getUser()` nelle funzioni di mutazione (creaMarca, creaFornitore, creaProdotto, creaLotto, aggiungiCarico, registraScaricoManuale, rettificaInventario).
2. `src/components/magazzino/prodotto-form-dialog.tsx` — gestire errori RLS con messaggio specifico.
3. `src/components/magazzino/lotto-form-dialog.tsx` — idem.
4. `src/components/magazzino/rettifica-dialog.tsx` — idem.
5. `src/routes/_authenticated/magazzino.index.tsx` — warm-up sessione al mount.

## Cosa NON cambio
- Le RLS policy: sono corrette così.
- Lo schema DB.
- Il client supabase generato.

## Risultato atteso
- Cliccando "Crea prodotto" / "Nuova marca", il client invia il JWT utente → `auth.uid()` valorizzato → policy passa → riga creata.
- Se la sessione è davvero scaduta, l'utente vede un messaggio chiaro invece dell'errore generico.

Confermi che procedo con queste 5 modifiche?
