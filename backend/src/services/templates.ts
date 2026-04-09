import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES_DIR = path.resolve(__dirname, "../../storage/templates");
export const DOCUMENTS_DIR = path.resolve(__dirname, "../../storage/documents");

export type Template = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
};

export type GeneratedDocument = {
  id: string;
  leadId: number;
  templateId: string;
  templateName: string;
  filename: string;
  createdAt: string;
};

const META_FILE = path.join(TEMPLATES_DIR, "_meta.json");
const DOCS_META_FILE = path.join(DOCUMENTS_DIR, "_meta.json");

function ensureDirs() {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

function readMeta<T>(file: string): T[] {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeMeta<T>(file: string, data: T[]) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

export function saveTemplate(originalName: string, buffer: Buffer): Template {
  ensureDirs();
  const id = uuidv4();
  const ext = path.extname(originalName);
  const filename = `${id}${ext}`;
  fs.writeFileSync(path.join(TEMPLATES_DIR, filename), buffer);

  const meta = readMeta<Template>(META_FILE);
  const template: Template = {
    id,
    name: originalName.replace(ext, ""),
    filename,
    createdAt: new Date().toISOString()
  };
  meta.push(template);
  writeMeta(META_FILE, meta);
  return template;
}

export function listTemplates(): Template[] {
  ensureDirs();
  return readMeta<Template>(META_FILE);
}

export function getTemplate(id: string): Template | undefined {
  return listTemplates().find((t) => t.id === id);
}

export function deleteTemplate(id: string): boolean {
  ensureDirs();
  const meta = readMeta<Template>(META_FILE);
  const template = meta.find((t) => t.id === id);
  if (!template) return false;

  const filePath = path.join(TEMPLATES_DIR, template.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  writeMeta(
    META_FILE,
    meta.filter((t) => t.id !== id)
  );
  return true;
}

export function getTemplateBuffer(template: Template): Buffer {
  return fs.readFileSync(path.join(TEMPLATES_DIR, template.filename));
}

export function saveGeneratedDocument(
  leadId: number,
  templateId: string,
  templateName: string,
  buffer: Buffer,
  ext: string
): GeneratedDocument {
  ensureDirs();
  const id = uuidv4();
  const filename = `${id}${ext}`;
  fs.writeFileSync(path.join(DOCUMENTS_DIR, filename), buffer);

  const meta = readMeta<GeneratedDocument>(DOCS_META_FILE);
  const doc: GeneratedDocument = {
    id,
    leadId,
    templateId,
    templateName,
    filename,
    createdAt: new Date().toISOString()
  };
  meta.push(doc);
  writeMeta(DOCS_META_FILE, meta);
  return doc;
}

export function listDocumentsByLead(leadId: number): GeneratedDocument[] {
  ensureDirs();
  return readMeta<GeneratedDocument>(DOCS_META_FILE).filter((d) => d.leadId === leadId);
}

export function getDocument(id: string): GeneratedDocument | undefined {
  ensureDirs();
  return readMeta<GeneratedDocument>(DOCS_META_FILE).find((d) => d.id === id);
}

export function getDocumentBuffer(doc: GeneratedDocument): Buffer {
  return fs.readFileSync(path.join(DOCUMENTS_DIR, doc.filename));
}
