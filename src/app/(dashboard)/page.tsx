"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type DashboardData = {
  stats: {
    totalLeads: number;
    discovered: number;
    researching: number;
    qualified: number;
    disqualified: number;
    pendingApproval: number;
    approved: number;
    rejected: number;
    inSequence: number;
    interested: number;
  };
  recentRuns: Array<{
    id: string;
    status: string;
    totalFound: number;
    totalNew: number;
    totalExcluded: number;
    createdAt: string;
    completedAt: string | null;
    icpConfig: { name: string };
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  const { stats } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Resumen del pipeline de prospección
      </p>

      {/* Main stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total leads" value={stats.totalLeads} />
        <StatCard
          label="Pendientes de aprobación"
          value={stats.pendingApproval}
          href="/approval"
          highlight={stats.pendingApproval > 0}
        />
        <StatCard label="Aprobados" value={stats.approved} />
        <StatCard
          label="Interesados"
          value={stats.interested}
          highlight={stats.interested > 0}
        />
      </div>

      {/* Pipeline funnel */}
      <div className="mt-8 rounded border border-border bg-background p-6">
        <h2 className="text-lg font-semibold text-foreground">Pipeline</h2>
        <div className="mt-4 flex items-end gap-2">
          {[
            { label: "Descubiertos", value: stats.discovered, color: "bg-blue-500" },
            { label: "Investigando", value: stats.researching, color: "bg-yellow-500" },
            { label: "Calificados", value: stats.qualified, color: "bg-green-500" },
            { label: "Descalificados", value: stats.disqualified, color: "bg-red-400" },
            { label: "Pendientes", value: stats.pendingApproval, color: "bg-orange-500" },
            { label: "Aprobados", value: stats.approved, color: "bg-emerald-500" },
            { label: "Rechazados", value: stats.rejected, color: "bg-red-600" },
            { label: "En secuencia", value: stats.inSequence, color: "bg-cyan-500" },
            { label: "Interesados", value: stats.interested, color: "bg-green-600" },
          ].map((stage) => {
            const maxVal = Math.max(stats.totalLeads, 1);
            const height = Math.max(4, (stage.value / maxVal) * 120);
            return (
              <div key={stage.label} className="flex flex-col items-center flex-1">
                <span className="mb-1 text-xs font-bold text-foreground">
                  {stage.value}
                </span>
                <div
                  className={`w-full rounded-t ${stage.color}`}
                  style={{ height: `${height}px` }}
                />
                <span className="mt-2 text-[10px] text-muted-foreground text-center leading-tight">
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent discovery runs */}
      <div className="mt-8 rounded border border-border bg-background p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Últimos Discovery Runs
        </h2>
        {data.recentRuns.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No hay runs recientes.{" "}
            <Link href="/icp" className="text-accent hover:underline">
              Configurá un ICP y ejecutá tu primer discovery.
            </Link>
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between rounded border border-border p-3 text-sm"
              >
                <div>
                  <span className="font-medium text-foreground">
                    {run.icpConfig.name}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(run.createdAt).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground">
                    {run.totalNew} nuevos / {run.totalExcluded} excluidos
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      run.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : run.status === "RUNNING"
                          ? "bg-yellow-100 text-yellow-700"
                          : run.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {run.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  highlight,
}: {
  label: string;
  value: number;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <div
      className={`rounded border p-4 ${
        highlight
          ? "border-accent bg-accent/5"
          : "border-border bg-background"
      }`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
}
