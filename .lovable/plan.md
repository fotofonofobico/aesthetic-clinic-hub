
# Piano interventi anamnesi + fix UI

## 1. Bug "null is not an object (useMemo)" + "Something went wrong" su Trattamenti/Consensi

**Causa**: errore "Importing a module script failed" nei console log → il browser sta caricando un **chunk JS vecchio** che non esiste più dopo un nuovo deploy. Quando l'import dinamico fallisce, React monta `null` e l'hook `useMemo` esplode. È lo stesso motivo per cui Trattamenti/Consensi vanno in "Something went wrong".

**Soluzione**:
- Aggiungere un **error boundary globale** sul router (`defaultErrorComponent`) che, se rileva un errore di tipo "Failed to fetch dynamically imported module" / "Importing a module script failed", esegue un **reload automatico della pagina** (una sola volta, con flag in sessionStorage per evitare loop).
- Per gli altri errori, mostrare un messaggio pulito con bottone "Ricarica".
- Questo risolve sia l'anamnesi che trattamenti/consensi quando il preview si aggiorna.

**Workaround immediato per te ora**: fai un hard reload (Cmd+Shift+R) sulla preview.

## 2. Pallino "Sì/No" non centrato

Nel componente `YesNoRow` il `RadioGroupItem` è dentro una `<label>` ma non è verticalmente allineato. Sistemo aggiungendo `items-center` corretti e usando `htmlFor`/`id` per coppia label↔radio, così il click funziona ovunque e il pallino è centrato.

## 3. Interventi chirurgici → multi-select strutturata

Sostituisco la singola textarea "Note interventi" con:

Quando flaggo "Sì" su **Interventi chirurgici / traumi**, appare un blocco con checkbox multi-select:
- Chirurgia maggiore (addominale / tiroidea / bariatrica)
- Traumi / fratture
- Chirurgia estetica
- Chirurgia dermatologica / cutanea
- Altro → se selezionato, apre textarea "Specifica"

Schema JSONB aggiornato:
```
patologica.interventi: boolean
patologica.interventi_tipi: { maggiore, traumi, estetica, dermatologica, altro: bool }
patologica.interventi_altro_note: string
```

## 4. Tab "Alert" — chiarimento e fix

**Stato attuale**:
- `paziente_alert` = alert **manuali** scritti a mano dall'operatore (es. "non usare prodotti al nichel")
- `anamnesi_flag_rischio` = flag **automatici** generati dall'anamnesi (allergie, gravidanza, HSV, ecc.)
- Il banner rosso in alto unisce entrambi, **ma il tab "Alert" mostra solo i manuali** → da qui la confusione.

**Fix proposto**: il tab "Alert" diventa **unificato** con due sezioni:
- **Flag automatici da anamnesi** (sola lettura, badge severity, indica "generato da anamnesi")
- **Alert manuali** (form di aggiunta + lista, come ora)

Il contatore nel tab `Alert (N)` somma entrambi.

## 5. Procediamo poi

Una volta confermato e implementato questo blocco, passiamo alle prossime sezioni del modulo Paziente (parametri corporei per criolipolisi, foto, sedute, piani, ecc.) come da tua roadmap.

## Dettagli tecnici

- `src/router.tsx`: aggiungo `defaultErrorComponent` con detect del messaggio chunk-load + `window.location.reload()` one-shot.
- `src/components/paziente/anamnesi-panel.tsx`: 
  - fix `YesNoRow` (allineamento radio)
  - blocco multi-select interventi con checkbox + condizionale "Altro"
- `src/lib/flag-rischio.ts`: tipi `interventi_tipi` aggiunti (nessun nuovo flag critico, solo storage)
- `src/routes/_authenticated/pazienti.$id.tsx`: `AlertPanel` riceve anche `flags`, mostra sezione "Da anamnesi" sopra gli alert manuali; contatore tab = `flags.length + alerts.length`.
- Nessuna migrazione DB necessaria (i nuovi campi vivono nel JSONB `patologica`).
