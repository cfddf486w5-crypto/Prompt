const assert = require('assert');
const engine = require('../prompt-engine.js');

function run() {
  const codexIntent = engine.intentClassifier('Je veux refactoriser une app existante, garder le UI, localStorage et offline pour iPhone et PC Windows.');
  assert.strictEqual(codexIntent.toolTarget, 'codex');

  const soraIntent = engine.intentClassifier('Créer une vidéo romantique cinématique avec drone, lumière coucher de soleil, format vertical.');
  assert.strictEqual(soraIntent.toolTarget, 'sora');

  const info = engine.infoExtractor('App existante. Ne pas toucher au UI. Support iPhone et PC Windows offline github pages.');
  assert.strictEqual(info.uiLock, true);
  assert.strictEqual(info.offlineRequired, true);
  assert.ok(info.targetPlatforms.includes('iPhone'));

  const draft = engine.createDraft('Ajoute un moteur IA à une app existante sans toucher au UI, offline et localStorage.', { depthMode: 'expert' });
  assert.ok(Array.isArray(draft.missingQuestions));
  assert.ok(Array.isArray(draft.suggestedQuestions));
  assert.ok(draft.suggestedQuestions.length <= engine.questionModes.expert.questionLimit);

  engine.composeAllVariants(draft);
  assert.ok(draft.promptVariants.short.includes('RÔLE / MISSION'));
  assert.ok(draft.promptVariants.xl.length > draft.promptVariants.short.length);
  assert.ok(draft.promptVariants.technical.includes('VALIDATIONS'));
  assert.ok(draft.promptVariants.short.includes('Poser exactement deux questions de clarification'));
  assert.ok(draft.promptVariants.short.includes('Répondre directement et clairement à chaque question utilisateur'));
  assert.ok(draft.promptVariants.alternative.includes('RENFORCEMENT'));
  assert.ok(draft.score.global > 0);
  assert.ok(draft.score.completeness >= 0);
  assert.ok(draft.score.executionReadiness >= 0);
  assert.ok(Array.isArray(draft.checklist));
  assert.ok(Array.isArray(draft.promptVariants.batch));
  assert.ok(draft.promptVariants.master.includes('RENFORCEMENT'));

  const exported = engine.exportModule(draft);
  assert.ok(exported.final !== undefined);
  assert.ok(exported.checklist.includes('- ['));
  assert.ok(exported.summary.includes('Cible détectée'));
  assert.ok(Array.isArray(exported.examples));
  assert.ok(Array.isArray(exported.contradictions));
  assert.ok(typeof exported.faq === 'string');

  const weak = engine.detectWeakWords('je veux un prompt pro, complet et intelligent');
  assert.ok(weak.includes('pro'));
  assert.ok(weak.includes('complet'));
  const strongerWeak = engine.detectWeakWords('je veux un agent fiable, scalable et sécurisé');
  assert.ok(strongerWeak.includes('fiable'));
  assert.ok(strongerWeak.includes('scalable'));
  assert.ok(strongerWeak.includes('sécurisé'));
  const expanded = engine.expandWeakWords('pro et intelligent');
  assert.ok(expanded.length >= 4);
  const expandedStrong = engine.expandWeakWords('fiable et sécurisé');
  assert.ok(expandedStrong.length >= 6);

  const soraDraft = engine.createDraft('Mini film romantique overland ultra réaliste avec caméra drone et storyboard.', { depthMode: 'ultra' });
  soraDraft.toolTarget = engine.TOOL_TARGETS.SORA;
  engine.composeAllVariants(soraDraft);
  assert.ok(soraDraft.promptVariants.full.includes('MOUVEMENT CAMÉRA'));


  const contradictionDraft = engine.createDraft('Je veux un mode prompt simple et ultra pro, sans backend mais API externe obligatoire.');
  engine.composeAllVariants(contradictionDraft);
  assert.ok(contradictionDraft.contradictions.length >= 1);
  const contradictionList = engine.detectContradictions(contradictionDraft);
  assert.ok(Array.isArray(contradictionList));


  const convo = engine.createConversationState('Je veux créer une app iPhone offline avec UI pro');
  assert.ok(convo.structuredPrompt.platform.includes('iPhone'));
  assert.ok(Array.isArray(convo.structuredPrompt.missingFields));

  const progressed = engine.continueConversation(convo, 'Pour Codex, je veux garder le UI existant et une version ultra détaillée');
  assert.ok(progressed.messages.length >= 2);
  assert.ok(progressed.structuredPrompt.mustKeep.includes('UI existant'));


  const questionTurn = engine.continueConversation(progressed, 'Pourquoi tu proposes ce format ?');
  const lastQuestionReply = questionTurn.messages[questionTurn.messages.length - 1].text;
  assert.ok(lastQuestionReply.includes('Je peux te répondre tout de suite'));

  const nudged = engine.nudgeConversation(questionTurn);
  assert.ok(nudged.messages[nudged.messages.length - 1].text.length > 10);

  const finalizedConvo = engine.generateFinalPromptSet(progressed);
  assert.ok(finalizedConvo.finalVariants.short.length > 10);
  assert.ok(finalizedConvo.finalVariants.ultra.includes('NIVEAU DE DÉTAIL'));

  const revised = engine.reviseConversationPrompt(finalizedConvo, 'plus court mais garde le mode offline');
  assert.ok(revised.structuredPrompt.constraints.includes('Offline requis'));

  const boosted = engine.strengthenPrompt('Base', 'Rendre plus technique', engine.TOOL_TARGETS.CODEX);
  assert.ok(boosted.includes('RENFORCEMENT'));

  assert.ok(engine.knowledgePack.codexBestPractices.length >= 10);
  assert.ok(engine.knowledgePack.examples.codex.length >= 4);
  assert.ok(engine.knowledgePack.examples.sora.length >= 3);
  assert.ok(engine.questionModes.architecte.questionLimit >= 16);

  console.log('All prompt-engine tests passed.');
}

run();
