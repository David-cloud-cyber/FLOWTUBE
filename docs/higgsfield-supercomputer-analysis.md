# Higgsfield Supercomputer — Teardown complet & feuille de route FLOWTUBE

> Analyse concurrentielle du « Supercomputer » de Higgsfield (agent créatif) à partir de
> 3 vidéos de démo, de recherche web et de l'inspection directe de leur MCP public.
> Objectif : cartographier **toutes** leurs capacités et définir comment les porter dans FLOWTUBE.
>
> Sources : démos YouTube (Adil / Axelton — Higgsfield product team, + reviews MCP Content Factory),
> higgsfield.ai/supercomputer-intro, explainx.ai (Hermes agent deep-dive), productcool, growwstacks,
> et la surface réelle des outils `mcp__Higgfields__*` (Marketing Studio, Brand Kit, Avatars,
> Products/WebProducts, Presets, Shorts Studio, workflows, Virality Predictor).

---

## 1. Vue d'ensemble

Higgsfield Supercomputer se présente comme **« le premier agent créatif cloud-native, auto-apprenant,
pour l'exécution de tâches end-to-end »** : un seul chat qui fait recherche → stratégie → production
visuelle → distribution. Positionnement clé : *« une agence marketing dans ton laptop »*.

Chiffres avancés par eux : **~61 skills de production**, **40+ outils intégrés**, **3 couches de mémoire**,
**27+ connecteurs**, routage multi-modèles (Claude Opus, GPT-5.5, Gemini pour le raisonnement ;
Seedance 2.0, Veo, Kling, Nano Banana, GPT-Image, Soul/Sol pour la génération), **15× de réduction
de coût** annoncée via le routage intelligent.

---

## 2. Teardown des capacités (exhaustif)

### 2.1 — Cerveau agent

| Capacité | Description | Détail observé |
|---|---|---|
| **Model Orchestrator** | L'agent choisit seul le meilleur modèle par sous-tâche | « auto » partout ; Gemini→analyse visuelle, Claude→plan/écriture, Sol→personnages, modèle vidéo→rendu. 4 modèles dans un seul chat. Routage = 15× moins cher (évite d'utiliser un modèle premium pour une tâche triviale) |
| **Skills** | Workflows de production testés, installables | 2 origines : (a) skills officiels construits/testés par l'équipe créative Higgsfield, mis à jour à chaque nouveau modèle ; (b) skills **personnels auto-écrits** : l'agent observe tes patterns récurrents et sauve le workflow comme skill perso (inspiré « Hermes ») |
| **Skills Marketplace** | Catalogue communautaire de workflows | Paid ads, UGC production, cinematic flow, podcast editing, product listing copy… Install → activation mid-chat via `/nom-du-skill` |
| **Mémoire 3 couches** | Contexte persistant qui compound dans le temps | (1) mémoire projet (assets, révisions, briefs sauvés dans un fichier projet) ; (2) mémoire long-terme utilisateur/marque (voix, style, couleurs, audience — ajoutable manuellement « Remember this for all future tasks ») ; (3) apprentissage par run (chaque tâche rend l'agent plus fin). Permet « fais-en un autre comme le #3 » d'une session à l'autre |
| **Connecteurs (27+)** | Intégrations bidirectionnelles | Google Drive, Notion, Slack, Gmail, Telegram, Figma, Supabase, GitHub, Docs… L'agent lit tes docs, dépose les assets finis dans le bon dossier, poste dans le bon canal, notifie sur Telegram. Même agent / mémoire / skills accessibles depuis le téléphone (Telegram) |
| **Import via MCP** | Migration native depuis un autre agent | 2 clics : importe mémoire + anciens skills depuis Claude, ChatGPT, Hermes, OpenClaw via MCP (standard ouvert) |
| **Ask vs Auto-run** | Toggle de contrôle | « Ask » = confirmation à chaque étape (garde le contrôle créatif, approuve avant de dépenser les crédits) ; « Auto-run » = exécute tout sans interruption |

### 2.2 — Deux choix d'architecture différenciants

1. **Analyse visuelle native (multimodal)** — l'agent travaille sur **les frames réelles**, pas sur une
   description texte. Tu déposes la vidéo d'un concurrent → il lit les hooks, le timing du hook (à quelle
   seconde l'attention est captée), le pacing, les chutes de rétention, les patterns de caption, *pourquoi*
   la pub marche. Ce n'est pas un résumé : c'est un breakdown exploitable comme point de départ.
2. **Cohérence par références (« Elements »)** — couche de références entre le prompt et le modèle :
   personnages, environnements, props, assets de marque **épinglés** et réutilisés sur tous les plans d'une
   session. Modèle d'identité entraîné (**Soul ID / Solidity**) qui tient la ressemblance des visages sur
   toutes les générations → cohérence long-form (même perso, même décor sur une séquence multi-clips).

### 2.3 — Pipeline de production (le « Content Factory »)

Workflow phare décrit en **5 stages** avec permission gates :

1. **Stage 1 — Research** : scrape live TikTok/Instagram/YouTube du niche → *viral content brief* :
   table de tendances, concurrents qui cartonnent, patterns de hooks, **20 idea cards** (chaque carte =
   preset name + setting + system hook + durée + description de scène + ligne de caption).
2. **Stage 2 — Content plan** : calendrier de production. Préremplit tout (nom de campagne auto-dérivé,
   plage de dates, répartition des presets calculée). Ex. **100 vidéos UGC réparties sur 5 formats**,
   groupées par format = document de prod (plus complet que ce qu'on donnerait à un producteur humain).
3. **Stage 3 — Generate** : génération par **batches avec permission gate avant chaque batch** (tu approuves
   au fur et à mesure, tu ne regardes pas juste les crédits fondre). Formats UGC observés : *street interview,
   unboxing, product review, entertainment/challenge, ASMR*. L'agent choisit preset + hook + setting adaptés.
4. **Stage 4 — Schedule / Meta Ads** : branche sur le MCP Meta Ads → upload + planification directe dans les
   campagnes ; analyse ce qui performe le mieux pour ajuster.
5. **Stage 5 — Cost breakdown** : rapport de crédits complet vs coût « traditionnel » (agence/vidéaste/
   créateurs UGC). Ex. cité : 100 vidéos = ~15 000 crédits ≈ 900 $ vs ~28 000–99 000 $ en traditionnel.

### 2.4 — Cas d'usage démontrés

- **UGC à l'échelle** : 100 vidéos UGC produites sans écrire un seul prompt, à partir d'1 URL + 1 image produit.
- **Long-form cinématique** : film narratif multi-plans avec cohérence perso/décor (Cinematic Flow Scale :
  personnages+lieux en Soul Cinema sauvés comme Elements → clips en C2.0 via Cinema Studio → stitch final).
- **Content factory e-commerce** : recherche produit Amazon (bestseller data, marges, FBA fees, lecture de
  milliers d'avis) → brand book → photos produit → 15 concepts pub → 100 UGC → ads.
- **Photos produit / packshots** : 5 photos premium depuis 1 URL produit (prêtes Shopify/Meta).
- **Vibe-coding de site web** : site complet designé + codé + hébergé + déployé (URL live) depuis 1 prompt +
  1 référence de design (recherche design → visuels → build → auto-hébergement → deploy).
- **Formats** : UGC, ads statiques, TV commercials, product photoshoots, brand campaigns, animation,
  motion design, hypermotion, podcasts, shorts (Shorts Studio restyle une vidéo source en clips).

### 2.5 — Surface réelle du MCP Higgsfield (outils inspectés)

Confirme l'ampleur : `generate_image/video/audio/3d`, `models_explore` (recommend/list/get),
`show_marketing_studio` (avatars, products, **webproducts**, **brand_kit**, hooks, settings, ad formats),
`shorts_studio_*` (restyle + presets), `get_workflow_instructions` (workflows bundlés = SKILL.md multi-étapes),
édition dédiée (`upscale`, `outpaint`, `reframe`, `remove_background`, `motion_control`),
`virality_predictor`, `video_analysis_*`, `personal_clipper_*`, `dubbing`, `voice_change`, `create_voice`,
`website_*` (db/secrets/deploy/repo), connecteurs, `media_confirm`/`media_upload_widget`.

---

## 3. FLOWTUBE aujourd'hui — état des lieux

Ce que FLOWTUBE fait **déjà** (et qui recoupe Higgsfield) :

- ✅ **Chat agent streaming** (Claude, vrai SSE) avec mémoire conversationnelle (20 derniers tours).
- ✅ **Orchestrator-lite** : `resolveBestModelFromCatalog` choisit le meilleur modèle fal.ai (type,
  capacité, coût, qualité) — « Auto HuggyFlow ». C'est un embryon de Model Orchestrator.
- ✅ **Skills library** (`HUGGYFLOW_SKILL_LIBRARY`, ~26 skills scorés par la demande + l'historique).
- ✅ **Batch génération jusqu'à 50** en continu, par vagues selon la concurrence du plan, gate de confirmation.
- ✅ **Détection d'intention** (question vs création), contexte enrichi (plan, crédits, projet, 3 dernières créations).
- ✅ **Crédits / plans / devis**, garde-fous (concurrence, plafonds), persistance projets/conversations.

Ce qui **manque** vs Higgsfield (les vrais écarts) :

| Écart | Higgsfield | FLOWTUBE aujourd'hui |
|---|---|---|
| Mémoire persistante marque/utilisateur | 3 couches, brand book, « remember for all tasks » | Mémoire conversationnelle uniquement (pas de mémoire projet/marque durable) |
| Elements / références réutilisables | Personnages/props/assets épinglés + Soul ID cohérence | Aucun système de références nommées |
| « Fais-en un autre comme le #3 » | Oui (mémoire projet indexée) | Non |
| Recherche / analyse concurrentielle | Scrape live TikTok/IG/YT, analyse de tendances | Aucune (pas de browsing) |
| Analyse visuelle (frames) | Hook timing, pacing, rétention | Aucune |
| Content plan structuré | Calendrier N vidéos × M formats | Batch plat (N items identiques) |
| Workflows multi-étapes (skills) | Research→plan→generate→schedule | Skills = simples hints de prompt |
| Approval gates par batch | Gate avant **chaque** sous-batch | 1 seule confirmation globale |
| Brand kit (identité) | Voix/couleurs/typo/positionnement persistants | Aucun |
| Connecteurs | 27+ (Drive, Slack, Telegram…) | Aucun |
| Rapport de coût | Crédits vs traditionnel | Devis par item seulement |
| Toggle Ask/Auto-run | Oui | Confirmation forcée sur le cher |

---

## 4. Feuille de route d'implémentation (priorisée par valeur / faisabilité)

Découpée en phases. Les phases 1–2 sont réalisables **dans l'archi actuelle** (Supabase + edge function +
Claude + fal.ai) sans nouvelle infra. La phase 3 demande browsing / vision / intégrations externes.

### Phase 1 — Mémoire & personnalisation (haute valeur, faisable maintenant)
1. **Mémoire de marque persistante** : table `brand_memory` (par user/projet) — nom de marque, voix, couleurs,
   audience, notes libres. Commande « retiens ceci » détectée dans le chat → sauvegarde. Injectée dans le
   contexte système à chaque tour. → reproduit « it remembers your brand voice ».
2. **Références indexées / « comme le #N »** : numéroter les créations d'un projet ; résoudre « le 3ᵉ »,
   « la dernière », « la même mais… » vers la génération correspondante (réutilise prompt/params/scene).
3. **Content plan pour les lots** : au lieu de N items identiques, l'agent décline le lot en **formats variés**
   (ex. UGC : street interview / unboxing / review / entertainment / ASMR) avec un prompt distinct par item.

### Phase 2 — Références & workflows multi-étapes
4. **Elements (références nommées réutilisables)** : épingler une image (perso, packshot, logo) sous un nom,
   la rappeler par `@nom` → passée en `imageUrl`/reference au modèle fal pour la cohérence.
5. **Skill « Content Factory » multi-étapes** : orchestration research-lite → content plan → batch par format →
   gate par format. Formalise un vrai workflow (comme les SKILL.md Higgsfield).
6. **Rapport de coût** : commande qui totalise les crédits d'un projet/lot + estimation « équivalent agence ».
7. **Toggle Ask / Auto-run** : préférence par projet (confirmer chaque étape vs enchaîner).

### Phase 3 — Capacités avancées (nouvelle infra)
8. **Brand kit depuis URL** : scrape d'une page produit/marque → identité (nécessite browsing edge-side).
9. **Analyse visuelle** : upload d'une image/vidéo concurrente → analyse via modèle vision (hooks, pacing).
10. **Connecteurs** : au minimum un webhook sortant (« notifie-moi / dépose ici ») ; Telegram/Drive ensuite.
11. **Recherche de tendances** : intégration d'une source de tendances (API), pas de scraping direct.

---

## 5. Notes de faisabilité & garde-fous

- **IP & éthique** : on implémente des **capacités/patterns** (mémoire, orchestration, références, batch,
  workflows), pas de copie verbatim de prompts propriétaires Higgsfield. Implémentations originales.
- **Réseau** : le sandbox de dev bloque l'accès sortant (Supabase, blogs). Le déploiement effectif de la
  fonction edge (`supabase functions deploy flowtube-api`) reste à faire côté propriétaire.
- **Vision / browsing** : la phase 3 suppose que l'edge function ait accès réseau + un modèle vision — à
  valider avant de s'engager.
