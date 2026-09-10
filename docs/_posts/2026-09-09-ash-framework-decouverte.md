---
layout: post
title: "Ash : décrire la ressource, et laisser le reste se déduire"
date: 2026-09-09 08:10:00 +0200
lang: fr
description: "Dans une application Phoenix classique, la même entité est décrite quatre ou cinq fois. Ash propose de ne la décrire qu'une seule fois, et d'en déduire le reste. Voici ce que ça donne, sur un exemple qui tourne en trente lignes, puis ce que ça coûte."
tags: [elixir, ash, ecto, phoenix, architecture]
categories: [elixir]
sources:
  - titre: "Ash — Get Started"
    url: https://hexdocs.pm/ash/get-started.html
  - titre: "AshPostgres — Get Started"
    url: https://hexdocs.pm/ash_postgres/get-started-with-ash-postgres.html
  - titre: "Ash — documentation"
    url: https://hexdocs.pm/ash/
---

Prenez un article de blog dans une application Phoenix ordinaire. Combien de fois est-il décrit ? Le schéma Ecto dit quels champs existent. Le changeset redit lesquels sont acceptés et validés. Le contexte enveloppe le tout dans `creer_article/1`, `liste_articles/0`, `publier/1`. Le contrôleur redit lesquels sont exposés. Le sérialiseur JSON redit lesquels sortent. Et si une API GraphQL s'ajoute, tout recommence.

Rien de tout cela n'est absurde — c'est le prix d'un code explicite, et c'est ce que le parcours de ce dépôt enseigne. Mais chacune de ces couches est une redite, et chaque redite est un endroit où oublier une modification.

Ash part de l'idée inverse : **décrire la ressource une fois, de manière déclarative, et faire dériver le reste de cette description.** Voici ce que ça donne concrètement, sur Ash 3.33.1 et Elixir 1.19.5.

<!--more-->

## Ce qu'est Ash, en une phrase

Ash est un framework déclaratif : on décrit des **ressources** (leurs attributs, leurs actions, leurs relations, leurs règles) et le framework fournit l'exécution. Ce n'est pas une couche au-dessus d'Ecto — Ash a son propre moteur de requêtes, et Ecto y devient un détail d'implémentation de la couche de stockage.

Trois notions suffisent pour démarrer :

- une **ressource** (`Ash.Resource`) : une entité du domaine et tout ce qu'on peut en faire ;
- un **domaine** (`Ash.Domain`) : un regroupement de ressources, l'équivalent d'un contexte Phoenix ;
- une **couche de données** (`data_layer`) : où ça se range. `AshPostgres.DataLayer` pour PostgreSQL, `Ash.DataLayer.Ets` pour de la mémoire, et d'autres.

Autour de ce noyau vit un écosystème d'extensions qui, elles, sont l'argument commercial réel : `AshPostgres`, `AshPhoenix` (formulaires), `AshJsonApi` et `AshGraphql` (des API dérivées des ressources, sans écrire de contrôleur), `AshAuthentication`, `AshOban`.

## Un exemple qui tourne vraiment

Pas besoin de projet ni de base de données : la couche ETS garde tout en mémoire. Le script ci-dessous s'exécute avec `elixir demo.exs`.

{% raw %}
```elixir
Mix.install([{:ash, "~> 3.33"}])
# Ash 3.33 exige ce réglage explicite (comptage de la longueur des chaînes)
Application.put_env(:ash, :default_string_length_count, :codepoints)

defmodule Blog.Article do
  use Ash.Resource, domain: Blog, data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id
    attribute :titre, :string, allow_nil?: false, public?: true
    attribute :corps, :string, public?: true
    attribute :publie, :boolean, default: false, public?: true
    timestamps()
  end

  validations do
    validate string_length(:titre, min: 3), message: "trois caractères minimum"
  end

  actions do
    # les attributs que les actions acceptent par défaut
    default_accept [:titre, :corps]
    # read, destroy, et create/update acceptant tous les attributs publics
    defaults [:read, :destroy, create: :*, update: :*]

    # une action nommée : un verbe du domaine, pas un CRUD anonyme
    update :publier do
      accept []
      change set_attribute(:publie, true)
    end

    # une lecture nommée, avec son filtre embarqué
    read :publies do
      filter expr(publie == true)
    end
  end
end

defmodule Blog do
  use Ash.Domain

  resources do
    resource Blog.Article do
      # l'« interface de code » : les fonctions publiques du domaine
      define :creer, action: :create, args: [:titre]
      define :publier, action: :publier
      define :liste, action: :read
      define :liste_publies, action: :publies
    end
  end
end
```
{% endraw %}

Trente lignes, et l'essentiel du modèle est là. Ce qui compte, c'est ce qu'on n'a **pas** écrit : ni migration, ni changeset, ni fonction de contexte, ni requête.

Le bloc `define` mérite un arrêt. C'est lui qui produit `Blog.creer/1`, `Blog.publier/1`, `Blog.liste/0` — des fonctions Elixir ordinaires, avec leurs variantes `!`. L'appelant ne voit jamais Ash :

{% raw %}
```elixir
article = Blog.creer!("Elixir en production")
```
{% endraw %}

{% raw %}
```
%Blog.Article{
  id: "a7376f6f-b641-4aca-ac73-3a7d920b9f69",
  titre: "Elixir en production",
  corps: nil,
  publie: false,
  inserted_at: ~U[2026-09-09 06:29:41.245575Z],
  updated_at: ~U[2026-09-09 06:29:41.245575Z],
  ...
}
```
{% endraw %}

La validation, elle, est déclarée une fois et vaut pour toutes les actions qui touchent le titre :

{% raw %}
```elixir
{:error, erreur} = Blog.creer("ok")
```
{% endraw %}

{% raw %}
```
type      : Ash.Error.Invalid
[
  {Ash.Error.Changes.InvalidAttribute, :titre,
   "Bread Crumbs:\n  > Error returned from: Blog.Article.create\n\n\nInvalid value provided for titre: trois caractères minimum.\n\nValue: \"ok\"\n"}
]
```
{% endraw %}

L'erreur est structurée : une `Ash.Error.Invalid` qui agrège une liste d'erreurs, chacune portant son champ (`:titre`), son type et son message. C'est cette structure que `AshPhoenix` sait reposer sur un formulaire — le pendant de ce que fait un changeset Ecto, mais fourni pour toutes les actions sans code supplémentaire.

L'action nommée et la lecture nommée se comportent comme prévu :

{% raw %}
```elixir
publie = Blog.publier!(article)          # publie.publie => true
{:ok, _brouillon} = Blog.creer("Un brouillon qui reste brouillon")

length(Blog.liste!())          # => 2
length(Blog.liste_publies!())  # => 1
```
{% endraw %}

Et quand une requête ponctuelle est nécessaire, elle se compose comme une requête Ecto — `Ash.Query.filter/2` étant une macro, il faut `require Ash.Query`, donc écrire ceci dans un module :

{% raw %}
```elixir
defmodule Rapport do
  require Ash.Query

  def titres_publies do
    Blog.Article
    |> Ash.Query.filter(publie == true)
    |> Ash.Query.select([:titre])
    |> Ash.read!()
    |> Enum.map(& &1.titre)
  end
end

Rapport.titres_publies()   # => ["Elixir en production"]
```
{% endraw %}

Le point important : la même ressource a servi pour la couche ETS ci-dessus. En basculant `data_layer:` sur `AshPostgres.DataLayer`, le code appelant ne change pas. C'est la promesse du modèle déclaratif — la description est indépendante du stockage.

## Les grandes lignes d'une vraie mise en place

Pour un projet réel, l'installation passe par `igniter`, qui écrit les fichiers et modifie la configuration à votre place.

{% raw %}
```bash
# un projet Phoenix neuf, avec Ash
mix archive.install hex phx_new
mix archive.install hex igniter_new
mix igniter.new mon_app --install ash,ash_phoenix --with phx.new && cd mon_app

# ou, dans un projet existant
mix igniter.install ash
```
{% endraw %}

Puis la persistance :

{% raw %}
```bash
mix igniter.install ash_postgres
```
{% endraw %}

Le dépôt devient un dépôt Ash, et la ressource déclare sa table :

{% raw %}
```elixir
defmodule MonApp.Repo do
  use AshPostgres.Repo, otp_app: :mon_app

  def installed_extensions do
    ["ash-functions"]
  end
end
```
{% endraw %}

{% raw %}
```elixir
use Ash.Resource,
  domain: MonApp.Blog,
  data_layer: AshPostgres.DataLayer

postgres do
  table "articles"
  repo MonApp.Repo
end
```
{% endraw %}

Et c'est là qu'intervient la différence la plus visible au quotidien : **on n'écrit plus les migrations**. Ash compare l'état déclaré des ressources à un instantané du schéma et génère la migration correspondante.

{% raw %}
```bash
mix ash.codegen ajout_articles   # génère la migration à partir des ressources
mix ash.migrate                  # l'applique
mix ash.setup                    # crée la base et applique tout, pour démarrer
```
{% endraw %}

## Ce que ça change, et ce que ça coûte

Le gain se voit quand l'application grandit. Une règle métier — « seul l'auteur peut modifier son article » — s'écrit une fois dans un bloc `policies` de la ressource, et vaut pour l'interface web, l'API JSON, la console, les tâches de fond. Dans l'approche par contextes, cette même règle doit être posée à chaque point d'entrée, et c'est un endroit d'oubli permanent. C'est le même argument que les scopes de Phoenix 1.8, poussé plus loin.

Le prix, lui, est réel et se paie tôt :

- **La courbe d'apprentissage est raide.** Ash n'est pas une bibliothèque qu'on adopte progressivement dans un coin du projet : c'est une manière d'écrire l'application. Un développeur Elixir expérimenté sait lire un contexte Phoenix le premier jour ; une ressource Ash demande de connaître le DSL.
- **L'indirection complique le débogage.** Quand un contexte plante, la pile d'appels traverse votre code. Quand une action Ash plante, elle traverse des couches génériques, et il faut avoir compris le cycle d'une action pour s'y retrouver.
- **C'est un engagement d'écosystème.** Les extensions sont l'intérêt principal, et elles supposent que tout le modèle est décrit en ressources. Une adoption à moitié donne le coût sans le bénéfice.
- **La documentation francophone est inexistante**, et la communauté, quoique très active, l'est en anglais.

Le point de bascule, en pratique : si l'application est un CRUD avec quelques règles, Ecto et des contextes restent plus simples, plus lisibles et plus faciles à embaucher. Si elle expose les mêmes entités par plusieurs canaux — web, API JSON, GraphQL, tâches de fond — avec des autorisations sérieuses, Ash rend chaque ajout de canal presque gratuit, et c'est là qu'il gagne.

## À retenir

- Ash est **déclaratif** : on décrit des ressources et des actions, le framework fournit l'exécution. Ce n'est pas une surcouche d'Ecto, mais un moteur à part.
- Trois notions : la **ressource**, le **domaine** (l'équivalent d'un contexte) et la **couche de données**, interchangeable — ETS en mémoire, PostgreSQL en production, sans changer le code appelant.
- L'**interface de code** (`define` dans le domaine) produit des fonctions Elixir ordinaires : l'appelant ne voit jamais Ash.
- Les erreurs sont structurées (`Ash.Error.Invalid` agrégeant des erreurs par champ), ce qui permet à `AshPhoenix` de les reposer sur un formulaire sans code dédié.
- Avec `AshPostgres`, **les migrations sont générées** : `mix ash.codegen <nom>` puis `mix ash.migrate`.
- L'installation passe par `igniter` : `mix igniter.install ash`, puis `mix igniter.install ash_postgres`.
- Le vrai gain est l'écriture unique des règles métier pour tous les canaux d'accès ; le vrai coût est une courbe d'apprentissage raide et un engagement d'écosystème.
