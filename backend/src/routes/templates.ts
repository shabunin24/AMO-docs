import Docxtemplater from "docxtemplater";
import { Router } from "express";
import multer from "multer";
import PizZip from "pizzip";
import { z } from "zod";
import {
  deleteTemplate,
  getDocument,
  getDocumentBuffer,
  getTemplate,
  getTemplateBuffer,
  listDocumentsByLead,
  listTemplates,
  saveGeneratedDocument,
  saveTemplate
} from "../services/templates.js";
import { buildVariables } from "../services/variables.js";

export const templatesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(docx|pptx|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только файлы .docx, .pptx, .xlsx"));
    }
  }
});

// Список шаблонов
templatesRouter.get("/", (_req, res) => {
  res.json({ items: listTemplates() });
});

// Загрузить шаблон
templatesRouter.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Файл не передан" });
  }
  const template = saveTemplate(req.file.originalname, req.file.buffer);
  return res.status(201).json({ template });
});

// Удалить шаблон
templatesRouter.delete("/:id", (req, res) => {
  const deleted = deleteTemplate(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Шаблон не найден" });
  return res.json({ ok: true });
});

// Список доступных переменных для шаблона (для подсказки при составлении шаблона)
templatesRouter.get("/variables", (_req, res) => {
  res.json({
    variables: [
      { key: "lead_id", description: "ID сделки" },
      { key: "lead_name", description: "Название сделки" },
      { key: "lead_price", description: "Бюджет сделки (форматированный)" },
      { key: "lead_price_raw", description: "Бюджет сделки (число)" },
      { key: "lead_created_at", description: "Дата создания сделки" },
      { key: "lead_tags", description: "Теги сделки" },
      { key: "date_today", description: "Сегодняшняя дата (ДД.ММ.ГГГГ)" },
      { key: "date_today_long", description: "Сегодняшняя дата прописью (1 января 2025 г.)" },
      { key: "contact_name", description: "Полное имя контакта" },
      { key: "contact_short_name", description: "Краткое имя (Иванов И.И.)" },
      { key: "contact_last_name", description: "Фамилия контакта" },
      { key: "contact_first_name", description: "Имя контакта" },
      { key: "contact_middle_name", description: "Отчество контакта" },
      { key: "company_name", description: "Название компании" },
      { key: "cf_{field_id}", description: "Кастомное поле (по ID поля из amoCRM)" }
    ]
  });
});

// Сгенерировать документ по шаблону и сделке
templatesRouter.post("/:id/generate", async (req, res) => {
  const paramsSchema = z.object({ id: z.string().uuid() });
  const bodySchema = z.object({
    leadId: z.coerce.number().int().positive()
  });

  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: "Неверный ID шаблона" });

  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Не передан leadId" });

  const template = getTemplate(params.data.id);
  if (!template) return res.status(404).json({ message: "Шаблон не найден" });

  try {
    const variables = await buildVariables(body.data.leadId);
    const templateBuffer = getTemplateBuffer(template);

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => ""
    });

    doc.render(variables);

    const resultBuffer = doc.getZip().generate({ type: "nodebuffer" });
    const ext = ".docx";

    const generated = saveGeneratedDocument(
      body.data.leadId,
      template.id,
      template.name,
      resultBuffer,
      ext
    );

    return res.json({ document: generated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка генерации";
    return res.status(500).json({ message });
  }
});

// Документы по сделке
templatesRouter.get("/documents/lead/:leadId", (req, res) => {
  const schema = z.object({ leadId: z.coerce.number().int().positive() });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: "Неверный leadId" });
  return res.json({ items: listDocumentsByLead(parsed.data.leadId) });
});

// Скачать готовый документ
templatesRouter.get("/documents/:id/download", (req, res) => {
  const doc = getDocument(req.params.id);
  if (!doc) return res.status(404).json({ message: "Документ не найден" });

  try {
    const buffer = getDocumentBuffer(doc);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.templateName)}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return res.send(buffer);
  } catch {
    return res.status(500).json({ message: "Файл не найден на диске" });
  }
});
