"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

type AnalyticsData = {
  period: { days: number };
  funnel: Record<string, number>;
  outreach: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    bounceRate: number;
  };
  sequencePerformance: Array<{
    id: string;
    name: string;
    totalEnrolled: number;
    periodEnrolled: number;
    replied: number;
    interested: number;
    replyRate: number;
    interestRate: number;
  }>;
  icpPerformance: Array<{
    id: string;
    name: string;
    runs: number;
    totalFound: number;
    totalNew: number;
    qualified: number;
    qualifyRate: number;
    avgScore: number;
  }>;
  dailyLeads: Array<{ date: string; count: number }>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    const res = await fetch(`/api/analytics?days=${days}`);
    setData(await res.json());
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const funnelData = [
    { name: "Descubiertos", value: data.funnel.discovered },
    { name: "Investigados", value: data.funnel.researched },
    { name: "Calificados", value: data.funnel.qualified },
    { name: "Aprobados", value: data.funnel.approved },
    { name: "En secuencia", value: data.funnel.inSequence },
    { name: "Respondieron", value: data.funnel.replied },
    { name: "Interesados", value: data.funnel.interested },
    { name: "Meetings", value: data.funnel.meetings },
  ];

  function exportCSV() {
    const rows = [
      ["Métrica", "Valor"],
      ...Object.entries(data!.funnel).map(([k, v]) => [k, String(v)]),
      [""],
      ["Outreach"],
      ...Object.entries(data!.outreach).map(([k, v]) => [k, typeof v === "number" ? v.toFixed(1) : String(v)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ko-sdr-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas del pipeline de prospección
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-border px-3 py-2 text-sm"
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
          <button
            onClick={exportCSV}
            className="rounded border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Outreach stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Metric label="Emails enviados" value={data.outreach.sent} />
        <Metric label="Open rate" value={`${data.outreach.openRate.toFixed(1)}%`} />
        <Metric label="Click rate" value={`${data.outreach.clickRate.toFixed(1)}%`} />
        <Metric label="Reply rate" value={`${data.outreach.replyRate.toFixed(1)}%`} highlight />
        <Metric label="Bounce rate" value={`${data.outreach.bounceRate.toFixed(1)}%`} warn={data.outreach.bounceRate > 5} />
      </div>

      {/* Funnel chart */}
      <div className="mt-8 rounded border border-border bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">Funnel de conversión</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={funnelData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#fa5a1e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily leads chart */}
      {data.dailyLeads.length > 1 && (
        <div className="mt-6 rounded border border-border bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold">Leads por día</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailyLeads}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(d) => new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(d) => new Date(d as string).toLocaleDateString("es-AR")}
              />
              <Line type="monotone" dataKey="count" stroke="#fa5a1e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sequence performance */}
      {data.sequencePerformance.length > 0 && (
        <div className="mt-6 rounded border border-border bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold">Performance por secuencia</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">Secuencia</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Inscriptos</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Respondieron</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Interesados</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Reply rate</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Interest rate</th>
              </tr>
            </thead>
            <tbody>
              {data.sequencePerformance.map((seq) => (
                <tr key={seq.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{seq.name}</td>
                  <td className="py-2 text-right text-muted-foreground">{seq.periodEnrolled}</td>
                  <td className="py-2 text-right text-muted-foreground">{seq.replied}</td>
                  <td className="py-2 text-right font-medium text-accent">{seq.interested}</td>
                  <td className="py-2 text-right text-muted-foreground">{seq.replyRate.toFixed(1)}%</td>
                  <td className="py-2 text-right text-muted-foreground">{seq.interestRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ICP performance */}
      {data.icpPerformance.length > 0 && (
        <div className="mt-6 rounded border border-border bg-background p-6">
          <h2 className="mb-4 text-lg font-semibold">Performance por ICP</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-medium text-muted-foreground">ICP</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Runs</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Encontrados</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Nuevos</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Calificados</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Qualify rate</th>
                <th className="pb-2 font-medium text-muted-foreground text-right">Score prom.</th>
              </tr>
            </thead>
            <tbody>
              {data.icpPerformance.map((icp) => (
                <tr key={icp.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-medium">{icp.name}</td>
                  <td className="py-2 text-right text-muted-foreground">{icp.runs}</td>
                  <td className="py-2 text-right text-muted-foreground">{icp.totalFound}</td>
                  <td className="py-2 text-right text-muted-foreground">{icp.totalNew}</td>
                  <td className="py-2 text-right font-medium text-accent">{icp.qualified}</td>
                  <td className="py-2 text-right text-muted-foreground">{icp.qualifyRate.toFixed(1)}%</td>
                  <td className="py-2 text-right text-muted-foreground">{icp.avgScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`rounded border p-4 ${warn ? "border-red-300 bg-red-50" : "border-border bg-background"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-accent" : warn ? "text-red-600" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
