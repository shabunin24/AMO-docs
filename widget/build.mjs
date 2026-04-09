import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "amo-docs-widget.zip");

// Простая ZIP-сборка без внешних зависимостей (через archiver если он есть,
// иначе выводим инструкцию для ручной упаковки)
async function build() {
  let archiver;
  try {
    archiver = (await import("archiver")).default;
  } catch {
    console.log("Для автосборки ZIP установите archiver:");
    console.log("  cd widget && npm install archiver");
    console.log("\nЛибо упакуйте вручную содержимое папки widget/src/ в ZIP-архив");
    console.log("и загрузите его в amoCRM → Интеграции → Создать интеграцию → Виджет.");
    process.exit(0);
  }

  const output = fs.createWriteStream(OUT);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    console.log(`✓ Виджет собран: widget/amo-docs-widget.zip (${archive.pointer()} bytes)`);
    console.log("  Загрузите ZIP в amoCRM → Интеграции → Создать интеграцию → Виджет");
  });

  archive.on("error", (err) => { throw err; });
  archive.pipe(output);
  archive.directory(SRC, false);
  archive.finalize();
}

build();
