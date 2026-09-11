# Librairies 
[Accueil](README.md)

https://hexdocs.pm/ (HEXDOCS heberge la documentation des packages HEX.)

## Utilitaires
-   https://hexdocs.pm/timex/Timex.html (librairie pour les dates)
-   https://hexdocs.pm/jason/readme.html (JSON)
-   https://hexdocs.pm/bcrypt_elixir/readme.html (hash mot de passe bcrypt)
-   https://hexdocs.pm/tablex/readme.html (table de décision, [Exemple Tablex table de décision](./Tips/tablexExemple.livemd))
-   https://github.com/dashbitco/nimble_csv (lecture et écriture de CSV, rapide et sans dépendance)
-   https://github.com/elixir-image/image (redimensionnement, recadrage et conversion d'images, adossé à libvips)
-   https://github.com/bitcrowd/chromic_pdf (génération de PDF en pilotant un Chrome sans interface)
-   https://github.com/tompave/fun_with_flags (feature flags persistés, avec une interface web d'administration)
-   https://github.com/quantum-elixir/quantum-core (tâches planifiées à la crontab, dans la BEAM)
-   https://github.com/ExHammer/hammer (limitation de débit : plafonner les appels par utilisateur ou par adresse IP)
-   https://github.com/beam-community/stripity-stripe (client Stripe, pour les paiements)

## HTTP / API
-   https://github.com/wojtekmach/req (client HTTP moderne, devenu le défaut de la communauté)
-   https://github.com/mtrudel/bandit (serveur HTTP en Elixir pur, remplaçant de Cowboy)
-   https://github.com/absinthe-graphql/absinthe (la référence GraphQL pour Elixir)

## Ecto / DB
-   https://hexdocs.pm/query_builder/readme.html (Composer des query avec des datas)
-   https://hexdocs.pm/triplex/Triplex.html (Multi-tenant postgres / ecto)
-   https://github.com/elixir-sqlite/ecto_sqlite3 (adaptateur SQLite, pratique pour un prototype ou une application embarquée)
-   https://github.com/pgvector/pgvector-elixir (le type vecteur de PostgreSQL dans Ecto, pour la recherche sémantique)

## Frameworks applicatifs
-   https://hexdocs.pm/ash/ (Ash, framework déclaratif : on décrit des ressources, le reste se déduit — API, formulaires, autorisations, migrations)

## Authentification et autorisation
-   `mix phx.gen.auth` (le générateur livré avec Phoenix : il écrit le code d'authentification dans votre application, c'est le point de départ recommandé — [documentation](https://hexdocs.pm/phoenix/mix_phx_gen_auth.html))
-   https://github.com/riverrun/argon2_elixir (hachage de mots de passe avec Argon2, l'algorithme recommandé par l'OWASP ; `mix phx.gen.auth` le propose en option, bcrypt restant son défaut)
-   https://github.com/ueberauth/ueberauth (connexion par un fournisseur tiers — Google, GitHub, etc. — sur le modèle d'OmniAuth)
-   https://github.com/pow-auth/assent (le même besoin sans dépendance à Plug, utilisable hors d'une application web)
-   https://github.com/schrockwell/bodyguard (autorisations déclarées comme des politiques, rattachées aux contextes Phoenix)
-   https://github.com/woylie/let_me (autorisations décrites dans une DSL, avec introspection et génération de documentation)

## Cache
-   https://github.com/whitfin/cachex (cache en mémoire avec expiration, limites de taille et statistiques)
-   https://github.com/cabol/nebulex (cache à plusieurs niveaux, y compris distribué sur plusieurs nœuds)

## Distribution et cluster
-   https://github.com/bitwalker/libcluster (formation automatique du cluster BEAM, avec des stratégies pour Kubernetes, DNS ou gossip)
-   https://github.com/derekkraan/horde (registre et superviseur distribués, pour qu'un processus survive à la perte de son nœud)
-   https://github.com/phoenixframework/flame (déporter une fonction coûteuse sur une machine éphémère, allumée le temps du calcul)

## Outils base de données (GUI)
-   https://www.pgadmin.org/ (pgAdmin, le client graphique officiel de PostgreSQL)
-   https://dbeaver.io/ (DBeaver, client universel gratuit et open source)
-   https://tableplus.com/ (TablePlus, interface soignée, freemium)
-   https://www.beekeeperstudio.io/ (Beekeeper Studio, open source et moderne)

## Localisation
- https://github.com/elixir-gettext/gettext
-   https://github.com/elixir-cldr/cldr (formats de dates, de nombres et de listes selon la locale, à partir des données Unicode CLDR ; le socle d'une application réellement francisée)
-   https://github.com/kipcole9/money (le paquet `ex_money` : un type monétaire avec devise, arithmétique exacte et formatage localisé, adossé à `ex_cldr`)

## HTML / CSS
-   https://hexdocs.pm/tailwind/Tailwind.html (tailwind installateur et exec)
-   https://hexdocs.pm/plug_cowboy/Plug.Cowboy.html (HTTP)
-   https://github.com/philss/floki (Analyseur HTML qui permet de rechercher des nodes à l'aide de sélecteurs CSS.)
-   https://github.com/sezaru/flashy (Lib sympa pour améliorer les messages flash)

## Email
- https://github.com/swoosh/swoosh (email)

## Jobs en arrière-plan
-   https://github.com/oban-bg/oban (jobs persistants basés sur PostgreSQL, le standard de facto)

## Traitement de données
-   https://github.com/dashbitco/broadway (pipelines d'ingestion de données concurrents et tolérants aux pannes)

## Machine Learning / Data
-   https://github.com/elixir-nx/nx (tenseurs et calcul numérique, la base de l'écosystème ML)
-   https://github.com/elixir-nx/axon (réseaux de neurones construits sur Nx)
-   https://github.com/elixir-nx/explorer (dataframes à la pandas / polars)
-   https://github.com/elixir-nx/bumblebee (modèles pré-entraînés Hugging Face en quelques lignes)

## Écosystème LiveView
-   https://github.com/woutdp/live_svelte (des composants Svelte pilotés par une LiveView, quand un morceau d'interface demande du JavaScript)
-   https://github.com/Valian/live_vue (le même principe avec Vue)
-   https://github.com/bluzky/salad_ui (des composants dans l'esprit de shadcn/ui, écrits en HEEx)
-   https://github.com/naymspace/backpex (une interface d'administration générée à partir des schémas Ecto)
-   https://github.com/phenixdigital/phoenix_storybook (catalogue interactif des composants, à la Storybook)
-   https://github.com/woylie/flop (tri, filtrage et pagination d'une requête Ecto) et https://github.com/woylie/flop_phoenix (les composants de table et de pagination correspondants)

## Fichiers et stockage
-   https://github.com/elixir-waffle/waffle (téléversement de fichiers : transformations, stockage local ou S3)
-   https://github.com/ex-aws/ex_aws_s3 (client S3, également compatible avec les services qui en implémentent l'API)

## Blog et site statique
-   https://hexdocs.pm/nimble_publisher (transforme un dossier de fichiers Markdown en modules Elixir compilés : la manière la plus simple d'ajouter un blog à une application Phoenix)
-   https://github.com/elixir-tools/tableau (générateur de site statique en Elixir, avec rechargement à chaud pendant l'écriture)

## Interopérabilité
-   https://github.com/rusterlium/rustler (écrire une NIF en Rust sans risquer de faire tomber la machine virtuelle)
-   https://github.com/livebook-dev/pythonx (exécuter du Python dans le même processus système, pour réutiliser une bibliothèque qui n'existe pas sur la BEAM)

## Architecture et event sourcing
-   https://github.com/commanded/commanded (CQRS et event sourcing : agrégats, commandes, projections)

## LLM et agents
-   https://github.com/brainlid/langchain (chaînes d'appels à un modèle de langage, avec gestion des outils et des conversations)
-   https://github.com/agentjido/req_llm (un client unifié pour plusieurs fournisseurs de modèles, bâti sur Req)
-   https://github.com/ash-project/usage_rules (rassemble les règles d'usage des dépendances dans un fichier destiné aux assistants de code)

## Outils de dev
-   https://github.com/ash-project/igniter (générateurs intelligents : installer et configurer des libs en patchant le code)
-   https://github.com/tidewave-ai/tidewave_phoenix (connecter un assistant IA au runtime de votre app Phoenix via MCP)
-   https://github.com/phoenix-playground/phoenix_playground (Phoenix en un seul fichier, idéal pour prototyper ou reproduire un bug)
-   https://github.com/elixir-lang/ex_doc (le générateur de documentation de l'écosystème, celui qui alimente HexDocs)
-   https://github.com/adobe/elixir-styler (greffon de `mix format` qui réécrit le code selon le guide de style communautaire)
-   https://github.com/bencheeorg/benchee (mesure de performances : comparaison d'implémentations, écart-type, mémoire)
-   https://github.com/mirego/mix_audit (confronte les dépendances aux vulnérabilités connues)
-   https://github.com/Artur-Sulej/excellent_migrations (repère les migrations qui verrouillent une table en production)
-   https://github.com/sasa1977/boundary (déclare les frontières entre contextes et émet un avertissement à la compilation quand une dépendance les franchit)
-   https://github.com/software-mansion/live-debugger (inspecter l'état et les assigns d'une LiveView pendant qu'elle tourne)

## Tests
-   https://hexdocs.pm/faker/readme.html (lib générer des données de tests)
-   https://github.com/whatyouhide/stream_data (property-based testing : générer des entrées aléatoires pour éprouver son code)
-   https://github.com/elixir-wallaby/wallaby (tests navigateur end-to-end, pilote un vrai navigateur)
-   https://github.com/dashbitco/mox (mocks basés sur des comportements, la méthode recommandée par José Valim)
-   https://github.com/PSPDFKit-labs/bypass (démarre un vrai serveur HTTP local pour tester un client sans toucher au réseau)
-   https://github.com/germsvel/phoenix_test (une seule API de test qui traverse indifféremment les pages statiques et les LiveView)
-   https://github.com/thoughtbot/ex_machina (fabriques de données de test, à la façon de FactoryBot)
-   https://github.com/parroty/excoveralls (couverture de code, avec remontée vers Coveralls)
