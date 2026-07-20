# Gestionale Medicina Estetica

# TASK 005 --- Feature Organization

## Stato task

Versione: 1.1

Stato progetto:

READY FOR CLAUDE IMPLEMENTATION

Quinto task implementativo della roadmap congelata.

------------------------------------------------------------------------

# 1. Obiettivo

Riorganizzare progressivamente il codice del dominio Pazienti secondo
una struttura orientata alle feature.

Scopo:

migliorare la leggibilità, ridurre la frammentazione del codice e
preparare l'estensione del progetto agli altri domini, mantenendo
invariato il comportamento funzionale dell'applicazione.

------------------------------------------------------------------------

# 2. Motivazione tecnica

Al termine dei task precedenti il dominio Pazienti dispone di un Service
Layer, di una gestione uniforme degli errori e di una migliore
separazione delle responsabilità.

Questo task conclude il primo ciclo di migrazione organizzando il codice
del dominio in modo più coerente.

L'intervento è incrementale e non costituisce un refactoring completo
del repository.

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
-   comportamento funzionale dell'applicazione

------------------------------------------------------------------------

# 4. Approccio richiesto

Refactoring incrementale.

Applicare la riorganizzazione esclusivamente al codice già migrato nei
task precedenti.

La struttura finale dovrà essere coerente con la Technical Baseline e
con la struttura effettivamente presente nel repository.

Eventuali nuove cartelle o spostamenti di file dovranno essere motivati
e confermati prima dell'implementazione.

------------------------------------------------------------------------

# 5. Responsabilità della riorganizzazione

L'obiettivo è:

-   raggruppare il codice appartenente allo stesso dominio
-   migliorare la leggibilità del progetto
-   ridurre l'accoppiamento tra domini
-   mantenere la compatibilità con il codice esistente
-   preparare l'estensione agli altri domini

La soluzione dovrà riutilizzare quanto introdotto nei TASK 001--004.

Non introdurre nuove convenzioni organizzative se non strettamente
necessarie.

------------------------------------------------------------------------

# 6. Primo ambito di migrazione

Applicare il nuovo approccio esclusivamente al dominio Pazienti.

Il perimetro comprende solamente il codice già migrato nei TASK
precedenti.

Gli altri domini saranno oggetto delle successive attività di
migrazione.

------------------------------------------------------------------------

# 7. File potenzialmente coinvolti

Da verificare nel repository.

Possibili modifiche:

    src/services/
    src/hooks/
    src/routes/

Eventuali nuove cartelle o ulteriori file dovranno essere motivati.

Claude deve confermare la struttura reale del repository prima della
modifica.

------------------------------------------------------------------------

# 8. Procedura obbligatoria Claude

Prima di modificare codice:

1.  Analizzare la struttura del repository.
2.  Individuare le aree candidate alla riorganizzazione.
3.  Proporre il piano di implementazione.
4.  Attendere approvazione prima di modificare il codice.

------------------------------------------------------------------------

# 9. Criteri di accettazione

## Architettura

✓ Il codice del dominio Pazienti risulta organizzato in modo più
coerente.

✓ La riorganizzazione riguarda esclusivamente il perimetro definito dal
presente task.

✓ La nuova struttura rimane coerente con la Technical Baseline e con il
repository.

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

1.  Ripristinare la struttura precedente.
2.  Ripristinare gli import originali.
3.  Verificare build.
4.  Verificare il corretto funzionamento di Lista e Dettaglio Paziente.

Nessuna migrazione database richiesta.

------------------------------------------------------------------------

# 11. Report finale richiesto

Claude deve consegnare:

## Modifiche effettuate

-   file creati
-   file modificati
-   file spostati

## Motivazione

-   problema risolto
-   debito tecnico ridotto

## Verifica

-   build
-   TypeScript
-   workflow testati

## Rischi residui

-   parti non ancora riorganizzate
-   possibili miglioramenti futuri

------------------------------------------------------------------------

# Fine TASK 005 --- Feature Organization
