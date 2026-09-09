---
layout: post
title: "mix release : ce qui est figé, ce qui se lit au démarrage, et les trois erreurs qu'on rencontre dans l'ordre"
date: 2026-09-08 14:00:00 +0200
lang: fr
description: "Un release Phoenix construit, démarré, arrêté, et fait échouer trois fois de suite pour de bonnes raisons. Chaque message d'erreur est reproduit tel quel — dont celui qui explique pourquoi éditer config/dev.exs ne change pas le port."
tags: [elixir, phoenix, deploiement, releases, configuration]
categories: [elixir]
sources:
  - titre: "Deploying with Releases — guide Phoenix"
    url: https://hexdocs.pm/phoenix/releases.html
  - titre: "mix release"
    url: https://hexdocs.pm/mix/Mix.Tasks.Release.html
  - titre: "Deployment — guide Phoenix"
    url: https://hexdocs.pm/phoenix/deployment.html
---

Un release, c'est votre application, la machine virtuelle Erlang et toutes les dépendances, copiées dans un dossier qui se lance sans Elixir installé sur la machine cible. Le concept tient en une phrase. Ce qui ne tient pas en une phrase, c'est la frontière entre **ce qui est figé au moment de la construction** et **ce qui est lu au démarrage** — et c'est là que se produisent, dans l'ordre, les trois erreurs de tout premier déploiement.

Tout ce qui suit a été fait sur un projet Phoenix 1.8.13, Elixir 1.19.5, sur la machine de développement. Chaque message est reproduit tel quel.

<!--more-->

## D'abord, le piège qui précède le release

Il commence avant tout déploiement. Vous voulez changer le port en développement, vous éditez `config/dev.exs` :

{% raw %}
```elixir
http: [ip: {127, 0, 0, 1}, port: 4005],
```
{% endraw %}

Et le serveur démarre quand même sur 4000. La raison est dans `config/runtime.exs`, tel que Phoenix 1.8 le génère :

{% raw %}
```elixir
config :mon_app, MonAppWeb.Endpoint,
  http: [port: String.to_integer(System.get_env("PORT", "4000"))]

if config_env() == :prod do
  ...
end
```
{% endraw %}

Ce bloc est **avant** le `if config_env() == :prod`. Il s'exécute dans tous les environnements, après `dev.exs`, et il gagne. Le port ne se change pas dans `dev.exs` mais avec `PORT=4005 mix phx.server`. Ce n'est pas un bug : c'est le premier contact avec la règle qui gouverne tout le reste — **`runtime.exs` est lu au démarrage, et il a le dernier mot**.

## Ce qui est figé, ce qui ne l'est pas

Trois fichiers, trois moments :

| Fichier | Quand il est lu | Ce qu'il peut faire |
|---|---|---|
| `config/config.exs` (+ `dev.exs`, `prod.exs`) | à la **compilation** | ce qui doit être connu du compilateur |
| `config/runtime.exs` | au **démarrage**, à chaque lancement | lire l'environnement, les secrets, les URLs |
| `Application.compile_env/3` dans le code | à la compilation, **vérifié** au démarrage | figer une valeur et refuser de démarrer si elle a changé |

La troisième ligne est celle qu'on découvre par accident. Un article précédent l'a rencontrée avec `iex --dbg pry` : la clé `:dbg_callback` est déclarée comme configuration de compilation, et changer sa valeur au lancement d'un code déjà compilé fait échouer le démarrage avec un message explicite. Un release est fait de code compilé ; tout ce qui passe par `compile_env` y est **définitivement** ce qu'il était sur la machine de construction. [Structurer un projet Elixir]({{ "/articles/structurer-un-projet-elixir/" | relative_url }}) détaille la distinction ; ici on va la voir agir.

## Construire

{% raw %}
```bash
mix phx.gen.release
MIX_ENV=prod mix release
```
{% endraw %}

`phx.gen.release` produit trois fichiers qu'il faut lire, parce qu'ils répondent à des questions qu'on se posera :

{% raw %}
```sh
# rel/overlays/bin/server
PHX_SERVER=true exec ./mon_app start

# rel/overlays/bin/migrate
exec ./mon_app eval MonApp.Release.migrate
```
{% endraw %}

Et `lib/mon_app/release.ex`, qui contient `migrate/0` : il charge l'application sans la démarrer, puis lance `Ecto.Migrator.run/3` sur chaque repo. C'est ainsi qu'on migre une base **sans Mix**, qui n'existe pas dans un release.

Le projet utilisé ici a été généré `--no-assets`. Un projet réel a une étape de plus avant `mix release` : `mix assets.deploy`, qui compile et empreinte les fichiers statiques. Sans elle, le release démarre mais sert un site sans CSS.

Le résultat : un dossier `_build/prod/rel/mon_app/` de 31 Mo, qui contient `erts-16.3` — la machine virtuelle elle-même. La cible n'a besoin ni d'Elixir ni d'Erlang, seulement de la même architecture et du même système que la machine de construction.

## Erreur n° 1 : démarrer sans `DATABASE_URL`

{% raw %}
```bash
_build/prod/rel/mon_app/bin/mon_app start
```
{% endraw %}

{% raw %}
```
ERROR! Config provider Config.Reader failed with:
** (RuntimeError) environment variable DATABASE_URL is missing.
For example: ecto://USER:PASS@HOST/DATABASE
    .../releases/0.1.0/runtime.exs:29: (file)
```
{% endraw %}

Le message vient d'un `raise` que Phoenix a écrit dans `runtime.exs`, sous le `if config_env() == :prod`. Notez le chemin : `releases/0.1.0/runtime.exs`. Le fichier a été **copié dans le release**, et il est évalué au démarrage, sur la machine cible — c'est le seul fichier de configuration qui le soit. Même chose pour `SECRET_KEY_BASE`, ligne suivante.

## Erreur n° 2 : démarrer sans `PHX_SERVER`

On fournit les variables, on lance, et rien n'écoute sur le port. Le journal dit pourquoi :

{% raw %}
```
[info] Configuration :server was not enabled for MonAppWeb.Endpoint, http/https services won't start
```
{% endraw %}

Un release **ne démarre pas le serveur HTTP par défaut**. Le même artefact sert à lancer une migration, une console distante, un script — des usages où un serveur qui s'ouvre serait une nuisance. Le serveur ne s'active que si `PHX_SERVER` est défini, ce que fait `bin/server` et rien d'autre. Ce n'est pas une erreur, c'est le comportement documenté ; mais la première fois, on cherche un problème réseau pendant dix minutes.

## Erreur n° 3 : démarrer deux fois

{% raw %}
```
Protocol 'inet_tcp': the name mon_app@nsea seems to be in use by another Erlang node
```
{% endraw %}

Un release est un **nœud Erlang nommé**, `mon_app@<hôte>`. Deux instances sur la même machine avec le même nom sont impossibles — celle qu'on croyait arrêtée tournait encore. `bin/mon_app stop` s'adresse au nœud par ce nom ; si la commande répond `RPC failed with reason :noconnection`, c'est que le nœud n'est pas joignable, pas qu'il est arrêté. Pour deux instances côte à côte, `RELEASE_NODE` change le nom.

## Enfin : ça tourne

{% raw %}
```bash
PHX_SERVER=true PORT=4005 PHX_HOST=localhost \
DATABASE_URL="ecto://postgres:postgres@127.0.0.1/mon_app_dev" \
SECRET_KEY_BASE="$(mix phx.gen.secret)" \
_build/prod/rel/mon_app/bin/mon_app start
```
{% endraw %}

{% raw %}
```
[info] Running MonAppWeb.Endpoint with Bandit 1.12.5 at :::4005 (http)
[info] Access MonAppWeb.Endpoint at https://localhost
```
{% endraw %}

Deux détails dans ces deux lignes. `:::4005` — le release écoute en IPv6 et IPv4, là où le développement se limitait à `127.0.0.1`. Et `https://localhost` alors qu'on sert en `http` sur 4005 : c'est `url: [host: host, port: 443, scheme: "https"]` dans `runtime.exs`, qui décrit **l'adresse publique** vue derrière un reverse proxy, pas ce que le processus écoute. Les liens générés par `~p` et `url/1` utilisent la première ; le serveur utilise la seconde. Les confondre donne des redirections vers un port qui n'existe pas.

Et un contrôle qui vaut le détour : la même requête qui, en développement, renvoyait une page de débogage en texte brut avec la requête SQL, renvoie ici ce que les clients recevront vraiment :

{% raw %}
```
GET /api/articles/999999  -> 404  {"errors":{"detail":"Not Found"}}
```
{% endraw %}

`bin/mon_app stop` arrête le nœud proprement. `bin/mon_app remote` ouvre un `iex` **connecté au processus qui tourne** — pas une nouvelle instance — et c'est l'outil pour regarder l'état d'une application en production sans la redémarrer.

## À retenir

- `runtime.exs` est lu au démarrage et **a le dernier mot** — y compris en développement : c'est lui qui fixe le port, pas `dev.exs`.
- `config.exs` et `compile_env` sont figés à la construction. Un release ne peut pas les changer ; il refuse de démarrer si on essaie.
- `phx.gen.release` fournit `bin/server`, `bin/migrate` et `Release.migrate/0` — la migration sans Mix.
- Trois erreurs, dans l'ordre : `DATABASE_URL is missing` (le `raise` de `runtime.exs`), `:server was not enabled` (le serveur ne démarre que sous `PHX_SERVER`), `name ... in use by another Erlang node` (un release est un nœud nommé).
- `url:` décrit l'adresse publique, `http:` ce qu'on écoute. Ce sont deux choses.
- Un projet réel a `mix assets.deploy` avant `mix release`.
- `bin/mon_app remote` : la console sur l'application qui tourne.
