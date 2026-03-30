"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Linkedin,
  Briefcase,
  MapPin,
  Users,
  Globe,
} from "lucide-react";

type LeadDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  seniority: string | null;
  department: string | null;
  linkedinUrl: string | null;
  status: string;
  aiRelevanceScore: number | null;
  aiScoreReasoning: string | null;
  aiPersonalization: string | null;
  createdAt: string;
  company: {
    name: string;
    domain: string;
    website: string | null;
    linkedinUrl: string | null;
    country: string | null;
    city: string | null;
    industry: string | null;
    employeeCount: number | null;
    annualRevenue: string | null;
    description: string | null;
    technologies: string[];
    aiBrief: string | null;
    aiPainPoints: string[];
    aiServiceMatch: string[];
  };
  outreachActivities: Array<{
    id: string;
    type: string;
    subject: string | null;
    createdAt: string;
  }>;
  discoveryRun: {
    id: string;
    createdAt: string;
    status: string;
  } | null;
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setLead(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (!lead) {
    return <p className="text-sm text-red-600">Lead no encontrado.</p>;
  }

  return (
    <div>
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a leads
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.jobTitle} @ {lead.company.name}
          </p>
        </div>
        <span className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
          {lead.status}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact Info */}
        <div className="rounded border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-foreground">Contacto</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${lead.email}`} className="hover:text-accent">
                {lead.email}
              </a>
            </div>
            {lead.linkedinUrl && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Linkedin className="h-4 w-4" />
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent"
                >
                  LinkedIn
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              {lead.jobTitle || "Sin cargo"}
              {lead.seniority && (
                <span className="text-xs">({lead.seniority})</span>
              )}
            </div>
            {lead.department && (
              <p className="text-xs text-muted-foreground pl-6">
                Depto: {lead.department}
              </p>
            )}
          </div>
        </div>

        {/* Company Info */}
        <div className="rounded border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-foreground">
            <Building2 className="mr-2 inline h-4 w-4" />
            {lead.company.name}
          </h2>
          <div className="space-y-2 text-sm">
            {lead.company.website && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Globe className="h-4 w-4" />
                <a
                  href={lead.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent"
                >
                  {lead.company.domain}
                </a>
              </div>
            )}
            {lead.company.country && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {lead.company.city
                  ? `${lead.company.city}, ${lead.company.country}`
                  : lead.company.country}
              </div>
            )}
            {lead.company.employeeCount && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                ~{lead.company.employeeCount.toLocaleString()} empleados
              </div>
            )}
            {lead.company.industry && (
              <p className="text-muted-foreground">
                Industria: {lead.company.industry}
              </p>
            )}
            {lead.company.annualRevenue && (
              <p className="text-muted-foreground">
                Revenue: {lead.company.annualRevenue}
              </p>
            )}
            {lead.company.description && (
              <p className="mt-2 text-xs text-muted-foreground">
                {lead.company.description}
              </p>
            )}
            {lead.company.technologies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {lead.company.technologies.slice(0, 10).map((tech) => (
                  <span
                    key={tech}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Research (placeholder for Phase 3) */}
        <div className="rounded border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-foreground">
            Investigación IA
          </h2>
          {lead.company.aiBrief ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">{lead.company.aiBrief}</p>
              {lead.company.aiPainPoints.length > 0 && (
                <div>
                  <p className="font-medium">Pain points:</p>
                  <ul className="ml-4 list-disc text-muted-foreground">
                    {lead.company.aiPainPoints.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lead.company.aiServiceMatch.length > 0 && (
                <div>
                  <p className="font-medium">Servicios KO relevantes:</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.company.aiServiceMatch.map((s) => (
                      <span
                        key={s}
                        className="rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              La investigación IA se ejecutará en la Fase 3 del pipeline.
            </p>
          )}
        </div>

        {/* Score */}
        <div className="rounded border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-foreground">
            Scoring
          </h2>
          {lead.aiRelevanceScore != null ? (
            <div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-4xl font-bold ${
                    lead.aiRelevanceScore >= 70
                      ? "text-green-600"
                      : lead.aiRelevanceScore >= 40
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {Math.round(lead.aiRelevanceScore)}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              {lead.aiScoreReasoning && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {lead.aiScoreReasoning}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              El scoring se ejecutará después de la investigación IA.
            </p>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      {lead.outreachActivities.length > 0 && (
        <div className="mt-6 rounded border border-border bg-background p-4">
          <h2 className="mb-3 font-semibold text-foreground">Actividad</h2>
          <div className="space-y-2">
            {lead.outreachActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 text-sm"
              >
                <span className="text-xs text-muted-foreground">
                  {new Date(activity.createdAt).toLocaleDateString("es-AR")}
                </span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">
                  {activity.type}
                </span>
                {activity.subject && (
                  <span className="text-muted-foreground">
                    {activity.subject}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
