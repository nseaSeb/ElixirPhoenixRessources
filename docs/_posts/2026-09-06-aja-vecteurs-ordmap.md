---
layout: post
title: "Aja : quand la liste chaînée n'est plus le bon outil"
date: 2026-09-06 10:46:00 +0200
lang: fr
description: "Les listes Elixir sont des listes chaînées : accéder au 5000e élément coûte 5000 sauts, et y ajouter à la fin recopie tout. Aja apporte des vecteurs et des maps ordonnées — voici quand ça vaut le détour, et quand ça n'en vaut pas."
tags: [aja, structures-de-donnees, performance]
categories: [elixir]
---

En Elixir, `[1, 2, 3]` n'est pas un tableau. C'est une **liste chaînée** : trois cellules, chacune contenant une valeur et un pointeur vers la suivante. Cette structure a des qualités immenses — elle est immuable à moindre coût, on partage sa queue gratuitement, le pattern matching `[tete | reste]` est instantané.

Elle a aussi deux angles morts, et on les découvre rarement en lisant du code.

<!--more-->

## Les deux opérations qui coûtent cher

**Accéder au n-ième élément.** `Enum.at(liste, 5000)` doit suivre cinq mille pointeurs. Il n'y a pas d'arithmétique d'adresse possible : rien ne garantit que les cellules sont contiguës en mémoire. C'est linéaire, sans échappatoire.

**Ajouter à la fin.** `liste ++ [x]` recopie *toute* la liste. Et c'est là que le piège se referme :

{% raw %}
```elixir
# Chaque ++ recopie tout ce qui précède : le coût total est quadratique.
Enum.reduce(1..10_000, [], fn i, acc -> acc ++ [i] end)
```
{% endraw %}

Dix mille éléments, cinquante millions d'opérations de copie. Le code a l'air innocent, il vient souvent d'une habitude prise dans un langage impératif, et il ne se manifeste que le jour où la collection grandit.

## Le réflexe idiomatique, qui suffit souvent

La réponse classique en Elixir est de construire à l'envers puis de retourner :

{% raw %}
```elixir
1..10_000
|> Enum.reduce([], fn i, acc -> [i | acc] end)
|> Enum.reverse()
```
{% endraw %}

Ajouter en tête est en temps constant, et le `Enum.reverse` final est linéaire — donc l'ensemble est linéaire. Le problème disparaît.

**Il faut insister là-dessus : dans la grande majorité des cas, c'est la bonne réponse et il n'y a rien d'autre à faire.** Une liste de cent éléments qu'on traverse du début à la fin ne demande aucune bibliothèque. Ne changez pas de structure de données pour un problème que vous n'avez pas.

Reste le cas que ce réflexe ne résout pas : **l'accès aléatoire.** Quand vous devez lire l'élément 4237, puis le 12, puis le 3891, aucune astuce de construction ne vous sauve. La liste chaînée est le mauvais outil, point.

Erlang fournit bien `:array`, mais son API est étrangère à Elixir — pas d'`Enum`, pas d'`Access`, pas de pattern matching. C'est là qu'Aja entre en scène.

## Aja.Vector

Un vecteur persistant : accès et ajout en fin en temps **effectivement constant**, écrit en Elixir pur.

{% raw %}
```elixir
vecteur = Aja.Vector.new(1..10)

Aja.Vector.append(vecteur, :foo)
vecteur[3]        # => 4, via le behaviour Access
Aja.Vector.size(vecteur)
```
{% endraw %}

« Effectivement constant » mérite une note : sous le capot, c'est un arbre large et plat. La profondeur croît de façon logarithmique, mais avec un facteur de branchement de 16 — un choix délibéré, Aja ayant mesuré que 16 battait le 32 de Clojure sur cette implémentation. Concrètement, `16^5` fait 1 048 576 : un vecteur d'un million d'éléments tient en cinq niveaux. Le coût de lecture ne bouge donc pas de façon perceptible avec la taille.

Ce qui rend la bibliothèque agréable, ce n'est pas la structure — c'est qu'elle s'intègre à la langue.

## Le pattern matching, le vrai argument

C'est ici qu'Aja se distingue de `:array`. En important le module, on récupère des macros qui rendent les vecteurs *elixiriens* :

{% raw %}
```elixir
import Aja

# construction
vec([1, 2, 3])

# extraction du premier et du dernier, sans traverser
vec(premier ||| dernier) = Aja.Vector.new(0..99_999)
{premier, dernier}   # => {0, 99999}

# pattern matching positionnel
vec([1, 2, var, _, _, _]) = Aja.Vector.new(1..6)
var                   # => 3
```
{% endraw %}

Et `vec_size/1` est utilisable **dans une garde**, ce qui permet de dispatcher sur la taille sans jamais compter :

{% raw %}
```elixir
def traiter(v) when vec_size(v) == 0, do: :vide
def traiter(v) when vec_size(v) < 100, do: :petit
def traiter(_v), do: :grand
```
{% endraw %}

L'équivalent sur une liste, `length(liste) < 100`, est bien pire qu'il n'en a l'air : `length/1` parcourt la liste **entière** avant de comparer. Sur dix mille éléments, c'est dix mille sauts pour répondre à une question qui portait sur les cent premiers. Un vecteur, lui, connaît sa taille.

Il existe aussi un opérateur de concaténation :

{% raw %}
```elixir
vec(5..1//-1) +++ vec([:boom, nil])
# => vec([5, 4, 3, 2, 1, :boom, nil])
```
{% endraw %}

## Aja.OrdMap : l'ordre d'insertion

Deuxième structure, pour un besoin très différent. En Elixir, **une map ne préserve jamais l'ordre d'insertion**, et contrairement à une idée répandue, ce n'est pas une question de taille. Deux clés suffisent :

{% raw %}
```elixir
Enum.into([{"zebre", 1}, {"alpha", 2}], %{}) |> Enum.to_list()
# => [{"alpha", 2}, {"zebre", 1}]   — l'ordre d'insertion a déjà disparu
```
{% endraw %}

Les petites maps itèrent dans l'ordre des termes, les grandes dans un ordre dérivé du hachage. Dans les deux cas, l'ordre est celui de la structure interne, jamais le vôtre. La keyword list, elle, préserve l'ordre — mais impose des clés atomes et autorise les doublons.

`Aja.OrdMap` prend le meilleur des deux : n'importe quel type de clé, ordre d'insertion respecté.

{% raw %}
```elixir
om = Aja.OrdMap.new([{"un", 1}, {"deux", 2}, {"trois", 3}])
om["deux"]   # => 2

Aja.Enum.to_list(om)
# => [{"un", 1}, {"deux", 2}, {"trois", 3}]  — dans cet ordre, toujours
```
{% endraw %}

Avec la macro `ord/1`, on retrouve une syntaxe de map, pattern matching compris :

{% raw %}
```elixir
import Aja

om = ord(%{a: "Ant", b: "Bat", c: "Cat"})
ord(%{b: chauve_souris}) = om
chauve_souris   # => "Bat"
```
{% endraw %}

Le cas d'usage typique : un ordre qui vient de l'utilisateur ou d'une requête SQL et qu'il faut restituer tel quel, avec des clés qui ne sont pas des atomes — des identifiants, des chaînes, des tuples.

## Aja.Enum

Passer une structure Aja à `Enum` fonctionne : les protocoles sont implémentés. Mais `Enum` doit alors traiter la structure via `Enumerable`, avec le coût d'indirection que ça implique. `Aja.Enum` fournit les mêmes fonctions, spécialisées :

{% raw %}
```elixir
Aja.Enum.map(vecteur, &(&1 * 2))
Aja.Enum.sum(vecteur)
```
{% endraw %}

Même API, implémentation directe. Sur les structures Aja, c'est plus rapide ; et ces fonctions acceptent aussi les listes et les ranges, donc on peut s'en servir uniformément.

## Ce que ça coûte

Une bibliothèque de structures de données se juge autant sur ses faiblesses. La documentation d'Aja est honnête sur les siennes, et elles sont nettes.

**Le vecteur est mauvais en ajout en tête.** Ajouter au début reconstruit toute la structure. C'est l'exact inverse de la liste. Si votre boucle empile en tête, restez sur une liste.

**Le vecteur ne supporte pas la suppression arbitraire.** Seul le dernier élément se retire efficacement. Supprimer près du début reconstruit presque tout. La doc le dit sans détour : si vous devez supprimer à des index quelconques, c'est probablement que vous avez besoin d'une autre structure.

**L'OrdMap paye ses écritures.** Maintenir l'ordre a un coût en création, en mise à jour et en mémoire, par rapport à une map ordinaire. Le marché est clair : on échange de la vitesse d'écriture contre de la lecture rapide et une énumération efficace.

## L'état du projet

Aja est en **0.7.4**, sortie en décembre 2024, sous licence MIT, environ 226 étoiles et 588 000 téléchargements cumulés. L'auteur, sabiwara, contribue par ailleurs au cœur d'Elixir — ce n'est pas un projet du dimanche.

Deux choses à savoir avant de l'ajouter à un projet sérieux. D'abord, la bibliothèque **n'a pas atteint la 1.0** et l'auteur annonce que des changements incompatibles restent possibles. Ensuite, le rythme de publication est lent : la dernière version date de fin 2024. Le dépôt reste vivant — les derniers commits, en octobre 2025, corrigent la compatibilité avec Elixir 1.19 — mais ces correctifs ne sont pas encore publiés sur Hex.

Traduction pratique : c'est maintenu, ce n'est pas abandonné, mais pour un correctif récent il faudra peut-être pointer sur le dépôt Git plutôt que sur Hex.

## Faut-il l'utiliser ?

Trois questions, dans l'ordre.

**Avez-vous mesuré ?** Sinon, arrêtez-vous là. La collection de trois cents éléments que vous traversez linéairement ne coûte rien, et une dépendance de plus coûte toujours quelque chose.

**Votre problème est-il l'accès aléatoire ou l'ajout en fin ?** Si vous appendez dans une boucle, essayez d'abord `[x | acc]` suivi de `Enum.reverse` : c'est gratuit et ça règle le cas la plupart du temps. Si c'est vraiment de l'accès par index sur une grande collection, la liste est le mauvais outil et Aja est une bonne réponse.

**Avez-vous besoin d'un ordre d'insertion avec des clés non-atomes ?** C'est le cas où `Aja.OrdMap` n'a pas vraiment de concurrent dans la bibliothèque standard.

Si les trois réponses vous mènent à Aja, c'est une bibliothèque soignée, bien documentée, et dont les macros la rendent nettement plus agréable que `:array`. Sinon, la liste chaînée reste un excellent choix par défaut — c'est précisément pour ça qu'elle est le choix par défaut.

La [documentation d'Aja](https://aja.hexdocs.pm/readme.html) contient les benchmarks détaillés, et le [dépôt](https://github.com/sabiwara/aja) permet de les rejouer sur votre machine.

---

**Suite de cet article.** Publié sur le forum Elixir, il a valu deux réponses qui déplacent la question : `:queue` pour les files d'attente et les zippers pour la navigation. Toutes deux sont construites *avec* des listes chaînées plutôt que contre elles — c'est le sujet de [« La liste chaînée n'est pas le mauvais outil, c'est la matière première »]({{ "/articles/files-et-zippers/" | relative_url }}).
