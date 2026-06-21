# Quelques "Tips"
[Accueil](README.md) · [🧭 Parcours d'apprentissage](PARCOURS.md)
Les fichiers `.livemd` sont des [Livebooks](https://livebook.dev/) : ils s'affichent comme du Markdown sur GitHub et peuvent être ouverts directement dans Livebook pour être exécutés.

Vous trouverez ici quelques notes d'astuces que je conserve ici.

## Bases du langage (🟢 à commencer dans l'ordre)
0. [Pièges quand on vient d'un langage objet](./Bases/pieges_venant_objet.livemd) *(à lire en premier)*
1. [Immutabilité & pattern matching](./Bases/immutabilite_et_pattern_matching.livemd)
2. [Pipe `|>`, `with` et récursion](./Bases/pipe_with_recursion.livemd)
3. [Enum, Stream & compréhensions](./Bases/enum_stream_comprehensions.livemd)
4. [Structs, protocoles & behaviours](./Bases/structs_protocoles_behaviours.livemd)

## Ecto
- [--binary-id, vous avez oubliez de passer l'option, pas de panique !](./Tips/binaryId.md)

- [Automatiser la liste du cast d'un schema Ecto](./Tips/schemaEctoAutoCast.md)

- [Ecto avancé : changesets, associations, Multi, requêtes composables](./EctoAvance.md)

## Phoenix LiveView
- [LiveView : l'essentiel (cycle de vie, assigns, events, streams)](./LiveView/liveview.md)

## OTP / Concurrence
- [GenServer & Supervisor (Livebook exécutable)](./OTP/genserver_supervisor.livemd)

## Librairies utilitaires
- [Manipulation de date avec Timex](./Tips/TimexDate.livemd)

## Divers
- [Stemming reduction de mot](./Tips/stemming.livemd)
- [Exemple Tablex table de décision](./Tips/tablexExemple.livemd)

## Test unitaire
- [Test unitaire dans les commentaires](./Test_unitaire/testUnitaireDansLeCommentaire.md)
- [Tests avec ExUnit : bases, fixtures, Mox, ExMachina](./Test_unitaire/exunit_bases.md)


## Référence
- [📖 Glossaire FR ↔ EN des termes Elixir / Phoenix](./Glossaire.md)

## Projet fil rouge
- [🗂️ Kanban collaboratif temps réel (guidé, étape par étape)](./Projet/kanban_collaboratif.md)

## Algo
- [Binary Search](./Algorithme/binary_search.livemd)