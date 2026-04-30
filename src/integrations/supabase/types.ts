export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      anamnesi: {
        Row: {
          compilata_da: string | null
          created_at: string
          estetica: Json
          farmacologica: Json
          firma_medico: string | null
          firma_paziente: string | null
          firmata_da_medico: string | null
          firmata_il: string | null
          generale: Json
          hash_integrita: string | null
          id: string
          note_libere: string | null
          patologica: Json
          paziente_id: string
          pdf_url: string | null
          stato: Database["public"]["Enums"]["anamnesi_stato"]
          updated_at: string
          versione_numero: number
        }
        Insert: {
          compilata_da?: string | null
          created_at?: string
          estetica?: Json
          farmacologica?: Json
          firma_medico?: string | null
          firma_paziente?: string | null
          firmata_da_medico?: string | null
          firmata_il?: string | null
          generale?: Json
          hash_integrita?: string | null
          id?: string
          note_libere?: string | null
          patologica?: Json
          paziente_id: string
          pdf_url?: string | null
          stato?: Database["public"]["Enums"]["anamnesi_stato"]
          updated_at?: string
          versione_numero?: number
        }
        Update: {
          compilata_da?: string | null
          created_at?: string
          estetica?: Json
          farmacologica?: Json
          firma_medico?: string | null
          firma_paziente?: string | null
          firmata_da_medico?: string | null
          firmata_il?: string | null
          generale?: Json
          hash_integrita?: string | null
          id?: string
          note_libere?: string | null
          patologica?: Json
          paziente_id?: string
          pdf_url?: string | null
          stato?: Database["public"]["Enums"]["anamnesi_stato"]
          updated_at?: string
          versione_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "anamnesi_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesi_flag_rischio: {
        Row: {
          codice: string
          created_at: string
          etichetta: string
          id: string
          origine: string
          paziente_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
        }
        Insert: {
          codice: string
          created_at?: string
          etichetta: string
          id?: string
          origine?: string
          paziente_id: string
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Update: {
          codice?: string
          created_at?: string
          etichetta?: string
          id?: string
          origine?: string
          paziente_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "anamnesi_flag_rischio_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnesi_versione: {
        Row: {
          anamnesi_id: string
          created_at: string
          created_by: string | null
          id: string
          paziente_id: string
          snapshot: Json
        }
        Insert: {
          anamnesi_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          paziente_id: string
          snapshot: Json
        }
        Update: {
          anamnesi_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          paziente_id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      calendario_preferenze: {
        Row: {
          created_at: string
          followup_auto_attivo: boolean
          followup_giorni_offset: number
          updated_at: string
          user_id: string
          vista_default: string
        }
        Insert: {
          created_at?: string
          followup_auto_attivo?: boolean
          followup_giorni_offset?: number
          updated_at?: string
          user_id: string
          vista_default?: string
        }
        Update: {
          created_at?: string
          followup_auto_attivo?: boolean
          followup_giorni_offset?: number
          updated_at?: string
          user_id?: string
          vista_default?: string
        }
        Relationships: []
      }
      consenso_firmato: {
        Row: {
          categoria_snapshot: Database["public"]["Enums"]["consenso_categoria"]
          created_at: string
          durata_sedute_snapshot: number | null
          durata_tipo_snapshot: string
          firma_immagine: string | null
          firma_medico_immagine: string | null
          firmato_da_medico: string | null
          firmato_il: string
          hash_integrita: string | null
          id: string
          ip_dispositivo: string | null
          modalita_firma: Database["public"]["Enums"]["consenso_modalita_firma"]
          note: string | null
          operatore_testimone: string | null
          paziente_id: string
          pdf_generato_url: string | null
          pdf_url: string | null
          revocato_da: string | null
          revocato_il: string | null
          rifiutato: boolean
          seduta_id: string | null
          sedute_consumate: number
          sedute_max_snapshot: number | null
          template_id: string | null
          testo_snapshot: string
          titolo_snapshot: string
          user_agent: string | null
          validita_mesi_snapshot: number | null
          valido_fino_a: string | null
          versione_snapshot: string
        }
        Insert: {
          categoria_snapshot?: Database["public"]["Enums"]["consenso_categoria"]
          created_at?: string
          durata_sedute_snapshot?: number | null
          durata_tipo_snapshot?: string
          firma_immagine?: string | null
          firma_medico_immagine?: string | null
          firmato_da_medico?: string | null
          firmato_il?: string
          hash_integrita?: string | null
          id?: string
          ip_dispositivo?: string | null
          modalita_firma?: Database["public"]["Enums"]["consenso_modalita_firma"]
          note?: string | null
          operatore_testimone?: string | null
          paziente_id: string
          pdf_generato_url?: string | null
          pdf_url?: string | null
          revocato_da?: string | null
          revocato_il?: string | null
          rifiutato?: boolean
          seduta_id?: string | null
          sedute_consumate?: number
          sedute_max_snapshot?: number | null
          template_id?: string | null
          testo_snapshot: string
          titolo_snapshot: string
          user_agent?: string | null
          validita_mesi_snapshot?: number | null
          valido_fino_a?: string | null
          versione_snapshot: string
        }
        Update: {
          categoria_snapshot?: Database["public"]["Enums"]["consenso_categoria"]
          created_at?: string
          durata_sedute_snapshot?: number | null
          durata_tipo_snapshot?: string
          firma_immagine?: string | null
          firma_medico_immagine?: string | null
          firmato_da_medico?: string | null
          firmato_il?: string
          hash_integrita?: string | null
          id?: string
          ip_dispositivo?: string | null
          modalita_firma?: Database["public"]["Enums"]["consenso_modalita_firma"]
          note?: string | null
          operatore_testimone?: string | null
          paziente_id?: string
          pdf_generato_url?: string | null
          pdf_url?: string | null
          revocato_da?: string | null
          revocato_il?: string | null
          rifiutato?: boolean
          seduta_id?: string | null
          sedute_consumate?: number
          sedute_max_snapshot?: number | null
          template_id?: string | null
          testo_snapshot?: string
          titolo_snapshot?: string
          user_agent?: string | null
          validita_mesi_snapshot?: number | null
          valido_fino_a?: string | null
          versione_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "consenso_firmato_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consenso_firmato_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consenso_template"
            referencedColumns: ["id"]
          },
        ]
      }
      consenso_share_access_log: {
        Row: {
          accessed_at: string
          id: string
          ip: string | null
          share_id: string
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip?: string | null
          share_id: string
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          id?: string
          ip?: string | null
          share_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consenso_share_access_log_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "consenso_share_link"
            referencedColumns: ["id"]
          },
        ]
      }
      consenso_share_link: {
        Row: {
          consenso_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          consenso_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          consenso_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "consenso_share_link_consenso_id_fkey"
            columns: ["consenso_id"]
            isOneToOne: false
            referencedRelation: "consenso_firmato"
            referencedColumns: ["id"]
          },
        ]
      }
      consenso_template: {
        Row: {
          archiviato_il: string | null
          attivo: boolean
          categoria: Database["public"]["Enums"]["consenso_categoria"]
          created_at: string
          created_by: string | null
          descrizione: string | null
          durata_sedute: number | null
          durata_tipo: string
          id: string
          richiede_firma_medico: boolean
          testo: string
          titolo: string
          trattamento_id: string | null
          updated_at: string
          validita_mesi: number | null
          versione: string
        }
        Insert: {
          archiviato_il?: string | null
          attivo?: boolean
          categoria?: Database["public"]["Enums"]["consenso_categoria"]
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          durata_sedute?: number | null
          durata_tipo?: string
          id?: string
          richiede_firma_medico?: boolean
          testo: string
          titolo: string
          trattamento_id?: string | null
          updated_at?: string
          validita_mesi?: number | null
          versione?: string
        }
        Update: {
          archiviato_il?: string | null
          attivo?: boolean
          categoria?: Database["public"]["Enums"]["consenso_categoria"]
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          durata_sedute?: number | null
          durata_tipo?: string
          id?: string
          richiede_firma_medico?: boolean
          testo?: string
          titolo?: string
          trattamento_id?: string | null
          updated_at?: string
          validita_mesi?: number | null
          versione?: string
        }
        Relationships: [
          {
            foreignKeyName: "consenso_template_trattamento_id_fkey"
            columns: ["trattamento_id"]
            isOneToOne: false
            referencedRelation: "trattamenti"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_calendario: {
        Row: {
          colore: string | null
          completato: boolean
          created_at: string
          created_by: string | null
          data_fine: string | null
          data_inizio: string
          descrizione: string | null
          id: string
          nota_diario_id: string | null
          paziente_id: string | null
          seduta_id: string | null
          sincronizza_diario: boolean
          tipo: Database["public"]["Enums"]["calendario_evento_tipo"]
          titolo: string
          tutto_il_giorno: boolean
          updated_at: string
        }
        Insert: {
          colore?: string | null
          completato?: boolean
          created_at?: string
          created_by?: string | null
          data_fine?: string | null
          data_inizio: string
          descrizione?: string | null
          id?: string
          nota_diario_id?: string | null
          paziente_id?: string | null
          seduta_id?: string | null
          sincronizza_diario?: boolean
          tipo?: Database["public"]["Enums"]["calendario_evento_tipo"]
          titolo: string
          tutto_il_giorno?: boolean
          updated_at?: string
        }
        Update: {
          colore?: string | null
          completato?: boolean
          created_at?: string
          created_by?: string | null
          data_fine?: string | null
          data_inizio?: string
          descrizione?: string | null
          id?: string
          nota_diario_id?: string | null
          paziente_id?: string | null
          seduta_id?: string | null
          sincronizza_diario?: boolean
          tipo?: Database["public"]["Enums"]["calendario_evento_tipo"]
          titolo?: string
          tutto_il_giorno?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      firma_sessione: {
        Row: {
          acconsensi: Json | null
          consumed_at: string | null
          consumed_into_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          firma_paziente_base64: string | null
          id: string
          payload: Json
          paziente_id: string
          rifiuto_motivo: string | null
          signed_at: string | null
          stato: Database["public"]["Enums"]["firma_sessione_stato"]
          target_id: string
          tipo: Database["public"]["Enums"]["firma_sessione_tipo"]
          updated_at: string
        }
        Insert: {
          acconsensi?: Json | null
          consumed_at?: string | null
          consumed_into_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          firma_paziente_base64?: string | null
          id?: string
          payload?: Json
          paziente_id: string
          rifiuto_motivo?: string | null
          signed_at?: string | null
          stato?: Database["public"]["Enums"]["firma_sessione_stato"]
          target_id: string
          tipo: Database["public"]["Enums"]["firma_sessione_tipo"]
          updated_at?: string
        }
        Update: {
          acconsensi?: Json | null
          consumed_at?: string | null
          consumed_into_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          firma_paziente_base64?: string | null
          id?: string
          payload?: Json
          paziente_id?: string
          rifiuto_motivo?: string | null
          signed_at?: string | null
          stato?: Database["public"]["Enums"]["firma_sessione_stato"]
          target_id?: string
          tipo?: Database["public"]["Enums"]["firma_sessione_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      followup: {
        Row: {
          complicanza_descrizione: string | null
          complicanza_segnalata: boolean
          created_at: string
          created_by: string | null
          data_followup: string
          esito: string | null
          foto: Json
          id: string
          note: string | null
          paziente_id: string
          seduta_id: string
          updated_at: string
        }
        Insert: {
          complicanza_descrizione?: string | null
          complicanza_segnalata?: boolean
          created_at?: string
          created_by?: string | null
          data_followup?: string
          esito?: string | null
          foto?: Json
          id?: string
          note?: string | null
          paziente_id: string
          seduta_id: string
          updated_at?: string
        }
        Update: {
          complicanza_descrizione?: string | null
          complicanza_segnalata?: boolean
          created_at?: string
          created_by?: string | null
          data_followup?: string
          esito?: string | null
          foto?: Json
          id?: string
          note?: string | null
          paziente_id?: string
          seduta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_seduta_id_fkey"
            columns: ["seduta_id"]
            isOneToOne: false
            referencedRelation: "seduta"
            referencedColumns: ["id"]
          },
        ]
      }
      foto_clinica: {
        Row: {
          created_by: string | null
          data_caricamento: string
          data_scatto: string
          id: string
          livello: string | null
          momento: Database["public"]["Enums"]["foto_momento"]
          note: string | null
          paziente_id: string
          piano_id: string
          seduta_id: string | null
          storage_path: string
          zona: string | null
        }
        Insert: {
          created_by?: string | null
          data_caricamento?: string
          data_scatto?: string
          id?: string
          livello?: string | null
          momento: Database["public"]["Enums"]["foto_momento"]
          note?: string | null
          paziente_id: string
          piano_id: string
          seduta_id?: string | null
          storage_path: string
          zona?: string | null
        }
        Update: {
          created_by?: string | null
          data_caricamento?: string
          data_scatto?: string
          id?: string
          livello?: string | null
          momento?: Database["public"]["Enums"]["foto_momento"]
          note?: string | null
          paziente_id?: string
          piano_id?: string
          seduta_id?: string | null
          storage_path?: string
          zona?: string | null
        }
        Relationships: []
      }
      magazzino_movimento: {
        Row: {
          costo_unitario: number | null
          data_movimento: string
          id: string
          lotto_id: string | null
          modalita_snapshot: string | null
          motivazione: string | null
          note: string | null
          operatore_id: string | null
          paziente_id: string | null
          prodotto_id: string
          quantita: number
          seduta_id: string | null
          tipo: string
        }
        Insert: {
          costo_unitario?: number | null
          data_movimento?: string
          id?: string
          lotto_id?: string | null
          modalita_snapshot?: string | null
          motivazione?: string | null
          note?: string | null
          operatore_id?: string | null
          paziente_id?: string | null
          prodotto_id: string
          quantita: number
          seduta_id?: string | null
          tipo: string
        }
        Update: {
          costo_unitario?: number | null
          data_movimento?: string
          id?: string
          lotto_id?: string | null
          modalita_snapshot?: string | null
          motivazione?: string | null
          note?: string | null
          operatore_id?: string | null
          paziente_id?: string | null
          prodotto_id?: string
          quantita?: number
          seduta_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "magazzino_movimento_lotto_id_fkey"
            columns: ["lotto_id"]
            isOneToOne: false
            referencedRelation: "prodotto_lotto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazzino_movimento_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazzino_movimento_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magazzino_movimento_seduta_id_fkey"
            columns: ["seduta_id"]
            isOneToOne: false
            referencedRelation: "seduta"
            referencedColumns: ["id"]
          },
        ]
      }
      paziente_access_log: {
        Row: {
          azione: string
          created_at: string
          id: string
          paziente_id: string
          user_id: string | null
        }
        Insert: {
          azione: string
          created_at?: string
          id?: string
          paziente_id: string
          user_id?: string | null
        }
        Update: {
          azione?: string
          created_at?: string
          id?: string
          paziente_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paziente_access_log_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
        ]
      }
      paziente_alert: {
        Row: {
          attivo: boolean
          created_at: string
          created_by: string | null
          id: string
          paziente_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          testo: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          paziente_id: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          testo: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          paziente_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          testo?: string
        }
        Relationships: [
          {
            foreignKeyName: "paziente_alert_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
        ]
      }
      paziente_nota: {
        Row: {
          allegati: Json
          auto_generata: boolean
          created_at: string
          created_by: string | null
          data_evento: string
          firmata_da: string | null
          firmata_il: string | null
          id: string
          paziente_id: string
          seduta_id: string | null
          testo: string
          tipo: Database["public"]["Enums"]["nota_tipo"]
          updated_at: string
        }
        Insert: {
          allegati?: Json
          auto_generata?: boolean
          created_at?: string
          created_by?: string | null
          data_evento?: string
          firmata_da?: string | null
          firmata_il?: string | null
          id?: string
          paziente_id: string
          seduta_id?: string | null
          testo: string
          tipo?: Database["public"]["Enums"]["nota_tipo"]
          updated_at?: string
        }
        Update: {
          allegati?: Json
          auto_generata?: boolean
          created_at?: string
          created_by?: string | null
          data_evento?: string
          firmata_da?: string | null
          firmata_il?: string | null
          id?: string
          paziente_id?: string
          seduta_id?: string | null
          testo?: string
          tipo?: Database["public"]["Enums"]["nota_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paziente_nota_seduta_id_fkey"
            columns: ["seduta_id"]
            isOneToOne: false
            referencedRelation: "seduta"
            referencedColumns: ["id"]
          },
        ]
      }
      paziente_nota_modifica: {
        Row: {
          campo: string
          id: string
          modificata_da: string
          modificata_il: string
          motivo: string | null
          nota_id: string
          oltre_48h: boolean
          valore_nuovo: Json | null
          valore_precedente: Json | null
        }
        Insert: {
          campo: string
          id?: string
          modificata_da: string
          modificata_il?: string
          motivo?: string | null
          nota_id: string
          oltre_48h?: boolean
          valore_nuovo?: Json | null
          valore_precedente?: Json | null
        }
        Update: {
          campo?: string
          id?: string
          modificata_da?: string
          modificata_il?: string
          motivo?: string | null
          nota_id?: string
          oltre_48h?: boolean
          valore_nuovo?: Json | null
          valore_precedente?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "paziente_nota_modifica_nota_id_fkey"
            columns: ["nota_id"]
            isOneToOne: false
            referencedRelation: "paziente_nota"
            referencedColumns: ["id"]
          },
        ]
      }
      pazienti: {
        Row: {
          altezza_cm: number | null
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          created_by: string | null
          data_nascita: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          identita_genere: string | null
          indirizzo: string | null
          luogo_nascita: string | null
          nome: string
          note: string | null
          peso_kg: number | null
          professione: string | null
          provincia: string | null
          sesso: Database["public"]["Enums"]["sesso"] | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          altezza_cm?: number | null
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          created_by?: string | null
          data_nascita?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          identita_genere?: string | null
          indirizzo?: string | null
          luogo_nascita?: string | null
          nome: string
          note?: string | null
          peso_kg?: number | null
          professione?: string | null
          provincia?: string | null
          sesso?: Database["public"]["Enums"]["sesso"] | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          altezza_cm?: number | null
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          created_by?: string | null
          data_nascita?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          identita_genere?: string | null
          indirizzo?: string | null
          luogo_nascita?: string | null
          nome?: string
          note?: string | null
          peso_kg?: number | null
          professione?: string | null
          provincia?: string | null
          sesso?: Database["public"]["Enums"]["sesso"] | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      piano_foto_stato: {
        Row: {
          cambiato_da: string | null
          cambiato_il: string
          incoerenza_data: boolean
          motivazione: string | null
          piano_id: string
          stato: Database["public"]["Enums"]["piano_foto_stato_enum"]
        }
        Insert: {
          cambiato_da?: string | null
          cambiato_il?: string
          incoerenza_data?: boolean
          motivazione?: string | null
          piano_id: string
          stato?: Database["public"]["Enums"]["piano_foto_stato_enum"]
        }
        Update: {
          cambiato_da?: string | null
          cambiato_il?: string
          incoerenza_data?: boolean
          motivazione?: string | null
          piano_id?: string
          stato?: Database["public"]["Enums"]["piano_foto_stato_enum"]
        }
        Relationships: []
      }
      piano_foto_stato_log: {
        Row: {
          cambiato_da: string | null
          cambiato_il: string
          id: string
          motivazione: string | null
          piano_id: string
          stato_nuovo: Database["public"]["Enums"]["piano_foto_stato_enum"]
          stato_precedente:
            | Database["public"]["Enums"]["piano_foto_stato_enum"]
            | null
        }
        Insert: {
          cambiato_da?: string | null
          cambiato_il?: string
          id?: string
          motivazione?: string | null
          piano_id: string
          stato_nuovo: Database["public"]["Enums"]["piano_foto_stato_enum"]
          stato_precedente?:
            | Database["public"]["Enums"]["piano_foto_stato_enum"]
            | null
        }
        Update: {
          cambiato_da?: string | null
          cambiato_il?: string
          id?: string
          motivazione?: string | null
          piano_id?: string
          stato_nuovo?: Database["public"]["Enums"]["piano_foto_stato_enum"]
          stato_precedente?:
            | Database["public"]["Enums"]["piano_foto_stato_enum"]
            | null
        }
        Relationships: []
      }
      piano_trattamento: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          numero_sedute_previste: number
          paziente_id: string
          prezzo_finale: number | null
          prezzo_totale: number | null
          sconto: number
          sconto_tipo: string
          sconto_valore: number
          stato: Database["public"]["Enums"]["piano_stato"]
          titolo: string
          trattamento_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          numero_sedute_previste?: number
          paziente_id: string
          prezzo_finale?: number | null
          prezzo_totale?: number | null
          sconto?: number
          sconto_tipo?: string
          sconto_valore?: number
          stato?: Database["public"]["Enums"]["piano_stato"]
          titolo: string
          trattamento_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          numero_sedute_previste?: number
          paziente_id?: string
          prezzo_finale?: number | null
          prezzo_totale?: number | null
          sconto?: number
          sconto_tipo?: string
          sconto_valore?: number
          stato?: Database["public"]["Enums"]["piano_stato"]
          titolo?: string
          trattamento_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piano_trattamento_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piano_trattamento_trattamento_id_fkey"
            columns: ["trattamento_id"]
            isOneToOne: false
            referencedRelation: "trattamenti"
            referencedColumns: ["id"]
          },
        ]
      }
      piano_trattamento_voce: {
        Row: {
          created_at: string
          id: string
          numero_sedute: number
          ordine: number
          pacchetto_id: string | null
          piano_id: string
          prezzo_riga: number
          prezzo_unitario: number
          prodotti_per_seduta: Json | null
          prodotti_previsti: Json
          trattamento_id: string
          zone: Json
        }
        Insert: {
          created_at?: string
          id?: string
          numero_sedute?: number
          ordine?: number
          pacchetto_id?: string | null
          piano_id: string
          prezzo_riga?: number
          prezzo_unitario?: number
          prodotti_per_seduta?: Json | null
          prodotti_previsti?: Json
          trattamento_id: string
          zone?: Json
        }
        Update: {
          created_at?: string
          id?: string
          numero_sedute?: number
          ordine?: number
          pacchetto_id?: string | null
          piano_id?: string
          prezzo_riga?: number
          prezzo_unitario?: number
          prodotti_per_seduta?: Json | null
          prodotti_previsti?: Json
          trattamento_id?: string
          zone?: Json
        }
        Relationships: []
      }
      prodotto: {
        Row: {
          archiviato_il: string | null
          attivo: boolean
          costo_unitario_default: number | null
          created_at: string
          created_by: string | null
          fornitore_id: string | null
          id: string
          marca_id: string | null
          modalita_tracking: string
          nome: string
          note: string | null
          soglia_minima: number
          tipologia: string | null
          unita_misura: string
          updated_at: string
        }
        Insert: {
          archiviato_il?: string | null
          attivo?: boolean
          costo_unitario_default?: number | null
          created_at?: string
          created_by?: string | null
          fornitore_id?: string | null
          id?: string
          marca_id?: string | null
          modalita_tracking?: string
          nome: string
          note?: string | null
          soglia_minima?: number
          tipologia?: string | null
          unita_misura?: string
          updated_at?: string
        }
        Update: {
          archiviato_il?: string | null
          attivo?: boolean
          costo_unitario_default?: number | null
          created_at?: string
          created_by?: string | null
          fornitore_id?: string | null
          id?: string
          marca_id?: string | null
          modalita_tracking?: string
          nome?: string
          note?: string | null
          soglia_minima?: number
          tipologia?: string | null
          unita_misura?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prodotto_fornitore_id_fkey"
            columns: ["fornitore_id"]
            isOneToOne: false
            referencedRelation: "prodotto_fornitore"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prodotto_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "prodotto_marca"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotto_fornitore: {
        Row: {
          attivo: boolean
          contatti: Json
          created_at: string
          created_by: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          contatti?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          contatti?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      prodotto_lotto: {
        Row: {
          costo_unitario: number | null
          created_at: string
          created_by: string | null
          data_scadenza: string | null
          id: string
          note: string | null
          numero_lotto: string
          prodotto_id: string
          quantita_disponibile: number
          quantita_iniziale: number
        }
        Insert: {
          costo_unitario?: number | null
          created_at?: string
          created_by?: string | null
          data_scadenza?: string | null
          id?: string
          note?: string | null
          numero_lotto: string
          prodotto_id: string
          quantita_disponibile?: number
          quantita_iniziale?: number
        }
        Update: {
          costo_unitario?: number | null
          created_at?: string
          created_by?: string | null
          data_scadenza?: string | null
          id?: string
          note?: string | null
          numero_lotto?: string
          prodotto_id?: string
          quantita_disponibile?: number
          quantita_iniziale?: number
        }
        Relationships: [
          {
            foreignKeyName: "prodotto_lotto_prodotto_id_fkey"
            columns: ["prodotto_id"]
            isOneToOne: false
            referencedRelation: "prodotto"
            referencedColumns: ["id"]
          },
        ]
      }
      prodotto_marca: {
        Row: {
          attiva: boolean
          created_at: string
          created_by: string | null
          id: string
          nome: string
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
        }
        Update: {
          attiva?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          attivo: boolean
          cognome: string
          created_at: string
          id: string
          nome: string
          numero_albo: string | null
          qualifica: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attivo?: boolean
          cognome?: string
          created_at?: string
          id?: string
          nome?: string
          numero_albo?: string | null
          qualifica?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attivo?: boolean
          cognome?: string
          created_at?: string
          id?: string
          nome?: string
          numero_albo?: string | null
          qualifica?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seduta: {
        Row: {
          completata: boolean
          created_at: string
          data_esecuzione_effettiva: string | null
          data_registrazione: string
          data_seduta: string | null
          durata_minuti: number | null
          firmata_da: string | null
          firmata_il: string | null
          id: string
          magazzino_scaricato: boolean
          nota_diario_id: string | null
          note_cliniche: string | null
          numero_seduta: number
          operatore_id: string | null
          parametri_tecnici: Json
          paziente_id: string
          piano_id: string | null
          prodotti_previsti: Json
          trattamento_id: string | null
          updated_at: string
          voce_id: string | null
        }
        Insert: {
          completata?: boolean
          created_at?: string
          data_esecuzione_effettiva?: string | null
          data_registrazione?: string
          data_seduta?: string | null
          durata_minuti?: number | null
          firmata_da?: string | null
          firmata_il?: string | null
          id?: string
          magazzino_scaricato?: boolean
          nota_diario_id?: string | null
          note_cliniche?: string | null
          numero_seduta?: number
          operatore_id?: string | null
          parametri_tecnici?: Json
          paziente_id: string
          piano_id?: string | null
          prodotti_previsti?: Json
          trattamento_id?: string | null
          updated_at?: string
          voce_id?: string | null
        }
        Update: {
          completata?: boolean
          created_at?: string
          data_esecuzione_effettiva?: string | null
          data_registrazione?: string
          data_seduta?: string | null
          durata_minuti?: number | null
          firmata_da?: string | null
          firmata_il?: string | null
          id?: string
          magazzino_scaricato?: boolean
          nota_diario_id?: string | null
          note_cliniche?: string | null
          numero_seduta?: number
          operatore_id?: string | null
          parametri_tecnici?: Json
          paziente_id?: string
          piano_id?: string | null
          prodotti_previsti?: Json
          trattamento_id?: string | null
          updated_at?: string
          voce_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seduta_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: false
            referencedRelation: "pazienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seduta_piano_id_fkey"
            columns: ["piano_id"]
            isOneToOne: false
            referencedRelation: "piano_trattamento"
            referencedColumns: ["id"]
          },
        ]
      }
      seduta_modifica: {
        Row: {
          campo: string
          id: string
          modificata_da: string
          modificata_il: string
          motivo: string | null
          oltre_48h: boolean
          seduta_id: string
          valore_nuovo: Json | null
          valore_precedente: Json | null
        }
        Insert: {
          campo: string
          id?: string
          modificata_da: string
          modificata_il?: string
          motivo?: string | null
          oltre_48h?: boolean
          seduta_id: string
          valore_nuovo?: Json | null
          valore_precedente?: Json | null
        }
        Update: {
          campo?: string
          id?: string
          modificata_da?: string
          modificata_il?: string
          motivo?: string | null
          oltre_48h?: boolean
          seduta_id?: string
          valore_nuovo?: Json | null
          valore_precedente?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "seduta_modifica_seduta_id_fkey"
            columns: ["seduta_id"]
            isOneToOne: false
            referencedRelation: "seduta"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_info: {
        Row: {
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          direttore_sanitario: string | null
          email: string | null
          id: string
          indirizzo: string | null
          logo_url: string | null
          partita_iva: string | null
          pec: string | null
          provincia: string | null
          ragione_sociale: string | null
          sito_web: string | null
          telefono: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          direttore_sanitario?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          logo_url?: string | null
          partita_iva?: string | null
          pec?: string | null
          provincia?: string | null
          ragione_sociale?: string | null
          sito_web?: string | null
          telefono?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          direttore_sanitario?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          logo_url?: string | null
          partita_iva?: string | null
          pec?: string | null
          provincia?: string | null
          ragione_sociale?: string | null
          sito_web?: string | null
          telefono?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trattamenti: {
        Row: {
          archiviato_il: string | null
          attivo: boolean
          categoria: string | null
          consenso_template_id: string | null
          created_at: string
          created_by: string | null
          descrizione: string | null
          durata_ciclo_unita: string | null
          durata_ciclo_valore: number | null
          durata_minuti: number | null
          id: string
          nome: string
          prezzo_indicativo: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          archiviato_il?: string | null
          attivo?: boolean
          categoria?: string | null
          consenso_template_id?: string | null
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          durata_ciclo_unita?: string | null
          durata_ciclo_valore?: number | null
          durata_minuti?: number | null
          id?: string
          nome: string
          prezzo_indicativo?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          archiviato_il?: string | null
          attivo?: boolean
          categoria?: string | null
          consenso_template_id?: string | null
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          durata_ciclo_unita?: string | null
          durata_ciclo_valore?: number | null
          durata_minuti?: number | null
          id?: string
          nome?: string
          prezzo_indicativo?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trattamenti_consenso_template_id_fkey"
            columns: ["consenso_template_id"]
            isOneToOne: false
            referencedRelation: "consenso_template"
            referencedColumns: ["id"]
          },
        ]
      }
      trattamento_pacchetto: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          nome: string
          numero_sedute: number
          prezzo_pacchetto: number
          trattamento_id: string
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome: string
          numero_sedute: number
          prezzo_pacchetto: number
          trattamento_id: string
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          nome?: string
          numero_sedute?: number
          prezzo_pacchetto?: number
          trattamento_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      firma_sessione_marca_scadute: { Args: never; Returns: number }
      has_consenso_valido: {
        Args: { _paziente_id: string; _template_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_operator: { Args: { _user_id: string }; Returns: boolean }
      is_valid_cf: { Args: { _cf: string }; Returns: boolean }
      magazzino_consuma_seduta: {
        Args: { _righe: Json; _seduta_id: string }
        Returns: Json
      }
      magazzino_ripristina_seduta: {
        Args: { _seduta_id: string }
        Returns: Json
      }
      paziente_consensi_stato: {
        Args: { _paziente_id: string }
        Returns: {
          categoria: Database["public"]["Enums"]["consenso_categoria"]
          consenso_id: string
          firmato_il: string
          rifiutato: boolean
          stato: string
          template_id: string
          titolo: string
          valido_fino_a: string
          versione: string
        }[]
      }
      piano_foto_marca_non_eseguibile: {
        Args: { _motivazione: string; _piano_id: string }
        Returns: Json
      }
      piano_foto_riapri: { Args: { _piano_id: string }; Returns: Json }
    }
    Enums: {
      alert_severity: "info" | "attenzione" | "critico"
      anamnesi_stato: "draft" | "signed" | "superseded"
      app_role: "medico" | "collaboratore"
      calendario_evento_tipo: "promemoria" | "follow_up" | "attivita" | "altro"
      consenso_categoria:
        | "gdpr"
        | "trattamento_singolo"
        | "trattamento_ciclo"
        | "altro"
        | "uso_immagini"
        | "anamnesi"
      consenso_modalita_firma: "tablet" | "pdf_caricato"
      firma_sessione_stato:
        | "waiting"
        | "pending"
        | "signed"
        | "refused"
        | "expired"
        | "cancelled"
      firma_sessione_tipo: "consenso" | "anamnesi"
      foto_momento: "prima" | "dopo"
      nota_tipo: "clinica" | "telefonata" | "promemoria" | "altro"
      piano_foto_stato_enum: "completo" | "baseline_mancante" | "non_eseguibile"
      piano_stato:
        | "attivo"
        | "completato"
        | "sospeso"
        | "annullato"
        | "bozza"
        | "confermato"
      sesso: "M" | "F" | "altro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["info", "attenzione", "critico"],
      anamnesi_stato: ["draft", "signed", "superseded"],
      app_role: ["medico", "collaboratore"],
      calendario_evento_tipo: ["promemoria", "follow_up", "attivita", "altro"],
      consenso_categoria: [
        "gdpr",
        "trattamento_singolo",
        "trattamento_ciclo",
        "altro",
        "uso_immagini",
        "anamnesi",
      ],
      consenso_modalita_firma: ["tablet", "pdf_caricato"],
      firma_sessione_stato: [
        "waiting",
        "pending",
        "signed",
        "refused",
        "expired",
        "cancelled",
      ],
      firma_sessione_tipo: ["consenso", "anamnesi"],
      foto_momento: ["prima", "dopo"],
      nota_tipo: ["clinica", "telefonata", "promemoria", "altro"],
      piano_foto_stato_enum: [
        "completo",
        "baseline_mancante",
        "non_eseguibile",
      ],
      piano_stato: [
        "attivo",
        "completato",
        "sospeso",
        "annullato",
        "bozza",
        "confermato",
      ],
      sesso: ["M", "F", "altro"],
    },
  },
} as const
