# Prompt Factory XL — “Félix l’extraordinaire”

Application statique **offline-first** (HTML/CSS/JS), compatible GitHub Pages.

## Lancer en local
- Ouvrir `index.html` directement dans Safari/Chrome/Edge.
- Option recommandé: serveur statique local (`python3 -m http.server`) puis ouvrir `http://localhost:8000`.

## Publier sur GitHub Pages
1. Push sur la branche principale du repo.
2. Dans **Settings > Pages**, choisir:
   - Source: Deploy from a branch
   - Branch: `main` (ou branche cible), dossier `/root`
3. Sauvegarder: le site sera servi en statique sans backend.

## Fonctionnalités majeures
- Builder prompts Codex + Sora.
- Mode **Codex Pro** structuré.
- Mode **Sora Studio** avancé + presets + shot list + random pro cohérent.
- Analyseur de prompt (score + variables non résolues + améliorations).
- Système de **Projets** avec overrides templates/variables/historique.
- Feature flags (Sora Studio, Codex Pro, Analyseur, Projets, Debug).
- Export/Import JSON: complet + templates + packs + projets (merge/replace).

## localStorage (schéma v3)
- `pb_schema_version`: version de schéma.
- `pb_state_v3`: objet principal (`settings`, `templates`, `packs`, `appState`).
- `pb_backup_*`: backups automatiques avant migration/reset.

### `pb_state_v3` (résumé)
```json
{
  "settings": {
    "defaultType": "codex|sora",
    "vars": {"LIEU":"", "SUJET":"", "STYLE":"", "DUREE":"", "FORMAT":"", "CONTRAINTES":""},
    "features": {"soraStudio":true, "codexPro":true, "analyzer":true, "projects":true, "debug":false},
    "historyCaps": {"global":200, "project":200}
  },
  "templates": [],
  "packs": [],
  "appState": {
    "activeProjectId": "general",
    "globalHistory": [],
    "projects": [
      {
        "id": "general",
        "name": "Général",
        "description": "Projet par défaut",
        "templateOverrides": [],
        "history": [],
        "vars": {},
        "soraPresets": []
      }
    ]
  }
}
```

## Format export/import
### Export complet
```json
{
  "exportVersion": 2,
  "schema": 3,
  "app": "Prompt Factory XL",
  "exportedAt": "...",
  "data": {"settings":{}, "templates":[], "packs":[], "appState":{}},
  "checksum": "h..."
}
```

### Exports ciblés
- Templates: `{ "kind": "templates", "content": [...] }`
- Packs: `{ "kind": "packs", "content": [...] }`
- Projets: `{ "kind": "projects", "content": [...] }`

## Hypothèses prises
- Import templates/packs/projets passe via un seul modal de confirmation (fusion/remplacement).
- Les historiques V1 sans projet sont migrés vers le projet `Général`.
- Les styles existants sont conservés; seuls des blocs/sections compatibles ont été ajoutés.

## Checklist manuelle (iPhone Safari + PC Chrome/Edge)
- Ouvrir l'app et générer un prompt Codex puis Sora.
- Basculer de projet (Général / projet custom), vérifier templates/historique.
- Import JSON invalide: message clair sans crash.
- Import JSON valide: tester Fusionner puis Remplacer.
- Tester export complet puis réimport.
- Tester recherche templates/historique/blocs (debounce fluide).
- Tester Sora Random pro + génération auto.
