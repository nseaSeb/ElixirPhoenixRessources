---
layout: post
title: "Les streams LiveView : arrêter de garder 500 lignes en mémoire"
date: 2026-09-06 09:20:00 +0200
lang: fr
description: "Un assign qui contient une liste, c'est cette liste conservée sur le serveur pour chaque visiteur connecté. Les streams déplacent la collection dans le DOM — avec quelques contreparties qu'il vaut mieux connaître avant."
tags: [liveview, phoenix, performance]
categories: [liveview]
---

Vous affichez un flux d'activité, une table de résultats, une liste de messages. Le réflexe LiveView, c'est `assign(socket, :articles, Blog.liste_articles())`. Ça marche parfaitement — et ça coûte plus cher qu'on ne le croit.

<!--more-->

## Ce qu'un assign coûte vraiment

Un LiveView, c'est un processus par onglet connecté. Ce que vous mettez dans le socket **vit dans ce processus, sur votre serveur, tant que l'onglet est ouvert.**

500 articles dans un assign, c'est 500 structs en mémoire. Pour un visiteur. Cent visiteurs sur la page, et vous gardez cinquante mille structs vivantes, dont la plupart sont strictement identiques d'un processus à l'autre.

On confond souvent deux choses. LiveView est très malin sur ce qu'il **envoie** : il calcule un diff et ne transmet que ce qui a changé, pas la page entière. Mais il ne fait aucune promesse sur ce qu'il **retient** : l'assign reste dans l'état du processus, parce qu'il en a besoin pour calculer le prochain diff.

Les streams cassent exactement ce compromis.

## Le principe : le DOM devient la source de vérité

Avec un stream, le serveur envoie les éléments au navigateur puis **les oublie**. C'est le DOM qui garde la collection, et LiveView ne manipule plus que des opérations : insère celui-ci, retire celui-là.

{% raw %}
```elixir
def mount(_params, _session, socket) do
  {:ok, stream(socket, :articles, Blog.liste_articles())}
end

def handle_event("ajouter", %{"article" => params}, socket) do
  {:ok, article} = Blog.creer_article(params)
  {:noreply, stream_insert(socket, :articles, article)}
end

def handle_event("supprimer", %{"id" => id}, socket) do
  article = Blog.get_article!(id)
  {:ok, _} = Blog.supprimer_article(article)
  {:noreply, stream_delete(socket, :articles, article)}
end
```
{% endraw %}

Côté gabarit, trois éléments sont obligatoires, et en oublier un donne des bugs déroutants :

{% raw %}
```heex
<div id="articles" phx-update="stream">
  <div :for={{dom_id, article} <- @streams.articles} id={dom_id}>
    {article.titre}
  </div>
</div>
```
{% endraw %}

1. **Le conteneur porte un `id`.** Sans lui, `phx-update="stream"` ne sait pas quoi mettre à jour.
2. **`phx-update="stream"`** dit à LiveView de ne pas remplacer le contenu mais d'y appliquer des opérations.
3. **Chaque enfant porte l'`id` fourni par le stream.** C'est cette étiquette (`articles-42`) qui permet de retrouver la bonne ligne pour la modifier ou la supprimer.

Le `for` itère sur des tuples `{dom_id, article}`, pas sur les structs directement. C'est un peu déroutant la première fois, mais logique : le serveur ne vous donne pas une collection, il vous donne des paires identifiant/valeur au moment du rendu.

## La contrepartie, et elle est réelle

Le serveur a oublié la liste. Donc **vous ne pouvez pas la relire** — et c'est là que ça devient sournois, parce que le code qui essaie ne plante pas.

`Phoenix.LiveView.LiveStream` implémente bien `Enumerable`, mais **sur les seuls éléments en attente d'insertion pour le rendu en cours**, jamais sur la collection affichée :

{% raw %}
```elixir
# Ne lève aucune erreur, et ne répond pas à la question posée :
# c'est le nombre d'insertions en attente, pas le nombre d'articles.
Enum.count(@streams.articles)

# Filtre les mêmes insertions en attente, pas la liste affichée.
Enum.filter(@streams.articles, & &1.publie)

# Toujours faux : @streams.articles est une struct, jamais une liste.
if @streams.articles == [], do: "Aucun article"
```
{% endraw %}

Une seule de ces opérations vous préviendra : `Enum.member?/2` lève explicitement une erreur `not implemented`. Les autres renvoient une réponse plausible et fausse — le pire des deux mondes, parce que rien dans les journaux ne la signale.

Ce n'est pas une limitation à contourner, c'est la contrepartie du gain. Si vous avez besoin d'un compteur, gardez-le à part — un entier coûte infiniment moins cher qu'une liste de structs :

{% raw %}
```elixir
socket
|> stream(:articles, articles)
|> assign(:nombre, length(articles))
```
{% endraw %}

Et pensez à le mettre à jour dans chaque `stream_delete` et dans chaque `stream_insert` **qui ajoute vraiment** — un `stream_insert` sur un élément déjà présent le remplace au lieu de l'ajouter (voir plus bas), donc l'incrémenter systématiquement fait dériver le compteur à chaque mise à jour de ligne.

## L'état vide, le piège classique

Impossible d'écrire `if @streams.articles == []`. La solution la plus propre passe par le CSS, sans état serveur du tout :

{% raw %}
```heex
<div id="articles" phx-update="stream" class="group">
  <div class="hidden only:block">Aucun article pour le moment.</div>
  <div :for={{dom_id, article} <- @streams.articles} id={dom_id}>
    {article.titre}
  </div>
</div>
```
{% endraw %}

Le bloc vide est le seul enfant quand le stream ne contient rien, donc `only:block` l'affiche ; dès qu'un article arrive, il disparaît. Aucun aller-retour serveur.

## Insérer où il faut

`stream_insert` ajoute à la fin par défaut. Pour un flux où le plus récent est en haut :

{% raw %}
```elixir
stream_insert(socket, :articles, article, at: 0)
```
{% endraw %}

Attention : `at:` positionne dans le DOM, il ne trie pas. Un stream ne connaît pas votre ordre — si vous insérez au mauvais endroit, la ligne y reste. Pour un tri qui dépend des données, il faut recalculer côté serveur et réinitialiser.

Et `stream_insert` sur un élément déjà présent **le remplace** au lieu d'en ajouter un second. C'est ce qui rend la mise à jour d'une ligne triviale : rechargez la struct, réinsérez-la.

## Changer de filtre : `reset: true`

Quand l'utilisateur change de tri ou de filtre, il ne s'agit plus d'ajouter mais de tout remplacer :

{% raw %}
```elixir
def handle_event("filtrer", %{"tag" => tag}, socket) do
  articles = Blog.liste_articles(tag: tag)
  {:noreply, stream(socket, :articles, articles, reset: true)}
end
```
{% endraw %}

Sans `reset: true`, les nouveaux éléments s'ajoutent aux anciens et votre filtre ne filtre rien.

## Quand ne pas utiliser un stream

Les streams ne sont pas un remplacement universel des assigns. Gardez un assign simple quand :

- **la liste est courte et stable** — dix entrées de menu ne justifient pas la complexité ;
- **vous avez besoin de relire la collection côté serveur**, pour un calcul, une validation, un total ;
- **le rendu dépend de la liste entière**, par exemple une moyenne affichée à côté des lignes.

La règle pratique : un stream se justifie dès que la collection grandit avec le temps ou avec les données, et que chaque ligne se suffit à elle-même.

## En résumé

Un assign garde la collection sur le serveur, multipliée par le nombre d'onglets ouverts. Un stream la confie au DOM et n'échange plus que des opérations — au prix de ne plus pouvoir la relire.

Pour un flux, une table qui grandit, une liste de notifications, c'est presque toujours le bon choix. La documentation de [`Phoenix.LiveView.stream/4`](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#stream/4) détaille les options restantes, notamment `limit:` pour plafonner ce que le navigateur conserve.
