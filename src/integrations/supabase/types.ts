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
          generale: Json
          id: string
          note_libere: string | null
          patologica: Json
          paziente_id: string
          updated_at: string
        }
        Insert: {
          compilata_da?: string | null
          created_at?: string
          estetica?: Json
          farmacologica?: Json
          generale?: Json
          id?: string
          note_libere?: string | null
          patologica?: Json
          paziente_id: string
          updated_at?: string
        }
        Update: {
          compilata_da?: string | null
          created_at?: string
          estetica?: Json
          farmacologica?: Json
          generale?: Json
          id?: string
          note_libere?: string | null
          patologica?: Json
          paziente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesi_paziente_id_fkey"
            columns: ["paziente_id"]
            isOneToOne: true
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
      consenso_firmato: {
        Row: {
          created_at: string
          firma_immagine: string
          firmato_il: string
          hash_integrita: string | null
          id: string
          ip_dispositivo: string | null
          note: string | null
          operatore_testimone: string | null
          paziente_id: string
          template_id: string | null
          testo_snapshot: string
          titolo_snapshot: string
          user_agent: string | null
          versione_snapshot: string
        }
        Insert: {
          created_at?: string
          firma_immagine: string
          firmato_il?: string
          hash_integrita?: string | null
          id?: string
          ip_dispositivo?: string | null
          note?: string | null
          operatore_testimone?: string | null
          paziente_id: string
          template_id?: string | null
          testo_snapshot: string
          titolo_snapshot: string
          user_agent?: string | null
          versione_snapshot: string
        }
        Update: {
          created_at?: string
          firma_immagine?: string
          firmato_il?: string
          hash_integrita?: string | null
          id?: string
          ip_dispositivo?: string | null
          note?: string | null
          operatore_testimone?: string | null
          paziente_id?: string
          template_id?: string | null
          testo_snapshot?: string
          titolo_snapshot?: string
          user_agent?: string | null
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
      consenso_template: {
        Row: {
          attivo: boolean
          created_at: string
          created_by: string | null
          id: string
          testo: string
          titolo: string
          trattamento_id: string | null
          updated_at: string
          versione: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          testo: string
          titolo: string
          trattamento_id?: string | null
          updated_at?: string
          versione?: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          testo?: string
          titolo?: string
          trattamento_id?: string | null
          updated_at?: string
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
          created_at: string
          created_by: string | null
          data_evento: string
          id: string
          paziente_id: string
          testo: string
          tipo: Database["public"]["Enums"]["nota_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_evento?: string
          id?: string
          paziente_id: string
          testo: string
          tipo?: Database["public"]["Enums"]["nota_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_evento?: string
          id?: string
          paziente_id?: string
          testo?: string
          tipo?: Database["public"]["Enums"]["nota_tipo"]
          updated_at?: string
        }
        Relationships: []
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
      piano_trattamento: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          numero_sedute_previste: number
          paziente_id: string
          prezzo_totale: number | null
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
          prezzo_totale?: number | null
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
          prezzo_totale?: number | null
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
          data_seduta: string
          durata_minuti: number | null
          id: string
          note_cliniche: string | null
          numero_seduta: number
          operatore_id: string | null
          parametri_tecnici: Json
          paziente_id: string
          piano_id: string
          updated_at: string
        }
        Insert: {
          completata?: boolean
          created_at?: string
          data_seduta?: string
          durata_minuti?: number | null
          id?: string
          note_cliniche?: string | null
          numero_seduta?: number
          operatore_id?: string | null
          parametri_tecnici?: Json
          paziente_id: string
          piano_id: string
          updated_at?: string
        }
        Update: {
          completata?: boolean
          created_at?: string
          data_seduta?: string
          durata_minuti?: number | null
          id?: string
          note_cliniche?: string | null
          numero_seduta?: number
          operatore_id?: string | null
          parametri_tecnici?: Json
          paziente_id?: string
          piano_id?: string
          updated_at?: string
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
      trattamenti: {
        Row: {
          attivo: boolean
          categoria: string | null
          created_at: string
          created_by: string | null
          descrizione: string | null
          durata_minuti: number | null
          id: string
          nome: string
          prezzo_indicativo: number | null
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          durata_minuti?: number | null
          id?: string
          nome: string
          prezzo_indicativo?: number | null
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          durata_minuti?: number | null
          id?: string
          nome?: string
          prezzo_indicativo?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_operator: { Args: { _user_id: string }; Returns: boolean }
      is_valid_cf: { Args: { _cf: string }; Returns: boolean }
    }
    Enums: {
      alert_severity: "info" | "attenzione" | "critico"
      app_role: "medico" | "collaboratore"
      nota_tipo: "clinica" | "telefonata" | "promemoria" | "altro"
      piano_stato: "attivo" | "completato" | "sospeso" | "annullato"
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
      app_role: ["medico", "collaboratore"],
      nota_tipo: ["clinica", "telefonata", "promemoria", "altro"],
      piano_stato: ["attivo", "completato", "sospeso", "annullato"],
      sesso: ["M", "F", "altro"],
    },
  },
} as const
