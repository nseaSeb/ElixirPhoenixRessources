---
layout: post
title: "Une API REST avec Phoenix : ce que le générateur écrit à votre place"
date: 2026-09-08 13:10:00 +0200
lang: fr
description: "mix phx.gen.json produit six fichiers en une commande. Les lire, c'est comprendre comment Phoenix transforme un tuple d'erreur en 422 — et découvrir que la réponse vue en développement n'est pas celle que reçoivent les clients."
tags: [phoenix, api, json, ecto]
categories: [phoenix]
sources:
  - titre: "JSON and APIs — guide Phoenix"
    url: https://hexdocs.pm/phoenix/json_and_apis.html
  - titre: "Phoenix.Controller.action_fallback/1"
    url: https://hexdocs.pm/phoenix/Phoenix.Controller.html#action_fallback/1
  - titre: "Ecto.Changeset.traverse_errors/2"
    url: https://hexdocs.pm/ecto/Ecto.Changeset.html#traverse_errors/2
  - titre: "Controllers — guide Phoenix"
    url: https://hexdocs.pm/phoenix/controllers.html
---

Une commande suffit à obtenir une API REST complète :

{% raw %}
```bash
mix phx.gen.json Api Article articles title body:text
```
{% endraw %}

Le problème des générateurs n'est pas ce qu'ils écrivent, c'est qu'on les utilise sans lire. Or ces six fichiers contiennent **toute** la mécanique de Phoenix pour une API : comment un tuple d'erreur devient un 422, où se décide le format de la réponse, et pourquoi la réponse qu'on voit en développement n'est pas celle que recevront les clients.

Tout ce qui suit est produit par un projet Phoenix 1.8.13 réel, sur Elixir 1.19.5 et PostgreSQL 15.

<!--more-->

## Le contrôleur, et son absence de `else`

{% raw %}
```elixir
defmodule BlogdemoWeb.ArticleController do
  use BlogdemoWeb, :controller

  action_fallback BlogdemoWeb.FallbackController

  def create(conn, %{"article" => article_params}) do
    with {:ok, %Article{} = article} <- Api.create_article(article_params) do
      conn
      |> put_status(:created)
      |> put_resp_header("location", ~p"/api/articles/#{article}")
      |> render(:show, article: article)
    end
  end
end
```
{% endraw %}

Le `with` n'a **pas de `else`**. C'est le point le plus intéressant du fichier. Normalement, un `with` dont aucune clause ne matche renvoie la valeur qui a échoué — ici `{:error, %Ecto.Changeset{}}`. Une action de contrôleur qui renvoie ça au lieu d'un `%Plug.Conn{}` devrait planter.

C'est `action_fallback` qui rattrape. Il déclare : *si une action ne renvoie pas une `conn`, passe le résultat à ce module*.

{% raw %}
```elixir
defmodule BlogdemoWeb.FallbackController do
  use BlogdemoWeb, :controller

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn
    |> put_status(:unprocessable_entity)
    |> put_view(json: BlogdemoWeb.ChangesetJSON)
    |> render(:error, changeset: changeset)
  end

  def call(conn, {:error, :not_found}) do
    conn
    |> put_status(:not_found)
    |> put_view(html: BlogdemoWeb.ErrorHTML, json: BlogdemoWeb.ErrorJSON)
    |> render(:"404")
  end
end
```
{% endraw %}

**La gestion d'erreur est sortie du contrôleur.** Chaque action décrit le chemin heureux ; le `FallbackController` décrit, une seule fois pour toute l'application, comment chaque forme d'échec devient une réponse HTTP. Ajouter `{:error, :unauthorized}` là suffit à couvrir toutes les actions.

## De `changeset.errors` au corps JSON

`ChangesetJSON` tient en une fonction :

{% raw %}
```elixir
def error(%{changeset: changeset}) do
  %{errors: Ecto.Changeset.traverse_errors(changeset, &translate_error/1)}
end
```
{% endraw %}

`traverse_errors/2` parcourt le changeset, associations imbriquées comprises, et applique la fonction à chaque erreur. Une erreur Ecto est un couple `{message, options}` où le message contient des marqueurs : `"should be at least %{count} character(s)"`. `translate_error/1` remplace les marqueurs par les valeurs — et c'est le point d'entrée prévu pour Gettext, laissé en commentaire dans le fichier généré.

Le résultat, vérifié sur une requête réelle :

{% raw %}
```
422 -> {"errors":{"title":["can't be blank"],"body":["can't be blank"]}}
```
{% endraw %}

Notez le statut exact renvoyé par le serveur : `HTTP/1.1 422 Unprocessable Content`. Le nom officiel de ce code a changé — « Unprocessable Entity » dans la RFC 4918, « Unprocessable Content » depuis la RFC 9110. L'atome Elixir, lui, reste `:unprocessable_entity`.

## La réponse que vous voyez n'est pas celle que le client recevra

Voici le piège qui coûte le plus cher, et il ne se voit qu'en comparant deux environnements.

On demande un article qui n'existe pas. `Api.get_article!/1` appelle `Repo.get!/2`, qui lève `Ecto.NoResultsError`. Cette exception n'est pas gérée par le `FallbackController` — elle n'est pas un tuple, c'est une exception. C'est `Plug.Exception` qui la traduit en statut 404.

**En développement**, avec `debug_errors: true`, la réponse est ceci :

{% raw %}
```
HTTP/1.1 404 Not Found

# Ecto.NoResultsError at GET /api/articles/999999

Exception:

    ** (Ecto.NoResultsError) expected at least one result but got none in query:

    from a0 in Blogdemo.Api.Article,
      where: a0.id == ^"999999"

        (ecto 3.14.2) lib/ecto/repo/queryable.ex:178: Ecto.Repo.Queryable.one!/3
        (blogdemo 0.1.0) lib/blogdemo_web/controllers/article_controller.ex:24: ...
```
{% endraw %}

Une page de débogage en texte brut, avec la requête SQL et la stacktrace. Ce n'est pas du JSON, et aucun client ne saura la lire.

**Hors développement**, la même requête donne :

{% raw %}
```
404 -> {"errors":{"detail":"Not Found"}}
```
{% endraw %}

C'est `ErrorJSON` qui rend cette réponse, via `render_errors:` déclaré dans `config/config.exs`. La leçon : **tester une API à la main en développement ne dit rien du contrat réel.** Les tests de contrôleur, eux, tournent en environnement `test` où `debug_errors` est faux — ce sont eux qui voient la vraie réponse. `assert_error_sent 404, fn -> ... end` est l'outil pour ça.

## Le pipeline `:api`, et le 406

{% raw %}
```elixir
pipeline :api do
  plug :accepts, ["json"]
end

scope "/api", BlogdemoWeb do
  pipe_through :api
  resources "/articles", ArticleController, except: [:new, :edit]
end
```
{% endraw %}

Une seule ligne dans le pipeline, et elle fait plus qu'il n'y paraît. Avec un en-tête `Accept: text/csv` :

{% raw %}
```
406 -> Not Acceptable
```
{% endraw %}

Réponse en **texte brut**, pas en JSON : `plug :accepts` refuse la requête avant qu'aucune vue JSON n'entre en jeu. Si votre API doit répondre en JSON même à un `Accept` invalide, c'est là qu'il faut intervenir, pas dans le contrôleur.

Le décodage du corps, lui, se joue dans l'endpoint :

{% raw %}
```elixir
plug Plug.Parsers,
  parsers: [:urlencoded, :multipart, :json],
  pass: ["*/*"],
  json_decoder: Phoenix.json_library()
```
{% endraw %}

## Jason, ou le `JSON` de la bibliothèque standard

Phoenix 1.8 configure encore Jason :

{% raw %}
```elixir
config :phoenix, :json_library, Jason
```
{% endraw %}

Depuis Elixir 1.18, un module `JSON` fait partie de la bibliothèque standard. Le remplacement est direct — vérifié sur ce projet, en changeant cette seule ligne pour `config :phoenix, :json_library, JSON` : les quatre réponses (201, 404, 406, 422) sont sorties **identiques**, tests au vert. Une dépendance de moins, si votre projet n'utilise Jason que pour ça.

## Ce qui n'est pas généré, et qu'il faudra écrire

Le générateur produit une API fonctionnelle, pas une API exposable. Manquent, dans l'ordre où ça fait mal :

**L'authentification.** Rien dans le pipeline `:api` ne vérifie quoi que ce soit. Un plug qui lit un en-tête `Authorization`, valide un jeton et assigne l'utilisateur — puis un `pipe_through [:api, :authentifie]`.

**La pagination.** `index` fait `Api.list_articles()`, c'est-à-dire `Repo.all/1` sans limite. Ça tient jusqu'au jour où ça ne tient plus, et ce jour-là c'est en production.

**Le versionnage.** `/api/articles` ne dit pas quelle version du contrat il sert. `scope "/api/v1"` coûte cinq minutes maintenant et une migration douloureuse plus tard.

**La cohérence des erreurs.** `ChangesetJSON` renvoie `{"errors": {"champ": [...]}}`, `ErrorJSON` renvoie `{"errors": {"detail": "..."}}`. Deux formes différentes sous la même clé : un client doit gérer les deux. À uniformiser avant que quiconque n'écrive du code contre votre API.

**Les transactions.** Dès qu'une action touche plusieurs tables, `Api.create_article/1` ne suffit plus.

## À retenir

- `action_fallback` sort la gestion d'erreur du contrôleur : chaque action ne décrit que le chemin heureux, et le `with` n'a pas besoin de `else`.
- Un `{:error, %Ecto.Changeset{}}` devient un 422 dont le corps est produit par `traverse_errors/2` ; les exceptions, elles, passent par `Plug.Exception` et `ErrorJSON`.
- **En développement, un 404 renvoie une page de débogage en texte brut, pas le JSON que vos clients recevront.** Les tests de contrôleur voient la vraie réponse ; `assert_error_sent` est fait pour ça.
- `plug :accepts, ["json"]` refuse un `Accept` inconnu par un 406 en texte brut, avant toute vue.
- Phoenix 1.8 configure Jason, mais le module `JSON` d'Elixir 1.18+ le remplace sans changer une seule réponse.
- Le générateur ne fournit ni authentification, ni pagination, ni versionnage, et laisse deux formes de corps d'erreur différentes.
