# Gestionale Medicina Estetica

# TASK 001 --- Service Layer Foundation

## Stato task

Versione: 1.0

Stato progetto:

READY FOR CLAUDE IMPLEMENTATION

Primo task implementativo della roadmap congelata.

------------------------------------------------------------------------

# 1. Obiettivo

Introdurre il primo livello Service Layer nel dominio Pazienti.

Scopo:

ridurre l'accesso diretto a Supabase da parte delle route e dei
componenti React.

Situazione attuale:

Component / Route

↓

Supabase Client

↓

Database

Situazione target:

Component

↓

Domain Hook

↓

Service Layer

↓

Supabase Client

↓

Database

------------------------------------------------------------------------

# 2. Motivazione tecnica

Il dominio Pazienti è scelto come area pilota perché rappresenta un
dominio centrale del gestionale.

L'introduzione progressiva del Service Layer permette di:

-   centralizzare l'accesso ai dati
-   ridurre query duplicate
-   separare UI e persistenza
-   creare una base riutilizzabile per futuri domini

Non è previsto un refactoring completo dell'applicazione.

------------------------------------------------------------------------

# 3. Vincoli

## Obbligatorio

Mantenere:

-   React
-   TypeScript
-   TanStack Router
-   Supabase
-   PostgreSQL
-   React Hook Form
-   Zod

Non modificare:

-   database schema
-   tabelle
-   relazioni
-   dati paziente
-   workflow clinici
-   consensi
-   firma digitale
-   autenticazione

------------------------------------------------------------------------

# 4. Approccio richiesto

Migrazione incrementale.

Non spostare tutto il progetto.

Applicare il pattern solamente al dominio Pazienti.

------------------------------------------------------------------------

# 5. Struttura prevista

Creare progressivamente:

    src/
     ├── services/
     │    └── pazienti/
     │         ├── patient.service.ts
     │         ├── patient.types.ts
     │         └── index.ts
     │
     └── hooks/
          └── use-pazienti.ts

La struttura definitiva può essere adattata se il repository presenta
pattern già esistenti coerenti.

Eventuali variazioni devono essere motivate.

------------------------------------------------------------------------

# 6. Responsabilità Service Layer

File previsto:

    patient.service.ts

Responsabilità:

-   comunicazione con Supabase
-   recupero dati paziente
-   query dominio paziente
-   operazioni CRUD già esistenti migrate

Non deve contenere:

-   JSX
-   componenti React
-   toast UI
-   navigazione
-   stato locale

------------------------------------------------------------------------

# 7. Responsabilità Domain Hook

File previsto:

    use-pazienti.ts

Responsabilità:

-   collegamento tra React e Service Layer
-   gestione stato caricamento
-   gestione stato errore
-   refresh dati

Non deve contenere query Supabase dirette.

------------------------------------------------------------------------

# 8. Primo ambito di migrazione

Migrare inizialmente:

## Lista pazienti

Obiettivo:

rimuovere accesso diretto Supabase dalla pagina lista pazienti.

## Dettaglio paziente

Obiettivo:

rimuovere accesso diretto Supabase dalla pagina dettaglio paziente.

------------------------------------------------------------------------

# 9. File potenzialmente coinvolti

Da verificare nel repository:

Possibili nuovi file:

    src/services/pazienti/patient.service.ts
    src/services/pazienti/patient.types.ts
    src/services/pazienti/index.ts
    src/hooks/use-pazienti.ts

Possibili modifiche:

    src/routes/_authenticated/pazienti.index.tsx
    src/routes/_authenticated/pazienti.$id.tsx

Claude deve confermare i file reali prima della modifica.

------------------------------------------------------------------------

# 10. Procedura obbligatoria Claude

Prima di modificare codice:

1.  Analizzare i file coinvolti.
2.  Confermare struttura attuale.
3.  Proporre piano di modifica.
4.  Attendere approvazione.

------------------------------------------------------------------------

# 11. Criteri di accettazione

Il task è completato quando:

## Architettura

✓ Esiste un Service Layer funzionante per Pazienti.

✓ Le operazioni migrate non interrogano direttamente Supabase dalle
route.

✓ La logica dati è isolata.

------------------------------------------------------------------------

## Funzionalità

✓ Lista pazienti funzionante.

✓ Dettaglio paziente funzionante.

✓ Nessuna regressione evidente nel workflow clinico.

------------------------------------------------------------------------

## Qualità

✓ TypeScript senza errori.

✓ Build completata.

✓ Nessuna nuova dipendenza introdotta.

✓ Nessuna modifica database.

------------------------------------------------------------------------

# 12. Piano rollback

In caso di problemi:

1.  Ripristinare le query precedenti.
2.  Rimuovere gli hook introdotti.
3.  Eliminare il service se necessario.
4.  Verificare build.

Nessuna migrazione database richiesta.

------------------------------------------------------------------------

# 13. Report finale richiesto

Claude deve consegnare:

## Modifiche effettuate

-   file creati
-   file modificati

## Motivazione

-   problema risolto
-   debito tecnico ridotto

## Verifica

-   build
-   TypeScript
-   workflow testati

## Rischi residui

-   parti non migrate
-   possibili miglioramenti futuri

------------------------------------------------------------------------

# Fine TASK 001 --- Service Layer Foundation
