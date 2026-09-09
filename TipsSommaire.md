# Quelques "Tips"
[Accueil](README.md) · [🧭 Parcours d'apprentissage](https://nseaseb.github.io/ElixirPhoenixRessources/parcours/)
Les fichiers `.livemd` sont des [Livebooks](https://livebook.dev/) : ils s'affichent comme du Markdown sur GitHub et peuvent être ouverts directement dans Livebook pour être exécutés.

Vous trouverez ici quelques notes d'astuces que je conserve ici.

## Bases du langage (🟢 à commencer dans l'ordre)
0. [Pièges quand on vient d'un langage objet](./Bases/pieges_venant_objet.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Bases/pieges_venant_objet.livemd) *(à lire en premier)*
1. [Immutabilité & pattern matching](./Bases/immutabilite_et_pattern_matching.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Bases/immutabilite_et_pattern_matching.livemd)
2. [Pipe `|>`, `with` et récursion](./Bases/pipe_with_recursion.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Bases/pipe_with_recursion.livemd)
3. [Enum, Stream & compréhensions](./Bases/enum_stream_comprehensions.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Bases/enum_stream_comprehensions.livemd)
4. [Structs, protocoles & behaviours](./Bases/structs_protocoles_behaviours.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Bases/structs_protocoles_behaviours.livemd)

## Ecto
- [--binary-id, vous avez oubliez de passer l'option, pas de panique !](./Tips/binaryId.md)

- [Automatiser la liste du cast d'un schema Ecto](./Tips/schemaEctoAutoCast.md)

- [Ecto avancé : changesets, associations, Multi, requêtes composables](./EctoAvance.md)

- [Jobs en arrière-plan avec Oban](./Tips/oban.md)

## Phoenix
- [Phoenix « classique » : routing, contexts & contrôleurs](./Phoenix/phoenix_sans_liveview.md)

## Phoenix LiveView
- [LiveView : l'essentiel (cycle de vie, assigns, events, streams)](./LiveView/liveview.md)

## OTP / Concurrence
- [GenServer & Supervisor (Livebook exécutable)](./OTP/genserver_supervisor.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/OTP/genserver_supervisor.livemd)

## Outillage
- [Mesurer le partage structurel](./Tips/partage_structurel.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/partage_structurel.livemd)
- [Un outil interne en trente lignes (Kino)](./Tips/outil_interne_livebook.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/outil_interne_livebook.livemd)

## Librairies utilitaires
- [Manipulation de date avec Timex](./Tips/TimexDate.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/TimexDate.livemd)

## Débogage
- [Débogage & outillage IEx (`iex`, `IO.inspect`, `dbg`, `pry`, `break!`)](./Tips/debogage_iex.md)
- [Lire une stacktrace / comprendre les erreurs](./Tips/lire_une_stacktrace.md)

## Divers
- [Stemming reduction de mot](./Tips/stemming.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/stemming.livemd)
- [Exemple Tablex table de décision](./Tips/tablexExemple.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Tips/tablexExemple.livemd)

## Test unitaire
- [Test unitaire dans les commentaires](./Test_unitaire/testUnitaireDansLeCommentaire.md)
- [Tests avec ExUnit : bases, fixtures, Mox, ExMachina](./Test_unitaire/exunit_bases.md)


## Référence
- [📖 Glossaire FR ↔ EN des termes Elixir / Phoenix](./Glossaire.md)

## Projet fil rouge
- [🗂️ Kanban collaboratif temps réel (guidé, étape par étape)](./Projet/kanban_collaboratif.md)

## Algo
- [Binary Search](./Algorithme/binary_search.livemd) [![Run in Livebook](https://livebook.dev/badge/v1/blue.svg)](https://livebook.dev/run?url=https://raw.githubusercontent.com/nseaSeb/ElixirPhoenixRessources/main/Algorithme/binary_search.livemd)