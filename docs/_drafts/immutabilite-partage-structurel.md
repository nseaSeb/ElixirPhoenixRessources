---
layout: post
title: "L'immutabilité ne coûte pas ce que vous croyez"
lang: fr
description: "Si toute modification crée une nouvelle valeur, comment un langage immuable peut-il être rapide ? Réponse mesurée : parce que rien n'est copié. Le partage structurel, ses limites, et là où l'immutabilité coûte vraiment."
tags: [elixir, immutabilite, performance, beam]
categories: [elixir]
sources:
  - titre: "Erlang Efficiency Guide — List handling"
    url: https://www.erlang.org/doc/system/listhandling.html
  - titre: "Erlang Efficiency Guide — Processes"
    url: https://www.erlang.org/doc/system/eff_guide_processes.html
    note: "sur la copie des messages entre processus"
  - titre: "Erlang Efficiency Guide — Constructing and matching binaries"
    url: https://www.erlang.org/doc/system/binaryhandling.html
  - titre: "Lists and tuples"
    url: https://hexdocs.pm/elixir/lists-and-tuples.html
---

C'est l'objection réflexe de quiconque arrive d'un langage impératif. On explique qu'en Elixir les données sont immuables, qu'ajouter un élément à une liste de dix mille entrées produit une **nouvelle** liste — et l'interlocuteur fronce les sourcils. *Si vous recopiez dix mille éléments à chaque modification, comment ça peut être utilisable ?*

La question est excellente. La réponse est qu'on ne recopie rien.

<!--more-->

## Ce que « nouvelle liste » veut vraiment dire

Prenons une liste de dix mille éléments et ajoutons-lui une tête. La machine virtuelle sait mesurer ce que ça coûte : `:erts_debug.flat_size/1` compte une valeur comme si rien n'était partagé, `:erts_debug.size/1` en tenant compte du partage. Mesurons les deux listes **ensemble** :

{% raw %}
```elixir
grande = Enum.to_list(1..10_000)
avec_tete = [0 | grande]
paire = {grande, avec_tete}

:erts_debug.flat_size(paire)   #=> 40_005 mots
:erts_debug.size(paire)        #=> 20_005 mots
```
{% endraw %}

Deux listes de dix mille éléments occupent l'espace d'une seule. L'écart de cinq mots mérite d'être décomposé, parce qu'il est instructif : trois viennent du tuple que j'ai construit pour la mesure, et **deux seulement sont la cellule nouvelle**. Ajouter une tête à une liste de dix mille éléments coûte deux mots — une valeur et un pointeur.

La seconde liste n'a pas recopié la première : elle **pointe dessus**.

C'est le partage structurel. Une liste chaînée est une suite de cellules, chacune contenant une valeur et un pointeur vers la suivante. `[0 | grande]` fabrique une unique cellule nouvelle, dont le pointeur vise la première cellule de `grande`. Rien d'autre n'est touché.

**Et c'est l'immutabilité qui rend ce partage possible.** Dans un langage où `grande` pourrait changer, partager sa structure serait dangereux : modifier l'une modifierait l'autre. Puisque rien ne peut changer, tout peut être partagé sans risque. L'immutabilité n'est pas le prix à payer pour la sûreté — c'est ce qui autorise l'optimisation.

## Ce que ça donne à l'échelle

Cent mille ajouts en tête, en conservant chaque résultat pour empêcher le ramasse-miettes de tricher :

{% raw %}
```elixir
{temps, listes} = :timer.tc(fn ->
  Enum.map(1..100_000, fn i -> [i | grande] end)
end)
```
{% endraw %}

```
temps                              : 8 ms
taille réelle des 100 000 listes   :           420 000 mots
si chacune était une copie complète : 2 000 400 000 mots
```

Un facteur **4 762**. Sur une machine 64 bits où un mot fait 8 octets, c'est 3,4 Mo au lieu de 16 Go. Voilà pourquoi `[element | accumulateur]` est le geste idiomatique en Elixir : il est réellement gratuit.

## Le revers : `++` en boucle

L'ajout en **fin** ne peut rien partager. Pour que la dernière cellule pointe vers un nouvel élément, il faut la reconstruire — donc reconstruire toutes celles qui y mènent. Et comme l'accumulateur grandit à chaque tour, le coût de chaque tour grandit avec lui.

C'est ce qui rend l'effet visible dès qu'on change d'échelle :

{% raw %}
```elixir
Enum.reduce(1..1_000, [], fn i, acc -> acc ++ [i] end)   # 1 ms
Enum.reduce(1..10_000, [], fn i, acc -> acc ++ [i] end)  # 273 ms
```
{% endraw %}

**Dix fois plus d'éléments, deux cent soixante-treize fois plus de temps.** C'est la signature d'un algorithme quadratique, et c'est le piège classique de l'accumulateur construit avec `++`.

Le remède tient en deux gestes : empiler en tête, puis `Enum.reverse/1` une seule fois à la fin. L'inversion est linéaire, l'ensemble reste linéaire.

## Le partage n'est pas magique

Modifier un élément **au milieu** oblige à reconstruire tout ce qui précède — la partie qui suit, elle, reste partagée. Le coût est donc proportionnel à la distance depuis la tête, et ça se mesure :

| Position modifiée | 10 000 appels | Les deux listes ensemble |
|---|---|---|
| 10 | ~0 ms | 20 025 mots |
| 5 000 | 462 ms | 30 005 mots |
| 9 999 | 881 ms | 40 003 mots |

À la position 9 999, on est à 40 003 mots : plus rien n'est partagé, la liste entière a été reconstruite. La progression est parfaitement régulière — le partage porte sur la queue, jamais sur la tête.

## Le partage ne rend pas le parcours rapide

Voilà la distinction qu'il ne faut pas manquer, parce qu'elle sépare deux questions qu'on confond volontiers.

Le partage porte sur la **mémoire**. Il n'a aucun effet sur le **temps d'accès**. `Enum.at(liste, 9_999)` doit suivre neuf mille neuf cent quatre-vingt-dix-neuf pointeurs, que la liste soit partagée avec dix autres ou avec aucune. Aucune structure partagée ne raccourcit une chaîne.

On pourrait croire qu'un vecteur — comme ceux d'[Aja](https://hexdocs.pm/aja), dont [j'ai parlé ici]({{ "/articles/aja-vecteurs-ordmap/" | relative_url }}) — s'en sort mieux parce qu'il partagerait davantage. Ce n'est pas ça du tout. Mesuré, il partage exactement de la même façon :

{% raw %}
```elixir
vec = Aja.Vector.new(1..10_000)
vec2 = Aja.Vector.append(vec, :nouveau)

:erts_debug.flat_size({vec, vec2})  #=> 22_779 mots
:erts_debug.size({vec, vec2})       #=> 11_454 mots
```
{% endraw %}

Même mécanisme, même économie de moitié. Ce qui sépare les deux structures n'est donc pas le partage : c'est leur **forme**. Une liste est une chaîne qu'il faut parcourir ; un vecteur est un arbre large et plat qu'on indexe. Et ça se voit :

```
100 000 accès à l'index 9 999
  liste   : 1 619 ms
  vecteur :     6 ms
```

Un facteur **256**, sur des structures qui partagent aussi bien l'une que l'autre.

D'où la conclusion, qui n'a rien de contradictoire avec tout ce qui précède : l'immutabilité ne vous coûte presque rien, mais **elle ne vous dispense pas de choisir la bonne structure de données**. Le partage rend une modification bon marché ; il ne rend pas une chaîne indexable.

## « Mais la BEAM sait optimiser, non ? »

On lit parfois que le parcours n'est pas toujours linéaire, et c'est vrai — à condition de voir d'où vient l'optimisation. Elle ne vient jamais d'une ruse sur les listes chaînées : elle vient de ce que **la chose parcourue n'est pas une liste**.

Comparons la même fonction `Enum` appliquée à une liste et à un intervalle, sur cent mille itérations :

```
Enum.at(liste, 9_999)                 1 619 ms
Enum.at(1..10_000, 9_999)                10 ms      160x

Enum.slice(liste, 9_990..9_999)       2 159 ms
Enum.slice(1..10_000, 9_990..9_999)       9 ms      235x

Enum.count(liste)                     1 050 ms
Enum.count(1..10_000)                     3 ms      269x
```

Deux ordres de grandeur d'écart, sur les trois paires. Pourtant c'est le même appel, et `1..10_000` a bien dix mille éléments.

L'explication tient au protocole `Enumerable`. Les deux structures implémentent la fonction `slice/1` — une implémentation de protocole doit définir tous ses callbacks — mais elles n'y répondent pas la même chose :

{% raw %}
```elixir
Enumerable.Range.slice(1..10_000)  #=> {:ok, 10000, #Function<...>}
Enumerable.List.slice([1, 2, 3])   #=> {:error, Enumerable.List}
```
{% endraw %}

L'intervalle répond « oui, je sais me découper, voici comment » ; la liste répond « non, débrouille-toi en me parcourant ». C'est cette réponse, et non l'existence de la fonction, qui décide du coût.

Un intervalle n'est pas une collection en mémoire : c'est un début, une fin et un pas. `Enum.at(1..10_000, 9_999)` **calcule** le résultat, il ne va pas le chercher. La liste, elle, n'a pas ce luxe — il faut suivre la chaîne.

Deux autres points valent d'être posés clairement :

**Le JIT ne change pas la complexité.** Depuis OTP 24, la BEAM compile à la volée vers du code machine, et tout va plus vite — mais un parcours linéaire reste linéaire. Le JIT améliore le facteur constant, pas l'exposant.

**Certaines opérations sur les listes sont bel et bien en temps constant** — `hd/1` par exemple, mesuré à 0 ms sur cent mille appels. Mais ce sont celles qui touchent à la **tête**. Dès qu'on vise la fin, on repaie le parcours : `List.last/1` coûte 1 927 ms sur les mêmes cent mille itérations.

La règle qui résume tout : sur une liste chaînée, ce qui est près de la tête est gratuit, ce qui est loin se paie — et aucune optimisation de la machine virtuelle ne rend une chaîne indexable.

## Quand rien ne peut être partagé

`Enum.map/2` produit une liste dont **chaque** élément diffère. Il n'y a rien à partager, et la mesure le confirme :

{% raw %}
```elixir
doubles = Enum.map(grande, &(&1 * 2))
:erts_debug.size({grande, doubles})       #=> 40_003 mots
:erts_debug.flat_size({grande, doubles})  #=> 40_003 mots
```
{% endraw %}

Les deux chiffres sont identiques : aucun partage. C'est normal et ce n'est pas un défaut — simplement, le partage récompense les transformations qui laissent la majorité des données intactes, pas celles qui touchent à tout.

Les maps, elles, sont des arbres : ajouter une clé à une map de dix mille entrées ne recopie que le chemin menant à la feuille. Encore faut-il le mesurer correctement — comparer deux `flat_size` séparés ne prouverait rien, puisqu'une copie intégrale donnerait exactement le même chiffre. Il faut mesurer les deux maps **ensemble** :

{% raw %}
```elixir
m = Map.new(1..10_000, &{&1, &1})
m2 = Map.put(m, :nouveau, 1)

:erts_debug.flat_size({m, m2})  #=> 75_638 mots
:erts_debug.size({m, m2})       #=> 37_875 mots
```
{% endraw %}

En retranchant la map d'origine et le tuple de mesure, le `Map.put` coûte **58 mots** — soit 0,15 % de la map. Pas dix mille.

## Là où l'immutabilité coûte vraiment

Il y a un endroit où la copie a bien lieu, et il vaut mieux le connaître : **entre processus**.

Chaque processus de la BEAM possède son propre tas. Un message envoyé d'un processus à un autre est donc **copié**, précisément parce qu'il ne peut rien partager avec l'extérieur.

```
envoi d'une liste de 10 000 éléments à un autre processus : 76 µs
```

C'est peu, mais ce n'est plus zéro — et ça devient significatif si vous faites transiter de grosses structures entre processus dans une boucle chaude. C'est le vrai coût de l'isolation, et c'est ce qui rend possible le ramasse-miettes par processus, sans pause globale.

Une exception notable : les binaires de plus de 64 octets vivent **hors** du tas et sont comptés par référence. Ils ne sont donc pas recopiés à l'envoi.

{% raw %}
```elixir
:erts_debug.flat_size(:crypto.strong_rand_bytes(60))        #=> 10 mots
:erts_debug.flat_size(:crypto.strong_rand_bytes(1_000_000)) #=> 8 mots
```
{% endraw %}

Un mégaoctet occupe **moins** de place sur le tas que soixante octets. Le petit binaire y est stocké en entier ; le grand n'y laisse qu'une référence. C'est pour ça qu'on peut passer de gros contenus entre processus sans y penser — et pourquoi découper une grosse binaire en petits morceaux peut, paradoxalement, consommer davantage.

## Ce qu'il faut en retenir

**Empilez en tête, inversez à la fin.** C'est gratuit dans un sens, quadratique dans l'autre.

**Ne craignez pas de « copier » une structure pour la modifier.** `Map.put`, `%{struct | champ: valeur}`, `List.replace_at` près de la tête : rien de tout cela ne duplique vos données.

**Méfiez-vous de la distance à la tête**, pas de la modification elle-même. Si vous accédez par index sur une grande collection, le problème n'est pas l'immutabilité — c'est la liste chaînée.

**Surveillez ce qui traverse les frontières de processus.** C'est le seul endroit où le runtime copie **même quand rien n'a changé** — ailleurs, comme avec `Enum.map/2`, on paie une copie parce qu'on a effectivement produit des données nouvelles. C'est aussi le cas d'ETS, qui copie à l'écriture comme à la lecture.

L'immutabilité en Elixir n'est pas un compromis qu'on accepte en échange de la sûreté. C'est ce qui permet à la machine virtuelle de ne presque jamais copier — et de vous laisser raisonner sur vos données en sachant que personne ne les changera sous vos pieds.

---

**Refaites ces mesures vous-même.** Toutes celles de cet article vivent dans un notebook exécutable : [ouvrez-le dans votre Livebook](https://livebook.dev/run/?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/partage_structurel.livemd) et relancez-les. C'est la seule réponse honnête au fait que ces nombres dépendent de la machine.

*Les mesures publiées ici ont été prises sur Elixir 1.19.5 avec Erlang/OTP 28, sur une machine 64 bits où un mot fait 8 octets. Les nombres varient d'une machine à l'autre ; les ordres de grandeur, non.*
