import { amoApiRequest } from "./amocrm.js";

type AmoCustomField = {
  field_id: number;
  field_name: string;
  values: Array<{ value: string | number; enum_id?: number }>;
};

type AmoContact = {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  custom_fields_values?: AmoCustomField[];
};

type AmoCompany = {
  id: number;
  name: string;
  custom_fields_values?: AmoCustomField[];
};

type AmoLead = {
  id: number;
  name: string;
  price: number;
  created_at: number;
  updated_at: number;
  custom_fields_values?: AmoCustomField[];
  _embedded?: {
    contacts?: Array<{ id: number; is_main?: boolean }>;
    companies?: Array<{ id: number }>;
    tags?: Array<{ name: string }>;
  };
};

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateLong(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatPrice(value: number | string | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  return new Intl.NumberFormat("ru-RU").format(Number.isFinite(n) ? n : 0);
}

function extractCustomFields(fields: AmoCustomField[] | undefined): Record<string, string> {
  if (!fields) return {};
  return Object.fromEntries(
    fields.map((f) => {
      const val = f.values?.[0]?.value ?? "";
      return [`cf_${f.field_id}`, String(val)];
    })
  );
}

export async function buildVariables(leadId: number): Promise<Record<string, string>> {
  // Для GET /api/v4/leads/{id} в `with` допустимы только значения из доки amo (contacts, catalog_elements, …).
  // Параметры `companies` и `tags` там не перечислены — лишние значения дают 400. Теги и компания приходят в _embedded без них.
  const lead = await amoApiRequest<AmoLead>(`/api/v4/leads/${leadId}`, {
    with: "contacts"
  });

  const priceNum = Number(lead.price ?? 0);

  const vars: Record<string, string> = {
    lead_id: String(lead.id),
    lead_name: lead.name ?? "",
    lead_price: formatPrice(Number.isFinite(priceNum) ? priceNum : 0),
    lead_price_raw: String(Number.isFinite(priceNum) ? priceNum : 0),
    lead_created_at: formatDate(lead.created_at),
    lead_updated_at: formatDate(lead.updated_at),
    date_today: formatDate(Math.floor(Date.now() / 1000)),
    date_today_long: formatDateLong(Math.floor(Date.now() / 1000)),
    ...extractCustomFields(lead.custom_fields_values)
  };

  // Теги сделки
  const tags = lead._embedded?.tags?.map((t) => t.name).join(", ") ?? "";
  vars["lead_tags"] = tags;

  // Контакт
  const contactRefs = lead._embedded?.contacts ?? [];
  const mainContactRef = contactRefs.find((c) => c.is_main) ?? contactRefs[0];
  if (mainContactRef) {
    try {
      const contact = await amoApiRequest<AmoContact>(`/api/v4/contacts/${mainContactRef.id}`);
      const nameParts = contact.name?.split(" ") ?? [];
      vars["contact_id"] = String(contact.id);
      vars["contact_name"] = contact.name ?? "";
      vars["contact_last_name"] = nameParts[0] ?? "";
      vars["contact_first_name"] = nameParts[1] ?? "";
      vars["contact_middle_name"] = nameParts[2] ?? "";
      vars["contact_short_name"] = buildShortName(contact.name);
      Object.assign(vars, extractCustomFields(contact.custom_fields_values));
    } catch {}
  }

  // Компания
  const companyRef = lead._embedded?.companies?.[0];
  if (companyRef) {
    try {
      const company = await amoApiRequest<AmoCompany>(`/api/v4/companies/${companyRef.id}`);
      vars["company_id"] = String(company.id);
      vars["company_name"] = company.name ?? "";
      Object.assign(vars, extractCustomFields(company.custom_fields_values));
    } catch {}
  }

  return vars;
}

function buildShortName(fullName: string | undefined): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const [last, first, middle] = parts;
  const initials = [first ? `${first[0]}.` : "", middle ? `${middle[0]}.` : ""].filter(Boolean).join("");
  return `${last} ${initials}`.trim();
}
