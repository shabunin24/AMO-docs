import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  DOCUMENTS_BUCKET,
  TEMPLATES_BUCKET,
  dbDeleteTemplate,
  dbGetDocument,
  dbGetTemplate,
  dbInsertDocument,
  dbInsertTemplate,
  dbListDocumentsByLead,
  dbListTemplates,
  deleteFile,
  downloadFile,
  uploadFile
} from "./supabase.js";

export type Template = {
  id: string;
  name: string;
  filename: string;
  created_at: string;
};

export type GeneratedDocument = {
  id: string;
  lead_id: number;
  template_id: string;
  template_name: string;
  filename: string;
  created_at: string;
};

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  };
  return map[ext] ?? "application/octet-stream";
}

export async function saveTemplate(originalName: string, buffer: Buffer): Promise<Template> {
  const id = uuidv4();
  const ext = path.extname(originalName);
  const filename = `${id}${ext}`;

  await uploadFile(TEMPLATES_BUCKET, filename, buffer, mimeForExt(ext));

  const row = {
    id,
    name: originalName.replace(ext, ""),
    filename,
    created_at: new Date().toISOString()
  };
  await dbInsertTemplate(row);
  return row;
}

export async function listTemplates(): Promise<Template[]> {
  return dbListTemplates();
}

export async function getTemplate(id: string): Promise<Template | null> {
  return dbGetTemplate(id);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const template = await dbGetTemplate(id);
  if (!template) return false;
  await deleteFile(TEMPLATES_BUCKET, template.filename);
  await dbDeleteTemplate(id);
  return true;
}

export async function getTemplateBuffer(template: Template): Promise<Buffer> {
  return downloadFile(TEMPLATES_BUCKET, template.filename);
}

export async function saveGeneratedDocument(
  leadId: number,
  templateId: string,
  templateName: string,
  buffer: Buffer,
  ext: string
): Promise<GeneratedDocument> {
  const id = uuidv4();
  const filename = `${id}${ext}`;

  await uploadFile(DOCUMENTS_BUCKET, filename, buffer, mimeForExt(ext));

  const row = {
    id,
    lead_id: leadId,
    template_id: templateId,
    template_name: templateName,
    filename,
    created_at: new Date().toISOString()
  };
  await dbInsertDocument(row);
  return row;
}

export async function listDocumentsByLead(leadId: number): Promise<GeneratedDocument[]> {
  return dbListDocumentsByLead(leadId);
}

export async function getDocument(id: string): Promise<GeneratedDocument | null> {
  return dbGetDocument(id);
}

export async function getDocumentBuffer(doc: GeneratedDocument): Promise<Buffer> {
  return downloadFile(DOCUMENTS_BUCKET, doc.filename);
}
