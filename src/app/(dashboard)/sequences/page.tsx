"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Mail, Users, ChevronDown, ChevronUp } from "lucide-react";

type SequenceStep = {
  id: string;
  order: number;
  delayDays: number;
  subjectTemplate: string | null;
  bodyTemplate: string;
};

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  serviceContext: string | null;
  toneGuide: string | null;
  steps: SequenceStep[];
  _count: { enrollments: number };
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  useEffect(() => {
    loadSequences();
  }, []);

  async function loadSequences() {
    const res = await fetch("/api/sequences");
    setSequences(await res.json());
  }

  async function deleteSequence(id: string) {
    if (!confirm("¿Eliminar esta secuencia?")) return;
    await fetch(`/api/sequences/${id}`, { method: "DELETE" });
    loadSequences();
  }

  async function enrollApprovedLeads(sequenceId: string) {
    setEnrollingId(sequenceId);
    // Fetch all approved leads
    const res = await fetch("/api/leads?status=APPROVED&perPage=200");
    const data = await res.json();
    const leadIds = data.leads.map((l: { id: string }) => l.id);

    if (leadIds.length === 0) {
      alert("No hay leads aprobados para inscribir.");
      setEnrollingId(null);
      return;
    }

    if (!confirm(`¿Inscribir ${leadIds.length} leads aprobados en esta secuencia?`)) {
      setEnrollingId(null);
      return;
    }

    const enrollRes = await fetch(`/api/sequences/${sequenceId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadIds }),
    });
    const result = await enrollRes.json();
    alert(`${result.enrolled} leads inscriptos en la secuencia.`);
    setEnrollingId(null);
    loadSequences();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Secuencias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secuencias de email para outreach automatizado.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <Plus className="h-4 w-4" />
          Nueva secuencia
        </button>
      </div>

      {showForm && (
        <SequenceForm
          onSave={async (data) => {
            await fetch("/api/sequences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setShowForm(false);
            loadSequences();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="mt-6 space-y-4">
        {sequences.length === 0 && !showForm && (
          <div className="rounded border border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay secuencias. Creá una para empezar a enviar emails.
            </p>
          </div>
        )}

        {sequences.map((seq) => (
          <div key={seq.id} className="rounded border border-border bg-background">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{seq.name}</h3>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        seq.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {seq.isActive ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                    <span>{seq.steps.length} pasos</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {seq._count.enrollments} inscriptos
                    </span>
                    {seq.description && <span>{seq.description}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => enrollApprovedLeads(seq.id)}
                  disabled={enrollingId === seq.id || !seq.isActive || seq.steps.length === 0}
                  className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  {enrollingId === seq.id ? "Inscribiendo..." : "Inscribir leads"}
                </button>
                <button
                  onClick={() => deleteSequence(seq.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setExpandedId(expandedId === seq.id ? null : seq.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                >
                  {expandedId === seq.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedId === seq.id && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {seq.serviceContext && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Servicio:</strong> {seq.serviceContext}
                  </p>
                )}
                {seq.steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded border border-border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="rounded bg-muted px-2 py-0.5 font-medium">
                        Paso {step.order}
                      </span>
                      <span>
                        {step.order === 1
                          ? "Envío inmediato"
                          : `+${step.delayDays} día${step.delayDays !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    {step.subjectTemplate && (
                      <p className="text-xs font-medium text-foreground">
                        Subject: {step.subjectTemplate}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">
                      {step.bodyTemplate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SequenceForm({
  onSave,
  onCancel,
}: {
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [serviceContext, setServiceContext] = useState("");
  const [toneGuide, setToneGuide] = useState("");
  const [steps, setSteps] = useState([
    { subjectTemplate: "", bodyTemplate: "", delayDays: 0 },
  ]);

  function addStep() {
    setSteps([...steps, { subjectTemplate: "", bodyTemplate: "", delayDays: 3 }]);
  }

  function updateStep(index: number, field: string, value: string | number) {
    const next = [...steps];
    next[index] = { ...next[index], [field]: value };
    setSteps(next);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-4 rounded border border-border bg-background p-6">
      <h2 className="mb-4 text-lg font-semibold">Nueva secuencia</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Ej: Secuencia VTEX LATAM"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Descripción</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Servicio a promover (contexto para IA)
            </label>
            <input
              value={serviceContext}
              onChange={(e) => setServiceContext(e.target.value)}
              className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Ej: VTEX Commerce - migración y optimización"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Guía de tono (opcional)
            </label>
            <input
              value={toneGuide}
              onChange={(e) => setToneGuide(e.target.value)}
              className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="Ej: Directo, sin formalidades excesivas"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Pasos de la secuencia</label>
            <button
              onClick={addStep}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Plus className="h-3 w-3" />
              Agregar paso
            </button>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="rounded border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Paso {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">
                      Delay:
                      <input
                        type="number"
                        min={0}
                        value={step.delayDays}
                        onChange={(e) =>
                          updateStep(i, "delayDays", parseInt(e.target.value) || 0)
                        }
                        className="ml-1 w-12 rounded border border-border px-1 py-0.5 text-xs"
                      />
                      días
                    </label>
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(i)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  value={step.subjectTemplate}
                  onChange={(e) => updateStep(i, "subjectTemplate", e.target.value)}
                  className="block w-full rounded border border-border px-3 py-1.5 text-sm focus:border-accent focus:outline-none mb-2"
                  placeholder="Subject template (IA personaliza)"
                />
                <textarea
                  value={step.bodyTemplate}
                  onChange={(e) => updateStep(i, "bodyTemplate", e.target.value)}
                  rows={3}
                  className="block w-full rounded border border-border px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                  placeholder="Body template (IA personaliza basándose en el research del lead)"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() =>
              onSave({
                name,
                description,
                serviceContext,
                toneGuide,
                steps,
              })
            }
            disabled={!name || steps.some((s) => !s.bodyTemplate)}
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Crear secuencia
          </button>
          <button
            onClick={onCancel}
            className="rounded border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
