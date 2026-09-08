---
layout: post
title: "Des tests concurrents avec une base de données : comment, et jusqu'où"
date: 2026-09-08 08:10:00 +0200
lang: fr
description: "async: true est possible en Elixir là où d'autres langages y renoncent. La sandbox Ecto explique pourquoi — et connaître ses limites évite le test vert qui masque un bug de production."
tags: [tests, exunit, ecto, phoenix]
categories: [elixir]
sources:
  - titre: "Ecto.Adapters.SQL.Sandbox"
    url: https://hexdocs.pm/ecto_sql/Ecto.Adapters.SQL.Sandbox.html
    note: "les modes manual et shared, checkout et allow"
  - titre: "ExUnit.Callbacks — start_supervised/2"
    url: https://hexdocs.pm/ex_unit/ExUnit.Callbacks.html
  - titre: "Mox"
    url: https://hexdocs.pm/mox/Mox.html
    note: "modes privé et global, et leur rapport à async"
---

Dans la plupart des langages, faire tourner une suite de tests en parallèle contre une base de données relève de l'acrobatie : bases séparées, schémas dédiés, verrous, nettoyage entre chaque test. Beaucoup d'équipes y renoncent.

En Elixir, on écrit `async: true` et ça marche. Il vaut la peine de comprendre pourquoi — parce que les raisons qui le rendent possible dessinent aussi précisément l'endroit où il cesse de vous protéger.

<!--more-->

## Pourquoi la concurrence est envisageable

Deux tests qui tournent ensemble ne se marchent dessus que s'ils partagent quelque chose de modifiable. En Elixir, il n'y a presque rien à partager : pas de variable globale, pas d'objet mutable, pas de singleton. Chaque test vit dans son processus, avec son propre tas.

Reste exactement une ressource commune, et elle est de taille : **la base de données.**

C'est là qu'intervient la sandbox.

## Ce que fait vraiment la sandbox

Le principe est plus simple qu'il n'en a l'air. Chaque test **emprunte** une connexion, et la sandbox l'enveloppe dans une transaction. À la fin du test, la transaction est annulée.

{% raw %}
```elixir
# config/test.exs
config :mon_app, MonApp.Repo, pool: Ecto.Adapters.SQL.Sandbox

# test/support/data_case.ex
setup tags do
  pid = Ecto.Adapters.SQL.Sandbox.start_owner!(MonApp.Repo, shared: not tags[:async])
  on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  :ok
end
```
{% endraw %}

Deux tests concurrents travaillent donc sur deux connexions différentes, chacune dans sa transaction non validée. Aucun ne voit ce que l'autre écrit, et personne ne nettoie quoi que ce soit : le `ROLLBACK` s'en charge.

C'est élégant, et c'est aussi la source des trois pièges qui suivent.

## Piège 1 — les autres processus n'ont pas la connexion

En mode `:manual`, un processus qui n'a pas emprunté de connexion n'a pas accès à la base. Or votre code en démarre : une tâche, un `GenServer`, un travailleur Oban.

Il faut leur en donner explicitement le droit :

{% raw %}
```elixir
parent = self()

tache =
  Task.async(fn ->
    # En PREMIÈRE ligne de la tâche : autoriser depuis l'extérieur créerait
    # une course, Task.async démarrant l'exécution immédiatement.
    Ecto.Adapters.SQL.Sandbox.allow(MonApp.Repo, parent, self())
    MonApp.Comptes.compter()
  end)

Task.await(tache)
```
{% endraw %}

L'ordre compte. Écrire `Sandbox.allow(...)` **après** le `Task.async` semble naturel et fonctionne la plupart du temps — jusqu'au jour où la tâche atteint la requête avant que l'autorisation soit posée. On obtient alors un test rouge par intermittence, le pire genre.

Sans ce `allow/3`, la tâche échoue sur une erreur de propriété — un message déroutant la première fois, qui n'a rien à voir avec votre requête.

L'autre solution est le mode `:shared`, où tous les processus se partagent la connexion du test. Il est plus commode, et la documentation en donne le prix sans détour :

> The downside is that tests can no longer run concurrently in shared mode.

D'où le `shared: not tags[:async]` du `setup` ci-dessus : les tests synchrones prennent le confort, les tests concurrents gardent l'isolation.

## Piège 2 — tout se passe dans une transaction jamais validée

Celui-là est le plus coûteux, parce qu'il produit un test **vert** sur du code **faux**.

Dans la sandbox, votre test et le code testé vivent dans la même transaction ouverte. Rien n'est jamais validé. Or plusieurs comportements de PostgreSQL ne se manifestent qu'**au COMMIT** — et vos tests ne l'atteignent jamais.

Le cas typique : du code qui écrit en base puis diffuse une notification, laquelle déclenche ailleurs une relecture de la donnée.

{% raw %}
```elixir
Repo.transaction(fn ->
  {:ok, commande} = Repo.insert(changeset)
  # Diffusé AVANT le COMMIT : c'est le bug.
  Phoenix.PubSub.broadcast(MonApp.PubSub, "commandes", {:creee, commande.id})
end)
```
{% endraw %}

En production, l'abonné reçoit le message, relit la commande **depuis une autre connexion**, et ne la trouve pas : elle n'est pas encore validée.

En test, il n'y a plus de frontière à franchir. Si la relecture a lieu dans le processus de test — le cas le plus courant — elle se fait dans la transaction ouverte, et trouve une commande que personne n'a encore validée. La relecture réussit, et le test passe.

Une précision qui découle du piège précédent : en mode `:shared`, tous les processus partagent cette connexion, donc le problème est masqué même quand l'abonné est ailleurs. En `async: true`, un abonné dans un autre processus obtiendrait plutôt une erreur de propriété — le test échouerait bruyamment, ce qui est préférable mais pour la mauvaise raison.

**Dans le cas courant, le test ne peut pas voir ce bug**, parce que la sandbox supprime précisément la frontière qui le révèle. Un test vert n'est pas une preuve que le code est bon ; c'est une preuve qu'il se comporte bien dans les conditions du test.

La parade est de diffuser **après** le commit — et pas dans une étape de `Multi`, car il n'y en a aucune qui s'exécute hors transaction : `Multi.run/3` compris, tout se déroule à l'intérieur de celle qu'ouvre `Repo.transaction/2`.

{% raw %}
```elixir
resultat =
  Multi.new()
  |> Multi.insert(:commande, changeset)
  |> Repo.transaction()

# Ici seulement : la transaction est validée, la donnée est visible de tous.
with {:ok, %{commande: commande}} <- resultat do
  Phoenix.PubSub.broadcast(MonApp.PubSub, "commandes", {:creee, commande.id})
  {:ok, commande}
end
```
{% endraw %}

Et il faut savoir que la vérification, elle, devra être faite autrement que par un test unitaire.

## Piège 3 — Mox en mode global interdit la concurrence

Mox fonctionne par défaut en mode **privé** : les attentes posées dans un test ne valent que pour son processus, et il faut un `allow/3` pour les partager. C'est ce qui le rend compatible avec `async: true`.

Le mode **global** rend les attentes visibles de tous les processus. Plus commode quand le code sous test démarre des processus qu'on ne contrôle pas — et la documentation est catégorique :

> An ExUnit case where tests use Mox in global mode cannot be `async: true`.

C'est la même mécanique que pour la sandbox : dès qu'on partage un état entre processus, on renonce à la concurrence. Le confort se paie en temps de suite.

## Un outil sous-utilisé : `start_supervised/1`

Quand un test démarre un processus, la question est toujours : qui l'arrête ? Un `start_link` dans un test laisse un processus derrière lui, qui polluera le test suivant.

`start_supervised/1` le place sous le superviseur du test, avec une garantie que la documentation énonce ainsi :

> The advantage of starting a process under the test supervisor is that it is guaranteed to exit before the next test starts.

{% raw %}
```elixir
test "le cache répond" do
  pid = start_supervised!({MonApp.Cache, nom: :test})
  assert MonApp.Cache.recuperer(pid, :cle) == nil
end
```
{% endraw %}

Aucun nettoyage à écrire. Et les processus sont arrêtés dans l'ordre inverse de leur démarrage, ce qui évite qu'un enfant survive à ce dont il dépend.

## Ce que vos tests ne prouvent pas

Deux limites à garder en tête, en plus des trois pièges.

**Un test qui passe dans la sandbox ne dit rien du comportement transactionnel réel.** C'est le piège 2, et il mérite d'être répété : ce que vous validez, c'est le code dans des conditions où la frontière entre connexions n'existe pas.

**Un test LiveView ne passe pas par un navigateur.** Dans leur forme fondée sur la vue, `render_click` et `render_change` envoient l'événement directement au processus. Ils prouvent que votre `handle_event` fonctionne, pas qu'un utilisateur peut le déclencher — c'est le sujet d'[un précédent article]({{ "/articles/pannes-silencieuses-liveview/" | relative_url }}).

## En résumé

`async: true` fonctionne en Elixir parce qu'il n'y a presque rien à partager entre processus, et parce que la sandbox transforme la seule ressource commune — la base — en une ressource privée par test.

Les trois limites découlent toutes du même mécanisme. Un processus tiers n'a pas la connexion, sauf autorisation explicite. Le mode partagé et Mox global rendent la commodité contre la concurrence. Et surtout, la transaction jamais validée efface une frontière qui existe en production.

Cette dernière est la seule qui produise un test vert sur du code faux. C'est celle qu'il faut connaître par cœur.
