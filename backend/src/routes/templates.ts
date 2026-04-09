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
import { addLeadNote } from "../services/amocrm.js";
import { buildVariables } from "../services/variables.js";

export const templatesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.match(/\.(docx|pptx|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Разрешены только файлы .docx, .pptx, .xlsx"));
    }
  }
});

// Список шаблонов
templatesRouter.get("/", async (_req, res) => {
  try {
    const items = await listTemplates();
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка" });
  }
});

// Загрузить шаблон
templatesRouter.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Файл не передан" });
  try {
    const template = await saveTemplate(req.file.originalname, req.file.buffer);
    return res.status(201).json({ template });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка загрузки" });
  }
});

// Удалить шаблон
templatesRouter.delete("/:id", async (req, res) => {
  try {
    const deleted = await deleteTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Шаблон не найден" });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка" });
  }
});

// Список доступных переменных
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
      { key: "date_today_long", description: "Сегодняшняя дата прописью" },
      { key: "contact_name", description: "Полное имя контакта" },
      { key: "contact_short_name", description: "Краткое имя (Иванов И.И.)" },
      { key: "contact_last_name", description: "Фамилия контакта" },
      { key: "contact_first_name", description: "Имя контакта" },
      { key: "contact_middle_name", description: "Отчество контакта" },
      { key: "company_name", description: "Название компании" },
      { key: "cf_{field_id}", description: "Кастомное поле по ID из amoCRM" }
    ]
  });
});

// Сгенерировать документ
templatesRouter.post("/:id/generate", async (req, res) => {
  const paramsSchema = z.object({ id: z.string().uuid() });
  const bodySchema = z.object({ leadId: z.coerce.number().int().positive() });

  const params = paramsSchema.safeParse(req.params);
  if (!params.success) return res.status(400).json({ message: "Неверный ID шаблона" });

  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ message: "Не передан leadId" });

  try {
    const template = await getTemplate(params.data.id);
    if (!template) return res.status(404).json({ message: "Шаблон не найден" });

    const variables = await buildVariables(body.data.leadId);
    const templateBuffer = await getTemplateBuffer(template);

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => ""
    });

    doc.render(variables);

    const resultBuffer = doc.getZip().generate({ type: "nodebuffer" });

    const generated = await saveGeneratedDocument(
      body.data.leadId,
      template.id,
      template.name,
      resultBuffer,
      ".docx"
    );

    // Не блокируем генерацию, если заметку добавить не удалось.
    try {
      const downloadUrl = `${req.protocol}://${req.get("host")}/api/v1/templates/documents/${generated.id}/download`;
      const noteText = `📄 Создан документ: ${generated.template_name}\nСкачать: ${downloadUrl}`;
      await addLeadNote(body.data.leadId, noteText);
    } catch (_err) {
      // ignore note errors
    }

    return res.json({ document: generated });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка генерации" });
  }
});

// Документы по сделке
templatesRouter.get("/documents/lead/:leadId", async (req, res) => {
  const schema = z.object({ leadId: z.coerce.number().int().positive() });
  const parsed = schema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: "Неверный leadId" });
  try {
    const items = await listDocumentsByLead(parsed.data.leadId);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка" });
  }
});

// Скачать документ
templatesRouter.get("/documents/:id/download", async (req, res) => {
  try {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Документ не найден" });

    const buffer = await getDocumentBuffer(doc);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.template_name)}.docx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Ошибка скачивания" });
  }
});
