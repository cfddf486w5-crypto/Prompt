// Prompt Factory — Mix Sora + Codex (V2)
// Local-only, offline-first. No network calls.

const SCHEMA_VERSION = 2;
const LS_KEYS = {
  schema: "pb_schema_version",
  templates: "pb_templates_v1",
  history: "pb_history_v1",
  settings: "pb_settings_v1",
  draft: "pb_draft_v1",
  packs: "pb_packs_v1"
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const PROMPT_BLOCKS_DEFAULT = [
  { id: "b_sora_anti_artefacts", label: "Contraintes Sora (anti artefacts)", text: "CONTRAINTES SORA (ANTI ARTEFACTS)\n- Pas de texte overlay, pas de watermark\n- Pas de glitch, pas de déformation faciale/mains\n- Stabilité des proportions entre plans\n- Motion blur naturel, pas d'effet vidéo artificiel\n" },
  { id: "b_cam_cine", label: "Caméra cinématique", text: "CAMÉRA CINÉMATIQUE\n- Alternance plan large, plan moyen, détail\n- Mouvement fluide contrôlé (dolly/steady/drone)\n- Profondeur de champ crédible\n" },
  { id: "b_continuite", label: "Continuité stricte", text: "CONTINUITÉ STRICTE\n- Respect strict des axes et de la direction du mouvement\n- Cohérence météo/lumière/couleurs entre plans\n- Pas de changement brutal d'éléments clés\n" },
  { id: "b_negative_generic", label: "Negative prompt (générique)", text: "NEGATIVE CONSTRAINTS\n- no text, no subtitle, no logo, no watermark\n- no extra limbs, no duplicated faces\n- no flicker, no heavy compression artifacts\n" },
  { id: "b_shotlist5", label: "Shotlist 5 plans (template)", text: "SHOTLIST (5 PLANS)\nPlan 1 — Establishing (2-3s): ...\nPlan 2 — Wide tracking: ...\nPlan 3 — Mid-detail: ...\nPlan 4 — Signature moment: ...\nPlan 5 — Closing shot: ...\n" },
  { id: "b_codex_qa", label: "Codex checklist QA", text: "CHECKLIST QA CODEX\n- chemins/imports validés\n- edge cases traités\n- validation input ajoutée\n- migration data gérée\n- tests manuels listés\n" },
  { id: "b_codex_plan6", label: "Codex plan en 6 étapes", text: "PLAN PATCH (6 ÉTAPES)\n1) Reproduction / diagnostic\n2) Cadrage solution minimale\n3) Implémentation ciblée\n4) Vérifications techniques\n5) Tests manuels\n6) Notes de livraison\n" },
  { id: "b_dod", label: "DoD (Definition of Done)", text: "DEFINITION OF DONE\n- Tous critères d'acceptation validés\n- Pas de régression fonctionnelle\n- Backward compat vérifiée\n- Documentation courte ajoutée\n" },
  { id: "b_risks", label: "Risques + mitigations", text: "RISQUES & MITIGATIONS\n- Risque: ... | Mitigation: ...\n- Risque: ... | Mitigation: ...\n" },
  { id: "b_files_only", label: "Format sortie: fichiers modifiés only", text: "FORMAT DE SORTIE\nRetourne uniquement le code complet des fichiers modifiés.\nPas de pseudo-code.\n" }
];

const SORA_PRESETS = [
  { id: "p1", name: "forêt/lac overland", biome: "forêt", mood: "calm", weather: "clear", lighting: "golden hour", lens: "24mm", move: "dolly", shots: ["Survol lent d'un lac entouré de conifères", "Travelling bas sur rive humide", "Plan serré reflets et texture eau"] },
  { id: "p2", name: "bord de mer falaises", biome: "océan", mood: "awe", weather: "wind", lighting: "blue hour", lens: "35mm", move: "drone", shots: ["Plan large falaises + houle", "Glide latéral au ras des falaises", "Plan final horizon dramatique"] },
  { id: "p3", name: "montagne neige", biome: "montagne", mood: "epic", weather: "snow", lighting: "overcast", lens: "50mm", move: "crane", shots: ["Establishing vallée neige", "Ascension progressive vers crête", "Close-up poudreuse portée par le vent"] },
  { id: "p4", name: "nuit étoilée aurore", biome: "toundra", mood: "mysterious", weather: "clear", lighting: "night", lens: "24mm", move: "timelapse", shots: ["Plan fixe ciel étoilé", "Aurore qui apparaît graduellement", "Reflet de l'aurore sur eau noire"] },
  { id: "p5", name: "pluie fine route", biome: "route", mood: "romantic", weather: "rain", lighting: "blue hour", lens: "35mm", move: "steadycam", shots: ["Route humide en perspective", "Travelling avant avec gouttes sur asphalte", "Plan détail flaques et néons lointains"] },
  { id: "p6", name: "glacier brume", biome: "glacier", mood: "awe", weather: "fog", lighting: "overcast", lens: "14mm", move: "drone", shots: ["Plan d'ensemble glacier", "Vol lent entre séracs", "Plan bas brume au ras de la glace"] },
  { id: "p7", name: "désert dunes", biome: "désert", mood: "calm", weather: "wind", lighting: "golden hour", lens: "85mm", move: "dolly", shots: ["Lignes de dunes au soleil bas", "Travelling sur crête de dune", "Plan macro texture sable"] },
  { id: "p8", name: "fjord drone", biome: "fjord", mood: "epic", weather: "fog", lighting: "blue hour", lens: "24mm", move: "drone", shots: ["Plan aérien entrée du fjord", "Descente progressive vers l'eau", "Sortie en plan large montagne-eau"] },
  { id: "p9", name: "toundra + vent", biome: "toundra", mood: "mysterious", weather: "wind", lighting: "overcast", lens: "35mm", move: "handheld soft", shots: ["Panorama végétation rase", "Plan moyen herbes balayées", "Plan détail particules de vent"] },
  { id: "p10", name: "forêt ancestrale + rayons", biome: "forêt ancestrale", mood: "awe", weather: "fog", lighting: "golden hour", lens: "50mm", move: "steadycam", shots: ["Entrée forêt en contre-jour", "Rayons traversant la brume", "Plan final tronc monumental"] },
  { id: "p11", name: "océan tempête lointaine", biome: "océan", mood: "epic", weather: "storm backlight", lighting: "storm backlight", lens: "24mm", move: "crane", shots: ["Horizon sombre + éclairs lointains", "Plan large vagues longues", "Plan final mer apaisée progressive"] },
  { id: "p12", name: "romance dance under aurora", biome: "toundra", mood: "romantic", weather: "clear", lighting: "night", lens: "35mm", move: "steadycam", shots: ["Silhouettes dansant sous aurore", "Rotation douce autour de la scène", "Plan final reflet au sol gelé"] }
];

const SORA_VARIATION_DATA = {
  biomes: ["océan", "fjord", "désert", "toundra", "forêt ancestrale", "montagne", "glacier", "lac"],
  weather: ["clear", "fog", "rain", "snow", "wind"],
  lens: ["14mm", "24mm", "35mm", "50mm", "85mm"],
  cameraMoves: ["drone", "steadycam", "dolly", "crane", "handheld soft", "timelapse"],
  mood: ["calm", "awe", "romantic", "epic", "mysterious"],
  timeOfDay: ["golden hour", "blue hour", "overcast", "night"]
};

function nowISO(){ return new Date().toISOString(); }
function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 1600); }
function safeJSONParse(s, fallback){ try { return JSON.parse(s); } catch { return fallback; } }
function uid(){ return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16); }
function normalizeSpaces(s){ return (s || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); }
function escapeHtml(str){ return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function randomPick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function quickHash(input){
  const s = String(input || "");
  let h = 0;
  for(let i=0;i<s.length;i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `${s.length}_${Math.abs(h)}`;
}

function baseCodexBody(title){
  return `RÔLE\nTu es un ingénieur logiciel senior spécialisé en patch incrémental et sécurité de livraison.\n\nOBJECTIF\n${title}\n{GOAL}\n\nCONTEXTE\n{CONTEXT}\n\nINPUTS\n{INPUTS}\n\nCONTRAINTES\n{RULES}\n- Pas de dépendances externes\n- Backward compat localStorage\n- Livrer en petits changements lisibles\n\nPLAN\n{STEPS}\n1) Mini spec (périmètre, hypothèses, risques)\n2) Plan de patch (fichiers ciblés, ordre de modif)\n3) Exécution en patch minimal\n4) Validation + checklist QA\n\nCODE ATTENDU\n- Implémentation robuste + garde-fous\n- Migration si nécessaire\n- Notes de tests manuels\n\nCHECKLIST\n- chemins/imports\n- edge cases\n- validation input\n- migration data\n- tests manuels\n\nSORTIE\ncode complet des fichiers modifiés seulement.`;
}

function baseSoraBody(title, biome, mood){
  return `TEMPLATE SORA — ${title}\n\nPARAMÈTRES\n- Durée: {DUREE}\n- Ratio: 16:9\n- Style: cinématique ultra réaliste\n- Caméra: fluide, narrative\n- Lumière: cohérente avec l'heure choisie\n- Ambiance: ${mood}\n- Continuité: élevée\n\nDO\n- Garder cohérence des textures, perspective et mouvement\n- Maintenir transitions douces entre plans\n\nDON'T\n- Pas de texte overlay\n- Pas de glitch\n- Pas de déformations mains/visages\n\nSHOT LIST\nPlan 1: establishing ${biome}\nPlan 2: mouvement caméra principal\nPlan 3: détail matière + profondeur\nPlan 4: climax visuel\n\nVARIANTE A\nPrompt A orienté réalisme naturel + subtilité atmosphérique.\n\nVARIANTE B\nPrompt B orienté contraste dramatique + mouvement plus marqué.\n\nNEGATIVE CONSTRAINTS\nno text, no watermark, no flicker, no distortion, no duplicate limbs.`;
}

function buildProTemplatePack(){
  const codexNames = [
    "Ajouter feature sans toucher UI (strict)", "Ajouter feature avec refactor minimal", "Bugfix urgent + reproduction + patch",
    "Performance front (profiling + micro-optimisations)", "Refactor architecture (petits commits)", "Ajouter stockage localStorage robuste",
    "Ajouter import/export JSON", "Ajouter undo/redo (state)", "Créer moteur de templates + variables + validation",
    "Créer moteur de presets (fill fields)", "Créer tests manuels (checklist QA)", "Créer README + guide usage",
    "Ajouter accessibilité (aria, tab order)", "Ajouter i18n FR (si besoin)", "Créer mode diff-only (fichiers modifiés)",
    "Créer mode safety (pas de suppression)", "Créer mode migration localStorage", "Créer mode feature flags (settings)",
    "Créer mode diagnostic (logs + export debug)", "Créer mode plugin local (templates importables)"
  ];

  const soraList = [
    ["Cinematic landscape — océan", "océan", "awe"], ["Cinematic landscape — fjord", "fjord", "epic"], ["Cinematic landscape — désert", "désert", "calm"],
    ["Cinematic landscape — toundra", "toundra", "mysterious"], ["Cinematic landscape — forêt ancestrale", "forêt ancestrale", "awe"],
    ["Cinematic landscape — montagne", "montagne", "epic"], ["Cinematic landscape — glacier", "glacier", "awe"], ["Cinematic landscape — pluie", "forêt", "romantic"],
    ["Romance intimiste — marche côte à côte", "fjord", "romantic"], ["Romance intimiste — danse lente sous pluie", "ville", "romantic"],
    ["Romance intimiste — silence au lac", "lac", "romantic"], ["Romance intimiste — route de nuit", "route", "romantic"],
    ["Romance intimiste — lever de soleil", "montagne", "romantic"], ["Romance intimiste — cabine en forêt", "forêt ancestrale", "romantic"],
    ["Action douce — overland", "toundra", "epic"], ["Action douce — obstacles naturels", "forêt", "epic"],
    ["Action douce — route cinématique", "route", "awe"], ["Action douce — drone follow", "désert", "epic"],
    ["Aurores boréales masterclass — nuit profonde", "toundra", "mysterious"], ["Aurores boréales masterclass — reflets progressifs", "lac", "awe"]
  ];

  const codexTemplates = codexNames.map((name, idx) => ({
    id: `pro_codex_${idx + 1}`,
    name: `Codex — ${name}`,
    tags: ["codex", "app-web", "pack-pro", "patch", "checklist"],
    body: baseCodexBody(name)
  }));

  const soraTemplates = soraList.map((row, idx) => ({
    id: `pro_sora_${idx + 1}`,
    name: `Sora — ${row[0]}`,
    tags: ["sora", "video", "shotlist", "pack-pro", row[1], row[2]],
    body: baseSoraBody(row[0], row[1], row[2])
  }));

  return [...codexTemplates, ...soraTemplates, {
    id: "sora_studio_auto",
    name: "Sora Studio (auto)",
    tags: ["sora", "video", "shotlist", "auto"],
    body: "{SORA_STUDIO_PROMPT}"
  }];
}

function defaultTemplates(){
  const base = [
    { id: "tpl_codex_strict_ui", name: "Codex — Ajout sans toucher au UI", tags: ["codex","ui","safe"], body: baseCodexBody("Ajouter une feature sans toucher au UI") },
    { id: "tpl_codex_refactor", name: "Codex — Refactor propre + tests rapides", tags: ["codex","refactor","quality"], body: baseCodexBody("Refactor minimal + tests rapides") },
    { id: "tpl_sora_cinematic", name: "Sora — Cinématique ultra réaliste", tags: ["sora","video","cinema"], body: baseSoraBody("Cinématique ultra réaliste", "océan", "awe") },
    { id: "tpl_sora_random", name: "Sora — Paysages au hasard (guidé)", tags: ["sora","paysage","random"], body: baseSoraBody("Paysage random guidé", "biome variable", "mysterious") }
  ];
  return [...base, ...buildProTemplatePack()];
}

function defaultSettings(){
  return {
    defaultType: "codex",
    vars: { LIEU: "", SUJET: "", STYLE: "", DUREE: "", FORMAT: "", CONTRAINTES: "" }
  };
}

function migrateStorage(){
  const version = Number(localStorage.getItem(LS_KEYS.schema) || 0);
  if(version >= SCHEMA_VERSION) return;
  if(!localStorage.getItem(LS_KEYS.settings)) localStorage.setItem(LS_KEYS.settings, JSON.stringify(defaultSettings()));
  if(!localStorage.getItem(LS_KEYS.packs)) localStorage.setItem(LS_KEYS.packs, JSON.stringify(PROMPT_BLOCKS_DEFAULT));
  const oldTemplates = safeJSONParse(localStorage.getItem(LS_KEYS.templates), []);
  if(!Array.isArray(oldTemplates) || oldTemplates.length === 0){
    localStorage.setItem(LS_KEYS.templates, JSON.stringify(defaultTemplates()));
  }
  localStorage.setItem(LS_KEYS.schema, String(SCHEMA_VERSION));
}

function loadSettings(){ return safeJSONParse(localStorage.getItem(LS_KEYS.settings), defaultSettings()); }
function saveSettings(obj){ localStorage.setItem(LS_KEYS.settings, JSON.stringify(obj)); }
function loadTemplates(){
  const raw = localStorage.getItem(LS_KEYS.templates);
  const defaults = defaultTemplates();
  if(!raw){ saveTemplates(defaults); return defaults; }
  const t = safeJSONParse(raw, []);
  if(!Array.isArray(t) || t.length === 0){ saveTemplates(defaults); return defaults; }
  return t;
}
function saveTemplates(arr){ localStorage.setItem(LS_KEYS.templates, JSON.stringify(arr)); }
function loadPacks(){
  const p = safeJSONParse(localStorage.getItem(LS_KEYS.packs), []);
  if(!Array.isArray(p) || p.length === 0){ localStorage.setItem(LS_KEYS.packs, JSON.stringify(PROMPT_BLOCKS_DEFAULT)); return PROMPT_BLOCKS_DEFAULT; }
  return p;
}
function savePacks(arr){ localStorage.setItem(LS_KEYS.packs, JSON.stringify(arr)); }
function loadHistory(){ return safeJSONParse(localStorage.getItem(LS_KEYS.history), []); }
function saveHistory(arr){ localStorage.setItem(LS_KEYS.history, JSON.stringify(arr)); }
function getDraftFromUI(){
  return {
    toolKind: $("#toolKind").value, templateId: activeTemplateId(), goal: $("#goal").value, context: $("#context").value,
    inputs: $("#inputs").value, rules: $("#rules").value, steps: $("#steps").value, outputFormat: $("#outputFormat").value,
    finalPrompt: $("#finalPrompt").value, soraStudio: collectSoraStudioData(), codexPro: collectCodexProData(), shots: window.__soraShots || []
  };
}
function saveDraft(){ localStorage.setItem(LS_KEYS.draft, JSON.stringify(getDraftFromUI())); }
function loadDraft(){ return safeJSONParse(localStorage.getItem(LS_KEYS.draft), null); }
function clearDraft(){ localStorage.removeItem(LS_KEYS.draft); }

function restoreDraftIfAny(){
  const draft = loadDraft();
  if(!draft) return false;
  const templates = loadTemplates();
  if(draft.toolKind) $("#toolKind").value = draft.toolKind;
  if(draft.templateId && templates.some(t => t.id === draft.templateId)) $("#templateSelect").value = draft.templateId;
  ["goal","context","inputs","rules","steps","outputFormat","finalPrompt"].forEach(k => { $("#"+k).value = draft[k] || ""; });
  hydrateSoraStudioData(draft.soraStudio || {});
  hydrateCodexProData(draft.codexPro || {});
  window.__soraShots = Array.isArray(draft.shots) ? draft.shots : [];
  renderShotList();
  return true;
}

function applyVars(tpl, data, settings){
  const map = {
    GOAL: data.goal || "", CONTEXT: data.context || "", INPUTS: data.inputs || "", RULES: data.rules || "", STEPS: data.steps || "", FORMAT: data.outputFormat || "",
    LIEU: settings.vars.LIEU || "", SUJET: settings.vars.SUJET || "", STYLE: settings.vars.STYLE || "", DUREE: settings.vars.DUREE || "", CONTRAINTES: settings.vars.CONTRAINTES || ""
  };
  let out = tpl;
  for(const [k,v] of Object.entries(map)) out = out.replace(new RegExp("\\{" + k + "\\}", "g"), v);
  return out.replace(/\{FORMAT\}/g, data.outputFormat || settings.vars.FORMAT || "");
}
function activeTemplateId(){ return $("#templateSelect").value; }
function setActiveView(view){ $$(".view").forEach(v => v.classList.remove("active")); $("#view-" + view).classList.add("active"); $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view)); }
function templateMatchesTool(tpl, toolKind){ const tags = (tpl.tags || []).map(x=>String(x).toLowerCase()); if(toolKind === "codex") return tags.includes("codex") || tpl.id.includes("codex"); if(toolKind === "sora") return tags.includes("sora") || tpl.id.includes("sora"); return true; }
function pickDefaultTemplateForTool(templates, toolKind){ const match = templates.find(t => templateMatchesTool(t, toolKind)); return match ? match.id : templates[0]?.id; }

function fillTemplateSelect(templates){
  const tool = $("#toolKind").value;
  const sel = $("#templateSelect"); sel.innerHTML = "";
  templates.filter(t => templateMatchesTool(t, tool)).forEach(t => {
    const opt = document.createElement("option"); opt.value = t.id; opt.textContent = t.name; sel.appendChild(opt);
  });
}

function codexChecklistText(){ return "- chemins/imports\n- edge cases\n- validation input\n- migration data\n- tests manuels"; }
function continuityInstruction(level){ return level === "high" ? "Conserver strictement objets/axes/texture entre plans." : level === "medium" ? "Continuité majoritaire, transitions contrôlées." : "Variations libres tolérées."; }
function detailInstruction(level){ return level === "high" ? "Maximiser textures, micro-détails, matière naturelle." : level === "med" ? "Détails équilibrés sans surcharge." : "Description simple, lisible."; }

function collectSoraStudioData(){
  return {
    duration: $("#soraDuration")?.value || "10s", durationCustom: $("#soraDurationCustom")?.value || "", ratio: $("#soraRatio")?.value || "16:9", fps: $("#soraFps")?.value || "24",
    lens: $("#soraLens")?.value || "24mm", cameraMove: $("#soraCameraMove")?.value || "drone", lighting: $("#soraLighting")?.value || "golden hour",
    weather: $("#soraWeather")?.value || "clear", mood: $("#soraMood")?.value || "awe", continuity: $("#soraContinuity")?.value || "high",
    detail: $("#soraDetail")?.value || "high", negativeList: $("#soraNegativeList")?.value || ""
  };
}
function hydrateSoraStudioData(d){
  if(!d) return;
  Object.entries({ soraDuration: d.duration, soraDurationCustom: d.durationCustom, soraRatio: d.ratio, soraFps: d.fps, soraLens: d.lens, soraCameraMove: d.cameraMove, soraLighting: d.lighting, soraWeather: d.weather, soraMood: d.mood, soraContinuity: d.continuity, soraDetail: d.detail, soraNegativeList: d.negativeList }).forEach(([id,val])=>{ if($("#"+id) && val!=null) $("#"+id).value = val; });
}

function collectCodexProData(){
  const style = ($('input[name="codexOutputStyle"]:checked') || {}).value || "patch_minimal";
  const constraints = $$(".codexConstraint:checked").map(x=>x.value);
  return { style, constraints, risks: $("#codexRisks").value, files: $("#codexFiles").value, dod: $("#codexDod").value };
}
function hydrateCodexProData(d){
  if(!d) return;
  const radio = $(`input[name="codexOutputStyle"][value="${d.style}"]`); if(radio) radio.checked = true;
  $$(".codexConstraint").forEach(ch => ch.checked = (d.constraints || []).includes(ch.value));
  $("#codexRisks").value = d.risks || ""; $("#codexFiles").value = d.files || ""; $("#codexDod").value = d.dod || "";
}

function ensureShotListFallback(studio){
  if(Array.isArray(window.__soraShots) && window.__soraShots.length > 0) return window.__soraShots;
  return [
    { desc: `Establishing ${studio.weather} en ${studio.lighting}`, duration: "3s", camera: studio.lens, move: studio.cameraMove, constraints: "Cohérence globale" },
    { desc: `Plan intermédiaire mood ${studio.mood}`, duration: "4s", camera: studio.lens, move: "steadycam", constraints: "Continuité action" },
    { desc: "Plan final de clôture cinématique", duration: "3s", camera: "50mm", move: "dolly", constraints: "Sortie stable" }
  ];
}

function generateSoraStudioPrompt(){
  const s = collectSoraStudioData();
  const duration = s.duration === "custom" ? (s.durationCustom || "20s") : s.duration;
  const shots = ensureShotListFallback(s);
  const shotLines = shots.map((sh, i) => `Plan ${i+1} — ${sh.desc} | durée: ${sh.duration || "auto"} | caméra: ${sh.camera || s.lens} | mouvement: ${sh.move || s.cameraMove} | contraintes: ${sh.constraints || "-"}`).join("\n");
  return normalizeSpaces(`SORA STUDIO (AUTO)\n\nPARAMÈTRES\n- Durée: ${duration}\n- Ratio: ${s.ratio}\n- FPS: ${s.fps}\n- Lens: ${s.lens}\n- Mouvement caméra: ${s.cameraMove}\n- Lighting: ${s.lighting}\n- Weather: ${s.weather}\n- Mood: ${s.mood}\n- Continuity level: ${s.continuity} (${continuityInstruction(s.continuity)})\n- Detail level: ${s.detail} (${detailInstruction(s.detail)})\n\nDO/DON'T\n- Do: continuité temporelle, transitions douces, réalisme matière\n- Don't: texte overlay, watermark, glitch, distorsions, membres/visages incohérents\n\nSHOT LIST\n${shotLines}\n\nNEGATIVE CONSTRAINTS\n${s.negativeList || "no text, no watermark, no glitch, no distortion, no extra limbs"}\n\nVARIANTE A\nRendu naturel, rythme contemplatif, caméra stable cinématique.\n\nVARIANTE B\nRendu contrasté, dynamique progressive, tension visuelle contrôlée.`);
}

function generateCodexProPrompt(){
  const d = collectCodexProData();
  const styleMap = { patch_minimal: "Patch minimal (fichiers modifiés only)", plan_patch: "Plan + patch", full_code: "Full code (seulement si demandé)" };
  const txt = `CODEX PRO\n\nMINI SPEC\n- Objectif: ${normalizeSpaces($("#goal").value) || "(à préciser)"}\n- Contexte: ${normalizeSpaces($("#context").value) || "(à préciser)"}\n- Inputs: ${normalizeSpaces($("#inputs").value) || "(à préciser)"}\n\nCONTRAINTES\n${d.constraints.map(x=>`- ${x}`).join("\n")}\n\nBLOC RISQUES\n${normalizeSpaces(d.risks) || "-"}\n\nBLOC FICHIERS\n${normalizeSpaces(d.files) || "-"}\n\nPLAN DE PATCH\n1) Diagnostic rapide\n2) Découpe patch minimal\n3) Implémentation ciblée\n4) Validation + edge cases\n5) Migration data/backward compat\n6) Notes de tests manuels\n\nCHECKLIST AUTO\n${codexChecklistText()}\n\nACCEPTANCE CRITERIA\n- Fonctionnalité conforme à l'objectif\n- Aucun impact UI non demandé\n- Offline-first maintenu\n- Compat iPhone conservée\n\nDEFINITION OF DONE\n${normalizeSpaces(d.dod) || "Toutes vérifications ci-dessus validées."}\n\nSTYLE DE SORTIE\n${styleMap[d.style]}\n\nSORTIE\ncode complet des fichiers modifiés seulement.`;
  $("#finalPrompt").value = normalizeSpaces(txt);
  saveDraft();
  toast("Codex Pro généré ✅");
}

function buildPrompt(){
  const templates = loadTemplates();
  const settings = loadSettings();
  const toolKind = $("#toolKind").value;
  let tplId = activeTemplateId();
  if(!tplId || !templates.some(t=>t.id===tplId)){ tplId = pickDefaultTemplateForTool(templates, toolKind); $("#templateSelect").value = tplId; }
  const tpl = templates.find(t=>t.id===tplId);
  const data = { toolKind, goal: normalizeSpaces($("#goal").value), context: normalizeSpaces($("#context").value), inputs: normalizeSpaces($("#inputs").value), rules: normalizeSpaces($("#rules").value), steps: normalizeSpaces($("#steps").value), outputFormat: normalizeSpaces($("#outputFormat").value) };
  let final = tpl?.id === "sora_studio_auto" ? generateSoraStudioPrompt() : normalizeSpaces(applyVars(tpl.body, data, settings));
  $("#finalPrompt").value = final;
  return { tpl, data, final, settings };
}

function insertAtCursor(el, text){ const start = el.selectionStart ?? el.value.length; const end = el.selectionEnd ?? el.value.length; el.value = el.value.slice(0, start) + text + el.value.slice(end); const pos = start + text.length; el.selectionStart = el.selectionEnd = pos; el.focus(); }
async function copyText(text){ try{ await navigator.clipboard.writeText(text); toast("Copié ✅"); }catch{ const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Copié ✅"); } }
function downloadFile(filename, content, mime="text/plain"){ const blob = new Blob([content], {type: mime}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

function renderTemplatesList(){
  const templates = loadTemplates();
  const q = ($("#tplSearch").value || "").toLowerCase().trim();
  const list = $("#tplList"); list.innerHTML = "";
  templates.filter(t => !q || `${t.name} ${(t.tags||[]).join(",")}`.toLowerCase().includes(q)).forEach(t => {
    const div = document.createElement("div"); div.className = "item"; div.dataset.id = t.id;
    div.innerHTML = `<div class="item-title">${escapeHtml(t.name)}</div><div class="item-meta">${escapeHtml((t.tags||[]).join(", "))}</div><div class="badges">${(t.tags||[]).slice(0,8).map(tag=>`<span class="badge">${escapeHtml(tag)}</span>`).join("")}</div>`;
    div.addEventListener("click", ()=>openTemplateEditor(t.id)); list.appendChild(div);
  });
  if(!list.children.length) list.innerHTML = `<div class="item"><div class="item-title">Aucun template</div><div class="item-meta">Crée-en un avec “+ Nouveau”.</div></div>`;
}
function openTemplateEditor(id){ const t = loadTemplates().find(x => x.id === id); if(!t) return; $("#tplName").value=t.name||""; $("#tplTags").value=(t.tags||[]).join(", "); $("#tplBody").value=t.body||""; $("#btnTplDelete").dataset.id=id; $("#btnTplSave").dataset.id=id; toast("Template chargé"); }
function createNewTemplate(){ const id = uid(); $("#tplName").value="Nouveau template"; $("#tplTags").value=""; $("#tplBody").value="OBJECTIF\n{GOAL}"; $("#btnTplDelete").dataset.id=id; $("#btnTplSave").dataset.id=id; toast("Nouveau template prêt"); }
function saveTemplateFromEditor(){ const id = $("#btnTplSave").dataset.id || uid(); const templates = loadTemplates(); const obj = { id, name: ($("#tplName").value || "").trim() || "Sans nom", tags: ($("#tplTags").value || "").split(",").map(s=>s.trim()).filter(Boolean), body: $("#tplBody").value || "" }; const idx = templates.findIndex(t=>t.id===id); if(idx>=0) templates[idx]=obj; else templates.unshift(obj); saveTemplates(templates); fillTemplateSelect(templates); renderTemplatesList(); toast("Template sauvegardé ✅"); }
function deleteTemplateFromEditor(){ const id = $("#btnTplDelete").dataset.id; if(!id) return; let templates = loadTemplates().filter(t=>t.id!==id); if(!templates.length) templates = defaultTemplates(); saveTemplates(templates); fillTemplateSelect(templates); renderTemplatesList(); toast("Supprimé ✅"); }

function renderHistory(){
  const hist = loadHistory();
  const q = ($("#histSearch").value || "").toLowerCase().trim();
  const list = $("#histList"); list.innerHTML = "";
  hist.filter(h=>!q || `${h.title} ${h.toolKind} ${h.templateName||""} ${h.final||""}`.toLowerCase().includes(q)).forEach(h=>{
    const div = document.createElement("div"); div.className = "item"; div.dataset.id = h.id;
    div.innerHTML = `<div class="item-title">${escapeHtml(h.title)}</div><div class="item-meta">${escapeHtml(h.toolKind.toUpperCase())} · ${escapeHtml(new Date(h.createdAt).toLocaleString())} · ${escapeHtml(h.templateName||"")}</div><div class="badges"><span class="badge">${escapeHtml(h.toolKind)}</span>${h.favorite ? `<span class="badge">⭐ favori</span>` : ``}</div>`;
    div.addEventListener("click", ()=>loadHistoryItem(h.id)); list.appendChild(div);
  });
  if(!list.children.length) list.innerHTML = `<div class="item"><div class="item-title">Aucun historique</div><div class="item-meta">Utilise “Sauver” dans Créer.</div></div>`;
}
function loadHistoryItem(id){ const h = loadHistory().find(x=>x.id===id); if(!h) return; $("#toolKind").value = h.toolKind || "codex"; ["goal","context","inputs","rules","steps","outputFormat"].forEach(k=>$("#"+k).value = h.data?.[k] || ""); const templates = loadTemplates(); fillTemplateSelect(templates); if(templates.some(t=>t.id===h.templateId)) $("#templateSelect").value = h.templateId; $("#finalPrompt").value = h.final || ""; toggleToolSections(); setActiveView("builder"); toast("Historique rechargé ✅"); }
function saveCurrentToHistory({tpl, data, final}){ const hist = loadHistory(); hist.unshift({ id: uid(), createdAt: nowISO(), toolKind: data.toolKind, templateId: tpl.id, templateName: tpl.name, data, final, favorite: false, soraStudio: collectSoraStudioData(), codexPro: collectCodexProData() }); saveHistory(hist.slice(0, 300)); toast("Sauvé ✅"); }
function toggleFavoriteCurrent(){ const final = normalizeSpaces($("#finalPrompt").value); if(!final){ toast("Rien à favoriser"); return; } let hist = loadHistory(); const i = hist.findIndex(h => (h.final||"")===final); if(i>=0){ hist[i].favorite = !hist[i].favorite; saveHistory(hist); toast(hist[i].favorite ? "Favori ⭐" : "Retiré"); } else { const templates=loadTemplates(); const tpl=templates.find(t=>t.id===activeTemplateId())||templates[0]; const data={ toolKind: $("#toolKind").value, goal:normalizeSpaces($("#goal").value), context:normalizeSpaces($("#context").value), inputs:normalizeSpaces($("#inputs").value), rules:normalizeSpaces($("#rules").value), steps:normalizeSpaces($("#steps").value), outputFormat:normalizeSpaces($("#outputFormat").value)}; hist.unshift({id:uid(),createdAt:nowISO(),toolKind:data.toolKind,templateId:tpl.id,templateName:tpl.name,data,final,favorite:true}); saveHistory(hist.slice(0,300)); toast("Favori ⭐"); } renderHistory(); }

function exportTXT(){ const txt = normalizeSpaces($("#finalPrompt").value); if(!txt){ toast("Prompt vide"); return; } downloadFile(`prompt_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`, txt, "text/plain"); }
function exportJSON(){
  const templates = loadTemplates(); const settings = loadSettings();
  const payload = { exportedAt: nowISO(), app: "Prompt Factory V2", schema: SCHEMA_VERSION, toolKind: $("#toolKind").value, templateId: activeTemplateId(), fields: { goal: $("#goal").value, context: $("#context").value, inputs: $("#inputs").value, rules: $("#rules").value, steps: $("#steps").value, outputFormat: $("#outputFormat").value }, finalPrompt: $("#finalPrompt").value, settings, templatesCount: templates.length, soraStudio: collectSoraStudioData(), codexPro: collectCodexProData(), checksum: quickHash(JSON.stringify({ templatesCount: templates.length, final: $("#finalPrompt").value })) };
  downloadFile(`prompt_project_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`, JSON.stringify(payload, null, 2), "application/json");
}
function exportQuickCopy(){ const txt = normalizeSpaces($("#finalPrompt").value); if(!txt){ toast("Prompt vide"); return; } copyText(txt); }

function fillSettingsUI(){ const s = loadSettings(); $("#prefDefaultType").value = s.defaultType || "codex"; $("#varLieu").value = s.vars.LIEU || ""; $("#varSujet").value = s.vars.SUJET || ""; $("#varStyle").value = s.vars.STYLE || ""; $("#varDuree").value = s.vars.DUREE || ""; $("#varFormat").value = s.vars.FORMAT || ""; $("#varContraintes").value = s.vars.CONTRAINTES || ""; }
function saveSettingsFromUI(){ const s = loadSettings(); s.defaultType=$("#prefDefaultType").value; s.vars.LIEU=$("#varLieu").value; s.vars.SUJET=$("#varSujet").value; s.vars.STYLE=$("#varStyle").value; s.vars.DUREE=$("#varDuree").value; s.vars.FORMAT=$("#varFormat").value; s.vars.CONTRAINTES=$("#varContraintes").value; saveSettings(s); toast("Paramètres sauvés ✅"); }
function factoryReset(){ Object.values(LS_KEYS).forEach(k=>localStorage.removeItem(k)); init(); toast("Reset complet ✅"); }

function updateAnalysisResult(result){
  if(!result){ $("#analysisResult").textContent = ""; return; }
  $("#analysisResult").textContent = `Score: ${result.score}/100 | Variables non résolues: ${result.unresolved.join(", ") || "aucune"} | Suggestions: ${result.suggestions.join(" | ")}`;
}
function analyzePromptText(text){
  const t = (text || "").toLowerCase();
  const checks = [
    { key: "objectif", rx: /(objectif|mission|but)/, pts: 15 },
    { key: "contraintes", rx: /(contrainte|règle|do n't|don't)/, pts: 15 },
    { key: "inputs", rx: /(input|entrée|donnée fournie)/, pts: 10 },
    { key: "étapes", rx: /(étape|plan)/, pts: 15 },
    { key: "format", rx: /(format de sortie|sortie)/, pts: 15 },
    { key: "risques", rx: /(risque)/, pts: 15 },
    { key: "checklist", rx: /(checklist|criteria|critère)/, pts: 15 }
  ];
  let score = 0;
  checks.forEach(c => { if(c.rx.test(t)) score += c.pts; });
  const unresolved = Array.from(new Set((text.match(/\{[A-Z_]+\}/g) || [])));
  const suggestions = [];
  if(!/objectif/.test(t)) suggestions.push("Ajoute une section Objectif claire");
  if(!/contrainte/.test(t)) suggestions.push("Ajoute une section Contraintes");
  if(!/(format de sortie|sortie)/.test(t)) suggestions.push("Spécifie le format attendu");
  if(!/risque/.test(t)) suggestions.push("Ajoute risques + mitigations");
  if(!/(checklist|critère)/.test(t)) suggestions.push("Ajoute critères d'acceptation / checklist");
  while(suggestions.length < 5) suggestions.push("Clarifie les étapes exécutable en ordre");
  return { score: Math.min(100, score), unresolved, suggestions: suggestions.slice(0,5) };
}
function applyImprovementsToPrompt(){
  const txt = $("#finalPrompt").value || "";
  const a = analyzePromptText(txt);
  let out = txt;
  if(!/OBJECTIF/i.test(out)) out = `OBJECTIF\nPréciser le résultat concret attendu.\n\n${out}`;
  if(!/CONTRAINTES/i.test(out)) out += `\n\nCONTRAINTES\n- Pas de dépendances externes\n- Backward compatible\n- Pas de régression`;
  if(!/FORMAT DE SORTIE/i.test(out)) out += `\n\nFORMAT DE SORTIE\n- Code complet des fichiers modifiés seulement.`;
  if(!/RISQUES/i.test(out)) out += `\n\nRISQUES + MITIGATIONS\n- Risque: oubli edge case | Mitigation: checklist dédiée`;
  if(!/CHECKLIST/i.test(out)) out += `\n\nCHECKLIST\n- imports\n- validation input\n- tests manuels`;
  $("#finalPrompt").value = normalizeSpaces(out);
  updateAnalysisResult(a);
  saveDraft();
  toast("Améliorations appliquées ✅");
}

function renderBlockChips(){
  const container = $("#blockChips");
  container.innerHTML = "";
  loadPacks().forEach(block => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = block.label;
    btn.dataset.insert = `\n\n${block.text}\n`;
    btn.addEventListener("click", ()=>{
      const active = document.activeElement;
      if(active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) insertAtCursor(active, btn.dataset.insert);
      else insertAtCursor($("#finalPrompt"), btn.dataset.insert);
      toast("Bloc inséré");
    });
    container.appendChild(btn);
  });
}

function renderSoraPresets(){
  const box = $("#soraPresets"); box.innerHTML = "";
  SORA_PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "chip"; btn.textContent = p.name;
    btn.addEventListener("click", ()=> applySoraPreset(p));
    box.appendChild(btn);
  });
}

function applySoraPreset(preset){
  hydrateSoraStudioData({ duration: "15s", ratio: "16:9", fps: "24", lens: preset.lens, cameraMove: preset.move, lighting: preset.lighting, weather: preset.weather, mood: preset.mood, continuity: "high", detail: "high", negativeList: "no text, no watermark, no glitch, no distortion, no extra limbs" });
  window.__soraShots = preset.shots.map(s => ({ desc: s, duration: "5s", camera: preset.lens, move: preset.move, constraints: "Continuité stricte" }));
  renderShotList();
  $("#context").value = normalizeSpaces(`${$("#context").value}\nPreset Sora: ${preset.name} (${preset.biome})`);
  saveDraft();
  toast(`Preset: ${preset.name}`);
}

function renderShotList(){
  const list = $("#soraShotList");
  list.innerHTML = "";
  (window.__soraShots || []).forEach((shot, idx) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="field"><label>Plan ${idx+1} description</label><textarea class="textarea shot-desc" rows="2">${escapeHtml(shot.desc || "")}</textarea></div>
      <div class="grid2">
        <div class="field"><label>Durée</label><input class="input shot-duration" value="${escapeHtml(shot.duration || "")}" /></div>
        <div class="field"><label>Caméra</label><input class="input shot-camera" value="${escapeHtml(shot.camera || "")}" /></div>
        <div class="field"><label>Mouvement</label><input class="input shot-move" value="${escapeHtml(shot.move || "")}" /></div>
        <div class="field"><label>Contraintes</label><input class="input shot-constraints" value="${escapeHtml(shot.constraints || "")}" /></div>
      </div>
      <div class="row gap"><button class="btn btn-ghost shot-up">↑</button><button class="btn btn-ghost shot-down">↓</button><button class="btn btn-ghost danger shot-del">Supprimer</button></div>`;
    item.querySelector(".shot-up").addEventListener("click", ()=> moveShot(idx, -1));
    item.querySelector(".shot-down").addEventListener("click", ()=> moveShot(idx, 1));
    item.querySelector(".shot-del").addEventListener("click", ()=> { window.__soraShots.splice(idx,1); renderShotList(); saveDraft(); });
    item.querySelectorAll("textarea,input").forEach(el => el.addEventListener("input", ()=>{ syncShotItem(item, idx); saveDraft(); }));
    list.appendChild(item);
  });
}
function syncShotItem(item, idx){
  if(!window.__soraShots[idx]) return;
  window.__soraShots[idx] = { desc: item.querySelector(".shot-desc").value, duration: item.querySelector(".shot-duration").value, camera: item.querySelector(".shot-camera").value, move: item.querySelector(".shot-move").value, constraints: item.querySelector(".shot-constraints").value };
}
function moveShot(idx, delta){ const j = idx + delta; if(j<0 || j>=window.__soraShots.length) return; const arr = window.__soraShots; [arr[idx], arr[j]] = [arr[j], arr[idx]]; renderShotList(); saveDraft(); }
function addShot(){ window.__soraShots = window.__soraShots || []; window.__soraShots.push({ desc: "Nouveau plan", duration: "", camera: "", move: "", constraints: "" }); renderShotList(); saveDraft(); }

function runSoraRandomPro(){
  const biome = randomPick(SORA_VARIATION_DATA.biomes);
  const mood = randomPick(SORA_VARIATION_DATA.mood);
  let weather = randomPick(SORA_VARIATION_DATA.weather);
  if(mood === "romantic" && weather === "snow") weather = "rain";
  const lens = mood === "epic" ? "24mm" : randomPick(SORA_VARIATION_DATA.lens);
  const move = mood === "calm" ? "steadycam" : randomPick(SORA_VARIATION_DATA.cameraMoves);
  const lighting = mood === "mysterious" ? "night" : randomPick(SORA_VARIATION_DATA.timeOfDay);
  hydrateSoraStudioData({ duration: "15s", ratio: "16:9", fps: "24", lens, cameraMove: move, lighting, weather, mood, continuity: "high", detail: "high", negativeList: "no text, no watermark, no glitch" });
  window.__soraShots = [
    { desc: `Establishing ${biome} sous ${weather}`, duration: "5s", camera: lens, move, constraints: "continuité" },
    { desc: `Transition vers élément signature ${mood}`, duration: "5s", camera: lens, move: "dolly", constraints: "texture réaliste" },
    { desc: `Clôture cinématique ${lighting}`, duration: "5s", camera: "50mm", move: "crane", constraints: "pas de glitch" }
  ];
  renderShotList();
  $("#goal").value = normalizeSpaces(`${$("#goal").value}\nSora random pro: ${biome}, ${weather}, ${mood}`);
  $("#finalPrompt").value = generateSoraStudioPrompt();
  saveDraft();
  toast("Variation Random pro appliquée ✅");
}

function toggleToolSections(){
  const isSora = $("#toolKind").value === "sora";
  $("#soraStudioSection").style.display = isSora ? "block" : "none";
  $("#codexProSection").style.display = isSora ? "none" : "block";
}

function parseJSONFile(file, cb){ const fr = new FileReader(); fr.onload = () => { cb(safeJSONParse(fr.result, null)); }; fr.readAsText(file); }

function exportTemplatesPack(){
  const content = { version: SCHEMA_VERSION, date: nowISO(), kind: "templates", content: loadTemplates() };
  content.checksum = quickHash(JSON.stringify(content.content));
  downloadFile(`templates_pack_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`, JSON.stringify(content, null, 2), "application/json");
}
function importTemplatesPack(mode){
  const input = $("#fileTemplates");
  input.onchange = () => {
    const file = input.files?.[0];
    if(!file) return;
    parseJSONFile(file, (data)=>{
      if(!data || !Array.isArray(data.content)){ toast("JSON templates invalide"); return; }
      const current = loadTemplates();
      const next = mode === "replace" ? data.content : [...current.filter(c=>!data.content.some(n=>n.id===c.id)), ...data.content];
      saveTemplates(next);
      fillTemplateSelect(next); renderTemplatesList();
      toast(`Templates importés (${mode}) ✅`);
    });
  };
  input.click();
}
function exportPacks(){
  const content = { version: SCHEMA_VERSION, date: nowISO(), kind: "packs", content: loadPacks() };
  content.checksum = quickHash(JSON.stringify(content.content));
  downloadFile(`packs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`, JSON.stringify(content, null, 2), "application/json");
}
function importPacks(){
  const input = $("#filePacks");
  input.onchange = () => {
    const file = input.files?.[0];
    if(!file) return;
    parseJSONFile(file, (data)=>{
      if(!data || !Array.isArray(data.content)){ toast("JSON packs invalide"); return; }
      savePacks(data.content); renderBlockChips(); toast("Packs importés ✅");
    });
  };
  input.click();
}

function initNav(){ $$(".nav-item").forEach(btn=>btn.addEventListener("click", ()=>{ const v = btn.dataset.view; setActiveView(v); if(v==="templates") renderTemplatesList(); if(v==="history") renderHistory(); if(v==="settings") fillSettingsUI(); })); }
function initChips(){ $$(".chip[data-insert]").forEach(ch=>{ ch.addEventListener("click", ()=>{ const active = document.activeElement; if(active && (active.tagName==="TEXTAREA" || active.tagName==="INPUT")) insertAtCursor(active, ch.dataset.insert); else insertAtCursor($("#finalPrompt"), ch.dataset.insert); toast("Inséré"); }); }); }

function init(){
  migrateStorage();
  window.__soraShots = [];
  const templates = loadTemplates();
  $("#toolKind").value = loadSettings().defaultType || "codex";
  fillTemplateSelect(templates);
  $("#templateSelect").value = pickDefaultTemplateForTool(templates, $("#toolKind").value);
  renderBlockChips();
  renderSoraPresets();
  renderShotList();
  toggleToolSections();

  $("#btnGenerate").addEventListener("click", ()=>{ buildPrompt(); saveDraft(); toast("Prompt généré ✅"); });
  $("#btnReset").addEventListener("click", ()=>{ ["#goal","#context","#inputs","#rules","#steps","#outputFormat","#finalPrompt","#codexRisks","#codexFiles","#codexDod","#soraNegativeList","#analysisResult"].forEach(sel=>{ if($(sel)) $(sel).value = ""; if(sel==="#analysisResult") $(sel).textContent=""; }); window.__soraShots=[]; renderShotList(); clearDraft(); toast("Réinitialisé"); });
  $("#btnCopy").addEventListener("click", exportQuickCopy); $("#btnQuickCopy").addEventListener("click", exportQuickCopy); $("#btnExportTxt").addEventListener("click", exportTXT); $("#btnExportJson").addEventListener("click", exportJSON);
  $("#btnTidy").addEventListener("click", ()=>{ $("#finalPrompt").value = normalizeSpaces($("#finalPrompt").value); saveDraft(); toast("Nettoyé ✅"); });
  $("#toolKind").addEventListener("change", ()=>{ fillTemplateSelect(loadTemplates()); $("#templateSelect").value = pickDefaultTemplateForTool(loadTemplates(), $("#toolKind").value); toggleToolSections(); buildPrompt(); saveDraft(); });
  $("#templateSelect").addEventListener("change", ()=>{ buildPrompt(); saveDraft(); });
  $("#btnNewFromTemplate").addEventListener("click", ()=>buildPrompt());
  $("#btnSaveToHistory").addEventListener("click", ()=>{ const res = buildPrompt(); saveCurrentToHistory(res); renderHistory(); });
  $("#btnFavorite").addEventListener("click", toggleFavoriteCurrent);

  $("#tplSearch").addEventListener("input", renderTemplatesList); $("#btnTplNew").addEventListener("click", ()=>{ createNewTemplate(); renderTemplatesList(); }); $("#btnTplSave").addEventListener("click", saveTemplateFromEditor); $("#btnTplDelete").addEventListener("click", deleteTemplateFromEditor);
  $("#histSearch").addEventListener("input", renderHistory); $("#btnHistClear").addEventListener("click", ()=>{ saveHistory([]); renderHistory(); toast("Historique vidé ✅"); });
  $("#btnSettingsSave").addEventListener("click", saveSettingsFromUI); $("#btnFactoryReset").addEventListener("click", factoryReset);
  $("#btnAnalyzePrompt").addEventListener("click", ()=>{ const r = analyzePromptText($("#finalPrompt").value); window.__analysis = r; updateAnalysisResult(r); toast("Analyse prête ✅"); });
  $("#btnApplyImprovements").addEventListener("click", applyImprovementsToPrompt);
  $("#btnGenerateCodexPro").addEventListener("click", generateCodexProPrompt);
  $("#btnSoraAddShot").addEventListener("click", addShot);
  $("#btnSoraRandomPro").addEventListener("click", runSoraRandomPro);
  $("#btnSoraAuto").addEventListener("click", ()=>{ $("#templateSelect").value = "sora_studio_auto"; $("#finalPrompt").value = generateSoraStudioPrompt(); saveDraft(); toast("Sora Studio auto ✅"); });

  $("#btnExportTemplates").addEventListener("click", exportTemplatesPack);
  $("#btnImportTemplatesMerge").addEventListener("click", ()=>importTemplatesPack("merge"));
  $("#btnImportTemplatesReplace").addEventListener("click", ()=>importTemplatesPack("replace"));
  $("#btnExportPacks").addEventListener("click", exportPacks);
  $("#btnImportPacks").addEventListener("click", importPacks);

  initNav(); initChips();
  const draftRestored = restoreDraftIfAny();
  ["#goal", "#context", "#inputs", "#rules", "#steps", "#outputFormat", "#finalPrompt", "#codexRisks", "#codexFiles", "#codexDod", "#soraNegativeList", "#soraDuration", "#soraDurationCustom", "#soraRatio", "#soraFps", "#soraLens", "#soraCameraMove", "#soraLighting", "#soraWeather", "#soraMood", "#soraContinuity", "#soraDetail"].forEach(sel=>{ if($(sel)) $(sel).addEventListener("input", ()=>{ clearTimeout(window.__draftTimer); window.__draftTimer = setTimeout(saveDraft, 200); }); });
  document.addEventListener("keydown", (e)=>{ if((e.ctrlKey || e.metaKey) && e.key === "Enter"){ e.preventDefault(); buildPrompt(); saveDraft(); toast("Prompt généré ✅"); } });
  if(!draftRestored) buildPrompt();
}

document.addEventListener("DOMContentLoaded", init);
