# Gestionale Medicina Estetica

# Technical Baseline v1.0

## Stato documento

Versione: 1.0\
Stato progetto: READY FOR CLAUDE IMPLEMENTATION

Questo documento rappresenta la fotografia tecnica del progetto al
termine della fase di audit.

La fase di analisi è conclusa.

Non deve essere utilizzato per proporre una riscrittura del progetto, ma
come riferimento per implementazioni incrementali controllate.

------------------------------------------------------------------------

# 1. Workflow di progetto

Il workflow definitivo è:

Repository reale ↓ ChatGPT: audit, analisi, specifiche, controllo
qualità ↓ Claude: implementazione codice secondo specifiche approvate ↓
VS Code: integrazione, test e commit

------------------------------------------------------------------------

# 2. Ruoli

## ChatGPT

Responsabilità:

-   audit tecnico
-   analisi architetturale
-   verifica consistenza
-   documentazione
-   produzione specifiche implementative
-   controllo qualità

Non implementa direttamente il codice.

## Claude

Responsabilità:

-   modifica codice
-   implementazione task approvati

Non deve:

-   rifare audit
-   cambiare architettura autonomamente
-   introdurre tecnologie non approvate
-   riscrivere il progetto

## VS Code

Responsabilità:

-   integrazione codice
-   esecuzione test
-   verifica funzionamento
-   gestione commit

------------------------------------------------------------------------

# 3. Stack tecnologico verificato

## Frontend

-   React
-   TypeScript
-   TanStack Router
-   Tailwind CSS
-   Radix UI
-   React Hook Form
-   Zod

## Backend

-   Supabase
-   PostgreSQL
-   Supabase Auth
-   Supabase Storage

------------------------------------------------------------------------

# 4. Architettura attuale

Struttura generale:

React Application

↓

Routes

↓

Pages

↓

Components

↓

Hooks / Lib

↓

Supabase Client

↓

Database

------------------------------------------------------------------------

# 5. Stato audit

Completato:

-   Repository Audit
-   Database / Domain Audit
-   Backend Audit
-   Frontend Audit

Prodotti:

-   Technical Baseline v1.0
-   Claude Implementation Brief v1.0

------------------------------------------------------------------------

# 6. Debito tecnico consolidato

## Backend

### B-001

Mancanza service layer uniforme.

Priorità: Media

### B-002

Business logic distribuita.

Priorità: Media

### B-003

Possibili query duplicate.

Priorità: Medio-bassa

### B-004

Firma digitale con logica applicativa frontend.

Priorità: Media

### B-005

RBAC/RLS da verificare.

Priorità: Alta

### B-006

Audit non centralizzato.

Priorità: Media

------------------------------------------------------------------------

## Frontend

### F-001

Feature separation incompleta.

### F-003

Auth context con responsabilità multiple.

### F-004

Mancanza gestione server state strutturata.

### F-005

Possibili query duplicate.

### F-006

Schema validation distribuita.

### F-007

Error handling non uniforme.

### F-008

Form accoppiati al layer dati.

### F-009

Feature boundaries non complete.

### F-010

Pattern UI duplicabili.

### F-011

Stati UI trasversali non centralizzati.

------------------------------------------------------------------------

# 7. Vincoli architetturali

Non modificare senza nuova approvazione:

-   schema database
-   struttura dati paziente
-   workflow clinici
-   consensi
-   firma digitale
-   Supabase come backend
-   TanStack Router
-   React Hook Form
-   Zod

Non introdurre:

-   nuovo backend
-   framework sostitutivi
-   Redux o state manager equivalenti senza necessità dimostrata

------------------------------------------------------------------------

# 8. Principio implementativo

Obiettivo:

incremental refactoring.

Non sono ammessi:

-   rewrite completo
-   migrazione massiva
-   cambi architetturali radicali

Ogni modifica deve:

1.  avere uno scopo preciso
2.  indicare file coinvolti
3.  mantenere compatibilità con il sistema esistente
4.  essere verificabile

------------------------------------------------------------------------

# 9. Roadmap implementativa congelata

## TASK 001 --- Service Layer Foundation

Obiettivo:

ridurre accesso diretto Supabase dai componenti.

Pattern target:

Component

↓

Domain Hook

↓

Service Layer

↓

Supabase

Area pilota:

Pazienti

------------------------------------------------------------------------

## TASK 002 --- Error Handling

Uniformare:

-   errori query
-   mutation
-   feedback utente
-   logging

------------------------------------------------------------------------

## TASK 003 --- Sicurezza RLS / Permission

Verifica:

-   policy Supabase
-   ruoli
-   accesso dati sanitari
-   isolamento dati studio

------------------------------------------------------------------------

## TASK 004 --- Separazione Form / Domain

Separare:

UI

↓

Validation Schema

↓

Business Logic

↓

Persistence

------------------------------------------------------------------------

## TASK 005 --- Feature Organization

Evoluzione verso:

features/

-   pazienti
-   calendario
-   trattamenti
-   magazzino
-   consensi

------------------------------------------------------------------------

# 10. Regola anti-loop

L'audit è chiuso.

Non ripetere:

-   inventario repository
-   analisi database generale
-   analisi frontend generale
-   analisi backend generale

salvo nuove evidenze.

Prima di aprire un nuovo approfondimento:

chiedersi:

"Serve per completare il prossimo task implementativo?"

Se la risposta è no, non procedere.

------------------------------------------------------------------------

# Fine Technical Baseline v1.0
