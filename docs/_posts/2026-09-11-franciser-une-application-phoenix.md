---
layout: post
title: "Mettre une application Phoenix en français : qui décide de quoi"
date: 2026-09-11 09:30:00 +0200
lang: fr
description: "Une application Phoenix peut être entièrement écrite en français sans être réellement francisée : les dates restent anglaises, les nombres prennent les mauvais séparateurs, les erreurs de formulaire suivent une autre langue. Derrière le mot « localisation » se cachent plusieurs sujets distincts. Voici comment les découper, quelle bibliothèque décide de quoi, et comment la locale circule dans l'application."
tags: [phoenix, gettext, cldr, internationalisation, elixir]
categories: [phoenix]
sources:
  - titre: "Gettext"
    url: https://hexdocs.pm/gettext/Gettext.html
    note: "la locale globale et la locale par backend"
  - titre: "Gettext.Plural"
    url: https://hexdocs.pm/gettext/Gettext.Plural.html
  - titre: "mix gettext.merge"
    url: https://hexdocs.pm/gettext/Mix.Tasks.Gettext.Merge.html
    note: "la correspondance approchée et l'option --no-fuzzy"
  - titre: "ex_cldr"
    url: https://hexdocs.pm/ex_cldr/readme.html
  - titre: "Cldr.Plug.PutLocale"
    url: https://hexdocs.pm/ex_cldr_plugs/Cldr.Plug.PutLocale.html
  - titre: "Cldr.DateTime.Relative"
    url: https://hexdocs.pm/ex_cldr_dates_times/Cldr.DateTime.Relative.html
  - titre: "Cldr.Number"
    url: https://hexdocs.pm/ex_cldr_numbers/Cldr.Number.html
  - titre: "Règles de pluriel du CLDR Unicode"
    url: https://cldr.unicode.org/index/cldr-spec/plural-rules
  - titre: "Calendar.strftime/3"
    url: https://hexdocs.pm/elixir/Calendar.html#strftime/3
---

Une application Phoenix peut être entièrement écrite en français sans être vraiment francisée. Les libellés de l'interface sont traduits, et pourtant la date s'affiche en anglais, le montant sépare ses milliers d'une virgule, et les erreurs de formulaire parlent une autre langue que le reste de la page.

Ce n'est presque jamais qu'une bibliothèque fasse mal son travail. C'est que plusieurs sujets différents se cachent derrière un même mot : traduire un texte, accorder un pluriel, écrire une date, formater une somme et transporter le choix de langue de l'utilisateur sont cinq problèmes distincts, dont deux seulement relèvent de la traduction.

Je pars donc d'une application Phoenix neuve et je construis sa localisation morceau par morceau. L'objectif n'est pas seulement d'obtenir « 11 septembre 2026 » à la place de « September 11, 2026 », mais de savoir quelle bibliothèque décide de quoi, comment la locale circule dans l'application, et quels réglages rendent cette configuration fiable.

Le fil conducteur est une page minuscule, celle d'une recherche, qui affiche un nombre de résultats, une date et un montant. À la fin, elle produira selon la locale :

```
3 résultats trouvés le 11 septembre 2026, total 1 234,56 €
3 results found on September 11, 2026, total €1,234.56
```

Voici la répartition des rôles que l'article va construire, et qui sert aussi de plan :

| Besoin | Responsable |
| --- | --- |
| traduire un texte | Gettext |
| choisir entre singulier et pluriel | Gettext, avec les règles de la langue |
| dates, dates relatives | CLDR |
| nombres, monnaies, typographie | CLDR |
| messages d'erreur d'Ecto | Gettext, domaine `errors` |
| locale de la requête | un plug |
| locale dans une LiveView | la session, puis `on_mount` |

Tout ce qui suit a été exécuté sous **Elixir 1.19.5 et OTP 28**, dans une application créée par `phx_new` 1.8.5, qui installe `phoenix` 1.8.13, `gettext` 1.0.2 et `decimal` 3.1.1, augmentée de `ex_cldr` 2.47.5, `ex_cldr_dates_times` 2.25.6, `ex_cldr_numbers` 2.38.3 et `ex_cldr_plugs` 1.4.0.

Un [notebook Livebook](https://github.com/nseaSeb/ElixirPhoenixRessources/blob/main/Tips/localisation_francaise.livemd) accompagne l'article et rejoue toutes les démonstrations, sans Phoenix, sans serveur et sans base de données.

<!--more-->

## Les dates : laisser les données de localisation décider

La façon la plus directe de formater une date est celle que propose la bibliothèque standard :

{% raw %}
```elixir
Calendar.strftime(~D[2026-09-11], "%d %B %Y")
```
{% endraw %}

```
"11 September 2026"
```

Aucune locale n'est configurée nulle part, et c'est exactement le sujet : `Calendar.strftime/3` n'a pas de notion de langue. Son option `:month_names` attend une fonction qui rend les noms de mois, et sa valeur par défaut est anglaise. On peut donc lui fournir les siens :

{% raw %}
```elixir
mois = ~w(janvier février mars avril mai juin juillet août septembre octobre novembre décembre)

Calendar.strftime(~D[2026-09-11], "%d %B %Y", month_names: fn i -> Enum.at(mois, i - 1) end)
```
{% endraw %}

```
"11 septembre 2026"
```

Le résultat est juste, et il faudrait recommencer pour les jours de la semaine, pour leurs formes abrégées, puis pour chaque langue supplémentaire. Surtout, deux décisions restent hors de portée de cette approche : l'ordre des champs et le séparateur, que le gabarit `"%d %B %Y"` fige une fois pour toutes alors qu'ils varient d'une langue à l'autre.

Elixir n'embarque pas ces données dans sa bibliothèque standard, et c'est un choix raisonnable, puisqu'elles pèsent lourd, changent plusieurs fois par an et proviennent d'un projet extérieur qui fait autorité, le **CLDR** d'Unicode. Dans l'écosystème, c'est `ex_cldr` qui les apporte.

On déclare un module dédié, que la bibliothèque appelle un *backend*, et qui contient les données compilées des locales demandées :

{% raw %}
```elixir
defmodule Boutique.Cldr do
  use Cldr,
    locales: ["fr", "en"],
    default_locale: "fr",
    providers: [Cldr.Number, Cldr.DateTime, Cldr.Calendar]
end
```
{% endraw %}

La liste `:providers` mérite une seconde d'attention, parce que chaque fournisseur ajoute une famille de fonctions au backend. J'avais commencé sans `Cldr.Calendar`, et la première mise en forme d'une date m'a rendu un `function Boutique.Cldr.Calendar.months/2 is undefined` : les noms de mois relèvent du calendrier, pas du format de date. La compilation prend une dizaine de secondes pour deux locales, parce que les données CLDR deviennent des fonctions Elixir, et c'est un coût payé une fois et non à chaque requête.

La même date, confiée au backend, change alors de langue et de structure :

{% raw %}
```elixir
Boutique.Cldr.Date.to_string!(~D[2026-09-11], format: :long)
Boutique.Cldr.Date.to_string!(~D[2026-09-11], format: :long, locale: "en")
```
{% endraw %}

```
"11 septembre 2026"
"September 11, 2026"
```

Le jour passe devant en français, le mois devant en anglais, et la virgule apparaît là où l'anglais l'attend. Aucune liste de noms de mois n'aurait produit cela. Les dates relatives suivent le même chemin, ce qui évite d'écrire soi-même les accords :

{% raw %}
```elixir
Cldr.DateTime.Relative.to_string!(-1, Boutique.Cldr, unit: :day, locale: "fr")
Cldr.DateTime.Relative.to_string!(-3, Boutique.Cldr, unit: :day, locale: "fr")
Cldr.DateTime.Relative.to_string!(3, Boutique.Cldr, unit: :day, locale: "fr")
```
{% endraw %}

```
"hier"
"il y a 3 jours"
"dans 3 jours"
```

La règle générale que je retiens de cette première étape vaut bien au-delà des dates : dès qu'une information dépend de conventions culturelles, mieux vaut déléguer la décision à une base de données de localisation que de reconstruire les règles soi-même. Le CLDR sait qu'en français « il y a un jour » se dit « hier », et cette connaissance-là ne s'improvise pas.

## Les textes : traduire, c'est connaître la grammaire de la langue

Le compteur de résultats passe par `ngettext`, qui reçoit les deux formes et un nombre :

{% raw %}
```elixir
defmodule Boutique.Textes do
  use Gettext, backend: BoutiqueWeb.Gettext

  def resultats(n), do: ngettext("%{count} result found", "%{count} results found", n)
end
```
{% endraw %}

Les chaînes sources sont en anglais parce que c'est la convention de Gettext : l'identifiant d'un message *est* sa version dans la langue d'origine. Une fois la traduction écrite dans `priv/gettext/fr/LC_MESSAGES/default.po`, la même fonction rend ceci :

{% raw %}
```po
msgid ""
msgstr ""
"Language: fr\n"
"Plural-Forms: nplurals=2; plural=(n > 1);\n"

msgid "%{count} result found"
msgid_plural "%{count} results found"
msgstr[0] "%{count} résultat trouvé"
msgstr[1] "%{count} résultats trouvés"
```
{% endraw %}

```
n=0   fr -> « 0 résultat trouvé »     en -> « 0 results found »
n=1   fr -> « 1 résultat trouvé »     en -> « 1 result found »
n=2   fr -> « 2 résultats trouvés »   en -> « 2 results found »
```

Les deux langues divergent à zéro, et c'est le cœur du sujet. Le français range zéro avec le singulier, l'anglais avec le pluriel, et aucune de ces deux règles n'appartient à notre application. D'où une deuxième règle générale, que je formulerais ainsi : ne décidez jamais du pluriel dans votre code, passez le nombre au système de traduction et laissez la langue choisir la forme. Un `if count > 1` dans un gabarit est un défaut qui attend une locale de plus.

C'est le module `Gettext.Plural` qui porte ces règles, reprises du CLDR, et il s'interroge directement :

{% raw %}
```elixir
Gettext.Plural.plural("fr", 0)
Gettext.Plural.plural("en", 0)
Gettext.Plural.plural("fr", 2)
```
{% endraw %}

```
0
1
1
```

La fonction rend l'indice de la forme à employer, `0` désignant `msgstr[0]`, le singulier.

Reste à savoir ce qui se passe avant que la traduction existe, parce que tout projet traverse cette étape. Sans entrée dans le fichier, Gettext ne peut appliquer les règles du français à des chaînes françaises qui n'existent pas encore, alors il retombe sur la règle de la langue source, que son code écrit noir sur blanc dans `gettext/backend.ex:68` :

{% raw %}
```elixir
string = if n == 1, do: msgid, else: msgid_plural
```
{% endraw %}

Une page francophone applique donc la grammaire anglaise tant que la traduction n'est pas écrite, ce qui est cohérent et mérite d'être su, parce que la chaîne affichée ressemble alors à une chaîne non traduite ordinaire : on la voit sans la lire.

### L'en-tête qui a le dernier mot

Les fichiers `.po` portent un en-tête `Plural-Forms`, et une question se pose naturellement : entre cet en-tête et les règles du CLDR intégrées à `Gettext.Plural`, qui décide ?

L'en-tête, lorsqu'il est présent, car la compilation le transmet à Gettext, qui l'évalue à la place de ses propres règles. La démonstration tient en une ligne modifiée, le message et sa traduction restant identiques :

```
en-tête « plural=(n > 1) »    ->  n=0 : « 0 résultat trouvé »
en-tête « plural=(n != 1) »   ->  n=0 : « 0 résultats trouvés »
aucun en-tête                 ->  n=0 : « 0 résultat trouvé »
```

La deuxième ligne est celle qui coûte cher, car `plural=(n != 1)` est la forme correcte pour l'anglais et le réglage que plusieurs éditeurs de traduction proposent par défaut pour une langue à deux formes. La troisième montre le repli : privé d'en-tête, Gettext utilise les règles CLDR de la locale, c'est-à-dire le bon comportement.

Deux conséquences pratiques. D'abord, `Gettext.Plural.plural("fr", 0)` rend `0` dans les trois cas, donc interroger cette fonction ne dit rien de ce que la page affichera. Ensuite, l'en-tête `Plural-Forms` est la première ligne à relire dans un fichier qui revient d'un outil de traduction, puisqu'il ne peut rien améliorer et peut tout casser.

## Les nombres : le CLDR connaît aussi la typographie

Le total relève des mêmes données que la date :

{% raw %}
```elixir
Boutique.Cldr.Number.to_string!(1234.56, currency: :EUR)
Boutique.Cldr.Number.to_string!(1234.56, currency: :EUR, locale: "en")
```
{% endraw %}

```
"1 234,56 €"
"€1,234.56"
```

La virgule décimale, la position du symbole et le séparateur des milliers changent ensemble, ce qui est déjà satisfaisant. Mais le résultat français paraît étrange dès qu'on le regarde en programmeur, c'est-à-dire caractère par caractère. Regardons-le plutôt en typographe :

{% raw %}
```elixir
Boutique.Cldr.Number.to_string!(1234.56, currency: :EUR)
|> String.to_charlist()
|> Enum.reject(fn c -> c in ?0..?9 or <<c::utf8>> in [",", "€"] end)
|> Enum.map(fn c -> "U+" <> (c |> Integer.to_string(16) |> String.pad_leading(4, "0")) end)
```
{% endraw %}

```
["U+202F", "U+00A0"]
```

Les deux espaces n'en sont pas. U+202F est l'espace fine insécable, qui sépare les milliers, et U+00A0 est l'espace insécable ordinaire, qui précède le symbole monétaire. Ce sont les règles de la typographie française, et le CLDR ne s'est pas contenté de remplacer un point par une virgule : il a placé les bons caractères, avec la conséquence très concrète qu'un montant ainsi formaté ne se coupera jamais en fin de ligne.

Une seule précaution en découle, et elle concerne les tests, puisque comparer une somme formatée à une chaîne tapée à la main échoue sans que la différence se voie à l'écran. Autant construire la valeur attendue avec la même fonction, ou comparer sur la valeur numérique.

Un mot sur les bibliothèques de montants, tant qu'on y est. `ex_money` ajoute un vrai type monétaire, avec la devise portée par la valeur et une arithmétique exacte, et c'est ce que je prendrais pour un panier ou une facturation. À la date où j'écris, sa version 5.24.2 dépend de `decimal ~> 1.6 or ~> 2.0` alors que l'application tient `decimal` 3.1.1, exigé par `ecto` en `~> 3.0`, si bien que la résolution des dépendances échoue. En attendant que la borne évolue, `Cldr.Number` couvre l'affichage, qui est le besoin de cette page.

## Les erreurs de validation : Gettext range ses traductions par domaine

Le formulaire a des validations, et Ecto produit des erreurs qui ressemblent à ceci :

{% raw %}
```elixir
[
  mot_de_passe: {"should be at least %{count} character(s)",
   [count: 12, validation: :length, kind: :min, type: :string]},
  email: {"can't be blank", [validation: :required]}
]
```
{% endraw %}

Une chaîne anglaise accompagnée de ses variables : Ecto ne traduit pas, il décrit, et c'est justement ce qui permet de traduire ailleurs. La mise en forme revient à la fonction `translate_error/1` que le générateur écrit dans `core_components.ex` :

{% raw %}
```elixir
def translate_error({msg, opts}) do
  if count = opts[:count] do
    Gettext.dngettext(BoutiqueWeb.Gettext, "errors", msg, msg, count, opts)
  else
    Gettext.dgettext(BoutiqueWeb.Gettext, "errors", msg, opts)
  end
end
```
{% endraw %}

Le `d` de `dgettext` est celui de *domaine*, et le domaine vaut ici `"errors"`. Gettext organise en effet ses traductions par domaines, c'est-à-dire par fichiers : `default.po` porte l'interface, `errors.po` porte les messages de validation, et rien ne circule de l'un à l'autre. C'est une bonne chose, puisque les messages d'Ecto sont partagés par toutes les applications et se traduisent une fois pour toutes, mais cela veut dire qu'une interface entièrement traduite peut encore afficher ses erreurs en anglais.

Il faut donc écrire le second fichier, `priv/gettext/fr/LC_MESSAGES/errors.po` :

{% raw %}
```po
msgid "can't be blank"
msgstr "ne peut pas être vide"

msgid "should be at least %{count} character(s)"
msgid_plural "should be at least %{count} character(s)"
msgstr[0] "doit contenir au moins %{count} caractère"
msgstr[1] "doit contenir au moins %{count} caractères"
```
{% endraw %}

```
mot_de_passe : « doit contenir au moins 12 caractères »
email : « ne peut pas être vide »
```

Une remarque au passage sur ce que livre le générateur : une application Phoenix 1.8 neuve contient exactement deux fichiers de traduction, `priv/gettext/errors.pot` et `priv/gettext/en/LC_MESSAGES/errors.po`. Ni `default.po`, ni locale française. Phoenix pose la tuyauterie et le contenu nous revient, si bien que le premier geste d'un projet francophone consiste à créer ces deux fichiers avant d'écrire le premier formulaire.

## Une traduction automatique est une proposition, pas une vérité

Gettext fournit la commande qui tient les fichiers à jour, en relisant le code, en y relevant les messages à traduire et en les reportant dans chaque locale :

{% raw %}
```
$ mix gettext.extract --merge
```
{% endraw %}

```
Extracted priv/gettext/default.pot
Wrote priv/gettext/fr/LC_MESSAGES/default.po (2 new messages, 0 removed, 1 unchanged, 0 reworded (fuzzy), 0 marked as obsolete)
Wrote priv/gettext/fr/LC_MESSAGES/errors.po (18 new messages, 0 removed, 2 unchanged, 4 reworded (fuzzy), 0 marked as obsolete)
```

Dix-huit nouveaux messages, ce sont toutes les erreurs de validation qu'Ecto sait produire, récupérées depuis le modèle livré par Phoenix, et c'est exactement le service attendu. Les quatre « reworded (fuzzy) » demandent en revanche qu'on ouvre le fichier, parce qu'il s'y est passé quelque chose d'intéressant.

Quand un message nouveau ressemble beaucoup à un message déjà traduit, la commande recopie la traduction existante et pose un marqueur :

{% raw %}
```po
#, fuzzy
msgid "should be at most %{count} character(s)"
msgid_plural "should be at most %{count} character(s)"
msgstr[0] "doit contenir au moins %{count} caractère"
msgstr[1] "doit contenir au moins %{count} caractères"
```
{% endraw %}

La traduction de *at least* vient d'être proposée pour *at most*, les deux chaînes ne différant que de trois lettres. Le sens est inversé, et l'entrée est bien servie à l'exécution, ce que vérifie une validation de longueur maximale :

{% raw %}
```elixir
defmodule Pseudo do
  use Ecto.Schema

  embedded_schema do
    field :pseudo, :string
  end
end

changeset =
  %Pseudo{}
  |> Ecto.Changeset.cast(%{"pseudo" => "beaucoup trop long"}, [:pseudo])
  |> Ecto.Changeset.validate_length(:pseudo, max: 8)

[{_champ, erreur}] = changeset.errors
BoutiqueWeb.CoreComponents.translate_error(erreur)
```
{% endraw %}

```
erreur : {"should be at most %{count} character(s)",
          [count: 8, validation: :length, kind: :max, type: :string]}

"doit contenir au moins 8 caractères"
```

Il serait facile d'en faire une histoire de piège, et ce serait passer à côté du mécanisme. Le marqueur `fuzzy` est précisément le moyen qu'a Gettext de dire « j'ai trouvé une traduction proche, vérifie-la » : l'outil ne prétend pas avoir traduit, il propose. Ce qui manque n'est donc pas dans la commande, mais dans l'étape de relecture qu'elle suppose et que rien ne force.

Deux façons de travailler avec ce mécanisme plutôt que contre lui, selon l'organisation du projet.

Si personne ne relit les fichiers de traduction, autant ne rien proposer, et l'extraction laisse alors les entrées nouvelles vides :

{% raw %}
```
$ mix gettext.extract --merge --no-fuzzy
```
{% endraw %}

La chaîne anglaise reste à l'écran, ce qui constitue une gêne visible, et je la préfère largement à une phrase française qui ment. Le seuil de ressemblance se règle par ailleurs avec `--fuzzy-threshold`, sans que cela change la nature de l'affaire.

Si quelqu'un relit, l'intégration continue peut refuser les marqueurs restants, en prenant garde au sens du code de retour de `grep`, qui vaut `0` quand il trouve quelque chose :

{% raw %}
```
$ ! grep -rn '^#,.*fuzzy' priv/gettext
```
{% endraw %}

Le motif est ancré en début de ligne parce que Gettext écrit parfois plusieurs drapeaux ensemble, comme `#, elixir-autogen, elixir-format, fuzzy`.

## Mettre tout ensemble : faire circuler la locale

Deux systèmes connaissent maintenant la langue. Gettext détient les traductions, le CLDR détient les conventions de localisation, et chacun tient sa propre variable, qu'il faut donc poser deux fois :

{% raw %}
```elixir
Gettext.put_locale(BoutiqueWeb.Gettext, "en")
Boutique.Cldr.put_locale("fr")

Gettext.get_locale(BoutiqueWeb.Gettext)
Boutique.Cldr.get_locale().cldr_locale_name
```
{% endraw %}

```
"en"
:fr
```

L'indépendance demeure même lorsque le backend CLDR déclare le backend Gettext dans son option `gettext:`. Cette option a un autre rôle, qui est de faire connaître au CLDR le nom de locale correspondant du côté de Gettext, que l'on retrouve dans le champ `gettext_locale_name` de la structure de locale, et c'est ce nom qu'un plug utilisera pour poser les deux.

Ce plug existe, dans un paquet séparé nommé `ex_cldr_plugs`. Il s'appelle `Cldr.Plug.PutLocale`, sachant que `Cldr.Plug.SetLocale` est son ancien nom, toujours présent mais déprécié, et que c'est celui que la plupart des exemples en ligne montrent encore :

{% raw %}
```elixir
plug Cldr.Plug.PutLocale,
  apps: [cldr: Boutique.Cldr, gettext: BoutiqueWeb.Gettext],
  from: [:session, :query, :accept_language],
  cldr: Boutique.Cldr,
  gettext: BoutiqueWeb.Gettext
```
{% endraw %}

Les deux options méritent d'être comprises plutôt que recopiées.

L'option `:apps` désigne les systèmes à régler, et sa forme change la portée du réglage. Écrite `[:cldr, :gettext]`, elle pose la locale Gettext *globale*, celle qui vaut pour tous les backends du processus, tandis qu'écrite avec les modules, elle la pose sur le backend nommé. La nuance compte parce qu'une locale posée sur un backend l'emporte sur la globale, si bien que la première forme peut ne rien changer à l'affichage :

```
apps: [:cldr, :gettext]                          ->  globale=fr, backend=en, rendu « 0 results found »
apps: [cldr: Boutique.Cldr, gettext: …Gettext]   ->  globale=fr, backend=fr, rendu « 0 résultat trouvé »
```

L'option `:from` énumère les sources consultées dans l'ordre, et le plug s'arrête à la première qui rend une locale valide. La session avant l'en-tête du navigateur, c'est le choix explicite de l'utilisateur qui gagne ; dans l'ordre inverse, un visiteur dont le navigateur annonce `en-US` repasserait en anglais à chaque requête malgré le sélecteur de langue de la page. Le défaut de la bibliothèque, `[:session, :accept_language, :query, :path, :route]`, place d'ailleurs la session en tête pour cette raison.

## La locale suit le processus, pas la requête

Reste une dernière pièce, et c'est celle qui demande de penser en Elixir plutôt qu'en configuration. Gettext range la locale dans le dictionnaire du processus courant, ce qui se vérifie en trois lignes :

{% raw %}
```elixir
Gettext.put_locale(BoutiqueWeb.Gettext, "fr")
Gettext.get_locale(BoutiqueWeb.Gettext)
Task.async(fn -> Gettext.get_locale(BoutiqueWeb.Gettext) end) |> Task.await()
```
{% endraw %}

```
"fr"
"en"
```

Un plug pose donc la locale dans le processus de la requête HTTP, et elle ne va pas plus loin. C'est précisément la situation d'une LiveView, dont le rendu initial se fait dans le processus de la requête alors que tout ce qui suit se passe ailleurs :

```
navigateur
   │
   ▼
requête HTTP  ──►  le plug pose fr pour Gettext et pour le CLDR
   │
   ▼
rendu initial      (même processus, la page est en français)
   │
   ▼
connexion WebSocket
   │
   ▼
processus LiveView ──►  dictionnaire vide, retour à la locale par défaut
```

D'où la marche à suivre : le plug écrit la locale dans la session, et un `on_mount` la repose dans le processus de la LiveView au montage, `ex_cldr_plugs` fournissant `Cldr.Plug.PutSession` pour la première moitié du trajet. Je n'ai pas monté cette partie dans l'application d'essai, que je n'ai pas menée jusqu'au navigateur, et je le signale plutôt que de la présenter comme vérifiée.

C'est aussi le moment de reformuler la question de départ. Une locale ne décrit pas une requête, elle décrit un utilisateur, et il se trouve qu'un utilisateur traverse plusieurs processus : une requête HTTP, puis une LiveView, puis peut-être une tâche d'arrière-plan qui lui enverra un courriel. Chacun de ces processus doit recevoir la locale, et la session est ce qui la transporte entre eux.

## Ne pas traduire, localiser

Trois idées suffisent à tenir l'ensemble.

Les **textes** vont à Gettext, avec le nombre passé tel quel pour que la langue choisisse la forme, et avec un fichier par domaine, l'interface d'un côté, les erreurs de validation de l'autre.

Les **conventions culturelles** vont au CLDR, qu'il s'agisse des dates, des dates relatives, des nombres, des monnaies ou de la typographie, parce qu'il les connaît mieux que nous et qu'il les tient à jour.

La **locale** voyage avec l'utilisateur, de la requête à la session, puis de la session au processus de la LiveView, un seul plug la posant pour les deux systèmes à la fois.

Deux vérifications complètent le tableau, et ce sont les deux endroits où j'ai vu le résultat partir de travers alors que la configuration paraissait correcte : l'en-tête `Plural-Forms` des fichiers `.po`, qui a le dernier mot sur les accords, et les entrées marquées `fuzzy`, qui sont des propositions et non des traductions.

Ce qui m'intéresse dans cette mécanique, au fond, c'est qu'elle déplace le travail. Traduire une application ne consiste pas à remplacer des chaînes par d'autres chaînes, mais à déléguer à des données de référence toutes les décisions que l'anglais prenait implicitement à notre place. Une fois ce partage établi, ajouter une troisième langue ne demande plus de relire les gabarits : il suffit d'ajouter une locale au backend et un dossier de traductions.
