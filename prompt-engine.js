(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PromptEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TOOL_TARGETS = { CODEX: "codex", SORA: "sora", UNKNOWN: "unknown" };

  const QUESTION_MODES = {
    rapide: { questionLimit: 3, depth: "faible", userTimeMin: 1, enrichment: "faible" },
    standard: { questionLimit: 6, depth: "moyenne", userTimeMin: 3, enrichment: "moyen" },
    expert: { questionLimit: 10, depth: "haute", userTimeMin: 6, enrichment: "élevé" },
    ultra: { questionLimit: 14, depth: "très haute", userTimeMin: 10, enrichment: "maximal" }
  };

  const GENERATION_MODES = {
    rapide: { label: "mode rapide", primaryVariant: "short", variantCount: 2, refinementLevel: "light" },
    standard: { label: "mode standard", primaryVariant: "full", variantCount: 3, refinementLevel: "medium" },
    ultra_pro: { label: "mode ultra pro", primaryVariant: "xl", variantCount: 5, refinementLevel: "high" },
    simple: { label: "mode prompt simple", primaryVariant: "short", variantCount: 1, refinementLevel: "light" },
    master: { label: "mode prompt maître", primaryVariant: "technical", variantCount: 6, refinementLevel: "high" }
  };

  const KNOWLEDGE_PACK = {
    promptHeuristics: [
      { key: "objective", label: "objectif clair", weight: 12 },
      { key: "measurable", label: "résultat mesurable", weight: 8 },
      { key: "constraints", label: "contraintes explicites", weight: 10 },
      { key: "platform", label: "plateforme nommée", weight: 8 },
      { key: "forbidden", label: "interdictions explicites", weight: 8 },
      { key: "initialState", label: "état initial connu", weight: 7 },
      { key: "finalState", label: "état final attendu", weight: 7 },
      { key: "outputFormat", label: "format de sortie", weight: 8 },
      { key: "detailCoherence", label: "degré de détail cohérent", weight: 6 },
      { key: "ambiguityHandling", label: "gestion des ambiguïtés", weight: 8 },
      { key: "toolFit", label: "adéquation outil cible", weight: 10 },
      { key: "actionable", label: "actionnabilité", weight: 8 }
    ],
    antiVague: {
      pro: ["hiérarchie visuelle claire", "cohérence de spacing", "composants alignés", "états d'erreur gérés", "code modulaire", "responsive solide", "feedback utilisateur net"],
      complet: ["structure principale", "cas limites", "validation", "historique", "erreurs", "export", "documentation", "tests"],
      intelligent: ["détection automatique", "suggestions contextuelles", "fallback", "recommandations", "résumé raisonné", "adaptation aux réponses précédentes"],
      rapide: ["temps de réponse défini", "zéro blocage", "latence minimale", "priorité au flux principal"],
      moderne: ["design system cohérent", "accessibilité de base", "typographie lisible", "contrastes conformes"],
      puissant: ["gestion edge cases", "mécanismes de récupération", "scalabilité logique", "journalisation utile"]
    },
    codexBestPractices: [
      "Préciser ce qui existe déjà.",
      "Préciser ce qui est interdit.",
      "Préciser le type de livrable.",
      "Préciser les plateformes.",
      "Préciser si offline.",
      "Préciser si GitHub Pages.",
      "Préciser si localStorage.",
      "Préciser si sans backend.",
      "Préciser si PWA.",
      "Préciser les critères de réussite.",
      "Demander un code propre, modulaire, maintenable.",
      "Demander de ne pas casser le style existant.",
      "Demander un test logique final."
    ],
    soraBestPractices: [
      "Décrire ambiance, lumière, météo, décor, textures.",
      "Définir caméra, mouvement, échelle, émotion.",
      "Préciser rendu, continuité, exclusions.",
      "Préciser durée/format si connu.",
      "Ajouter cohérence entre plans.",
      "Limiter les ambiguïtés narratives."
    ],
    questionStrategies: QUESTION_MODES,
    promptPatterns: {
      codex: {
        "ajout fonctionnalité sans toucher UI": "Enrichir l'app existante sans modifier le visuel, uniquement logique + validations + tests.",
        "refonte logique": "Refactoriser architecture métier en modules sans impacter rendu.",
        "nouvelle page": "Ajouter une page cohérente avec navigation et état global.",
        "import/export": "Ajouter import/export robuste avec validation, erreurs, compatibilité offline.",
        "assistant IA embarqué": "Créer assistant local guidé avec scoring et recommandations.",
        "module offline": "Garantir fonctionnement hors ligne et synchronisation locale.",
        "mobile-first": "Optimiser flux mobile puis desktop sans casser l'existant.",
        "multi-pages": "Structurer routes/pages tout en conservant architecture maintenable.",
        "intégration future API": "Préparer interfaces/facades pour API future sans dépendance réseau immédiate.",
        "optimisation app existante": "Améliorer performance, robustesse, observabilité sans refonte UI."
      },
      sora: {
        "scène unique cinéma": "Une scène cinématique continue avec progression émotionnelle.",
        "storyboard multi-scènes": "Storyboard en plans séquentiels cohérents.",
        "clip romantique": "Récit romantique sensible, lumière douce, mouvements fluides.",
        "road trip": "Trajet progressif, paysages variés, continuité véhicule/personnages.",
        "nature épique": "Échelle grandiose, météo dramatique, texture réaliste.",
        "scène de danse": "Rythme, chorégraphie, plans synchronisés.",
        "plans drone": "Mouvements aériens stables, transitions panoramiques.",
        "rendu Hollywood": "Mise en scène premium, contraste maîtrisé, étalonnage cinéma.",
        "paysage aléatoire ultra réaliste": "Générer paysage plausible avec détails micro-textures et profondeur atmosphérique."
      }
    },
    improvementBoosters: {
      codex: [
        "ajouter validations", "ajouter historique", "ajouter sauvegarde brouillon", "ajouter presets", "ajouter score qualité",
        "ajouter variantes", "ajouter mode expert", "ajouter import/export projet", "ajouter README", "ajouter tests"
      ],
      sora: [
        "ajouter caméra cinématique", "ajouter lumière volumétrique", "ajouter brume", "ajouter texture détaillée", "ajouter vent subtil",
        "ajouter reflets réalistes", "ajouter profondeur de champ", "ajouter continuité émotionnelle", "ajouter précision décor", "ajouter dynamique du mouvement"
      ]
    },
    examples: {
      codex: [
        {
          rawInput: "Ajoute une IA à ma page de prompts sans toucher au UI.",
          questions: ["App existante ?", "Offline requis ?", "Livrable attendu ?"],
          extracted: { target: "codex", uiLock: true, existing: true },
          improvedPrompt: "Mission claire + contraintes UI strictes + architecture + validations + tests + checklist."
        },
        {
          rawInput: "Je veux un module import/export pro.",
          questions: ["Formats supportés ?", "Gestion erreurs ?", "Mode offline ?"],
          extracted: { target: "codex", subtype: "import/export" },
          improvedPrompt: "Import/export JSON/CSV, validation, fallback, logs, tests."
        },
        {
          rawInput: "Optimise mon app existante.",
          questions: ["Performance cible ?", "Plateformes ?", "Interdits ?"],
          extracted: { target: "codex", subtype: "optimisation app existante" },
          improvedPrompt: "Objectifs mesurables (LCP, erreurs), pas de casse UI, plan de tests."
        }
      ],
      sora: [
        {
          rawInput: "Mini film romantique overland ultra réaliste.",
          questions: ["Durée ?", "Nombre de scènes ?", "Météo/lumière ?"],
          extracted: { target: "sora", subtype: "road trip" },
          improvedPrompt: "Storyboard 5 plans, golden hour, pluie légère, travelling + drone, continuité émotionnelle."
        },
        {
          rawInput: "Je veux une scène nature épique.",
          questions: ["Décor exact ?", "Caméra ?", "Format final ?"],
          extracted: { target: "sora", subtype: "nature épique" },
          improvedPrompt: "Vallée glaciaire, contre-jour, vent subtil, focale 35mm, rendu IMAX."
        }
      ]
    }
  };

  const codexSignals = ["app", "code", "ui", "bug", "feature", "localstorage", "github pages", "offline", "api", "test", "readme", "module", "import", "export", "pwa"];
  const soraSignals = ["vidéo", "video", "scène", "camera", "drone", "cinéma", "hollywood", "lumière", "plan", "ambiance", "storyboard", "render", "météo"];

  const QUESTION_BANK = {
    codex: {
      contexte: ["Est-ce une app existante ou un nouveau projet ?", "Quel est l'objectif principal exact ?", "Quel état initial est déjà en place ?"],
      contraintes: ["Faut-il conserver 100% du UI actuel ?", "Qu'est-ce qui est interdit ?", "Offline/localStorage requis ?", "GitHub Pages obligatoire ?", "Sans backend ?"],
      sortie: ["Quel type de livrable veux-tu (patch, fichiers, README, tests) ?", "Quel format de sortie final ?"],
      qualité: ["Niveau de détail attendu (rapide/équilibré/expert/XL) ?", "Critères de réussite mesurables ?", "Ajouter validations/tests finaux ?"],
      technique: ["Plateformes cibles (iPhone, PC, web) ?", "Compatibilité multi-pages/PWA ?", "Préparer une future API ?"]
    },
    sora: {
      contexte: ["Quel est le sujet principal ?", "Scène unique ou multi-scènes ?", "Quelle émotion dominante ?"],
      contraintes: ["Exclusions explicites ?", "Niveau de réalisme ?", "Durée/format ?"],
      sortie: ["Prompt unique ou storyboard ?", "Version courte/pro/XL souhaitée ?"],
      qualité: ["Niveau de détail voulu ?", "Continuité visuelle stricte ?", "Rendu cible (cinéma/pub/docu) ?"],
      detailsVisuels: ["Décor précis ?", "Lumière et météo ?", "Texture et profondeur de champ ?"],
      technique: ["Mouvements caméra clés ?", "Cadence/rythme ?", "Échelle de plans ?"]
    }
  };

  function normalize(text) { return String(text || "").toLowerCase().trim(); }

  function detectWeakWords(text) {
    const t = normalize(text);
    return Object.keys(KNOWLEDGE_PACK.antiVague).filter((word) => t.includes(word));
  }

  function expandWeakWords(text) {
    return detectWeakWords(text).flatMap((w) => KNOWLEDGE_PACK.antiVague[w].map((item) => ({ source: w, concrete: item })));
  }

  function inferTool(text) {
    const t = normalize(text);
    const codexScore = codexSignals.reduce((a, s) => a + (t.includes(s) ? 1 : 0), 0);
    const soraScore = soraSignals.reduce((a, s) => a + (t.includes(s) ? 1 : 0), 0);
    if (codexScore === soraScore) return TOOL_TARGETS.UNKNOWN;
    return codexScore > soraScore ? TOOL_TARGETS.CODEX : TOOL_TARGETS.SORA;
  }

  function detectSubtype(text, target) {
    const t = normalize(text);
    const patterns = KNOWLEDGE_PACK.promptPatterns[target] || {};
    const keys = Object.keys(patterns);
    const found = keys.find((k) => k.split(" ").every((token) => token.length < 4 || t.includes(token)));
    if (found) return found;
    return target === TOOL_TARGETS.SORA ? "scène unique cinéma" : "ajout fonctionnalité sans toucher UI";
  }

  function intentClassifier(rawText) {
    const text = normalize(rawText);
    const toolTarget = inferTool(text);
    const weak = detectWeakWords(text);
    const missing = [];
    if (!/(objectif|but|mission)/.test(text)) missing.push("objectif précis");
    if (!/(contraint|interdit|ne pas)/.test(text)) missing.push("contraintes explicites");
    if (!/(format|sortie|livrable|storyboard)/.test(text)) missing.push("format de sortie");
    return {
      toolTarget,
      subtype: detectSubtype(text, toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : toolTarget),
      precisionLevel: text.length > 350 ? "élevé" : text.length > 140 ? "moyen" : "faible",
      missing,
      ambiguityRisks: [...weak, ...(toolTarget === TOOL_TARGETS.UNKNOWN ? ["cible ambiguë codex/sora"] : [])],
      complexity: text.length > 450 ? "élevée" : text.length > 200 ? "modérée" : "simple",
      keywordHighlights: text.split(/\s+/).filter((w) => w.length > 5).slice(0, 12)
    };
  }

  function infoExtractor(rawText) {
    const text = String(rawText || "");
    const t = normalize(text);
    return {
      projectName: "",
      objective: text.split(/[.!?]/)[0] || "",
      existingUI: /existant|déjà|already/.test(t),
      uiLock: /ne touche pas au ui|ne pas toucher au ui|conserver.*ui|sans toucher.*ui/.test(t),
      targetPlatforms: [/(iphone|ios|mobile)/.test(t) ? "iPhone" : "", /(windows|pc|desktop)/.test(t) ? "PC Windows" : "", /(web|github pages)/.test(t) ? "Web/GitHub Pages" : ""].filter(Boolean),
      offlineRequired: /offline|hors ligne/.test(t),
      localStorageRequired: /localstorage/.test(t),
      repoTarget: /github/.test(t) ? "GitHub Pages" : "",
      noBackend: /sans backend|no backend/.test(t),
      pwa: /pwa/.test(t),
      outputFormat: /json/.test(t) ? "json" : /markdown/.test(t) ? "markdown" : "texte",
      visualStyle: /ultra réaliste|cinéma|hollywood|pub/.test(t) ? "cinématique" : "",
      duration: (text.match(/\b\d+\s?(s|sec|min)\b/i) || [""])[0],
      restrictions: /ne pas|interdit|sans toucher/.test(t) ? ["restrictions utilisateur détectées"] : [],
      assumptions: []
    };
  }

  function modelIdeal(target) {
    if (target === TOOL_TARGETS.SORA) return ["objectif", "durée", "format", "ambiance", "caméra", "décor", "style", "sortie"];
    return ["objectif", "scope", "contraintes", "plateformes", "offline", "localStorage", "livrables", "tests"];
  }

  function missingInfoEngine(draft) {
    const ideal = modelIdeal(draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget);
    const src = normalize(draft.userRawDescription);
    const known = {
      objectif: !!draft.extractedInfo.objective,
      scope: draft.extractedInfo.existingUI || /nouveau projet/.test(src),
      contraintes: draft.extractedInfo.restrictions.length > 0 || draft.extractedInfo.uiLock,
      plateformes: draft.extractedInfo.targetPlatforms.length > 0,
      offline: /offline|hors ligne/.test(src),
      localStorage: /localstorage/.test(src),
      livrables: /livrable|output|sortie|fichier/.test(src),
      tests: /test|qa|validation/.test(src),
      durée: /\b\d+\s?(s|sec|min)\b/.test(src),
      format: /16:9|9:16|vertical|horizontal|carré/.test(src),
      ambiance: /ambiance|mood|romantique|dramatique/.test(src),
      caméra: /camera|drone|travelling|plan/.test(src),
      décor: /forêt|océan|ville|décor|scene|route|montagne/.test(src),
      style: /cinéma|réaliste|artistique|hollywood|pub/.test(src),
      sortie: /storyboard|prompt/.test(src)
    };
    return ideal.filter((key) => !known[key]).map((k, idx) => ({ key: k, priority: idx < 3 ? "critique" : idx < 6 ? "importante" : "bonus" }));
  }

  function applyAssumptions(draft) {
    const assumptions = [];
    if (draft.toolTarget === TOOL_TARGETS.CODEX && !draft.extractedInfo.localStorageRequired) assumptions.push("Hypothèse: localStorage recommandé pour persistance locale.");
    if (draft.toolTarget === TOOL_TARGETS.SORA && !draft.extractedInfo.duration) assumptions.push("Hypothèse: durée 20-30 secondes.");
    if (draft.toolTarget === TOOL_TARGETS.UNKNOWN) assumptions.push("Hypothèse: cible Codex par défaut tant que la cible n'est pas confirmée.");
    draft.extractedInfo.assumptions = assumptions;
    return draft;
  }

  function selectQuestionMode(draft) {
    if (draft.depthMode && QUESTION_MODES[draft.depthMode]) return draft.depthMode;
    if (draft.parsedIntent.precisionLevel === "élevé") return "rapide";
    if (draft.parsedIntent.complexity === "élevée") return "expert";
    return "standard";
  }

  function adaptiveQuestionFlow(draft) {
    const target = draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget;
    const modeKey = selectQuestionMode(draft);
    const mode = QUESTION_MODES[modeKey];
    const bank = QUESTION_BANK[target] || QUESTION_BANK.codex;
    const prioritized = [];

    const criticalOrder = ["outil cible", "objectif principal", "existant ou nouveau", "verrou UI", "plateforme", "format de sortie"];
    criticalOrder.forEach((item) => prioritized.push({ question: `Clarification critique: ${item} ?`, priority: "critique", key: item }));

    Object.entries(bank).forEach(([block, questions]) => {
      questions.forEach((q) => prioritized.push({ question: q, priority: block === "contexte" || block === "contraintes" ? "critique" : "importante", key: block }));
    });

    const dedup = [];
    const seen = new Set();
    prioritized.forEach((q) => {
      const key = normalize(q.question);
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(q);
      }
    });

    return dedup.slice(0, mode.questionLimit);
  }

  function buildConstraintLines(info, target) {
    const lines = [];
    if (info.uiLock) {
      lines.push("Ne jamais modifier le UI/visuel existant.");
      lines.push("Répétition sécurité: aucune altération du style actuel n'est autorisée.");
    }
    if (info.offlineRequired) lines.push("Fonctionnement offline requis.");
    if (info.targetPlatforms.length) lines.push(`Compatibilité cible: ${info.targetPlatforms.join(", ")}.`);
    if (info.repoTarget) lines.push(`Déploiement attendu: ${info.repoTarget}.`);
    if (target === TOOL_TARGETS.CODEX) {
      lines.push(info.localStorageRequired ? "localStorage obligatoire." : "localStorage recommandé pour brouillons/préférences/historique.");
      if (info.noBackend) lines.push("Aucun backend autorisé.");
      if (info.pwa) lines.push("Prévoir contraintes PWA.");
    }
    return lines;
  }

  function sanitizePrompt(text) {
    const lines = String(text || "").split("\n").map((x) => x.trimEnd());
    const compact = [];
    const seen = new Set();
    lines.forEach((line) => {
      const k = normalize(line);
      if (!k) {
        if (compact.length && compact[compact.length - 1] !== "") compact.push("");
        return;
      }
      if (!seen.has(k)) {
        seen.add(k);
        compact.push(line);
      }
    });
    return compact.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function codexSections(draft, level) {
    const e = draft.extractedInfo;
    const constraints = buildConstraintLines(e, TOOL_TARGETS.CODEX).map((c) => `- ${c}`).join("\n");
    const objective = e.objective || draft.userRawDescription;
    const detailBoost = level === "xl" ? "Détail maximal: inclure pseudo-code, cas limites, plan de validation, impacts et rollback." : "Détail professionnel exécutable.";
    const technicalBonus = level === "technical" ? "Inclure structures de données, signatures fonctions et stratégie tests unitaires/intégration." : "";

    return sanitizePrompt([
      "1) RÔLE / MISSION",
      "Tu es GPT-5.2-Codex, ingénieur logiciel senior spécialisé en évolution d'app existante.",
      `Mission: ${objective}`,
      "",
      "2) CONTEXTE EXISTANT",
      `- Type: ${e.existingUI ? "app existante" : "nouveau projet"}`,
      `- Sous-type: ${draft.subtype}`,
      `- État initial: ${e.existingUI ? "base déjà en place" : "à créer"}`,
      "",
      "3) CONTRAINTES ABSOLUES",
      constraints,
      "",
      "4) OBJECTIFS DÉTAILLÉS",
      "- Implémenter uniquement ce qui sert l'objectif principal.",
      "- Transformer les termes vagues en critères concrets.",
      "- Garantir robustesse logique + messages d'erreur clairs.",
      "",
      "5) COMPORTEMENTS ATTENDUS",
      "- Poser exactement deux questions de clarification si des informations critiques manquent.",
      "- Répondre directement et clairement à chaque question utilisateur avant de poursuivre.",
      "- Poser hypothèses explicites uniquement après les questions si les réponses restent incomplètes.",
      "- Prioriser questions critiques puis secondaires.",
      "- Éviter les changements non demandés.",
      "",
      "6) ARCHITECTURE SOUHAITÉE",
      "- Modules séparés: analyse, questions, scoring, génération, recommandations.",
      "- Code maintenable et extensible.",
      "",
      "7) PERSISTANCE",
      "- Sauvegarder progression, réponses, dernier projet, mode profondeur, dernier outil.",
      "",
      "8) COMPATIBILITÉ",
      `- Plateformes: ${e.targetPlatforms.join(", ") || "web standard"}`,
      "",
      "9) LIVRABLES",
      "- Prompt court, prompt pro, prompt XL, prompt technique, variante alternative.",
      "- Résumé projet + checklist validation.",
      "",
      "10) VALIDATIONS",
      "- Vérifier non-régression UI, cohérence contraintes, absence de contradictions.",
      "",
      "11) CRITÈRES DE RÉUSSITE",
      "- Prompt actionnable, précis, copiable, sans ambiguïté majeure.",
      "",
      "12) BONUS FACULTATIFS",
      "- Ajouter boosters recommandés et exemples guidés.",
      "",
      "13) RÉSUMÉ FINAL",
      `${detailBoost} ${technicalBonus}`
    ].join("\n"));
  }

  function soraSections(draft, level) {
    const e = draft.extractedInfo;
    const detail = level === "short" ? "Prompt compact, très lisible." : "Prompt riche cinématique, cohérence visuelle stricte.";
    const technical = level === "technical" ? "Inclure focale, tempo de coupe, profondeur de champ, exclusions strictes." : "";
    return sanitizePrompt([
      "1) SUJET PRINCIPAL",
      e.objective || draft.userRawDescription,
      "",
      "2) DÉCOR",
      "Décrire lieu, textures, échelle, éléments de fond.",
      "",
      "3) AMBIANCE",
      "Tonalité émotionnelle et rythme narratif.",
      "",
      "4) LUMIÈRE",
      "Qualité de lumière, direction, contrastes.",
      "",
      "5) MÉTÉO",
      "Conditions atmosphériques cohérentes.",
      "",
      "6) MOUVEMENT CAMÉRA",
      "Travelling/panoramique/drone selon intentions.",
      "",
      "7) ÉMOTIONS",
      "Intentions émotionnelles des personnages ou de la scène.",
      "",
      "8) STYLE CINÉMATIQUE",
      e.visualStyle || "ultra réaliste cinéma",
      "",
      "9) DÉTAILS VISUELS FINS",
      "Micro-textures, reflets, profondeur, particules.",
      "",
      "10) COHÉRENCE DE SCÈNE",
      "Continuité des éléments entre plans.",
      "",
      "11) NIVEAU DE RÉALISME",
      "Photorealistic high fidelity.",
      "",
      "12) FORMAT / DURÉE",
      `${e.duration || "20-30s"}, format à confirmer`,
      "",
      "13) EXCLUSIONS",
      "No watermark, no text overlay, no glitch artifacts.",
      "",
      "Synthèse:",
      `${detail} ${technical}`
    ].join("\n"));
  }

  function promptComposer(draft, level) {
    const target = draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget;
    const normalizedLevel = level === "simple" ? "short" : level;
    return target === TOOL_TARGETS.SORA ? soraSections(draft, normalizedLevel) : codexSections(draft, normalizedLevel);
  }

  function computeHeuristicScores(draft) {
    const text = normalize(draft.finalPrompt || draft.promptVariants.full || "");
    const isSora = (draft.toolTarget === TOOL_TARGETS.SORA);
    const checks = {
      objective: /mission|objectif|sujet principal/.test(text),
      measurable: /critères de réussite|mesurable|score/.test(text),
      constraints: /contraintes/.test(text),
      platform: /compatibilité|plateformes|format/.test(text),
      forbidden: /interdit|no watermark|ne jamais modifier/.test(text),
      initialState: /état initial|app existante|nouveau projet/.test(text),
      finalState: /résumé final|synthèse/.test(text),
      outputFormat: /livrables|prompt court|storyboard/.test(text),
      detailCoherence: text.length > 500,
      ambiguityHandling: /hypothèse|clarification/.test(text),
      toolFit: isSora ? /caméra|lumière|décor/.test(text) : /architecture|tests|modulaire/.test(text),
      actionable: /implémenter|ajouter|vérifier/.test(text)
    };

    const detailed = KNOWLEDGE_PACK.promptHeuristics.map((h) => ({ ...h, score: checks[h.key] ? h.weight : 0 }));
    const global = Math.min(100, detailed.reduce((sum, d) => sum + d.score, 0));
    return { global, detailed, checks };
  }

  function qualityScorer(draft) {
    const heur = computeHeuristicScores(draft);
    const clarity = Math.min(20, heur.checks.objective ? 18 : 9);
    const depth = Math.min(20, heur.checks.detailCoherence ? 17 : 8);
    const context = Math.min(15, heur.checks.initialState ? 13 : 6);
    const actionable = Math.min(15, heur.checks.actionable ? 13 : 6);
    const ambiguityRisk = Math.max(0, 15 - (draft.parsedIntent.ambiguityRisks.length * 3));
    const constraintsRichness = Math.min(15, heur.checks.constraints ? 13 : 6);
    const toolFit = Math.min(15, heur.checks.toolFit ? 13 : 5);
    const completeness = Math.min(20, heur.checks.constraints && heur.checks.outputFormat ? 18 : 10);
    const executionReadiness = Math.min(20, heur.checks.actionable && heur.checks.measurable ? 17 : 8);
    return {
      global: heur.global,
      clarity,
      depth,
      context,
      actionable,
      completeness,
      executionReadiness,
      ambiguityRisk,
      constraintsRichness,
      toolFit,
      detailed: heur.detailed
    };
  }

  function detectContradictions(draft) {
    const text = normalize(`${draft.userRawDescription || ""}\n${draft.finalPrompt || ""}`);
    const contradictions = [];
    const matrix = [
      { a: /sans backend|no backend/, b: /api externe|backend obligatoire/, message: "Conflit backend: 'sans backend' vs besoin d'API/backend." },
      { a: /ne pas toucher( au)? ui|ui strict/, b: /refonte ui|changer le design/, message: "Conflit UI: verrou UI vs demande de refonte visuelle." },
      { a: /offline|hors ligne/, b: /dépendance réseau obligatoire|connexion permanente/, message: "Conflit offline: mode hors ligne vs dépendance réseau." },
      { a: /prompt simple|simple/, b: /ultra pro|détail maximal/, message: "Conflit mode: prompt simple et ultra pro simultanés." }
    ];
    matrix.forEach((rule) => {
      if (rule.a.test(text) && rule.b.test(text)) contradictions.push(rule.message);
    });
    return contradictions;
  }

  function detectGenerationMode(draft) {
    const src = normalize(`${draft.userRawDescription || ""} ${(draft.depthMode || "")}`);
    if (/mode\s*rapide|\brapide\b/.test(src)) return "rapide";
    if (/ultra\s*pro|mode\s*ultra/.test(src)) return "ultra_pro";
    if (/prompt\s*ma[iî]tre|mode\s*ma[iî]tre/.test(src)) return "master";
    if (/prompt\s*simple|mode\s*simple/.test(src)) return "simple";
    return "standard";
  }

  function autoRefinePrompt(text, draft, mode) {
    const profile = GENERATION_MODES[mode] || GENERATION_MODES.standard;
    const suggestions = (draft.suggestions || []).slice(0, 3).map((s) => `- ${s}`);
    const footer = [
      "",
      "[RAFFINAGE AUTO]",
      `- Profil: ${profile.label}`,
      "- Détection contradictions exécutée",
      ...(suggestions.length ? ["- Renforcements recommandés:", ...suggestions] : [])
    ].join("\n");
    if (profile.refinementLevel === "light") return sanitizePrompt(text);
    return sanitizePrompt(`${text}\n${footer}`);
  }

  function selectInspiringExamples(draft, limit) {
    const target = draft.toolTarget === TOOL_TARGETS.SORA ? "sora" : "codex";
    return (KNOWLEDGE_PACK.examples[target] || []).slice(0, limit || 3);
  }

  function buildFaq(draft) {
    const contradictions = draft.contradictions || [];
    return [
      `Q: Quel mode est actif ?\nR: ${draft.generationModeLabel || "mode standard"}.`,
      `Q: Contradictions détectées ?\nR: ${contradictions.length ? contradictions.join(" | ") : "Aucune contradiction critique."}`,
      "Q: Comment renforcer ?\nR: Appliquer les suggestions puis régénérer en mode prompt maître pour la version finale."
    ].join("\n\n");
  }

  function upgradeSuggestions(draft) {
    const suggestions = [];
    const target = draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget;
    if (target === TOOL_TARGETS.CODEX && !draft.extractedInfo.uiLock) suggestions.push("Préciser explicitement si le UI est verrouillé.");
    if (!draft.extractedInfo.offlineRequired && target === TOOL_TARGETS.CODEX) suggestions.push("Confirmer l'exigence offline-first.");
    if (!/test/i.test(draft.userRawDescription) && target === TOOL_TARGETS.CODEX) suggestions.push("Ajouter tests logiques finaux attendus.");
    if (target === TOOL_TARGETS.SORA) suggestions.push("Ajouter lumière, météo, caméra et continuité visuelle.");
    expandWeakWords(draft.userRawDescription).slice(0, 5).forEach((item) => suggestions.push(`"${item.source}" → ${item.concrete}`));
    return suggestions;
  }

  function finalRecommendations(draft) {
    const missing = draft.missingQuestions.slice(0, 3).map((m) => m.key).join(", ");
    const top = (draft.suggestions || []).slice(0, 3).join(" | ");
    return {
      missing: missing || "aucun manque critique",
      recommendation: top || "continuer avec la version pro",
      boost: "Ton prompt sera plus fort si on précise les critères de réussite et le format de sortie."
    };
  }

  function buildReasoningSummary(draft) {
    const rec = finalRecommendations(draft);
    return [
      `Cible détectée: ${draft.toolTarget}`,
      `Objectif compris: ${draft.extractedInfo.objective || "à clarifier"}`,
      `Zones floues restantes: ${rec.missing}`,
      `Niveau de précision: ${draft.parsedIntent.precisionLevel}`,
      `Je recommande d'ajouter: ${rec.recommendation}`,
      rec.boost
    ].join("\n");
  }

  function buildChecklist(target, draft) {
    const src = normalize(draft.finalPrompt || "");
    if (target === TOOL_TARGETS.SORA) {
      const items = [
        ["décor clair", /décor/.test(src)], ["ambiance claire", /ambiance/.test(src)], ["lumière claire", /lumière/.test(src)],
        ["mouvement caméra présent", /caméra|drone|travelling/.test(src)], ["émotion présente", /émotion/.test(src)],
        ["réalisme défini", /réalisme|photorealistic/.test(src)], ["style défini", /style/.test(src)]
      ];
      return items;
    }
    const items = [
      ["objectif clair", /mission|objectif/.test(src)], ["contraintes nommées", /contraintes/.test(src)], ["UI protégé", /ui/.test(src)],
      ["offline mentionné", /offline/.test(src)], ["plateforme mentionnée", /plateforme|compatibilité/.test(src)],
      ["format de sortie mentionné", /livrables|sortie/.test(src)], ["validations incluses", /validation/.test(src)], ["test final inclus", /test/.test(src)]
    ];
    return items;
  }

  function strengthenPrompt(text, option, target) {
    const map = {
      "Rendre plus précis": "Ajoute des critères mesurables et des seuils de validation.",
      "Rendre plus technique": "Ajoute structures techniques, signatures et stratégie de tests.",
      "Rendre plus créatif": target === TOOL_TARGETS.SORA ? "Ajoute métaphores visuelles, transitions originales." : "Ajoute alternatives d'implémentation innovantes.",
      "Rendre plus puissant": "Ajoute edge cases, fallback et mécanismes robustes.",
      "Rendre plus vendable": "Ajoute bénéfices utilisateur et valeur métier.",
      "Rendre plus cinématique": "Ajoute focales, mouvements caméra, étalonnage, continuité de plans.",
      "Rendre plus clair pour Codex": "Clarifie sections mission/contraintes/livrables/tests.",
      "Rendre plus visuel pour Sora": "Renforce décor, lumière, textures et dynamique émotionnelle."
    };
    return sanitizePrompt(`${text}\n\nRENFORCEMENT: ${option}. ${map[option] || ""}`);
  }

  function composeAllVariants(draft) {
    const target = draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget;
    const generationMode = detectGenerationMode(draft);
    const modeConfig = GENERATION_MODES[generationMode] || GENERATION_MODES.standard;
    draft.generationMode = generationMode;
    draft.generationModeLabel = modeConfig.label;
    draft.promptVariants.short = promptComposer(draft, "short");
    draft.promptVariants.full = promptComposer(draft, "pro");
    draft.promptVariants.xl = promptComposer(draft, "xl");
    draft.promptVariants.technical = promptComposer(draft, "technical");
    draft.promptVariants.alternative = strengthenPrompt(draft.promptVariants.full, target === TOOL_TARGETS.SORA ? "Rendre plus cinématique" : "Rendre plus puissant", target);
    draft.promptVariants.master = strengthenPrompt(draft.promptVariants.technical, "Rendre plus technique", target);
    draft.promptVariants.simple = draft.promptVariants.short;
    draft.promptVariants.batch = [draft.promptVariants.short, draft.promptVariants.full, draft.promptVariants.xl, draft.promptVariants.technical, draft.promptVariants.alternative, draft.promptVariants.master]
      .slice(0, modeConfig.variantCount);
    draft.projectSummary = buildReasoningSummary(draft);
    draft.finalPrompt = autoRefinePrompt(draft.promptVariants[modeConfig.primaryVariant] || draft.promptVariants.full, draft, generationMode);
    draft.contradictions = detectContradictions(draft);
    draft.examples = selectInspiringExamples(draft, generationMode === "rapide" ? 2 : 4);
    draft.score = qualityScorer(draft);
    draft.checklist = buildChecklist(target, draft);
    draft.generationHistory = draft.generationHistory || [];
    draft.generationHistory.unshift({ at: new Date().toISOString(), mode: generationMode, score: draft.score.global, preview: draft.finalPrompt.slice(0, 160) });
    draft.generationHistory = draft.generationHistory.slice(0, 12);
    draft.preferencesMemory = {
      tone: draft.extractedInfo.tone || "professionnel",
      outputLength: draft.extractedInfo.outputLength || "équilibré",
      deliveryFormat: draft.extractedInfo.deliveryFormat || "prompt final direct",
      lastMode: generationMode
    };
    draft.favorites = draft.favorites || [];
    draft.presets = draft.presets || [];
    draft.faq = buildFaq(draft);
    return draft;
  }

  function exportModule(draft) {
    const target = draft.toolTarget === TOOL_TARGETS.UNKNOWN ? TOOL_TARGETS.CODEX : draft.toolTarget;
    const checklist = buildChecklist(target, draft).map(([label, ok]) => `- [${ok ? "x" : " "}] ${label}`).join("\n");
    return {
      final: draft.finalPrompt,
      short: draft.promptVariants.short,
      pro: draft.promptVariants.full,
      xl: draft.promptVariants.xl,
      technical: draft.promptVariants.technical,
      alternative: draft.promptVariants.alternative,
      master: draft.promptVariants.master,
      simple: draft.promptVariants.simple,
      batch: draft.promptVariants.batch,
      summary: draft.projectSummary,
      checklist,
      faq: draft.faq,
      contradictions: draft.contradictions,
      examples: draft.examples
    };
  }

  function answerQuestion(draft, key, answer) {
    draft.answers[key] = answer;
    draft.history.push({ at: new Date().toISOString(), key, answer });
    draft.updatedAt = new Date().toISOString();
    return draft;
  }

  function createDraft(rawDescription, options) {
    const parsedIntent = intentClassifier(rawDescription);
    const extractedInfo = infoExtractor(rawDescription);
    const depthMode = options && options.depthMode ? options.depthMode : "standard";
    const draft = {
      id: `draft_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      toolTarget: parsedIntent.toolTarget,
      subtype: parsedIntent.subtype,
      userRawDescription: String(rawDescription || ""),
      parsedIntent,
      extractedInfo,
      depthMode,
      answers: {},
      missingQuestions: [],
      suggestedQuestions: [],
      suggestedBlocks: [],
      finalPrompt: "",
      promptVariants: { short: "", full: "", xl: "", technical: "", alternative: "", master: "", simple: "", batch: [] },
      outputEngine: { short: "", pro: "", xl: "", technical: "", alternative: "", master: "", simple: "", summary: "", checklist: "", faq: "" },
      score: { global: 0 },
      suggestions: [],
      recommendations: {},
      history: [],
      generationHistory: [],
      contradictions: [],
      examples: [],
      favorites: [],
      presets: [],
      preferencesMemory: {},
      faq: "",
      tags: []
    };

    draft.missingQuestions = missingInfoEngine(draft);
    draft.suggestedQuestions = adaptiveQuestionFlow(draft);
    draft.suggestedBlocks = [...new Set(draft.suggestedQuestions.map((q) => q.key))];
    draft.suggestions = upgradeSuggestions(draft);
    applyAssumptions(draft);
    draft.recommendations = finalRecommendations(draft);
    draft.reasoningSummary = buildReasoningSummary(draft);
    return draft;
  }

  return {
    TOOL_TARGETS,
    knowledgePack: KNOWLEDGE_PACK,
    questionModes: QUESTION_MODES,
    generationModes: GENERATION_MODES,
    detectWeakWords,
    expandWeakWords,
    intentClassifier,
    infoExtractor,
    missingInfoEngine,
    adaptiveQuestionFlow,
    promptComposer,
    qualityScorer,
    detectContradictions,
    upgradeSuggestions,
    buildReasoningSummary,
    createDraft,
    composeAllVariants,
    answerQuestion,
    exportModule,
    strengthenPrompt
  };
});
