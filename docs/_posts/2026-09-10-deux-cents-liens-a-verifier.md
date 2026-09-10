---
layout: post
title: "Deux cents liens à vérifier"
date: 2026-09-10 15:30:00 +0200
lang: fr
description: "Un dépôt de documentation contient beaucoup de liens, et personne ne les surveille. C'est une bonne occasion de découvrir Req en construisant quelque chose : un vérificateur de liens d'une vingtaine de lignes, et trois problèmes en chemin qui font apparaître ce que la bibliothèque sait déjà faire."
tags: [elixir, req, http, tests, concurrence]
categories: [elixir]
sources:
  - titre: "Req — documentation"
    url: https://hexdocs.pm/req/Req.html
  - titre: "Req.Request — le pipeline et ses étapes"
    url: https://hexdocs.pm/req/Req.Request.html
  - titre: "Req.Test"
    url: https://hexdocs.pm/req/Req.Test.html
  - titre: "Task.async_stream/3"
    url: https://hexdocs.pm/elixir/Task.html#async_stream/3
---

Un dépôt de documentation vieillit parfois plus vite qu'on ne le pense.

Le code est surveillé par les tests. Les liens, eux, ne le sont généralement pas. Une page disparaît, une documentation change d'adresse, un projet est renommé, et personne ne s'en aperçoit avant qu'un lecteur ne tombe dessus.

Ce dépôt contient plus de deux cents liens. C'est une bonne occasion d'écrire un petit outil pour les vérifier.

L'outil terminé tiendra dans une vingtaine de lignes. Mais avant d'y arriver, trois questions vont se poser :

* que faire d'un `404` ?
* que faire d'une redirection ?
* que faire d'un serveur temporairement indisponible ?

À chaque fois, on découvrira une partie de ce que [Req](https://hexdocs.pm/req/Req.html) sait déjà faire.

Une fois le vérificateur en état de marche, on pourra aller un peu plus loin : mesurer les temps de réponse, lancer les vérifications en parallèle, et surtout les tester sans faire le moindre appel sur internet.

L'idée n'est donc pas de passer en revue toutes les fonctionnalités de Req, mais de le découvrir en construisant quelque chose.

Tout ce qui suit a été exécuté avec Req 0.7.4 et Elixir 1.19.5.

<!--more-->

## Commençons simplement

Pour utiliser Req dans un petit script Elixir :

{% raw %}
```elixir
Mix.install([{:req, "~> 0.7.4"}])
```
{% endraw %}

Puis :

{% raw %}
```elixir
Req.get!("https://elixir-lang.org").status
#=> 200
```
{% endraw %}

C'est tout.

Pas de client à démarrer, pas de processus à superviser, pas de configuration particulière avant de faire une première requête.

Notre vérificateur peut donc partir de quelque chose d'aussi simple :

{% raw %}
```elixir
def verifier(url) do
  reponse = Req.get!(url)

  %{lien: url, statut: reponse.status}
end
```
{% endraw %}

On pourrait maintenant parcourir nos deux cents liens et considérer l'affaire réglée. Ce serait dommage, car c'est justement en faisant tourner ce bout de code que les choses deviennent intéressantes.

## Premier problème : un lien mort ne plante pas

Prenons un lien qui n'existe plus :

{% raw %}
```
/mort -> 404
```
{% endraw %}

On pourrait s'attendre à ce que `Req.get!` lève une exception. Ce n'est pas ce qui se passe.

Le `!` de `Req.get!` concerne les erreurs de transport. Un serveur qui répond `404` a bien répondu : la connexion a fonctionné, et une réponse HTTP est arrivée.

Pour notre vérificateur, c'est exactement le comportement souhaité. Un lien cassé doit produire un résultat, pas interrompre la vérification des 199 suivants.

Il suffit donc de regarder le statut :

{% raw %}
```elixir
verdict =
  if reponse.status < 400 do
    "vivant"
  else
    "MORT"
  end
```
{% endraw %}

Premier problème réglé. Un autre nous attend.

## Deuxième problème : le lien a déménagé

Cette fois, le serveur répond `302` en indiquant une nouvelle adresse. Pourtant, voici ce que notre code reçoit :

{% raw %}
```
[debug] redirecting to /ok
/deplace -> 200
```
{% endraw %}

Req a suivi la redirection tout seul, et il l'a écrit dans les journaux. Cette ligne de `debug` ne vient pas de nous.

C'est un petit détail, mais il dit quelque chose d'intéressant sur la bibliothèque : beaucoup de comportements utiles sont déjà présents, et ils laissent une trace quand ils se déclenchent.

Pour un outil qui vérifie des liens, c'est encore ce qu'on veut. Une URL qui redirige vers une page valide n'est pas un lien mort.

Reste une dernière situation, moins évidente.

## Troisième problème : le serveur est simplement indisponible

Imaginons un serveur qui répond deux fois `503` avant de fonctionner. Req réessaie de lui-même :

{% raw %}
```
[warning] retry: got response with status 503, will retry in 5ms, 3 attempts left
[warning] retry: got response with status 503, will retry in 5ms, 2 attempts left
/capricieux -> 200 après 3 appels
```
{% endraw %}

Le serveur a reçu trois appels, notre code n'a vu qu'une réponse, et nous n'avons rien eu à gérer.

Pour une simple lecture, c'est très pratique : une panne passagère ne transforme pas un lien valide en faux positif. Mais ce comportement mérite un peu d'attention.

### Les nouvelles tentatives ne sont pas gratuites

Imaginons maintenant que la requête soit un `POST` qui déclenche un paiement.

Si la connexion échoue après que le serveur a reçu la demande, il est impossible de savoir ce qui s'est réellement produit de son côté. Réessayer peut alors provoquer une seconde opération.

Dans ce cas, je désactive explicitement les nouvelles tentatives :

{% raw %}
```elixir
Req.post!(url, json: paiement, retry: false)
```
{% endraw %}

Cela vaut aussi pour les erreurs de transport, que Req réessaie également :

{% raw %}
```
[warning] retry: got exception, will retry in 3762ms, 1 attempt left
[warning] ** (Req.TransportError) connection refused
```
{% endraw %}

Pour une opération non idempotente, ce comportement demande donc beaucoup plus d'attention que pour un simple `GET`.

## Mais comment Req fait-il tout cela ?

Nous avons rencontré trois comportements : les nouvelles tentatives, les redirections, et le décodage de la réponse. Plutôt que d'y voir de la magie, regardons ce qui se passe réellement.

Une requête Req traverse une suite d'étapes, et ces étapes peuvent être affichées :

{% raw %}
```elixir
Req.new().response_steps
|> Enum.map(&elem(&1, 0))
```
{% endraw %}

{% raw %}
```
[:retry, :handle_http_errors, :redirect, :http_digest,
 :decompress_body, :verify_checksum, :decode_body]
```
{% endraw %}

Les trois comportements que nous venons de croiser sont bien là, nommés. Et ce n'est pas seulement la réponse qui est traitée ainsi : Req organise tout son travail en trois groupes d'étapes.

| Moment | Étapes |
|---|---|
| Requête (12) | `put_user_agent`, `compressed`, `encode_body`, `put_base_url`, `auth`, `put_params`, `put_path_params`, `put_range`, `cache`, `compress_body`, `checksum`, `put_aws_sigv4` |
| Réponse (7) | `retry`, `handle_http_errors`, `redirect`, `http_digest`, `decompress_body`, `verify_checksum`, `decode_body` |
| Erreur (1) | `retry` |

L'ordre a son importance, et il se lit. `retry` vient en premier parmi les étapes de réponse, car elle doit voir le statut avant que quoi que ce soit ne touche au corps. `decode_body` vient en dernier, sur un corps déjà décompressé et vérifié.

L'intérêt de cette organisation apparaît surtout quand on veut ajouter son propre comportement.

## Ajouter une étape

Notre vérificateur pourrait mesurer le temps de réponse de chaque lien.

On enregistre l'heure de départ dans les données privées de la requête :

{% raw %}
```elixir
depart = fn requete ->
  Req.Request.put_private(
    requete,
    :t0,
    System.monotonic_time(:microsecond)
  )
end
```
{% endraw %}

Puis on calcule la durée à l'arrivée de la réponse :

{% raw %}
```elixir
arrivee = fn {requete, reponse} ->
  ms = (System.monotonic_time(:microsecond) - requete.private.t0) / 1000

  {requete, Req.Response.put_private(reponse, :duree_ms, Float.round(ms, 1))}
end
```
{% endraw %}

Il reste à ajouter ces deux étapes au client :

{% raw %}
```elixir
client =
  Req.new()
  |> Req.Request.append_request_steps(depart: depart)
  |> Req.Request.append_response_steps(arrivee: arrivee)
```
{% endraw %}

{% raw %}
```
/lent -> 200 en 50.9 ms
```
{% endraw %}

Ce qui est intéressant ici n'est pas la mesure elle-même.

Nous venons de modifier le comportement de toutes les requêtes de ce client sans écrire d'enveloppe autour de Req et sans introduire d'abstraction. Le client reste une valeur que l'on construit, que l'on modifie et que l'on passe à une fonction.

On choisit aussi où l'étape intervient. `append` l'ajoute à la fin, `prepend` la place avant les étapes existantes : c'est ainsi qu'on observe une requête avant `decode_body`, quand on veut voir le corps brut.

## Deux cents liens, mais pas deux cents attentes successives

Notre vérificateur fonctionne. Reste un problème assez visible : nous avons deux cents URL à tester, et les vérifier une par une revient à attendre chaque réponse avant de passer à la suivante.

{% raw %}
```
max_concurrency: 1 -> 10 208 ms
```
{% endraw %}

Or notre programme ne calcule presque rien. Il attend le réseau. C'est un bon cas pour la concurrence légère de la BEAM :

{% raw %}
```elixir
liens
|> Task.async_stream(&verifier/1, max_concurrency: 8, timeout: 30_000)
|> Enum.map(fn {:ok, resultat} -> resultat end)
```
{% endraw %}

Avec mon jeu d'essai :

| `max_concurrency` | Durée |
|---:|---:|
| 1 | 10 208 ms |
| 8 | 1 277 ms |
| 50 | **208 ms** |

La différence est nette. Mais il serait dommage de ne voir dans `max_concurrency` qu'un réglage de performance.

## La concurrence est surtout une question de politesse

Sans limite, deux cents liens deviennent deux cents requêtes simultanées. Si une bonne partie d'entre eux pointe vers le même serveur, nous venons de lui envoyer une charge importante simplement parce que nous voulions vérifier quelques adresses.

Ce serveur peut répondre `429`, ralentir, ou bloquer notre adresse IP. Notre outil conclurait alors que beaucoup de liens sont morts, alors que c'est lui qui vient de créer le problème.

`max_concurrency` règle donc la politesse autant que la vitesse.

Sa valeur par défaut est le nombre de cœurs de la machine, huit sur la mienne. Elle décrit notre processeur, et n'a aucun rapport avec ce que le service distant accepte : c'est dans sa documentation à lui qu'on trouve la bonne valeur.

Le `timeout` mérite la même attention. Il vaut cinq secondes par défaut et s'applique à chaque élément, ce qu'une API lente dépasse sans peine. Dans un traitement par lots, un élément trop lent gagne à devenir un résultat parmi les autres plutôt qu'à faire tomber toute l'opération :

{% raw %}
```elixir
Task.async_stream(liens, &verifier/1,
  max_concurrency: 50,
  timeout: 5_000,
  on_timeout: :kill_task
)
```
{% endraw %}

Avec `on_timeout: :kill_task`, le dépassement arrive dans le flux sous la forme d'un `{:exit, :timeout}` que l'on filtre. Sans lui, un seul lien lent interrompt la vérification entière.

## Et comment tester tout cela sans internet ?

Il reste une dernière question : nous aimerions faire tourner ce vérificateur en intégration continue.

Tester directement contre internet serait une mauvaise idée, car un test peut échouer parce qu'un site distant est indisponible ou qu'une adresse a changé. On pourrait remplacer Req par un simulacre, mais ce n'est pas nécessaire.

Req fournit `Req.Test`, auquel on donne un *plug* qui joue le rôle d'un internet miniature :

{% raw %}
```elixir
Req.Test.stub(FauxInternet, fn conn ->
  case conn.request_path do
    "/vivant" -> Req.Test.json(conn, %{ok: true})
    "/mort" -> Plug.Conn.send_resp(conn, 404, "")
    "/coupure" -> Req.Test.transport_error(conn, :econnrefused)
  end
end)
```
{% endraw %}

Puis on utilise ce faux réseau :

{% raw %}
```elixir
Req.get!("https://exemple.test/vivant", plug: {Req.Test, FauxInternet})
```
{% endraw %}

Le point intéressant est que nous ne remplaçons pas le comportement de Req. La requête traverse toujours ses étapes habituelles, et seule la couche réseau change. Le test porte donc bien sur le code qui tournera en production, ce qu'un simulacre ne garantit pas.

On peut ainsi éprouver tous les cas qui nous intéressent : une réponse normale, un `404`, une redirection, une erreur de transport, une nouvelle tentative, un décodage. Y compris la coupure réseau, que l'on ne teste presque jamais et qui pose pourtant des problèmes bien réels.

C'est d'ailleurs ainsi que j'ai produit toutes les mesures de cet article : aucun appel réseau n'était nécessaire.

## Dans un vrai projet

Après avoir utilisé Req de cette manière, je garderais une règle simple : éviter de disperser des `Req.get!` un peu partout dans le code métier.

Pour chaque API distante, je préfère un module dédié qui construit son client avec les paramètres communs.

{% raw %}
```elixir
defmodule MonApp.Facturation do
  defp client do
    Req.new(
      base_url: "https://api.facturation.test",
      auth: {:bearer, Application.fetch_env!(:mon_app, :jeton_facturation)},
      receive_timeout: 10_000
    )
    |> Req.merge(Application.get_env(:mon_app, :options_req, []))
  end

  def facture(id) do
    Req.get!(client(), url: "/factures/#{id}").body
  end

  def payer(id, params) do
    Req.post!(client(), url: "/factures/#{id}/paiement", json: params, retry: false)
  end
end
```
{% endraw %}

La dernière ligne de `client/0` est le point intéressant. En configuration de test, `:options_req` reçoit `[plug: {Req.Test, MonApp.Facturation}]`, et reste vide en production. Il n'y a donc pas d'abstraction à introduire uniquement pour pouvoir tester l'HTTP : on configure simplement Req différemment.

Deux détails complètent ce module. L'option `retry: false` figure sur `payer/2` et non sur `facture/1`, pour la raison vue plus haut. Et `receive_timeout` fixe le délai d'attente de la réponse, dont la valeur par défaut est généreuse : une API qui ne répond plus finit par remonter jusqu'à nous, et le fixer relève de l'hygiène.

Enfin, il n'y a aucun client Req à placer dans l'arbre de supervision. C'est une question fréquente quand on vient d'ailleurs, et la réponse est qu'il n'y a rien à démarrer.

## Ce que je retiens de Req

En partant d'un problème très concret, on aura rencontré pas mal de choses :

* `Req.get!` permet de faire une requête HTTP sans infrastructure particulière ;
* un `404` est une réponse HTTP, pas une erreur de transport ;
* les redirections et les nouvelles tentatives font partie du traitement, et laissent une trace dans les journaux ;
* ce traitement est une suite d'étapes que l'on peut afficher, puis étendre avec les siennes ;
* `Task.async_stream/3` traite un grand nombre de requêtes efficacement, à condition de choisir `max_concurrency` en pensant au serveur d'en face ;
* `Req.Test` permet d'éprouver toute la chaîne sans dépendre d'internet.

C'est probablement ce qui me plaît le plus dans cette bibliothèque : on commence très simplement, puis on descend dans les détails quand le problème le demande.

Pour vérifier deux cents liens, deux lignes suffisent. Et si le besoin devient plus sérieux, on découvre qu'il y avait déjà beaucoup de mécanismes derrière ces deux lignes, sans avoir eu à les mettre en place soi-même.

C'est une assez bonne raison d'essayer Req avant d'écrire son propre client HTTP.
