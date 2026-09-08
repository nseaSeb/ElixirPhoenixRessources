[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

# Débogage & outillage IEx

Le réflexe `Logger.info("truc = #{inspect(truc)}")` a trois défauts : il casse le pipe, il perd la provenance, et il faut le retirer à la main. Elixir livre une échelle d'outils qui règlent ces défauts un par un. **Toutes les sorties ci-dessous ont été produites sur Elixir 1.19.5 / OTP 28.**

## 1. Le shell, sans projet

```bash
iex
```

| Aide | Ce qu'elle fait |
|---|---|
| `h Enum.reduce` | la documentation, sans quitter le shell |
| `i valeur` | type, modules de référence, protocoles implémentés |
| `v(3)` | récupère le résultat de la 3ᵉ expression (`v()` = la dernière) |
| `<Tab>` | complète modules et fonctions — la façon la plus rapide d'explorer |
| `#iex:break` | abandonne une expression restée inachevée (un `end` oublié) |

```
iex> if true do
...>   :oui
...> #iex:break
** (TokenMissingError) token missing on iex:1:
error: incomplete expression
```

L'erreur est la sortie de secours, pas un échec : le shell rend la main.

## 2. Le shell, avec le projet

```bash
iex -S mix          # projet + dépendances chargés
```

```
iex> recompile()    # recompile sans quitter la session ; :ok ou :noop
iex> open Enum.map  # ouvre le source dans l'éditeur
```

`open` s'appuie sur `ELIXIR_EDITOR`, et retombe sur `EDITOR` :

```bash
export ELIXIR_EDITOR="zed"
```

## 3. `IO.inspect` — il renvoie sa valeur

C'est tout son intérêt : il se glisse dans un pipe sans le casser.

```elixir
lignes
|> Enum.filter(&(&1.quantite > 0))
|> IO.inspect(label: "après filtre")   # le label répond à « lequel a produit ça ? »
|> Enum.sum()
```

Deux options qui évitent des heures perdues :

```elixir
IO.inspect(liste, limit: :infinity)  # sans ça, tronqué au-delà de 100 éléments
IO.inspect(struct, structs: false)   # affiche la map brute, __struct__ compris
```

## 4. `dbg` — il montre le chemin, pas seulement l'arrivée

Disponible partout, sans `import` ni `require`.

```elixir
def total(%Panier{lignes: lignes}) do
  lignes
  |> Enum.filter(&(&1.quantite > 0))
  |> Enum.map(&(&1.prix * &1.quantite))
  |> dbg()          # n'affiche QUE les étapes situées avant lui
  |> Enum.sum()
end
```

```
[lib/panier.ex:8: Panier.total/1]
lignes #=> [%{prix: 30, quantite: 2}, %{prix: 50, quantite: 0}, %{prix: 45, quantite: 1}]
|> Enum.filter(&(&1.quantite > 0)) #=> [%{prix: 30, quantite: 2}, %{prix: 45, quantite: 1}]
|> Enum.map(&(&1.prix * &1.quantite)) #=> ~c"<-"
```

**Le piège de la dernière ligne :** `~c"<-"` *est* la liste `[60, 45]`. 60 et 45 sont les codes de `<` et `-`, et l'option `:charlists` vaut `:infer` par défaut. `dbg/2` accepte les options d'`inspect` :

```elixir
|> dbg(charlists: :as_lists)   #=> [60, 45]
```

**Sur un `case`, il dit quelle clause a matché** — c'est sa fonctionnalité la plus sous-estimée :

```
Case expression (clause #1 matched):
case statut do
  :paye -> "ok"
  :attente -> "patiente"
end #=> "ok"
```

## 5. Le même `dbg`, en point d'arrêt

On ne modifie pas le code : on change le lanceur.

```bash
mix clean && iex --dbg pry -S mix
```

Le `mix clean` n'est pas optionnel. Sur un projet déjà compilé :

```
** (Mix) the application :elixir has a different value set for key :dbg_callback
during runtime compared to compile time.
  * Compile time value was set to: {Macro, :dbg, []}
  * Runtime value was set to: {IEx.Pry, :dbg, []}
```

Le comportement de `dbg` est figé à la compilation (`Application.compile_env`). Le `--no-validate-compile-env` que suggère le message n'existe pas sur `mix run` en 1.19.5 — il faut bien recompiler.

Une fois arrêté :

```
Break reached: Panier.remise/1 (lib/panier.ex:13)

iex> binding()      # toutes les variables locales
[total: 200]
iex> whereami       # le code autour de la ligne
iex> continue       # on relance
```

Si le `dbg` est atteint par un autre processus (une requête Phoenix), IEx demande d'abord `Allow? [Yn]`. Répondre `n` laisse le processus continuer : un point d'arrêt oublié ne fige pas l'application.

## 6. `break!` — sans toucher au code

Pour le code qu'on ne peut pas éditer : une dépendance, ou la bibliothèque standard.

```
iex> break! Enum.map/2
1
iex> Enum.map([1, 2], & &1)
Break reached: Enum.map/2 (/home/runner/work/elixir/elixir/lib/elixir/lib/enum.ex:1688)
iex> binding()
[enumerable: [1, 2], fun: #Function<42.113135111/1 in :erl_eval.expr/6>]
```

Le chemin affiché est celui de la machine qui a construit Elixir : le fichier n'existe pas chez vous, donc aucun extrait n'est montré — mais l'arrêt a lieu et `binding()` répond. `breaks` liste, `remove_breaks` nettoie.

## 7. `.iex.exs` — le confort

Exécuté à chaque ouverture du shell, à la racine du projet.

```elixir
import Ecto.Query
alias MonApp.{Repo, Comptes}

# referme les deux pièges d'affichage pour toute la session
IEx.configure(inspect: [charlists: :as_lists, limit: :infinity])
```

## 8. La frontière avec Logger

Avec `Logger.configure(level: :error)`, un `Logger.info` disparaît — et le `dbg` de la ligne suivante s'affiche quand même. **`dbg` ne passe pas par `Logger`** : ni niveaux, ni métadonnées, ni backends. Il n'a rien à faire dans un release.

- `dbg` / `IO.inspect` : je cherche quelque chose **maintenant**, et je les retire avant de committer.
- `Logger` : je veux savoir **demain** ce qui s'est passé cette nuit.

## À retenir

- `iex` seul suffit pour essayer le langage : `h`, `i`, `v(n)`, tabulation, `#iex:break`.
- `iex -S mix` charge le projet ; `recompile()` évite de relancer, `open` saute au source.
- `IO.inspect` renvoie sa valeur, donc ne casse pas un pipe. `label:`, `limit: :infinity`, `structs: false`.
- `dbg` montre chaque étape d'un pipe et, sur un `if`/`case`, **la branche prise**. Attention à `~c"<-"` : c'est `[60, 45]`.
- `iex --dbg pry -S mix` transforme ces `dbg` en points d'arrêt — après un `mix clean`.
- `break!` s'arrête dans du code non éditable, `Enum` compris.
- `Logger` n'est pas un outil de débogage : un filtre de niveau ne l'arrête pas.
- Voir aussi [Lire une stacktrace](./lire_une_stacktrace.md) quand l'erreur elle-même est illisible.
- Documentation officielle : https://hexdocs.pm/elixir/debugging.html
