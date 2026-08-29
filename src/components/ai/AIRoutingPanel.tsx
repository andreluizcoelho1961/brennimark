"use client";

import { platformIdentity } from "@/platform/identity";
import { useMemo, useState } from "react";
import {
  PROVIDERS,
  getModelCommercialInfo,
  requiresBillingConsent,
  type AIProvider,
  type AIRole,
  type AIRoutingFeature,
  type AIRoutingPolicy,
} from "@/lib/ai/provider";
import { useIsEnglish } from "@/platform/locale-client";


type AvailableSetting = {
  id: string;
  provider: AIProvider;
  model: string;
  role: AIRole;
  apiKeyLast4: string;
  isActive: boolean;
};

type Props = {
  settings: AvailableSetting[];
  policies: AIRoutingPolicy[];
  editable: boolean;
  onSave: (policy: AIRoutingPolicy) => Promise<{ ok: boolean; message?: string }>;
};

const FEATURE_COPY_POR_IDIOMA: Record<"en" | "pt-BR", Record<AIRoutingFeature, { title: string; description: string }>> = {
  en: {
      chat: { title: "Brand chat", description: `Answers grounded in ${platformIdentity.displayName} content.` },
      analysis: { title: "Application review", description: "Visual read and assessment of brand applications." },
  },
  "pt-BR": {
    chat: { title: "Chat da marca", description: `Respostas fundamentadas no conteúdo do ${platformIdentity.displayName}.` },
    analysis: { title: "Análise de peças", description: "Leitura visual e avaliação de aplicações da marca." },
  },
};

function providerLabel(provider: AIProvider) {
  return PROVIDERS.find((item) => item.value === provider)?.label ?? provider;
}

function RoutingCard({
  initial,
  settings,
  editable,
  onSave,
}: {
  initial: AIRoutingPolicy;
  settings: AvailableSetting[];
  editable: boolean;
  onSave: Props["onSave"];
}) {
  const isEnglish = useIsEnglish();
  const FEATURE_COPY = FEATURE_COPY_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const [primarySettingId, setPrimarySettingId] = useState(initial.primarySettingId ?? "");
  const [fallbackSettingId, setFallbackSettingId] = useState(initial.fallbackSettingId ?? "");
  const [timeoutSeconds, setTimeoutSeconds] = useState(initial.firstChunkTimeoutMs / 1_000);
  const [allowCrossProvider, setAllowCrossProvider] = useState(initial.allowCrossProvider);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [billingAuthorized, setBillingAuthorized] = useState(false);

  const eligible = useMemo(
    () => settings.filter((setting) => setting.isActive && (setting.role === initial.feature || setting.role === "both")),
    [initial.feature, settings]
  );
  const primary = eligible.find((setting) => setting.id === primarySettingId);
  const fallback = eligible.find((setting) => setting.id === fallbackSettingId);
  const isCrossProvider = Boolean(primary && fallback && primary.provider !== fallback.provider);
  const billableSettings = [primary, fallback].filter(
    (setting): setting is AvailableSetting => Boolean(setting && requiresBillingConsent(setting.provider, setting.model))
  );
  const requiresBillingAuthorization = billableSettings.length > 0;
  const timeoutIsValid = Number.isInteger(timeoutSeconds) && timeoutSeconds >= 3 && timeoutSeconds <= 60;
  const canSave = Boolean(
    editable && primary && timeoutIsValid && primarySettingId !== fallbackSettingId &&
      (!isCrossProvider || allowCrossProvider) && (!requiresBillingAuthorization || billingAuthorized)
  );

  function settingLabel(setting: AvailableSetting) {
    return `${providerLabel(setting.provider)} — ${setting.model} · •••• ${setting.apiKeyLast4}`;
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMessage("");
    const result = await onSave({
      feature: initial.feature,
      primarySettingId,
      fallbackSettingId: fallbackSettingId || null,
      firstChunkTimeoutMs: timeoutSeconds * 1_000,
      allowCrossProvider,
    });
    setSaving(false);
    setMessage(result.ok ? (isEnglish ? "Policy saved." : "Política salva.") : result.message ?? (isEnglish ? "Couldn't save." : "Não foi possível salvar."));
  }

  return (
    <section className="border border-border-default p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-black uppercase tracking-wide text-release-analog-white">
            {FEATURE_COPY[initial.feature].title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            {FEATURE_COPY[initial.feature].description}
          </p>
        </div>
        <span className="bg-release-analog-turquoise px-2 py-1 font-display text-[9px] font-black uppercase tracking-wide text-release-analog-black">
          {isEnglish ? "Independent feature" : "Recurso independente"}
        </span>
      </div>

      {eligible.length === 0 ? (
        <p className="mt-5 border-l-2 border-release-analog-blue pl-4 text-sm text-text-secondary">
          {isEnglish ? "Register and enable at least one connection for this feature." : "Cadastre e disponibilize ao menos uma conexão para este recurso."}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
              {isEnglish ? "Primary AI" : "IA principal"}
            </label>
            <select
              value={primarySettingId}
              onChange={(event) => {
                setPrimarySettingId(event.target.value);
                if (event.target.value === fallbackSettingId) setFallbackSettingId("");
                setBillingAuthorized(false);
                setMessage("");
              }}
              disabled={!editable}
              className="w-full border border-border-default bg-transparent px-3 py-3 text-xs text-release-analog-white focus:border-release-analog-white disabled:opacity-50"
            >
              <option value="" className="bg-surface-primary">{isEnglish ? "Select" : "Selecione"}</option>
              {eligible.map((setting) => (
                <option key={setting.id} value={setting.id} className="bg-surface-primary">
                  {settingLabel(setting)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
              {isEnglish ? "Fallback AI" : "IA de reserva"}
            </label>
            <select
              value={fallbackSettingId}
              onChange={(event) => {
                setFallbackSettingId(event.target.value);
                setBillingAuthorized(false);
                setMessage("");
              }}
              disabled={!editable || !primarySettingId}
              className="w-full border border-border-default bg-transparent px-3 py-3 text-xs text-release-analog-white focus:border-release-analog-white disabled:opacity-50"
            >
              <option value="" className="bg-surface-primary">{isEnglish ? "No fallback" : "Sem reserva"}</option>
              {eligible.filter((setting) => setting.id !== primarySettingId).map((setting) => (
                <option key={setting.id} value={setting.id} className="bg-surface-primary">
                  {settingLabel(setting)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block font-display text-[10px] font-bold uppercase tracking-wide text-text-secondary">
              {isEnglish ? "Maximum wait before switching" : "Espera máxima antes da troca"}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={3}
                max={60}
                step={1}
                value={timeoutSeconds}
                onChange={(event) => {
                  setTimeoutSeconds(Number(event.target.value));
                  setMessage("");
                }}
                disabled={!editable}
                className="w-24 border border-border-default bg-transparent px-3 py-3 text-sm text-release-analog-white focus:border-release-analog-white disabled:opacity-50"
              />
              <span className="text-xs text-text-secondary">{isEnglish ? "seconds (3–60)" : "segundos (3–60)"}</span>
            </div>
          </div>

          <div className="flex items-end">
            <label className={`flex gap-3 text-xs leading-relaxed ${isCrossProvider ? "text-release-analog-white" : "text-text-secondary"}`}>
              <input
                type="checkbox"
                checked={allowCrossProvider}
                onChange={(event) => {
                  setAllowCrossProvider(event.target.checked);
                  setMessage("");
                }}
                disabled={!editable || !isCrossProvider}
                className="mt-0.5 h-4 w-4 accent-release-analog-turquoise disabled:opacity-50"
              />
              <span>
                {isEnglish
                  ? "I authorize sending the request to another AI provider if the primary one fails or times out."
                  : "Autorizo enviar a solicitação a outra empresa de IA quando a principal falhar ou exceder o tempo."}
              </span>
            </label>
          </div>
        </div>
      )}

      {isCrossProvider && !allowCrossProvider && (
        <p className="mt-4 border-l-2 border-release-analog-blue pl-4 text-xs leading-relaxed text-text-secondary">
          {isEnglish ? "The fallback is from a different provider. Explicit authorization is required before saving." : "A reserva é de outro fornecedor. A autorização explícita é obrigatória antes de salvar."}
        </p>
      )}

      {requiresBillingAuthorization && (
        <div className="mt-5 border border-release-analog-blue p-4">
          <p className="font-display text-[10px] font-black uppercase tracking-wide text-release-analog-blue">
            {isEnglish ? "Usage may incur charges" : "Uso com possível cobrança"}
          </p>
          <div className="mt-2 space-y-2 text-xs leading-relaxed text-text-secondary">
            {billableSettings.map((setting) => {
              const info = getModelCommercialInfo(setting.provider, setting.model);
              return (
                <p key={setting.id}>
                  <span className="text-release-analog-white">{setting.model}:</span>{" "}
                  {info.pricing ?? info.note}
                </p>
              );
            })}
          </div>
          <label className="mt-4 flex gap-3 text-xs leading-relaxed text-release-analog-white">
            <input
              type="checkbox"
              checked={billingAuthorized}
              onChange={(event) => setBillingAuthorized(event.target.checked)}
              disabled={!editable}
              className="mt-0.5 h-4 w-4 accent-release-analog-turquoise"
            />
            <span>{isEnglish ? "I authorize this feature to use my account's credits when this model is invoked." : "Autorizo que este recurso use os créditos da minha conta quando esse modelo for acionado."}</span>
          </label>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving}
          className="bg-release-analog-turquoise px-5 py-2.5 font-display text-[10px] font-bold uppercase tracking-wide text-release-analog-black disabled:opacity-40"
        >
          {saving ? (isEnglish ? "Saving…" : "Salvando…") : (isEnglish ? "Save policy" : "Salvar política")}
        </button>
        {message && (
          <span className={`text-xs ${message === (isEnglish ? "Policy saved." : "Política salva.") ? "text-release-analog-turquoise" : "text-release-analog-blue"}`}>
            {message}
          </span>
        )}
      </div>
    </section>
  );
}

export function AIRoutingPanel({ settings, policies, editable, onSave }: Props) {
  const isEnglish = useIsEnglish();
  return (
    <div className="mt-16 border-t border-border-default pt-10">
      <p className="font-display text-xs font-bold uppercase tracking-wide text-release-analog-white">
        {isEnglish ? "Feature routing" : "Roteamento por recurso"}
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
        {isEnglish
          ? "Each feature can use a primary AI and a fallback. The switch only happens after the defined limit, and it never crosses providers without your authorization."
          : "Cada recurso pode usar uma IA principal e outra de reserva. A troca acontece apenas após o limite definido e nunca atravessa fornecedores sem sua autorização."}
      </p>
      <div className="mt-6 grid gap-5">
        {policies.map((policy) => (
          <RoutingCard
            key={`${policy.feature}-${policy.updatedAt ?? "default"}`}
            initial={policy}
            settings={settings}
            editable={editable}
            onSave={onSave}
          />
        ))}
      </div>
    </div>
  );
}
