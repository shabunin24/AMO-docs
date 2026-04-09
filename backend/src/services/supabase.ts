import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export const TEMPLATES_BUCKET = "templates";
export const DOCUMENTS_BUCKET = "documents";

export function getSupabase() {
  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase env vars are not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
}

export async function uploadFile(bucket: string, path: string, buffer: Buffer, contentType: string) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true
  });
  if (error) throw new Error(`Supabase upload error: ${error.message}`);
}

export async function downloadFile(bucket: string, path: string): Promise<Buffer> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Supabase download error: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFile(bucket: string, path: string) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Supabase delete error: ${error.message}`);
}

// Метаданные шаблонов
export async function dbInsertTemplate(row: {
  id: string;
  name: string;
  filename: string;
  created_at: string;
}) {
  const supabase = getSupabase();
  const { error } = await supabase.from("templates").insert(row);
  if (error) throw new Error(`DB insert template: ${error.message}`);
}

export async function dbListTemplates() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("templates").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`DB list templates: ${error.message}`);
  return data ?? [];
}

export async function dbGetTemplate(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("templates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`DB get template: ${error.message}`);
  return data;
}

export async function dbDeleteTemplate(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw new Error(`DB delete template: ${error.message}`);
}

// Метаданные сгенерированных документов
export async function dbInsertDocument(row: {
  id: string;
  lead_id: number;
  template_id: string;
  template_name: string;
  filename: string;
  created_at: string;
}) {
  const supabase = getSupabase();
  const { error } = await supabase.from("documents").insert(row);
  if (error) throw new Error(`DB insert document: ${error.message}`);
}

export async function dbListDocumentsByLead(leadId: number) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`DB list documents: ${error.message}`);
  return data ?? [];
}

export async function dbGetDocument(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`DB get document: ${error.message}`);
  return data;
}
