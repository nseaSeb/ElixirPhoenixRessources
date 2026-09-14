---
layout: post
title: "Qui est là ? Découvrir Phoenix.Presence"
date: 2026-09-14 10:30:00 +0200
lang: fr
description: "Afficher « trois personnes regardent ce document » semble demander une base, un cache et une ronde de nettoyage. Avec Phoenix.Presence, c'est une dizaine de lignes dans une LiveView, et les départs, même brutaux, sont détectés sans qu'on écrive une ligne pour eux. Une découverte guidée, avec un notebook pour la rejouer."
tags: [phoenix, liveview, presence, pubsub, temps-reel]
categories: [phoenix]
sources:
  - titre: "Phoenix.Presence — documentation"
    url: https://hexdocs.pm/phoenix/Phoenix.Presence.html
  - titre: "Phoenix.Tracker — le mécanisme sous-jacent"
    url: https://hexdocs.pm/phoenix_pubsub/Phoenix.Tracker.html
  - titre: "Phoenix.PubSub"
    url: https://hexdocs.pm/phoenix_pubsub/Phoenix.PubSub.html
  - titre: "Phoenix.LiveViewTest"
    url: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveViewTest.html
---

Il y a une petite fonctionnalité que tout le monde reconnaît : les avatars en haut d'un document partagé, qui disent qui est en train de le lire en même temps que vous.

Elle paraît simple. Puis on réfléchit à la façon de la construire, et les questions arrivent. Où garder la liste ? Comment savoir qu'une personne est partie si son navigateur a planté ? Et si elle a ouvert deux onglets ? Et si l'application tourne sur deux serveurs ?

Phoenix a une réponse à tout cela, et elle tient dans un module : `Phoenix.Presence`. Cet article le découvre en construisant cette fonctionnalité dans une page LiveView, et en la testant à chaque étape.

Trois pièces se partagent le travail, et il vaut mieux savoir dès le départ qui fait quoi :

| Besoin | Responsable |
|---|---|
| Envoyer un message à tous ceux qui écoutent un sujet | `Phoenix.PubSub` |
| Savoir qui est là, maintenant, sur ce sujet | `Phoenix.Presence` |
| Afficher la liste et la redessiner quand elle change | la LiveView |

En chemin, quatre questions vont se poser :

* comment un départ est-il détecté, quand personne ne dit au revoir ?
* comment une même personne avec deux onglets ne compte-t-elle qu'une fois ?
* comment afficher un nom sans faire une requête par personne ?
* que se passe-t-il quand l'application tourne sur plusieurs serveurs ?

Tout ce qui suit a été exécuté avec Phoenix 1.8.14, LiveView 1.1.33 et Elixir 1.19.5. Les extraits de test sont ceux d'un seul test, présenté morceau par morceau dans l'ordre où il s'exécute, et les structures affichées sont celles qu'il a réellement produites.

<!--more-->

## Une première version qui tient en quelques lignes

Le module Presence se déclare une fois pour toute l'application. Il a besoin de savoir quel PubSub utiliser, et c'est tout :

{% raw %}
```elixir
defmodule MonAppWeb.Presence do
  use Phoenix.Presence,
    otp_app: :mon_app,
    pubsub_server: MonApp.PubSub
end
```
{% endraw %}

On l'ajoute à l'arbre de supervision, après le PubSub dont il dépend et avant l'endpoint qui va s'en servir :

{% raw %}
```elixir
children = [
  {Phoenix.PubSub, name: MonApp.PubSub},
  MonAppWeb.Presence,
  MonAppWeb.Endpoint
]
```
{% endraw %}

Vient ensuite la page. Chaque personne qui ouvre le document arrive avec un prénom, et la page affiche qui est là :

{% raw %}
```elixir
defmodule MonAppWeb.DocumentLive do
  use MonAppWeb, :live_view

  alias MonAppWeb.Presence

  @topic "document:42"

  def mount(%{"prenom" => prenom}, _session, socket) do
    if connected?(socket) do
      # 1. s'abonner aux changements ; 2. se déclarer présent ; le reste est automatique
      Phoenix.PubSub.subscribe(MonApp.PubSub, @topic)
      {:ok, _ref} = Presence.track(self(), @topic, prenom, %{depuis: System.system_time(:second)})
    end

    {:ok, assign(socket, prenom: prenom, presents: Presence.list(@topic))}
  end

  # à chaque arrivée ou départ, on relit la liste et on redessine
  def handle_info(%Phoenix.Socket.Broadcast{event: "presence_diff"}, socket) do
    {:noreply, assign(socket, presents: Presence.list(@topic))}
  end

  def render(assigns) do
    ~H"""
    <p id="compteur">{map_size(@presents)} personne(s) sur ce document</p>
    <ul id="presents">
      <li :for={{cle, %{metas: metas}} <- @presents} id={"present-#{cle}"}>
        {cle} ({length(metas)} onglet(s))
      </li>
    </ul>
    """
  end
end
```
{% endraw %}

Côté LiveView, trois appels suffisent pour commencer.

`Presence.track/4` déclare le processus courant, c'est-à-dire cette LiveView, comme présent sur le sujet `"document:42"`, sous la clé `prenom`, avec une petite carte de métadonnées. La clé est une chaîne. Dans cet article c'est un prénom, pour que les pages se lisent ; dans un vrai projet, ce sera l'identifiant de l'utilisateur.

`Presence.list/1` rend tout ce qui est présent sur le sujet, sous la forme d'une carte dont les clés sont les prénoms.

Et l'abonnement PubSub fait arriver, dans `handle_info`, un message à chaque changement. Je ne cherche pas à appliquer ce changement finement : je relis la liste et je laisse LiveView calculer ce qui a bougé.

Le `if connected?(socket)` mérite un mot. Une LiveView est rendue deux fois, une première fois pour la réponse HTTP classique, puis une seconde quand la connexion temps réel est établie. Seule la seconde correspond à une vraie présence. Sans cette garde, chaque visite compterait brièvement double.

Le trajet complet tient sur un dessin :

{% raw %}
```
  Alice ouvre la page        Bob ouvre la page
          |                          |
          |  track("alice")          |  track("bob")
          v                          v
     +-------------------------------------+
     |    Presence, sujet "document:42"    |
     +-------------------------------------+
                      |
                      |  presence_diff
           +----------+----------+
           v                     v
    LiveView d'Alice       LiveView de Bob
       redessine              redessine
```
{% endraw %}

## Tout ce qu'une autre page voit passe par un message

Avant d'écrire le test, une règle qui va tout simplifier.

Quand Bob arrive, sa propre LiveView voit la présence immédiatement : `track` ne rend la main qu'une fois la présence enregistrée, et la liste lue juste après le contient. Mais la page d'Alice, elle, n'apprend l'arrivée de Bob que par le message de changement, qui est diffusé un instant plus tard, après que Presence a préparé les données. Il en va de même pour un départ.

Un test qui relit la page d'Alice tout de suite après l'arrivée de Bob peut donc la trouver encore à « 1 personne ». Plutôt que d'attendre un délai arbitraire, le test fait ce que fait la LiveView : il s'abonne au sujet et attend le message. Cela se règle une fois pour toutes dans le `setup` :

{% raw %}
```elixir
setup do
  # tout ce qu'une autre page voit passe par un diff : le test s'abonne et l'attend
  Phoenix.PubSub.subscribe(MonApp.PubSub, "document:42")
  :ok
end
```
{% endraw %}

Recevoir ce message prouve une chose précise : Presence a enregistré le changement. Cela ne prouve pas encore que la page d'Alice l'a affiché, car son processus à elle reçoit le même message de son côté, et rien ne dit lequel de nous deux le traitera en premier.

Il y a donc deux niveaux d'affirmation, et il vaut mieux ne pas les confondre. Ce que Presence garantit se vérifie sèchement, par le message et par la liste. Ce qu'une autre page affiche se vérifie en relisant jusqu'à ce que ce soit le cas :

{% raw %}
```elixir
# la page d'une autre personne se met à jour un instant après le diff : on relit jusqu'à
defp attendre_rendu(vue, attendu, restant \\ 20) do
  html = render(vue)

  cond do
    html =~ attendu -> html
    restant == 0 -> flunk("rendu jamais obtenu : " <> attendu)
    true -> Process.sleep(25) && attendre_rendu(vue, attendu, restant - 1)
  end
end
```
{% endraw %}

Le test suit alors les arrivées pas à pas :

{% raw %}
```elixir
{:ok, alice, html} = live(conn, "/document?prenom=alice")
assert html =~ "1 personne(s) sur ce document"

{:ok, bob, _html} = live(build_conn(), "/document?prenom=bob")
assert_receive %Phoenix.Socket.Broadcast{event: "presence_diff", payload: %{joins: %{"bob" => _}}}, 2000
assert map_size(Presence.list(@topic)) == 2
attendre_rendu(alice, "Bob Nguyen (1 onglet(s))")
```
{% endraw %}

La page d'Alice s'est mise à jour toute seule quand Bob est arrivé. Nous n'avons écrit aucun compteur, aucune table, aucun cache.

Cette distinction n'est pas une coquetterie. Une première version de ce test affirmait directement `render(alice)` après le message, et elle passait dix fois sur dix. En ralentissant `fetch/2` de cent cinquante millisecondes, elle échoue à tous les coups. La version ci-dessus, elle, passe dans les deux cas.

## Deux onglets ne font qu'une personne

Alice ouvre le même document dans un second onglet. C'est une seconde LiveView, donc un second processus, qui appelle `track` avec la même clé.

Presence ne crée pas de doublon : il regroupe les deux présences sous une seule entrée, dont la liste `metas` compte maintenant deux éléments. Voici ce que rend `Presence.list("document:42")` à ce moment du test :

{% raw %}
```elixir
%{
  "alice" => %{
    metas: [
      %{phx_ref: "GNUwiIdZbCqa3gDi", depuis: 1789389789},
      %{phx_ref: "GNUwiIfWWpaa3gHi", depuis: 1789389789}
    ]
  },
  "bob" => %{metas: [%{phx_ref: "GNUwiId9uHya3gFi", depuis: 1789389789}]}
}
```
{% endraw %}

Chaque élément de `metas` est la carte passée à `track`, augmentée d'un `phx_ref` que Presence ajoute pour identifier cette connexion précise.

Un compteur « personnes présentes » compte donc les clés, et un compteur « connexions ouvertes » additionne les `metas`. Notre page affiche les deux, et le test continue :

{% raw %}
```elixir
{:ok, _alice_bis, _html} = live(build_conn(), "/document?prenom=alice")
assert %{"alice" => %{metas: [_, _]}} = Presence.list(@topic)

attendre_rendu(bob, "alice (2 onglet(s))")
assert render(bob) =~ "2 personne(s) sur ce document"
```
{% endraw %}

Quand Alice fermera l'un des deux onglets, elle restera présente avec une seule connexion. Elle ne disparaîtra qu'à la fermeture du dernier.

> À ce stade, Alice a deux onglets ouverts.
> Pour notre application, cela fait une personne.
> Pour Phoenix, cela fait deux connexions.
> Presence tient les deux comptes, et c'est nous qui choisissons lequel afficher.


Une dernière précision sur ce regroupement : un même processus ne peut pas se déclarer deux fois sous la même clé. Presence refuse avec un `{:error, {:already_tracked, pid, topic, cle}}`, ce qui évite les présences fantômes qu'un `mount` appelé deux fois pourrait créer.

## Un départ est détecté sans que personne ne dise au revoir

C'est ici que Presence devient vraiment intéressant.

On pourrait s'attendre à devoir gérer le départ : un `terminate/2` qui envoie « je pars », ou une ronde périodique qui vérifie qui répond encore. Rien de tout cela n'est nécessaire, et il vaut la peine de comprendre pourquoi.

Presence ne suit pas des utilisateurs, il suit des processus. Quand on appelle `track`, il se met à surveiller le processus de la LiveView. Or, dans Phoenix, chaque connexion LiveView est un processus, et ce processus meurt quand la connexion se ferme : onglet fermé, navigateur quitté, page rechargée. Dans tous ces cas, la machine virtuelle sait que le processus n'existe plus, et Presence le sait donc aussi.

La vérité, ce n'est pas un message d'au revoir, c'est la vie du processus.

Une connexion qui se tait sans se fermer, comme un câble arraché ou un ordinateur mis en veille, est un cas un peu différent : le processus vit jusqu'à ce que le transport WebSocket abandonne, soit soixante secondes sans nouvelle par défaut, réglables par l'option `timeout` du `socket` dans l'endpoint. Le départ est alors détecté avec ce délai, mais il l'est, toujours sans qu'on ait rien écrit.

Faisons la chose la plus brutale possible dans le test : tuer la LiveView de Bob sans aucun préavis, et regarder la page d'Alice :

{% raw %}
```elixir
# le mandataire de test lié à la vue de Bob meurt avec elle : on piège ce signal
Process.flag(:trap_exit, true)
Process.exit(bob.pid, :kill)
assert_receive %Phoenix.Socket.Broadcast{event: "presence_diff", payload: %{leaves: %{"bob" => _}}}, 2000
refute Map.has_key?(Presence.list(@topic), "bob")

attendre_rendu(alice, "1 personne(s) sur ce document")
```
{% endraw %}

Bob a disparu de la page d'Alice, et aucune ligne de notre code ne traite le départ. Le test complet, arrivées, second onglet et départ brutal, est passé dix fois sur dix.

La ligne `trap_exit` est une particularité du test, pas de Presence. `Phoenix.LiveViewTest` pilote chaque vue à travers un mandataire lié au processus de test, et tuer la vue tue ce mandataire, qui entraînerait le test dans sa chute. Piéger les signaux de sortie suffit ; dans un navigateur, il n'y a évidemment rien de tel.

## Afficher un nom sans requête par personne

Jusqu'ici la page affiche des clés. Un vrai projet affiche un nom et un avatar, qui vivent en base de données.

La tentation est d'aller chercher l'utilisateur depuis le template, quelque chose comme `Comptes.get_utilisateur!(cle).nom` dans la boucle. Dix personnes présentes, dix requêtes, et une de plus à chaque arrivée ou départ puisque la page se redessine entièrement.

Presence prévoit l'endroit où faire mieux : le rappel `fetch/2`. Il reçoit toutes les clés d'un coup, ce qui transforme les dix requêtes en une seule :


{% raw %}
```elixir
defmodule MonAppWeb.Presence do
  use Phoenix.Presence,
    otp_app: :mon_app,
    pubsub_server: MonApp.PubSub

  # reçoit toutes les clés d'un coup : une requête, quel que soit le nombre de présents
  def fetch(_topic, presences) do
    utilisateurs = presences |> Map.keys() |> Comptes.utilisateurs_par_id()

    for {cle, %{metas: metas}} <- presences, into: %{} do
      # une clé sans utilisateur (compte supprimé entre-temps) garde sa clé comme nom
      nom =
        case utilisateurs[cle] do
          nil -> cle
          utilisateur -> utilisateur.nom
        end

      {cle, %{metas: metas, nom: nom}}
    end
  end
end
```
{% endraw %}

Deux règles à respecter dans ce rappel.

Garder la clé `metas` telle quelle, et ajouter ce qu'on veut à côté.

Et ne jamais lever, car `fetch/2` est appelé à deux endroits très différents. `list/1` l'exécute directement dans le processus appelant, donc dans la LiveView pendant son `mount` : une exception y fait tomber la page. Sur un changement, il est exécuté dans une tâche liée au tracker du nœud, et deux fois plutôt qu'une, une fois sur les arrivées et une fois sur les départs ; une exception y fait redémarrer le tracker, qui perd sa liste. D'où le `case` sur un utilisateur absent, quatre lignes qui évitent les deux scénarios. Notez au passage que le côté vide de chaque diff provoque un appel avec une liste de clés vide, qu'une requête en base gagne à court-circuiter.

Le template lit alors `nom` au lieu de la clé :

{% raw %}
```elixir
<li :for={{cle, %{metas: metas, nom: nom}} <- @presents} id={"present-#{cle}"}>
  {nom} ({length(metas)} onglet(s))
</li>
```
{% endraw %}

Avec un annuaire de test qui associe « alice » à « Alice Martin », les assertions du test portent désormais sur les noms, « Alice Martin (2 onglet(s)) », et la boucle d'affichage n'a toujours pas touché la base.

Cela dit aussi ce qu'il faut mettre dans les métadonnées de `track` : peu de choses. Un statut, un horodatage, le nom de l'appareil. Ces cartes sont répliquées à chaque changement, et tout ce qui peut se retrouver par la clé n'a rien à y faire.

## Ce qu'un abonné reçoit exactement

Notre `handle_info` se contente de réagir au message, mais il est utile de voir ce qu'il contient. Voici, tel que le test l'a reçu, le message diffusé à l'arrivée de Bob, une fois `fetch/2` en place :

{% raw %}
```elixir
%Phoenix.Socket.Broadcast{
  topic: "document:42",
  event: "presence_diff",
  payload: %{
    joins: %{
      "bob" => %{metas: [%{phx_ref: "GNUwiId9uHya3gFi", depuis: 1789389789}], nom: "Bob Nguyen"}
    },
    leaves: %{}
  }
}
```
{% endraw %}

Un *diff* : ce qui arrive, ce qui part, chacun avec ses métadonnées, déjà passées par `fetch/2`. À un départ, `leaves` est rempli et `joins` est vide.

Pour une page LiveView, relire la liste à chaque message reste ma préférence, tant que le sujet compte quelques dizaines de personnes. Le diff prend tout son sens côté JavaScript, avec un client Channels classique : la bibliothèque `phoenix` fournit une classe `Presence` dont `syncState` et `syncDiff` appliquent ces messages à une copie locale de la liste.

## Et avec plusieurs serveurs ?

Jusqu'ici, tout notre problème tenait sur une seule machine. Voyons ce qui change quand plusieurs nœuds Phoenix doivent partager cette information.

C'est la question qui fait d'ordinaire sortir Redis ou une table `sessions_actives` du placard.

Presence n'en a pas besoin. Il repose sur `Phoenix.Tracker`, qui réplique les présences entre les nœuds du cluster à l'aide d'un CRDT, une structure de données conçue pour que chaque nœud puisse être mis à jour indépendamment et que tous convergent vers le même résultat, sans coordinateur ni source de vérité unique.

Les nœuds se signalent les uns aux autres par un battement de cœur, toutes les 1,5 seconde par défaut. Un nœud qui se tait est considéré comme tombé au bout de trente secondes : ses présences sont alors retirées de la liste chez tous les autres, sous forme de départs ordinaires. S'il reparaît, elles reviennent de la même façon. Ces deux délais se règlent dans les options du module Presence, sous les noms `broadcast_period` et `down_period`.

Ce délai de trente secondes vaut aussi pour un arrêt propre, et c'est délibéré. Un nœud qui s'éteint pendant un déploiement laisse ses présences visibles le temps que ses visiteurs se reconnectent ailleurs, ce qui évite une vague de départs immédiatement suivie d'une vague d'arrivées. Si vous préférez l'effet inverse, l'option `permdown_on_shutdown: true` fait disparaître ses présences dès l'arrêt.

Il y a une condition : les nœuds doivent se connaître. C'est le rôle de la distribution Erlang, que `libcluster` ou le `DNSCluster` d'une application Phoenix générée mettent en place. Une fois le cluster formé, le code de cet article fonctionne sans modification.

Une conséquence à garder en tête : la liste des présences vit en mémoire, jamais en base. Si toute l'application redémarre, elle est vide, et se remplit à nouveau dès que les connexions reviennent. C'est le comportement souhaité pour « qui est là maintenant », et ce n'est pas un endroit pour stocker autre chose.

## Lundi matin, dans un vrai projet

Voici où je poserais les choses.

Le module Presence va dans `lib/mon_app_web/presence.ex`, avec son `fetch/2`, et sa place dans l'arbre de supervision est entre le PubSub et l'endpoint. Une seule instance suffit pour toute l'application : c'est le sujet qui sépare les documents, les salons ou les parties.

Les sujets suivent la convention `"type:id"`, comme `"document:42"`. Les clés sont les identifiants d'utilisateur, convertis en chaîne. Les métadonnées restent minuscules.

Dans une LiveView, la séquence est toujours la même dans `mount` : garder `if connected?(socket)`, s'abonner, se déclarer, lire la liste. Puis un `handle_info` sur `"presence_diff"` qui relit la liste. Il n'y a pas de code de départ à écrire, et `untrack` ne sert que dans les cas où l'on veut disparaître de la liste sans fermer la page, par exemple un mode « invisible ».

Dans les tests, quatre habitudes. S'abonner au sujet dans le `setup`, puis attendre le diff avec `assert_receive` et vérifier l'état par `list/1`, à l'arrivée comme au départ ; relire en boucle courte ce qu'affiche la page de quelqu'un d'autre. Donner à chaque test son propre sujet, `"document:#{System.unique_integer([:positive])}"`, car le module Presence est unique pour toute l'application et deux tests sur le même sujet se comptent l'un l'autre. Piéger les signaux de sortie avant de tuer une vue. Et suivre la recommandation de la documentation en attendant, à la fin de chaque test, les processus lancés par `fetch/2` :

{% raw %}
```elixir
on_exit(fn ->
  for pid <- MonAppWeb.Presence.fetchers_pids() do
    ref = Process.monitor(pid)
    assert_receive {:DOWN, ^ref, _, _, _}, 1000
  end
end)
```
{% endraw %}

Enfin, si un jour vous voulez suivre des processus sans diffuser les changements, par exemple pour répartir des tâches entre nœuds, c'est `Phoenix.Tracker` directement qu'il faut regarder. Presence est ce même mécanisme, plus la diffusion et le `fetch/2`.

## Vais-je l'essayer ?

Ce qui me plaît dans Presence, c'est que la partie difficile du problème, savoir qu'une personne est partie, n'a pas eu à être résolue. Elle découle du modèle de Phoenix : une connexion est un processus, un processus qui meurt est un fait que la machine virtuelle connaît, et Presence se contente de l'écouter.

Le reste est du code ordinaire : un `track` au montage, un `handle_info` qui relit une carte, un `fetch/2` pour les noms. Pas d'infrastructure supplémentaire, même sur plusieurs serveurs.

Le notebook qui accompagne cet article rejoue toute l'histoire sans navigateur, avec des processus en guise de visiteurs et une table qui se redessine à chaque clic : [Qui est là ? Phoenix.Presence en direct](https://github.com/nseaSeb/ElixirPhoenixRessources/blob/main/Tips/presence_qui_est_la.livemd).

## À retenir

- Presence suit des processus. Quand celui d'une LiveView meurt, poliment ou non, la présence disparaît sans qu'aucun code de départ soit nécessaire.
- Trois appels dans une LiveView suffisent : `subscribe`, `track/4`, `list/1`, puis un `handle_info` sur `"presence_diff"` qui relit la liste.
- La structure est `%{cle => %{metas: [...]}}` : une clé par personne, un élément de `metas` par connexion, chacun avec son `phx_ref`.
- Sa propre présence est visible dès le retour de `track` ; tout ce qu'une autre page voit passe par un diff asynchrone.
- Recevoir le diff prouve que Presence a enregistré le changement, pas qu'une autre page l'a affiché. Un test affirme sèchement sur le message et sur `list/1`, et relit en boucle courte le rendu d'une page qui ne lui appartient pas.
- Tuer une vue dans `Phoenix.LiveViewTest` tue aussi son mandataire, lié au test : `Process.flag(:trap_exit, true)` avant le `:kill`.
- Un même processus ne peut pas se déclarer deux fois sous la même clé : `{:error, {:already_tracked, ...}}`.
- `fetch/2` enrichit la liste en un seul passage et ne doit jamais lever : `list/1` l'exécute dans la LiveView, un changement l'exécute deux fois dans une tâche liée au tracker. Les métadonnées de `track` restent petites.
- Sur plusieurs serveurs, la réplication est assurée par `Phoenix.Tracker` et son CRDT, sans base ni Redis, dès que les nœuds forment un cluster.
- La liste vit en mémoire : un redémarrage complet la vide, et c'est voulu.
