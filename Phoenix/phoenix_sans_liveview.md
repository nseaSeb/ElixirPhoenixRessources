[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

# Phoenix « classique » : routing, contexts & contrôleurs

Avant LiveView, Phoenix est d'abord un framework web **requête / réponse** classique. Comprendre ce socle aide à mieux saisir LiveView ensuite, et reste indispensable pour les API JSON, les webhooks ou les pages qui n'ont pas besoin de temps réel.

## Le trajet d'une requête

```
Navigateur → Endpoint → Router → Pipeline (plugs) → Contrôleur → Vue/Template → Réponse HTML
```

Chaque requête HTTP traverse cette chaîne. Le **contexte** (la logique métier) est appelé par le contrôleur, jamais l'inverse.

## Le Router

Le routeur associe une méthode HTTP + un chemin à une **action de contrôleur**. Il organise aussi les requêtes en **pipelines** (des suites de *plugs* : parsing, session, CSRF, authentification…).

```elixir
defmodule MonAppWeb.Router do
  use MonAppWeb, :router

  # Un pipeline = une suite de transformations appliquées à la connexion.
  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :protect_from_forgery   # protection CSRF
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", MonAppWeb do
    pipe_through :browser   # toutes ces routes passent par le pipeline :browser

    get "/", PageController, :home
    resources "/articles", ArticleController   # génère les 7 routes CRUD REST
  end

  scope "/api", MonAppWeb do
    pipe_through :api
    resources "/articles", ArticleJSONController, except: [:new, :edit]
  end
end
```

`resources "/articles", ArticleController` crée d'un coup les routes REST : `index`, `new`, `create`, `show`, `edit`, `update`, `delete`.

> `mix phx.routes` liste toutes les routes de l'application — très pratique pour s'y retrouver.

### Les routes vérifiées (`~p`) — Phoenix 1.7+

On ne construit plus les URLs à la main : le sigil `~p` **vérifie à la compilation** que la route existe.

```heex
<.link href={~p"/articles/#{article.id}"}>Voir l'article</.link>
```

Si le chemin n'existe pas dans le routeur, le compilateur **avertit** — fini les liens morts silencieux.

## Les Contexts : la frontière métier

Un **context** est un module qui regroupe la logique d'un domaine (les articles, les comptes, la facturation…). C'est l'API publique que les contrôleurs appellent ; ils ne touchent jamais Ecto directement.

```elixir
# lib/mon_app/blog.ex — le context "Blog"
defmodule MonApp.Blog do
  alias MonApp.Repo
  alias MonApp.Blog.Article

  def liste_articles, do: Repo.all(Article)

  def get_article!(id), do: Repo.get!(Article, id)

  def creer_article(attrs) do
    %Article{}
    |> Article.changeset(attrs)
    |> Repo.insert()
  end
end
```

L'intérêt : le contrôleur (le « web ») reste mince et ignore les détails de la base. On pourrait changer Ecto pour autre chose sans toucher au web.

> Générateur : `mix phx.gen.html Blog Article articles titre:string corps:text` crée le context, le schéma, la migration, le contrôleur **et** les templates.

## Les Contrôleurs

Un contrôleur reçoit la connexion (`conn`) et les paramètres, appelle le context, puis rend une réponse. Chaque route pointe vers une **action** (une fonction).

```elixir
defmodule MonAppWeb.ArticleController do
  use MonAppWeb, :controller

  alias MonApp.Blog

  def index(conn, _params) do
    articles = Blog.liste_articles()
    render(conn, :index, articles: articles)
  end

  # Le pattern matching extrait l'id directement depuis les params.
  def show(conn, %{"id" => id}) do
    article = Blog.get_article!(id)
    render(conn, :show, article: article)
  end

  def create(conn, %{"article" => params}) do
    case Blog.creer_article(params) do
      {:ok, article} ->
        conn
        |> put_flash(:info, "Article créé.")
        |> redirect(to: ~p"/articles/#{article.id}")

      {:error, changeset} ->
        render(conn, :new, changeset: changeset)
    end
  end
end
```

`conn` est **immuable** comme toute donnée Elixir : chaque `put_flash`, `redirect`, `render` renvoie une *nouvelle* connexion. D'où l'usage naturel du pipe `|>`.

## Les vues et templates (HEEx)

Depuis Phoenix 1.7, la « vue » est un module de **composants de fonction** (`Phoenix.Component`). Les templates sont du HEEx, exactement comme en LiveView.

```elixir
# lib/mon_app_web/controllers/article_html.ex
defmodule MonAppWeb.ArticleHTML do
  use MonAppWeb, :html

  embed_templates "article_html/*"
end
```

```heex
<%!-- article_html/index.html.heex --%>
<h1>Articles</h1>
<ul>
  <li :for={article <- @articles}>
    <.link href={~p"/articles/#{article.id}"}>{article.titre}</.link>
  </li>
</ul>
```

Le HEEx est le **même langage de template** qu'en LiveView : ce que tu apprends ici sert directement là-bas.

## Contrôleur vs LiveView : lequel choisir ?

| Besoin | Choix |
|---|---|
| Page classique, formulaire simple, SEO, API JSON | **Contrôleur** |
| Interactivité temps réel sans recharger la page | **LiveView** |
| Webhook, endpoint machine-à-machine | **Contrôleur** (JSON) |

Les deux cohabitent dans une même application, et partagent le routeur, les contexts et le HEEx.

## À retenir

- Le trajet : **Router → Pipeline → Contrôleur → Template**, et le contrôleur appelle le **context**.
- Le **context** isole la logique métier ; le web reste mince.
- Les **routes vérifiées** `~p"/..."` évitent les URLs cassées (Phoenix 1.7+).
- `conn` est immuable : on l'enchaîne au pipe (`put_flash |> redirect`).
- Le **HEEx** est commun aux contrôleurs et à [LiveView](../LiveView/liveview.md).
- Générateur express : `mix phx.gen.html` · lister les routes : `mix phx.routes`.
- Documentation officielle : https://hexdocs.pm/phoenix/controllers.html
