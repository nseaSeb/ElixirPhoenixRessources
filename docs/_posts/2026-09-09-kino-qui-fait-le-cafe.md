---
layout: post
title: "Qui fait le café ? Une interface Livebook en quatre étapes"
date: 2026-09-09 16:00:00 +0200
lang: fr
description: "Kino a une trentaine de composants et aucune porte d'entrée évidente. On va donc construire une seule chose idiote — un tirage au sort avec roulement de tambour — et découvrir au passage la seule règle qui compte. En annexe : la transformer en application que l'équipe ouvre dans un navigateur, sans voir une ligne de code."
tags: [elixir, livebook, kino, outillage]
categories: [livebook]
sources:
  - titre: "Kino — documentation"
    url: https://hexdocs.pm/kino/Kino.html
  - titre: "Kino.start_child/1"
    url: https://hexdocs.pm/kino/Kino.html#start_child/1
    note: "le cycle de vie qui explique tout"
  - titre: "Livebook — Deploying custom apps and internal tooling"
    url: https://github.com/livebook-dev/livebook/blob/main/docs/use_cases.md
---

La documentation de Kino liste une trentaine de composants. On les essaie un par un, ça affiche des jolies choses, et au bout d'une heure on ne sait toujours pas construire une interface — parce que le problème n'est pas le catalogue, c'est le modèle d'exécution.

Alors construisons une seule chose, franchement idiote : **un tirage au sort pour désigner qui fait le café.** Quatre étapes, chacune ajoutant exactement une notion. À la fin, ce sera une application que les collègues ouvrent dans leur navigateur.

<!--more-->

## Étape 0 — Le décor

Une seule dépendance :

{% raw %}
```elixir
Mix.install([{:kino, "~> 0.19.0"}])
```
{% endraw %}

## Étape 1 — Afficher quelque chose

Tout ce que Kino sait faire commence par un constructeur qui rend une structure, et Livebook affiche la dernière expression de la cellule. C'est tout le contrat.

{% raw %}
```elixir
Kino.Markdown.new("## ☕ Qui fait le café ?")
```
{% endraw %}

Rien de magique : `Kino.Markdown.new/1` construit une valeur, Livebook sait la rendre. `Kino.Text`, `Kino.Tree`, `Kino.Mermaid`, `Kino.DataTable` fonctionnent pareil. Le seul piège, à ce stade, c'est qu'une cellule n'affiche que **sa dernière expression** — pour en afficher plusieurs, il faut `Kino.render/1` sur les précédentes.

## Étape 2 — Un paramètre : le mode « tirer »

Il nous faut une liste de noms. Une entrée, donc :

{% raw %}
```elixir
noms = Kino.Input.textarea("Les noms, un par ligne", default: "Ada\nGrace\nAlan")
```
{% endraw %}

Et dans une **autre** cellule, on la lit :

{% raw %}
```elixir
noms
|> Kino.Input.read()
|> String.split("\n", trim: true)
|> Enum.random()
```
{% endraw %}

Ça marche. Modifiez la zone de texte, réexécutez la seconde cellule : un nouveau nom sort.

C'est le mode **tirer** : la valeur est lue au moment où la cellule s'exécute. Parfait pour un paramètre de notebook — un seuil, un identifiant, un chemin de fichier. Inutilisable pour une interface, parce qu'il faut réexécuter une cellule à la main à chaque fois. Un collègue à qui on passe ça va cliquer sur « Exécuter » comme on tire sur un levier.

Et si on essaie de contourner en lisant l'entrée depuis un processus qui tourne en fond, Kino refuse, avec un message qui donne lui-même la solution :

{% raw %}
```
** (RuntimeError) input value can only be read in the main evaluation process,
but Kino.Input.read/1 was called by another process. (...) In case you want to read
the latest input value from a long-running process, consider using Kino.Control.form/2,
or subscribing to the input change using one of the functions in the Kino.Control module
```
{% endraw %}

## Étape 3 — Réagir : le mode « pousser »

Passons donc à `Kino.Control`. Un bouton, un écouteur, une zone d'affichage :

{% raw %}
```elixir
tirage = Kino.Control.button("Tirer au sort")
resultat = Kino.Frame.new()

Kino.listen(tirage, fn _evenement ->
  gagnant =
    noms
    |> Kino.Input.read()
    |> String.split("\n", trim: true)
    |> Enum.random()

  Kino.Frame.render(resultat, Kino.Markdown.new("# ☕ #{gagnant}"))
end)

Kino.Layout.grid([tirage, resultat], boxed: true)
```
{% endraw %}

Cliquez : un nom apparaît, et **aucune cellule n'est réexécutée**. C'est le mode **pousser** : `Kino.listen/2` démarre un processus qui attend les événements, et `Kino.Frame` est la zone qu'il a le droit de redessiner. Notez que `Kino.listen/2` rend un pid — d'où la disposition placée en dernière expression, sinon la cellule afficherait le pid.

### La seule règle à retenir

Le code ci-dessus tient en **une seule cellule**, et ce n'est pas un hasard. C'est la règle qui décide si un notebook Kino fonctionne ou non :

> **Un contrôle, sa zone et son écouteur vivent dans la même cellule.**

La raison est dans la documentation de `Kino.start_child/1`, sur lequel reposent `Kino.Frame.new/0` et les contrôles :

> The process is automatically terminated when the current process terminates **or the current cell reevaluates**.

Une zone est un processus attaché à la cellule qui l'a créée. Si la zone vit dans une cellule et l'écouteur dans une autre, réexécuter celle de la zone tue son processus — pendant que l'écouteur, démarré par une autre cellule, survit et continue d'écrire dedans :

{% raw %}
```
** (exit) exited in: GenServer.call(#PID<0.711.0>, {:render, %Kino.Markdown{...}, :default}, :infinity)
    ** (EXIT) no process: the process is not alive or there's no process currently associated with the given name
```
{% endraw %}

La variante silencieuse est pire. Un contrôle appelle `Kino.Bridge.reference_object(ref, self())` : lui aussi appartient à sa cellule. Séparez le bouton de son écouteur, réexécutez la cellule du bouton, et le bouton affiché ne déclenche plus rien — **sans le moindre message**. On cherche l'erreur dans sa logique métier pendant vingt minutes ; elle est dans le découpage en cellules.

## Étape 4 — Le roulement de tambour

Un tirage au sort sans suspense n'en est pas un. `Kino.listen/3` accepte un état, comme un `GenServer` en trois lignes :

{% raw %}
```elixir
tirage = Kino.Control.button("Tirer au sort")
resultat = Kino.Frame.new()
historique = Kino.Frame.new()

Kino.listen(tirage, [], fn _evenement, passes ->
  candidats =
    noms
    |> Kino.Input.read()
    |> String.split("\n", trim: true)

  # le suspense : dix noms au hasard avant le vrai
  for _ <- 1..10 do
    Kino.Frame.render(resultat, Kino.Markdown.new("# 🎲 #{Enum.random(candidats)}"))
    Process.sleep(80)
  end

  gagnant = Enum.random(candidats)
  Kino.Frame.render(resultat, Kino.Markdown.new("# ☕ #{gagnant}"))

  # append ajoute à la suite, au lieu de remplacer
  heure = Time.utc_now() |> Time.truncate(:second) |> Time.to_string()
  Kino.Frame.append(historique, Kino.Text.new("#{heure} — #{gagnant}"))

  {:cont, [gagnant | passes]}
end)

Kino.Layout.grid([tirage, resultat, historique], boxed: true)
```
{% endraw %}

Trois choses en dix lignes de plus. `Kino.listen/3` transporte un état d'un clic à l'autre — ici la liste des tirages précédents — sans variable globale ni processus à écrire. `Kino.Frame.render/2` **remplace** le contenu, ce qui donne l'animation. `Kino.Frame.append/2` **ajoute**, ce qui donne l'historique. Et le `Process.sleep` dans l'écouteur ne gèle rien : il s'exécute dans le processus de `Kino.listen`, pas dans celui de la cellule.

## Annexe — En faire une application locale

C'est là que Livebook devient franchement intéressant : un notebook se déploie **comme une application**, sur la même instance Livebook, sans rien installer de plus.

Dans la barre latérale, l'icône en forme de fusée ouvre le panneau de déploiement. On y donne un **slug** — disons `cafe` — et on clique sur « Deploy ». Le notebook est alors servi à l'adresse `/apps/cafe` de votre Livebook, et l'utilisateur y voit **l'interface seule** : les entrées, les boutons, les zones. Pas les cellules, pas le code.

Quelques réglages valent d'être connus, parce que leurs valeurs par défaut surprennent :

| Réglage | Défaut | Ce que ça fait |
|---|---|---|
| `access_type` | `:protected` | l'app est protégée par un **mot de passe engendré aléatoirement**, à relever dans le panneau avant de partager le lien |
| `show_source` | `false` | le code source n'est pas visible depuis l'app |
| `output_type` | `:all` | `:rich` masque les sorties brutes et ne garde que les composants — c'est ce qu'on veut pour une vraie interface |
| `multi_session` | `false` | une seule session partagée par tout le monde ; à `true`, chaque visiteur a la sienne |
| `auto_shutdown_ms` | aucun | arrête la session après un délai d'inactivité |

Deux conséquences à comprendre avant de partager le lien.

En **session unique** (le défaut), tous les visiteurs regardent le même écran : le tirage lancé par l'un s'affiche chez tous les autres. C'est excellent pour un tableau de bord d'équipe, et déroutant pour un formulaire personnel. En **multi-session**, chacun a son propre notebook — et c'est là que le champ `origin` des événements, qui identifie le client, et le `to: origin` de `Kino.Frame.render/3` prennent leur sens.

Second point, moins amusant : **l'application tourne sur votre Livebook, donc sur votre machine.** Fermez le portable et l'app disparaît. Pour quelque chose de permanent, Livebook fournit un déploiement Docker, et Livebook Teams gère l'authentification et les secrets — mais pour « qui fait le café », le portable posé sur le bureau suffit très bien.

## À retenir

- Kino n'a pas trente notions, il en a **deux** : tirer (`Kino.Input.read/1`, à la réexécution de la cellule) et pousser (`Kino.Control` + `Kino.listen/2`, quand l'utilisateur agit). Tout le reste est du catalogue.
- **Un contrôle, sa zone et son écouteur tiennent dans une seule cellule.** Séparés, on récolte un `(EXIT) no process` ou, pire, un bouton devenu inerte en silence.
- `Kino.listen/3` porte un état d'un événement à l'autre : un `GenServer` sans en écrire un.
- `Kino.Frame` : `render` remplace, `append` ajoute, `clear` vide, et `to: origin` ne parle qu'à un seul client.
- Une cellule n'affiche que sa **dernière expression** ; `Kino.render/1` pour les autres. `Kino.listen` rendant un pid, la disposition se met en dernier.
- Un notebook se déploie en application locale avec un slug : `/apps/<slug>`, code masqué, **mot de passe engendré par défaut**, session partagée sauf réglage contraire.
- Le catalogue complet des contrôles, avec un exemple minimal par composant : [Kino : construire une interface dans Livebook](https://github.com/nseaSeb/ElixirPhoenixRessources/blob/main/Tips/kino_controles.livemd).
