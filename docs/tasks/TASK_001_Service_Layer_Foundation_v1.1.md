# Gestionale Medicina Estetica

# TASK 001 --- Service Layer Foundation

## Stato task

Versione: 1.1

Stato progetto:

READY FOR CLAUDE IMPLEMENTATION

Primo task implementativo della roadmap congelata.

------------------------------------------------------------------------

# 1. Obiettivo

Introdurre il Service Layer come punto unico di accesso ai dati per il
dominio Pazienti.

Scopo:

eliminare l'accesso diretto a Supabase dalle route coinvolte nel
presente task, mantenendo invariato il comportamento funzionale
dell'applicazione.

------------------------------------------------------------------------

# 2. Motivazione tecnica

Attualmente parte della logica di accesso ai dati è distribuita nelle
route React.

L'introduzione di un Service Layer dedicato consente di:

-   centralizzare l'accesso ai dati
-   ridurre l'accoppiamento con Supabase
-   migliorare la manutenibilità
-   preparare i successivi task della roadmap

L'intervento è incrementale e non costituisce un refactoring completo
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

------------------------------------------------------------------------

# 4. Approccio richiesto

Migrazione incrementale.

Il Service Layer dovrà essere introdotto esclusivamente per il perimetro
funzionale definito dal presente task.

Non riscrivere l'intero dominio Pazienti.

------------------------------------------------------------------------

# 5. Responsabilità del Service Layer

Il Service Layer sarà responsabile delle operazioni del dominio Pazienti
progressivamente migrate secondo il perimetro definito dal presente
task.

In questa prima fase il perimetro è limitato esclusivamente alle
operazioni di lettura.

Il Service Layer dovrà:

-   centralizzare l'accesso ai dati
-   isolare Supabase dalle route coinvolte
-   mantenere la compatibilità con il codice esistente
-   costituire la base per le successive migrazioni previste dalla
    roadmap

------------------------------------------------------------------------

# 6. Primo ambito di migrazione

Applicare il nuovo approccio esclusivamente alle funzionalità:

-   Lista Pazienti
-   Dettaglio Paziente

Le operazioni di creazione, modifica ed eliminazione non fanno parte del
presente task e saranno oggetto delle successive attività di migrazione
secondo la roadmap approvata.

------------------------------------------------------------------------

# 7. File potenzialmente coinvolti

Da verificare nel repository.

Possibili file:

    src/services/pazienti/patient.service.ts
    src/services/pazienti/patient.types.ts
    src/services/pazienti/index.ts
    src/hooks/use-pazienti.ts
    src/routes/_authenticated/pazienti.index.tsx
    src/routes/_authenticated/pazienti.$id.tsx

Eventuali ulteriori file dovranno essere motivati.

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

✓ Le route coinvolte non accedono più direttamente a Supabase.

✓ Il Service Layer centralizza l'accesso ai dati del perimetro definito.

✓ Il Service Layer implementato copre esclusivamente il perimetro
funzionale previsto dal presente task.

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

# Fine TASK 001 --- Service Layer Foundation
