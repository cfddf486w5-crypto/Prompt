// Prompt Builder — Mix Sora + Codex (V1)
// Local-only, offline-first. No network calls.

const LS_KEYS = {
  templates: "pb_templates_v1",
  history: "pb_history_v1",
  settings: "pb_settings_v1"
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function nowISO(){
  const d = new Date();
  return d.toISOString();
}

function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>t.classList.remove("show"), 1600);
}

function safeJSONParse(s, fallback){
  try { return JSON.parse(s); } catch { return fallback; }
}

function loadSettings(){
  return safeJSONParse(localStorage.getItem(LS_KEYS.settings), {
    defaultType: "codex",
    vars: {
      LIEU: "",
      SUJET: "",
      STYLE: "",
      DUREE: "",
      FORMAT: "",
      CONTRAINTES: ""
    }
  });
}
function saveSettings(obj){
  localStorage.setItem(LS_KEYS.settings, JSON.stringify(obj));
}

function defaultTemplates(){
  return [
    {
      id: "tpl_codex_strict_ui",
      name: "Codex — Ajout sans toucher au UI",
      tags: ["codex","ui","safe"],
      body:
`RÔLE
Tu es un ingénieur logiciel senior. Tu appliques les meilleures pratiques et tu fais attention aux régressions.

OBJECTIF
{GOAL}

CONTEXTE
{CONTEXT}

ENTRÉES FOURNIES
{INPUTS}

RÈGLES / CONTRAINTES
- Ne modifie pas le UI existant sauf si explicitement demandé.
- Ajoute le minimum de code nécessaire.
- Vérifie les chemins, imports, et l'intégration.
- Fournis une liste claire des fichiers modifiés et pourquoi.
- Si une info manque, fais une hypothèse raisonnable et explique-la.

TÂCHES
{STEPS}

FORMAT DE SORTIE
{FORMAT}

DONNE LE CODE COMPLET UNIQUEMENT POUR LES FICHIERS MODIFIÉS.
`
    },
    {
      id: "tpl_codex_refactor",
      name: "Codex — Refactor propre + tests rapides",
      tags: ["codex","refactor","quality"],
      body:
`MISSION
{GOAL}

CONTEXTE
{CONTEXT}

INFORMATIONS
{INPUTS}

CONTRAINTES
{RULES}

PLAN
1) Analyse rapide et risques.
2) Changements proposés (petits commits logiques).
3) Code.
4) Vérifications (checklist).
5) Instructions pour exécuter / tester.

ÉTAPES DEMANDÉES
{STEPS}

FORMAT
{FORMAT}
`
    },
    {
      id: "tpl_sora_cinematic",
      name: "Sora — Cinématique ultra réaliste",
      tags: ["sora","video","cinema"],
      body:
`GÉNÈRE UNE VIDÉO (SORA)

SUJET
{SUJET}

LIEU / DÉCOR
{LIEU}

STYLE VISUEL
{STYLE}

DURÉE
{DUREE}

DIRECTIVES
- Ultra réaliste, détails élevés, mouvement de caméra cinématique.
- Lumière naturelle crédible + profondeur de champ.
- Aucune superposition de texte, aucun watermark.
- Continuité: éviter les sauts incohérents entre plans.
- Audio: (si applicable) ambiances naturelles discrètes.

SCÉNARIO / PLANS
{STEPS}

CONTRAINTES SPÉCIALES
{CONTRAINTES}
`
    },
    {
      id: "tpl_sora_random",
      name: "Sora — Paysages “au hasard” (guidé)",
      tags: ["sora","paysage","random"],
      body:
`GÉNÈRE UNE VIDÉO (SORA)

OBJECTIF
Créer un clip paysage ultra réaliste avec une variation forte à chaque génération, tout en restant cohérent et cinématique.

PARAMÈTRES
- Durée: {DUREE}
- Style: {STYLE}
- Rendu: ultra réaliste, HDR, détails fins

CONSIGNES DE VARIATION (IMPORTANT)
À CHAQUE GÉNÉRATION, choisis aléatoirement:
- 1 biome (océan / fjord / désert / forêt ancestrale / toundra / montagne / glaciers)
- 1 météo (ciel clair / brume / tempête lointaine / golden hour / nuit étoilée)
- 1 mouvement caméra (drone smooth / travelling bas / timelapse discret / steadycam)
- 1 élément signature (lac miroir / falaises / rivière / dunes / aurore / pluie fine)

SCÈNE
Décris un plan principal unique très fort + 2 micro-variations de cadrage.

CONTRAINTES
{CONTRAINTES}
`
    }
  ];
}

function loadTemplates(){
  const raw = localStorage.getItem(LS_KEYS.templates);
  if(!raw){
    const init = defaultTemplates();
    localStorage.setItem(LS_KEYS.templates, JSON.stringify(init));
    return init;
  }
  const t = safeJSONParse(raw, []);
  if(!Array.isArray(t) || t.length === 0){
    const init = defaultTemplates();
    localStorage.setItem(LS_KEYS.templates, JSON.stringify(init));
    return init;
  }
  return t;
}

function saveTemplates(arr){
  localStorage.setItem(LS_KEYS.templates, JSON.stringify(arr));
}

function loadHistory(){
  const raw = localStorage.getItem(LS_KEYS.history);
  return safeJSONParse(raw, []);
}
function saveHistory(arr){
  localStorage.setItem(LS_KEYS.history, JSON.stringify(arr));
}

function uid(){
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function normalizeSpaces(s){
  return (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function applyVars(tpl, data, settings){
  const map = {
    GOAL: data.goal || "",
    CONTEXT: data.context || "",
    INPUTS: data.inputs || "",
    RULES: data.rules || "",
    STEPS: data.steps || "",
    FORMAT: data.outputFormat || "",
    // quick variables
    LIEU: settings.vars.LIEU || "",
    SUJET: settings.vars.SUJET || "",
    STYLE: settings.vars.STYLE || "",
    DUREE: settings.vars.DUREE || "",
    CONTRAINTES: settings.vars.CONTRAINTES || "",
    FORMAT2: settings.vars.FORMAT || ""
  };

  let out = tpl;
  for(const [k,v] of Object.entries(map)){
    const re = new RegExp("\\{" + k + "\\}", "g");
    out = out.replace(re, v);
  }

  // For convenience: if template uses {FORMAT} but user uses settings var, we already mapped.
  out = out.replace(/\{FORMAT\}/g, data.outputFormat || settings.vars.FORMAT || "");
  out = out.replace(/\{CONTRAINTES\}/g, data.rules || settings.vars.CONTRAINTES || "");

  // If user inserted quick vars like {LIEU} in their own prompt, replace too:
  out = out.replace(/\{LIEU\}/g, settings.vars.LIEU || "");
  out = out.replace(/\{SUJET\}/g, settings.vars.SUJET || "");
  out = out.replace(/\{STYLE\}/g, settings.vars.STYLE || "");
  out = out.replace(/\{DUREE\}/g, settings.vars.DUREE || "");
  out = out.replace(/\{FORMAT\}/g, data.outputFormat || settings.vars.FORMAT || "");
  return out;
}

function activeTemplateId(){
  return $("#templateSelect").value;
}

function setActiveView(view){
  $$(".view").forEach(v => v.classList.remove("active"));
  $("#view-" + view).classList.add("active");
  $$(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
}

function fillTemplateSelect(templates){
  const sel = $("#templateSelect");
  sel.innerHTML = "";
  templates.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

function templateMatchesTool(tpl, toolKind){
  const tags = (tpl.tags || []).map(x=>String(x).toLowerCase());
  if(toolKind === "codex") return tags.includes("codex") || tpl.id.includes("codex");
  if(toolKind === "sora") return tags.includes("sora") || tpl.id.includes("sora");
  return true;
}

function pickDefaultTemplateForTool(templates, toolKind){
  // Prefer a template with matching tag
  const match = templates.find(t => templateMatchesTool(t, toolKind));
  return match ? match.id : templates[0]?.id;
}

function buildPrompt(){
  const templates = loadTemplates();
  const settings = loadSettings();

  const toolKind = $("#toolKind").value;
  let tplId = activeTemplateId();
  if(!tplId || !templates.some(t=>t.id===tplId)){
    tplId = pickDefaultTemplateForTool(templates, toolKind);
    $("#templateSelect").value = tplId;
  }

  const tpl = templates.find(t=>t.id===tplId);
  const data = {
    toolKind,
    goal: normalizeSpaces($("#goal").value),
    context: normalizeSpaces($("#context").value),
    inputs: normalizeSpaces($("#inputs").value),
    rules: normalizeSpaces($("#rules").value),
    steps: normalizeSpaces($("#steps").value),
    outputFormat: normalizeSpaces($("#outputFormat").value),
  };

  const raw = applyVars(tpl.body, data, settings);
  const final = normalizeSpaces(raw);
  $("#finalPrompt").value = final;
  return { tpl, data, final, settings };
}

function insertAtCursor(el, text){
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + text + el.value.slice(end);
  const pos = start + text.length;
  el.selectionStart = el.selectionEnd = pos;
  el.focus();
}

async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast("Copié ✅");
  }catch{
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Copié ✅");
  }
}

function downloadFile(filename, content, mime="text/plain"){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderTemplatesList(){
  const templates = loadTemplates();
  const q = ($("#tplSearch").value || "").toLowerCase().trim();
  const list = $("#tplList");
  list.innerHTML = "";

  const filtered = templates.filter(t => {
    const hay = (t.name + " " + (t.tags||[]).join(",")).toLowerCase();
    return !q || hay.includes(q);
  });

  filtered.forEach(t => {
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = t.id;
    div.innerHTML = `
      <div class="item-title">${escapeHtml(t.name)}</div>
      <div class="item-meta">${escapeHtml((t.tags||[]).join(", "))}</div>
      <div class="badges">${(t.tags||[]).slice(0,8).map(tag=>`<span class="badge">${escapeHtml(tag)}</span>`).join("")}</div>
    `;
    div.addEventListener("click", ()=> openTemplateEditor(t.id));
    list.appendChild(div);
  });

  if(filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="item-title">Aucun template</div><div class="item-meta">Crée-en un avec “+ Nouveau”.</div>`;
    list.appendChild(empty);
  }
}

function openTemplateEditor(id){
  const templates = loadTemplates();
  const t = templates.find(x => x.id === id);
  if(!t) return;
  $("#tplName").value = t.name || "";
  $("#tplTags").value = (t.tags || []).join(", ");
  $("#tplBody").value = t.body || "";
  $("#btnTplDelete").dataset.id = id;
  $("#btnTplSave").dataset.id = id;
  toast("Template chargé");
}

function createNewTemplate(){
  const id = uid();
  $("#tplName").value = "Nouveau template";
  $("#tplTags").value = "";
  $("#tplBody").value = `OBJECTIF\n{GOAL}\n\nCONTEXTE\n{CONTEXT}\n\nENTRÉES\n{INPUTS}\n\nRÈGLES\n{RULES}\n\nÉTAPES\n{STEPS}\n\nFORMAT\n{FORMAT}\n`;
  $("#btnTplDelete").dataset.id = id;
  $("#btnTplSave").dataset.id = id;
  toast("Nouveau template prêt");
}

function saveTemplateFromEditor(){
  const id = $("#btnTplSave").dataset.id || uid();
  const templates = loadTemplates();

  const name = ($("#tplName").value || "").trim() || "Sans nom";
  const tags = ($("#tplTags").value || "")
    .split(",")
    .map(s=>s.trim())
    .filter(Boolean);
  const body = ($("#tplBody").value || "").toString();

  const existingIdx = templates.findIndex(t=>t.id===id);
  const obj = { id, name, tags, body };

  if(existingIdx >= 0) templates[existingIdx] = obj;
  else templates.unshift(obj);

  saveTemplates(templates);
  fillTemplateSelect(templates);
  renderTemplatesList();
  toast("Template sauvegardé ✅");
}

function deleteTemplateFromEditor(){
  const id = $("#btnTplDelete").dataset.id;
  if(!id) return;
  let templates = loadTemplates();
  const before = templates.length;
  templates = templates.filter(t=>t.id!==id);
  if(templates.length === 0) templates = defaultTemplates();
  saveTemplates(templates);
  fillTemplateSelect(templates);
  renderTemplatesList();
  toast(before !== templates.length ? "Supprimé ✅" : "Introuvable");
}

function renderHistory(){
  const hist = loadHistory();
  const q = ($("#histSearch").value || "").toLowerCase().trim();
  const list = $("#histList");
  list.innerHTML = "";

  const filtered = hist.filter(h=>{
    const hay = (h.title + " " + h.toolKind + " " + (h.templateName||"") + " " + (h.final||"")).toLowerCase();
    return !q || hay.includes(q);
  });

  filtered.forEach(h=>{
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = h.id;
    const when = new Date(h.createdAt).toLocaleString();
    div.innerHTML = `
      <div class="item-title">${escapeHtml(h.title)}</div>
      <div class="item-meta">${escapeHtml(h.toolKind.toUpperCase())} · ${escapeHtml(when)} · ${escapeHtml(h.templateName||"")}</div>
      <div class="badges">
        <span class="badge">${escapeHtml(h.toolKind)}</span>
        ${h.favorite ? `<span class="badge">⭐ favori</span>` : ``}
      </div>
    `;
    div.addEventListener("click", ()=> loadHistoryItem(h.id));
    list.appendChild(div);
  });

  if(filtered.length === 0){
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = `<div class="item-title">Aucun historique</div><div class="item-meta">Utilise “Sauver” dans Créer.</div>`;
    list.appendChild(empty);
  }
}

function loadHistoryItem(id){
  const hist = loadHistory();
  const h = hist.find(x=>x.id===id);
  if(!h) return;
  $("#toolKind").value = h.toolKind || "codex";
  $("#goal").value = h.data?.goal || "";
  $("#context").value = h.data?.context || "";
  $("#inputs").value = h.data?.inputs || "";
  $("#rules").value = h.data?.rules || "";
  $("#steps").value = h.data?.steps || "";
  $("#outputFormat").value = h.data?.outputFormat || "";
  // select template if exists
  const templates = loadTemplates();
  if(templates.some(t=>t.id===h.templateId)){
    $("#templateSelect").value = h.templateId;
  }
  $("#finalPrompt").value = h.final || "";
  setActiveView("builder");
  toast("Historique rechargé ✅");
}

function saveCurrentToHistory({tpl, data, final}){
  const hist = loadHistory();
  const title = (data.goal || "").split("\n")[0].slice(0, 64) || (tpl?.name || "Prompt");
  const obj = {
    id: uid(),
    createdAt: nowISO(),
    toolKind: data.toolKind,
    templateId: tpl.id,
    templateName: tpl.name,
    data,
    final,
    favorite: false
  };
  hist.unshift(obj);
  saveHistory(hist.slice(0, 200)); // cap
  toast("Sauvé ✅");
}

function toggleFavoriteCurrent(){
  // toggle favorite for last saved if matches final text; else save new favorite entry
  const final = normalizeSpaces($("#finalPrompt").value);
  if(!final){ toast("Rien à favoriser"); return; }
  let hist = loadHistory();
  const foundIdx = hist.findIndex(h => (h.final || "") === final);
  if(foundIdx >= 0){
    hist[foundIdx].favorite = !hist[foundIdx].favorite;
    saveHistory(hist);
    toast(hist[foundIdx].favorite ? "Favori ⭐" : "Retiré");
  }else{
    // save as favorite
    const templates = loadTemplates();
    const tplId = activeTemplateId();
    const tpl = templates.find(t=>t.id===tplId) || templates[0];
    const data = {
      toolKind: $("#toolKind").value,
      goal: normalizeSpaces($("#goal").value),
      context: normalizeSpaces($("#context").value),
      inputs: normalizeSpaces($("#inputs").value),
      rules: normalizeSpaces($("#rules").value),
      steps: normalizeSpaces($("#steps").value),
      outputFormat: normalizeSpaces($("#outputFormat").value),
    };
    const obj = {
      id: uid(),
      createdAt: nowISO(),
      toolKind: data.toolKind,
      templateId: tpl.id,
      templateName: tpl.name,
      data,
      final,
      favorite: true
    };
    hist.unshift(obj);
    saveHistory(hist.slice(0, 200));
    toast("Favori ⭐");
  }
  renderHistory();
}

function exportTXT(){
  const txt = normalizeSpaces($("#finalPrompt").value);
  if(!txt){ toast("Prompt vide"); return; }
  const filename = `prompt_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
  downloadFile(filename, txt, "text/plain");
}

function exportJSON(){
  const templates = loadTemplates();
  const settings = loadSettings();
  const payload = {
    exportedAt: nowISO(),
    app: "Prompt Builder Mix V1",
    toolKind: $("#toolKind").value,
    templateId: activeTemplateId(),
    fields: {
      goal: $("#goal").value,
      context: $("#context").value,
      inputs: $("#inputs").value,
      rules: $("#rules").value,
      steps: $("#steps").value,
      outputFormat: $("#outputFormat").value
    },
    finalPrompt: $("#finalPrompt").value,
    settings,
    templatesCount: templates.length
  };
  const filename = `prompt_project_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  downloadFile(filename, JSON.stringify(payload, null, 2), "application/json");
}

function exportQuickCopy(){
  const txt = normalizeSpaces($("#finalPrompt").value);
  if(!txt){ toast("Prompt vide"); return; }
  copyText(txt);
}

function fillSettingsUI(){
  const s = loadSettings();
  $("#prefDefaultType").value = s.defaultType || "codex";
  $("#varLieu").value = s.vars.LIEU || "";
  $("#varSujet").value = s.vars.SUJET || "";
  $("#varStyle").value = s.vars.STYLE || "";
  $("#varDuree").value = s.vars.DUREE || "";
  $("#varFormat").value = s.vars.FORMAT || "";
  $("#varContraintes").value = s.vars.CONTRAINTES || "";
}

function saveSettingsFromUI(){
  const s = loadSettings();
  s.defaultType = $("#prefDefaultType").value;
  s.vars.LIEU = $("#varLieu").value;
  s.vars.SUJET = $("#varSujet").value;
  s.vars.STYLE = $("#varStyle").value;
  s.vars.DUREE = $("#varDuree").value;
  s.vars.FORMAT = $("#varFormat").value;
  s.vars.CONTRAINTES = $("#varContraintes").value;
  saveSettings(s);
  toast("Paramètres sauvés ✅");
}

function factoryReset(){
  localStorage.removeItem(LS_KEYS.templates);
  localStorage.removeItem(LS_KEYS.history);
  localStorage.removeItem(LS_KEYS.settings);
  init(); // reload
  toast("Reset complet ✅");
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initNav(){
  $$(".nav-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = btn.dataset.view;
      setActiveView(v);
      if(v === "templates") renderTemplatesList();
      if(v === "history") renderHistory();
      if(v === "settings") fillSettingsUI();
    });
  });
}

function initChips(){
  $$(".chip").forEach(ch=>{
    ch.addEventListener("click", ()=>{
      const val = ch.dataset.insert;
      // insert into whichever textarea is focused; fallback to finalPrompt
      const active = document.activeElement;
      if(active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")){
        insertAtCursor(active, val);
      }else{
        insertAtCursor($("#finalPrompt"), val);
      }
      toast("Inséré");
    });
  });
}

function init(){
  const templates = loadTemplates();
  fillTemplateSelect(templates);

  const settings = loadSettings();
  $("#toolKind").value = settings.defaultType || "codex";

  const defaultTplId = pickDefaultTemplateForTool(templates, $("#toolKind").value);
  $("#templateSelect").value = defaultTplId;

  // builder actions
  $("#btnGenerate").addEventListener("click", ()=>{
    buildPrompt();
    toast("Prompt généré ✅");
  });
  $("#btnReset").addEventListener("click", ()=>{
    ["#goal","#context","#inputs","#rules","#steps","#outputFormat","#finalPrompt"].forEach(sel=>$(sel).value="");
    toast("Réinitialisé");
  });
  $("#btnCopy").addEventListener("click", exportQuickCopy);
  $("#btnQuickCopy").addEventListener("click", exportQuickCopy);
  $("#btnExportTxt").addEventListener("click", exportTXT);
  $("#btnExportJson").addEventListener("click", exportJSON);
  $("#btnTidy").addEventListener("click", ()=>{
    $("#finalPrompt").value = normalizeSpaces($("#finalPrompt").value);
    toast("Nettoyé ✅");
  });

  $("#toolKind").addEventListener("change", ()=>{
    const templates = loadTemplates();
    const tool = $("#toolKind").value;
    const best = pickDefaultTemplateForTool(templates, tool);
    if(best) $("#templateSelect").value = best;
    toast(tool.toUpperCase());
  });

  $("#btnNewFromTemplate").addEventListener("click", ()=>{
    // just rebuild from template with current fields
    buildPrompt();
  });

  $("#btnSaveToHistory").addEventListener("click", ()=>{
    const res = buildPrompt();
    saveCurrentToHistory(res);
    renderHistory();
  });

  $("#btnFavorite").addEventListener("click", toggleFavoriteCurrent);

  // templates view actions
  $("#tplSearch").addEventListener("input", renderTemplatesList);
  $("#btnTplNew").addEventListener("click", ()=>{
    createNewTemplate();
    renderTemplatesList();
  });
  $("#btnTplSave").addEventListener("click", saveTemplateFromEditor);
  $("#btnTplDelete").addEventListener("click", deleteTemplateFromEditor);

  // history view actions
  $("#histSearch").addEventListener("input", renderHistory);
  $("#btnHistClear").addEventListener("click", ()=>{
    saveHistory([]);
    renderHistory();
    toast("Historique vidé ✅");
  });

  // settings view actions
  $("#btnSettingsSave").addEventListener("click", saveSettingsFromUI);
  $("#btnFactoryReset").addEventListener("click", factoryReset);

  initNav();
  initChips();

  // initial prompt
  buildPrompt();
}

document.addEventListener("DOMContentLoaded", init);
