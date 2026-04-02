"use client";

import { useEffect, useState } from "react";

type OrgSettings = {
  apolloApiKey: string;
  hubspotAccessToken: string;
  icommApiKey: string;
  icommSmtpHost: string;
  icommSmtpPort: string;
  icommSmtpUser: string;
  icommSmtpPass: string;
  anthropicApiKey: string;
  emailDomain: string;
  phantombusterApiKey: string;
  phantombusterConnectAgentId: string;
  phantombusterMessageAgentId: string;
  requireLeadApproval: boolean;
  requireMessageApproval: boolean;
  autoApproveThreshold: number | null;
  maxLeadsPerRun: number;
  gmailAccounts: Array<{ id: string; email: string; isActive: boolean }>;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load settings");
        return r.json();
      })
      .then(setSettings)
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    if (res.ok) {
      setMessage("Guardado correctamente");
    } else {
      setMessage("Error al guardar");
    }
    setSaving(false);
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configuración de integraciones y API keys.
      </p>

      <form onSubmit={handleSave} className="mt-6 max-w-2xl space-y-8">
        <Section title="Apollo.io">
          <Field
            label="API Key"
            type="password"
            value={settings.apolloApiKey}
            onChange={(v) => setSettings({ ...settings, apolloApiKey: v })}
          />
        </Section>

        <Section title="HubSpot">
          <Field
            label="Access Token"
            type="password"
            value={settings.hubspotAccessToken}
            onChange={(v) => setSettings({ ...settings, hubspotAccessToken: v })}
          />
        </Section>

        <Section title="Gmail (Email Outreach)">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Conectá cuentas de Google Workspace para enviar emails directamente desde Gmail.
              Los emails se ven naturales y aparecen en la bandeja de enviados.
            </p>
            <div className="space-y-2 mb-3">
              {(settings.gmailAccounts || []).map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between rounded border border-border p-2 text-sm"
                >
                  <span className="font-mono text-xs">{acc.email}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      acc.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {acc.isActive ? "Conectada" : "Inactiva"}
                  </span>
                </div>
              ))}
              {(settings.gmailAccounts || []).length === 0 && (
                <p className="text-xs text-muted-foreground">No hay cuentas conectadas.</p>
              )}
            </div>
            <a
              href="/api/auth/gmail"
              className="inline-flex items-center gap-2 rounded bg-foreground px-3 py-2 text-sm font-medium text-background hover:bg-foreground/90"
            >
              + Conectar cuenta de Gmail
            </a>
          </div>
        </Section>

        <Section title="PhantomBuster (LinkedIn)">
          <Field
            label="API Key"
            type="password"
            value={settings.phantombusterApiKey}
            onChange={(v) => setSettings({ ...settings, phantombusterApiKey: v })}
          />
          <Field
            label="Agent ID - LinkedIn Auto Connect"
            value={settings.phantombusterConnectAgentId}
            onChange={(v) => setSettings({ ...settings, phantombusterConnectAgentId: v })}
            placeholder="ID del Phantom de conexión"
          />
          <Field
            label="Agent ID - LinkedIn Message Sender"
            value={settings.phantombusterMessageAgentId}
            onChange={(v) => setSettings({ ...settings, phantombusterMessageAgentId: v })}
            placeholder="ID del Phantom de mensajes"
          />
        </Section>

        <Section title="Anthropic (Claude)">
          <Field
            label="API Key"
            type="password"
            value={settings.anthropicApiKey}
            onChange={(v) => setSettings({ ...settings, anthropicApiKey: v })}
          />
        </Section>

        <Section title="Discovery">
          <div>
            <label className="block text-sm font-medium text-foreground">
              Máximo de leads a enriquecer por Discovery Run
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={500}
                value={settings.maxLeadsPerRun}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxLeadsPerRun: parseInt(e.target.value) || 10,
                  })
                }
                className="w-24 rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
              <span className="text-sm text-muted-foreground">leads</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada lead enriquecido consume 1 crédito de Apollo. Usar valores bajos para testing.
            </p>
          </div>
        </Section>

        <Section title="Aprobación">
          <Toggle
            label="Requiere aprobación de leads"
            description="El CCO debe aprobar cada lead antes de iniciar outreach"
            checked={settings.requireLeadApproval}
            onChange={(v) => setSettings({ ...settings, requireLeadApproval: v })}
          />
          <Toggle
            label="Requiere aprobación de mensajes"
            description="El CCO debe aprobar cada email antes de enviarlo"
            checked={settings.requireMessageApproval}
            onChange={(v) => setSettings({ ...settings, requireMessageApproval: v })}
          />
        </Section>

        <Section title="Modo Autónomo">
          <div>
            <label className="block text-sm font-medium text-foreground">
              Auto-aprobar leads con score mayor o igual a:
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={100}
                value={settings.autoApproveThreshold ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    autoApproveThreshold: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-24 rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                placeholder="—"
              />
              <span className="text-sm text-muted-foreground">/ 100</span>
              {settings.autoApproveThreshold && (
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, autoApproveThreshold: null })}
                  className="text-xs text-red-500 hover:underline"
                >
                  Desactivar
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {settings.autoApproveThreshold
                ? `Leads con score >= ${settings.autoApproveThreshold} se aprueban automáticamente sin pasar por la cola.`
                : "Desactivado. Todos los leads pasan por la cola de aprobación."}
            </p>
          </div>
        </Section>

        <ChangePasswordSection />

        {message && (
          <p className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-background p-4">
      <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          } mt-0.5`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus({ msg: "Contraseña actualizada", ok: true });
      setCurrent("");
      setNewPwd("");
    } else {
      setStatus({ msg: data.error, ok: false });
    }
    setSaving(false);
  }

  return (
    <Section title="Cambiar contraseña">
      <form onSubmit={handleChange} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Contraseña actual</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="mt-1 block w-full max-w-sm rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Nueva contraseña</label>
          <input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="mt-1 block w-full max-w-sm rounded border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        {status && (
          <p className={`text-sm ${status.ok ? "text-green-600" : "text-red-600"}`}>
            {status.msg}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || !current || !newPwd}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </Section>
  );
}
