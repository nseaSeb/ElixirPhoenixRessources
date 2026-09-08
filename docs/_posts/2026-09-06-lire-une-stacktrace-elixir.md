---
layout: post
title: "Lire une stacktrace Elixir sans paniquer"
date: 2026-09-06 09:40:00 +0200
lang: fr
description: "Une erreur Elixir suit toujours la même structure : le type dit pourquoi, la trace dit où. Anatomie, les sept erreurs qui couvrent presque tout, et le cas tordu du GenServer qui meurt."
tags: [debogage, elixir, erreurs]
categories: [elixir]
---

Un mur de texte rouge dans le terminal, c'est intimidant les premières fois. Puis on réalise qu'une erreur Elixir a toujours exactement la même forme, et que le type d'erreur oriente à lui seul l'essentiel du diagnostic.

<!--more-->

## Anatomie

{% raw %}
```
** (KeyError) key :nom not found in: %{age: 30}
    (mon_app 0.1.0) lib/mon_app/utilisateur.ex:12: MonApp.Utilisateur.saluer/1
    (elixir 1.16.0) lib/enum.ex:1058: Enum."-map/2-lists^map/1-0-"/2
    iex:3: (file)
```
{% endraw %}

Deux parties, toujours.

**La première ligne** dit *quoi* et *pourquoi* : `** (TypeErreur) message`. Ici, on a cherché la clé `:nom` dans une map qui ne la contient pas — et Elixir affiche la map fautive, ce qui règle souvent la question immédiatement.

**Les lignes suivantes** disent *où*. Chacune se lit de la même façon :

{% raw %}
```
(application version) chemin/fichier.ex:ligne: Module.fonction/arité
```
{% endraw %}

Le `/1` n'est pas un numéro de version : c'est l'**arité**, le nombre d'arguments. `saluer/1` et `saluer/2` sont deux fonctions différentes pour Elixir, et cette distinction compte quand on cherche pourquoi une clause ne correspond pas.

Deux réflexes de lecture :

- **Le haut de la trace, c'est le lieu exact du crash.** On descend ensuite dans la chaîne des appelants.
- **Le premier fichier qui vous appartient est le bon point de départ.** Une trace qui commence par `(elixir 1.16.0) lib/enum.ex` ne veut pas dire qu'`Enum` est cassé : elle veut dire que votre fonction a explosé pendant qu'`Enum` l'appelait. Sautez les lignes des dépendances jusqu'à retomber sur `(mon_app ...)`.

## Les sept erreurs qui couvrent presque tout

| Erreur | Signification | Réflexe |
|---|---|---|
| `FunctionClauseError` | aucune clause ne correspond aux arguments | comparer les arguments reçus aux `def` et aux gardes |
| `MatchError` | un `=` a échoué | la valeur de droite n'a pas la forme attendue à gauche |
| `KeyError` | clé absente d'une map ou d'une keyword list | faute de frappe, ou donnée incomplète en amont |
| `UndefinedFunctionError` | fonction ou module inexistant | nom mal orthographié, dépendance absente, `alias` oublié |
| `ArgumentError` | argument du bon type mais invalide | lire le message, il est presque toujours explicite |
| `Protocol.UndefinedError` | un protocole n'est pas implémenté pour cette valeur | neuf fois sur dix, un `nil` là où on attendait une liste ou une chaîne |
| `ArithmeticError` | opération numérique invalide | souvent un `nil` ou une chaîne dans un calcul |

Les deux dernières lignes disent la même chose sous deux formes : **un `nil` inattendu est la première cause de crash en Elixir.** Un `Repo.get` qui ne trouve rien, une clé de map absente, une variable d'environnement non définie. Quand vous voyez `Protocol.UndefinedError: protocol Enumerable not implemented for nil`, ne cherchez pas un problème de protocole — cherchez d'où vient ce `nil`.

## Elixir vous dit plus que vous ne croyez

Depuis quelques versions, les messages sont devenus remarquablement bavards. Un `FunctionClauseError` ne se contente plus de dire non :

{% raw %}
```
** (FunctionClauseError) no function clause matching in MonApp.aire/1

    The following arguments were given to MonApp.aire/1:

        # 1
        -3

    Attempted function clauses (showing 1 out of 1):

        def aire(rayon) when rayon > 0

    (mon_app 0.1.0) lib/mon_app.ex:5: MonApp.aire/1
```
{% endraw %}

Tout est là : l'argument reçu (`-3`), la clause tentée (`when rayon > 0`), et donc la raison. Le compilateur propose aussi des corrections (`did you mean?`) sur les fautes de frappe.

D'où le conseil le plus rentable de cet article : **lisez le message en entier**, pas seulement la première ligne. C'est contre-intuitif quand on est pressé, mais les lignes du milieu contiennent souvent la réponse.

## Le cas tordu : quand un processus meurt

Voilà celui qui déroute vraiment, parce que la vraie erreur est enterrée :

{% raw %}
```
** (exit) exited in: GenServer.call(MonApp.Cache, :recuperer, 5000)
    ** (EXIT) an exception was raised:
        ** (KeyError) key :donnees not found in: %{}
            (mon_app 0.1.0) lib/mon_app/cache.ex:34: MonApp.Cache.handle_call/3
            (stdlib 5.2) gen_server.erl:1113: :gen_server.try_handle_call/4
```
{% endraw %}

La première ligne — `** (exit)` — décrit seulement le **symptôme** : votre processus appelant est mort parce que celui qu'il interrogeait a disparu. Elle nomme l'appel, pas le bug.

La cause est en dessous, après `** (EXIT) an exception was raised`. C'est le `KeyError` dans `cache.ex:34` qu'il faut corriger. Le `GenServer.call` n'a rien fait de mal : il attendait une réponse d'un processus qui a explosé entre-temps.

La règle : **face à un `** (exit)`, descendez chercher l'exception imbriquée.** Le vrai fichier fautif est toujours plus bas.

Variante fréquente, `exited in: GenServer.call(...) ** (EXIT) no process` — là, aucune exception imbriquée : le processus n'existait pas du tout. Il n'a jamais démarré, ou il n'est pas dans votre arbre de supervision, ou son nom est mal orthographié.

## Voir les valeurs avant que ça casse

Une trace dit où ça a cassé, jamais avec quelles données. Pour ça, `dbg/1` se glisse dans un pipe :

{% raw %}
```elixir
[1, 2, 3]
|> Enum.map(&(&1 * 2))
|> dbg()
|> Enum.sum()
```
{% endraw %}

`dbg` affiche le pipe étape par étape, avec le fichier et la ligne, puis laisse passer la valeur — il ne change rien au comportement.

C'est un barreau d'une échelle qui monte jusqu'au point d'arrêt interactif : [`iex`, `IO.inspect`, `dbg`, `pry`]({{ "/articles/iex-dbg-debogage/" | relative_url }}) reprend chacun de ces outils, ce qu'il montre que le précédent ne montrait pas, et les pièges d'affichage qui font chercher un bug là où il n'y en a pas.

## En résumé

Le type d'erreur oriente le diagnostic ; le haut de la trace donne le lieu ; le premier fichier qui vous appartient donne le point d'entrée. Un `nil` inattendu explique une grande part des crashs, et devant un `** (exit)`, la vraie erreur est toujours plus bas dans le message.

Le [guide officiel de débogage](https://hexdocs.pm/elixir/debugging.html) couvre les outils plus lourds — `:observer`, le traçage.
