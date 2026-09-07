---
layout: post
title: "Les hooks JavaScript de LiveView : la frontière et ses règles"
date: 2026-09-07 10:24:00 +0200
lang: fr
description: "Écrire son premier hook, comprendre ses six moments de vie, faire circuler l'information dans les deux sens — et surtout répondre à la seule question qui compte : qui possède ce morceau de DOM ?"
tags: [liveview, javascript, hooks, phoenix]
categories: [liveview]
sources:
  - titre: "LiveView — JavaScript interoperability"
    url: https://hexdocs.pm/phoenix_live_view/js-interop.html
    note: "les callbacks, les propriétés de this, push_event et handleEvent"
  - titre: "LiveView — Bindings"
    url: https://hexdocs.pm/phoenix_live_view/bindings.html
  - titre: "SortableBoilerPlate"
    url: https://github.com/nseaSeb/SortableBoilerPlate
    note: "le hook de tri par glisser-déposer utilisé en exemple"
  - titre: "right-click-elixir"
    url: https://github.com/nseaSeb/right-click-elixir
    note: "le hook de clic droit utilisé en exemple"
---

LiveView tient une promesse rare : construire une interface réactive sans écrire de JavaScript. Elle tient presque toujours — et puis vient le jour où il faut du glisser-déposer, une carte, un éditeur de texte riche, un menu contextuel. Des choses que le serveur ne peut pas faire, parce qu'elles vivent dans le navigateur.

C'est là qu'interviennent les **hooks**. Ils sont simples à écrire et faciles à mal écrire, parce qu'ils posent une question qu'on n'a pas l'habitude de se poser : **qui possède ce morceau de DOM ?**

<!--more-->

## D'abord : avez-vous vraiment besoin d'un hook ?

Beaucoup de choses pour lesquelles on écrit un hook n'en demandent pas. Le module `Phoenix.LiveView.JS` déclenche des commandes côté client sans aller au serveur ni écrire une ligne de JavaScript :

{% raw %}
```heex
<button phx-click={JS.toggle(to: "#menu")}>Menu</button>
<div phx-click={JS.hide(to: "#alerte") |> JS.push("marquer_lu")}>…</div>
```
{% endraw %}

Afficher, masquer, basculer une classe ou un attribut, poser le focus, animer une transition, naviguer : tout cela existe déjà. En revanche `JS` ne sait pas tout — il n'a par exemple aucune commande de défilement, qu'il faut obtenir par `JS.dispatch` et un écouteur.

Un hook se justifie quand il faut **intégrer du code qui n'est pas le vôtre** — une librairie JavaScript — ou réagir à un événement du navigateur que LiveView n'expose pas.

## Le hook minimal

Trois pièces. Un objet JavaScript :

{% raw %}
```javascript
const RightClickHook = {
  mounted() {
    this.el.addEventListener("contextmenu", (event) => {
      event.preventDefault()
      this.pushEvent("right-click", {
        x: event.clientX,
        y: event.clientY,
        element_id: this.el.id
      })
    })
  }
}

export default RightClickHook
```
{% endraw %}

Son enregistrement au démarrage du socket :

{% raw %}
```javascript
import RightClickHook from "./hooks/right-hook"

const liveSocket = new LiveSocket("/live", Socket, {
  params: {_csrf_token: csrfToken},
  hooks: {RightClickHook}
})
```
{% endraw %}

Et l'attribut côté gabarit :

{% raw %}
```heex
<div id="zone" phx-hook="RightClickHook">Clic droit ici</div>
```
{% endraw %}

**L'`id` n'est pas facultatif**, et LiveView le vérifie à deux endroits.

D'abord à la compilation. HEEx refuse de compiler un gabarit où `phx-hook` — ou `phx-update` — apparaît sans `id` littéral :

```
attribute "phx-hook" requires the "id" attribute to be set
```

C'est le cas le plus fréquent, et le plus confortable : `mix compile` échoue, vous corrigez, vous n'avez jamais lancé le navigateur.

Le second garde-fou est côté client, pour ce que le compilateur ne peut pas voir — un `id={@quelque_chose}` qui vaut `nil` à l'exécution, ou un identifiant arrivant par des attributs dynamiques :

```
no DOM ID for hook "RightClickHook". Hooks require a unique ID on each element.
```

Celui-là ne sort que dans la console du navigateur. Si votre hook ne démarre pas sans raison apparente, c'est le premier endroit à regarder.

La raison de fond est la même dans les deux cas : LiveView doit pouvoir retrouver l'élément d'un rendu à l'autre pour savoir s'il s'agit du même. Sans identifiant, il ne le peut pas.

## Les six moments de la vie d'un hook

La documentation en définit six, et chacun répond à un besoin précis.

**`mounted()`** — l'élément est dans le DOM et le LiveView a fini de monter. C'est là qu'on instancie sa librairie, qu'on pose ses écouteurs, qu'on démarre ce qu'on a à démarrer. Neuf hooks sur dix n'utilisent que celui-là.

**`beforeUpdate()`** — l'élément est sur le point d'être mis à jour. Vous recevez `toEl`, une copie détachée portant la mise à jour à venir, tandis que `this.el` est encore l'élément inchangé. C'est le moment de sauvegarder ce que la mise à jour va détruire : une position de défilement, une sélection de texte. **Tout ce que vous faites ici doit être synchrone** — l'opération ne peut être ni différée ni annulée.

**`updated()`** — le serveur vient de mettre l'élément à jour. On y resynchronise sa librairie avec le nouveau contenu, et on y restaure ce que `beforeUpdate` avait mis de côté.

**`destroyed()`** — l'élément a quitté la page, retiré par une mise à jour du parent ou par la disparition du parent. **C'est votre seule occasion de faire le ménage**, et on y reviendra.

**`disconnected()`** et **`reconnected()`** — le LiveView parent a perdu, puis retrouvé, sa connexion au serveur. De quoi griser une interface pendant une coupure et la réactiver au retour.

Un hook n'a pas besoin de les déclarer tous. Mais les lister vides, avec un commentaire expliquant à quoi chacun sert, est un excellent réflexe quand on débute — on se souvient qu'ils existent le jour où on en a besoin.

## Les deux sens de la conversation

### Du navigateur vers le serveur

{% raw %}
```javascript
this.pushEvent("right-click", payload)          // vers le LiveView
this.pushEventTo(this.el, "reposition", params) // vers le propriétaire de l'élément
```
{% endraw %}

La différence est décisive et se paie cher quand on se trompe. `pushEvent` vise **le LiveView**. `pushEventTo` vise, selon la documentation, « the LiveComponent or LiveView owning the targeted element(s) ».

**Dans un LiveComponent, il faut `pushEventTo`.** Sinon l'événement arrive chez le parent, qui n'a évidemment pas de handler pour lui, et vous cherchez longtemps un bug dans le composant alors que l'erreur nomme le parent. Le conteneur doit également porter `phx-target={@myself}` pour que les événements déclaratifs suivent le même chemin.

En cas de doute, `pushEventTo(this.el, …)` fonctionne dans les deux situations : il vise le propriétaire réel de l'élément, LiveView ou composant.

### Du serveur vers le navigateur

C'est la moitié qu'on oublie souvent. Le serveur pousse avec `push_event/3` :

{% raw %}
```elixir
def handle_event("exporter", _params, socket) do
  {:noreply, push_event(socket, "telecharger", %{url: url})}
end
```
{% endraw %}

Et le hook écoute :

{% raw %}
```javascript
mounted() {
  this.handleEvent("telecharger", ({url}) => window.open(url))
}
```
{% endraw %}

À défaut de hook, ces événements sont aussi diffusés sur `window`, préfixés de `phx:` — `window.addEventListener("phx:telecharger", …)`. Pratique pour du code global, mais un hook reste préférable dès que l'événement concerne un élément précis.

## La vraie question : qui possède ce DOM ?

Tout le reste découle de là. Deux cas concrets, opposés.

### Cas 1 — le serveur reste maître : le tri par glisser-déposer

{% raw %}
```javascript
mounted() {
  new Sortable(this.el, {
    animation: 150,
    onEnd: e => {
      const params = { old: e.oldIndex, new: e.newIndex, ...e.item.dataset }
      this.pushEventTo(this.el, "reposition", params)
    }
  })
}
```
{% endraw %}

{% raw %}
```heex
<div id="sort-items" phx-hook="SortableHook">
  <div :for={item <- @columns} data-id={item.id}>…</div>
</div>
```
{% endraw %}

Le `data-id` sur chaque enfant mérite qu'on s'y arrête : c'est lui que `...e.item.dataset` fait remonter dans la charge utile. Sans lui, le serveur ne reçoit que deux positions, `old` et `new` — ce qui suffit tant que la liste est complète et non filtrée, et casse dès qu'elle est paginée, filtrée ou servie par un stream, où l'indice affiché ne correspond plus à l'indice réel. **Faites toujours voyager une identité, pas seulement une position.**

Remarquez ce qui **n'est pas** là : aucun `phx-update="ignore"`. C'est délibéré. Sortable réordonne le DOM tout de suite, pour que le geste paraisse instantané ; puis le serveur reçoit `reposition`, met à jour ses données, et re-rend la liste dans le bon ordre. Le DOM affiché redevient celui que le serveur décide.

Le hook ne fait ici que **traduire un geste en événement**. L'ordre des éléments appartient au serveur — et c'est ce qui rend le montage robuste : le jour où vous enregistrez cet ordre en base, un rechargement de page le restitue sans toucher au hook.

Précisons pour être honnête : le dépôt d'exemple garde ses colonnes dans l'état du socket, pas en base. Rechargez sa page de démonstration et l'ordre initial revient. La propriété décrite ici tient à l'architecture — le serveur décide — pas à cette démonstration en particulier.

### Cas 2 — la librairie reste maîtresse : un éditeur de texte riche

Un éditeur comme ProseMirror ou TipTap construit et gère son propre arbre DOM, avec la position du curseur, la sélection, l'historique d'annulation. Si LiveView le re-rend, tout est perdu au milieu d'une phrase.

Il faut donc lui céder le terrain :

{% raw %}
```heex
<div id="editeur" phx-hook="EditorHook" phx-update="ignore"></div>
```
{% endraw %}

Et là, un piège que la documentation énonce en une incise facile à manquer :

> Updates from the server to the element's content and attributes are ignored, **except for data attributes**.

Les attributs `data-*` continuent donc d'être mis à jour — et pire, ceux que le serveur n'envoie pas sont **retirés**. Un hook qui range son état dans un `data-*` sur son élément racine le verra disparaître au rendu suivant.

**La règle : l'état du hook vit à l'intérieur du sous-arbre ignoré, jamais sur sa racine.** Dans un éditeur, il vit naturellement dans le nœud DOM de l'éditeur lui-même.

### Comment trancher

Posez-vous une seule question : **après un rechargement complet de la page, qu'est-ce qui doit survivre ?**

Ce qui doit survivre appartient au serveur — il le stocke, il le re-rend, et le hook se contente de lui signaler les gestes. Ce qui est éphémère appartient à la librairie — on lui donne `phx-update="ignore"` et on ne s'en mêle plus.

## Faire le ménage

Un hook qui pose un écouteur sur `this.el` n'a rien à nettoyer : l'élément disparaît, l'écouteur avec lui. Mais dès qu'il touche à autre chose, la fuite est réelle :

{% raw %}
```javascript
mounted() {
  this.onResize = () => this.recalculer()
  window.addEventListener("resize", this.onResize)
  this.timer = setInterval(() => this.rafraichir(), 5000)
},

destroyed() {
  window.removeEventListener("resize", this.onResize)
  clearInterval(this.timer)
}
```
{% endraw %}

Sans ce `destroyed()`, chaque navigation ajoute un écouteur et un minuteur de plus. La page ralentit progressivement, sans qu'aucune erreur n'apparaisse jamais. Écouteurs sur `window` ou `document`, minuteurs, `IntersectionObserver`, `MutationObserver`, connexions WebSocket ouvertes à la main : tout cela se libère dans `destroyed()`.

## Ce que les tests ne diront pas

Un point à garder en tête, développé dans [l'article précédent]({{ "/articles/pannes-silencieuses-liveview/" | relative_url }}) : `render_click`, `render_change` et leurs voisins, dans leur forme fondée sur la vue, envoient l'événement directement au LiveView **sans navigateur**.

Ils prouvent que votre `handle_event` fait ce qu'il faut. Ils ne prouvent rien de votre hook — qui n'a même pas été chargé. Pour tester ce qu'un hook fait réellement, il faut un vrai navigateur : [Wallaby](https://github.com/elixir-wallaby/wallaby) pilote un Chrome.

## En résumé

Un hook est un traducteur posté à la frontière. Il convertit des gestes du navigateur en événements pour le serveur, et des décisions du serveur en actions dans le navigateur.

Écrivez-en le moins possible : `Phoenix.LiveView.JS` couvre déjà beaucoup. Quand il en faut un, décidez d'abord qui possède le DOM concerné, nettoyez dans `destroyed()` tout ce que vous avez posé ailleurs que sur votre élément, et souvenez-vous que dans un LiveComponent, `pushEventTo` est la seule forme correcte.

Deux exemples complets et exécutables : [le tri par glisser-déposer](https://github.com/nseaSeb/SortableBoilerPlate) et [le menu au clic droit](https://github.com/nseaSeb/right-click-elixir).
