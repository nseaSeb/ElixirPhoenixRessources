---
layout: post
title: "Structurer un projet Elixir : ce que le compilateur ne vérifie pas"
lang: fr
description: "Presque toutes les conventions d'un projet Elixir sont facultatives — rien ne casse si vous les ignorez. Sauf à un endroit, où Elixir refuse de démarrer. Voici lequel, et pourquoi les autres méritent quand même d'être suivies."
tags: [mix, configuration, conventions, releases]
categories: [elixir]
sources:
  - titre: "Learning Elixir: Project Structure"
    url: https://dev.to/abreujp/learning-elixir-project-structure-832
    auteur: "João Paulo Abreu"
    note: "l'article qui m'a donné envie d'écrire celui-ci ; il couvre le même terrain sous un autre angle, en anglais"
  - titre: "mix release — Runtime configuration"
    url: https://hexdocs.pm/mix/Mix.Tasks.Release.html
    note: "la distinction configuration de compilation / configuration d'exécution"
  - titre: "Application.compile_env/3"
    url: https://hexdocs.pm/elixir/Application.html#compile_env/3
---

Créez un projet, mettez le module `MonApp.Comptes` dans `lib/nimportequoi.ex`, compilez. Ça marche. Renommez le fichier en `zzz.ex`, recompilez. Ça marche encore.

C'est déroutant quand on vient de Ruby ou de Python, où le chemin d'un fichier détermine ce qu'on peut importer. En Elixir, **le compilateur ne fait aucun lien entre un nom de module et un nom de fichier.** Il compile tout ce qu'il trouve dans `lib/` et enregistre les modules par leur nom.

Alors pourquoi tout le monde suit-il la convention ? Et y a-t-il un endroit où Elixir vérifie vraiment quelque chose ? Oui — un seul, et il ne se contente pas d'avertir : il refuse de démarrer.

<!--more-->

## Ce que `mix new` crée réellement

Sept fichiers — huit avec `--sup`, qui ajoute l'arbre de supervision :

{% raw %}
```
mix.exs                       le projet, ses dépendances, son application
lib/mon_app.ex                le module racine
lib/mon_app/application.ex    l'arbre de supervision (avec --sup)
test/mon_app_test.exs
test/test_helper.exs
.formatter.exs
.gitignore
README.md
```
{% endraw %}

Pas de `config/`. Pas de `priv/`. Ils apparaissent quand on en a besoin — et c'est déjà une indication : ce ne sont pas des dossiers obligatoires, ce sont des conventions que l'outillage sait exploiter.

## Le nom du fichier ne sert pas au compilateur

Il sert à tout le reste.

**À vous, dans six mois.** La règle « `MonApp.Comptes.Utilisateur` vit dans `lib/mon_app/comptes/utilisateur.ex` » transforme un nom de module aperçu dans une stacktrace en un chemin de fichier, sans réfléchir ni chercher.

**À votre éditeur — en partie seulement.** Soyons précis, parce que c'est là qu'on raconte facilement n'importe quoi : « aller à la définition » ne dépend pas de la convention. Elixir enregistre le vrai chemin du fichier source dans le module compilé, et les serveurs de langage le lisent :

{% raw %}
```elixir
# Le module vit dans lib/zzz.ex, contre toute convention.
MonApp.Comptes.__info__(:compile)[:source]
#=> ~c"/chemin/du/projet/lib/zzz.ex"
```
{% endraw %}

Ce qui dépend bel et bien de la convention, c'est tout ce qui part du **nom** : ouvrir un fichier en tapant son nom de module dans le sélecteur, basculer entre un module et son test, deviner un chemin depuis une stacktrace sans rien ouvrir.

**Aux tests.** `mix test` cherche `test/**/*_test.exs`. Là, c'est une vraie contrainte : un fichier de test mal nommé n'est simplement jamais exécuté, sans le moindre avertissement. C'est le premier endroit où une convention ignorée devient un bug silencieux.

**Aux relectures.** Un fichier de mille lignes contenant quatre modules passe la compilation. Il ne passe pas une revue.

La convention n'est donc pas arbitraire : elle est ce qui permet à tout le monde — humains et outils — de deviner où sont les choses.

## Une porte d'entrée par domaine

La seconde convention, moins visible, est celle qui rend un projet lisible à mesure qu'il grossit.

Un domaine fonctionnel expose **un module public**, et cache le reste :

{% raw %}
```
lib/mon_app/comptes.ex              l'API publique : inscrire, authentifier…
lib/mon_app/comptes/utilisateur.ex  un détail d'implémentation
lib/mon_app/comptes/jeton.ex        un autre
```
{% endraw %}

Rien n'empêche techniquement d'appeler `MonApp.Comptes.Jeton.creer/1` depuis un contrôleur. C'est bien le problème : rien ne l'empêche, donc quelqu'un le fera, et la frontière disparaîtra sans qu'aucun outil ne s'en aperçoive.

Le marqueur conventionnel est `@moduledoc false` sur les modules internes. Il ne verrouille rien — il ne fait que les retirer de la documentation générée. C'est une convention entre humains, comme le souligne cette phrase qu'on lit souvent : en Elixir, la frontière publique est un accord, pas une barrière.

Si vous voulez une vraie barrière, il existe des outils d'analyse qui la font respecter. Mais l'accord suffit dans la plupart des projets, à condition d'être explicite.

## `priv/`, le dossier qui suit le code

`priv/` contient ce qui doit voyager avec l'application sans être du code : migrations, fichiers de traduction, certificats, gabarits, ressources statiques.

Sa particularité est d'exister aussi dans la release, à un chemin différent. On ne le devine donc pas :

{% raw %}
```elixir
# Faux : ce chemin n'existe plus une fois la release assemblée.
File.read!("priv/donnees.csv")

# Juste : Elixir résout le chemin réel, en développement comme en production.
:mon_app
|> Application.app_dir("priv/donnees.csv")
|> File.read!()
```
{% endraw %}

C'est une erreur classique, et elle a le mauvais goût de ne se manifester qu'au déploiement.

## La configuration, seul endroit où Elixir vous rattrape

Voilà la partie qui justifie cet article, et la seule où une convention ignorée provoque une erreur explicite.

Un projet Elixir a deux familles de fichiers de configuration, qui ne sont **pas évaluées au même moment** :

**`config/config.exs`** — et les `dev.exs`, `test.exs`, `prod.exs` qu'il importe — est lu **à la compilation**, sur la machine qui construit. Ses valeurs sont figées dans l'artefact produit.

**`config/runtime.exs`** est lu **à chaque démarrage**, sur la machine qui exécute.

La documentation officielle est explicite sur le piège :

> The `:secret_key` key under `:my_app` will be computed on the host machine, whenever the release is built.

…à propos de cette configuration :

{% raw %}
```elixir
import Config
config :my_app, :secret_key, System.fetch_env!("MY_APP_SECRET_KEY")
```
{% endraw %}

Autrement dit : votre secret de production est celui qui existait sur la machine de compilation. Au mieux la construction échoue parce que la variable n'y est pas ; au pire elle réussit avec la mauvaise valeur, et vous déployez.

**Toute valeur qui dépend de l'environnement va dans `runtime.exs`.** Ce fichier obéit à trois règles que la documentation formule en majuscules : il *doit* commencer par `import Config`, il ne *doit pas* utiliser `import_config`, et il ne *doit pas* toucher à `Mix` — lequel n'existe pas dans une release.

### Le contrôle qui refuse de démarrer

Certaines valeurs doivent légitimement être lues à la compilation, quand elles déterminent le code produit. Elixir fournit pour ça `Application.compile_env/2` — une **macro**, et non une fonction, ce qui n'est pas un détail : c'est ce qui lui permet d'enregistrer la valeur vue à la compilation.

Ce que vous y gagnez, c'est un garde-fou. J'ai monté le cas — projet compilé avec une valeur, release assemblée, puis `runtime.exs` en imposant une autre — et voici ce qui se passe au démarrage (message abrégé, il propose ensuite trois façons de corriger) :

{% raw %}
```
ERROR! the application :demo_cfg has a different value set for key :mode
during runtime compared to compile time. Since this application environment
entry was marked as compile time, this difference can lead to different
behavior than expected:

  * Compile time value was set to: :dev
  * Runtime value was set to: :prod

[…]

Runtime terminating during boot ({<<"aborting boot">>,...})
```
{% endraw %}

La release **ne démarre pas**. C'est exactement ce qu'on veut : mieux vaut un déploiement qui échoue franchement qu'une application qui tourne avec la configuration de développement.

Notez au passage un comportement rassurant en développement : si vous modifiez `config.exs`, `mix` recompile les modules concernés tout seul. Le problème ne se pose donc qu'entre une compilation et une exécution séparées — c'est-à-dire dans une release, précisément là où on ne le verrait pas.

## En résumé

Presque toutes les conventions d'un projet Elixir sont des accords entre humains : le compilateur ne relie pas les fichiers aux modules, ne protège pas les frontières de vos domaines, ne vous empêche pas de tout mettre dans un seul fichier. On les suit parce que l'outillage et les relecteurs s'appuient dessus, et parce qu'un projet qui ressemble aux autres se reprend sans effort.

Deux endroits font exception, et ce sont ceux à connaître par cœur : `mix test` ignore silencieusement un fichier mal nommé, et une valeur marquée comme lue à la compilation fait échouer le démarrage si elle change. La seconde est brutale — et c'est une bonne nouvelle.

*Cet article doit son sujet au billet de João Paulo Abreu cité ci-dessous, qui couvre le même terrain en anglais, avec une progression pédagogique différente. Le texte, les exemples et l'angle sont les miens.*
