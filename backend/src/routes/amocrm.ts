import { Router } from "express";
import { z } from "zod";
import { amoApiRequest, exchangeCodeToToken, getAmoAuthUrl, getConnectionStatus, refreshToken } from "../services/amocrm.js";

type AmoLeadResponse = {
  id: number;
  name: string;
  price: number;
  created_at: number;
  updated_at: number;
  _embedded?: {
    contacts?: Array<{ id: number; name: string }>;
    companies?: Array<{ id: number; name: string }>;
  };
};

export const amocrmRouter = Router();

amocrmRouter.get("/status", (_req, res) => {
  res.json(getConnectionStatus());
});

amocrmRouter.get("/oauth/url", (_req, res) => {
  res.json({ url: getAmoAuthUrl() });
});

// amoCRM redirect URI — вызывается автоматически после авторизации пользователем
amocrmRouter.get("/oauth/callback", async (req, res) => {
  const querySchema = z.object({
    code: z.string().min(1),
    referer: z.string().optional(),
    client_id: z.string().optional()
  });
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).send("<h2>Ошибка: отсутствует код авторизации</h2>");
  }

  try {
    const token = await exchangeCodeToToken(parsed.data.code);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>AMO Docs — подключено</title>
          <style>
            body { font-family: sans-serif; background: #0f1e3d; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1a2744; border-radius: 12px; padding: 40px 48px; text-align: center; max-width: 400px; }
            h2 { color: #26c6da; margin-top: 0; }
            p { color: #a0b0cc; }
            .domain { font-weight: bold; color: #fff; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✓ amoCRM подключён</h2>
            <p>Аккаунт: <span class="domain">${token.baseDomain}</span></p>
            <p>AMO Docs готов к работе.<br>Можно закрыть эту страницу.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return res.status(500).send(`<h2>Ошибка подключения: ${message}</h2>`);
  }
});

amocrmRouter.post("/oauth/exchange", async (req, res) => {
  const bodySchema = z.object({
    code: z.string().min(1)
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
  }

  try {
    const token = await exchangeCodeToToken(parsed.data.code);
    return res.json({
      connected: true,
      baseDomain: token.baseDomain,
      expiresAt: token.expiresAt
    });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Unexpected error" });
  }
});

amocrmRouter.post("/oauth/refresh", async (_req, res) => {
  try {
    const token = await refreshToken();
    return res.json({
      connected: true,
      baseDomain: token.baseDomain,
      expiresAt: token.expiresAt
    });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Unexpected error" });
  }
});

amocrmRouter.get("/leads/:leadId", async (req, res) => {
  const paramsSchema = z.object({
    leadId: z.coerce.number().int().positive()
  });
  const parsed = paramsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid lead id" });
  }

  try {
    const lead = await amoApiRequest<AmoLeadResponse>(`/api/v4/leads/${parsed.data.leadId}`, {
      with: "contacts,companies"
    });
    return res.json({ lead });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : "Unexpected error" });
  }
});
