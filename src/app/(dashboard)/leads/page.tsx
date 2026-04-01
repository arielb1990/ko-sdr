"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, ShieldBan } from "lucide-react";
import { showToast } from "@/components/ui/toast";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  status: string;
  aiRelevanceScore: number | null;
  createdAt: string;
  company: {
    name: string;
    domain: string;
    country: string | null;
    industry: string | null;
    employeeCount: number | null;
  };
};

type Pagination = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DISCOVERED: { label: "Descubierto", color: "bg-blue-100 text-blue-700" },
  RESEARCHING: { label: "Investigando", color: "bg-yellow-100 text-yellow-700" },
  RESEARCHED: { label: "Investigado", color: "bg-indigo-100 text-indigo-700" },
  SCORING: { label: "Scoring", color: "bg-purple-100 text-purple-700" },
  QUALIFIED: { label: "Calificado", color: "bg-green-100 text-green-700" },
  DISQUALIFIED: { label: "Descalificado", color: "bg-red-100 text-red-700" },
  PENDING_APPROVAL: { label: "Pendiente", color: "bg-orange-100 text-orange-700" },
  APPROVED: { label: "Aprobado", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "Rechazado", color: "bg-red-100 text-red-700" },
  IN_SEQUENCE: { label: "En secuencia", color: "bg-cyan-100 text-cyan-700" },
  REPLIED: { label: "Respondió", color: "bg-teal-100 text-teal-700" },
  INTERESTED: { label: "Interesado", color: "bg-emerald-100 text-emerald-700" },
  NOT_INTERESTED: { label: "No interesado", color: "bg-gray-100 text-gray-500" },
  MEETING_BOOKED: { label: "Meeting", color: "bg-green-200 text-green-800" },
  PUSHED_TO_CRM: { label: "En CRM", color: "bg-violet-100 text-violet-700" },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), perPage: "50" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads);
    setPagination(data.pagination);
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  async function excludeEmail(email: string) {
    await Promise.all([
      fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "EMAIL", value: email, reason: "Excluido desde leads" }),
      }),
      fetch("/api/leads/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "email", value: email }),
      }),
    ]);
    setLeads((prev) => prev.filter((l) => l.email !== email));
    showToast(`Email ${email} excluido`, "success");
  }

  async function excludeDomain(domain: string) {
    const count = leads.filter((l) => l.company.domain === domain).length;
    await Promise.all([
      fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "DOMAIN", value: domain, reason: "Excluido desde leads" }),
      }),
      fetch("/api/leads/exclude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "domain", value: domain }),
      }),
    ]);
    setLeads((prev) => prev.filter((l) => l.company.domain !== domain));
    showToast(`Dominio ${domain} excluido (${count} leads removidos)`, "success");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Leads</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {pagination ? `${pagination.total} leads en total` : "Cargando..."}
      </p>

      <div className="mt-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded border border-border bg-background pl-9 pr-3 py-2 text-sm focus:border-accent focus:outline-none"
            placeholder="Buscar por nombre, email o empresa..."
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 rounded border border-border bg-background">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : leads.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No hay leads. Ejecutá un Discovery desde la página de ICP.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Cargo</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">País</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const status = STATUS_LABELS[lead.status] || {
                  label: lead.status,
                  color: "bg-gray-100 text-gray-600",
                };
                return (
                  <tr
                    key={lead.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-foreground hover:text-accent"
                      >
                        {lead.firstName} {lead.lastName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{lead.company.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.company.domain}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.jobTitle || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lead.company.country || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {lead.aiRelevanceScore != null ? (
                        <span
                          className={`font-medium ${
                            lead.aiRelevanceScore >= 70
                              ? "text-green-600"
                              : lead.aiRelevanceScore >= 40
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {Math.round(lead.aiRelevanceScore)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => excludeEmail(lead.email)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          title={`Excluir email: ${lead.email}`}
                        >
                          <ShieldBan className="h-3 w-3" />
                          email
                        </button>
                        <button
                          onClick={() => excludeDomain(lead.company.domain)}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-red-50 hover:text-red-600"
                          title={`Excluir dominio: ${lead.company.domain}`}
                        >
                          <ShieldBan className="h-3 w-3" />
                          dominio
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="rounded border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
