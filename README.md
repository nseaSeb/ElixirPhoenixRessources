# <img src="https://hexdocs.pm/phoenix/assets/logo.png"> Ressources Elixir / Phoenix

[![Licence MIT](https://img.shields.io/badge/licence-MIT-green.svg)](LICENSE)
[![PRs bienvenues](https://img.shields.io/badge/PRs-bienvenues-brightgreen.svg)](https://github.com/nseaSeb/ElixirPhoenixRessources/pulls)

L'idée ici, au fur et à mesure de mon apprentissage du langage est de regrouper des ressources à propos d'Elixir / Phoenix principalement en Français ainsi que certaines de mes notes.
Une sorte d'awesome Elixir.

> 🧭 **Nouveau ou perdu ?** Suivez le [**Parcours d'apprentissage**](PARCOURS.md) : toutes mes notes ordonnées du débutant à l'avancé.

> ✍️ **Le blog** : [articles Elixir / Phoenix en français](https://nseaseb.github.io/ElixirPhoenixRessources/) — le contenu francophone qui manque à l'écosystème. ([flux RSS](https://nseaseb.github.io/ElixirPhoenixRessources/feed.xml))

## Sommaire

- [🧭 Parcours d'apprentissage](PARCOURS.md)
- [✍️ Le blog](https://nseaseb.github.io/ElixirPhoenixRessources/)
- [Liens majeurs](#liens-majeurs)
- [Communauté](#communauté)
- [Contribuer](#contribuer)
- [Framework et librairies](#framework-et-librairies)
- [Projets open source à explorer](#projets-open-source-à-explorer)
- [Ma modeste contribution](#ma-modeste-contribution)
- [Vérificateurs de code](#vérificateurs-de-code)
- [Style et bonnes pratiques](#style-et-bonnes-pratiques)
- [Antisèches (Cheatsheets)](#antisèches-cheatsheets)
- [Blogs et articles](#blogs-et-articles)
- [Newsletters](#newsletters)
- [Podcasts](#podcasts)
- [Vidéos, tutos, formations](#vidéos-tutos-formations)
- [S'entraîner](#sentraîner)
- [Déploiement](#déploiement)
- [Livres](#livres)
- [Extensions VSCode](#extensions-vscode)
- [Thèmes VSCode](#thèmes-vscode)
- [Conférences](#conférences)
- [Autres liens utiles](#autres-liens-utiles)
- [Licence](#licence)

## Liens majeurs

- [elixir-lang.org](https://elixir-lang.org/) — le site officiel du langage
- [phoenixframework.org](https://www.phoenixframework.org/) — le framework web de référence
- [Hex](https://hex.pm/) — le gestionnaire de paquets de l'écosystème Erlang / Elixir
- [HexDocs](https://hexdocs.pm/) — la documentation de tous les paquets Hex
- [Livebook](https://livebook.dev/) — blocs-notes interactifs et exécutables
- [Guide officiel « Getting Started »](https://hexdocs.pm/elixir/introduction.html) — le tutoriel de référence du langage
- [Blog Elixir](https://elixir-lang.org/blog/) — annonces de versions et articles de l'équipe cœur
- [Blog Phoenix](https://www.phoenixframework.org/blog) — annonces et nouveautés du framework

## Contribuer

**Ce dépôt est ouvert, et l'envie est d'amorcer une petite communauté Elixir francophone.** Il n'existe presque pas de contenu Elixir vivant en français : les rares articles datent d'il y a des années, certains ont disparu du web avec leur hébergeur, et la rubrique « newsletters en français » ci-dessous est vide faute de candidat. Ce n'est pas faute de développeurs francophones — c'est faute d'endroit où publier.

Quatre façons d'aider, de la plus petite à la plus grande :

- **corriger une coquille** — chaque article du blog a un lien « Proposer une correction » qui ouvre l'éditeur GitHub sur le bon fichier ;
- **ajouter une ressource** à cette liste, surtout en français ;
- **proposer un sujet d'article** dans une [issue](https://github.com/nseaSeb/ElixirPhoenixRessources/issues) — dire ce qui manque est déjà une contribution ;
- **écrire un article** pour le blog, avec votre nom dessus.

Tout est détaillé dans le [**guide de contribution**](CONTRIBUTING.md) : la marche à suivre, les deux pièges techniques à connaître, comment prévisualiser en local, et une liste de sujets recherchés.

Pas besoin d'être expert : un article écrit par quelqu'un qui vient de comprendre une chose est souvent meilleur que celui d'un expert, parce qu'il se souvient encore de ce qui coinçait.

## Communauté

- [Elixir Forum](https://elixirforum.com/) — le forum de référence, en anglais
- [Discord Elixir officiel](https://discord.gg/elixir) — le serveur international
- [Liste des meetups Elixir](https://github.com/elixir-lang/elixir/wiki/Meetups) — recensés dans le wiki officiel
- [genserver.social](https://genserver.social/) — l'instance Mastodon de la communauté BEAM

## Framework et librairies

- [Liste de librairies](Librairie.md) — ma sélection commentée (dates, JSON, Ecto, email, jobs, ML…)
- [Petal](https://petal.build/) — composants basés sur Tailwind CSS, boilerplate pro intéressant
- [Ash Framework](https://ash-hq.org/) — modélisation de domaine déclarative
- [Hologram](https://github.com/bartblast/hologram) — framework full-stack qui tourne **par-dessus Phoenix** : on écrit le frontend interactif en Elixir (compilé en JavaScript), une alternative à LiveView / au JS
- [design-patterns-in-elixir](https://github.com/joshnuss/design-patterns-in-elixir) — les design patterns classiques du GoF implémentés en Elixir
- [awesome-elixir](https://github.com/h4cc/awesome-elixir) — la méta-liste de référence (en anglais)
- [Elixir Toolbox](https://elixir-toolbox.dev/) — annuaire de librairies et d'outils classés par catégorie

## Projets open source à explorer

De vraies applications à lire pour voir Elixir « en conditions réelles ».

- [Plausible Analytics](https://github.com/plausible/analytics) — l'alternative open source à Google Analytics, un projet phare Elixir / Phoenix
- [Mobilizon](https://framagit.org/kaihuri/mobilizon) — plateforme d'événements décentralisée (français), en Elixir / Phoenix ; le dépôt a quitté le namespace Framasoft
- [Changelog.com](https://github.com/thechangelog/changelog.com) — le site du podcast The Changelog, codebase Phoenix idéale pour apprendre
- [Firezone](https://github.com/firezone/firezone) — gestion d'accès réseau sécurisé (VPN), interface d'admin en Elixir / Phoenix
- [Livebook](https://github.com/livebook-dev/livebook) — les blocs-notes interactifs eux-mêmes : un superbe exemple de LiveView à grande échelle
- [Supabase Realtime](https://github.com/supabase/realtime) — serveur WebSocket (broadcast, presence, écoute des changements Postgres) écrit en Elixir / Phoenix
- [Anoma](https://github.com/anoma/anoma) — implémentation de référence du protocole Anoma (systèmes distribués, consensus, P2P), quasi 100 % Elixir
- [Xberg](https://github.com/xberg-io/xberg) — framework d'extraction de contenu de documents (96+ formats) ; cœur en Rust avec un binding Elixir

## Ma modeste contribution

- [Sommaire de mes tips](TipsSommaire.md)
- [Les bases du langage (parcours de 4 Livebooks)](Bases/immutabilite_et_pattern_matching.livemd)
- [📖 Glossaire FR ↔ EN des termes Elixir / Phoenix](Glossaire.md)
- [Mes notes à propos d'Ecto](Ecto.md) ([Ecto avancé](EctoAvance.md))
- [Phoenix « classique » : routing, contexts & contrôleurs](Phoenix/phoenix_sans_liveview.md)
- [LiveView : l'essentiel](LiveView/liveview.md)
- [Lire une stacktrace / comprendre les erreurs](Tips/lire_une_stacktrace.md)
- [OTP : GenServer & Supervisor (Livebook)](OTP/genserver_supervisor.livemd)
- [Tests avec ExUnit](Test_unitaire/exunit_bases.md)
- [🗂️ Projet fil rouge : Kanban collaboratif temps réel](Projet/kanban_collaboratif.md)
- [Exemple d'implémentation Hook sortable.js](https://github.com/nseaSeb/SortableBoilerPlate)
- [Exemple d'implémentation Hook clic droit](https://github.com/nseaSeb/right-click-elixir)

## Vérificateurs de code

- [Credo](https://github.com/rrrene/credo) — analyse statique / linter, l'incontournable de tout projet
- [Sobelow](https://github.com/nccgroup/sobelow) — analyse de sécurité dédiée aux projets Phoenix
- [Dialyxir](https://github.com/jeremyjh/dialyxir) — Dialyzer pour Elixir, probablement le plus utilisé pour le typage
- [Gradient](https://github.com/esl/gradient) — typage graduel
- [TypeCheck](https://github.com/Qqwy/elixir-type_check) — vérifications de types à l'exécution
- [eqWAlizer](https://github.com/WhatsApp/eqwalizer) — le vérificateur de types de WhatsApp
- [Gradualizer](https://github.com/josefs/Gradualizer) — typage graduel pour la BEAM

## Style et bonnes pratiques

- [elixir_style_guide](https://github.com/christopheradams/elixir_style_guide) — le guide de style communautaire de référence
- [Elixir Code Smells](https://github.com/lucasvegi/Elixir-Code-Smells) — catalogue des « odeurs de code » propres à Elixir, avec exemples et refactorings
- [Elixir Refactorings](https://github.com/lucasvegi/Elixir-Refactorings) — catalogue de refactorings du même auteur, complémentaire du précédent

## Antisèches (Cheatsheets)

- [Enum cheatsheet officielle](https://hexdocs.pm/elixir/enum-cheat.html) — toutes les fonctions d'`Enum` sur une page, dans HexDocs
- [devhints.io — Elixir](https://devhints.io/elixir) — antisèche générale de la syntaxe du langage
- [Phoenix cheatsheet](https://lib.marinovic.dev/phoenix) — surtout les générateurs `mix phx.gen.*` (travail en cours, sans version indiquée)
- [Tailwind cheatsheet](https://tailwindcomponents.com/cheatsheet/)

## Blogs et articles

### En français

- [**Elixir & Phoenix en français**](https://nseaseb.github.io/ElixirPhoenixRessources/) — le blog de ce dépôt : des articles en français, sur des problèmes concrets ([RSS](https://nseaseb.github.io/ElixirPhoenixRessources/feed.xml))
- [Synbioz](https://web.archive.org/web/20240117050225/https://www.synbioz.com/blog/tech) — articles techniques d'une société de dev française ; **le site n'existe plus**, lien vers l'archive Wayback
- [Introduction à LiveView](https://www.cryptr.co/fr/blog/a-simple-introduction-to-phoenix-liveview) (Cryptr)
- [Découvrir la librairie Ecto](https://www.cryptr.co/fr/blog/introducing-the-ecto-library-for-elixir) (Cryptr)
- [Introduction à Phoenix, épisode 3 : Ecto](https://web.archive.org/web/20230922090958/https://www.synbioz.com/blog/tech/introduction-a-phoenix-episode-3) (Synbioz — archive Wayback, le site est hors ligne)

### En anglais — blogs à suivre

- [Elixir School](https://elixirschool.com/fr) — leçons structurées, partiellement traduites en français
- [Dashbit](https://dashbit.co/blog) — le blog de l'équipe de José Valim
- [Fly.io Phoenix Files](https://fly.io/phoenix-files/) — articles Phoenix d'un hébergeur
- [DockYard](https://dockyard.com/blog?filter=elixir) — blog d'une agence historique de l'écosystème
- [Geoffrey Lessel](https://geoffreylessel.com/) — auteur du fameux livre « Phoenix in Action »
- [Alex Koutmos](https://akoutmos.com/) — articles d'un dev
- [Sequin — Between the Ctrl-Cs](https://blog.sequin.io/between-the-ctrl-cs/) — articles d'un dev
- [Hashrocket](https://hashrocket.com/blog) — blog d'une agence
- [Underjord](https://underjord.io/blog.html) — le blog de Lars Wikman
- [DevTalk Elixir](https://devtalk.com/elixir) — forum / communauté
- [AppSignal — catégorie Elixir](https://blog.appsignal.com/category/elixir.html) — articles techniques réguliers et fouillés
- [Curiosum](https://curiosum.com/blog) — blog d'une agence, beaucoup de contenu Phoenix / LiveView (moins actif depuis 2024)
- [Peter Ullrich](https://peterullrich.com/) — articles Phoenix, Ecto et LiveView, toujours actif (2026) ; c'est aussi l'auteur de la formation « Build a MVP with Elixir » citée plus bas

### En anglais — articles choisis

- [Build a REST API with Elixir & Phoenix](https://blog.logrocket.com/build-rest-api-elixir-phoenix/) (LogRocket)
- [Prefixed base62 UUIDv7 object IDs with Ecto](https://danschultzer.com/posts/prefixed-base62-uuidv7-object-ids-with-ecto) (Dan Schultzer)
- [Phoenix Channels : réduire la consommation mémoire avec `ERL_FULLSWEEP_AFTER`](https://blog.guzman.codes/using-phoenix-channels-high-memory-usage-save-money-with-erlfullsweepafter) (Guzmán)

## Newsletters

### En français

Pour le moment rien à proposer.

### En anglais

- [Elixir LibHunt (Awesome Elixir Weekly)](https://elixir.libhunt.com/newsletter) — **incontournable** : le récap hebdomadaire des projets et articles de l'écosystème
- [Elixir Radar](https://elixir-radar.com/) — **la** newsletter hebdomadaire de référence
- [ElixirWeekly](https://elixirweekly.net/) — le récap hebdomadaire de ce qui passe sur ElixirStatus et le web
- [Elixir Merge](https://elixirmerge.com/) — éditions très courtes, deux liens commentés à chaque fois, rythme quotidien annoncé
- [ElixirStatus](https://elixirstatus.com/) — annoncez votre nouveau projet, article de blog ou release

## Podcasts

En anglais :

- [Thinking Elixir](https://podcast.thinkingelixir.com/) — actualité de l'écosystème et interviews, hebdomadaire
- [Elixir Wizards](https://smartlogic.io/podcast/elixir-wizards/) — interviews thématiques organisées par saisons
- [Elixir Outlaws](https://elixiroutlaws.com/) — discussions informelles entre devs ; **arrêté**, dernier épisode en décembre 2023, les archives restent excellentes
- [BEAM Radio](https://www.beamrad.io/) — autour de la BEAM au sens large (Elixir, Erlang, Gleam…)

## Vidéos, tutos, formations

### En français

- [Elixir School](https://elixirschool.com/fr) — tout n'est pas encore disponible en français
- [Xavki](https://www.youtube.com/@xavki) — une mine d'or de vidéos
- [ElixirMax](https://www.youtube.com/@elixirmax6760) — une chaine YouTube dédiée à Elixir / Phoenix
- [Un échange qui donne envie d'essayer](https://www.youtube.com/watch?v=SKby3QfJjng)

### En anglais

- [Pragmatic Studio](https://online.pragmaticstudio.com/) — formation qualitative
- [Formation Phoenix de 5h](https://www.youtube.com/watch?v=IiIgm_yaoOA) — vraiment bien
- [Backend Stuff](https://www.youtube.com/@backendstuff) — excellente chaine réalisée par Jacob Luetzow
- [José Valim présente Bumblebee (ML)](https://www.youtube.com/watch?v=g3oyh3g1AtQ)
- [Build a MVP with Elixir](https://pjullrich.gumroad.com/l/bmvp) — formation Phoenix autour d'un projet
- [Elixir Streams](https://www.elixirstreams.com/) — les tips vidéo très courts de German Velasco, mis à jour régulièrement
- [ElixirCasts](https://elixircasts.io/) — 200+ screencasts Elixir / Phoenix, une partie gratuite
- [Alchemist Camp](https://alchemist.camp/) — gros catalogue de screencasts orientés projet, une bonne partie en accès libre
- [Tutos et formations sur Gumroad](https://discover.gumroad.com/?query=elixir+phoenix)

## S'entraîner

- [Exercism — piste Elixir](https://exercism.org/tracks/elixir) — exercices progressifs corrigés, avec mentorat gratuit
- [Advent of Code](https://adventofcode.com/) — se prête très bien à une résolution en Livebook
- [Codewars](https://www.codewars.com/?language=elixir) — katas avec classement communautaire
- [30 Days of Elixir](https://github.com/seven1m/30-days-of-elixir) — une traversée du langage en 30 exercices progressifs (bases → OTP → macros)
- [Elixir Koans](https://github.com/elixirkoans/elixir-koans) — apprendre le langage en réparant des tests qui échouent (`mix meditate`)

## Déploiement

- [Guide officiel des releases (`mix release`)](https://hexdocs.pm/mix/Mix.Tasks.Release.html) — construire une release auto-portante, la base de tout déploiement moderne
- [Déploiement dans le guide Phoenix](https://hexdocs.pm/phoenix/deployment.html) — la référence pour mettre une app Phoenix en production
- [Configuration à l'exécution avec `runtime.exs`](https://hexdocs.pm/phoenix/releases.html) — lire les variables d'environnement au démarrage de la release
- [Fly.io — déployer Phoenix](https://fly.io/docs/elixir/getting-started/) — hébergeur très utilisé dans la communauté, support clustering natif
- [Gigalixir](https://www.gigalixir.com/) — PaaS spécialisé Elixir (hot upgrades, clustering, sans limite de sommeil)
- [Préparer une app Phoenix au déploiement avec les releases](https://blog.miguelcoba.com/preparing-a-phoenix-16-app-for-deployment-with-elixir-releases) (Miguel Cobá) — tutoriel pas à pas

## Livres

### En anglais

- [**Elixir in Action**](https://www.manning.com/books/elixir-in-action-third-edition) — le livre le plus apprécié (3e édition, déc. 2023)
- [**Programming Phoenix 1.4**](https://pragprog.com/titles/phoenix14/programming-phoenix-1-4/) — un des plus appréciés à propos de Phoenix
- [**Phoenix in Action**](https://www.manning.com/books/phoenix-in-action) — attention, ancienne version de Phoenix
- [Programming Phoenix LiveView](https://pragprog.com/titles/liveview/programming-phoenix-liveview/) — LE livre sur LiveView (édition finale 2026)
- [Elixir Patterns](https://pragprog.com/titles/d-akelixir/elixir-patterns/) — les patterns idiomatiques du langage (2025)
- [Ash Framework](https://pragprog.com/titles/ldash/ash-framework/) — le livre sur Ash, co-écrit par Zach Daniel, créateur du framework (2025)
- [Designing Elixir Systems with OTP](https://pragprog.com/titles/jgotp/designing-elixir-systems-with-otp/) — comment structurer une vraie application OTP
- [Programming Ecto](https://pragprog.com/titles/wmecto/programming-ecto/) — la référence sur Ecto
- [Testing Elixir](https://pragprog.com/titles/lmelixir/testing-elixir/) — ExUnit, mocks, property-based testing, tests d'intégration
- [Real-Time Phoenix](https://pragprog.com/titles/sbsockets/real-time-phoenix/) — Channels, PubSub et temps réel à l'échelle
- [Machine Learning in Elixir](https://pragprog.com/titles/smelixir/machine-learning-in-elixir/) — Nx, Axon et Bumblebee en pratique
- [Network Programming in Elixir and Erlang](https://pragprog.com/titles/alnpee/network-programming-in-elixir-and-erlang/) — TCP/UDP et protocoles réseau (2025)
- [The Beam Book](https://happi.github.io/theBeamBook/) — **gratuit**, le fonctionnement interne de la machine virtuelle BEAM
- [Joy of Elixir](https://joyofelixir.com/) — **gratuit**, une introduction très douce au langage pour débutants
- [Ebook 100 Elixir tips](https://miguelcoba.gumroad.com/l/100elixirtips) (Miguel Cobá)
- [ElixirBooks](https://github.com/sger/ElixirBooks) — liste de livres Elixir maintenue par la communauté

### En français

- [Elixir (Eyrolles)](https://www.eyrolles.com/Informatique/Livre/elixir-9782416011757/) — le premier et le seul en français sur le langage pour le moment
- [SQL : Au cœur des performances](https://sql-au-coeur-des-performances.fr/) (Markus Winand) — **incontournable** sur l'indexation et les performances SQL ; transversal, très utile derrière Ecto

## Extensions VSCode

- [ElixirLS](https://marketplace.visualstudio.com/items?itemName=JakeBecker.elixir-ls) — support Elixir et débogueur ; toujours le choix par défaut aujourd'hui
- [Expert](https://expert-lsp.org/) — le **futur serveur de langage officiel** (fusion d'ElixirLS, Lexical et Next LS) ; encore en alpha (v0.1.9, août 2026), pas encore publié sur le marketplace VSCode — à surveiller
- [hex.pm IntelliSense](https://marketplace.visualstudio.com/items?itemName=benvp.vscode-hex-pm-intellisense) — autocomplétion des dépendances Hex
- [gettext](https://marketplace.visualstudio.com/items?itemName=mrorz.language-gettext) — utile pour les fichiers de localisation
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) — IntelliSense dédié à Tailwind CSS

### Extensions VSCode annexes

- [SVG Preview](https://marketplace.visualstudio.com/items?itemName=SimonSiefke.svg-preview) — prévisualiser les SVG
- [Database Client](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-mysql-client2) — client DB dans VSCode
- [Git Stash](https://marketplace.visualstudio.com/items?itemName=arturock.gitstash) — gérer ses stashs
- [Project Manager](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager) — basculer rapidement entre ses projets
- [Rainbow CSV](https://marketplace.visualstudio.com/items?itemName=mechatroner.rainbow-csv) — coloration syntaxique dédiée aux CSV
- [Regex Snippets](https://marketplace.visualstudio.com/items?itemName=Monish.regexsnippets) — snippets regex
- [Remote SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) — manipuler vos projets distants
- [Remote Explorer](https://marketplace.visualstudio.com/items?itemName=ms-vscode.remote-explorer) — se connecter à une machine distante
- [Pack de langue française](https://marketplace.visualstudio.com/items?itemName=MS-CEINTL.vscode-language-pack-fr) — VSCode en français

## Thèmes VSCode

- [Dark+ Elixir](https://marketplace.visualstudio.com/items?itemName=kkalita.dark-plus-elixir) — thème dark dédié Elixir
- [Dracula](https://draculatheme.com/visual-studio-code)
- [Darcula for Elixir](https://marketplace.visualstudio.com/items?itemName=Arsen.darcula-theme-for-elixir)
- [Theme Abyss](https://marketplace.visualstudio.com/items?itemName=gerane.Theme-Abyss)
- [Yarra Valley](https://marketplace.visualstudio.com/items?itemName=dustypomerleau.yarra-valley)

## Conférences

- [Code Sync](https://www.codesync.global/) — un endroit où retrouver les conférences Elixir / BEAM
- [ElixirConf](https://elixirconf.com/) — la conférence Elixir de référence (US)
- [ElixirConf EU](https://www.elixirconf.eu/) — son pendant européen

## Autres liens utiles

- [Oh My Zsh / Git cheatsheet](https://kapeli.com/cheat_sheets/Oh-My-Zsh_Git.docset/Contents/Resources/Documents/index) — raccourcis ZSH
- [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) — prise de note à la Notion, open source, installable en local / serveur / docker ; blocs de code avec coloration Elixir et interface en français
- [AFFiNE](https://github.com/toeverything/AFFiNE) — alternative sérieuse à Notion, incluant un panneau de dessin à la Figma

## Licence

Ce dépôt est publié sous licence [MIT](LICENSE) : libre à vous de le réutiliser, le partager et l'adapter.

*La connaissance grandit quand on la partage.*
