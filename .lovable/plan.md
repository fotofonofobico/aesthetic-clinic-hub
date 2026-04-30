## Fix coerenza tab Foto vs banner baseline

**Comportamento corretto** (allineato a come funzionano già le sedute):


| Stato piano                   | Banner "Foto baseline mancanti" sotto nome   | Card piano nella tab Foto |
| ----------------------------- | -------------------------------------------- | ------------------------- |
| bozza                         | nascosto                                     | nascosta                  |
| attivo / sospeso / completato | mostrato se baseline manca                   | mostrata                  |
| annullato                     | mostrato se baseline manca (memoria storica) | nascosta                  |


Attualmente la tab Foto elenca **tutti** i piani del paziente, comprese bozze e annullati. Va filtrata.

Inoltre il banner baseline al momento esclude anche gli annullati (modifica precedente troppo aggressiva): per gli annullati con baseline mancante deve restare visibile, solo le bozze vanno escluse.

### Modifiche

**1. `src/components/foto/foto-paziente-tab.tsx**`
Aggiungere filtro alla query piani:

```ts
.not("stato", "in", "(bozza,annullato)")
```

**2. `src/components/foto/foto-baseline-banner.tsx**`
Cambiare il filtro stato da `(bozza,annullato)` a solo `bozza`:

```ts
.neq("stato", "bozza")
```

Nessuna modifica DB. Due righe in totale.

sostituisci ovunque "baseline mancante" con "Foto PRIMA"