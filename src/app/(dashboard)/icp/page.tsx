"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Play } from "lucide-react";

type IcpConfig = {
  id: string;
  name: string;
  isActive: boolean;
  countries: string[];
  employeeRanges: string[];
  jobTitles: string[];
  industries: string[];
  keywords: string[];
  excludeKeywords: string[];
};

const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "UY", name: "Uruguay" },
  { code: "CL", name: "Chile" },
  { code: "EC", name: "Ecuador" },
  { code: "PE", name: "Perú" },
  { code: "PA", name: "Panamá" },
  { code: "GT", name: "Guatemala" },
  { code: "CR", name: "Costa Rica" },
  { code: "US", name: "Estados Unidos" },
];

const EMPLOYEE_RANGES = ["11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001+"];

const DEFAULT_JOB_TITLES = [
  "Director de Ecommerce",
  "Gerente de Marketing",
  "CMO",
  "CTO",
  "Director de Tecnología",
  "CEO",
  "Director Digital",
  "VP Ecommerce",
  "VP Marketing",
];

export default function IcpPage() {
  const [configs, setConfigs] = useState<IcpConfig[]>([]);
  const [editing, setEditing] = useState<IcpConfig | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    const res = await fetch("/api/icp");
    const data = await res.json();
    setConfigs(data);
  }

  function newConfig() {
    setEditing({
      id: "",
      name: "",
      isActive: true,
      countries: ["AR", "UY", "CL", "EC", "PE", "PA", "GT", "CR"],
      employeeRanges: ["51-200", "201-500", "501-1000", "1001-5000"],
      jobTitles: [...DEFAULT_JOB_TITLES],
      industries: [],
      keywords: ["ecommerce", "transformación digital"],
      excludeKeywords: [],
    });
    setShowForm(true);
  }

  async function saveConfig(config: IcpConfig) {
    const method = config.id ? "PUT" : "POST";
    const url = config.id ? `/api/icp/${config.id}` : "/api/icp";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    setShowForm(false);
    setEditing(null);
    loadConfigs();
  }

  async function deleteConfig(id: string) {
    if (!confirm("¿Eliminar esta configuración de ICP?")) return;
    await fetch(`/api/icp/${id}`, { method: "DELETE" });
    loadConfigs();
  }

  const [runningDiscovery, setRunningDiscovery] = useState<string | null>(null);

  async function runDiscovery(icpConfigId: string) {
    if (!confirm("¿Ejecutar Discovery con este ICP? Se buscarán leads en Apollo.io.")) return;
    setRunningDiscovery(icpConfigId);
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icpConfigId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Discovery iniciado (ID: ${data.id}). Revisá la pestaña de Leads para ver los resultados.`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert("Error al ejecutar discovery");
    }
    setRunningDiscovery(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Ideal Customer Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurá los filtros para la búsqueda de leads en Apollo.io
          </p>
        </div>
        <button
          onClick={newConfig}
          className="flex items-center gap-2 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo ICP
        </button>
      </div>

      {showForm && editing && (
        <IcpForm
          config={editing}
          onSave={saveConfig}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <div className="mt-6 space-y-4">
        {configs.length === 0 && !showForm && (
          <div className="rounded border border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay configuraciones de ICP. Creá una para empezar a buscar leads.
            </p>
          </div>
        )}

        {configs.map((config) => (
          <div
            key={config.id}
            className="rounded border border-border bg-background p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{config.name}</h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      config.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {config.isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{config.countries.length} países</span>
                  <span>{config.employeeRanges.length} rangos de tamaño</span>
                  <span>{config.jobTitles.length} cargos</span>
                  <span>{config.keywords.length} keywords</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => runDiscovery(config.id)}
                  disabled={runningDiscovery === config.id || !config.isActive}
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1"
                  title="Ejecutar Discovery"
                >
                  <Play className="h-3 w-3" />
                  {runningDiscovery === config.id ? "Ejecutando..." : "Discovery"}
                </button>
                <button
                  onClick={() => {
                    setEditing(config);
                    setShowForm(true);
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteConfig(config.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IcpForm({
  config,
  onSave,
  onCancel,
}: {
  config: IcpConfig;
  onSave: (c: IcpConfig) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(config);

  function toggleArrayItem(field: keyof IcpConfig, value: string) {
    const arr = form[field] as string[];
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    setForm({ ...form, [field]: next });
  }

  return (
    <div className="mt-6 rounded border border-border bg-background p-6">
      <h2 className="mb-4 text-lg font-semibold">
        {config.id ? "Editar" : "Nuevo"} ICP
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium">Nombre</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full max-w-md rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Ej: LATAM Ecommerce Directors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Países</label>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleArrayItem("countries", c.code)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  form.countries.includes(c.code)
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Tamaño de empresa</label>
          <div className="flex flex-wrap gap-2">
            {EMPLOYEE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleArrayItem("employeeRanges", r)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  form.employeeRanges.includes(r)
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {r} empleados
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Cargos objetivo</label>
          <TagInput
            tags={form.jobTitles}
            onChange={(tags) => setForm({ ...form, jobTitles: tags })}
            placeholder="Agregar cargo..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Industrias</label>
          <TagInput
            tags={form.industries}
            onChange={(tags) => setForm({ ...form, industries: tags })}
            placeholder="Agregar industria..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Keywords</label>
          <TagInput
            tags={form.keywords}
            onChange={(tags) => setForm({ ...form, keywords: tags })}
            placeholder="Agregar keyword..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Keywords a excluir</label>
          <TagInput
            tags={form.excludeKeywords}
            onChange={(tags) => setForm({ ...form, excludeKeywords: tags })}
            placeholder="Agregar keyword a excluir..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onSave(form)}
            disabled={!form.name}
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={onCancel}
            className="rounded border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    }
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="block w-full max-w-md rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  );
}
