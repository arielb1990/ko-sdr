"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { showToast } from "@/components/ui/toast";

type IcpConfig = {
  id: string;
  name: string;
  isActive: boolean;
  countries: string[];
  employeeRanges: string[];
  jobTitles: string[];
  industries: string[];
  excludeIndustries: string[];
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

const INDUSTRIES = [
  "Retail",
  "Consumer Goods",
  "Food & Beverages",
  "Apparel & Fashion",
  "Cosmetics",
  "Automotive",
  "Health, Wellness & Fitness",
  "Pharmaceuticals",
  "Hospital & Health Care",
  "Financial Services",
  "Banking",
  "Insurance",
  "Real Estate",
  "Construction",
  "Telecommunications",
  "Information Technology & Services",
  "Computer Software",
  "Internet",
  "Marketing & Advertising",
  "Management Consulting",
  "Education",
  "E-Learning",
  "Entertainment",
  "Media Production",
  "Hospitality",
  "Restaurants",
  "Airlines/Aviation",
  "Logistics & Supply Chain",
  "Import & Export",
  "Mining & Metals",
  "Oil & Energy",
  "Agriculture",
  "Government",
  "Nonprofit",
];

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
  const router = useRouter();
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
      excludeIndustries: [],
      keywords: ["ecommerce", "transformación digital"],
      excludeKeywords: [],
    });
    setShowForm(true);
  }

  async function saveConfig(data: IcpConfig) {
    const method = data.id ? "PUT" : "POST";
    const url = data.id ? `/api/icp/${data.id}` : "/api/icp";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const responseText = await res.text();

      if (!res.ok) {
        let errorMsg = "Error al guardar";
        try {
          const err = JSON.parse(responseText);
          errorMsg = err.error || errorMsg;
        } catch {
          errorMsg = `Error ${res.status}: ${responseText.slice(0, 100)}`;
        }
        showToast(errorMsg, "error");
        return;
      }

      showToast("ICP guardado correctamente", "success");
      setShowForm(false);
      setEditing(null);
      await loadConfigs();
    } catch (err) {
      showToast(`Error de conexión: ${err}`, "error");
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [discoveryTarget, setDiscoveryTarget] = useState<string | null>(null);
  const [runningDiscovery, setRunningDiscovery] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/icp/${deleteTarget}`, { method: "DELETE" });
    setDeleteTarget(null);
    showToast("Configuración eliminada", "success");
    loadConfigs();
  }

  async function confirmDiscovery() {
    if (!discoveryTarget) return;
    setRunningDiscovery(discoveryTarget);
    setDiscoveryTarget(null);
    try {
      const res = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icpConfigId: discoveryTarget }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Discovery iniciado. Redirigiendo a Leads...", "success");
        setTimeout(() => router.push("/leads"), 1000);
      } else {
        showToast(data.error || "Error al ejecutar discovery", "error");
      }
    } catch {
      showToast("Error al ejecutar discovery", "error");
    }
    setRunningDiscovery(null);
  }

  return (
    <>
    {/* Delete confirmation modal */}
    <Modal
      open={!!deleteTarget}
      onClose={() => setDeleteTarget(null)}
      title="Eliminar configuración"
      actions={
        <>
          <button
            onClick={() => setDeleteTarget(null)}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDelete}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Eliminar
          </button>
        </>
      }
    >
      <p>¿Estás seguro de que querés eliminar esta configuración de ICP? Esta acción no se puede deshacer.</p>
    </Modal>

    {/* Discovery confirmation modal */}
    <Modal
      open={!!discoveryTarget}
      onClose={() => setDiscoveryTarget(null)}
      title="Ejecutar Discovery"
      actions={
        <>
          <button
            onClick={() => setDiscoveryTarget(null)}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDiscovery}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Ejecutar
          </button>
        </>
      }
    >
      <p>Se buscarán leads en Apollo.io con los filtros de este ICP. Cada lead enriquecido consume 1 crédito de Apollo.</p>
      <p className="mt-2 text-xs">Podés configurar el límite de leads por run en Settings.</p>
    </Modal>
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
          key={editing.id || "new"}
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
                  {config.industries.length > 0 && (
                    <span>{config.industries.length} industrias</span>
                  )}
                  {(config.excludeIndustries?.length ?? 0) > 0 && (
                    <span className="text-red-500">{config.excludeIndustries.length} excluidas</span>
                  )}
                  <span>{config.keywords.length} keywords</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setDiscoveryTarget(config.id)}
                  disabled={runningDiscovery === config.id || !config.isActive}
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1"
                  title="Ejecutar Discovery"
                >
                  <Play className="h-3 w-3" />
                  {runningDiscovery === config.id ? "Ejecutando..." : "Discovery"}
                </button>
                <button
                  onClick={() => {
                    setEditing({ ...config, excludeIndustries: config.excludeIndustries || [] });
                    setShowForm(true);
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(config.id)}
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
    </>
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
          <label className="block text-sm font-medium mb-2">Incluir industrias (opcional)</label>
          <IndustrySelect
            selected={form.industries}
            onChange={(v) => setForm({ ...form, industries: v })}
            exclude={form.excludeIndustries}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Excluir industrias</label>
          <IndustrySelect
            selected={form.excludeIndustries}
            onChange={(v) => setForm({ ...form, excludeIndustries: v })}
            exclude={form.industries}
            variant="exclude"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Leads de estas industrias no aparecerán en los resultados.
          </p>
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

function IndustrySelect({
  selected,
  onChange,
  exclude = [],
  variant = "include",
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  exclude?: string[];
  variant?: "include" | "exclude";
}) {
  const [open, setOpen] = useState(false);
  const safeSelected = selected || [];
  const safeExclude = exclude || [];
  const available = INDUSTRIES.filter(
    (i) => !safeSelected.includes(i) && !safeExclude.includes(i)
  );

  function add(industry: string) {
    onChange([...selected, industry]);
  }

  function remove(industry: string) {
    onChange(selected.filter((i) => i !== industry));
  }

  const chipColor =
    variant === "exclude"
      ? "bg-red-100 text-red-700"
      : "bg-accent/10 text-accent";

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map((industry) => (
          <span
            key={industry}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${chipColor}`}
          >
            {industry}
            <button
              onClick={() => remove(industry)}
              className="opacity-60 hover:opacity-100"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full max-w-md rounded border border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          {selected.length === 0
            ? variant === "exclude"
              ? "Seleccionar industrias a excluir..."
              : "Seleccionar industrias..."
            : `${selected.length} seleccionada${selected.length !== 1 ? "s" : ""}`}
        </button>
        {open && (
          <div className="absolute z-10 mt-1 max-h-60 w-full max-w-md overflow-auto rounded border border-border bg-background shadow-lg">
            {available.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">
                No hay más industrias disponibles
              </p>
            ) : (
              available.map((industry) => (
                <button
                  key={industry}
                  type="button"
                  onClick={() => {
                    add(industry);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {industry}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
