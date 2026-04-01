"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash2, Search, Upload } from "lucide-react";
import { showToast } from "@/components/ui/toast";

type Exclusion = {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  source: string;
  createdAt: string;
};

const EXCLUSION_TYPES = [
  { value: "DOMAIN", label: "Dominio" },
  { value: "EMAIL", label: "Email" },
  { value: "COMPANY_NAME", label: "Empresa" },
];

export default function ExclusionsPage() {
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [newType, setNewType] = useState("DOMAIN");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadExclusions();
  }, [filterType, search]);

  async function loadExclusions() {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (search) params.set("search", search);
    const res = await fetch(`/api/exclusions?${params}`);
    setExclusions(await res.json());
  }

  async function addExclusion(e: React.FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;

    await fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newType,
        value: newValue,
        reason: newReason || null,
      }),
    });

    setNewValue("");
    setNewReason("");
    setShowForm(false);
    loadExclusions();
  }

  async function removeExclusion(id: string) {
    await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
    loadExclusions();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/exclusions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.imported} exclusiones importadas${data.skipped > 0 ? `, ${data.skipped} omitidas` : ""}`, "success");
        loadExclusions();
      } else {
        showToast(data.error || "Error al importar", "error");
      }
    } catch {
      showToast("Error al importar archivo", "error");
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exclusiones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {exclusions.length} exclusiones{filterType || search ? " (filtradas)" : ""} — Dominios, emails y empresas excluidas del outreach.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? "Importando..." : "Importar Excel"}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={addExclusion}
          className="mt-4 rounded border border-border bg-background p-4"
        >
          <div className="flex gap-3">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded border border-border px-3 py-2 text-sm"
            >
              {EXCLUSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder={
                newType === "DOMAIN"
                  ? "ejemplo.com"
                  : newType === "EMAIL"
                    ? "email@ejemplo.com"
                    : "Nombre de empresa"
              }
            />
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="w-48 rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Motivo (opcional)"
            />
            <button
              type="submit"
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-border pl-9 pr-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Buscar..."
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border border-border px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {EXCLUSION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <option value="HUBSPOT_CLIENT">HubSpot - Cliente</option>
          <option value="HUBSPOT_CONTACT">HubSpot - Contacto</option>
        </select>
      </div>

      <div className="mt-4 rounded border border-border bg-background">
        {exclusions.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No hay exclusiones registradas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Valor</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Motivo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Origen</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map((ex) => (
                <tr key={ex.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                      {ex.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{ex.value}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ex.reason || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ex.source}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeExclusion(ex.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
