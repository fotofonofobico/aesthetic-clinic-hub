# Gestionale Medicina Estetica

# TASK 004 --- Separazione Form / Domain

## Stato task

Versione: 1.1

Stato progetto:

READY FOR CLAUDE IMPLEMENTATION

Quarto task implementativo della roadmap congelata.

------------------------------------------------------------------------

# 1. Obiettivo

Separare progressivamente la logica dei form dalla logica di dominio per
il perimetro già migrato.

Scopo:

ridurre l'accoppiamento tra interfaccia utente, validazione, logica
applicativa e persistenza, mantenendo invariato il comportamento
funzionale dell'applicazione.

------------------------------------------------------------------------

# 2. Motivazione tecnica

Con l'introduzione del Service Layer le responsabilità possono essere
progressivamente distribuite tra i diversi livelli applicativi.

L'intervento consente di:

-   migliorare la manutenibilità
-   ridurre le responsabilità dei componenti React
-   favorire il riutilizzo della logica applicativa
-   preparare la migrazione dei successivi domini

L'intervento è incrementale e non costituisce un refactoring completo.

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
-   autenticazione
-   workflow clinici
-   gestione consensi
-   comportamento funzionale dei form

------------------------------------------------------------------------

# 4. Approccio richiesto

Refactoring incrementale.

Applicare la separazione esclusivamente al perimetro già migrato nei
task precedenti.

La collocazione della logica di dominio dovrà essere coerente con la
struttura esistente del repository e confermata prima
dell'implementazione.

------------------------------------------------------------------------

# 5. Responsabilità della separazione

L'obiettivo è ottenere una chiara separazione tra:

-   interfaccia utente
-   validazione
-   logica di dominio
-   Service Layer
-   persistenza

La soluzione dovrà:

-   mantenere la compatibilità con il codice esistente
-   riutilizzare il Service Layer introdotto nei task precedenti
-   evitare duplicazioni della business logic
-   preservare la validazione esistente

Non introdurre nuovi pattern architetturali se non strettamente
necessari.

------------------------------------------------------------------------

# 6. Primo ambito di migrazione

Applicare il nuovo approccio esclusivamente alle funzionalità già
migrate nei TASK precedenti.

In questa fase il perimetro è limitato alle operazioni di lettura del
dominio Pazienti.

Le operazioni di scrittura saranno oggetto delle successive attività di
migrazione.

------------------------------------------------------------------------

# 7. File potenzialmente coinvolti

Da verificare nel repository.

Possibili modifiche:

    src/routes/_authenticated/
    src/services/pazienti/
    src/hooks/

Eventuali ulteriori file dovranno essere motivati.

Claude deve confermare i file reali prima della modifica.

------------------------------------------------------------------------

# 8. Procedura obbligatoria Claude

Prima di modificare codice:

1.  Analizzare i file coinvolti.
2.  Individuare la logica di dominio presente nei form.
3.  Proporre il piano di implementazione.
4.  Attendere approvazione prima di modificare il codice.

------------------------------------------------------------------------

# 9. Criteri di accettazione

## Architettura

✓ Le responsabilità tra UI, validazione, logica di dominio e Service
Layer risultano più chiaramente separate.

✓ La soluzione riguarda esclusivamente il perimetro definito dal
presente task.

------------------------------------------------------------------------

## Funzionalità

✓ Lista Pazienti continua a funzionare.

✓ Dettaglio Paziente continua a funzionare.

✓ Nessuna regressione evidente.

------------------------------------------------------------------------

## Qualità

✓ TypeScript senza errori.

✓ Build completata.

✓ Nessuna nuova dipendenza introdotta.

✓ Nessuna modifica database.

------------------------------------------------------------------------

# 10. Piano rollback

In caso di problemi:

1.  Ripristinare il codice precedente.
2.  Annullare le modifiche introdotte.
3.  Verificare build.
4.  Verificare il corretto funzionamento di Lista e Dettaglio Paziente.

Nessuna migrazione database richiesta.

------------------------------------------------------------------------

# 11. Report finale richiesto

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

-   parti non ancora migrate
-   possibili miglioramenti futuri

------------------------------------------------------------------------

# Fine TASK 004 --- Separazione Form / Domain
