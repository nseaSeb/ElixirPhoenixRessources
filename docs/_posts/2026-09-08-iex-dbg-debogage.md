---
layout: post
title: "Arrêter de déboguer avec des Logger.info : iex, IO.inspect, dbg, pry"
date: 2026-09-08 12:00:00 +0200
lang: fr
description: "Le réflexe Logger.info(inspect(truc)) a trois défauts qu'on ne voit qu'après avoir essayé autre chose. Petite échelle d'outils, du shell interactif au point d'arrêt, mesurée sur Elixir 1.19.5."
tags: [elixir, iex, debogage, outillage]
categories: [elixir]
sources:
  - titre: "Kernel.dbg/2"
    url: https://hexdocs.pm/elixir/Kernel.html#dbg/2
  - titre: "IO.inspect/2 et Inspect.Opts"
    url: https://hexdocs.pm/elixir/Inspect.Opts.html
    note: "toutes les options d'affichage, dont :limit et :charlists"
  - titre: "IEx.Helpers"
    url: https://hexdocs.pm/iex/IEx.Helpers.html
    note: "la liste complète des aides du shell"
  - titre: "Debugging — guide officiel Elixir"
    url: https://hexdocs.pm/elixir/debugging.html
---

Il existe un réflexe universel, et il est mauvais :

{% raw %}
```elixir
Logger.info("panier = #{inspect(panier)}")
```
{% endraw %}

Trois défauts, qu'on ne voit pas tant qu'on n'a pas essayé autre chose. Il **casse le pipe** — il faut sortir la valeur du flux pour l'observer. Il **perd la provenance** — au sixième log, plus personne ne sait lequel a produit quoi. Et il **faut le retirer à la main**, ce qu'on oublie une fois sur trois.

Elixir livre une petite échelle d'outils qui règlent ces défauts un par un. On monte d'un barreau quand le précédent ne suffit plus. Toutes les sorties ci-dessous ont été produites sur Elixir 1.19.5 / OTP 28.

<!--more-->

## Barreau 0 : le shell, comme terrain d'essai

Avant de déboguer quoi que ce soit, il faut un endroit où essayer. C'est `iex`, et il ne demande aucun projet :

{% raw %}
```
$ iex
Interactive Elixir (1.19.5) - press Ctrl+C to exit (type h() ENTER for help)
iex(1)>
```
{% endraw %}

Quatre aides suffisent à s'y sentir chez soi.

**`h`** ouvre la documentation sans quitter le shell — `h Enum.reduce` affiche la doc de la fonction, `h Enum` celle du module. **`i`** interroge une valeur :

{% raw %}
```
iex> i :atome
Term
  :atome
Data type
  Atom
Reference modules
  Atom
Implemented protocols
  IEx.Info, Inspect, JSON.Encoder, List.Chars, String.Chars
```
{% endraw %}

**`v(n)`** rattrape un résultat qu'on a laissé filer. On a calculé quelque chose de long, on n'a pas pensé à l'affecter : `v(3)` renvoie le résultat de la troisième expression, et `v()` celui de la dernière.

**La touche tabulation** complète les noms de modules et de fonctions. `Enum.` suivi de tabulation liste tout ce que le module expose ; c'est la façon la plus rapide de découvrir la bibliothèque standard.

Un cas qui bloque tous les débutants : on tape une expression, on oublie un `end`, et le shell reste coincé à attendre la suite. La sortie de secours est `#iex:break` :

{% raw %}
```
iex> if true do
...>   :oui
...> #iex:break
** (TokenMissingError) token missing on iex:1:
error: incomplete expression
```
{% endraw %}

L'erreur n'est pas un échec : c'est le shell qui abandonne l'expression inachevée et rend la main.

### Dans un projet : `iex -S mix`

Le même shell, mais avec le projet chargé — toutes ses fonctions et toutes ses dépendances accessibles. C'est la façon normale de travailler sur du code Elixir, et pas seulement pour déboguer.

Le compagnon indispensable est **`recompile()`** : après avoir modifié un fichier dans l'éditeur, il recompile sans quitter la session, donc sans perdre l'état qu'on a monté à la main. Il répond `:ok` s'il a travaillé, `:noop` s'il n'y avait rien à faire.

Et **`open`** ouvre le source dans l'éditeur : `open Enum.map` saute directement à la définition, y compris dans la bibliothèque standard. Il s'appuie sur la variable d'environnement `ELIXIR_EDITOR`, et retombe sur `EDITOR` si elle n'est pas définie :

{% raw %}
```bash
export ELIXIR_EDITOR="zed"
```
{% endraw %}

## Barreau 1 : `IO.inspect` et son `label:`

Premier vrai outil de débogage, et le seul que beaucoup connaissent. Son intérêt tient en une phrase : **il renvoie la valeur qu'il reçoit**, donc il se glisse dans un pipe sans le casser.

{% raw %}
```elixir
lignes
|> Enum.filter(&(&1.quantite > 0))
|> IO.inspect(label: "après filtre")
|> Enum.map(&(&1.prix * &1.quantite))
|> Enum.sum()
```
{% endraw %}

Le `label:` répond à la question qui vient toujours au sixième affichage : *lequel a produit ça ?*

{% raw %}
```
après filtre: [%{prix: 30, quantite: 2}, %{prix: 45, quantite: 1}]
```
{% endraw %}

### Deux options qui évitent des heures perdues

**`limit:`** — au-delà d'une centaine d'éléments, l'affichage est tronqué par des points de suspension. Mesuré sur 1.19.5 : la limite par défaut est de 100, une liste de 101 éléments est coupée. On débogue alors une ellipse.

{% raw %}
```elixir
IO.inspect(grande_liste, label: "complet", limit: :infinity)
```
{% endraw %}

**`structs: false`** — pour voir ce qu'il y a *vraiment* dans une structure, sans la mise en forme du protocole `Inspect` :

{% raw %}
```
struct: %Panier{
  client: "Alice",
  lignes: [...]
}

brut: %{
  __struct__: Panier,
  client: "Alice",
  lignes: [...]
}
```
{% endraw %}

Sur un `%Ecto.Changeset{}`, dont l'affichage par défaut cache une bonne partie du contenu, la différence est décisive.

## Barreau 2 : `dbg`, qui montre le chemin et pas seulement l'arrivée

`IO.inspect` montre *une* valeur. `dbg` montre **toutes les étapes qui y ont mené**, avec le fichier, la ligne et la fonction. Il est disponible partout, sans `import` ni `require`.

{% raw %}
```elixir
def total(%Panier{lignes: lignes}) do
  lignes
  |> Enum.filter(&(&1.quantite > 0))
  |> Enum.map(&(&1.prix * &1.quantite))
  |> dbg()
  |> Enum.sum()
end
```
{% endraw %}

{% raw %}
```
[lib/panier.ex:8: Panier.total/1]
lignes #=> [%{prix: 30, quantite: 2}, %{prix: 50, quantite: 0}, %{prix: 45, quantite: 1}]
|> Enum.filter(&(&1.quantite > 0)) #=> [%{prix: 30, quantite: 2}, %{prix: 45, quantite: 1}]
|> Enum.map(&(&1.prix * &1.quantite)) #=> ~c"<-"
```
{% endraw %}

Deux choses à noter tout de suite.

**`dbg` n'affiche que les étapes jusqu'à lui.** Le `Enum.sum()` placé après n'apparaît pas — ce n'est pas un bug, c'est une macro qui ne voit que le pipe qu'on lui a passé. Pour voir la fin, on déplace le `dbg` à la fin.

**Et cette sortie contient un piège.** Regardez la dernière ligne : `~c"<-"`. C'est la liste `[60, 45]`. Les entiers 60 et 45 sont les codes des caractères `<` et `-`, et comme *tous* les éléments sont imprimables, Elixir suppose une charlist. L'option `:charlists` vaut `:infer` par défaut. On n'est pas obligé de subir :

{% raw %}
```elixir
|> dbg(charlists: :as_lists)
```
{% endraw %}

{% raw %}
```
|> Enum.map(&(&1.prix * &1.quantite)) #=> [60, 45]
```
{% endraw %}

`dbg/2` accepte les mêmes options que `inspect/2`. C'est le genre de détail qui fait perdre une demi-heure à chercher d'où sort une chaîne bizarre, alors que la valeur était correcte depuis le début.

### `dbg` comprend `if` et `case`

C'est sa fonctionnalité la plus sous-estimée. Sur une condition, il montre l'argument, la branche prise, et le résultat :

{% raw %}
```elixir
def remise(total) do
  dbg(if total > 100, do: total * 0.9, else: total)
end
```
{% endraw %}

{% raw %}
```
[lib/panier.ex:13: Panier.remise/1]
If condition:
total > 100 #=> true

If expression:
if total > 100 do
  total * 0.9
else
  total
end #=> 94.5
```
{% endraw %}

Sur un `case`, il indique **quelle clause a matché** :

{% raw %}
```
Case argument:
statut #=> :paye

Case expression (clause #1 matched):
case statut do
  :paye -> "ok"
  :attente -> "patiente"
end #=> "ok"
```
{% endraw %}

« Quelle clause a matché » est précisément la question qu'on se pose devant un `case` qui tombe dans la mauvaise branche. Aucun `Logger.info` ne répond à ça sans qu'on l'écrive à la main dans chaque clause.

## Barreau 3 : le même `dbg`, en point d'arrêt

Voici l'idée qui change la façon de travailler : **on ne modifie pas le code pour déboguer plus fort, on change le lanceur.**

{% raw %}
```bash
iex --dbg pry -S mix
```
{% endraw %}

Les `dbg()` déjà présents dans le code deviennent des points d'arrêt interactifs. Le code est identique ; seule la commande de démarrage a changé.

### Le mur qu'on rencontre au premier essai

Sur un projet déjà compilé, la commande échoue :

{% raw %}
```
** (Mix) the application :elixir has a different value set for key :dbg_callback
during runtime compared to compile time. Since this application environment entry
was marked as compile time, this difference can lead to different behavior than expected:

  * Compile time value was set to: {Macro, :dbg, []}
  * Runtime value was set to: {IEx.Pry, :dbg, []}
```
{% endraw %}

C'est le mécanisme de validation de `Application.compile_env` qui parle : le comportement de `dbg` est figé **à la compilation**, et il ne peut pas être changé au lancement d'un code déjà compilé. Le message propose lui-même un `--no-validate-compile-env` — sur 1.19.5, `mix run` répond `--no-validate-compile-env : Unknown option`. Ce n'est donc pas la solution.

Le remède est celui que le message donne en deuxième : **recompiler**.

{% raw %}
```bash
mix clean && iex --dbg pry -S mix
```
{% endraw %}

### Une fois arrêté

{% raw %}
```
iex(1)> Panier.remise(200)
Break reached: Panier.remise/1 (lib/panier.ex:13)

   12:   def remise(total) do
   13:     dbg(if total > 100, do: total * 0.9, else: total)
   14:   end

iex(2)> binding()
[total: 200]
```
{% endraw %}

`binding()` donne toutes les variables locales, `whereami` réaffiche le contexte autour de la ligne, et `continue` relance l'exécution. Entre les deux, on est dans un vrai shell : on peut appeler n'importe quelle fonction avec les valeurs réelles sous la main.

### Quand le `dbg` est atteint par un autre processus

Dans une requête Phoenix, le `dbg` n'est pas exécuté par le shell mais par le processus de la requête. IEx demande alors l'autorisation avant de vous confier la main :

{% raw %}
```
Request to pry #PID<0.153.0> at Panier.remise/1 (lib/panier.ex:13)

   12:   def remise(total) do
   13:     dbg(if total > 100, do: total * 0.9, else: total)
   14:   end

Allow? [Yn]
```
{% endraw %}

Répondre `n` laisse le processus continuer normalement — le `dbg` reprend son affichage habituel. C'est important : un point d'arrêt oublié dans un chemin très fréquenté ne fige pas l'application, il pose une question.

## Barreau 4 : `break!`, sans toucher au code

Les trois barreaux précédents supposent qu'on peut éditer le fichier. Parfois non — le code est dans une dépendance, ou dans la bibliothèque standard. `break!` pose un point d'arrêt sur une fonction **déjà compilée** :

{% raw %}
```
iex> break! Panier.remise/1
1

iex> breaks
 ID   Module.function/arity   Pending stops
---- ----------------------- ---------------
 1    Panier.remise/1         1
```
{% endraw %}

Et ça marche jusque dans `Enum` :

{% raw %}
```
iex> break! Enum.map/2
1

iex> Enum.map([1, 2], & &1)
Break reached: Enum.map/2 (/home/runner/work/elixir/elixir/lib/elixir/lib/enum.ex:1688)

iex> binding()
[enumerable: [1, 2], fun: #Function<42.113135111/1 in :erl_eval.expr/6>]
```
{% endraw %}

Notez le chemin : `/home/runner/work/elixir/elixir/...`, celui de la machine qui a construit Elixir. Le fichier n'existe pas chez vous, donc aucun extrait de code n'est affiché — mais l'arrêt a bien lieu et `binding()` répond. `remove_breaks` nettoie tout.

## Le confort : `.iex.exs`

Un fichier `.iex.exs` à la racine du projet est exécuté à chaque ouverture du shell. C'est l'endroit où mettre les `alias` et les `import` qu'on retape dix fois par jour :

{% raw %}
```elixir
import Ecto.Query
alias MonApp.{Repo, Comptes, Facturation}

IEx.configure(inspect: [charlists: :as_lists, limit: :infinity])
```
{% endraw %}

La dernière ligne referme les deux pièges vus plus haut, pour toute la session : plus de `~c"<-"` surprise, plus de listes tronquées.

## La frontière avec `Logger`

Tout ce qui précède sert la boucle de développement. `Logger` sert autre chose : ce qu'on veut relire demain, en production, filtré par niveau et routé vers un backend.

La différence est vérifiable en trois lignes. Avec `Logger.configure(level: :error)`, un `Logger.info` disparaît — et le `dbg` de la ligne suivante s'affiche quand même :

{% raw %}
```
[essai.exs:4: (file)]
:coucou #=> :coucou
```
{% endraw %}

`dbg` **ne passe pas par `Logger`**. Il ne connaît ni les niveaux, ni les métadonnées, ni les backends, et il n'a donc rien à faire dans un release. C'est un outil de mise au point, pas de journalisation.

Le partage est simple :

- **`dbg` et `IO.inspect`** : je cherche quelque chose maintenant, et je les retire avant de committer.
- **`Logger`** : je veux savoir demain ce qui s'est passé cette nuit.

## À retenir

- **`iex` seul** est un terrain d'essai sans projet : `h`, `i`, `v(n)`, tabulation, et `#iex:break` pour se dépêtrer d'une expression inachevée.
- **`iex -S mix`** charge le projet ; `recompile()` évite de relancer la session, `open` saute au source.
- **`IO.inspect`** renvoie sa valeur, donc ne casse pas un pipe. `label:` pour s'y retrouver, `limit: :infinity` et `structs: false` quand l'affichage ment par omission.
- **`dbg`** montre chaque étape d'un pipe, et pour un `if` ou un `case`, **quelle branche a été prise**. Il accepte les options d'`inspect` — dont `charlists: :as_lists`, sans quoi `[60, 45]` s'affiche `~c"<-"`.
- **`iex --dbg pry -S mix`** transforme ces mêmes `dbg` en points d'arrêt, sans toucher au code. Il faut recompiler (`mix clean`) : la valeur est figée à la compilation.
- **`break!`** s'arrête dans du code qu'on ne peut pas éditer, dépendances et bibliothèque standard comprises.
- **`Logger` n'est pas un outil de débogage.** Un `dbg` traverse un filtre de niveau qui bloquerait un `Logger.info` — ce sont deux mécanismes séparés, pour deux besoins séparés.

Quand malgré tout ça une erreur reste illisible, la suite se trouve dans [Lire une stacktrace Elixir sans paniquer]({{ "/articles/lire-une-stacktrace-elixir/" | relative_url }}). Et sur la raison pour laquelle `dbg` ne peut pas changer de comportement au lancement, [Structurer un projet Elixir]({{ "/articles/structurer-un-projet-elixir/" | relative_url }}) détaille `Application.compile_env`.
