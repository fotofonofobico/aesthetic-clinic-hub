## Modifiche immediate (non ambigue)

1. **Saluto dashboard**: sostituire `{user?.email}` con `Nome Cognome` letto dalla tabella `profiles` (campo `nome` + `cognome`). Fallback a email se profilo vuoto. Aggiungere saluto contestuale: "Buongiorno/Buon pomeriggio/Buonasera, Dr. Nome Cognome".
2. **Rimuovere "Azioni Rapide"** dalla dashboard (Nuovo paziente / trattamento / consenso). Cancellare componente `azioni-rapide.tsx` e import.
3. **Header app-layout**: mostrare "Nome Cognome" al posto di email anche in alto a destra.
4. **Consensi**: il default `durata_tipo` per template `trattamento_ciclo` è già "sedute" nel form — confermo che non serve toccare nulla. Verificherò solo il default `cicloDurata` (oggi "3" sedute, ok).

## Nuova sezione Impostazioni (`/impostazioni`)

Sidebar: trasformare l'attuale voce disabilitata "Impostazioni" in link reale (visibile a tutti, contenuti differenziati per ruolo).

Layout a tab/sotto-pagine (file route TanStack: `impostazioni.tsx` come layout con `<Outlet />` + sotto-route):

### Tab 1 — Il mio profilo (tutti)
Editabile da chiunque, scrive su `profiles` solo il proprio record (RLS già ok).
- Nome, Cognome, Telefono, Qualifica (libera: medico estetico, infermiere, segreteria…), Numero albo
- Cambio password (`supabase.auth.updateUser({ password })`)
- Logout

### Tab 2 — Studio (solo medico)
Nuova tabella `studio_info` (singolo record). Campi:
- Ragione sociale, P.IVA, Codice fiscale, Indirizzo, Città, CAP, Provincia
- Telefono, Email, PEC, Sito web
- Logo (upload bucket `studio-assets` privato, signed URL)
- Direttore sanitario (testo)

Useremo questi dati nelle intestazioni PDF consensi/anamnesi/ricevute future.

### Tab 3 — Utenti & Ruoli (solo medico)
Schema attuale: due ruoli `medico` (admin) e `collaboratore` (standard) — manteniamo come da tua richiesta, predisponendo l'enum `app_role` per future estensioni (i valori attuali bastano).

UI:
- Lista profili con: Nome, Email, Qualifica, Ruolo (badge), Stato (attivo/disattivato)
- Per ogni utente: cambia ruolo (medico/collaboratore), attiva/disattiva (`profiles.attivo`), reset password (invia email)
- Nessuna creazione manuale: i nuovi utenti si registrano via signup standard, poi il medico li promuove
- Audit: ogni cambio ruolo/attivazione scritto in `audit_log`

Cosa NON facciamo ora (predisposto ma non implementato): permessi granulari per modulo. I due ruoli usano già le RLS esistenti.

### Tab 4 — Backup & Export (solo medico)
- Export CSV completo: pazienti, sedute, consensi firmati, movimenti magazzino — generati lato client da query Supabase, download diretto
- Export PDF cartella singolo paziente: pulsante "Esporta cartella" con anagrafica + anamnesi corrente + sedute + consensi (già presente la logica PDF nel progetto, riusiamo)
- Storico export (opzionale, lo lascio fuori per ora)

### Tab 5 — Preferenze (tutti)
- Vista calendario predefinita (giorno/settimana/mese) — già esiste `calendario_preferenze`
- Follow-up automatico on/off + offset giorni — già esiste in `calendario_preferenze`
- Tema chiaro/scuro (frontend only)

## Database

Nuova migration:

```sql
-- Tabella info studio (singleton)
CREATE TABLE public.studio_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ragione_sociale text,
  partita_iva text,
  codice_fiscale text,
  indirizzo text,
  citta text,
  cap text,
  provincia text,
  telefono text,
  email text,
  pec text,
  sito_web text,
  logo_url text,
  direttore_sanitario text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.studio_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Studio visibile a operatori attivi" ON public.studio_info
  FOR SELECT TO authenticated USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici modificano studio" ON public.studio_info
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'medico'))
  WITH CHECK (has_role(auth.uid(),'medico'));

-- Bucket logo
INSERT INTO storage.buckets (id,name,public) VALUES ('studio-assets','studio-assets',false)
ON CONFLICT DO NOTHING;
-- policy: solo authenticated read, solo medici write
```

## File toccati / creati

**Edit:**
- `src/components/app-layout.tsx` — nome+cognome in header, link Impostazioni attivo
- `src/routes/_authenticated/dashboard.tsx` — saluto "Buongiorno, Dr. Nome Cognome", rimuovo `<AzioniRapide />`
- (no-op) `consensi.index.tsx` già default sedute

**Delete:**
- `src/components/dashboard/azioni-rapide.tsx`

**Create:**
- `src/routes/_authenticated/impostazioni.tsx` (layout con tab)
- `src/routes/_authenticated/impostazioni.profilo.tsx`
- `src/routes/_authenticated/impostazioni.studio.tsx`
- `src/routes/_authenticated/impostazioni.utenti.tsx`
- `src/routes/_authenticated/impostazioni.backup.tsx`
- `src/routes/_authenticated/impostazioni.preferenze.tsx`
- `src/hooks/use-profile.ts` — fetch profilo corrente (riusabile per saluto)
- `src/hooks/use-studio-info.ts`

## Cosa NON includo (da decidere dopo)
- Notifiche email (richiede provider SMTP)
- 2FA
- Permessi granulari per modulo
- Log accessi UI (i dati sono già scritti in `paziente_access_log`/`audit_log`, mostriamo dopo)

Procedo con implementazione su tua approvazione.