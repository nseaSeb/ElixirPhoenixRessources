---
layout: post
title: "Composer des requêtes Ecto : la fonction qui prend une query et en renvoie une"
date: 2026-09-06 10:00:00 +0200
lang: fr
description: "Une requête Ecto est une donnée, pas une chaîne SQL. Ce seul fait permet des filtres réutilisables et testables — à condition de connaître le piège des bindings positionnels."
tags: [ecto, requetes, postgres]
categories: [ecto]
---

En Ecto, `from(a in Article, where: a.publie == true)` ne parle à personne. Ça ne touche pas la base, ça n'ouvre pas de connexion : ça construit une **struct** `Ecto.Query`. Le SQL n'est produit qu'au moment du `Repo.all`.

Ce détail change la façon d'écrire un contexte.

<!--more-->

## Des fragments, pas des requêtes

Puisqu'une requête est une valeur, une fonction peut en prendre une et en renvoyer une. Vos filtres deviennent des briques :

{% raw %}
```elixir
import Ecto.Query

def base, do: from(a in Article)

def publies(query), do: from(a in query, where: a.publie == true)
def recents(query), do: from(a in query, order_by: [desc: a.inserted_at])
def de_user(query, user_id), do: from(a in query, where: a.user_id == ^user_id)
```
{% endraw %}

Et l'assemblage se lit comme une phrase :

{% raw %}
```elixir
def articles_publics(user_id) do
  base()
  |> publies()
  |> de_user(user_id)
  |> recents()
  |> Repo.all()
end
```
{% endraw %}

L'intérêt n'est pas cosmétique. Ces fragments se réutilisent dans d'autres combinaisons, se testent isolément — `publies(base()) |> Repo.all()` est un test parfaitement valable — et un filtre conditionnel ne demande plus de dupliquer la requête entière :

{% raw %}
```elixir
def rechercher(filtres) do
  base()
  |> publies()
  |> then(fn q -> if filtres[:user_id], do: de_user(q, filtres[:user_id]), else: q end)
  |> recents()
  |> Repo.all()
end
```
{% endraw %}

## Le `^` n'est pas une décoration

{% raw %}
```elixir
def de_user(query, user_id), do: from(a in query, where: a.user_id == ^user_id)
```
{% endraw %}

Le `^` (*pin operator*) dit à Ecto : « ceci est une valeur d'Elixir, pas un nom de colonne ». Ecto la sort alors de la requête et l'envoie comme **paramètre** au pilote PostgreSQL. Le SQL produit contient `WHERE user_id = $1`, et la valeur voyage à part.

C'est ce qui rend l'injection SQL structurellement impossible ici : une valeur passée avec `^` ne peut pas devenir du SQL, quoi qu'elle contienne. Ce n'est pas de l'échappement, c'est une séparation.

Corollaire moins connu : **on ne peut pas interpoler un nom de colonne** avec `^`. Pour un tri dynamique venu de l'utilisateur, il faut valider contre une liste blanche avant de construire la requête.

{% raw %}
```elixir
@tris_autorises ~w(titre inserted_at vues)a

def trier(query, champ) when champ in @tris_autorises do
  from(a in query, order_by: [desc: field(a, ^champ)])
end
```
{% endraw %}

`field/2` accepte un atome épinglé comme nom de colonne — mais la garde `when champ in @tris_autorises` reste indispensable, sinon vous laissez l'utilisateur nommer des colonnes.

## Le piège : les bindings positionnels

Voilà ce qui casse en vrai, dès qu'on ajoute une jointure. Dans `from(a in query, ...)`, le `a` est un **binding positionnel** : il désigne la première table de la requête, pas « la table Article ».

Ajoutez une jointure dans un fragment, et les positions bougent :

{% raw %}
```elixir
def avec_auteur(query), do: from(a in query, join: u in assoc(a, :user))

# et plus loin, dans un autre fragment
def par_nom_auteur(query, nom) do
  # `a` désigne toujours la PREMIÈRE table — donc Article, pas User.
  from([a, u] in query, where: u.nom == ^nom)
end
```
{% endraw %}

Il faut compter les bindings et les ordonner correctement, ce qui couple silencieusement vos fragments entre eux : `par_nom_auteur` ne fonctionne que si `avec_auteur` a été appelé avant, et exactement une fois. Rien ne le signale, et l'erreur qui finit par sortir parle de bindings, pas de votre logique.

**Les bindings nommés règlent le problème.** On étiquette une fois, on référence par son nom :

{% raw %}
```elixir
def base, do: from(a in Article, as: :article)

def avec_auteur(query) do
  from([article: a] in query, join: u in assoc(a, :user), as: :auteur)
end

def par_nom_auteur(query, nom) do
  from([auteur: u] in query, where: u.nom == ^nom)
end
```
{% endraw %}

Chaque fragment nomme ce dont il a besoin, et l'ordre d'appel cesse d'être un contrat implicite. `has_named_binding?/2` permet même à un fragment de poser sa jointure seulement si elle manque :

{% raw %}
```elixir
def par_nom_auteur(query, nom) do
  query = if has_named_binding?(query, :auteur), do: query, else: avec_auteur(query)
  from([auteur: u] in query, where: u.nom == ^nom)
end
```
{% endraw %}

Le fragment devient autonome : on peut l'appeler seul ou après `avec_auteur`, sans jointure en double.

## Ne charger que ce dont on a besoin

Trois opérations qui évitent de rapatrier des structs pour rien :

{% raw %}
```elixir
# compter sans charger
Repo.aggregate(Article, :count)

# tester l'existence : s'arrête au premier résultat, ne construit aucune struct
Repo.exists?(from a in Article, where: a.user_id == ^id)

# ne sélectionner que les colonnes utiles
from(a in Article, select: %{id: a.id, titre: a.titre}) |> Repo.all()
```
{% endraw %}

`Repo.exists?` mérite le détour : le réflexe `Repo.all(...) != []` charge toutes les lignes correspondantes pour ensuite les jeter. Sur une table qui grandit, la différence n'est pas marginale.

Le `select:` avec une map est le meilleur ami des listes d'affichage. Charger une struct complète pour n'afficher que deux colonnes, c'est payer la désérialisation de toutes les autres — et souvent un `TOAST` PostgreSQL sur un champ texte volumineux dont vous n'avez pas besoin.

## En résumé

Une requête Ecto est une donnée, donc elle se compose. Écrivez des fragments qui prennent une query et en renvoient une, épinglez toujours vos valeurs avec `^`, et passez aux bindings nommés dès la première jointure — c'est là que les requêtes composées se mettent à casser.

La documentation d'[`Ecto.Query`](https://hexdocs.pm/ecto/Ecto.Query.html) détaille les bindings nommés, les sous-requêtes et les CTE, qui se composent exactement de la même façon.
