---
layout: post
title: "Brancher un notebook sur une application qui tourne"
date: 2026-09-07 06:26:00 +0200
lang: fr
description: "Les journaux ne disent pas tout, et un iex distant s'oublie à mesure qu'on tape. Livebook sait se connecter à un nœud Elixir vivant — voici les deux mécanismes, ce qu'ils permettent, et les précautions qu'ils exigent."
tags: [livebook, phoenix, production, debogage]
categories: [livebook]
sources:
  - titre: "Livebook runtimes"
    url: https://github.com/livebook-dev/livebook/blob/main/docs/runtime.md
    note: "les quatre types de runtime, et ce que le mode attaché interdit"
  - titre: "Livebook use cases"
    url: https://github.com/livebook-dev/livebook/blob/main/docs/use_cases.md
    note: "la cellule « Remote execution » et le mode attaché"
  - titre: "Connect Livebook to your app"
    url: https://fly.io/docs/elixir/advanced-guides/connect-livebook-to-your-app/
    auteur: "Fly.io"
  - titre: "Using TLS for Erlang Distribution"
    url: https://www.erlang.org/doc/apps/ssl/ssl_distribution.html
    note: "la distribution n'est pas chiffrée par défaut"
---

Quelque chose ne va pas en production. Les journaux montrent le symptôme sans la cause. Vous ouvrez un `iex` distant, vous tapez une ligne, puis une autre, vous remontez dans l'historique, vous perdez le fil. Une heure plus tard vous avez compris — et il ne reste rien de ce que vous avez fait.

[L'article précédent]({{ "/articles/outil-interne-livebook/" | relative_url }}) montrait comment transformer un script jetable en outil. Celui-ci s'attaque à la suite : brancher cet outil non plus sur une API publique, mais sur **votre application, en train de tourner**.

<!--more-->

## Pourquoi c'est possible

Rien de magique : la BEAM est distribuée depuis toujours. Un nœud Erlang peut en joindre un autre et exécuter du code dedans, à condition de connaître son nom et de partager son secret — le *cookie*.

C'est le mécanisme derrière `iex --remsh`, derrière les commandes d'une release, derrière Observer. Livebook s'en sert, avec une interface au-dessus.

Deux mécanismes distincts, qu'on confond souvent alors qu'ils n'ont ni la même puissance ni les mêmes risques.

## Préparer l'application

Dans les deux cas, l'application doit avoir un nom de nœud et un cookie. En développement, c'est la ligne que donne la documentation de Livebook :

{% raw %}
```shell
iex --name phoenix-app@127.0.0.1 --cookie secret -S mix phx.server
```
{% endraw %}

Pour une release, ces valeurs viennent des variables `RELEASE_NODE` et `RELEASE_COOKIE`. Sur un hébergeur, la marche à suivre dépend de la plateforme — [Fly.io documente la sienne](https://fly.io/docs/elixir/advanced-guides/connect-livebook-to-your-app/).

## Mécanisme 1 — la cellule « Remote execution »

Le plus prudent, et curieusement le moins connu.

Vous ajoutez une cellule intelligente **« Remote execution »** via le bouton « + Smart cell ». Elle vous demande le nom du nœud, le cookie, et le code à exécuter là-bas.

Ce qui compte : **votre runtime reste le vôtre.** Le notebook tourne dans son propre nœud, avec ses propres dépendances installées par `Mix.install`. Seul le code de cette cellule part sur le nœud distant, et son résultat revient.

Vous pouvez donc récupérer des données de production, puis les analyser localement avec des librairies que l'application n'a pas — les tracer avec VegaLite, les charger dans un DataFrame Explorer — sans rien installer sur le système en fonctionnement.

## Mécanisme 2 — le runtime « Attached node »

L'autre approche déplace le curseur entièrement.

Dans la barre latérale, l'icône « Runtime » — ou le raccourci `s` puis `r` — permet de choisir « Attached node » et d'y saisir le nom et le cookie. À partir de là, **le notebook entier s'exécute dans le nœud de l'application**. Vos cellules appellent directement les fonctions de votre code, comme si vous étiez dedans. Parce que vous y êtes.

La documentation officielle assortit ce mode d'un avertissement qui mérite d'être cité tel quel :

> Once connected, be careful: any code that you execute in the notebook now runs within the connected application.

Et d'une limite technique nette :

> your notebook cannot invoke `Mix.install`, it only has access to what's already loaded in the external node

Ce n'est pas une lacune, c'est une conséquence : on ne recompile pas des dépendances dans un système en production. La documentation le dit d'ailleurs sans détour — *« nor would that be a good idea on a running system »*.

**Comment choisir.** Le mode attaché quand vous avez besoin d'appeler le code de l'application directement, en développement ou sur un environnement de recette. La cellule « Remote execution » quand vous touchez à la production, parce qu'elle vous force à décider explicitement ce qui part là-bas.

## Ce qu'on va vraiment y chercher

L'intérêt n'est pas de remplacer `iex`, c'est de garder une trace.

**L'état d'un processus.** `:sys.get_state(MonApp.Cache)` vous rend l'état interne d'un `GenServer`. Dans un notebook, la commande reste écrite, commentée, réexécutable — et le collègue à qui vous envoyez le fichier voit ce que vous avez regardé.

**Une requête sur la vraie base.** En mode attaché, `Repo` est déjà chargé : `Repo.aggregate(Commande, :count)` fonctionne. Combiné à un `Kino.DataTable`, on obtient une exploration lisible plutôt qu'un `IO.inspect` déroulant.

**La forme du système.** `Supervisor.count_children/1`, `Registry.count/1`, `Process.list() |> length()`, `:erlang.memory()`. Ces chiffres, pris à intervalle régulier dans un `Kino.Frame`, donnent un tableau de bord improvisé en quelques lignes — sans déployer quoi que ce soit.

**Un correctif de données ponctuel.** Le cas où l'on migre trois lignes à la main. Écrit dans un notebook, il est relu avant d'être exécuté, et il reste ensuite comme trace de ce qui a été fait.

## Les précautions, qui ne sont pas facultatives

Ce mécanisme donne un accès complet à un système en fonctionnement. Il mérite le même sérieux qu'un accès SSH root.

**Le cookie est un secret.** Qui connaît le nom du nœud et le cookie exécute ce qu'il veut sur votre machine. Un cookie par environnement, jamais dans un dépôt, jamais dans une cellule de notebook — Livebook a des secrets prévus pour ça.

**La distribution Erlang n'est pas chiffrée par défaut.** En clair sur le réseau, cookie compris. Ne l'exposez jamais sur l'internet public : passez par un tunnel SSH, un réseau privé, ou [activez TLS sur la distribution](https://www.erlang.org/doc/apps/ssl/ssl_distribution.html).

**Tout ce que vous exécutez tourne pour de bon.** Une boucle infinie occupe un ordonnanceur de production. Un `Enum.map` sur une table entière la charge en mémoire. Un `System.halt()` arrête l'application. Il n'y a ni bac à sable ni confirmation.

**Lire avant d'écrire.** Les commandes qui observent — `:sys.get_state`, un `Repo.all` borné, `:erlang.memory` — sont sans danger. Celles qui modifient méritent d'être relues à froid, et de préférence par quelqu'un d'autre.

**Le notebook garde ce que vous avez tapé.** C'est sa qualité, et c'est aussi un risque : un fichier contenant des données de production ne se laisse pas traîner. Nettoyez les sorties avant de le partager.

## Ce que ça change

Le vrai gain n'est pas technique — `iex` distant faisait déjà l'essentiel. Il est dans la **trace**.

Une session de débogage devient un document : les commandes, leurs résultats, et vos commentaires entre les deux. Il se relit le lendemain, se transmet à un collègue, se range à côté du code. La prochaine fois que le même symptôme apparaît, vous rouvrez le fichier au lieu de tout refaire.

C'est le même déplacement que dans l'article précédent — du script jetable vers quelque chose qui se garde — appliqué cette fois à ce qui tourne pour de vrai.

---

*Cet article n'est pas livré en notebook exécutable, contrairement au précédent : il n'aurait de sens que branché à votre propre application. Les commandes ci-dessus se recopient dans un notebook vierge une fois la connexion établie.*
