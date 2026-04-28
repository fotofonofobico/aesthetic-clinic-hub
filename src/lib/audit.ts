import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    user_id: entry.user_id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) {
    // non blocca il flusso, ma logga in console per debug
    console.error("audit write failed:", error.message);
  }
}

export interface AuditDiffEntry {
  campo: string;
  prima: unknown;
  dopo: unknown;
}

export interface AuditChangeRow {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, { prima: unknown; dopo: unknown }>;
}
