[Accueil](README.md)

# 🧭 Parcours d'apprentissage Elixir / Phoenix

Cette page ordonne **toutes les notes de ce dépôt** dans un ordre d'apprentissage, du débutant à l'avancé. L'objectif : savoir *par où commencer* et *quoi lire ensuite*, plutôt que de piocher au hasard.

> Légende : 🟢 débutant · 🟡 intermédiaire · 🔴 avancé
> Les fichiers `.livemd` sont des [Livebooks](https://livebook.dev/) **exécutables** : ouvrez-les dans Livebook pour modifier et lancer le code en direct.

## Avant de commencer

1. Installer Elixir : https://elixir-lang.org/install.html
2. Installer [Livebook](https://livebook.dev/) (bureau ou `mix escript`) pour exécuter les notebooks.
3. Garder sous la main la doc officielle : https://hexdocs.pm/elixir et https://hexdocs.pm/phoenix

---

## 🟢 Étape 1 — Les bases du langage

Le socle. À suivre **dans l'ordre** : chaque notebook s'appuie sur le précédent.

0. [Pièges quand on vient d'un langage objet](Bases/pieges_venant_objet.livemd) — **à lire en premier** : les réflexes Java / C# / Python / JS à désamorcer.
1. [Immutabilité & pattern matching](Bases/immutabilite_et_pattern_matching.livemd) — le changement de mentalité quand on vient de Python / JS / PHP / Java.
2. [Pipe `|>`, `with` & récursion](Bases/pipe_with_recursion.livemd) — écrire des enchaînements lisibles, « boucler » sans boucle.
3. [Enum, Stream & compréhensions](Bases/enum_stream_comprehensions.livemd) — manipuler les collections comme un Elixirien.

**Objectif atteint :** lire et écrire du code Elixir idiomatique simple.

---

## 🟡 Étape 2 — Structurer & faire tourner des processus

4. [Structs, protocoles & behaviours](Bases/structs_protocoles_behaviours.livemd) — modéliser ses données, les deux formes de polymorphisme.
5. [OTP : GenServer & Supervisor](OTP/genserver_supervisor.livemd) — l'état dans un processus, le « let it crash », la supervision (le cœur d'Elixir).

**Objectif atteint :** organiser son code et comprendre le modèle de concurrence d'Elixir.

---

## 🟡 Étape 3 — Persister des données avec Ecto

6. [Ecto — les bases](Ecto.md) — migrations, schémas, seeds.
7. [Ecto avancé](EctoAvance.md) — changesets & validations, associations / preload, transactions (`Ecto.Multi`), requêtes composables.

Tips associés : [oubli de `--binary-id`](Tips/binaryId.md) · [automatiser le cast d'un schéma](Tips/schemaEctoAutoCast.md)

**Objectif atteint :** modéliser une base, valider les entrées, écrire des requêtes propres.

---

## 🟡 Étape 4 — Tester son code

8. [Test unitaire dans les commentaires (doctests)](Test_unitaire/testUnitaireDansLeCommentaire.md) — la porte d'entrée.
9. [Tests avec ExUnit](Test_unitaire/exunit_bases.md) — `describe`/`test`, fixtures, mocks (Mox), données de test (ExMachina + Faker), sandbox Ecto.

**Objectif atteint :** écrire des tests fiables et isolés.

---

## 🔴 Étape 5 — Construire une interface temps réel

10. [Phoenix LiveView — l'essentiel](LiveView/liveview.md) — cycle de vie, assigns, events, PubSub, streams, Hooks JS.

Exemples concrets de Hooks : [sortable.js (drag & drop)](https://github.com/nseaSeb/SortableBoilerPlate) · [clic droit](https://github.com/nseaSeb/right-click-elixir)

**Objectif atteint :** des pages interactives sans (presque) écrire de JavaScript.

---

## 🏁 Étape 6 — Le projet fil rouge

Quand tu as parcouru les étapes ci-dessus, mets tout en pratique :

- [🗂️ Kanban collaboratif temps réel](Projet/kanban_collaboratif.md) — un Trello-like multi-utilisateur en drag & drop, construit pas à pas. Chaque étape du projet réutilise une notion du parcours (logique pure → Ecto → tests → LiveView → PubSub → bonus OTP).

**Objectif atteint :** assembler tout le parcours dans une vraie application temps réel.

---

## 🎯 Parcours par objectif

| Je veux… | Lire en priorité |
|---|---|
| **Comprendre la mentalité fonctionnelle** | Étape 1 (bases 1→3) |
| **Faire de la concurrence / du temps réel** | [OTP](OTP/genserver_supervisor.livemd) puis [LiveView](LiveView/liveview.md) |
| **Manipuler une base de données** | [Ecto](Ecto.md) → [Ecto avancé](EctoAvance.md) |
| **Sécuriser mon code par des tests** | [ExUnit](Test_unitaire/exunit_bases.md) |
| **Construire une UI réactive** | [LiveView](LiveView/liveview.md) |

---

## 🧰 Boîte à outils (à consulter au besoin)

- [Liste de librairies utiles](Librairie.md)
- Tips divers : [manipulation de dates (Timex)](Tips/TimexDate.livemd) · [stemming](Tips/stemming.livemd) · [table de décision (Tablex)](Tips/tablexExemple.livemd)
- Algorithmes : [recherche dichotomique](Algorithme/binary_search.livemd)
- [Ressources externes, blogs, vidéos, livres](README.md) (le README principal)

---

## 🚧 À venir (idées de contenus)

Pistes pour enrichir le parcours — contributions bienvenues :

- 🟢 Glossaire FR ↔ EN des termes incontournables
- 🟢 Lire et comprendre une stacktrace / les erreurs Elixir
- 🟡 Phoenix hors LiveView : routing, contexts, contrôleurs
- 🟡 Jobs en arrière-plan avec Oban
- 🔴 Déploiement (Fly.io, releases, `runtime.exs`)

---

*La connaissance grandit quand on la partage.*
