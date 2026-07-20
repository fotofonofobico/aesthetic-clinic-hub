# Gestionale Medicina Estetica

# TASK 003 --- RLS e Permission

## Stato task

Versione: 1.1

Stato progetto:

READY FOR CLAUDE IMPLEMENTATION

Terzo task implementativo della roadmap congelata.

------------------------------------------------------------------------

# 1. Obiettivo

Verificare la coerenza tra il Service Layer introdotto nei task
precedenti e il modello di sicurezza già definito nel progetto.

Scopo:

confermare che le operazioni migrate continuino a rispettare le policy
RLS e il sistema di autorizzazione esistente.

------------------------------------------------------------------------

# 2. Motivazione tecnica

La fase di audit ha già verificato le RLS Policy e il modello di
sicurezza del database.

Con l'introduzione del Service Layer è necessario verificare che il
nuovo livello applicativo mantenga la stessa coerenza con il modello di
autorizzazione esistente.

L'intervento è incrementale e riguarda esclusivamente il perimetro già
migrato.

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
-   workflow clinici
-   autenticazione
-   gestione consensi

Eventuali modifiche alle policy RLS o ad altri elementi di sicurezza
dovranno essere preventivamente approvate, in coerenza con il Claude
Implementation Brief.

------------------------------------------------------------------------

# 4. Approccio richiesto

Verifica incrementale.

L'attività consiste principalmente nella verifica della coerenza tra
Service Layer, Supabase e policy RLS.

Eventuali correzioni dovranno essere limitate esclusivamente ai problemi
emersi durante la verifica e rimanere all'interno del perimetro del
task.

------------------------------------------------------------------------

# 5. Responsabilità della verifica

La verifica dovrà:

-   confermare il corretto utilizzo delle policy esistenti
-   verificare la coerenza del flusso autorizzativo
-   mantenere la compatibilità con il codice esistente
-   preparare l'estensione del modello agli altri domini

Non introdurre nuovi modelli di autorizzazione se non strettamente
necessario.

------------------------------------------------------------------------

# 6. Primo ambito di verifica

Applicare la verifica esclusivamente alle operazioni migrate nei TASK
precedenti.

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

Claude deve confermare i file reali prima della modifica.

------------------------------------------------------------------------

# 8. Procedura obbligatoria Claude

Prima di modificare codice:

1.  Analizzare i file coinvolti.
2.  Verificare il flusso delle autorizzazioni.
3.  Proporre il piano di implementazione.
4.  Attendere approvazione prima di modificare il codice.

------------------------------------------------------------------------

# 9. Criteri di accettazione

## Architettura

✓ Il Service Layer rispetta il modello di autorizzazione esistente.

✓ Le policy RLS risultano coerenti con il codice del perimetro migrato.

✓ La verifica riguarda esclusivamente il perimetro definito dal presente
task.

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

✓ Nessuna modifica database non approvata.

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

-   verifica effettuata
-   eventuali problemi corretti
-   debito tecnico ridotto

## Verifica

-   build
-   TypeScript
-   workflow testati

## Rischi residui

-   parti non ancora verificate
-   possibili miglioramenti futuri

------------------------------------------------------------------------

# Fine TASK 003 --- RLS e Permission
