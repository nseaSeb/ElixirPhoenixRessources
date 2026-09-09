---
layout: post
title: "Vous faites déjà de la télémétrie : ce que Phoenix émet sans qu'on lui demande"
date: 2026-09-08 13:40:00 +0200
lang: fr
description: "Seize gestionnaires d'événements tournent dans un projet Phoenix vierge. Les voir, brancher le sien sur une vraie requête, et lire ce que Phoenix et Ecto y mettent — en unités natives, ce qui est le premier piège."
tags: [phoenix, telemetry, observabilite, ecto]
categories: [phoenix]
sources:
  - titre: "Telemetry — guide Phoenix"
    url: https://hexdocs.pm/phoenix/telemetry.html
  - titre: ":telemetry — README"
    url: https://hexdocs.pm/telemetry/readme.html
---

La plupart des présentations de Telemetry commencent par « voici comment émettre un événement ». C'est prendre le sujet à l'envers. Dans un projet Phoenix qui vient d'être généré, sans une seule ligne écrite, il y a déjà des événements émis à chaque requête, à chaque requête SQL, à chaque `mount` de LiveView — et des gestionnaires qui les écoutent.

La preuve tient en une commande. Projet Phoenix 1.8.13, Elixir 1.19.5.

<!--more-->

## Seize gestionnaires que vous n'avez pas écrits

{% raw %}
```elixir
:telemetry.list_handlers([])
```
{% endraw %}

Sur le projet vierge, seize entrées. Extrait :

{% raw %}
```
{Phoenix.Logger, [:phoenix, :endpoint, :start]}
{Phoenix.Logger, [:phoenix, :endpoint, :stop]}
{Phoenix.Logger, [:phoenix, :router_dispatch, :start]}
{Phoenix.Logger, [:phoenix, :error_rendered]}
{Phoenix.Logger, [:phoenix, :socket_connected]}
{Phoenix.Logger, [:phoenix, :channel_joined]}
{Phoenix.LiveView.Logger, [:phoenix, :live_view, :mount, :start]}
{Phoenix.LiveView.Logger, [:phoenix, :live_view, :mount, :stop]}
{Phoenix.LiveView.Logger, [:phoenix, :live_view, :handle_event, :start]}
{Phoenix.LiveView.Logger, [:phoenix, :live_view, :handle_event, :stop]}
{Phoenix.LiveView.Logger, [:phoenix, :live_view, :handle_params, :start]}
...
```
{% endraw %}

Ces lignes qu'on voit dans la console en développement — `[info] GET /`, `Sent 200 in 3ms`, `MOUNT MonAppWeb.PostLive.Index` — ne sont pas écrites par Phoenix « en direct ». Elles sont écrites par `Phoenix.Logger`, qui est un **gestionnaire Telemetry comme un autre**, attaché aux mêmes événements que vous pouvez écouter. Le log est une consommation de la télémétrie, pas une fonctionnalité à part.

C'est la première chose à comprendre : Telemetry n'est pas un système de métriques. C'est un **bus d'événements** minuscule — un nom, des mesures, des métadonnées — et tout le reste (logs, métriques, traces) est un gestionnaire branché dessus.

## Brancher le sien sur une vraie requête

{% raw %}
```elixir
:telemetry.attach_many(
  "ma-sonde",
  [[:phoenix, :endpoint, :stop],
   [:phoenix, :router_dispatch, :stop],
   [:mon_app, :repo, :query]],
  fn event, measurements, metadata, _config ->
    IO.inspect({event, measurements, Map.keys(metadata)})
  end,
  nil
)
```
{% endraw %}

Un `GET /api/articles` sur ce projet produit exactement trois événements, dans cet ordre :

{% raw %}
```
[:mon_app, :repo, :query]
  measurements : decode_time, queue_time, query_time, total_time
  metadata     : cast_params, options, params, query, repo, result, source, stacktrace, type
  query        : SELECT a0."id", a0."title", a0."body", ... FROM "articles" AS a0

[:phoenix, :endpoint, :stop]
  measurements : duration
  metadata     : conn, options

[:phoenix, :router_dispatch, :stop]
  measurements : duration
  metadata     : conn, log, path_params, pipe_through, plug, plug_opts, route
  route        : /api/articles
```
{% endraw %}

Trois observations sur ce que ces événements contiennent, parce que c'est ce qui rend Telemetry utile ou inutile selon ce qu'on en fait.

**Ecto vous donne la requête SQL en clair**, sous `metadata.query`, avec les paramètres à part. `queue_time` — le temps passé à attendre une connexion du pool — est la mesure qui explique le plus souvent une lenteur qu'aucun `EXPLAIN` ne montre.

**Phoenix vous donne la `conn` entière.** Statut, chemin, en-têtes, assigns : tout ce qu'on voudrait dans un log structuré est là, sans rien reconstruire.

**`router_dispatch` vous donne la route et le plug** — de quoi regrouper les mesures par action de contrôleur, pas seulement par URL.

## Le premier piège : les unités natives

Voici les mêmes mesures, telles que reçues :

{% raw %}
```
[:phoenix, :endpoint, :stop]   duration: 977399375
[:mon_app, :repo, :query]      total_time: 37106083, queue_time: 26476250
```
{% endraw %}

977 millions de quoi ? Ce ne sont ni des millisecondes ni des microsecondes : ce sont des **unités natives** de la machine virtuelle, dont la valeur dépend du système. La conversion est obligatoire avant tout affichage :

{% raw %}
```elixir
System.convert_time_unit(977_399_375, :native, :millisecond)
#=> 977
```
{% endraw %}

Tout code qui affiche une durée Telemetry sans passer par `convert_time_unit/3` affiche un nombre faux — et sur une machine différente, un nombre faux différemment. Le module `Telemetry` généré par Phoenix le sait, on va le voir.

## Le fichier que Phoenix a généré, et qu'on ne lit jamais

`lib/mon_app_web/telemetry.ex` est un superviseur, démarré avec l'application. Il contient deux choses.

Un **poller**, qui émet des mesures périodiques — mémoire, files d'attente de la VM — toutes les dix secondes :

{% raw %}
```elixir
{:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
```
{% endraw %}

Et une liste de **définitions de métriques**, dont voici deux entrées :

{% raw %}
```elixir
summary("phoenix.endpoint.stop.duration",
  unit: {:native, :millisecond}
),
summary("mon_app.repo.query.queue_time",
  unit: {:native, :millisecond},
  description: "The time spent waiting for a database connection"
)
```
{% endraw %}

`unit: {:native, :millisecond}` — la conversion, déclarée une fois. Et le nom `"phoenix.endpoint.stop.duration"` n'est rien d'autre que l'événement `[:phoenix, :endpoint, :stop]` suivi de la mesure `:duration` : la même chose que la sonde plus haut recevait, sous forme de chaîne.

Ces définitions ne mesurent rien par elles-mêmes. Ce sont des **déclarations**, que consomme un *reporter* : `Telemetry.Metrics.ConsoleReporter` pour les afficher, un reporter Prometheus ou StatsD pour les exporter, le LiveDashboard pour les tracer. Sans reporter, `metrics/0` est une liste que personne ne lit. C'est exactement l'état d'un projet neuf, et c'est pourquoi le fichier semble ne rien faire.

## Émettre le sien

Une fois compris que tout le monde émet, émettre soi-même est trivial :

{% raw %}
```elixir
:telemetry.execute(
  [:mon_app, :facture, :emise],
  %{montant: facture.total_ttc},
  %{client_id: facture.client_id, mode: facture.mode_paiement}
)
```
{% endraw %}

Trois arguments : le nom, les mesures (des nombres), les métadonnées (le contexte). Le code métier ne sait pas qui écoute — un log, un compteur, rien. C'est le point : **l'instrumentation ne dépend pas de la destination**. On ajoute un reporter le jour où on en a besoin, sans toucher à la facturation.

Pour un bloc dont on veut la durée, `:telemetry.span/3` émet `:start`, `:stop` et `:exception` avec le même contrat que Phoenix — d'où la cohérence des noms qu'on a vus.

## À retenir

- Un projet Phoenix vierge a déjà **seize gestionnaires** Telemetry attachés. `Phoenix.Logger` en est un : les logs de requête sont une consommation de la télémétrie.
- Telemetry est un bus d'événements, pas un système de métriques. Nom, mesures, métadonnées ; le reste est un gestionnaire.
- Ecto fournit la requête SQL et le `queue_time` ; Phoenix fournit la `conn` entière et la route.
- **Les durées sont en unités natives.** `System.convert_time_unit/3` ou `unit: {:native, :millisecond}` avant tout affichage, sinon le nombre est faux.
- `telemetry.ex` déclare des métriques ; sans reporter, elles ne produisent rien. C'est normal.
- `:telemetry.execute/3` pour émettre, `:telemetry.span/3` pour mesurer un bloc — sans que le code métier sache qui écoute.
