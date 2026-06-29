# Piano interventi

## 1. Rename brand "MedEstetica" → "Aesthetic Clinic Hub"
- `src/components/app-layout.tsx` (riga 109)
- `src/routes/login.tsx` (riga 81)
- `src/routes/index.tsx` (righe 30 e 82 — header + footer)
- `src/routes/__root.tsx` (riga 43 — meta author)
- `src/styles.css` (riga 8 — commento header)

## 2. Messaggio login
In `src/routes/login.tsx`:
- Titolo: "Accesso operatore" → "Area riservata"
- Descrizione: rifrasata per riflettere il nuovo brand e il fatto che l'attivazione operatori avviene tramite il medico responsabile (non auto-registrazione libera).

## 3. Anamnesi — sezione "Patologie infettive"
- `src/lib/flag-rischio.ts`: estendere `AnamnesiPatologica` con
  ```
  infettiva?: boolean;       // toggle generale
  hbv?: boolean;
  hcv?: boolean;
  hiv?: boolean;
  infettiva_altro?: boolean;
  infettiva_altro_note?: string;
  ```
- `src/components/paziente/anamnesi-panel.tsx`: dentro la card "2. Patologica", aggiungere blocco `YesNoConditional` "Patologie infettive (anamnesi generale)" con checkbox HBV/HCV/HIV/Altro + campo testo libero quando "Altro" è attivo. Persistenza tramite `patch("patologica", { ... })` già esistente. Nessun cambio DB (il campo `patologica` è JSONB).

## 4. Banner Lovable copre tasto firma su mobile
- `src/components/signature-session-dialog.tsx`: aggiungere padding-bottom mobile al `DialogFooter` (riga 670) — `className="gap-2 pb-16 sm:pb-2"` — così i pulsanti "Conferma e prosegui" / "Avanti" non vengono coperti dal badge in basso a destra sui dispositivi piccoli.

## 5. Errore RLS intermittente sulla creazione trattamenti
- `src/routes/_authenticated/trattamenti.index.tsx` (riga 347-353):
  - In caso di errore con `code === "42501"` o messaggio contenente `row-level security`, eseguire `await supabase.auth.refreshSession()` e ritentare l'insert una sola volta.
  - Se il retry fallisce, mostrare toast esplicativo: "Sessione scaduta o permessi mancanti. Effettua di nuovo l'accesso."
- Nessuna modifica alle policy DB (audit precedente ha confermato che la policy `has_role(auth.uid(), 'medico')` è corretta; la causa è il JWT stantio).

## Note
- Nessuna migrazione SQL necessaria.
- Tutti gli interventi sono frontend o copy, salvo l'estensione tipi TS in `flag-rischio.ts`.
