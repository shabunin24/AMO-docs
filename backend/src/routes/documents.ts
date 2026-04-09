import { Router } from "express";

type DocumentStub = {
  id: string;
  leadId: number;
  name: string;
  format: "docx" | "pptx" | "xlsx" | "pdf";
  createdAt: string;
};

const documents: DocumentStub[] = [];

export const documentsRouter = Router();

documentsRouter.get("/", (_req, res) => {
  res.json({
    items: documents,
    total: documents.length
  });
});
