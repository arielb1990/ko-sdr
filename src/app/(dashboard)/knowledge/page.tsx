"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Globe } from "lucide-react";

type KnowledgeItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  industry: string | null;
  service: string | null;
  metrics: string | null;
  country: string | null;
  url: string | null;
  source: string;
  createdAt: string;
};

const ITEM_TYPES = [
  { value: "CASE_STUDY", label: "Caso de éxito" },
  { value: "SERVICE", label: "Servicio" },
  { value: "VERTICAL", label: "Vertical" },
  { value: "TESTIMONIAL", label: "Testimonio" },
];

const KO_SERVICES = [
  "VTEX",
  "Magento",
  "SEO",
  "Full Commerce",
  "Analytics",
  "Digital Transformation",
  "CRO",
  "UX/UI",
];

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    loadItems();
  }, [filterType]);

  async function loadItems() {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    const res = await fetch(`/api/knowledge?${params}`);
    setItems(await res.json());
  }

  async function deleteItem(id: string) {
    if (!confirm("¿Eliminar este item?")) return;
    await fetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
    loadItems();
  }

  async function scrapeWebsite() {
    setScraping(true);
    try {
      const res = await fetch("/api/knowledge/scrape", { method: "POST" });
      const data = await res.json();
      alert(`Se importaron ${data.count} items desde knownonline.com`);
      loadItems();
    } catch {
      alert("Error al scrapear el sitio");
    }
    setScraping(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Casos de éxito, servicios y verticales que la IA usa para personalizar
            emails.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={scrapeWebsite}
            disabled={scraping}
            className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Globe className="h-4 w-4" />
            {scraping ? "Scrapeando..." : "Importar desde web"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            Agregar manual
          </button>
        </div>
      </div>

      {showForm && (
        <KnowledgeForm
          onSave={async (item) => {
            await fetch("/api/knowledge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            });
            setShowForm(false);
            loadItems();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="mt-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border border-border px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {ITEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded border border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay items en la Knowledge Base. Importá desde la web o agregá
              manualmente.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {ITEM_TYPES.find((t) => t.value === item.type)?.label || item.type}
                    </span>
                    {item.source === "web_scrape" && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                        web
                      </span>
                    )}
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {item.service && <span>Servicio: {item.service}</span>}
                    {item.industry && <span>Industria: {item.industry}</span>}
                    {item.country && <span>País: {item.country}</span>}
                    {item.metrics && (
                      <span className="font-medium text-accent">{item.metrics}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KnowledgeForm({
  onSave,
  onCancel,
}: {
  onSave: (item: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: "CASE_STUDY",
    title: "",
    description: "",
    industry: "",
    service: "",
    metrics: "",
    country: "",
    url: "",
  });

  return (
    <div className="mt-4 rounded border border-border bg-background p-4">
      <h2 className="mb-4 text-base font-semibold">Nuevo item</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Tipo</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Servicio KO</label>
          <select
            value={form.service}
            onChange={(e) => setForm({ ...form, service: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm"
          >
            <option value="">Seleccionar...</option>
            {KO_SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium">Título</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Ej: Migración a VTEX para retailer de moda"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Descripción del caso, qué se hizo, resultados..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Industria</label>
          <input
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Ej: Retail, Moda"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">País</label>
          <input
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Ej: Argentina"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Métricas / Resultados</label>
          <input
            value={form.metrics}
            onChange={(e) => setForm({ ...form, metrics: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Ej: +40% conversión, -30% bounce rate"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">URL (opcional)</label>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="https://knownonline.com/caso/..."
          />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => onSave(form)}
          disabled={!form.title || !form.description}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-4 py-2 text-sm hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
