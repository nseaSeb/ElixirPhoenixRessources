---
layout: post
title: "Les scopes de Phoenix 1.8 : le même générateur, avant et après"
date: 2026-09-08 13:30:00 +0200
lang: fr
description: "Lancez phx.gen.live avant d'avoir généré l'authentification, puis après. Le code produit n'est plus le même : chaque fonction de contexte reçoit un scope, chaque requête filtre, chaque diffusion PubSub est cloisonnée. Voici le diff, ligne par ligne."
tags: [phoenix, liveview, ecto, architecture]
categories: [phoenix]
sources:
  - titre: "Scopes — guide Phoenix"
    url: https://hexdocs.pm/phoenix/scopes.html
  - titre: "mix phx.gen.auth — guide Phoenix"
    url: https://hexdocs.pm/phoenix/mix_phx_gen_auth.html
---

La façon la plus honnête de comprendre les scopes de Phoenix 1.8, c'est de lancer **deux fois le même générateur** dans le même projet : une fois avant `phx.gen.auth`, une fois après. Le code produit n'est plus le même, et la différence *est* l'explication.

Projet Phoenix 1.8.13, Elixir 1.19.5. D'abord `mix phx.gen.live Blog Post posts title body:text`, puis l'authentification, puis `mix phx.gen.live Blog Note notes title` dans le même contexte. Les 160 tests générés passent.

<!--more-->

## Avant : des fonctions qui ne savent pas qui appelle

{% raw %}
```elixir
def list_posts do
  Repo.all(Post)
end

def get_post!(id), do: Repo.get!(Post, id)
```
{% endraw %}

Aucun paramètre. La fonction renvoie tous les posts de la base, et n'importe qui peut lire n'importe quel post par son identifiant. C'est le code que tous les tutoriels montrent, et il est correct — tant que l'application n'a pas d'utilisateurs.

## Après : un scope en premier argument, partout

{% raw %}
```elixir
def list_notes(%Scope{} = scope) do
  Repo.all_by(Note, user_id: scope.user.id)
end

def get_note!(%Scope{} = scope, id) do
  Repo.get_by!(Note, id: id, user_id: scope.user.id)
end
```
{% endraw %}

Chaque fonction publique du contexte reçoit un `%Scope{}` et **filtre sur lui**. `get_note!/2` ne demande plus « la note n° 12 » mais « la note n° 12 de cet utilisateur ». Une note qui appartient à quelqu'un d'autre n'est pas interdite : elle est *introuvable*, ce qui vaut un 404 plutôt qu'un 403, et ne révèle pas son existence.

Les écritures reçoivent le même traitement, avec une ligne qui mérite qu'on s'arrête :

{% raw %}
```elixir
def update_note(%Scope{} = scope, %Note{} = note, attrs) do
  true = note.user_id == scope.user.id
  ...
end
```
{% endraw %}

`true = ...` est un pattern match. Si la note n'appartient pas à l'utilisateur du scope, il échoue avec un `MatchError`. Ce n'est pas une vérification qui renvoie une erreur polie : c'est une assertion, et sa violation est un bug — la note passée à `update_note/3` a forcément été obtenue par `get_note!/2`, qui a déjà filtré. Si on arrive ici avec la mauvaise note, quelque chose est cassé plus haut, et planter est la bonne réponse.

Côté schéma, le générateur écrit l'attribution dans le changeset, pas dans les paramètres :

{% raw %}
```elixir
def changeset(note, attrs, user_scope) do
  note
  |> cast(attrs, [:title])
  |> validate_required([:title])
  |> put_change(:user_id, user_scope.user.id)
end
```
{% endraw %}

`:user_id` n'est **pas** dans la liste du `cast`. Un formulaire ne peut donc pas le fournir, ni un client d'API : c'est le scope, et lui seul, qui décide à qui appartient la note. La migration suit, avec une clé étrangère `on_delete: :delete_all` et un index sur `user_id`.

## Le PubSub aussi

C'est la partie que les explications oublient. Le générateur produit aussi ceci :

{% raw %}
```elixir
def subscribe_notes(%Scope{} = scope) do
  key = scope.user.id
  Phoenix.PubSub.subscribe(MonApp.PubSub, "user:#{key}:notes")
end

defp broadcast_note(%Scope{} = scope, message) do
  key = scope.user.id
  Phoenix.PubSub.broadcast(MonApp.PubSub, "user:#{key}:notes", message)
end
```
{% endraw %}

Le sujet PubSub contient l'identifiant de l'utilisateur. Une LiveView qui s'abonne aux notes ne reçoit que les créations, modifications et suppressions **de son propre scope**. Sans ça, un `broadcast` sur un sujet global `"notes"` enverrait à chaque utilisateur connecté les modifications de tous les autres — pas leur contenu affiché, mais leurs messages, et c'est déjà une fuite.

## Où est défini ce `%Scope{}`

`phx.gen.auth` a créé `lib/mon_app/accounts/scope.ex`. Le module est minuscule :

{% raw %}
```elixir
defmodule MonApp.Accounts.Scope do
  alias MonApp.Accounts.User

  defstruct user: nil

  def for_user(%User{} = user), do: %__MODULE__{user: user}
  def for_user(nil), do: nil
end
```
{% endraw %}

Une structure avec un seul champ. La documentation du module encourage à l'étendre — un drapeau « administrateur », une organisation, un rôle — et c'est là que le mécanisme prend son sens : le jour où votre application devient multi-organisations, le scope porte l'organisation, et **les fonctions de contexte n'ont pas à changer de signature**. Elles reçoivent déjà un scope.

Le plug `fetch_current_scope_for_user`, ajouté au pipeline `:browser`, construit ce scope à chaque requête et l'assigne sous `:current_scope`. Les LiveViews le reçoivent via `on_mount`. Les tests le reçoivent via un `setup :register_and_log_in_user` — que le générateur a écrit dans `note_live_test.exs`, et qui n'existait pas dans `post_live_test.exs`.

## Ce qui pilote le générateur

Tout ceci est piloté par un bloc de configuration que `phx.gen.auth` a ajouté à `config/config.exs`, et qu'il vaut la peine de lire une fois :

{% raw %}
```elixir
config :mon_app, :scopes,
  user: [
    default: true,
    module: MonApp.Accounts.Scope,
    assign_key: :current_scope,
    access_path: [:user, :id],
    schema_key: :user_id,
    schema_type: :id,
    schema_table: :users,
    test_data_fixture: MonApp.AccountsFixtures,
    test_setup_helper: :register_and_log_in_user
  ]
```
{% endraw %}

Chaque clé explique une ligne du code généré. `access_path: [:user, :id]` est le chemin pour aller du scope à la valeur qui filtre — d'où `scope.user.id` partout. `schema_key: :user_id` est le nom de la colonne. `assign_key: :current_scope` est le nom de l'assign. Changer ce bloc change ce que les générateurs suivants écrivent.

`default: true` signifie que tout `phx.gen.live`, `phx.gen.html` ou `phx.gen.json` lancé après utilisera ce scope sans qu'on le demande. Pour un schéma qui n'appartient à personne — une table de référence, un catalogue public — il y a `--no-scope`.

## Ce que ça ne fait pas

Le scope filtre ce que le générateur écrit. Il ne touche pas au code existant : `list_posts/0` est toujours là, sans scope, exactement comme avant. Le générateur ne réécrit pas l'histoire, et c'est à vous de décider si `Post` doit devenir scopé — en le refaisant, ou à la main.

Il ne touche pas non plus au pipeline `:api`. Un `phx.gen.json` lancé après l'authentification produira des fonctions de contexte scopées, mais rien dans le routeur ne remplira `current_scope` pour une requête JSON. Il faut un plug qui lise un jeton et construise le scope lui-même.

## À retenir

- Après `phx.gen.auth`, les générateurs produisent des fonctions de contexte qui prennent un `%Scope{}` en premier argument et **filtrent toutes les requêtes** dessus.
- Une ressource d'un autre utilisateur devient introuvable, pas interdite : 404, pas 403.
- `true = note.user_id == scope.user.id` est une assertion qui plante, pas une vérification qui répond — et c'est voulu.
- L'appartenance est posée par `put_change/3` dans le changeset, jamais reçue des paramètres.
- Les sujets PubSub sont cloisonnés par utilisateur ; sans ça, les diffusions fuient.
- Le comportement est piloté par `config :mon_app, :scopes` ; `--no-scope` pour les schémas sans propriétaire.
- Le code déjà écrit et le pipeline `:api` ne sont pas modifiés.
