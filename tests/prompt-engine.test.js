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

  const draft = engine.createDraft('Ajoute un moteur IA à une app existante sans toucher au UI, offline et localStorage.');
  assert.ok(Array.isArray(draft.missingQuestions));
  assert.ok(Array.isArray(draft.suggestedQuestions));

  engine.composeAllVariants(draft);
  assert.ok(draft.promptVariants.short.length > 10);
  assert.ok(draft.promptVariants.xl.length > 10);
  assert.ok(draft.score.global > 0);

  const exported = engine.exportModule(draft);
  assert.ok(exported.final !== undefined);
  assert.ok(exported.checklist.includes('Checklist'));

  const weak = engine.detectWeakWords('je veux un prompt pro, beau et moderne');
  assert.ok(weak.includes('pro'));
  assert.ok(weak.includes('beau'));

  console.log('All prompt-engine tests passed.');
}

run();
