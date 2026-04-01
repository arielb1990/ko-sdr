"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type ApprovalItem = {
  id: string;
  type: string;
  status: string;
  aiBrief: string | null;
  aiConfidence: number | null;
  createdAt: string;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string | null;
    linkedinUrl: string | null;
    aiRelevanceScore: number | null;
    aiScoreReasoning: string | null;
    company: {
      name: string;
      domain: string;
      country: string | null;
      industry: string | null;
      employeeCount: number | null;
      aiServiceMatch: string[];
    };
  };
};

export default function ApprovalPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");

  const loadItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/approval?status=${statusFilter}`);
    setItems(await res.json());
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    await fetch(`/api/approval/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    loadItems();
  }

  async function handleBatch(action: "APPROVED" | "REJECTED") {
    if (selected.size === 0) return;
    const label = action === "APPROVED" ? "aprobar" : "rechazar";
    if (!confirm(`¿${label} ${selected.size} leads?`)) return;

    await fetch("/api/approval/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), action }),
    });

    setSelected(new Set());
    loadItems();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Cola de aprobación
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} items{" "}
            {statusFilter === "PENDING" ? "pendientes" : statusFilter.toLowerCase()}
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setSelected(new Set());
          }}
          className="rounded border border-border px-3 py-2 text-sm"
        >
          <option value="PENDING">Pendientes</option>
          <option value="APPROVED">Aprobados</option>
          <option value="REJECTED">Rechazados</option>
        </select>
      </div>

      {/* Batch actions */}
      {statusFilter === "PENDING" && items.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded border border-border bg-background p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.size === items.length && items.length > 0}
              onChange={selectAll}
              className="rounded"
            />
            Seleccionar todos
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.size} seleccionados
              </span>
              <button
                onClick={() => handleBatch("APPROVED")}
                className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <CheckCircle className="h-3 w-3" />
                Aprobar todos
              </button>
              <button
                onClick={() => handleBatch("REJECTED")}
                className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                <XCircle className="h-3 w-3" />
                Rechazar todos
              </button>
            </>
          )}
        </div>
      )}

      {/* Items */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <div className="rounded border border-border bg-background p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {statusFilter === "PENDING"
                ? "No hay leads pendientes de aprobación."
                : `No hay leads ${statusFilter.toLowerCase()}.`}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ApprovalCard
              key={item.id}
              item={item}
              isSelected={selected.has(item.id)}
              isExpanded={expandedId === item.id}
              isPending={statusFilter === "PENDING"}
              onToggleSelect={() => toggleSelect(item.id)}
              onToggleExpand={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onApprove={() => handleAction(item.id, "approve")}
              onReject={() => handleAction(item.id, "reject")}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  item,
  isSelected,
  isExpanded,
  isPending,
  onToggleSelect,
  onToggleExpand,
  onApprove,
  onReject,
}: {
  item: ApprovalItem;
  isSelected: boolean;
  isExpanded: boolean;
  isPending: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const lead = item.lead;
  const score = lead.aiRelevanceScore;

  return (
    <div className="rounded border border-border bg-background">
      <div className="flex items-center gap-3 p-4">
        {isPending && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="rounded"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/leads/${lead.id}`}
              className="font-semibold text-foreground hover:text-accent"
            >
              {lead.firstName} {lead.lastName}
            </Link>
            {lead.linkedinUrl && (
              <a
                href={lead.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-accent"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.jobTitle || "Sin cargo"} @ {lead.company.name}
            {lead.company.country && ` · ${lead.company.country}`}
          </p>
        </div>

        {/* Score badge */}
        {score != null && (
          <div
            className={`rounded px-3 py-1 text-center text-sm font-bold ${
              score >= 70
                ? "bg-green-100 text-green-700"
                : score >= 40
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {Math.round(score)}
          </div>
        )}

        {/* Service tags */}
        <div className="hidden md:flex gap-1">
          {lead.company.aiServiceMatch.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
            >
              {s}
            </span>
          ))}
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex gap-1">
            <button
              onClick={onApprove}
              className="rounded bg-green-600 p-1.5 text-white hover:bg-green-700"
              title="Aprobar"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            <button
              onClick={onReject}
              className="rounded bg-red-600 p-1.5 text-white hover:bg-red-700"
              title="Rechazar"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          onClick={onToggleExpand}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Score reasoning */}
          {lead.aiScoreReasoning && (
            <div className="rounded bg-muted p-3">
              <p className="text-xs font-medium text-foreground mb-1">
                Por qué score {score != null ? Math.round(score) : "—"}:
              </p>
              <p className="text-sm text-muted-foreground">{lead.aiScoreReasoning}</p>
            </div>
          )}

          {/* AI Brief */}
          {item.aiBrief && (
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {item.aiBrief}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
