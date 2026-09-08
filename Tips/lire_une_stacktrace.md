[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

# Lire une stacktrace / comprendre les erreurs

Quand du code Elixir plante, le message peut sembler intimidant. En réalité il suit toujours la même structure, et savoir la lire fait gagner un temps fou. Pas de panique : **le type d'erreur vous dit souvent tout.**

## Anatomie d'un message d'erreur

```
** (KeyError) key :nom not found in: %{age: 30}
    (mon_app 0.1.0) lib/mon_app/utilisateur.ex:12: MonApp.Utilisateur.saluer/1
    (elixir 1.16.0) lib/enum.ex:1058: Enum."-map/2-lists^map/1-0-"/2
    iex:3: (file)
```

Deux parties :

1. **La première ligne** `** (TypeErreur) message` : *quoi* et *pourquoi*. Ici : on a cherché la clé `:nom` dans une map qui ne la contient pas.
2. **La stacktrace** (les lignes suivantes) : *où*. Chaque ligne se lit :

```
(application version) chemin/fichier.ex:ligne: Module.fonction/arité
```

La **ligne du haut de la stacktrace = l'endroit exact du crash**. On descend ensuite dans la chaîne des appelants. Le premier fichier **qui vous appartient** (votre app, pas `elixir` ni une dépendance) est presque toujours le bon point de départ.

> `/1`, `/2`… est l'**arité** : le nombre d'arguments de la fonction. `saluer/1` et `saluer/2` sont deux fonctions différentes.

## Les erreurs les plus fréquentes

| Erreur | Signification | Réflexe |
|---|---|---|
| **`FunctionClauseError`** | aucune clause de la fonction ne correspond aux arguments | vérifier les arguments passés vs les `def`/pattern attendus |
| **`MatchError`** | un `=` (pattern matching) a échoué | la valeur de droite n'a pas la forme attendue à gauche |
| **`KeyError`** | clé absente d'une map/keyword | faute de frappe sur la clé, ou donnée incomplète |
| **`UndefinedFunctionError`** | fonction ou module inexistant | module mal orthographié, dépendance non installée, `use`/`import` oublié |
| **`ArgumentError`** | argument du bon type mais invalide | lire le message, souvent explicite |
| **`Protocol.UndefinedError`** | un protocole (souvent `Enumerable`/`String.Chars`) n'est pas implémenté | typiquement un `nil` là où on attendait une liste/chaîne |
| **`ArithmeticError`** | opération numérique invalide | souvent un `nil` ou une chaîne dans un calcul |

### Exemple : FunctionClauseError

```
** (FunctionClauseError) no function clause matching in MonApp.aire/1

    The following arguments were given to MonApp.aire/1:
        # 1
        -3

    (mon_app 0.1.0) lib/mon_app.ex:5: MonApp.aire/1
```

Elixir **affiche les arguments reçus** et parfois vous propose les clauses attendues. Ici `aire/1` a probablement une garde `when rayon > 0` qui rejette `-3`.

## Le réflexe qui sauve : `dbg/1`

Pour inspecter des valeurs **avant** le crash, glissez `dbg()` dans un pipe : il affiche chaque étape avec le fichier et la ligne.

```elixir
[1, 2, 3]
|> Enum.map(&(&1 * 2))
|> dbg()          # affiche la valeur à ce point du pipe
|> Enum.sum()
```

Toute l'échelle — `iex`, `IO.inspect`, `dbg`, les points d'arrêt — est détaillée dans [Débogage & outillage IEx](./debogage_iex.md).

## Bons réflexes

- **Lire le type d'erreur d'abord** — il oriente 80 % du diagnostic.
- **Remonter à la première ligne « qui est à vous »** dans la stacktrace.
- Elixir suggère souvent la correction (`did you mean?`, arguments reçus) : **lire tout le message**, pas juste la première ligne.
- Un `nil` inattendu est la cause n°1 des `Protocol.UndefinedError` et `ArithmeticError`.

## À retenir

- Message = **`** (Type) pourquoi`** en haut, **`fichier:ligne: Module.fonction/arité`** en dessous.
- Le haut de la stacktrace est le lieu du crash ; le premier fichier *à vous* est le point d'entrée.
- `/n` = arité (nombre d'arguments), pas un numéro de version.
- `dbg()` et `IO.inspect(label: ...)` pour voir les valeurs avant que ça casse — voir [Débogage & outillage IEx](./debogage_iex.md).
- Documentation officielle : https://hexdocs.pm/elixir/debugging.html
