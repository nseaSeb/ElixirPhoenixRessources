[Accueil](README.md) · [🧭 Parcours d'apprentissage](PARCOURS.md)

# 📖 Glossaire Elixir / Phoenix — FR ↔ EN

La documentation officielle, les tutos et les messages d'erreur sont **en anglais**. Ce lexique donne, pour chaque terme, son équivalent français et son sens.

> 💡 **À savoir** : beaucoup de termes (`struct`, `changeset`, `behaviour`, `supervisor`…) **se gardent en anglais** dans le code et les conversations entre devs. La colonne « 🇫🇷 » sert à comprendre, pas forcément à traduire. La mention *(on garde l'anglais)* signale ces cas.

## Concepts du langage

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Pattern matching** | filtrage par motif | Comparer une valeur à une *forme* et en extraire des morceaux. Le `=` en fait. |
| **Match operator** | opérateur de correspondance | Le `=` : ce n'est *pas* une affectation. |
| **Pin operator** | opérateur d'épinglage | Le `^` : utiliser la valeur courante d'une variable comme motif. |
| **Immutability** | immuabilité | Les données ne changent jamais ; on en crée de nouvelles. |
| **Rebinding** | reliaison | Relier une variable à une nouvelle valeur (≠ mutation). |
| **Expression** | expression | Tout renvoie une valeur (même `if`, `case`…). |
| **Guard** | garde | Condition après `when` dans une clause (`when age >= 18`). |
| **Clause** | clause | Une des définitions d'une fonction (plusieurs motifs possibles). |
| **Arity** | arité | Nombre d'arguments d'une fonction, noté `nom/2`. |
| **Pipe operator** | opérateur pipe | Le `\|>` : passe le résultat comme 1er argument suivant. |
| **Sigil** | sigil *(on garde l'anglais)* | Notation `~` : `~r/.../` (regex), `~H"..."` (HEEx), `~U[...]` (date UTC). |
| **Comprehension** | compréhension | La construction `for x <- ..., do: ...`. |

## Données & types

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Atom** | atome | Constante dont le nom est la valeur : `:ok`, `:error`. |
| **Tuple** | tuple / n-uplet | Collection ordonnée de taille fixe : `{:ok, valeur}`. |
| **List** | liste | Liste chaînée : `[1, 2, 3]`. |
| **Map** | map / dictionnaire | Paires clé-valeur : `%{nom: "Ada"}`. |
| **Keyword list** | liste à mots-clés | Liste de tuples `{:cle, val}`, ordonnée : `[a: 1, b: 2]`. |
| **Struct** | structure *(on garde l'anglais)* | Map à clés connues, liée à un module : `%User{}`. |
| **Charlist** | liste de caractères | `'abc'` (≠ `"abc"` qui est un binary/String). Piège classique. |
| **Binary** | binaire | Suite d'octets ; une `String` Elixir est un binary UTF-8. |
| **Range** | intervalle | `1..10`. |
| **Nil** | nil / nul | Absence de valeur ; avec `false`, seule valeur « fausse ». |

## Fonctions & modules

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Module** | module | Espace de noms regroupant des fonctions (≠ classe). |
| **Function** | fonction | `def` (publique) / `defp` (privée). |
| **Anonymous function** | fonction anonyme | `fn x -> x end` ou `&(&1)`. |
| **Capture** | capture | Le `&` : `&String.upcase/1`, `&(&1 * 2)`. |
| **Higher-order function** | fonction d'ordre supérieur | Fonction qui prend/renvoie une fonction (`Enum.map`). |
| **Closure** | fermeture | Fonction qui capture des variables de son contexte. |
| **Recursion** | récursion | Une fonction qui s'appelle elle-même (remplace les boucles). |
| **Tail call / tail recursion** | récursion terminale | L'appel récursif est la dernière opération (sans débordement de pile). |
| **Accumulator** | accumulateur | Valeur transmise à chaque appel récursif pour cumuler un résultat. |

## Erreurs & flot

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Result tuple** | tuple de résultat | Convention `{:ok, val}` / `{:error, raison}`. |
| **Bang function** | fonction « bang » | Variante `nom!/1` qui **lève** au lieu de renvoyer un tuple. |
| **Raise / exception** | lever / exception | Pour les cas vraiment exceptionnels, pas le flot normal. |
| **Rescue** | rattraper | `try/rescue` (rare ; on préfère les tuples). |
| **MatchError** | erreur de correspondance | Le `=` n'a trouvé aucune correspondance. |
| **FunctionClauseError** | — | Aucune clause de fonction ne correspond aux arguments. |
| **Let it crash** | « laisse planter » | Philosophie OTP : laisser un processus mourir et le superviseur le relancer. |

## OTP & concurrence

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Process** | processus | Unité concurrente légère de la BEAM (≠ processus OS, ≠ thread). |
| **BEAM** | la machine virtuelle | La VM Erlang qui exécute Elixir. |
| **Message passing** | passage de messages | Les processus communiquent en s'envoyant des messages. |
| **Mailbox** | boîte aux lettres | File des messages reçus par un processus. |
| **GenServer** | serveur générique *(on garde l'anglais)* | Processus standard détenant un état et répondant aux messages. |
| **Callback** | fonction de rappel | Fonction qu'on implémente pour un comportement (`init`, `handle_call`…). |
| **Supervisor** | superviseur *(on garde l'anglais)* | Processus qui surveille et redémarre ses enfants. |
| **Supervision tree** | arbre de supervision | Hiérarchie de superviseurs et processus. |
| **Child spec** | spécification d'enfant | Description du démarrage d'un processus supervisé. |
| **Behaviour** | comportement *(on garde l'anglais)* | Contrat de fonctions à implémenter (type interface). |
| **State** | état | Donnée maintenue dans le temps par un processus. |
| **Node** | nœud | Une instance de la BEAM (utile en distribué). |

## Phoenix & web

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Endpoint** | point d'entrée | Porte d'entrée HTTP/WebSocket de l'app. |
| **Router** | routeur | Associe URL ↔ contrôleur / LiveView. |
| **Controller** | contrôleur | Gère une requête HTTP classique. |
| **Context** | contexte | Module-frontière entre le métier et le web (`Accounts`, `Kanban`…). |
| **Plug** | plug *(on garde l'anglais)* | Brique composable de traitement d'une requête (middleware). |
| **LiveView** | LiveView *(on garde l'anglais)* | Page interactive temps réel, état côté serveur. |
| **Assigns** | assigns *(on garde l'anglais)* | L'état d'une LiveView (`socket.assigns`). |
| **HEEx** | HEEx | Template HTML + Elixir, sigil `~H`. |
| **Component** | composant | Bout de UI réutilisable (function/live component). |
| **Hook** | hook *(on garde l'anglais)* | Pont vers du JavaScript côté client (`phx-hook`). |
| **Socket** | socket | Connexion LiveView/Channel + son état. |
| **Channel** | canal | Communication temps réel bidirectionnelle (WebSocket). |
| **PubSub** | publication/abonnement | Diffuser des messages à des abonnés (temps réel). |
| **Presence** | présence | Suivre qui est en ligne / connecté en temps réel. |
| **Mount** | montage | `mount/3` : initialisation d'une LiveView. |
| **Event** | événement | Action client (`phx-click`) traitée par `handle_event`. |

## Ecto (base de données)

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Repo** | dépôt *(on garde l'anglais)* | Le module qui parle à la base (`Repo.all`, `Repo.insert`). |
| **Schema** | schéma | Correspondance entre une table et une struct Elixir. |
| **Migration** | migration | Script versionné modifiant la structure de la base. |
| **Changeset** | changeset *(on garde l'anglais)* | Sas de cast + validation des données avant écriture. |
| **Cast** | caster / convertir | Filtrer et convertir les champs autorisés. |
| **Validation** | validation | Vérification en Elixir (`validate_required`…). |
| **Constraint** | contrainte | Règle vérifiée par la base (`unique_constraint`…). |
| **Association** | association | Lien entre schémas (`has_many`, `belongs_to`). |
| **Preload** | préchargement | Charger explicitement une association. |
| **Query** | requête | Requête composable (`from`, `where`…). |
| **Multi** | Multi *(on garde l'anglais)* | Enchaîner des opérations en une transaction (`Ecto.Multi`). |
| **Transaction** | transaction | Bloc « tout ou rien ». |
| **Seed** | données d'amorçage | Peupler la base avec des valeurs initiales. |
| **Sandbox** | bac à sable | Isolation des tests via une transaction annulée. |

## Tests & outils

| Terme (🇬🇧) | 🇫🇷 | Sens |
|---|---|---|
| **Doctest** | test dans la doc | Exemples `iex>` de la doc exécutés comme tests. |
| **Assertion** | assertion | Vérification d'un test (`assert`, `refute`). |
| **Fixture** | jeu de données de test | Données préparées avant un test (`setup`). |
| **Factory** | fabrique | Générateur de données de test (ExMachina). |
| **Mock** | simulacre / mock | Double de test (Mox) basé sur un behaviour. |
| **Mix** | Mix *(on garde l'anglais)* | L'outil de build et de tâches (`mix test`, `mix phx.server`). |
| **Hex** | Hex | Le gestionnaire de paquets. |
| **Dependency** | dépendance | Paquet externe déclaré dans `mix.exs`. |
| **Release** | release *(on garde l'anglais)* | Paquet de déploiement autonome de l'app. |
| **Dialyzer** | Dialyzer | Analyse statique des types (via Dialyxir). |
| **Telemetry** | télémétrie | Mesures/événements pour l'observabilité. |
| **Livebook** | Livebook | Bloc-notes interactif (les fichiers `.livemd`). |

---

## Faux-amis & pièges de vocabulaire

- **« process »** ≠ processus système ni thread : c'est un processus **léger de la BEAM** (on peut en avoir des millions).
- **« function »** ≠ « méthode » : il n'y a pas de méthodes (pas d'objets). On dit *fonction*.
- **« =» ** ≠ affectation : c'est du **pattern matching**.
- **`'abc'` (charlist)** ≠ **`"abc"` (String/binary)** : deux types différents.
- **« atom »** : ne pas en créer dynamiquement à l'infini (ils ne sont pas ramassés par le GC).
- **« nil »** : `0` et `""` sont **vrais** en Elixir (contrairement à Python/JS).

---

*La connaissance grandit quand on la partage.*
