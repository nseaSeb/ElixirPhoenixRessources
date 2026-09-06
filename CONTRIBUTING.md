# Contribuer

[Accueil](README.md) · [Le blog](https://nseaseb.github.io/ElixirPhoenixRessources/)

Ce dépôt rassemble des ressources Elixir / Phoenix en français et, depuis peu, [un blog d'articles](https://nseaseb.github.io/ElixirPhoenixRessources/). Les deux sont ouverts aux contributions.

L'objectif est simple à énoncer : **il n'existe presque pas de contenu Elixir vivant en français**, et j'aimerais que ça change. Les rares articles francophones datent d'il y a plusieurs années, et certains ont disparu du web avec leur hébergeur. Ce n'est pas faute de développeurs francophones — c'est faute d'endroit où publier.

## Quatre façons d'aider, de la plus petite à la plus grande

### 1. Corriger une coquille (une minute)

Chaque article du blog a un lien **« Proposer une correction »** en bas de page, qui ouvre l'éditeur GitHub sur le bon fichier. Faute d'orthographe, exemple de code qui ne compile pas, explication confuse : tout se corrige d'un clic, puis d'une pull request.

Pour les notes du dépôt, le crayon d'édition de GitHub fait la même chose.

### 2. Ajouter une ressource

Le [README](README.md) recense blogs, livres, podcasts, conférences, librairies. Si vous connaissez quelque chose qui manque — **surtout en français** — ouvrez une pull request.

Deux règles pour qu'une entrée soit utile :

- **un lien vivant**, vérifié le jour où vous l'ajoutez ;
- **une description en une ligne** qui dit à qui ça sert, pas ce que c'est. « blog d'une agence » n'aide personne ; « articles Phoenix / LiveView d'une agence, très fouillés » oui.

### 3. Proposer un sujet d'article

Vous butez sur quelque chose qu'aucun article en français n'explique ? [Ouvrez une issue](https://github.com/nseaSeb/ElixirPhoenixRessources/issues). C'est déjà une contribution : ça documente un manque, et quelqu'un l'écrira peut-être — vous, ou un autre.

**Sujets actuellement recherchés**, tous sans équivalent francophone à ma connaissance :

- Oban : jobs en arrière-plan, du premier worker à la production
- Les tests Phoenix : `ConnCase`, `LiveViewTest`, la sandbox SQL
- Nerves : Elixir sur un Raspberry Pi
- Le système de types d'Elixir : ce que les types gradués changent au quotidien
- Ash Framework : à quoi ça sert vraiment, et quand ne pas s'en servir
- Déployer Phoenix ailleurs que sur Fly.io : VPS, Docker, systemd
- Telemetry et l'observabilité d'une app Phoenix
- Les migrations Ecto en production : verrous, index concurrents, colonnes ajoutées sans downtime

### 4. Écrire un article

La contribution la plus précieuse. **Votre nom apparaît sur l'article.**

#### La marche à suivre

Un article est un fichier Markdown dans `docs/_posts/`, nommé `AAAA-MM-JJ-slug-sans-accent.md`. Son en-tête :

```yaml
---
layout: post
title: "Un titre qui dit le problème, pas la technologie"
date: 2026-09-06 10:00:00 +0200
lang: fr
description: "Une phrase qui donne envie de lire, reprise par les moteurs de recherche."
tags: [ecto, postgres]
author: "Votre nom"
author_url: "https://github.com/votre-pseudo"
author_github: "votre-pseudo"
---
```

Puis le corps, en titres `##` et `###` — le `#` est généré à partir du `title`. Un `<!--more-->` après les premiers paragraphes délimite l'extrait affiché sur l'accueil.

#### Deux pièges qui coûtent cher

**Encadrez chaque bloc de code de `{% raw %}` et `{% endraw %}`.** Liquid, le moteur de gabarits de Jekyll, s'exécute **avant** Markdown, y compris à l'intérieur des blocs de code. Or Elixir produit couramment les séquences qu'il interprète : `{%{}, types}` pour un changeset schemaless, ou `{{:ok, pid}, state}` pour un tuple imbriqué. Le résultat est une erreur de construction. Mettez `{% raw %}` sur sa propre ligne avant les trois backticks, `{% endraw %}` après — systématiquement, même quand le bloc a l'air inoffensif.

**Ne datez pas votre article dans le futur.** La configuration utilise `future: false` : un article daté ne serait-ce qu'une heure en avance est **ignoré silencieusement**, sans erreur ni avertissement. Il n'apparaît simplement pas.

#### Prévisualiser en local

```bash
cd docs
bundle install
bundle exec jekyll serve --drafts --port 8080
```

Puis ouvrez `http://127.0.0.1:8080/ElixirPhoenixRessources/` — l'adresse contient le nom du dépôt, la racine seule renvoie 404.

L'option `--drafts` affiche aussi les fichiers de `docs/_drafts/`, qui ne sont jamais publiés. C'est l'endroit idéal pour un article en cours : vous pouvez le pousser sans risque, il restera invisible jusqu'à son déplacement dans `_posts/`.

#### Ce qui fait un bon article ici

- **Partir d'un problème, pas d'une technologie.** « Ecto.Multi » est un sujet de documentation ; « composer une transaction sans se noyer dans les `with` » est un sujet d'article.
- **Du code qui tourne.** Testez vos exemples. Un exemple faux fait plus de mal qu'un article absent.
- **Dire aussi les limites.** Quand ne pas utiliser l'outil, ce qu'il coûte, ce qu'il ne fait pas. C'est ce qui distingue un article d'une plaquette commerciale.
- **Écrire pour quelqu'un qui vient de buter dessus.** Vous n'avez pas besoin d'être expert — vous avez besoin de vous souvenir de ce qui coinçait. C'est souvent un meilleur point de départ.

## Où me joindre

Par le dépôt, et uniquement par là : les [issues](https://github.com/nseaSeb/ElixirPhoenixRessources/issues) pour proposer un sujet, signaler une erreur ou lancer une discussion, les [pull requests](https://github.com/nseaSeb/ElixirPhoenixRessources/pulls) pour le reste.

## Licence

Tout le contenu est publié sous licence [MIT](LICENSE). En contribuant, vous acceptez que votre contribution le soit aussi.
