[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

# Phoenix LiveView — l'essentiel

LiveView permet de construire des interfaces temps réel **sans écrire de JavaScript** : le serveur garde l'état, rend le HTML, et envoie uniquement les différences au navigateur via WebSocket.

## Le cycle de vie

Une LiveView se monte en **deux temps** :

1. **Render statique (HTTP)** : premier chargement, bon pour le SEO et le « premier rendu rapide ».
2. **Render connecté (WebSocket)** : la page établit la connexion, `mount/3` est rappelé, l'état devient interactif.

```elixir
defmodule MonAppWeb.CompteurLive do
  use MonAppWeb, :live_view

  # mount/3 : initialise l'état. Appelé deux fois (statique puis connecté).
  # connected?(socket) permet de ne déclencher certaines actions (timers, abonnements)
  # qu'une fois la connexion WebSocket établie.
  def mount(_params, _session, socket) do
    {:ok, assign(socket, compteur: 0)}
  end

  # render/1 : le HTML. ~H est le sigil HEEx (HTML + Embedded Elixir).
  def render(assigns) do
    ~H"""
    <div>
      <p>Valeur : {@compteur}</p>
      <button phx-click="inc">+1</button>
      <button phx-click="dec">-1</button>
    </div>
    """
  end

  # handle_event/3 : réagit aux événements envoyés par le client (phx-click, phx-submit...).
  def handle_event("inc", _params, socket) do
    {:noreply, update(socket, :compteur, &(&1 + 1))}
  end

  def handle_event("dec", _params, socket) do
    {:noreply, update(socket, :compteur, &(&1 - 1))}
  end
end
```

> Note : depuis Phoenix 1.7 / LiveView 0.18+, on interpole avec `{@compteur}` en HEEx. Sur les projets plus anciens vous verrez `<%= @compteur %>`.

## Les assigns

L'état d'une LiveView vit dans `socket.assigns`. On le modifie avec :

- `assign(socket, cle: valeur)` — pose ou remplace une valeur.
- `update(socket, :cle, fun)` — met à jour à partir de l'ancienne valeur.
- `assign_new(socket, :cle, fun)` — n'assigne que si absent (utile pour partager des données entre render statique et connecté).

LiveView ne renvoie au navigateur **que les assigns qui ont changé** : c'est ce qui rend le diff léger.

## Les bindings `phx-*` côté HTML

| Binding | Déclencheur |
|---|---|
| `phx-click` | clic |
| `phx-submit` | soumission de formulaire |
| `phx-change` | changement d'un champ (validation live) |
| `phx-keyup` / `phx-keydown` | clavier |
| `phx-blur` / `phx-focus` | perte / prise de focus |
| `phx-hook` | branche un Hook JavaScript (voir plus bas) |

On peut cibler une valeur avec `phx-value-*` :

```heex
<button phx-click="supprimer" phx-value-id={item.id}>Supprimer</button>
```

```elixir
def handle_event("supprimer", %{"id" => id}, socket), do: ...
```

## handle_info : les messages serveur (temps réel)

`handle_event` réagit au **client**. `handle_info` réagit aux **messages internes** : timers, PubSub, tâches asynchrones. C'est le mécanisme pour pousser des mises à jour en temps réel.

```elixir
def mount(_params, _session, socket) do
  if connected?(socket) do
    # On s'abonne à un sujet PubSub
    Phoenix.PubSub.subscribe(MonApp.PubSub, "notifications")
  end

  {:ok, assign(socket, messages: [])}
end

# Déclenché quand un message arrive sur le sujet "notifications"
def handle_info({:nouveau_message, msg}, socket) do
  {:noreply, update(socket, :messages, &[msg | &1])}
end
```

## Streams : les listes qui changent souvent

Pour des collections (flux d'activité, table de résultats), `stream` évite de garder toute la liste en mémoire côté serveur et n'envoie au DOM que les éléments ajoutés/retirés/modifiés.

```elixir
def mount(_params, _session, socket) do
  {:ok, stream(socket, :articles, Blog.liste_articles())}
end

def handle_event("ajouter", %{"article" => params}, socket) do
  {:ok, article} = Blog.creer_article(params)
  {:noreply, stream_insert(socket, :articles, article)}
end
```

```heex
<div id="articles" phx-update="stream">
  <div :for={{dom_id, article} <- @streams.articles} id={dom_id}>
    {article.titre}
  </div>
</div>
```

## Les Hooks JavaScript (quand on a vraiment besoin de JS)

Pour intégrer une lib JS (drag & drop, graphiques, menus...), on utilise un **Hook** branché avec `phx-hook`. Le serveur et le client s'échangent des événements via `pushEvent` / `handle_event`.

Deux exemples concrets que j'ai implémentés :

- [Implémentation Hook sortable.js (drag & drop)](https://github.com/nseaSeb/SortableBoilerPlate)
- [Implémentation Hook clic droit](https://github.com/nseaSeb/right-click-elixir)

Voir aussi le tip [Test unitaire dans les commentaires](../Test_unitaire/testUnitaireDansLeCommentaire.md) qui teste justement un `handle_event` de repositionnement.

## À retenir

- `mount` (état) → `render` (HEEx) → `handle_event` (client) / `handle_info` (serveur).
- L'état vit dans `socket.assigns` ; seuls les changements transitent par le réseau.
- `connected?/1` pour n'agir qu'une fois la WebSocket prête.
- `stream` pour les grandes listes, `phx-hook` pour le JS indispensable.
- Documentation officielle : https://hexdocs.pm/phoenix_live_view
