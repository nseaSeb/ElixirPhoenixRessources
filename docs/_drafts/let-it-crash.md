---
layout: post
title: "« Let it crash » ne veut pas dire ce que vous croyez"
lang: fr
description: "La formule la plus citée d'Elixir est aussi la plus mal comprise. Elle ne dit pas d'ignorer les erreurs : elle dit de séparer le travail de la reprise. Avec ce que ça coûte, mesuré."
tags: [otp, genserver, supervision, elixir]
categories: [elixir]
sources:
  - titre: "GenServer"
    url: https://hexdocs.pm/elixir/GenServer.html
  - titre: "Supervisor"
    url: https://hexdocs.pm/elixir/Supervisor.html
    note: "les stratégies, max_restarts et max_seconds"
  - titre: "Erlang — Design Principles"
    url: https://www.erlang.org/doc/system/design_principles.html
---

Vous avez lu la formule dix fois. On la sort à chaque discussion sur Elixir, souvent en haussant les épaules, comme une excentricité de la BEAM : **« let it crash »**, laissez planter.

Et presque toujours, elle est comprise de travers — comme une permission de ne pas gérer les erreurs. C'est l'inverse.

<!--more-->

## Ce que la formule dit vraiment

Elle ne dit pas « ne gérez pas les erreurs ». Elle dit : **séparez le code qui travaille du code qui décide quoi faire quand ça rate.**

Dans la plupart des langages, les deux sont entrelacés. Chaque fonction attrape ce qu'elle peut, remet une valeur par défaut, journalise, continue tant bien que mal — et vous vous retrouvez avec un objet à moitié initialisé qui traverse trois couches avant de causer un problème ailleurs, quinze minutes plus tard.

Elixir propose autre chose : quand un processus rencontre une situation qu'il ne sait pas décrire, **il meurt**. Un autre processus, dont c'est le seul métier, le remplace par un neuf dans un état connu.

Le pari est là : il est plus simple de raisonner sur un état **frais** que sur un état **abîmé**.

## La démonstration

Un compteur supervisé, qu'on incrémente puis qu'on tue :

{% raw %}
```elixir
{:ok, sup} = Supervisor.start_link([{Compteur, name: :c}], strategy: :one_for_one)

GenServer.cast(:c, :incr)
GenServer.cast(:c, :incr)
GenServer.call(:c, :valeur)
#=> 2

pid_avant = Process.whereis(:c)
Process.exit(pid_avant, :kill)
Process.sleep(50)

Process.whereis(:c) != pid_avant   #=> true  — c'est un autre processus
GenServer.call(:c, :valeur)        #=> 0     — l'état est reparti de zéro
```
{% endraw %}

Le superviseur a fait exactement son travail : il a remplacé un processus mort par un processus vivant, dans l'état que `init/1` définit.

**Et les deux incréments sont perdus.** C'est le point que les explications enthousiastes passent sous silence, et c'est pourtant le cœur du sujet.

## Ce que ça coûte

Trois choses, toutes vérifiables.

### L'état disparaît

C'est ce que la démonstration ci-dessus montre. « Let it crash » ne fonctionne que si l'état perdu **peut être reconstruit** — relu en base, redemandé à un service, recalculé.

Un `GenServer` qui détient la seule copie d'une donnée importante n'est pas un candidat au redémarrage joyeux : c'est un problème de conception qu'on découvrira le jour du crash. La règle pratique : **ce qui doit survivre à un crash ne vit pas dans l'état d'un processus.**

### Le crash emporte celui qui attendait

Un `GenServer.call/2` est synchrone. Si le serveur meurt en traitant la demande, l'appelant ne reçoit pas une erreur qu'il pourrait examiner tranquillement : il reçoit un `exit`, et meurt à son tour s'il ne l'attrape pas.

{% raw %}
```elixir
defmodule Compteur do
  use GenServer
  def start_link(opts), do: GenServer.start_link(__MODULE__, 0, opts)
  def init(n), do: {:ok, n}
  def handle_call(:boum, _from, _n), do: raise("panne métier")
end

{:ok, pid} = GenServer.start(Compteur, 0)

try do
  GenServer.call(pid, :boum)
catch
  # La raison d'un exit provoqué par une exception est un tuple imbriqué :
  # {{exception, pile}, {GenServer, :call, arguments}}. Filtrer sur
  # {raison, _} attraperait la paire {exception, pile}, pas l'exception.
  :exit, {{raison, _pile}, _} -> IO.inspect(raison)
  #=> %RuntimeError{message: "panne métier"}
end
```
{% endraw %}

Le serveur, lui, est redémarré par son superviseur. Mais la requête en cours est perdue, et le processus appelant — souvent un LiveView ou un contrôleur — tombe avec elle. Un crash n'est jamais confiné au seul processus fautif : il se propage à qui l'attendait.

### Trop de crashs tuent l'arbre

Un superviseur n'est pas un ressusciteur infatigable. Il compte les redémarrages, et abandonne :

{% raw %}
```elixir
{:ok, sup} = Supervisor.start_link([{Compteur, name: :c3}],
  strategy: :one_for_one, max_restarts: 2, max_seconds: 5)

# Indispensable pour rejouer ceci dans IEx : start_link lie le superviseur à
# vous. Quand il renonce, il sort en :shutdown et emporte la session avec lui.
Process.unlink(sup)

for i <- 1..3 do
  if Process.alive?(sup) do
    Process.exit(Process.whereis(:c3), :kill)
    Process.sleep(60)
  end
  IO.puts("crash #{i} : superviseur vivant ? #{Process.alive?(sup)}")
end
```
{% endraw %}

```
crash 1 : superviseur vivant ? true
crash 2 : superviseur vivant ? true
crash 3 : superviseur vivant ? false
```

Au-delà de `max_restarts` redémarrages en `max_seconds` secondes, **le superviseur se termine lui-même** — et son propre superviseur applique alors la même logique, un cran plus haut. Une erreur qui se reproduit systématiquement ne tourne donc pas en boucle : elle remonte l'arbre et finit par arrêter l'application.

C'est délibéré et c'est sain. Un service qui redémarre en boucle sans jamais fonctionner est pire qu'un service arrêté : il consomme, il ment aux sondes de santé, et personne ne le remarque. Les valeurs par défaut sont de 3 redémarrages en 5 secondes.

## Ce qui n'est PAS un crash

Voilà la distinction qui manque à toutes les explications rapides, et elle est décisive.

**Une erreur attendue n'est pas un crash.** Un utilisateur introuvable, un formulaire invalide, une adresse mal formée, un service externe qui répond 503 : ce sont des issues **prévues** de votre code. Elles se représentent par des valeurs.

{% raw %}
```elixir
# Attendu : ça fait partie du fonctionnement normal.
case Comptes.recuperer(id) do
  {:ok, utilisateur} -> afficher(utilisateur)
  {:error, :introuvable} -> rediriger_vers_inscription()
end

# Inattendu : cet identifiant DOIT exister à ce stade, sinon c'est un bug.
utilisateur = Comptes.recuperer!(id)
```
{% endraw %}

La convention Elixir rend la frontière visible : `recuperer/1` renvoie un tuple parce que l'échec est un cas normal ; `recuperer!/1` lève parce que l'échec signifierait que le programme se trompe sur lui-même.

**« Let it crash » ne concerne que la seconde catégorie.** Écrire un `try/rescue` autour d'un formulaire invalide n'est pas du Elixir idiomatique — c'est simplement du code qui confond une erreur et un bug.

## Et `terminate/2` ?

On y pense vite : puisqu'un processus meurt, autant nettoyer derrière lui. Mais `terminate/2` n'est pas la porte de sortie qu'on imagine. Mesuré :

```
exception dans un callback   → terminate/2 appelé
GenServer.stop/1             → terminate/2 appelé
Process.exit(pid, :kill)     → terminate/2 PAS appelé
```

Un `:kill` est brutal par définition, et c'est exactement ce qui arrive quand la machine s'arrête sèchement, quand la mémoire manque, ou quand un superviseur perd patience. **Ce qui doit absolument être fait ne peut pas dépendre de `terminate/2`.**

Si vous avez besoin d'une garantie, elle doit vivre ailleurs : une transaction en base, un travail persistant dans une file, un `Process.monitor` chez quelqu'un qui survivra.

## Ce que ça change à l'écriture

En pratique, cette philosophie se traduit par trois habitudes.

**On écrit le chemin heureux.** Pas de vérification défensive à chaque étape pour des états qui ne devraient pas exister. Si l'invariant est faux, le pattern matching échoue et le processus meurt — ce qui est le comportement correct.

**On dessine l'arbre de supervision comme on dessine un schéma de base.** Qui redémarre qui, dans quel ordre, avec quelle stratégie. C'est une décision d'architecture, pas une formalité de démarrage.

**On range l'état durable hors des processus.** Base de données, ETS, service externe. L'état d'un `GenServer` est un cache de travail, pas une mémoire.

## En résumé

« Let it crash » n'autorise pas à ignorer les erreurs. Elle sépare deux responsabilités qui étaient mélangées : faire le travail, et décider quoi faire quand il échoue.

Le prix est réel — l'état est perdu, l'appelant tombe avec, et une panne répétée arrête l'application. Ces trois coûts sont voulus : ils vous forcent à concevoir un système où un processus peut mourir sans que ce soit un drame.

Et le jour où ça arrive en production à trois heures du matin, un processus mort et remplacé vaut infiniment mieux qu'un processus vivant dans un état que personne ne sait décrire.

---

*Les trois comportements décrits ici — perte d'état, propagation à l'appelant, arrêt du superviseur — ont été exécutés sur Elixir 1.19.5 et Erlang/OTP 28 avant publication. Le [notebook du parcours](https://livebook.dev/run/?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/OTP/genserver_supervisor.livemd) permet de les rejouer.*
