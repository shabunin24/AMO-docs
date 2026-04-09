import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { amocrmRouter } from "./routes/amocrm.js";
import { documentsRouter } from "./routes/documents.js";
import { healthRouter } from "./routes/health.js";
import { templatesRouter } from "./routes/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Статические файлы виджета amoCRM
app.use("/widget", express.static(path.resolve(__dirname, "../../widget/src")));

app.use("/health", healthRouter);
app.use("/api/v1/documents", documentsRouter);
app.use("/api/v1/amocrm", amocrmRouter);
app.use("/api/v1/templates", templatesRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(config.PORT, () => {
  console.log(`amo-docs-api started on port ${config.PORT}`);
});
