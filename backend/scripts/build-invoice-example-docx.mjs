/**
 * Собирает пример .docx «Счёт на оплату» с плейсхолдерами под Docxtemplater
 * (те же ключи, что отдаёт buildVariables).
 *
 * Запуск: cd backend && node scripts/build-invoice-example-docx.mjs
 * Файл: ../examples/schet-na-oplatu-primer.docx
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PizZip from "pizzip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../../examples");
const outFile = path.join(outDir, "schet-na-oplatu-primer.docx");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const lines = [
  "СЧЁТ НА ОПЛАТУ № {lead_id} от {date_today}",
  "",
  "Поставщик (заполните реквизиты в Word под свою организацию):",
  "________________________________________________________________",
  "",
  "Плательщик:",
  "Наименование: {company_name}",
  "Контакт: {contact_name} ({contact_short_name})",
  "Сделка amoCRM: {lead_name} (теги: {lead_tags})",
  "",
  "Назначение платежа: оплата по счёту № {lead_id} от {date_today} за услуги по сделке.",
  "",
  "Сумма к оплате: {lead_price} ₽  (число: {lead_price_raw})",
  "",
  "Дата выставления: {date_today}    Долгая дата: {date_today_long}",
  "Дата создания сделки в amo: {lead_created_at}",
  "",
  "Кастомные поля сделки в amo подставляются как {cf_123456} — замените 123456 на ID поля в amoCRM.",
  "",
  "Подпись _________________ /М.П./"
];

const bodyXml = lines
  .map((line) => {
    const t = esc(line);
    return `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  })
  .join("");

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/document.xml", documentXml);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, zip.generate({ type: "nodebuffer" }));
console.log("OK:", outFile);
