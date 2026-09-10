---
layout: post
title: "Un million de processus"
date: 2026-09-10 10:30:00 +0200
lang: fr
description: "« Elixir lance des millions de processus » : la phrase se répète sans jamais s'accompagner d'un chiffre. En voici. Un million de processus lancés, mesurés, mis sous une charge qui devrait tout geler — et qui ne gèle rien, pour une raison précise. Puis cinq millions, parce que le million n'était qu'un palier."
tags: [elixir, beam, otp, concurrence, performance]
categories: [elixir]
sources:
  - titre: "erl — options de la machine virtuelle"
    url: https://www.erlang.org/doc/apps/erts/erl_cmd.html
    note: "l'option +P et sa valeur par défaut"
  - titre: ":erlang.system_info/1"
    url: https://www.erlang.org/doc/apps/erts/erlang.html#system_info/1
  - titre: "Process.info/2"
    url: https://hexdocs.pm/elixir/Process.html#info/2
---

« Elixir peut lancer des millions de processus. » La phrase revient dans chaque présentation du langage, et elle n'est presque jamais suivie d'un chiffre. Combien de mémoire ? Combien de temps ? Et surtout : est-ce que ça tient encore debout à un million, ou est-ce une figure de style ?

Alors lançons-en un million, et mesurons. Toutes les valeurs de cet article ont été relevées sur un portable ordinaire — 16 Go de mémoire, huit cœurs — sous **Elixir 1.19.5 et OTP 28**.

<!--more-->

## D'abord : ce n'est pas le processus auquel vous pensez

Le mot est malheureux, parce qu'il en désigne trois choses différentes.

Un **processus système** — ce que montre le gestionnaire de tâches — est une application lancée par votre système d'exploitation. Il pèse des mégaoctets et il s'en ouvre quelques centaines sur une machine. Un **fil d'exécution** (*thread*) vit à l'intérieur d'un processus système, partage sa mémoire avec ses frères, et réserve une pile de l'ordre du mégaoctet ; c'est l'unité de concurrence de Java jusqu'à récemment, de C#, ou de Python.

Deux écosystèmes ont déjà fait le même choix que la BEAM : les **goroutines** de Go et, depuis peu, les **fils virtuels** de Java, tous deux légers et répartis par leur propre exécutif sur un petit nombre de fils système. La différence tient alors à l'isolation : goroutines et fils virtuels partagent la mémoire, avec les verrous et les corruptions que cela suppose. Un processus BEAM, non — et c'est cette différence-là, plus que le poids, qui fait le modèle.

Un **processus BEAM** n'est ni l'un ni l'autre. Le système d'exploitation ne le voit même pas : c'est une structure interne à la machine virtuelle d'Erlang, celle qui fait tourner votre code Elixir. Trois propriétés, et tout le reste de l'article en découle :

- **il est isolé** — il a sa propre mémoire, son propre tas (*heap*, la zone où vivent ses données), et si son voisin plante, il ne le remarque même pas ;
- **il ne partage rien** — deux processus ne peuvent pas se lire l'un l'autre, seulement s'envoyer des messages, qui sont *copiés* au passage ;
- **c'est la VM qui l'ordonnance**, pas le système d'exploitation, et elle le fait sur ses propres règles — nous verrons lesquelles, et pourquoi elles empêchent qu'un processus en bloque un autre.

Ce n'est pas de la théorie lointaine : dans une application Phoenix, **chaque connexion LiveView ouverte est un processus**. Mille visiteurs, mille processus. Savoir ce que l'un coûte, c'est savoir ce que coûte le millier.

Un dernier mot de vocabulaire avant les mesures : un **mot machine** est l'unité dans laquelle la VM compte la mémoire, huit octets sur une machine 64 bits moderne. Quand la suite parle d'un tas de « 233 mots », lisez 1 864 octets.

## Ce que pèse un processus, tout seul

Commençons par un seul, qui ne fait rien d'autre qu'attendre :

{% raw %}
```elixir
def dormeur do
  receive do
    :stop -> :ok
  end
end

pid = spawn(&dormeur/0)
Process.info(pid, [:memory, :heap_size, :stack_size, :total_heap_size])
```
{% endraw %}

{% raw %}
```
[memory: 2632, heap_size: 233, stack_size: 1, total_heap_size: 233]
```
{% endraw %}

**2 632 octets.** Le tas initial fait 233 mots machine, soit 1 864 octets sur une machine 64 bits, et le reste est la structure de contrôle que la VM tient pour ce processus.

Ce nombre est tout l'argument. Rappelez-vous le fil d'exécution système de la section précédente et son mégaoctet de pile : nous sommes **trois ordres de grandeur en dessous**. C'est exactement ce qui sépare « quelques milliers de fils » de « un million de processus ».

Et ce n'est pas une optimisation qu'on aurait ajoutée après coup : c'est la conséquence directe du choix de conception. Un processus si léger n'est possible que parce qu'il n'est pas un objet du système d'exploitation.

## Le tableau

Chaque palier a été mesuré dans une **machine virtuelle neuve**, pour qu'aucun ne profite ni ne souffre du précédent — la première version de ce banc d'essai enchaînait les paliers dans la même VM et faisait apparaître au million un surcoût qui n'existait pas.

| Processus | Temps | Mémoire | Octets / processus | ns / `spawn` |
|---:|---:|---:|---:|---:|
| 1 000 | 0,4 ms | 3 Mo | 2 767 | 445 |
| 10 000 | 7,2 ms | 26 Mo | 2 689 | 719 |
| 100 000 | 72,3 ms | 254 Mo | 2 666 | 723 |
| 250 000 | 211,9 ms | 633 Mo | 2 657 | 848 |
| 500 000 | 424,6 ms | 1 276 Mo | 2 675 | 849 |
| **1 000 000** | **1 026 ms** | **2 533 Mo** | **2 657** | **1 026** |

Un million de processus vivants : **une seconde, et deux gigaoctets et demi.**

La colonne qui compte n'est pourtant pas celle du million, c'est l'avant-dernière. **Le coût par processus ne bouge pas** — 2 657 octets à un million, 2 767 à mille. Sur trois ordres de grandeur, la structure ne se dégrade pas : il n'y a pas de seuil où « ça commence à coûter cher ». Le temps, lui, dérive légèrement — 445 ns par `spawn` à mille, 1 026 ns à un million — ce qui reste une croissance très douce, imputable à la pression sur l'allocateur mémoire à mesure que le tas global enfle.

C'est cette platitude qui autorise une manière d'écrire du code : **un processus par connexion, par utilisateur, par ligne à traiter.** Non pas comme une audace, mais comme le mode d'emploi. Dans un environnement où un fil coûte un mégaoctet, le même dessin impose un pool, une file d'attente, et l'arbitrage qui va avec.

## Le plafond, et le mur quand on le touche

Un million passe — mais de justesse, et ça vaut la peine de savoir pourquoi. La page de manuel de `erl` est explicite sur l'option `+P` :

> Sets the maximum number of simultaneously existing processes for this system. Valid range is `[1024-134217727]`. **The default value is 1048576.**

Soit 1 048 576, exactement 2²⁰. Notre million tient sous le plafond avec 48 576 places de rab. Un programme qui en voudrait davantage doit le dire au démarrage de la VM, et **seulement au démarrage** — cette limite ne se change pas à chaud :

{% raw %}
```bash
elixir --erl "+P 2000000" mon_script.exs
```
{% endraw %}

Que se passe-t-il quand on la touche ? Vérifions en l'abaissant à 1 024 :

{% raw %}
```
11:25:36.227 [error] Too many processes

** (SystemLimitError) a system limit has been reached
```
{% endraw %}

Deux choses à noter. `spawn` ne renvoie pas un `{:error, _}` qu'on pourrait filtrer : il **lève**, et une `SystemLimitError` n'est pas rattrapable de façon utile — quand elle arrive, le problème est le dimensionnement, pas la gestion d'erreur. Et le compteur s'arrête pile à la limite : `:erlang.system_info(:process_count)` rend exactement 1 024. Le plafond est dur, pas indicatif.

## Leur parler

Un million de processus qui dorment ne prouvent pas grand-chose. Deux épreuves de communication — une diffusion, jusqu'au million, et un anneau, jusqu'à cent mille maillons :

| Épreuve | Total | Par opération |
|---|---:|---:|
| Diffusion à 100 000 processus | 69,5 ms | 695 ns |
| Diffusion à 1 000 000 processus | 833,8 ms | 834 ns |
| Anneau de 10 000 maillons | 11,3 ms | 1 131 ns |
| Anneau de 100 000 maillons | 82,5 ms | 825 ns |

L'anneau est le plus démonstratif : on chaîne N processus, chacun ne sachant que renvoyer au suivant ce qu'il reçoit, puis on lâche un jeton d'un bout et on attend qu'il revienne. Cent mille sauts, quatre-vingt-deux millisecondes. **Un envoi de message coûte moins d'une microseconde**, copie de la donnée comprise — car les processus ne partagent rien, chaque message est copié dans le tas du destinataire.

C'est le second pilier du modèle. Le premier, l'isolation, rend le « laisser planter » possible ; le second, le coût d'envoi, rend l'isolation abordable.

## Pourquoi une boucle infinie ne gèle rien

Voici l'épreuve qui départage vraiment. Prenons un aller-retour de message entre deux processus, mesurons-le au repos, puis relançons la même mesure pendant que **seize boucles infinies** tournent sur huit cœurs :

{% raw %}
```elixir
def boucle_infinie, do: boucle_infinie()
```
{% endraw %}

| Situation | Aller-retour |
|---|---:|
| Au repos | 1,6 µs |
| Avec 16 boucles infinies sur 8 cœurs | 85,8 µs |

Cinquante-quatre fois plus lent — et pourtant, toujours **quatre-vingt-six microsecondes**. Le système répond. Dans un langage à ordonnancement coopératif, une seule de ces boucles suffirait à tout figer indéfiniment.

La raison porte un nom : le **comptage de réductions**.

Il faut d'abord distinguer deux manières de partager un processeur. Dans un ordonnancement **coopératif**, chaque tâche garde la main jusqu'à ce qu'elle la rende d'elle-même — typiquement en attendant une entrée-sortie. Une tâche qui ne rend jamais la main bloque tout, et c'est ce qui se passe avec une boucle infinie en JavaScript : l'onglet se fige. Dans un ordonnancement **préemptif**, quelqu'un a le pouvoir d'interrompre une tâche sans lui demander son avis.

La BEAM est préemptive, et sa mesure est la **réduction** — grossièrement, un appel de fonction. Chaque processus se voit accorder un quota au moment où l'ordonnanceur lui donne la main ; quand le quota est épuisé, le processus est suspendu et le suivant prend sa place, qu'il soit d'accord ou non. Aucun point de coopération n'a à figurer dans votre code : c'est la VM qui compte, et elle compte pour tout le monde.

L'ordre de grandeur se mesure. En faisant varier le nombre de boucles et en moyennant les réductions sur **toutes** — un détail qui compte, nous y venons :

| Boucles infinies | Par boucle | Total sur la machine |
|---:|---:|---:|
| 1 | 622 M/s | 622 M/s |
| 2 | 605 M/s | 1 209 M/s |
| 4 | 554 M/s | 2 217 M/s |
| 8 | 385 M/s | 3 080 M/s |
| 16 | **192 M/s** | 3 075 M/s |

Deux lectures. Horizontalement, une boucle passe de 622 à 192 millions de réductions par seconde : elle se fait interrompre, encore et encore, sans jamais pouvoir confisquer son cœur. Verticalement, le total sature vers 3 080 millions à huit boucles et **ne bouge plus** ensuite : la machine est pleine, et l'ordonnanceur se contente de redistribuer.

Le total ne fait pas huit fois la valeur solo, et c'est le matériel qui parle : ce portable est un Apple M1, quatre cœurs de performance et quatre cœurs d'efficacité, ces derniers nettement plus lents. Huit « cœurs » ne valent donc pas huit fois un cœur.

Enfin, le détail annoncé plus haut, qui est une leçon de méthode. Une première version de cette mesure lisait les réductions du **premier** processus lancé et annonçait 387 M/s à seize boucles — le double de la vérité. Le premier processus n'est pas représentatif : il démarre en tête et l'ordonnanceur le pose volontiers sur un cœur rapide. Il faut moyenner sur l'ensemble, sans quoi on mesure un privilégié.

C'est la propriété la moins spectaculaire des trois et la plus importante en production. Elle signifie qu'un calcul lourd mal placé, une expression régulière pathologique ou une boucle oubliée dans un coin dégradent le service — mais ne le suppriment pas. La latence monte, les requêtes passent encore. Rien ne se bloque.

## Le million n'est pas un plafond

Tout ce qui précède mesure le processus tel qu'il sort de `spawn` : un tas initial de 233 mots, prêt à travailler. Mais un processus qui attend une connexion, un message ou un événement n'a pas besoin de ce tas — il ne fait rien. La VM propose de le lui reprendre :

{% raw %}
```elixir
def hiberneur do
  # ramasse-miettes complet, pile abandonnée, tas réduit au minimum
  :erlang.hibernate(__MODULE__, :reveil, [])
end

def reveil do
  receive do
    :stop -> :ok
  end
end
```
{% endraw %}

`:erlang.hibernate/3` est une fonction qui **ne rend jamais la main** — elle ne « retourne » pas comme les autres. Elle déclenche un ramasse-miettes complet (le nettoyage qui libère la mémoire devenue inutile), jette la pile d'appel, réduit le tas à sa plus simple expression, et met le processus en sommeil. Il se réveillera dans la fonction indiquée en argument, à l'arrivée du prochain message, comme s'il venait de démarrer. Le résultat sur la balance :

| Processus | Mémoire | Tas |
|---|---:|---:|
| `spawn` ordinaire | 2 632 o | 233 mots |
| Hiberné | **808 o** | **5 mots** |
| `spawn_opt(min_heap_size: 1)` | 2 632 o | 233 mots |

Trois fois plus léger. Notez la troisième ligne : demander un tas minimal à la création **ne sert à rien**, la VM impose son plancher de 233 mots. C'est l'hibernation, et elle seule, qui fait tomber le chiffre.

Reste le plafond. `+P` accepte jusqu'à **134 217 727**, et la VM arrondit à la puissance de deux supérieure — demander dix millions en donne seize :

{% raw %}
```bash
elixir --erl "+P 10000000" mon_script.exs
```
{% endraw %}

{% raw %}
```
process_limit = 16777216
```
{% endraw %}

Alors allons-y. Cinq millions de processus hibernés, sur le même portable :

| | Temps | Mémoire | Octets / processus |
|---|---:|---:|---:|
| 1 000 000 hibernés | 951 ms | 809 Mo | 849 |
| **5 000 000 hibernés** | **6,7 s** | **3,95 Go** | **849** |

`process_count` confirme : 5 000 055 processus vivants simultanément. Et le coût unitaire n'a **toujours pas bougé** — 849 octets à un million comme à cinq.

La limite n'est donc pas la machine virtuelle, c'est la barrette de mémoire. Sur ce portable de 16 Go, l'arithmétique donne une quinzaine de millions de processus dormants ; le plafond dur de la VM est dix fois plus haut encore. Le million du titre n'était pas un exploit, c'était un palier.

Une nuance honnête pour finir : ces cinq millions **dorment**. Un processus qui travaille reconstruit son tas, et les 849 octets redeviennent des kilooctets. L'hibernation est faite pour la multitude qui attend — connexions ouvertes mais silencieuses, sessions inactives, appareils connectés qui parlent une fois par heure. C'est exactement la forme qu'ont les systèmes où l'on cite ces chiffres.

## Ce qu'il faut en retirer

Les trois nombres tiennent en une ligne : **2,6 Ko par processus, une microseconde pour en créer un, une microseconde pour lui parler.**

Ce ne sont pas des chiffres de démonstration, ce sont des chiffres de conception. Ils expliquent pourquoi un serveur Phoenix ouvre un processus par connexion sans y penser, pourquoi un `Task.async_stream` sur dix mille éléments est banal, et pourquoi un `GenServer` par entité métier — par partie de jeu, par panier, par appareil connecté — est une architecture ordinaire ici et une folie ailleurs.

## À retenir

- Un processus au repos pèse **2 632 octets** : 233 mots de tas initial plus sa structure de contrôle. Trois ordres de grandeur sous un fil système.
- **Ce coût est constant** de mille à un million de processus — c'est le résultat le plus important de l'article, bien plus que le million lui-même.
- Un million de processus : **1 seconde, 2,5 Go**. Le plafond par défaut est de **1 048 576**, réglable par `+P` **au démarrage seulement**.
- Le dépassement lève une `SystemLimitError` précédée de `[error] Too many processes` ; le compteur s'arrête pile à la limite.
- Envoyer un message coûte **moins d'une microseconde**, copie comprise, y compris à travers un anneau de cent mille maillons.
- L'ordonnanceur est **préemptif par comptage de réductions** : seize boucles infinies sur huit cœurs font passer un aller-retour de 1,6 à 85,8 µs — dégradé, jamais gelé.
- **Le million n'est pas un plafond.** `:erlang.hibernate/3` ramène un processus dormant à **808 octets** (tas de 5 mots) ; cinq millions d'hibernés tiennent en **3,95 Go** sur un portable, toujours à 849 octets pièce. `spawn_opt(min_heap_size: 1)`, lui, ne change rien.
- `+P` monte jusqu'à **134 217 727** et arrondit à la puissance de deux supérieure : `+P 10000000` donne un plafond réel de 16 777 216. Le facteur limitant est la mémoire, pas la VM.
- Le notebook pour refaire ces mesures chez vous, plafonné à 100 000 pour rester poli avec votre mémoire : [Ce que coûte un processus BEAM](https://github.com/nseaSeb/ElixirPhoenixRessources/blob/main/Tips/processus_beam.livemd).
