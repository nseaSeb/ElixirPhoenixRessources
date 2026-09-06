---
layout: post
title: "Un outil interne en trente lignes, dans un notebook"
lang: fr
description: "Le petit script qu'on écrit dans iex, qu'on lit une fois et qu'on reperd. Livebook en fait un outil qui se garde, se partage et s'utilise sans lire le code — voici comment, et ce que ça ne remplace pas."
tags: [livebook, kino, outillage]
categories: [livebook]
sources:
  - titre: "Documentation de Kino"
    url: https://hexdocs.pm/kino
    note: "l'API des formulaires, des cadres et des tableaux"
  - titre: "Documentation de Livebook"
    url: https://hexdocs.pm/livebook
    auteur: "Livebook"
  - titre: "API publique de Hex"
    url: https://github.com/hexpm/hexpm/blob/main/lib/hexpm_web/controllers/api/package_controller.ex
    note: "le point d'entrée interrogé par l'exemple"
---

Vous ouvrez `iex`, vous tapez dix lignes pour interroger une API ou compter des lignes en base, vous lisez la réponse dans un `IO.inspect`, vous fermez le terminal. Le lendemain, il faut tout retaper. Et le collègue à qui vous voudriez passer ce petit outil n'a rien à quoi se raccrocher.

Un notebook Livebook change exactement ça : le même script devient quelque chose qui se garde, s'envoie, et s'utilise **sans lire une ligne de code**.

<!--more-->

## Ce que `Mix.install` change vraiment

Un notebook commence par ses dépendances :

{% raw %}
```elixir
Mix.install([
  {:kino, "~> 0.19"},
  {:req, "~> 0.5"}
])
```
{% endraw %}

Ce n'est pas un détail de confort. C'est ce qui rend le fichier **autonome** : pas de `mix.exs`, pas de projet, pas de « il faut d'abord cloner le dépôt ». Vous envoyez un fichier, la personne l'ouvre, ça tourne.

Une nuance sur laquelle il vaut mieux ne pas se tromper : `~> 0.5` **ne fige pas** la version 0.5. La contrainte signifie « au moins 0.5.0 et moins de 1.0.0 », donc une installation faite aujourd'hui ramènera la dernière 0.x publiée — 0.7.4 pour `req` au moment où j'écris. Si la reproductibilité compte vraiment, écrivez la version exacte : `{:req, "== 0.7.4"}`. Le notebook est autonome, pas figé dans le temps.

Un notebook `.livemd` est par ailleurs du Markdown ordinaire. Il se lit sur GitHub, se versionne, se relit dans une revue de code. C'est une différence de fond avec les notebooks au format JSON, dont le diff est illisible.

## Étape 1 — Rendre la sortie lisible

Interrogeons l'API publique de Hex, qui a le bon goût de ne demander aucune authentification.

{% raw %}
```elixir
paquets = Req.get!("https://hex.pm/api/packages", params: [search: "liveview"]).body
length(paquets)
#=> 100
```
{% endraw %}

Cent paquets. Un `IO.inspect` produirait un mur illisible. `Kino.DataTable` en fait un tableau trié et triable :

{% raw %}
```elixir
paquets
|> Enum.map(fn p ->
  %{
    nom: p["name"],
    version: p["latest_version"],
    telechargements: get_in(p, ["downloads", "all"]) || 0,
    description: p["meta"]["description"]
  }
end)
|> Enum.sort_by(& &1.telechargements, :desc)
|> Enum.take(20)
|> Kino.DataTable.new(name: "Paquets Hex")
```
{% endraw %}

`Kino.DataTable.new/2` accepte n'importe quelle donnée tabulaire — une liste de maps convient. L'option `:keys` fixe les colonnes et leur ordre si l'ordre par défaut ne vous va pas.

Déjà à ce stade, ce n'est plus le même objet : quelqu'un peut trier par téléchargements sans savoir ce qu'est une map.

## Étape 2 — Rendre l'outil interactif

Un tableau figé sur `"liveview"` reste un script. Ce qui en fait un outil, c'est le formulaire.

D'abord, isolons la recherche dans un module — le notebook exécutera cette cellule une fois pour toutes :

{% raw %}
```elixir
defmodule OutilHex do
  def chercher(terme) do
    "https://hex.pm/api/packages"
    |> Req.get!(params: [search: terme])
    |> Map.fetch!(:body)
    |> Enum.map(fn p ->
      %{
        nom: p["name"],
        version: p["latest_version"],
        telechargements: get_in(p, ["downloads", "all"]) || 0,
        description: p["meta"]["description"]
      }
    end)
    |> Enum.sort_by(& &1.telechargements, :desc)
    |> Enum.take(20)
  end
end
```
{% endraw %}

Trois pièces suffisent ensuite. `Kino.Control.form/2` construit le formulaire ; `Kino.Frame` réserve une zone d'affichage ; `Kino.listen/2` réagit aux soumissions.

{% raw %}
```elixir
formulaire = Kino.Control.form([terme: Kino.Input.text("Rechercher")], submit: "Chercher")
zone = Kino.Frame.new()

Kino.listen(formulaire, fn %{data: %{terme: terme}} ->
  case OutilHex.chercher(terme) do
    [] -> Kino.Frame.render(zone, Kino.Markdown.new("Aucun paquet pour **#{terme}**."))
    lignes -> Kino.Frame.render(zone, Kino.DataTable.new(lignes, name: "Résultats"))
  end
end)

Kino.Layout.grid([formulaire, zone], boxed: true)
```
{% endraw %}

Deux choses méritent d'être soulignées.

**Une option d'émission est obligatoire.** La documentation est explicite : « Either `:submit` or `:report_changes` must be specified ». Avec `:submit`, le formulaire n'émet qu'à la validation, et l'option donne son libellé au bouton. Avec `:report_changes`, il émet à chaque frappe, sous la forme `%{type: :change}` — pratique pour un filtre qui se met à jour en direct, coûteux si chaque événement déclenche un appel réseau comme ici.

**L'événement reçu est une map** de la forme `%{data: %{…}, origin: …, type: :submit}`. Le `origin` identifie le client : si deux personnes ouvrent le même notebook, vous savez laquelle a soumis. Le pattern matching sur `%{data: %{terme: terme}}` suffit tant qu'on n'en a pas besoin.

Et surtout : **aucune cellule n'est réexécutée**. `Kino.listen` démarre un processus qui redessine la zone. C'est du BEAM ordinaire, et c'est pour ça que ça semble instantané.

## Ce que ça ne remplace pas

Il faut être clair sur les limites, sinon la déception arrive au mauvais moment.

**Ce n'est pas une application.** L'état vit dans un processus attaché au notebook. Vous le fermez, tout disparaît. Il n'y a ni persistance ni redémarrage automatique.

**Ce n'est pas un tableau de bord partagé.** Chaque personne qui ouvre le notebook exécute le sien, avec ses propres processus. Livebook sait déployer un notebook comme une application multi-utilisateur, mais c'est un autre mécanisme — et un autre article.

**Ce n'est pas un endroit pour des secrets en clair.** Un notebook se partage justement trop facilement. Livebook a des secrets prévus pour ça ; une clé d'API collée dans une cellule finira dans un dépôt.

Ce que c'est, en revanche : un outil personnel qu'on envoie par courriel, qu'on range à côté du code qu'il interroge, et qu'on relance dans six mois sans se demander quelles versions étaient installées.

## Le seuil intéressant

Tout ce qui précède interroge une API publique, ce qui est commode pour un exemple mais reste anecdotique.

Le vrai basculement, c'est quand le même formulaire ne parle plus à une API distante mais à **une application Elixir en cours d'exécution** — inspecter l'état d'un `GenServer`, lancer une requête Ecto sur la base de production, lire des métriques en direct. Livebook sait s'attacher à un nœud existant, et c'est là qu'il cesse d'être un outil de démonstration.

C'est le sujet du prochain article.

---

**Ce notebook est exécutable.** Il vit dans le dépôt à côté de cet article : [ouvrez-le dans votre Livebook](https://livebook.dev/run/?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/outil_interne_livebook.livemd) et modifiez-le. Tout le code ci-dessus y a été exécuté avant publication.
