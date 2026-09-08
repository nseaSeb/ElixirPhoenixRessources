---
layout: post
title: "La liste chaînée n'est pas le mauvais outil, c'est la matière première"
date: 2026-09-08 10:38:00 +0200
lang: fr
description: "Une file d'attente construite avec deux listes bat la liste native d'un facteur 2 600. Un zipper, d'un facteur 10 000. Aucune de ces structures ne remplace la liste : elles la réarrangent."
tags: [elixir, structures-de-donnees, performance, erlang]
categories: [elixir]
sources:
  - titre: "Fil de discussion sur l'Elixir Forum"
    url: https://elixirforum.com/t/whats-the-approach-for-handling-lists-that-allows-for-optimized-traversal/76584
    note: "d'où viennent les deux pistes de cet article"
  - titre: "queue — Erlang stdlib"
    url: https://www.erlang.org/doc/apps/stdlib/queue.html
    note: "les trois API, et les complexités amorties"
  - titre: "Yet Another Article on Zippers, in Erlang"
    url: https://ferd.ca/yet-another-article-on-zippers.html
    auteur: "Fred Hebert"
  - titre: "Sourceror.Zipper"
    url: https://hexdocs.pm/sourceror/Sourceror.Zipper.html
    note: "l'implémentation Elixir de référence, sur l'AST"
---

[Un précédent article]({{ "/articles/aja-vecteurs-ordmap/" | relative_url }}) posait le problème : une liste chaînée est lente en accès par index, et un vecteur y répond mieux. En le partageant sur l'[Elixir Forum](https://elixirforum.com/t/whats-the-approach-for-handling-lists-that-allows-for-optimized-traversal/76584), j'ai reçu deux réponses qui déplacent la question — `:queue` et les zippers — et elles racontent quelque chose de plus intéressant qu'une liste d'alternatives.

Ces deux structures ne remplacent pas la liste chaînée. **Elles sont faites avec.**

<!--more-->

## Le problème : une file d'attente

Vous voulez une file d'attente : on ajoute d'un côté, on retire de l'autre. Avec une liste, un des deux gestes est forcément coûteux.

Retirer en tête est gratuit. Ajouter en queue recopie toute la liste :

{% raw %}
```elixir
def enfiler(file, x), do: file ++ [x]     # O(n)
def defiler([h | t]), do: {h, t}          # O(1)
```
{% endraw %}

Sur cinquante mille allers-retours, ça se voit :

```
50 000 enfilements puis 50 000 défilements
  liste native (++)   5 194 ms
```

## L'astuce : deux listes au lieu d'une

La solution est ancienne et tient en une idée. Gardez **deux** listes : celle de l'avant dans le bon sens, celle de l'arrière **à l'envers**. Enfiler, c'est empiler en tête de l'arrière. Défiler, c'est prendre la tête de l'avant. Et quand l'avant est vide, on retourne l'arrière d'un coup.

{% raw %}
```elixir
# Surtout pas `defmodule File` : ça remplacerait le module de la
# bibliothèque standard, et File.read/1 cesserait d'exister pour le reste
# de la session — avec un simple avertissement qu'on survole.
defmodule FileAttente do
  def new, do: {[], []}

  # Empiler en tête : gratuit.
  def enfiler({avant, arriere}, x), do: {avant, [x | arriere]}

  def defiler({[], []}), do: :vide
  # L'avant est vide : on retourne l'arrière, une fois.
  def defiler({[], arriere}), do: defiler({Enum.reverse(arriere), []})
  def defiler({[h | t], arriere}), do: {h, {t, arriere}}
end
```
{% endraw %}

Le `Enum.reverse` est en O(n), mais il n'arrive qu'une fois par élément inséré : chaque élément est retourné exactement une fois dans sa vie. Réparti sur toutes les opérations, le coût par opération est constant — c'est ce qu'on appelle une complexité **amortie**.

Le résultat :

```
  liste native (++)      5 194 ms
  deux listes (maison)       2 ms
```

Dix lignes, et un facteur **2 600**.

## `:queue`, la même chose en mieux testé

Inutile d'écrire ce module : Erlang le fournit depuis toujours, et il fait exactement ça.

{% raw %}
```elixir
file = :queue.new()
file = :queue.in(:a, file)
file = :queue.in(:b, file)

{{:value, premier}, file} = :queue.out(file)
premier   #=> :a
```
{% endraw %}

```
  deux listes (maison)   2 ms
  :queue (OTP)           3 ms
```

Ma version maison n'est pas plus rapide — elle est juste moins éprouvée. `:queue` gère aussi les deux bouts : `in_r/2` et `out_r/1` insèrent et retirent à l'envers, ce qui en fait une file **doublement terminée**.

### Un piège à connaître

`:queue.len/1` est en **O(n)**. La documentation l'annonce, et c'est contre-intuitif pour une structure aussi soignée :

```
100 appels à :queue.len sur une file de 100 000 : 15 ms
100 appels à :queue.is_empty                    :  0 ms
```

La raison est un choix délibéré : ne pas maintenir de compteur évite de reconstruire la structure à chaque insertion. Conséquence pratique — **`:queue.len(q) == 0` est une faute**, il faut `:queue.is_empty(q)`.

Le module propose par ailleurs trois API, dont une dite « Okasaki » aux noms inversés (`cons`, `snoc`, `head`, `tail`) que la documentation elle-même qualifie de « by many regarded as strange and avoidable ». Restez sur `in`, `out`, `peek`.

## Le zipper : se déplacer dans une structure immuable

Second retour du forum, et il répond à un besoin différent : parcourir une structure **en la modifiant au passage**, avec la possibilité de revenir en arrière.

Avec une liste, modifier l'élément courant coûte cher, et il n'y a aucun moyen de reculer :

```
parcourir 50 000 éléments en modifiant chacun
  List.replace_at à chaque pas   20 879 ms
```

Un zipper applique la même idée que la file : **retourner la liste**, cette fois autour d'un point de focus. À gauche, ce qu'on a déjà parcouru, stocké à l'envers. À droite, ce qui reste.

{% raw %}
```elixir
defmodule Zipper do
  def depuis(liste), do: {[], liste}

  def droite({gauche, [x | droite]}), do: {[x | gauche], droite}
  def gauche({[x | gauche], droite}), do: {gauche, [x | droite]}

  def lire({_, [x | _]}), do: x
  def remplacer({gauche, [_ | droite]}, v), do: {gauche, [v | droite]}

  def vers_liste({gauche, droite}), do: Enum.reverse(gauche) ++ droite
end
```
{% endraw %}

Six lignes utiles. Chaque déplacement fait passer un élément d'une pile à l'autre : temps constant. La modification locale est un simple remplacement de tête : temps constant aussi.

```
  List.replace_at à chaque pas   20 879 ms
  zipper                              2 ms
```

Facteur **10 000**. Et surtout, une capacité que la liste n'a pas du tout :

{% raw %}
```elixir
z = Zipper.depuis([:a, :b, :c, :d])
z = z |> Zipper.droite() |> Zipper.droite()
Zipper.lire(z)                        #=> :c
z = Zipper.gauche(z)
Zipper.lire(z)                        #=> :b
Zipper.vers_liste(Zipper.remplacer(z, :B))
#=> [:a, :B, :c, :d]
```
{% endraw %}

On recule. Dans une liste chaînée, c'est impossible : les cellules ne pointent que vers l'avant.

### Là où ça devient vraiment utile

Le zipper prend tout son sens sur un **arbre**, où l'on garde en plus le chemin parcouru depuis la racine. C'est ce qui permet de descendre dans une structure, de modifier une feuille, et de remonter — sans reconstruire l'arbre entier à chaque étape.

En Elixir, l'implémentation de référence est [`Sourceror.Zipper`](https://hexdocs.pm/sourceror/Sourceror.Zipper.html), qui travaille sur l'arbre syntaxique. C'est ce qui fait tourner les outils de réécriture automatique de code — et sa documentation est un bon endroit pour comprendre le concept sur un cas réel.

Fred Hebert a écrit [l'article de référence sur le sujet](https://ferd.ca/yet-another-article-on-zippers.html) en 2010, en Erlang. Il reste la meilleure explication du mécanisme.

## Ce que ces deux structures ont en commun

Ni l'une ni l'autre n'abandonne la liste chaînée. Elles en utilisent deux.

C'est le même geste dans les deux cas : **placer le coût du bon côté**. Une liste est gratuite en tête et chère en queue ; alors on en met deux dos à dos, et les deux extrémités deviennent gratuites. On paie un retournement, mais une seule fois par élément.

Cette idée éclaire aussi la limite. Une liste ne devient pas magiquement indexable : `:queue` ne sait pas plus accéder au 5 000ᵉ élément qu'une liste, et un zipper doit s'y rendre pas à pas. Pour l'accès par index, il faut une structure d'une autre forme — [un vecteur]({{ "/articles/aja-vecteurs-ordmap/" | relative_url }}), c'est-à-dire un arbre.

## Comment choisir

| Le besoin | La réponse |
|---|---|
| Empiler et dépiler du même côté | une liste, `[x \| reste]` |
| Ajouter d'un côté, retirer de l'autre | `:queue` |
| Parcourir en modifiant, avec retour arrière | un zipper |
| Accéder ou modifier par index | un vecteur |
| Ordre d'insertion avec des clés quelconques | une map ordonnée |

La question n'est jamais « quelle est la meilleure structure ». C'est « de quel côté vais-je payer ».

---

*Ces deux pistes viennent d'un [fil de l'Elixir Forum](https://elixirforum.com/t/whats-the-approach-for-handling-lists-that-allows-for-optimized-traversal/76584), en réponse à l'article sur les vecteurs. Merci à **dimitarvp**, qui a signalé `:queue` et l'article de Fred Hebert sur les zippers, et à **sodapopcan**, qui a pointé l'implémentation de `Sourceror`. Publier sert exactement à ça : je suis reparti avec deux structures que je ne connaissais pas.*

*Toutes les mesures ont été prises sur Elixir 1.19.5 et Erlang/OTP 28. Les nombres varient d'une machine à l'autre ; les ordres de grandeur, non.*
