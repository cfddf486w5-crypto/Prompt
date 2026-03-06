// Prompt Factory — Prompt XL “Félix l’extraordinaire”
// Offline-first, stockage local uniquement.

const SCHEMA_VERSION = 3;
const EXPORT_VERSION = 2;
const APP_NAME = "Prompt Factory XL";

const LS_KEYS = {
  schema: "pb_schema_version",
  state: "pb_state_v3",
  settings: "pb_settings_v1",
  templates: "pb_templates_v1",
  history: "pb_history_v1",
  packs: "pb_packs_v1",
  draft: "pb_draft_v1"
};

const FEATURE_DEFAULTS = {
  soraStudio: true,
  codexPro: true,
  analyzer: true,
  projects: true,
  debug: false
};

const LIMITS = {
  globalHistory: 200,
  projectHistory: 200,
  searchDebounceMs: 200
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  templates: [],
  packs: [],
  settings: null,
  appState: null,
  analysis: null,
  activeTemplateId: "",
  activeProjectId: "general",
  soraShots: [],
  pendingImportPayload: null,
  activePackFilter: "all",
  iaDraft: null
};


const iaEngine = (typeof PromptEngine !== "undefined" && PromptEngine) ? PromptEngine : null;

function loadIaDraft() {
  return safeJSONParse(localStorage.getItem(LS_KEYS.draft), null);
}

function saveIaDraft(draft) {
  if (!draft) return;
  localStorage.setItem(LS_KEYS.draft, JSON.stringify(draft));
}

function activeIaDraft() {
  return state.iaDraft || loadIaDraft();
}

function iaConversationState() {
  if (!iaEngine) return null;
  const fallback = iaEngine.createConversationState("");
  const draft = activeIaDraft();
  return draft && draft.structuredPrompt ? draft : fallback;
}

function renderIaConversation(conversation) {
  const wrap = $("#iaConversation");
  if (!wrap || !conversation) return;
  wrap.innerHTML = "";
  (conversation.messages || []).forEach((msg) => {
    const div = document.createElement("div");
    div.className = `ia-msg ${msg.role === "user" ? "user" : "assistant"}`;
    div.textContent = msg.text;
    wrap.appendChild(div);
  });
}

function renderIaRecommendations() {
  const wrap = $("#iaRecommendations");
  if (!wrap || !iaEngine) return;
  const brief = $("#iaBrief")?.value || "";
  let conversation = iaConversationState();

  if (!conversation || !(conversation.messages || []).length) {
    conversation = iaEngine.createConversationState(brief);
    if (brief) conversation = iaEngine.continueConversation(conversation, brief);
  } else if (brief) {
    conversation = iaEngine.continueConversation(conversation, brief);
  }

  conversation.structuredPrompt.toolTarget = $("#iaMode")?.value || conversation.structuredPrompt.toolTarget;
  conversation.structuredPrompt.levelOfDetail = $("#iaDepth")?.value || conversation.structuredPrompt.levelOfDetail;
  conversation.structuredPrompt.missingFields = iaEngine.computeMissingFields(conversation.structuredPrompt);
  conversation.maturity = iaEngine.maturityFromMissing(conversation.structuredPrompt.missingFields);

  state.iaDraft = conversation;
  saveIaDraft(conversation);

  renderIaConversation(conversation);

  wrap.innerHTML = "";
  const q = document.createElement("div");
  q.className = "item";
  q.innerHTML = `<div class="item-title">Question suivante</div><div class="item-meta">${escapeHtml(conversation.nextQuestion?.question || "Aucune question bloquante")}</div>`;
  wrap.appendChild(q);

  (conversation.suggestions || []).forEach((text) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<div class="item-title">Suggestion intelligente</div><div class="item-meta">${escapeHtml(text)}</div>`;
    wrap.appendChild(item);
  });

  const collected = $("#iaCollected");
  if (collected) collected.textContent = JSON.stringify(conversation.structuredPrompt, null, 2);
  const missing = $("#iaMissing");
  if (missing) missing.textContent = conversation.structuredPrompt.missingFields.length ? conversation.structuredPrompt.missingFields.join(", ") : "Aucune information critique manquante.";
  const label = $("#iaMaturityLabel");
  if (label) label.textContent = `${conversation.maturity.label} (${conversation.maturity.score}%)`;
  const bar = $("#iaMaturityBar");
  if (bar) bar.style.width = `${conversation.maturity.score}%`;
}

function generateIaPrompt(variant) {
  if (!iaEngine) return;
  const conversation = iaConversationState();
  if (!conversation) return;

  conversation.structuredPrompt.toolTarget = $("#iaMode")?.value || conversation.structuredPrompt.toolTarget;
  conversation.structuredPrompt.levelOfDetail = $("#iaDepth")?.value || conversation.structuredPrompt.levelOfDetail;
  const finalized = iaEngine.generateFinalPromptSet(conversation);

  const version = variant || "detailed";
  const map = {
    short: finalized.finalVariants.short,
    detailed: finalized.finalVariants.detailed,
    ultra: finalized.finalVariants.ultra
  };

  finalized.finalPrompt = map[version] || finalized.finalVariants.detailed;
  state.iaDraft = finalized;
  saveIaDraft(finalized);
  $("#iaFinalPrompt").value = finalized.finalPrompt;
  renderIaRecommendations();
}
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function safeJSONParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function quickHash(input) {
  const text = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `h${(h >>> 0).toString(16)}`;
}

function debounce(fn, ms = LIMITS.searchDebounceMs) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function normalizeSpaces(s) {
  return String(s || "").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

let toastTimer;

function dbg(...args) {
  if (state.settings?.features?.debug) console.log("[PromptFactory]", ...args);
}

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function defaultSettings() {
  return {
    defaultType: "codex",
    vars: { LIEU: "", SUJET: "", STYLE: "", DUREE: "", FORMAT: "", CONTRAINTES: "" },
    features: { ...FEATURE_DEFAULTS },
    debugLogs: false,
    historyCaps: { global: LIMITS.globalHistory, project: LIMITS.projectHistory }
  };
}

function makeGeneralProject() {
  return {
    id: "general",
    name: "Général",
    description: "Projet par défaut",
    templateOverrides: [],
    history: [],
    vars: {},
    soraPresets: []
  };
}

function defaultAppState() {
  return {
    projects: [makeGeneralProject()],
    activeProjectId: "general",
    globalHistory: []
  };
}

function baseCodexBody(title) {
  return `RÔLE\nTu es un ingénieur logiciel senior orienté patch incrémental.\n\nOBJECTIF\n${title}\n{GOAL}\n\nCONTEXTE\n{CONTEXT}\n\nENTRÉES\n{INPUTS}\n\nCONTRAINTES\n{RULES}\n- Ne pas toucher le UI existant\n- Aucune dépendance externe\n- Offline-first\n\nPLAN\n{STEPS}\n1) mini spec\n2) plan patch\n3) implémentation\n4) validation\n\nSORTIE\ncode complet des fichiers modifiés seulement.`;
}

function baseSoraBody(title, biome, mood) {
  return `OBJECTIF VIDÉO\n${title}\n\nSUJET\n{SUJET}\n\nDÉCOR\n${biome}\n\nMOOD\n${mood}\n\nSTYLE\n{STYLE}\n\nCONTRAINTES\n{CONTRAINTES}\n\nDO\n- continuité visuelle\n- lumière cohérente\n\nDON'T\n- no text\n- no watermark\n- no glitch`;
}

function buildDefaultTemplates() {
  const codexUseCases = [
    "Audit sécurité et corrections ciblées",
    "Refactorisation modulaire progressive",
    "Optimisation des performances UI et JS",
    "Ajout d'un mode hors-ligne robuste",
    "Migration de schéma localStorage",
    "Renforcement de la gestion d'erreurs",
    "Nettoyage dette technique prioritaire",
    "Ajout d'un système de permissions",
    "Automatisation des validations manuelles",
    "Stabilisation des flux asynchrones",
    "Consolidation des règles métier",
    "Patch de régression post-release",
    "Amélioration de l'accessibilité a11y",
    "Internationalisation et support i18n",
    "Journalisation et observabilité locale",
    "Gestion avancée des états UI",
    "Sécurisation des entrées utilisateur",
    "Rationalisation des dépendances internes",
    "Implémentation d'un mode projet",
    "Sauvegarde/restauration de configuration",
    "Fiabilisation de l'import/export JSON",
    "Qualité et cohérence du code existant",
    "Préparation d'une livraison incrémentale",
    "Maintenance corrective multi-plateforme",
    "Hardening final avant mise en prod"
  ];

  const codex = codexUseCases.map((useCase, i) => ({
    id: `codex_tpl_${i + 1}`,
    name: `Codex — ${useCase}`,
    tags: ["codex", "pro", "patch"],
    notes: "Template détaillé pour livraison patchée.",
    example: "Ex: ajouter mode projet sans casser l'existant.",
    body: baseCodexBody(useCase)
  }));

  const soraThemes = [
    ["Landscape cinématique grand angle", "landscape"],
    ["Romance intimiste au coucher du soleil", "romance"],
    ["Action dynamique en mouvement", "action"],
    ["Aurores boréales contemplatives", "aurora"],
    ["Fjord épique avec travelling drone", "fjord"],
    ["Désert dramatique et lumière chaude", "désert"],
    ["Forêt immersive avec brume légère", "forêt"],
    ["Océan puissant et horizon ouvert", "océan"],
    ["Lac calme et ambiance poétique", "lac"],
    ["Toundra minimaliste et vent froid", "toundra"],
    ["City night néons et pluie urbaine", "city night"],
    ["Glacier monumental hyper réaliste", "glacier"],
    ["Scène sous pluie fine cinématographique", "pluie"],
    ["Paysage enneigé au rendu premium", "neige"],
    ["Golden hour lumineux et chaleureux", "golden hour"],
    ["Brume dense style mystère", "fog"],
    ["Tempête dramatique haute intensité", "storm"],
    ["Campfire cozy ambiance nocturne", "campfire"],
    ["Drone reveal spectaculaire", "drone"],
    ["Roadtrip émotionnel en tracking", "roadtrip"],
    ["Falaises vertigineuses et vagues", "falaises"],
    ["Montagne héroïque panoramique", "montagne"],
    ["Cozy naturel doux et chaleureux", "cozy"],
    ["Cinema look premium narratif", "cinema"],
    ["Wildlife immersif style documentaire", "wildlife"]
  ];
  const sora = soraThemes.map(([label, theme], i) => ({
    id: `sora_tpl_${i + 1}`,
    name: `Sora — ${label}`,
    tags: ["sora", "video", theme],
    notes: "Template orienté cohérence et qualité image.",
    example: "Ex: clip 15s 16:9 pour Sora.",
    body: baseSoraBody(label, theme, i % 2 ? "epic" : "romantic")
  }));

  return [
    { id: "tpl_codex_strict_ui", name: "Codex — Ajout sans toucher au UI", tags: ["codex", "safe"], body: baseCodexBody("Ajout sans toucher UI") },
    { id: "sora_studio_auto", name: "Sora Studio (auto)", tags: ["sora", "auto"], body: "{SORA_STUDIO_PROMPT}" },
    ...codex,
    ...sora
  ];
}

function buildDefaultPacks() {
  const groups = [
    ["anti", "Sora anti-artefacts", "no text, no watermark, no glitch, no distortion"],
    ["cam", "Caméra / lens / lumière", "24mm, dolly smooth, golden hour, realistic shadows"],
    ["shot", "Shotlist squelette", "Plan 1 establishing; Plan 2 medium; Plan 3 hero shot"],
    ["qa", "Codex QA checklist", "imports, edge cases, migration, tests manuels"],
    ["dod", "DoD", "critères acceptation validés, backward compat ok"],
    ["risk", "Risks & mitigations", "Risque: ... / Mitigation: ..."]
  ];
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    groups.forEach(([g, label, text], idx) => {
      items.push({ id: `${g}_${i}_${idx}`, label: `${label} #${i + 1}`, text, tags: [g] });
    });
  }
  return items;
}

const SORA_PRESETS = [
  ["overland forêt/lac", "forêt", "clear", "golden hour", "24mm", "drone", "awe"],
  ["bord de mer + falaises", "océan", "wind", "blue hour", "35mm", "drone", "epic"],
  ["montagne + neige", "montagne", "snow", "overcast", "50mm", "crane", "epic"],
  ["nuit étoilée + aurore", "toundra", "clear", "night", "24mm", "timelapse", "mysterious"],
  ["pluie fine + route", "route", "rain", "overcast", "35mm", "tracking", "romantic"],
  ["glacier + brume", "glacier", "fog", "blue hour", "24mm", "drone", "awe"],
  ["désert dunes", "désert", "clear", "golden hour", "24mm", "dolly", "epic"],
  ["fjord drone", "fjord", "wind", "blue hour", "24mm", "drone", "awe"],
  ["toundra vent", "toundra", "wind", "overcast", "35mm", "steadycam", "mysterious"],
  ["forêt ancestrale + rayons", "forêt", "fog", "morning", "35mm", "dolly", "awe"],
  ["océan tempête lointaine", "océan", "storm", "overcast", "50mm", "drone", "epic"],
  ["romance dance under aurora", "toundra", "clear", "night", "35mm", "steadycam", "romantic"],
  ["roadtrip golden hour", "route", "clear", "golden hour", "24mm", "tracking", "awe"],
  ["foggy morning lake", "lac", "fog", "morning", "35mm", "crane", "calm"],
  ["storm clearing rainbow", "vallée", "rain", "sunbreak", "35mm", "drone", "hopeful"],
  ["arctic coastline + icebergs", "arctique", "clear", "blue hour", "24mm", "drone", "mysterious"],
  ["city night neon", "ville", "clear", "night", "50mm", "steadycam", "urban"],
  ["cozy campfire wide", "forêt", "clear", "night", "24mm", "static", "cozy"]
].map((p, i) => ({ id: `sp_${i + 1}`, name: p[0], biome: p[1], weather: p[2], lighting: p[3], lens: p[4], move: p[5], mood: p[6] }));

function backupLocalStorage(label = "migration") {
  const dump = {};
  Object.keys(localStorage).forEach((k) => {
    dump[k] = localStorage.getItem(k);
  });
  const key = `pb_backup_${label}_${new Date().toISOString().replace(/[:.]/g, "-")}`;
  localStorage.setItem(key, JSON.stringify(dump));
}

function migrateToV3() {
  const oldSettings = safeJSONParse(localStorage.getItem(LS_KEYS.settings), defaultSettings());
  const oldTemplates = safeJSONParse(localStorage.getItem(LS_KEYS.templates), []);
  const oldHistory = safeJSONParse(localStorage.getItem(LS_KEYS.history), []);
  const oldPacks = safeJSONParse(localStorage.getItem(LS_KEYS.packs), []);
  const appState = defaultAppState();
  if (Array.isArray(oldHistory) && oldHistory.length) {
    appState.projects[0].history = oldHistory.slice(0, LIMITS.projectHistory);
  }
  const mergedSettings = {
    ...defaultSettings(),
    ...oldSettings,
    vars: { ...defaultSettings().vars, ...(oldSettings?.vars || {}) },
    features: { ...FEATURE_DEFAULTS, ...(oldSettings?.features || {}) }
  };
  const data = {
    settings: mergedSettings,
    templates: Array.isArray(oldTemplates) && oldTemplates.length ? oldTemplates : buildDefaultTemplates(),
    packs: Array.isArray(oldPacks) && oldPacks.length ? oldPacks : buildDefaultPacks(),
    appState
  };
  localStorage.setItem(LS_KEYS.state, JSON.stringify(data));
  localStorage.setItem(LS_KEYS.schema, String(SCHEMA_VERSION));
}

function migrateStorage() {
  const current = Number(localStorage.getItem(LS_KEYS.schema) || 0);
  if (current >= SCHEMA_VERSION && localStorage.getItem(LS_KEYS.state)) return;
  backupLocalStorage("before_v3");
  migrateToV3();
}

function loadState() {
  const raw = safeJSONParse(localStorage.getItem(LS_KEYS.state), null);
  if (!raw) {
    state.settings = defaultSettings();
    state.templates = buildDefaultTemplates();
    state.packs = buildDefaultPacks();
    state.appState = defaultAppState();
    saveState();
    return;
  }
  state.settings = { ...defaultSettings(), ...(raw.settings || {}) };
  state.settings.vars = { ...defaultSettings().vars, ...(state.settings.vars || {}) };
  state.settings.features = { ...FEATURE_DEFAULTS, ...(state.settings.features || {}) };
  state.templates = Array.isArray(raw.templates) && raw.templates.length ? raw.templates : buildDefaultTemplates();
  state.packs = Array.isArray(raw.packs) && raw.packs.length ? raw.packs : buildDefaultPacks();
  state.appState = raw.appState || defaultAppState();
  if (!state.appState.projects?.length) state.appState.projects = [makeGeneralProject()];
  if (!state.appState.activeProjectId) state.appState.activeProjectId = "general";
  state.activeProjectId = state.appState.activeProjectId;
}

function saveState() {
  const payload = {
    settings: state.settings,
    templates: state.templates,
    packs: state.packs,
    appState: state.appState
  };
  localStorage.setItem(LS_KEYS.state, JSON.stringify(payload));
}

function getProjectById(id) {
  return state.appState.projects.find((p) => p.id === id) || state.appState.projects[0];
}

function activeProject() {
  return getProjectById(state.activeProjectId);
}

function projectVarsMerged() {
  const p = activeProject();
  return { ...state.settings.vars, ...(p?.vars || {}) };
}

function templatesForActiveProject() {
  const p = activeProject();
  const overrides = p?.templateOverrides || [];
  const overMap = new Map(overrides.map((t) => [t.id, t]));
  return state.templates.map((tpl) => overMap.get(tpl.id) || tpl);
}

function fillTemplateSelect() {
  const tool = $("#toolKind").value;
  const select = $("#templateSelect");
  const templates = templatesForActiveProject();
  select.innerHTML = "";
  templates
    .filter((t) => tool === "codex" ? (t.tags || []).includes("codex") : (t.tags || []).includes("sora"))
    .forEach((t) => {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = t.name;
      select.appendChild(o);
    });
  if (!select.value && select.options.length) select.value = select.options[0].value;
}

function renderProjectSelector() {
  const select = $("#projectSelect");
  if (!select) return;
  select.innerHTML = "";
  state.appState.projects.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    select.appendChild(o);
  });
  select.value = state.activeProjectId;
  $("#projectDescription").textContent = activeProject().description || "";
  if ($("#projectVarLieu")) $("#projectVarLieu").value = activeProject().vars?.LIEU || "";
  if ($("#projectVarStyle")) $("#projectVarStyle").value = activeProject().vars?.STYLE || "";
}

function renderTemplatesList() {
  const list = $("#tplList");
  if (!list) return;
  const q = ($("#tplSearch").value || "").toLowerCase().trim();
  list.innerHTML = "";
  const tpls = templatesForActiveProject();
  const frag = document.createDocumentFragment();
  tpls
    .filter((t) => !q || `${t.name} ${(t.tags || []).join(" ")} ${t.notes || ""}`.toLowerCase().includes(q))
    .slice(0, 200)
    .forEach((t) => {
      const item = document.createElement("div");
      item.className = "item";
      item.dataset.id = t.id;
      item.innerHTML = `<div class="item-title">${escapeHtml(t.name)}</div><div class="item-meta">${escapeHtml((t.tags || []).join(", "))}</div>`;
      item.addEventListener("click", () => openTemplateEditor(t.id));
      frag.appendChild(item);
    });
  list.appendChild(frag);
}

function openTemplateEditor(id) {
  const tpl = templatesForActiveProject().find((t) => t.id === id);
  if (!tpl) return;
  $("#tplName").value = tpl.name || "";
  $("#tplTags").value = (tpl.tags || []).join(", ");
  $("#tplBody").value = tpl.body || "";
  $("#tplBody").dataset.id = tpl.id;
}

function saveTemplateFromEditor() {
  const id = $("#tplBody").dataset.id || uid("tpl");
  const tpl = {
    id,
    name: $("#tplName").value || "Sans nom",
    tags: $("#tplTags").value.split(",").map((x) => x.trim()).filter(Boolean),
    body: $("#tplBody").value,
    notes: "",
    example: ""
  };
  const p = activeProject();
  const idxGlobal = state.templates.findIndex((t) => t.id === id);
  if (p.id === "general") {
    if (idxGlobal >= 0) state.templates[idxGlobal] = tpl;
    else state.templates.unshift(tpl);
  } else {
    p.templateOverrides = p.templateOverrides || [];
    const idx = p.templateOverrides.findIndex((t) => t.id === id);
    if (idx >= 0) p.templateOverrides[idx] = tpl;
    else p.templateOverrides.unshift(tpl);
  }
  saveState();
  fillTemplateSelect();
  renderTemplatesList();
  toast("Template sauvé ✅");
}

function deleteTemplateFromEditor() {
  const id = $("#tplBody").dataset.id;
  if (!id) return;
  const p = activeProject();
  if (p.id === "general") {
    state.templates = state.templates.filter((t) => t.id !== id);
  } else {
    p.templateOverrides = (p.templateOverrides || []).filter((t) => t.id !== id);
  }
  saveState();
  renderTemplatesList();
  fillTemplateSelect();
}

function collectSoraStudioData() {
  return {
    duration: $("#soraDuration")?.value || "10s",
    durationCustom: $("#soraDurationCustom")?.value || "",
    ratio: $("#soraRatio")?.value || "16:9",
    fps: $("#soraFps")?.value || "24",
    lens: $("#soraLens")?.value || "24mm",
    cameraMove: $("#soraCameraMove")?.value || "drone",
    lighting: $("#soraLighting")?.value || "golden hour",
    weather: $("#soraWeather")?.value || "clear",
    mood: $("#soraMood")?.value || "awe",
    continuity: $("#soraContinuity")?.value || "high",
    detail: $("#soraDetail")?.value || "high",
    negativeList: $("#soraNegativeList")?.value || ""
  };
}

function hydrateSoraStudioData(d) {
  const map = {
    soraDuration: d.duration,
    soraDurationCustom: d.durationCustom,
    soraRatio: d.ratio,
    soraFps: d.fps,
    soraLens: d.lens,
    soraCameraMove: d.cameraMove,
    soraLighting: d.lighting,
    soraWeather: d.weather,
    soraMood: d.mood,
    soraContinuity: d.continuity,
    soraDetail: d.detail,
    soraNegativeList: d.negativeList
  };
  Object.entries(map).forEach(([id, value]) => {
    if ($(`#${id}`) && value != null) $(`#${id}`).value = value;
  });
}

function ensureShotListFallback(studio) {
  if (state.soraShots.length) return state.soraShots;
  return [
    { desc: `Establishing ${studio.weather} (${studio.lighting})`, duration: "3s", camera: studio.lens, move: studio.cameraMove, constraints: "continuité" },
    { desc: `Plan intermédiaire mood ${studio.mood}`, duration: "4s", camera: studio.lens, move: "steadycam", constraints: "texture réaliste" },
    { desc: "Plan final héro", duration: "3s", camera: "50mm", move: "dolly", constraints: "sortie stable" }
  ];
}

function generateSoraStudioPrompt() {
  const s = collectSoraStudioData();
  const duration = s.duration === "custom" ? (s.durationCustom || "20s") : s.duration;
  const shots = ensureShotListFallback(s);
  const shotTxt = shots.map((sh, i) => `Plan ${i + 1} — ${sh.desc} | durée: ${sh.duration} | caméra: ${sh.camera} | move: ${sh.move} | contraintes: ${sh.constraints}`).join("\n");
  return normalizeSpaces(`SORA STUDIO AUTO\n\nPARAMÈTRES\n- Durée: ${duration}\n- Ratio: ${s.ratio}\n- FPS: ${s.fps}\n- Lens: ${s.lens}\n- Mouvement caméra: ${s.cameraMove}\n- Lumière: ${s.lighting}\n- Météo: ${s.weather}\n- Mood: ${s.mood}\n- Continuity: ${s.continuity}\n- Détail: ${s.detail}\n\nDO\n- garder la continuité\n- privilégier la cohérence matière et lumière\n\nDON'T\n- no text\n- no watermark\n- no glitch\n- no distortion\n\nNEGATIVE\n${s.negativeList || "no text, no watermark, no glitch"}\n\nSHOT LIST\n${shotTxt}`);
}

function collectCodexProData() {
  const style = ($('input[name="codexOutputStyle"]:checked') || {}).value || "patch_minimal";
  const constraints = $$(".codexConstraint:checked").map((x) => x.value);
  return {
    style,
    constraints,
    risks: $("#codexRisks")?.value || "",
    files: $("#codexFiles")?.value || "",
    dod: $("#codexDod")?.value || ""
  };
}

function generateCodexProPrompt() {
  const d = collectCodexProData();
  const styleMap = {
    patch_minimal: "Patch minimal (fichiers modifiés only)",
    plan_patch: "Plan + patch",
    full_code: "Full code si demandé"
  };
  $("#finalPrompt").value = normalizeSpaces(`CODEX PRO\n\nSPEC COURTE\n- objectif: ${$("#goal").value}\n- contexte: ${$("#context").value}\n- inputs: ${$("#inputs").value}\n\nPLAN PATCH\n1) périmètre\n2) implémentation\n3) tests\n4) notes\n\nCONTRAINTES\n${d.constraints.map((c) => `- ${c}`).join("\n")}\n\nRISQUES\n${d.risks || "-"}\n\nFICHIERS À MODIFIER/ÉVITER\n${d.files || "-"}\n\nACCEPTANCE CRITERIA\n- objectif respecté\n- pas de régression UI\n- backward localStorage\n- compat iPhone/desktop\n\nCHECKLIST QA\n- imports\n- edge cases\n- migration data\n- tests manuels\n\nDOD\n${d.dod || "Tous critères validés."}\n\nSTYLE\n${styleMap[d.style]}\n\nSORTIE\nCode complet des fichiers modifiés seulement.`);
}

function applyVars(tplBody) {
  const data = {
    GOAL: $("#goal").value,
    CONTEXT: $("#context").value,
    INPUTS: $("#inputs").value,
    RULES: $("#rules").value,
    STEPS: $("#steps").value,
    FORMAT: $("#outputFormat").value,
    ...projectVarsMerged()
  };
  let out = tplBody || "";
  Object.entries(data).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), v || "");
  });
  return normalizeSpaces(out);
}

function buildPrompt() {
  const id = $("#templateSelect").value;
  const tpl = templatesForActiveProject().find((t) => t.id === id) || templatesForActiveProject()[0];
  if (!tpl) return;
  const out = tpl.id === "sora_studio_auto" ? generateSoraStudioPrompt() : applyVars(tpl.body);
  $("#finalPrompt").value = out;
  return out;
}

function getHistoryScope(mode) {
  return mode === "global" ? state.appState.globalHistory : activeProject().history;
}

function saveCurrentToHistory() {
  const entry = {
    id: uid("hist"),
    createdAt: nowISO(),
    projectId: state.activeProjectId,
    templateId: $("#templateSelect").value,
    toolKind: $("#toolKind").value,
    goal: $("#goal").value,
    final: $("#finalPrompt").value,
    favorite: false
  };
  const p = activeProject();
  p.history.unshift(entry);
  p.history = p.history.slice(0, state.settings.historyCaps.project || LIMITS.projectHistory);
  state.appState.globalHistory.unshift(entry);
  state.appState.globalHistory = state.appState.globalHistory.slice(0, state.settings.historyCaps.global || LIMITS.globalHistory);
  saveState();
  renderHistory();
  toast("Sauvé ✅");
}

function renderHistory() {
  const list = $("#histList");
  if (!list) return;
  const q = ($("#histSearch").value || "").toLowerCase().trim();
  const mode = $("#historyScope")?.value || "project";
  const source = getHistoryScope(mode);
  list.innerHTML = "";
  const frag = document.createDocumentFragment();
  source
    .filter((h) => !q || `${h.goal} ${h.final}`.toLowerCase().includes(q))
    .slice(0, 300)
    .forEach((h) => {
      const it = document.createElement("div");
      it.className = "item";
      it.innerHTML = `<div class="item-title">${escapeHtml(h.goal || "Sans objectif")}</div><div class="item-meta">${escapeHtml(h.createdAt)} · ${escapeHtml(h.projectId || "general")}</div>`;
      it.addEventListener("click", () => {
        $("#finalPrompt").value = h.final || "";
      });
      frag.appendChild(it);
    });
  list.appendChild(frag);
}

function renderBlockChips() {
  const wrap = $("#blockChips");
  if (!wrap) return;
  wrap.innerHTML = "";
  const q = ($("#blockSearch")?.value || "").toLowerCase().trim();
  const group = $("#blockGroup")?.value || "all";
  state.packs
    .filter((b) => {
      const okQ = !q || `${b.label} ${b.text} ${(b.tags || []).join(" ")}`.toLowerCase().includes(q);
      const okG = group === "all" || (b.tags || []).includes(group);
      return okQ && okG;
    })
    .slice(0, 240)
    .forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.textContent = b.label;
      btn.title = b.text;
      btn.addEventListener("click", () => {
        const active = document.activeElement;
        const target = active && ["TEXTAREA", "INPUT"].includes(active.tagName) ? active : $("#finalPrompt");
        insertAtCursor(target, `\n${b.text}\n`);
      });
      wrap.appendChild(btn);
    });
}

function insertAtCursor(el, text) {
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`;
  const p = start + text.length;
  el.selectionStart = p;
  el.selectionEnd = p;
  el.focus();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function downloadFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function analyzePromptText(text) {
  const parts = {
    objectif: /objectif|goal/i.test(text),
    inputs: /entr(é|e)es|inputs?/i.test(text),
    contraintes: /contraintes?|rules/i.test(text),
    etapes: /plan|étapes?|steps?/i.test(text),
    format: /sortie|format/i.test(text),
    risques: /risques?|mitigation/i.test(text),
    checklist: /checklist|\- \[ \]/i.test(text)
  };
  const score = Object.values(parts).filter(Boolean).length * 14;
  const missingVars = Array.from(new Set((text.match(/\{[A-Z0-9_]+\}/g) || [])));
  const improvements = [
    "Ajouter une mini spec en tête.",
    "Ajouter des critères d'acceptation mesurables.",
    "Ajouter une checklist QA explicite.",
    "Préciser les fichiers à modifier et à éviter.",
    "Lister 3 risques + mitigations."
  ];
  return { score: Math.min(100, score), parts, missingVars, improvements };
}

function updateAnalysisResult(r) {
  $("#analysisResult").textContent = `Score: ${r.score}/100 | Variables non résolues: ${r.missingVars.join(", ") || "aucune"} | Améliorations: ${r.improvements.join(" ")}`;
}

function applyImprovementsToPrompt() {
  const text = $("#finalPrompt").value;
  const r = state.analysis || analyzePromptText(text);
  let out = text;
  if (!/ACCEPTANCE CRITERIA/i.test(out)) out += "\n\nACCEPTANCE CRITERIA\n- [ ] Fonctionnel\n- [ ] Sans régression UI\n- [ ] Offline OK";
  if (!/CHECKLIST/i.test(out)) out += "\n\nCHECKLIST\n- imports\n- edge cases\n- tests manuels";
  if (!/RISQUES/i.test(out)) out += "\n\nRISQUES & MITIGATIONS\n- Risque: ... | Mitigation: ...";
  if (r.missingVars.length) out += `\n\nVARIABLES À REMPLIR\n${r.missingVars.map((v) => `- ${v}`).join("\n")}`;
  $("#finalPrompt").value = normalizeSpaces(out);
  toast("Améliorations appliquées ✅");
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function runSoraRandomPro() {
  const biome = randomPick(["forêt", "désert", "fjord", "océan", "toundra", "ville"]);
  let weather = randomPick(["clear", "wind", "fog", "rain", "snow"]);
  let lighting = randomPick(["golden hour", "blue hour", "night", "overcast"]);
  let lens = randomPick(["24mm", "35mm", "50mm"]);
  let mood = randomPick(["awe", "romantic", "epic", "mysterious", "cozy"]);
  let move = randomPick(["drone", "dolly", "steadycam", "tracking"]);

  if (mood === "mysterious") lighting = "night";
  if (biome === "désert") lens = "24mm";
  if (lighting === "night" && weather === "rain") weather = "fog";
  if (mood === "romantic") move = "steadycam";

  hydrateSoraStudioData({ duration: "15s", ratio: "16:9", fps: "24", lens, cameraMove: move, lighting, weather, mood, continuity: "high", detail: "high", negativeList: "no text, no watermark, no glitch" });
  state.soraShots = ensureShotListFallback({ weather, lighting, mood, lens, cameraMove: move });
  renderShotList();
  $("#goal").value = normalizeSpaces(`${$("#goal").value}\nRandom pro: ${biome}, ${weather}, ${lighting}, ${mood}`);
  $("#finalPrompt").value = generateSoraStudioPrompt();
}

function renderShotList() {
  const list = $("#soraShotList");
  if (!list) return;
  list.innerHTML = "";
  state.soraShots.forEach((shot, i) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<div class="item-title">Plan ${i + 1}</div><textarea class="textarea shot-desc">${escapeHtml(shot.desc || "")}</textarea><div class="row gap"><button class="btn btn-ghost up">↑</button><button class="btn btn-ghost down">↓</button><button class="btn btn-ghost danger del">Supprimer</button></div>`;
    item.querySelector(".shot-desc").addEventListener("input", (e) => {
      state.soraShots[i].desc = e.target.value;
    });
    item.querySelector(".up").addEventListener("click", () => moveShot(i, -1));
    item.querySelector(".down").addEventListener("click", () => moveShot(i, 1));
    item.querySelector(".del").addEventListener("click", () => {
      state.soraShots.splice(i, 1);
      renderShotList();
    });
    list.appendChild(item);
  });
}

function moveShot(i, d) {
  const j = i + d;
  if (j < 0 || j >= state.soraShots.length) return;
  [state.soraShots[i], state.soraShots[j]] = [state.soraShots[j], state.soraShots[i]];
  renderShotList();
}

function renderSoraPresets() {
  const wrap = $("#soraPresets");
  if (!wrap) return;
  wrap.innerHTML = "";
  SORA_PRESETS.forEach((p) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = p.name;
    b.addEventListener("click", () => {
      hydrateSoraStudioData({ weather: p.weather, lighting: p.lighting, lens: p.lens, cameraMove: p.move, mood: p.mood, ratio: "16:9", fps: "24", duration: "15s" });
      state.soraShots = [
        { desc: `Establishing ${p.biome} (${p.weather})`, duration: "4s", camera: p.lens, move: p.move, constraints: "continuité" },
        { desc: `Plan mood ${p.mood}`, duration: "5s", camera: p.lens, move: "steadycam", constraints: "réalisme" },
        { desc: "Clôture cinématique", duration: "4s", camera: "50mm", move: "dolly", constraints: "stable" }
      ];
      renderShotList();
      $("#finalPrompt").value = generateSoraStudioPrompt();
    });
    wrap.appendChild(b);
  });
}

function exportCurrentPromptJSON() {
  const payload = {
    exportVersion: EXPORT_VERSION,
    type: "prompt",
    exportedAt: nowISO(),
    projectId: state.activeProjectId,
    prompt: $("#finalPrompt").value,
    fields: {
      goal: $("#goal").value,
      context: $("#context").value,
      inputs: $("#inputs").value,
      rules: $("#rules").value,
      steps: $("#steps").value,
      outputFormat: $("#outputFormat").value
    }
  };
  payload.checksum = quickHash(JSON.stringify(payload));
  downloadFile(`prompt_project_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function buildFullExport() {
  const payload = {
    exportVersion: EXPORT_VERSION,
    schema: SCHEMA_VERSION,
    app: APP_NAME,
    exportedAt: nowISO(),
    data: {
      settings: state.settings,
      templates: state.templates,
      packs: state.packs,
      appState: state.appState
    }
  };
  payload.checksum = quickHash(JSON.stringify(payload.data));
  return payload;
}

function exportFullJSON() {
  const payload = buildFullExport();
  downloadFile(`prompt_factory_full_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportTemplatesOnly() {
  const payload = { kind: "templates", exportVersion: EXPORT_VERSION, schema: SCHEMA_VERSION, content: state.templates };
  payload.checksum = quickHash(JSON.stringify(payload.content));
  downloadFile(`templates_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportPacksOnly() {
  const payload = { kind: "packs", exportVersion: EXPORT_VERSION, schema: SCHEMA_VERSION, content: state.packs };
  payload.checksum = quickHash(JSON.stringify(payload.content));
  downloadFile(`packs_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function exportProjectsOnly() {
  const payload = { kind: "projects", exportVersion: EXPORT_VERSION, schema: SCHEMA_VERSION, content: state.appState.projects };
  payload.checksum = quickHash(JSON.stringify(payload.content));
  downloadFile(`projects_${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function parseJSONFile(file, cb) {
  const fr = new FileReader();
  fr.onload = () => cb(safeJSONParse(fr.result, null));
  fr.readAsText(file);
}

function openImportModal(payload, requestedMode = "merge") {
  state.pendingImportPayload = payload;
  $("#importModal").dataset.requestedMode = requestedMode;
  $("#importModeHint").textContent = `Mode recommandé: ${requestedMode === "replace" ? "remplacer" : "fusionner"}.`;
  $("#importModal").style.display = "block";
}

function closeImportModal() {
  state.pendingImportPayload = null;
  $("#importModal").style.display = "none";
}

function validateImportPayload(data) {
  if (!data || typeof data !== "object") return { ok: false, msg: "JSON invalide." };
  if (data.data && data.exportVersion) return { ok: true, type: "full" };
  if (Array.isArray(data.content) && data.kind) return { ok: true, type: data.kind };
  return { ok: false, msg: "Format import non reconnu." };
}

function mergeById(current, incoming) {
  const map = new Map(current.map((x) => [x.id, x]));
  incoming.forEach((x) => { if (x?.id) map.set(x.id, { ...map.get(x.id), ...x }); });
  return Array.from(map.values());
}

function applyImport(mode = "merge") {
  const payload = state.pendingImportPayload;
  if (!payload) return;
  const check = validateImportPayload(payload);
  if (!check.ok) {
    toast(check.msg);
    return;
  }

  if (check.type === "full") {
    if (mode === "replace") {
      state.settings = payload.data.settings || defaultSettings();
      state.templates = payload.data.templates || buildDefaultTemplates();
      state.packs = payload.data.packs || buildDefaultPacks();
      state.appState = payload.data.appState || defaultAppState();
    } else {
      state.settings = { ...state.settings, ...(payload.data.settings || {}) };
      state.templates = mergeById(state.templates, payload.data.templates || []);
      state.packs = mergeById(state.packs, payload.data.packs || []);
      const incProjects = payload.data.appState?.projects || [];
      const map = new Map(state.appState.projects.map((p) => [p.id, p]));
      incProjects.forEach((p) => {
        if (!p?.id) return;
        if (!map.has(p.id)) map.set(p.id, p);
      });
      state.appState.projects = Array.from(map.values());
    }
  }

  if (check.type === "templates") state.templates = mode === "replace" ? payload.content : mergeById(state.templates, payload.content);
  if (check.type === "packs") state.packs = mode === "replace" ? payload.content : mergeById(state.packs, payload.content);
  if (check.type === "projects") {
    if (mode === "replace") state.appState.projects = payload.content;
    else {
      const map = new Map(state.appState.projects.map((p) => [p.id, p]));
      payload.content.forEach((p) => { if (p?.id && !map.has(p.id)) map.set(p.id, p); });
      state.appState.projects = Array.from(map.values());
    }
  }

  saveState();
  renderAll();
  closeImportModal();
  toast(`Import ${mode} terminé ✅`);
}

function importFromFileInput(inputId) {
  const input = $(inputId);
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    parseJSONFile(file, (data) => {
      const check = validateImportPayload(data);
      if (!check.ok) {
        toast(check.msg);
        return;
      }
      openImportModal(data, input.dataset.mode || "merge");
    });
  };
  input.click();
}

function createProject() {
  const name = prompt("Nom du projet ?", "Nouveau projet");
  if (!name) return;
  const description = prompt("Description du projet ?", "") || "";
  const p = { id: uid("project"), name: name.trim(), description: description.trim(), templateOverrides: [], history: [], vars: {}, soraPresets: [] };
  state.appState.projects.push(p);
  state.activeProjectId = p.id;
  state.appState.activeProjectId = p.id;
  saveState();
  dbg("project created", p.id);
  renderProjectSelector();
  renderTemplatesList();
  renderHistory();
}

function renameProject() {
  const p = activeProject();
  if (!p || p.id === "general") return toast("Projet Général non renommable.");
  const name = prompt("Nouveau nom", p.name);
  if (!name) return;
  p.name = name.trim();
  const desc = prompt("Description", p.description || "") || p.description || "";
  p.description = desc.trim();
  saveState();
  dbg("project created", p.id);
  renderProjectSelector();
}

function deleteProject() {
  const p = activeProject();
  if (!p || p.id === "general") return toast("Projet Général non supprimable.");
  state.appState.projects = state.appState.projects.filter((x) => x.id !== p.id);
  state.activeProjectId = "general";
  state.appState.activeProjectId = "general";
  saveState();
  renderAll();
}

function exportDebug() {
  const info = {
    schemaVersion: SCHEMA_VERSION,
    exportVersion: EXPORT_VERSION,
    settings: state.settings,
    keyCount: localStorage.length,
    keys: Object.keys(localStorage),
    sizes: Object.keys(localStorage).map((k) => ({ key: k, bytes: (localStorage.getItem(k) || "").length }))
  };
  downloadFile(`debug_${Date.now()}.json`, JSON.stringify(info, null, 2), "application/json");
}

function saveSettingsFromUI() {
  state.settings.defaultType = $("#prefDefaultType").value;
  state.settings.vars = {
    LIEU: $("#varLieu").value,
    SUJET: $("#varSujet").value,
    STYLE: $("#varStyle").value,
    DUREE: $("#varDuree").value,
    FORMAT: $("#varFormat").value,
    CONTRAINTES: $("#varContraintes").value
  };
  state.settings.features = {
    soraStudio: $("#flagSoraStudio").checked,
    codexPro: $("#flagCodexPro").checked,
    analyzer: $("#flagAnalyzer").checked,
    projects: $("#flagProjects").checked,
    debug: $("#flagDebug").checked
  };
  saveState();
  toggleFeatureSections();
  toast("Paramètres sauvés ✅");
}

function fillSettingsUI() {
  $("#prefDefaultType").value = state.settings.defaultType;
  $("#varLieu").value = state.settings.vars.LIEU || "";
  $("#varSujet").value = state.settings.vars.SUJET || "";
  $("#varStyle").value = state.settings.vars.STYLE || "";
  $("#varDuree").value = state.settings.vars.DUREE || "";
  $("#varFormat").value = state.settings.vars.FORMAT || "";
  $("#varContraintes").value = state.settings.vars.CONTRAINTES || "";
  $("#flagSoraStudio").checked = !!state.settings.features.soraStudio;
  $("#flagCodexPro").checked = !!state.settings.features.codexPro;
  $("#flagAnalyzer").checked = !!state.settings.features.analyzer;
  $("#flagProjects").checked = !!state.settings.features.projects;
  $("#flagDebug").checked = !!state.settings.features.debug;
}

function toggleFeatureSections() {
  $("#soraStudioSection").style.display = $("#toolKind").value === "sora" && state.settings.features.soraStudio ? "block" : "none";
  $("#codexProSection").style.display = $("#toolKind").value === "codex" && state.settings.features.codexPro ? "block" : "none";
  $("#btnAnalyzePrompt").style.display = state.settings.features.analyzer ? "inline-block" : "none";
  $("#btnApplyImprovements").style.display = state.settings.features.analyzer ? "inline-block" : "none";
  $("#projectPanel").style.display = state.settings.features.projects ? "block" : "none";
  $("#debugPanel").style.display = state.settings.features.debug ? "block" : "none";
}

function setActiveView(view) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $(`#view-${view}`).classList.add("active");
  if (view === "templates") renderTemplatesList();
  if (view === "history") renderHistory();
  if (view === "settings") fillSettingsUI();
  if (view === "ia") renderIaRecommendations();
}

function renderAll() {
  renderProjectSelector();
  fillTemplateSelect();
  renderTemplatesList();
  renderHistory();
  renderBlockChips();
  renderSoraPresets();
  renderShotList();
  fillSettingsUI();
  renderIaRecommendations();
  toggleFeatureSections();
}

function wireEvents() {
  $$(".nav-item").forEach((b) => b.addEventListener("click", () => setActiveView(b.dataset.view)));

  $("#toolKind").addEventListener("change", () => {
    fillTemplateSelect();
    toggleFeatureSections();
    buildPrompt();
  });
  $("#templateSelect").addEventListener("change", buildPrompt);
  $("#btnGenerate").addEventListener("click", () => { buildPrompt(); toast("Prompt généré ✅"); });
  $("#btnSaveToHistory").addEventListener("click", saveCurrentToHistory);
  $("#btnNewFromTemplate").addEventListener("click", buildPrompt);

  $("#btnGenerateCodexPro").addEventListener("click", () => { generateCodexProPrompt(); toast("Codex Pro généré ✅"); });
  $("#btnSoraAuto").addEventListener("click", () => { $("#templateSelect").value = "sora_studio_auto"; $("#finalPrompt").value = generateSoraStudioPrompt(); });
  $("#btnSoraRandomPro").addEventListener("click", () => { runSoraRandomPro(); toast("Random pro appliqué ✅"); });
  $("#btnSoraAddShot").addEventListener("click", () => { state.soraShots.push({ desc: "Nouveau plan", duration: "", camera: "", move: "", constraints: "" }); renderShotList(); });

  $("#btnCopy").addEventListener("click", () => copyText($("#finalPrompt").value).then(() => toast("Copié ✅")));
  $("#btnQuickCopy").addEventListener("click", () => copyText($("#finalPrompt").value).then(() => toast("Copié ✅")));
  $("#btnExportTxt").addEventListener("click", () => downloadFile(`prompt_${Date.now()}.txt`, $("#finalPrompt").value));
  $("#btnExportJson").addEventListener("click", exportCurrentPromptJSON);


  $("#btnReset")?.addEventListener("click", () => {
    ["#goal", "#context", "#inputs", "#rules", "#steps", "#outputFormat", "#finalPrompt", "#analysisResult", "#codexRisks", "#codexFiles", "#codexDod", "#soraNegativeList"].forEach((sel) => {
      if ($(sel)) $(sel).value = "";
      if (sel === "#analysisResult" && $(sel)) $(sel).textContent = "";
    });
    state.soraShots = [];
    renderShotList();
  });
  $("#btnTidy")?.addEventListener("click", () => { $("#finalPrompt").value = normalizeSpaces($("#finalPrompt").value); });

  $("#btnAnalyzePrompt").addEventListener("click", () => {
    state.analysis = analyzePromptText($("#finalPrompt").value);
    updateAnalysisResult(state.analysis);
  });
  $("#btnApplyImprovements").addEventListener("click", applyImprovementsToPrompt);

  $("#btnTplSave").addEventListener("click", saveTemplateFromEditor);
  $("#btnTplDelete").addEventListener("click", deleteTemplateFromEditor);
  $("#btnTplNew").addEventListener("click", () => {
    $("#tplName").value = "";
    $("#tplTags").value = "";
    $("#tplBody").value = "";
    $("#tplBody").dataset.id = "";
  });

  $("#btnHistClear").addEventListener("click", () => {
    const mode = $("#historyScope")?.value || "project";
    if (mode === "global") state.appState.globalHistory = [];
    else activeProject().history = [];
    saveState();
    renderHistory();
  });

  $("#btnSettingsSave").addEventListener("click", saveSettingsFromUI);
  $("#btnFactoryReset").addEventListener("click", () => {
    backupLocalStorage("factory_reset");
    localStorage.clear();
    location.reload();
  });

  $("#projectSelect")?.addEventListener("change", (e) => {
    state.activeProjectId = e.target.value;
    state.appState.activeProjectId = e.target.value;
    saveState();
    renderAll();
    buildPrompt();
  });
  $("#btnProjectNew")?.addEventListener("click", createProject);
  $("#btnProjectRename")?.addEventListener("click", renameProject);
  $("#btnProjectDelete")?.addEventListener("click", deleteProject);
  $("#btnProjectVarsSave")?.addEventListener("click", () => {
    const p = activeProject();
    p.vars = p.vars || {};
    p.vars.LIEU = $("#projectVarLieu").value;
    p.vars.STYLE = $("#projectVarStyle").value;
    saveState();
    toast("Variables projet sauvées ✅");
  });

  $("#btnExportFull").addEventListener("click", exportFullJSON);
  $("#btnImportFull").addEventListener("click", () => importFromFileInput("#fileImportFull"));
  $("#btnExportTemplates").addEventListener("click", exportTemplatesOnly);
  $("#btnImportTemplatesMerge").addEventListener("click", () => { $("#fileTemplates").dataset.mode = "merge"; importFromFileInput("#fileTemplates"); });
  $("#btnImportTemplatesReplace")?.addEventListener("click", () => { $("#fileTemplates").dataset.mode = "replace"; importFromFileInput("#fileTemplates"); });
  $("#btnExportPacks").addEventListener("click", exportPacksOnly);
  $("#btnImportPacks").addEventListener("click", () => importFromFileInput("#filePacks"));
  $("#btnExportProjects").addEventListener("click", exportProjectsOnly);
  $("#btnImportProjects").addEventListener("click", () => importFromFileInput("#fileProjects"));

  $("#btnImportMerge").addEventListener("click", () => applyImport("merge"));
  $("#btnImportReplace").addEventListener("click", () => applyImport("replace"));
  $("#btnImportCancel").addEventListener("click", closeImportModal);

  $("#btnDebugExport")?.addEventListener("click", exportDebug);

  $("#btnIaAnalyze")?.addEventListener("click", () => {
    renderIaRecommendations();
    $("#iaBrief").value = "";
    toast("Message envoyé ✅");
  });
  $("#iaBrief")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      renderIaRecommendations();
      $("#iaBrief").value = "";
    }
  });
  $("#btnIaNext")?.addEventListener("click", () => {
    const c = iaConversationState();
    if (!c?.nextQuestion?.question) return;
    $("#iaBrief").value = c.nextQuestion.question;
    toast("Question suivante proposée ✅");
  });
  $("#btnIaContinue")?.addEventListener("click", () => {
    renderIaRecommendations();
    toast("Discussion poursuivie ✅");
  });
  $("#btnIaGenerate")?.addEventListener("click", () => {
    generateIaPrompt("detailed");
    toast("Prompt final généré ✅");
  });
  $("#btnIaImprove")?.addEventListener("click", () => {
    const c = iaConversationState();
    if (!c) return;
    const revised = iaEngine.reviseConversationPrompt(c, "rends ça plus pro et détaillé");
    state.iaDraft = revised;
    saveIaDraft(revised);
    $("#iaFinalPrompt").value = revised.finalVariants.ultra || revised.finalPrompt;
    renderIaRecommendations();
    toast("Prompt amélioré ✅");
  });
  $("#btnIaRegenerate")?.addEventListener("click", () => {
    generateIaPrompt("detailed");
    toast("Prompt régénéré ✅");
  });
  $("#btnIaVariantShort")?.addEventListener("click", () => generateIaPrompt("short"));
  $("#btnIaVariantLong")?.addEventListener("click", () => generateIaPrompt("detailed"));
  $("#btnIaVariantUltra")?.addEventListener("click", () => generateIaPrompt("ultra"));
  $("#btnIaCopy")?.addEventListener("click", () => copyText($("#iaFinalPrompt").value).then(() => toast("Prompt IA copié ✅")));
  $("#btnIaExport")?.addEventListener("click", () => {
    const c = iaConversationState();
    const payload = JSON.stringify({ exportedAt: nowISO(), conversation: c }, null, 2);
    downloadFile(`prompt-conversation-${Date.now()}.json`, payload, "application/json");
    toast("Export IA effectué ✅");
  });
  $("#btnIaReset")?.addEventListener("click", () => {
    state.iaDraft = iaEngine ? iaEngine.createConversationState("") : null;
    saveIaDraft(state.iaDraft);
    if ($("#iaConversation")) $("#iaConversation").innerHTML = "";
    if ($("#iaFinalPrompt")) $("#iaFinalPrompt").value = "";
    if ($("#iaCollected")) $("#iaCollected").textContent = "{}";
    if ($("#iaMissing")) $("#iaMissing").textContent = "Aucune donnée.";
    toast("Conversation IA réinitialisée ✅");
  });
  $("#btnIaShowInfo")?.addEventListener("click", () => renderIaRecommendations());
  $("#btnIaShowMissing")?.addEventListener("click", () => renderIaRecommendations());

  $("#btnProjectPresetSave")?.addEventListener("click", () => {
    const p = activeProject();
    p.soraPresets = p.soraPresets || [];
    p.soraPresets.unshift({ id: uid("ps"), ...collectSoraStudioData() });
    p.soraPresets = p.soraPresets.slice(0, 30);
    saveState();
    toast("Preset Sora projet sauvé ✅");
  });

  $("#historyScope")?.addEventListener("change", renderHistory);

  const debouncedTpl = debounce(renderTemplatesList);
  const debouncedHist = debounce(renderHistory);
  const debouncedBlocks = debounce(renderBlockChips);
  $("#tplSearch").addEventListener("input", debouncedTpl);
  $("#histSearch").addEventListener("input", debouncedHist);
  $("#blockSearch")?.addEventListener("input", debouncedBlocks);
  $("#blockGroup")?.addEventListener("change", renderBlockChips);

  $$(".chip[data-insert]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const active = document.activeElement;
      const target = active && ["TEXTAREA", "INPUT"].includes(active.tagName) ? active : $("#finalPrompt");
      insertAtCursor(target, chip.dataset.insert);
    });
  });
}

function init() {
  migrateStorage();
  loadState();
  state.iaDraft = loadIaDraft();
  $("#toolKind").value = state.settings.defaultType || "codex";
  wireEvents();
  renderAll();
  if (state.iaDraft?.finalPrompt && $("#iaFinalPrompt")) {
    $("#iaFinalPrompt").value = state.iaDraft.finalPrompt;
  }
  if (iaEngine && (!state.iaDraft || !state.iaDraft.structuredPrompt)) {
    state.iaDraft = iaEngine.createConversationState("");
    saveIaDraft(state.iaDraft);
  }
  renderIaRecommendations();
  buildPrompt();
}

document.addEventListener("DOMContentLoaded", init);
