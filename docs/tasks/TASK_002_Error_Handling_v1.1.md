# Gestionale Medicina Estetica

# TASK 002 --- Error Handling

## Stato task

Versione: 1.1

Stato progetto:

READY FOR CLAUDE IMPLEMENTATION

Secondo task implementativo della roadmap congelata.

------------------------------------------------------------------------

# 1. Obiettivo

Introdurre una gestione uniforme degli errori all'interno del Service
Layer.

Scopo:

centralizzare il trattamento degli errori delle operazioni migrate nel
TASK 001, mantenendo invariato il comportamento funzionale
dell'applicazione.

------------------------------------------------------------------------

# 2. Motivazione tecnica

Con l'introduzione del Service Layer è opportuno uniformare la gestione
degli errori per evitare logiche duplicate e facilitare la manutenzione.

L'intervento è incrementale e riguarda esclusivamente il perimetro già
migrato.

Non costituisce un refactoring completo della gestione degli errori
dell'applicazione.

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

I messaggi mostrati all'utente non devono essere modificati, salvo
quando ciò sia indispensabile per mantenere la coerenza del nuovo flusso
di gestione errori.

------------------------------------------------------------------------

# 4. Approccio richiesto

Migrazione incrementale.

Applicare una gestione uniforme esclusivamente alle operazioni già
migrate nel Service Layer.

Non estendere il nuovo approccio all'intera applicazione.

------------------------------------------------------------------------

# 5. Responsabilità della gestione errori

La soluzione dovrà:

-   centralizzare la gestione degli errori del Service Layer
-   mantenere la compatibilità con il codice esistente
-   evitare duplicazioni
-   costituire la base per le successive migrazioni previste dalla
    roadmap

La forma concreta della soluzione dovrà essere coerente con
l'architettura esistente del repository.

------------------------------------------------------------------------

# 6. Primo ambito di migrazione

Applicare il nuovo approccio esclusivamente alle operazioni migrate nel
TASK 001.

In questa fase il perimetro è limitato alle operazioni di lettura del
dominio Pazienti.

Le operazioni di scrittura saranno oggetto delle successive attività di
migrazione.

------------------------------------------------------------------------

# 7. File potenzialmente coinvolti

Da verificare nel repository.

Possibili modifiche:

    src/services/pazienti/
    src/hooks/use-pazienti.ts

Eventuali ulteriori file dovranno essere motivati.

Le route dovranno essere modificate solo se strettamente necessario per
mantenere la compatibilità con il nuovo flusso di gestione errori.

Claude deve confermare i file reali prima della modifica.

------------------------------------------------------------------------

# 8. Procedura obbligatoria Claude

Prima di modificare codice:

1.  Analizzare i file coinvolti.
2.  Confermare la struttura attuale del repository.
3.  Proporre il piano di implementazione.
4.  Attendere approvazione prima di modificare il codice.

------------------------------------------------------------------------

# 9. Criteri di accettazione

## Architettura

✓ Le operazioni migrate utilizzano una gestione uniforme degli errori.

✓ Il comportamento delle route rimane compatibile con il codice
esistente.

✓ Il nuovo approccio copre esclusivamente il perimetro definito dal
presente task.

------------------------------------------------------------------------

## Funzionalità

✓ Lista Pazienti continua a funzionare.

✓ Dettaglio Paziente continua a funzionare.

✓ Gli errori vengono gestiti in modo coerente.

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

# Fine TASK 002 --- Error Handling
