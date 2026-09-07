---
layout: post
title: "Les pannes silencieuses de LiveView"
date: 2026-09-07 09:18:00 +0200
lang: fr
description: "Trois défaillances dont l'information se perd entre le navigateur et le serveur — l'une ne laisse aucune trace, une autre accuse le mauvais module, et la première laisse même les tests au vert."
tags: [liveview, phoenix, debogage, tests]
categories: [liveview]
sources:
  - titre: "LiveView — Bindings"
    url: https://hexdocs.pm/phoenix_live_view/bindings.html
    note: "sur phx-update=\"ignore\" et les événements de formulaire"
  - titre: "LiveView — JavaScript interoperability"
    url: https://hexdocs.pm/phoenix_live_view/js-interop.html
    note: "pushEvent contre pushEventTo"
  - titre: "phoenix_live_view — view.ts"
    url: https://github.com/phoenixframework/phoenix_live_view/blob/main/assets/js/phoenix_live_view/view.ts
    note: "le contrôle qui lève « form events require the input to be inside a form »"
  - titre: "phoenix_live_view — live_view_test.ex"
    url: https://github.com/phoenixframework/phoenix_live_view/blob/main/lib/phoenix_live_view/test/live_view_test.ex
---

Un bug qui plante est un bug facile. Il y a une erreur, une trace, un fichier, une ligne. On ouvre, on corrige.

Les pires sont ceux dont l'information se perd en route. Tantôt le serveur n'a rien vu passer et les journaux sont vides ; tantôt il lève bien une erreur, mais elle désigne le mauvais coupable. Et dans un cas, les tests restent au vert.

Voici trois de ces pannes, avec pour chacune l'endroit exact où l'information se perd.

<!--more-->

## 1. Un `phx-change` hors d'un formulaire

Vous ajoutez un champ de recherche qui filtre une liste au fil de la frappe :

{% raw %}
```heex
<input type="text" name="q" phx-change="filtrer" />
```
{% endraw %}

Vous tapez. Rien. Aucune erreur côté serveur, aucune ligne dans les journaux, `handle_event("filtrer", …)` n'est jamais appelé.

**La cause est côté navigateur**, dans une exception que personne ne regarde. Le code de LiveView est explicite — `assets/js/phoenix_live_view/view.ts` :

{% raw %}
```javascript
pushInput(inputEl, targetCtx, forceCid, phxEvent, opts, callback?) {
  if (!inputEl.form) {
    throw new Error("form events require the input to be inside a form");
  }
```
{% endraw %}

`phx-change` est un **événement de formulaire**. Sans `<form>` parent, LiveView refuse de pousser quoi que ce soit et lève dans la console. Le serveur, lui, n'apprendra jamais qu'on a essayé.

Le réflexe est d'entourer d'un `<form>`. Il est juste, mais incomplet — et l'incomplétude est elle-même une panne silencieuse.

{% raw %}
```heex
<!-- Corrige le premier problème, en crée un second. -->
<form phx-change="filtrer">
  <input type="text" name="q" />
</form>
```
{% endraw %}

Un formulaire qui porte `phx-change` **sans** `phx-submit` est traité par LiveView comme un formulaire externe. Toujours dans `live_socket.ts` :

{% raw %}
```javascript
if (!externalFormSubmitted && phxChange && !phxSubmit) {
  externalFormSubmitted = true;
  e.preventDefault();
  this.withinOwners(e.target, (view) => {
    view.disableForm(e.target as HTMLFormElement, phxChange);
    // safari needs next tick
    window.requestAnimationFrame(() => {
      if (DOM.isUnloadableFormSubmit(e)) {
        this.unload();
      }
      (e.target as HTMLFormElement).submit();
    });
  });
}
```
{% endraw %}

`form.submit()` : un envoi de formulaire pour de vrai, avec rechargement complet de la page et perte de l'état du LiveView. Or un formulaire à un seul champ déclenche sa soumission implicite dès qu'on appuie sur **Entrée** — un geste que fait naturellement quelqu'un qui vient de taper une recherche.

La version qui tient debout déclare les deux événements :

{% raw %}
```heex
<form phx-change="filtrer" phx-submit="filtrer">
  <input type="text" name="q" />
</form>
```
{% endraw %}

Entrée déclenche alors `handle_event("filtrer", …)` comme la frappe, et la page reste en place.

### Et le test reste vert

Voilà le vrai piège. Vous écrivez le test qui va bien :

{% raw %}
```elixir
assert render_change(view, :filtrer, %{"q" => "elixir"}) =~ "résultat"
```
{% endraw %}

Il passe. Il passera toujours, formulaire ou pas — parce qu'il ne regarde pas le HTML. Dans `live_view_test.ex`, cette forme de `render_change/3` se réduit à :

{% raw %}
```elixir
def render_change(view, event, value) do
  render_event(view, :change, event, value)
end
```
{% endraw %}

L'événement part **directement au LiveView**. Le balisage rendu n'est jamais consulté, donc l'absence de formulaire lui est invisible. Votre test valide un comportement que l'utilisateur n'obtiendra jamais.

La forme fondée sur un élément — `element(view, "#recherche") |> render_change(%{…})` — est plus honnête, puisqu'elle exige au moins que l'élément existe dans le rendu. Mais rien ne remplace un test navigateur pour ce qui dépend du navigateur.

## 2. Un hook dans un LiveComponent

Votre hook JavaScript pousse un événement, et le LiveView plante avec un `no function clause matching in MonAppWeb.ParentLive.handle_event/3` — alors que le handler existe, sous vos yeux, dans le composant.

Il existe deux fonctions, et elles ne visent pas la même chose. La documentation les distingue nettement : `pushEvent` pousse vers **le LiveView**, tandis que `pushEventTo` pousse « to the LiveComponent or LiveView owning the targeted element(s) ».

Un hook posé dans un LiveComponent qui appelle `pushEvent` envoie donc son événement au **parent**, qui n'a effectivement aucun handler pour lui.

{% raw %}
```javascript
// Dans un LiveComponent : l'événement part chez le parent.
this.pushEvent("ouvrir", {id: 1})

// Ce qu'il faut : viser le composant propriétaire de l'élément.
this.pushEventTo(this.el, "ouvrir", {id: 1})
```
{% endraw %}

Et côté gabarit, le conteneur doit porter `phx-target={@myself}` pour que les événements déclaratifs suivent le même chemin.

Le message d'erreur ne ment pas, et il est même précis : il nomme le module où il a cherché. Ce qu'il ne peut pas dire, c'est **qui aurait dû recevoir l'événement**. Vous lisez le nom du parent et vous allez inspecter le parent, alors que le problème est dans l'enfant.

## 3. `phx-update="ignore"` ne protège pas ce qu'on croit

On pose `phx-update="ignore"` sur un conteneur pour que LiveView n'écrase pas ce qu'une librairie JavaScript y a construit — un éditeur de texte riche, une carte, un composant de tri.

Puis l'état que le hook conservait disparaît au rendu suivant. La documentation explique pourquoi, à condition de lire la fin de la phrase :

> Updates from the server to the element's content and attributes are ignored, **except for data attributes**.

Cette exception est tout le problème. Un hook range volontiers son état dans un `data-*` sur son élément racine — et les attributs `data-*` sont précisément ceux que LiveView continue de mettre à jour. La fonction `DOM.mergeAttrs` va même plus loin : elle **retire** de l'élément les `data-*` que le serveur n'envoie pas. L'état posé par le hook n'est pas seulement écrasé, il est effacé.

La règle qui en découle : **l'état maintenu par le hook doit vivre à l'intérieur du sous-arbre ignoré, pas sur sa racine.** Dans un éditeur ProseMirror, par exemple, il vit naturellement dans le nœud DOM de l'éditeur lui-même, à l'abri.

## Ce que ces trois pannes ont en commun

Elles se ressemblent, et pas par hasard : **l'information existe, mais elle reste dans la couche qui l'a produite.**

Le navigateur sait que le `phx-change` est mal placé — il a levé une exception. Le serveur ne le saura jamais, puisque rien ne lui a été envoyé. Le parent sait qu'il n'a pas de handler — mais pas que le vrai destinataire était son enfant. Le rendu sait qu'il a mis à jour un `data-*` — il ignore que le hook y rangeait quelque chose.

LiveView efface presque entièrement la frontière client/serveur, et c'est sa qualité principale. Ces trois cas sont le prix de cette réussite : quand quelque chose se perd à la frontière, il n'y a plus personne pour le dire.

## Trois réflexes

**Ouvrez la console du navigateur.** C'est la première chose à faire devant une interaction qui ne produit rien côté serveur. Le message y est peut-être depuis le début.

**Méfiez-vous d'un test vert sur un comportement qui dépend du DOM.** Dans leur forme `render_change(view, :evenement, params)`, ces fonctions pilotent le LiveView directement, sans jamais regarder le rendu : elles prouvent que votre `handle_event` fonctionne, pas qu'un utilisateur peut le déclencher.

Préférez systématiquement la forme fondée sur un élément — `element(view, "#recherche") |> render_change(%{…})` — qui résout le sélecteur dans le HTML produit et exige donc que l'élément et sa liaison existent vraiment. Et pour ce qui dépend du navigateur lui-même, il faut un vrai navigateur : [Wallaby](https://github.com/elixir-wallaby/wallaby) pilote un Chrome.

**Quand un événement se perd, demandez-vous qui l'écoute.** Dans un LiveComponent, la réponse par défaut est « le parent », et ce n'est presque jamais ce que vous vouliez.
