"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROVIDERS,
  PROVIDER_MODELS,
  getModelCommercialInfo,
  requiresBillingConsent,
  type AIProvider,
  type AIRole,
  type AIRoutingPolicy,
} from "@/lib/ai/provider";
import { AIRoutingPanel } from "@/components/ai/AIRoutingPanel";
import { useIsEnglish } from "@/platform/locale-client";
import { comAlvo, useAlvo } from "@/platform/alvo-client";


type StoredAISetting = {
  id: string;
  provider: AIProvider;
  model: string;
  role: AIRole;
  apiKeyLast4: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const ROLE_LABEL_POR_IDIOMA = {
  en: { chat: "Chat", analysis: "Review", both: "Chat + Review" },
  "pt-BR": { chat: "Chat", analysis: "Análise", both: "Chat + Análise" },
} satisfies Record<string, Record<AIRole, string>>;

function DemoBadge({ role, settings }: { role: "chat" | "analysis"; settings: StoredAISetting[] }) {
  const isEnglish = useIsEnglish();
  const hasActive = settings.some((s) => s.isActive && (s.role === role || s.role === "both"));
  if (hasActive) return null;
  const roleLabel = isEnglish ? (role === "chat" ? "Chat" : "Review") : (role === "chat" ? "Chat" : "Análise");
  return (
    <span className="inline-flex items-center gap-2 border border-platform-border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-platform-panel-muted" />
      {isEnglish
        ? `${roleLabel} in demo mode (shared Groq) — request limits may apply`
        : `${roleLabel} em modo demo (Groq compartilhado) — limites de requisição podem se aplicar`}
    </span>
  );
}

async function buscarConfiguracoes(alvo: { workspaceSlug?: string; brandKey?: string }) {
  const [settingsRes, routingRes] = await Promise.all([
    fetch(comAlvo("/api/ai/settings", alvo)),
    fetch(comAlvo("/api/ai/routing", alvo)),
  ]);
  const [settingsData, routingData] = await Promise.all([settingsRes.json(), routingRes.json()]);
  return {
    settings: (settingsData.settings ?? []) as StoredAISetting[],
    policies: (routingData.policies ?? []) as AIRoutingPolicy[],
    editable: Boolean(routingData.editable),
  };
}

export default function AISettingsPage() {
  // A marca em que esta tela opera, vinda da URL. Sem ela o servidor não
  // saberia qual, e responderia 409 numa conta com mais de uma.
  const alvo = useAlvo();
  const isEnglish = useIsEnglish();
  const ROLE_LABEL = ROLE_LABEL_POR_IDIOMA[isEnglish ? "en" : "pt-BR"];
  const [settings, setSettings] = useState<StoredAISetting[]>([]);
  const [policies, setPolicies] = useState<AIRoutingPolicy[]>([]);
  const [routingEditable, setRoutingEditable] = useState(false);
  /**
   * Nada de `setLoading` dentro de efeito.
   *
   * O carregando é DERIVADO: a tela está carregando enquanto os dados que ela
   * tem não são os da marca atual. Isso resolve de uma vez as duas falhas que
   * um booleano comandado produz aqui — não mostra as configurações da marca
   * anterior enquanto a nova chega, e não dispara render em cascata a partir
   * do efeito.
   */
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);

  const [provider, setProvider] = useState<AIProvider>("groq");
  const [model, setModel] = useState(PROVIDER_MODELS.groq[0]);
  const [apiKey, setApiKey] = useState("");
  const [role, setRole] = useState<AIRole>("chat");
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [billingAuthorized, setBillingAuthorized] = useState(false);

  const needsBillingAuthorization = requiresBillingConsent(provider, model);
  const commercialInfo = getModelCommercialInfo(provider, model);
  const canUseModel = !needsBillingAuthorization || billingAuthorized;
  const canSave = testState === "ok" && canUseModel;

  // `refresh` fechou sobre o alvo: memorizada por ele, e o efeito depende
  // dela. Sem isso, trocar de marca deixaria a tela mostrando as
  // configurações de IA da marca anterior.
  const chaveDoAlvo = `${alvo.workspaceSlug ?? ""}/${alvo.brandKey ?? ""}`;
  const loading = carregadoPara !== chaveDoAlvo;

  const refresh = useCallback(async () => {
    const dados = await buscarConfiguracoes(alvo);
    setSettings(dados.settings);
    setPolicies(dados.policies);
    setRoutingEditable(dados.editable);
    setCarregadoPara(chaveDoAlvo);
  }, [alvo, chaveDoAlvo]);

  /**
   * A busca inicial, e de novo a cada troca de marca.
   *
   * O `cancelado` não é zelo: trocar de marca duas vezes rápido faz duas
   * buscas, e a primeira pode responder depois da segunda. Sem a guarda, a
   * tela terminaria mostrando as configurações da marca que a pessoa acabou
   * de deixar — com o nome da marca nova no cabeçalho.
   */
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const dados = await buscarConfiguracoes(alvo);
      if (cancelado) return;
      setSettings(dados.settings);
      setPolicies(dados.policies);
      setRoutingEditable(dados.editable);
      setCarregadoPara(chaveDoAlvo);
    })();
    return () => {
      cancelado = true;
    };
  }, [alvo, chaveDoAlvo]);

  async function handleSaveRouting(policy: AIRoutingPolicy) {
    const res = await fetch(comAlvo("/api/ai/routing", alvo), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPolicies(data.policies ?? policies);
      return { ok: true };
    }
    const messages: Record<string, string> = isEnglish
      ? {
          cross_provider_consent_required: "Authorize switching providers to use this fallback.",
          invalid_setting_for_feature: "One of the connections isn't available for this feature.",
          not_authenticated: "Sign in to save this setting.",
        }
      : {
          cross_provider_consent_required: "Autorize a troca entre fornecedores para usar esta reserva.",
          invalid_setting_for_feature: "Uma das conexões não está disponível para este recurso.",
          not_authenticated: "Entre na sua conta para salvar esta configuração.",
        };
    return { ok: false, message: messages[data.error] ?? (isEnglish ? "Couldn't save the policy." : "Não foi possível salvar a política.") };
  }

  function handleProviderChange(next: AIProvider) {
    setProvider(next);
    setModel(PROVIDER_MODELS[next][0]);
    setTestState("idle");
    setBillingAuthorized(false);
  }

  function markDirty() {
    if (testState !== "idle") {
      setTestState("idle");
      setTestMessage("");
    }
  }

  async function handleTest() {
    if (!canUseModel) return;
    setTestState("testing");
    setTestMessage("");
    try {
      const res = await fetch(comAlvo("/api/ai/test-connection", alvo), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestState("ok");
      } else {
        setTestState("error");
        setTestMessage(data.message ?? (isEnglish ? "Failed to connect." : "Falha ao conectar."));
      }
    } catch {
      setTestState("error");
      setTestMessage(isEnglish ? "Network failure while testing the connection." : "Falha de rede ao testar a conexão.");
    }
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(comAlvo("/api/ai/settings", alvo), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model, apiKey, role }),
    });
    setSaving(false);
    if (res.ok) {
      setApiKey("");
      setTestState("idle");
      await refresh();
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    await fetch(comAlvo(`/api/ai/settings/${id}`, alvo), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    await refresh();
  }

  async function handleDelete(id: string) {
    await fetch(comAlvo(`/api/ai/settings/${id}`, alvo), { method: "DELETE" });
    await refresh();
  }

  const models = useMemo(() => PROVIDER_MODELS[provider], [provider]);

  return (
    <article className="px-page-inline py-12 md:py-16">
      <div className="max-w-3xl">
        <div className="mb-6 inline-flex w-fit items-center gap-3 bg-platform-signal px-4 py-1.5">
          <span className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-platform-bg">
            {isEnglish ? "Settings" : "Configurações"}
          </span>
        </div>

        <h1
          className="break-words font-display font-black uppercase leading-[0.9] tracking-tight text-platform-text"
          style={{ fontSize: "clamp(2rem, 4.5vw, 4rem)", overflowWrap: "anywhere" }}
        >
          {isEnglish ? <>Connect Your <span className="text-platform-text">AI</span></> : <>Conecte sua <span className="text-platform-text">IA</span></>}
        </h1>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-platform-text-muted">
          {isEnglish
            ? "Configure your own API key for the brand chat and application review. Without configuration, the app uses a shared demo provider (Groq) with request limits."
            : "Configure sua própria chave de API para o chat da marca e a análise de aplicações. Sem configuração, o app usa um provedor compartilhado de demonstração (Groq) com limites de requisição."}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {!loading && <DemoBadge role="chat" settings={settings} />}
          {!loading && <DemoBadge role="analysis" settings={settings} />}
        </div>

        {/* Existing configs */}
        <div className="mt-12 border-l-2 border-platform-signal pl-8">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-platform-text">
            {isEnglish ? "Saved settings" : "Configurações salvas"}
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-platform-text-muted">{isEnglish ? "Loading…" : "Carregando…"}</p>
          ) : settings.length === 0 ? (
            <p className="mt-4 text-sm text-platform-text-muted">{isEnglish ? "No settings saved yet." : "Nenhuma configuração salva ainda."}</p>
          ) : (
            <ul className="mt-4 divide-y divide-platform-border border-t border-platform-border">
              {settings.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-sm text-platform-text">
                      {PROVIDERS.find((p) => p.value === s.provider)?.label ?? s.provider}{" "}
                      <span className="text-platform-text-muted">— {s.model}</span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-platform-text-muted">
                      •••• {s.apiKeyLast4} · {ROLE_LABEL[s.role]}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(s.id, !s.isActive)}
                      className={`font-display text-[10px] font-bold uppercase tracking-wide ${
                        s.isActive ? "text-platform-text" : "text-platform-text-muted hover:text-platform-text"
                      }`}
                    >
                      {s.isActive ? (isEnglish ? "Available" : "Disponível") : (isEnglish ? "Enable" : "Disponibilizar")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="font-display text-[10px] font-bold uppercase tracking-wide text-platform-text-muted hover:text-platform-text"
                    >
                      {isEnglish ? "Remove" : "Remover"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!loading && (
          <AIRoutingPanel
            settings={settings}
            policies={policies}
            editable={routingEditable}
            onSave={handleSaveRouting}
          />
        )}

        {/* New config form */}
        <div className="mt-16 border-t border-platform-border pt-10">
          <p className="font-display text-xs font-bold uppercase tracking-wide text-platform-text">
            {isEnglish ? "New setting" : "Nova configuração"}
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">
                {isEnglish ? "Provider" : "Provedor"}
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text focus:border-platform-signal"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value} className="bg-platform-panel">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">
                {isEnglish ? "Model" : "Modelo"}
              </label>
              <input
                list={`models-${provider}`}
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setBillingAuthorized(false);
                  markDirty();
                }}
                placeholder={provider === "openrouter" ? "author/model:free" : (isEnglish ? "Choose or enter a model" : "Escolha ou informe o modelo")}
                className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text focus:border-platform-signal"
              />
              <datalist id={`models-${provider}`}>
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {provider === "openrouter" && (
                <p className="mt-2 text-[11px] leading-relaxed text-platform-text-muted">
                  {isEnglish ? "Choose a suggestion or enter any current OpenRouter identifier." : "Escolha uma sugestão ou informe qualquer identificador atual da OpenRouter."}
                </p>
              )}
              <div className={`mt-3 border-l-2 pl-3 text-[11px] leading-relaxed ${commercialInfo.billing === "free" ? "border-platform-signal text-platform-text-muted" : "border-platform-border text-platform-text-muted"}`}>
                <p className="font-display font-bold uppercase tracking-wide text-platform-text">{commercialInfo.label}</p>
                {commercialInfo.pricing && <p className="mt-1">{commercialInfo.pricing}</p>}
                {commercialInfo.note && <p className="mt-1">{commercialInfo.note}</p>}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">
                {isEnglish ? "API key" : "Chave de API"}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  markDirty();
                }}
                autoComplete="off"
                placeholder="sk-…"
                className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text focus:border-platform-signal"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-platform-text-muted">
                {isEnglish ? "Authorized features" : "Recursos autorizados"}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AIRole)}
                className="w-full border border-platform-border bg-transparent px-4 py-3 text-sm text-platform-text focus:border-platform-signal"
              >
                <option value="chat" className="bg-platform-panel">Chat</option>
                <option value="analysis" className="bg-platform-panel">{isEnglish ? "Review" : "Análise"}</option>
                <option value="both" className="bg-platform-panel">{isEnglish ? "Chat + Review" : "Chat + Análise"}</option>
              </select>
            </div>
          </div>

          {needsBillingAuthorization && (
            <label className="mt-6 flex max-w-2xl gap-3 border border-platform-border p-4 text-xs leading-relaxed text-platform-text">
              <input
                type="checkbox"
                checked={billingAuthorized}
                onChange={(event) => setBillingAuthorized(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-platform-signal"
              />
              <span>
                {isEnglish
                  ? "I understand that testing and using this model may consume credits on my account. Saving the connection doesn't automatically change the primary AI; activation happens in the feature's routing policy."
                  : "Entendo que testar e usar este modelo pode consumir créditos da minha conta. Salvar a conexão não altera automaticamente a IA principal; a ativação é feita na política do recurso."}
              </span>
            </label>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleTest}
              disabled={!apiKey || !canUseModel || testState === "testing"}
              className="border border-platform-signal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-platform-text transition-colors duration-150 hover:bg-platform-text hover:text-platform-bg disabled:opacity-40"
            >
              {testState === "testing" ? (isEnglish ? "Testing…" : "Testando…") : (isEnglish ? "Test connection" : "Testar conexão")}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-platform-signal px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-platform-bg transition-opacity duration-150 disabled:opacity-40"
            >
              {saving ? (isEnglish ? "Saving…" : "Salvando…") : (isEnglish ? "Save" : "Salvar")}
            </button>

            {testState === "ok" && (
              <span className="font-display text-xs font-bold uppercase tracking-wide text-platform-text">
                {isEnglish ? "Connection verified" : "Conexão validada"}
              </span>
            )}
            {testState === "error" && (
              <span className="text-sm text-platform-text-muted">{testMessage}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
