---
layout: post
title: "Ecto.Multi : composer une transaction sans se noyer dans les with"
date: 2026-09-06 09:00:00 +0200
lang: fr
description: "Enchaîner plusieurs écritures en base avec Ecto.Multi plutôt qu'avec des with imbriqués : composition, rollback automatique, et des erreurs qu'on peut enfin exploiter."
tags: [ecto, transactions, postgres]
categories: [ecto]
---

Créer un utilisateur, lui créer un profil, l'inscrire à une newsletter. Trois écritures qui doivent réussir **ensemble** : s'il en manque une, on ne veut aucune des trois en base. Le réflexe, quand on arrive d'un autre langage, c'est d'ouvrir une transaction et d'imbriquer des `with`. Ça marche, et ça devient vite illisible.

`Ecto.Multi` répond exactement à ce problème, et son intérêt n'est pas seulement cosmétique.

<!--more-->

## Le réflexe qui coince

Voilà la version « à la main », telle qu'on l'écrit spontanément :

{% raw %}
```elixir
def inscrire(user_attrs) do
  Repo.transaction(fn ->
    with {:ok, user} <- Repo.insert(User.changeset(%User{}, user_attrs)),
         {:ok, profil} <- Repo.insert(Ecto.build_assoc(user, :profil)),
         {:ok, _abo} <- Repo.insert(Abonnement.changeset(%Abonnement{}, %{user_id: user.id})) do
      user
    else
      {:error, changeset} -> Repo.rollback(changeset)
    end
  end)
end
```
{% endraw %}

Le code fonctionne. Trois choses le rendent pénible à vivre :

**On ne sait pas laquelle des étapes a échoué.** La clause `else` reçoit un changeset, sans savoir s'il vient de l'utilisateur, du profil ou de l'abonnement. Pour afficher un message correct, il faut se mettre à discriminer sur le contenu du changeset — au mieux fragile.

**Il faut penser au `rollback`.** Oublier la clause `else`, et le `with` renvoie tranquillement le tuple d'erreur *depuis l'intérieur* de la transaction, qui est alors validée. L'écriture partielle passe en base sans un bruit.

**Ce bloc ne se compose pas.** Il est monolithique. Ajouter une étape conditionnelle, ou réutiliser les deux premières ailleurs, veut dire copier-coller.

## Multi est une structure de données, pas une exécution

Le déclic avec `Ecto.Multi`, c'est que **rien ne s'exécute** quand on le construit. On assemble une valeur — une liste d'opérations nommées — et on la donne à `Repo.transaction/1` à la toute fin.

{% raw %}
```elixir
alias Ecto.Multi

def inscrire(user_attrs) do
  Multi.new()
  |> Multi.insert(:user, User.changeset(%User{}, user_attrs))
  |> Multi.insert(:profil, fn %{user: user} ->
    Ecto.build_assoc(user, :profil) |> Profil.changeset(%{})
  end)
  |> Multi.insert(:abonnement, fn %{user: user} ->
    Abonnement.changeset(%Abonnement{}, %{user_id: user.id})
  end)
  |> Repo.transaction()
end
```
{% endraw %}

Chaque étape porte un **nom** (`:user`, `:profil`, `:abonnement`). C'est ce nom qui fait toute la différence par rapport au `with`.

Quand une étape a besoin du résultat d'une précédente, on passe une fonction au lieu d'une valeur. Ecto l'appelle avec une map des résultats déjà obtenus — d'où le `fn %{user: user} ->`. Les étapes qui ne dépendent de rien peuvent recevoir directement leur changeset.

Le `rollback` n'est plus votre problème : si une étape renvoie `{:error, ...}`, Ecto annule la transaction et n'exécute pas les suivantes.

## Le résultat, et ses quatre éléments

`Repo.transaction/1` sur un Multi renvoie l'une de ces deux formes :

{% raw %}
```elixir
# succès : une map, une clé par étape
{:ok, %{user: user, profil: profil, abonnement: abonnement}}

# échec : quatre éléments, pas deux
{:error, :profil, changeset_en_echec, %{user: user}}
#         ^        ^                  ^
#         |        |                  les étapes déjà réussies (annulées en base)
#         |        la valeur d'erreur renvoyée par l'étape
#         le NOM de l'étape qui a échoué
```
{% endraw %}

C'est ce tuple à quatre éléments qui rend le pattern matching enfin utile côté appelant :

{% raw %}
```elixir
case Comptes.inscrire(params) do
  {:ok, %{user: user}} ->
    conn |> put_flash(:info, "Bienvenue #{user.prenom} !") |> redirect(to: ~p"/")

  {:error, :user, changeset, _} ->
    render(conn, :new, changeset: changeset)

  {:error, :abonnement, _, _} ->
    conn
    |> put_flash(:error, "Compte non créé : le service d'abonnement a refusé.")
    |> render(:new, changeset: User.changeset(%User{}, params))
end
```
{% endraw %}

Le quatrième élément, les changements déjà effectués, mérite une précision : ces enregistrements ont bien été **annulés en base**. Ce que vous récupérez, ce sont les structs telles qu'elles existaient en mémoire. C'est utile pour journaliser ou pour construire un message, jamais pour supposer qu'une ligne existe.

## `Multi.run/3` : tout ce qui n'est pas une écriture Ecto

`Multi.insert`, `Multi.update`, `Multi.delete` couvrent les opérations Ecto. Pour le reste — un calcul, un appel externe, une validation métier — il y a `Multi.run/3` :

{% raw %}
```elixir
|> Multi.run(:quota, fn repo, %{user: user} ->
  case repo.aggregate(Ecto.assoc(user, :projets), :count) do
    n when n < 10 -> {:ok, n}
    n -> {:error, {:quota_depasse, n}}
  end
end)
```
{% endraw %}

Deux règles, et la seconde se paie cher quand on l'ignore.

**La fonction reçoit `repo` en premier argument, et doit renvoyer `{:ok, valeur}` ou `{:error, valeur}`.** Renvoyer autre chose — un booléen, `nil`, une struct nue — lève une erreur à l'exécution. Utilisez le `repo` passé en argument plutôt que votre module `Repo` en dur : c'est ce qui garde le code testable avec la sandbox.

**Un effet de bord ne se rollback pas.** C'est le vrai piège :

{% raw %}
```elixir
# À NE PAS FAIRE
|> Multi.run(:email, fn _repo, %{user: user} ->
  Mailer.envoyer_bienvenue(user)
end)
|> Multi.insert(:abonnement, ...)   # si cette étape échoue...
```
{% endraw %}

PostgreSQL annulera parfaitement les lignes insérées. Il n'ira pas décrocher l'e-mail déjà parti. L'utilisateur reçoit un « bienvenue » pour un compte qui n'existe pas.

La règle : **la transaction ne contient que ce que la base sait annuler.** Les effets de bord vont après :

{% raw %}
```elixir
def inscrire(user_attrs) do
  resultat =
    Multi.new()
    |> Multi.insert(:user, User.changeset(%User{}, user_attrs))
    |> Multi.insert(:profil, &profil_changeset/1)
    |> Repo.transaction()

  # hors transaction : la base a déjà validé
  with {:ok, %{user: user}} <- resultat do
    Mailer.envoyer_bienvenue(user)
    {:ok, user}
  end
end
```
{% endraw %}

Accessoirement, ça évite aussi de tenir une transaction ouverte — et donc des verrous — pendant un appel réseau au serveur SMTP.

## Ce que le `with` ne savait pas faire : composer

Puisqu'un Multi est une valeur, une fonction peut en prendre un et en renvoyer un. Vos transactions deviennent assemblables :

{% raw %}
```elixir
defmodule Comptes do
  def creer_compte(multi, attrs) do
    multi
    |> Multi.insert(:user, User.changeset(%User{}, attrs))
    |> Multi.insert(:profil, &profil_changeset/1)
  end

  def journaliser(multi, action) do
    Multi.insert(multi, :audit, fn %{user: user} ->
      Audit.changeset(%Audit{}, %{action: action, user_id: user.id})
    end)
  end
end

# inscription publique
Multi.new() |> Comptes.creer_compte(attrs) |> Repo.transaction()

# création par un admin : les mêmes étapes, plus une trace
Multi.new()
|> Comptes.creer_compte(attrs)
|> Comptes.journaliser("creation_admin")
|> Repo.transaction()
```
{% endraw %}

Et pour une étape conditionnelle, plus besoin de dupliquer la transaction entière :

{% raw %}
```elixir
multi =
  Multi.new()
  |> Comptes.creer_compte(attrs)

multi = if attrs["newsletter"], do: Multi.insert(multi, :abo, ...), else: multi

Repo.transaction(multi)
```
{% endraw %}

## Deux détails qui mordent

**Les noms d'étapes doivent être uniques.** Réutiliser un nom lève une exception à la construction, pas à l'exécution. C'est une bonne nouvelle — mais surveillez-le en composant des fonctions écrites séparément, qui peuvent toutes deux vouloir s'appeler `:user`. Une convention de préfixe (`:audit_user`) règle la question.

**Une transaction ne rend pas une opération atomique vis-à-vis de la concurrence.** Vérifier « ce login est-il libre ? » dans un `Multi.run` puis insérer dans l'étape suivante laisse la place à deux requêtes simultanées qui passent toutes les deux la vérification. La transaction protège la cohérence de *vos* écritures, elle n'est pas un verrou. Pour l'unicité, c'est une contrainte en base plus `unique_constraint/3` sur le changeset — pas un `SELECT` préalable.

## En résumé

`with` reste très bien pour enchaîner des opérations qui ne partagent pas un sort commun. Dès que « tout ou rien » entre en jeu, `Ecto.Multi` vous donne trois choses que le `with` ne donne pas : un nom sur chaque étape, donc des erreurs exploitables ; un rollback dont vous n'avez plus à vous souvenir ; et des transactions qui se composent comme des fonctions.

La documentation d'[`Ecto.Multi`](https://hexdocs.pm/ecto/Ecto.Multi.html) liste les autres opérations disponibles — `insert_all`, `update_all`, `delete_all`, ainsi que `Multi.error/3` pour interrompre volontairement l'enchaînement.
