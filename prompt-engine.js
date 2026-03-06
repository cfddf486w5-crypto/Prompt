(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PromptEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TOOL_TARGETS = { CODEX: "codex", SORA: "sora", UNKNOWN: "unknown" };

  const weakWords = ["beau", "pro", "moderne", "rapide", "puissant", "clean", "nice", "meilleur", "complet", "intelligent", "simple", "avancé"];

  const codexSubtypes = [
    "création app complète", "ajout fonctionnalité", "bug fix", "refonte logique sans toucher UI", "amélioration UX", "intégration API",
    "génération composant/page/module", "architecture projet", "optimisation performance", "compatibilité mobile/desktop", "offline/localStorage",
    "import/export fichier", "sécurité/login", "tests/QA", "génération repo complet", "documentation/README", "PWA", "page 3D / canvas / map / layout",
    "traitement données / csv / xlsx", "assistant IA intégré"
  ];

  const soraSubtypes = [
    "scène cinéma", "scène romantique", "clip voyage / road trip", "scène action", "scène nature", "ultra réaliste", "stylisé / artistique", "boucle vidéo",
    "publicité / promo", "plan drone", "plan intime", "chorégraphie / danse", "storyboard multi-scènes", "générateur aléatoire", "vidéo verticale",
    "vidéo horizontale", "scène avec ambiance précise", "séquence émotionnelle"
  ];

  const codexQuestionBank = [
    "Quel est l’objectif principal exact ?", "Est-ce une app existante ou un nouveau projet ?", "Faut-il conserver 100% du UI actuel ?",
    "Qu’est-ce qu’on a le droit de modifier ?", "Qu’est-ce qu’on n’a pas le droit de modifier ?", "Sur quelles plateformes ça doit fonctionner ?",
    "Est-ce que le projet doit fonctionner offline ?", "Faut-il utiliser localStorage ?", "GitHub Pages est-il requis ?", "Faut-il une compatibilité mobile-first ?",
    "Est-ce que la version PC Windows compte aussi ?", "Quel est le flux principal de la page ?", "Faut-il des validations ?", "Faut-il un historique ?",
    "Faut-il des presets ?", "Faut-il des variantes de prompts ?", "Faut-il un score qualité du prompt ?", "Faut-il des recommandations avant génération ?",
    "Faut-il générer une version courte et une version XL ?", "L’app doit-elle fonctionner sans backend ?", "Faut-il préparer le code pour une future API IA ?",
    "Faut-il une détection automatique des mots faibles ?", "Faut-il un système de mémoire locale des préférences de l’utilisateur ?"
  ];

  const soraQuestionBank = [
    "Quel type de vidéo veux-tu créer ?", "Combien de scènes ?", "Quelle durée approximative ?", "Format vertical, horizontal ou carré ?",
    "Style visuel : ultra réaliste, cinéma, rêve, pub, documentaire ?", "Ambiance principale ?", "Heure de la journée ?", "Conditions météo ?",
    "Décor principal ?", "Y a-t-il du mouvement de caméra ?", "Y a-t-il des personnages ?", "Quelles émotions doivent ressortir ?",
    "Quelles actions précises se déroulent ?", "Faut-il une continuité visuelle entre les scènes ?", "Prompt unique ou storyboard scène par scène ?",
    "Faut-il ajouter lumière, textures, vent, reflets, brume, particules ?", "Sortie simple ou ultra détaillée ?"
  ];

  const presetLibrary = {
    codex: ["Ne touche pas au UI", "Ajouter seulement la logique", "Mobile + PC", "Offline-first", "GitHub Pages compatible", "localStorage obligatoire", "Sans backend", "Préparer pour future API", "Ajouter validations", "Ajouter historique", "Ajouter FAQ", "Ajouter tests", "Ajouter README", "Conserver style actuel 100%"],
    sora: ["Ultra réaliste", "Hollywood", "Road trip", "Romantique", "Nature grandiose", "Danse", "Drone", "Aurores boréales", "Coucher de soleil", "Brouillard cinématographique", "Mouvement fluide", "4K / très haute définition"]
  };

  const examplesLibrary = {
    codex: [
      "Ajoute un moteur IA à ma page existante sans toucher au UI",
      "Ajouter import CSV/XLSX", "Transformer une app en machine offline-first", "Ajouter localStorage et historique", "Refactoriser sans casser l’apparence"
    ],
    sora: ["road trip romantique", "aurore boréale au bord de l’océan", "danse cinéma paysage immense", "clip ultra réaliste avec caméra drone"]
  };

  function normalize(text) { return String(text || "").toLowerCase().trim(); }

  function detectWeakWords(text) {
    const t = normalize(text);
    return weakWords.filter((w) => t.includes(w));
  }

  function detectSubtype(text, target) {
    const t = normalize(text);
    const list = target === TOOL_TARGETS.SORA ? soraSubtypes : codexSubtypes;
    return list.find((s) => t.includes(s.split(" ")[0])) || (target === TOOL_TARGETS.SORA ? "scène cinéma" : "ajout fonctionnalité");
  }

  function intentClassifier(rawText) {
    const text = normalize(rawText);
    const codexSignals = ["app", "code", "ui", "bug", "feature", "localstorage", "github pages", "offline", "api", "test", "readme"];
    const soraSignals = ["vidéo", "video", "scène", "camera", "drone", "cinéma", "hollywood", "lumière", "plan", "ambiance"];
    const codexScore = codexSignals.reduce((a, s) => a + (text.includes(s) ? 1 : 0), 0);
    const soraScore = soraSignals.reduce((a, s) => a + (text.includes(s) ? 1 : 0), 0);
    const toolTarget = codexScore === soraScore ? TOOL_TARGETS.UNKNOWN : (codexScore > soraScore ? TOOL_TARGETS.CODEX : TOOL_TARGETS.SORA);
    const weak = detectWeakWords(text);
    const missing = [];
    if (!text.includes("objectif")) missing.push("objectif précis");
    if (!text.includes("contraint")) missing.push("contraintes explicites");
    if (!text.includes("offline")) missing.push("exigence offline");
    return {
      toolTarget,
      subtype: detectSubtype(text, toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : toolTarget),
      precisionLevel: text.length > 320 ? "élevé" : text.length > 120 ? "moyen" : "faible",
      missing,
      ambiguityRisks: [...weak, ...(toolTarget === TOOL_TARGETS.UNKNOWN ? ["cible ambiguë codex/sora"] : [])],
      complexity: text.length > 450 ? "élevée" : "modérée"
    };
  }

  function infoExtractor(rawText) {
    const text = String(rawText || "");
    const t = normalize(text);
    return {
      projectName: "",
      objective: text.split(".")[0] || "",
      existingUI: /existant|déjà|already/.test(t),
      uiLock: /ne touche pas au ui|ne pas toucher au ui|100%.*apparence|conserver.*ui/.test(t),
      targetPlatforms: [/(iphone|mobile)/.test(t) ? "iPhone" : "", /(windows|pc)/.test(t) ? "PC Windows" : "", /(web|github pages)/.test(t) ? "Web/GitHub Pages" : ""].filter(Boolean),
      offlineRequired: /offline|hors ligne/.test(t),
      repoTarget: /github/.test(t) ? "GitHub Pages" : "",
      performanceNeeds: /perform|rapide/.test(t) ? "optimisation" : "",
      language: /anglais|english/.test(t) ? "en" : "fr",
      tone: /pro|professionnel/.test(t) ? "professionnel" : "direct",
      outputLength: /xl|détaillé|ultra/.test(t) ? "xl" : "pro",
      complexityLevel: t.length > 350 ? "high" : "medium",
      restrictions: /ne pas|interdit/.test(t) ? ["restrictions utilisateur détectées"] : [],
      deliveryFormat: /json/.test(t) ? "json" : "texte",
      references: [],
      mustInclude: [],
      mustAvoid: []
    };
  }

  function modelIdeal(target) {
    if (target === TOOL_TARGETS.SORA) return ["objectif", "durée", "format", "ambiance", "caméra", "décor", "style", "sortie"];
    return ["objectif", "scope", "contraintes", "plateformes", "offline", "localStorage", "livrables", "tests"];
  }

  function missingInfoEngine(draft) {
    const ideal = modelIdeal(draft.toolTarget);
    const known = {
      objectif: !!draft.extractedInfo.objective,
      scope: !!draft.extractedInfo.existingUI,
      contraintes: draft.extractedInfo.restrictions.length > 0 || draft.extractedInfo.uiLock,
      plateformes: draft.extractedInfo.targetPlatforms.length > 0,
      offline: typeof draft.extractedInfo.offlineRequired === "boolean",
      localStorage: /localstorage/i.test(draft.userRawDescription),
      livrables: /livrable|output|sortie/.test(normalize(draft.userRawDescription)),
      tests: /test/.test(normalize(draft.userRawDescription)),
      durée: /s|sec|min/.test(normalize(draft.userRawDescription)),
      format: /16:9|9:16|vertical|horizontal|carré/.test(normalize(draft.userRawDescription)),
      ambiance: /ambiance|mood|romantique|dramatique/.test(normalize(draft.userRawDescription)),
      caméra: /camera|drone|travelling|plan/.test(normalize(draft.userRawDescription)),
      décor: /forêt|océan|ville|décor|scene/.test(normalize(draft.userRawDescription)),
      style: /cinéma|réaliste|artistique/.test(normalize(draft.userRawDescription)),
      sortie: /storyboard|prompt/.test(normalize(draft.userRawDescription))
    };
    return ideal.filter((key) => !known[key]).map((k, idx) => ({
      key: k,
      priority: idx < 3 ? "critique" : idx < 6 ? "importante" : "bonus"
    }));
  }

  function adaptiveQuestionFlow(draft) {
    const missing = draft.missingQuestions || [];
    const bank = draft.toolTarget === TOOL_TARGETS.SORA ? soraQuestionBank : codexQuestionBank;
    const qs = [];
    missing.forEach((m) => {
      const found = bank.find((q) => normalize(q).includes(m.key));
      if (found) qs.push({ question: found, priority: m.priority, key: m.key });
    });
    if (!qs.length) qs.push({ question: "Souhaites-tu une version pro, XL, et technique ?", priority: "bonus", key: "variants" });
    return draft.parsedIntent.precisionLevel === "élevé" ? qs.slice(0, 3) : qs.slice(0, 8);
  }

  function buildConstraintLines(info) {
    const lines = [];
    if (info.uiLock) lines.push("Ne jamais modifier le UI/visuel existant.");
    if (info.offlineRequired) lines.push("Logique locale prioritaire et fonctionnement offline autant que possible.");
    if (info.targetPlatforms.length) lines.push(`Compatibilité cible: ${info.targetPlatforms.join(", ")}.`);
    if (info.repoTarget) lines.push(`Déploiement attendu: ${info.repoTarget}.`);
    lines.push("Utiliser localStorage pour brouillons, préférences, historique et presets.");
    return lines;
  }

  function buildCodexPrompt(draft, level) {
    const constraints = buildConstraintLines(draft.extractedInfo);
    const detailBoost = level === "xl" ? "Ajouter plan d'implémentation détaillé, validations, edge cases et checklists." : "Rester clair et exécutable.";
    return [
      "RÔLE: Tu es un ingénieur logiciel senior spécialisé en évolution d'application existante.",
      `MISSION: ${draft.extractedInfo.objective || draft.userRawDescription}`,
      "CONTRAINTES ABSOLUES:", ...constraints.map((c) => `- ${c}`),
      "CONTEXTE:", `- Sous-type: ${draft.subtype}`, `- Précision actuelle: ${draft.parsedIntent.precisionLevel}`,
      "EXÉCUTION ATTENDUE:", "- Proposer architecture modulaire.", "- Ajouter validateurs et états d'erreur.", "- Inclure tests/QA et critères de réussite.",
      `NIVEAU: ${level}. ${detailBoost}`
    ].join("\n");
  }

  function buildSoraPrompt(draft, level) {
    const e = draft.extractedInfo;
    return [
      "STYLE GLOBAL: vidéo cinématique cohérente et premium.",
      `SUJET: ${e.objective || draft.userRawDescription}`,
      "PARAMÈTRES VISUELS:",
      "- Décrire décor, lumière, textures, reflets, profondeur atmosphérique.",
      "- Préciser mouvement caméra, cadrages, continuité entre scènes.",
      "- Injecter émotions et rythme.",
      `FORMAT: ${level === "technical" ? "contraintes strictes + exclusions explicites" : "narratif riche prêt à copier"}`
    ].join("\n");
  }

  function promptComposer(draft, level) {
    const target = draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget;
    const full = target === TOOL_TARGETS.SORA ? buildSoraPrompt(draft, level) : buildCodexPrompt(draft, level);
    return normalizePrompt(full);
  }

  function normalizePrompt(text) {
    return String(text || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function qualityScorer(draft) {
    const prompt = draft.finalPrompt || "";
    const lengthScore = Math.min(25, Math.floor(prompt.length / 45));
    const clarity = prompt.includes("MISSION") || prompt.includes("SUJET") ? 20 : 10;
    const completeness = 20 - Math.min(10, draft.missingQuestions.length * 2) + Math.min(5, (draft.answers ? Object.keys(draft.answers).length : 0));
    const executionReadiness = /test|validation|critères|contraintes/i.test(prompt) ? 20 : 10;
    const ambiguityRisk = Math.max(0, 20 - (draft.parsedIntent.ambiguityRisks.length * 3));
    const contextualRichness = Math.min(15, Math.floor((draft.extractedInfo.targetPlatforms.length + (draft.extractedInfo.uiLock ? 2 : 0)) * 4));
    const global = Math.max(0, Math.min(100, lengthScore + clarity + completeness + executionReadiness + ambiguityRisk + contextualRichness));
    return { global, clarity, completeness, executionReadiness, ambiguityRisk };
  }

  function upgradeSuggestions(draft) {
    const suggestions = [];
    if (!draft.extractedInfo.uiLock && draft.toolTarget === TOOL_TARGETS.CODEX) suggestions.push("Préciser explicitement si le UI est verrouillé.");
    if (!draft.extractedInfo.offlineRequired) suggestions.push("Confirmer l'exigence offline-first.");
    if (!/test/i.test(draft.userRawDescription)) suggestions.push("Ajouter les tests attendus (manuels/automatisés). ");
    const weak = detectWeakWords(draft.userRawDescription);
    if (weak.length) suggestions.push(`Mots flous détectés (${weak.join(", ")}) : préciser 2-3 critères mesurables.`);
    if (draft.toolTarget === TOOL_TARGETS.SORA) suggestions.push("Ajouter lumière, météo, caméra et continuité visuelle pour renforcer la qualité vidéo.");
    return suggestions;
  }

  function buildReasoningSummary(draft) {
    return [
      `Cible détectée: ${draft.toolTarget}`,
      `Objectif compris: ${draft.extractedInfo.objective || "à clarifier"}`,
      `Zones floues restantes: ${draft.missingQuestions.map((x) => x.key).join(", ") || "aucune majeure"}`,
      `Niveau de précision: ${draft.parsedIntent.precisionLevel}`,
      `Recommandations: ${(draft.suggestions || []).slice(0, 3).join(" | ") || "continuer la collecte d'informations"}`
    ].join("\n");
  }

  function createDraft(rawDescription) {
    const parsedIntent = intentClassifier(rawDescription);
    const extractedInfo = infoExtractor(rawDescription);
    const draft = {
      id: `draft_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      toolTarget: parsedIntent.toolTarget,
      subtype: parsedIntent.subtype,
      userRawDescription: rawDescription,
      parsedIntent,
      extractedInfo,
      answers: {},
      missingQuestions: [],
      suggestedQuestions: [],
      finalPrompt: "",
      promptVariants: { short: "", full: "", xl: "", technical: "" },
      score: { global: 0, clarity: 0, completeness: 0, executionReadiness: 0, ambiguityRisk: 0 },
      history: [],
      tags: []
    };
    draft.missingQuestions = missingInfoEngine(draft);
    draft.suggestedQuestions = adaptiveQuestionFlow(draft);
    draft.suggestions = upgradeSuggestions(draft);
    return draft;
  }

  function answerQuestion(draft, key, answer) {
    draft.answers[key] = answer;
    draft.updatedAt = new Date().toISOString();
    return draft;
  }

  function composeAllVariants(draft) {
    draft.promptVariants.short = promptComposer(draft, "simple");
    draft.promptVariants.full = promptComposer(draft, "pro");
    draft.promptVariants.xl = promptComposer(draft, "xl");
    draft.promptVariants.technical = promptComposer(draft, "technical");
    draft.finalPrompt = draft.promptVariants.full;
    draft.score = qualityScorer(draft);
    return draft;
  }

  function exportModule(draft) {
    return {
      final: draft.finalPrompt,
      short: draft.promptVariants.short,
      xl: draft.promptVariants.xl,
      technical: draft.promptVariants.technical,
      checklist: `Checklist\n- Objectif précis\n- Contraintes explicites\n- Tests/validation\n- Risques`,
      faq: `FAQ\nQ: UI modifié ?\nR: Non si verrouillé.\nQ: Offline ?\nR: Logique locale prioritaire.`
    };
  }

  return {
    TOOL_TARGETS,
    codexQuestionBank,
    soraQuestionBank,
    promptTemplates: {},
    validatorRules: { weakWords },
    suggestionRules: {},
    examplesLibrary,
    presetLibrary,
    intentClassifier,
    infoExtractor,
    missingInfoEngine,
    adaptiveQuestionFlow,
    promptComposer,
    qualityScorer,
    upgradeSuggestions,
    buildReasoningSummary,
    createDraft,
    composeAllVariants,
    answerQuestion,
    exportModule,
    detectWeakWords
  };
});
