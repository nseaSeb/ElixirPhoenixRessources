---
layout: post
title: "Les uploads LiveView : déclarer ce qu'on accepte, et laisser le fichier arriver"
date: 2026-09-16 00:30:00 +0200
lang: fr
description: "Ajouter un justificatif à une note de frais tient en trois lignes qui déclarent ce que la page accepte. LiveView fournit le reste : une route dédiée par fichier, la validation avant le premier octet, la progression, le ménage, et un seul moment où le fichier nous est remis. Une découverte guidée, avec un test à chaque étape et un notebook pour la rejouer sans navigateur."
tags: [phoenix, liveview, uploads, fichiers, tests]
categories: [phoenix]
sources:
  - titre: "Uploads — guide officiel de Phoenix LiveView"
    url: https://hexdocs.pm/phoenix_live_view/uploads.html
  - titre: "External uploads — envoyer directement vers S3 ou un autre stockage"
    url: https://hexdocs.pm/phoenix_live_view/external-uploads.html
  - titre: "Phoenix.LiveView.allow_upload/3"
    url: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#allow_upload/3
  - titre: "Phoenix.LiveViewTest — file_input/4 et render_upload/3"
    url: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveViewTest.html#file_input/4
---

Une note de frais a un libellé, un montant, et un justificatif : la photo du ticket de taxi. Le formulaire existe déjà en LiveView, il ne manque que le champ fichier.

C'est l'occasion de découvrir une partie de Phoenix que je trouve étonnamment généreuse, parce qu'on n'y écrit pas l'envoi du fichier, on le déclare. Trois lignes disent ce que la page accepte, et LiveView fournit tout le reste : une route dédiée à chaque fichier, la vérification de nos règles avant le moindre octet transféré, la progression, le ménage quand la page se ferme, et un seul moment, bien choisi, où le fichier nous est remis.

Trois pièces se partagent le travail, et il vaut mieux savoir dès le départ qui fait quoi :

| Besoin | Responsable |
|---|---|
| Choisir un fichier, l'envoyer par morceaux, montrer la progression | le JavaScript de LiveView, via `<.live_file_input>` |
| Vérifier taille, format et nombre, tenir le fichier reçu au chaud | la LiveView, via `allow_upload` et `@uploads` |
| Décider où le fichier va vivre pour de bon | nous, dans `consume_uploaded_entries` |

En chemin, quatre questions vont se poser :

* si ce n'est pas le formulaire qui porte le fichier, qui s'en charge ?
* où le fichier reçu est-il rangé, et pour combien de temps ?
* à quel moment mes règles sont-elles appliquées ?
* comment passer à l'échelle sans réécrire la page ?

Tout ce qui suit a été exécuté avec Phoenix 1.8.14, LiveView 1.2.11 et Elixir 1.19.5, dans une application générée sans base de données. Les extraits de test viennent d'un seul fichier de test, passé dix fois sur dix, et les structures affichées sont celles qu'il a réellement produites. Une seule affirmation échappe à cette règle, et je la signale sur place : ce qu'un vrai navigateur envoie, que j'ai lu dans le JavaScript de LiveView faute de pouvoir le mesurer ici.

<!--more-->

## Ce que le formulaire transporte, et ce qu'il délègue

Commençons par le geste naturel, celui qu'on écrit sans réfléchir parce qu'il ressemble à tout ce que l'on connaît :

{% raw %}
```elixir
<form id="note" phx-submit="enregistrer">
  <input type="text" name="libelle" value="Taxi" />
  <input type="file" name="justificatif" />
  <button>Enregistrer</button>
</form>
```
{% endraw %}

Voici ce que le `handle_event` reçoit depuis un vrai navigateur :

{% raw %}
```elixir
%{"libelle" => "Taxi"}
```
{% endraw %}

Le libellé est arrivé, le justificatif n'apparaît nulle part, et pas même sous forme de clé vide. Ce silence est instructif, parce qu'il dit exactement où passe la frontière.

Un formulaire LiveView voyage sur le WebSocket, sérialisé comme une chaîne de requête. Avant de l'envoyer, le JavaScript rassemble les champs dans un `FormData`, puis en retire délibérément toute valeur qui est un fichier. Un ticket de taxi de deux mégaoctets n'a pas sa place dans une chaîne de requête, et LiveView préfère l'écarter proprement plutôt que d'envoyer quelque chose de tronqué.

Le formulaire est donc la porte d'entrée, taillée pour ce que l'on tape. Le fichier, lui, a droit au monte-charge, et c'est `allow_upload` qui l'ouvre.

Une nuance mérite d'être connue avant d'écrire les tests, car elle surprend au premier passage. `Phoenix.LiveViewTest` ne sérialise pas le formulaire comme le navigateur, puisqu'il le lit dans le HTML rendu, où un champ fichier sans attribut `value` vaut la chaîne vide. Le même `handle_event` reçoit donc `%{"justificatif" => "", "libelle" => "Taxi"}` sous le test. L'écart est sans conséquence, ni l'un ni l'autre ne portant le fichier, mais mieux vaut le savoir avant de partir chercher dans un navigateur une clé vide qui n'y existe pas.

## `allow_upload` : trois lignes ouvrent la route

La page devient celle-ci, et les trois nouveautés méritent chacune un mot :

{% raw %}
```elixir
defmodule MonAppWeb.NoteLive do
  use MonAppWeb, :live_view

  def mount(_params, _session, socket) do
    socket =
      socket
      |> assign(enregistres: [])
      |> allow_upload(:justificatif,
        accept: ~w(.jpg .jpeg .png .pdf),
        max_entries: 2,
        max_file_size: 2_000_000
      )

    {:ok, socket}
  end

  # phx-change : LiveView valide les fichiers choisis, nous n'avons rien à faire
  def handle_event("valider", _params, socket), do: {:noreply, socket}

  def handle_event("enregistrer", _params, socket) do
    # à venir : consommer les fichiers reçus
    {:noreply, socket}
  end

  def render(assigns) do
    ~H"""
    <form id="note" phx-submit="enregistrer" phx-change="valider">
      <input type="text" name="libelle" value="Taxi" />
      <.live_file_input upload={@uploads.justificatif} />
      <div :for={entry <- @uploads.justificatif.entries} id={"entree-#{entry.ref}"}>
        {entry.client_name} — {entry.progress}%
      </div>
      <button>Enregistrer</button>
    </form>
    <ul id="enregistres"><li :for={chemin <- @enregistres}>{chemin}</li></ul>
    """
  end
end
```
{% endraw %}

`allow_upload/3` déclare, dans `mount`, un champ nommé `:justificatif` et les règles qui s'y appliquent. L'option `accept` est la seule obligatoire, sous forme d'une liste d'extensions ou de types MIME, ou de l'atome `:any`. Les deux autres ont des valeurs par défaut, un seul fichier et huit mégaoctets, que j'ai resserrées à deux fichiers et deux mégaoctets.

`<.live_file_input>` remplace l'input ordinaire. Il rend un `<input type="file">` enrichi d'un hook JavaScript, de l'attribut `accept` déduit de nos règles, et de `multiple` dès que `max_entries` dépasse un. C'est ce hook qui ouvre, pour chaque fichier choisi, un canal dédié sur le socket de la page, et y pousse le contenu par morceaux de 64 Ko.

`phx-change` sur le formulaire complète le dispositif, puisque c'est l'événement qui déclenche la validation au moment où l'on choisit le fichier, donc avant tout transfert.

Le trajet complet tient sur un dessin :

{% raw %}
```
   navigateur                                  serveur
   ----------                                  -------
   formulaire  --- "libelle=Taxi"               --->  LiveView   (handle_event)
                                                          |
   ticket.png  --- morceau 1, morceau 2, ...    --->  canal d'upload  (fichier temporaire)
                                                          |
                                                      @uploads.justificatif.entries
```
{% endraw %}

> Le formulaire porte ce que l'on tape.
> Le canal d'upload porte ce que l'on choisit.
> Les deux aboutissent à la même LiveView,
> mais jamais par la même porte.

Le test suit le fichier pas à pas. `file_input/4` joue le navigateur qui choisit un fichier, et `render_upload/3` le hook qui pousse les morceaux ; les pourcentages s'additionnent d'un appel à l'autre :

{% raw %}
```elixir
# un PNG minimal : la signature du format, puis mille octets
@png <<137, 80, 78, 71, 13, 10, 26, 10>> <> :binary.copy(<<0>>, 1_000)

{:ok, vue, _html} = live(conn, "/note")

# le navigateur choisit un fichier : rien n'est encore envoyé
ticket = file_input(vue, "#note", :justificatif, [%{name: "ticket-taxi.png", content: @png, type: "image/png"}])

# les pourcentages s'additionnent : 40 %, puis les 60 % restants
assert render_upload(ticket, "ticket-taxi.png", 40) =~ "ticket-taxi.png — 40%"
assert render_upload(ticket, "ticket-taxi.png", 60) =~ "ticket-taxi.png — 100%"
```
{% endraw %}

Entre les deux appels, voici l'entrée telle que la LiveView la tient dans `@uploads.justificatif.entries` :

{% raw %}
```elixir
%Phoenix.LiveView.UploadEntry{
  progress: 40,
  preflighted?: true,
  upload_config: :justificatif,
  upload_ref: "phx-GNWh5OAFyunaAQcj",
  ref: "1860",
  uuid: "209a2cdb-7630-413f-a09b-df3e815f376c",
  valid?: true,
  done?: false,
  cancelled?: false,
  client_name: "ticket-taxi.png",
  client_relative_path: nil,
  client_size: 1008,
  client_type: "image/png",
  client_last_modified: nil,
  client_meta: nil
}
```
{% endraw %}

Tout ce qu'il faut pour afficher une ligne de progression est déjà là, sans que nous ayons écrit la moindre soustraction.

Le préfixe `client_` mérite qu'on s'y arrête, parce que c'est une convention parlante : ces valeurs sont ce que le navigateur a déclaré, et elles décrivent son point de vue plutôt qu'une vérité. Dans le test, un fichier nommé `../../etc/passwd.png` arrive avec exactement ce `client_name`. L'`uuid`, lui, est engendré par le serveur, et c'est sur lui que nous nous appuierons pour nommer les fichiers.

Après le second appel, `progress` vaut 100 et `done?` est vrai. Le fichier est là, et il reste à savoir où.

## Un fichier reçu a une durée de vie, et c'est celle de la page

L'entrée ne porte aucun chemin, et cette absence est un choix de conception qu'il vaut la peine de comprendre.

Le contenu est écrit dans un fichier temporaire tenu par le canal d'upload, soit un processus par fichier, lié à la LiveView. Dans le test, on peut aller le regarder :

{% raw %}
```elixir
/var/folders/zq/.../T/plug-1706-mjJZ/live_view_upload-1789514431-889351118078-3
```
{% endraw %}

Mille huit octets, dans le répertoire temporaire du système. Que la page se ferme avant l'enregistrement, par un onglet refermé ou un rechargement, et la LiveView s'arrête ; le canal, lié à elle, s'arrête aussi ; le fichier est effacé. Le test fait le geste le plus brutal possible, tuer la vue sans préavis, et constate que le chemin a disparu cent millisecondes plus tard.

C'est exactement le comportement souhaitable, et il découle du modèle de Phoenix plutôt que d'un ramasse-miettes qu'il aurait fallu écrire. Un fichier reçu est un invité de la page : il reste tant qu'elle vit, et repart avec elle si personne ne l'a installé ailleurs.

L'installer ailleurs, justement, est le rôle de `consume_uploaded_entries/3`, le seul endroit où LiveView nous confie le chemin, et seulement le temps d'une fonction :

{% raw %}
```elixir
def handle_event("enregistrer", _params, socket) do
  File.mkdir_p!(dossier())

  chemins =
    consume_uploaded_entries(socket, :justificatif, fn %{path: path}, entry ->
      # jamais le nom envoyé par le client dans un chemin : l'uuid, et l'extension seule
      dest = Path.join(dossier(), "#{entry.uuid}#{Path.extname(entry.client_name)}")
      File.cp!(path, dest)
      {:ok, dest}
    end)

  {:noreply, assign(socket, enregistres: socket.assigns.enregistres ++ chemins)}
end

# lu à l'exécution : la valeur peut venir de runtime.exs
defp dossier, do: Application.fetch_env!(:mon_app, :dossier_justificatifs)
```
{% endraw %}

La fonction reçoit le chemin temporaire et l'entrée, fait ce qu'elle veut du fichier, et rend `{:ok, valeur}` ; `consume_uploaded_entries` rend ensuite la liste de ces valeurs, ici les chemins de destination. Deux détails comptent.

Je copie plutôt que je ne déplace, parce que `File.cp!` fonctionne quand le répertoire temporaire et la destination sont sur deux disques différents, ce que `File.rename` refuse ; le temporaire sera effacé de toute façon.

Et je compose le nom moi-même, à partir de l'`uuid` engendré par le serveur et de l'extension seule, déjà filtrée par `accept`. C'est ici que le préfixe `client_` prend tout son sens, puisqu'il rappelle que `client_name` est fait pour être affiché, non pour désigner un endroit du disque.

Le test soumet le formulaire et vérifie la copie :

{% raw %}
```elixir
html = vue |> form("#note", %{"libelle" => "Taxi"}) |> render_submit()
assert [chemin] = Regex.scan(~r/<li>(.*?)<\/li>/, html) |> Enum.map(&Enum.at(&1, 1))
assert File.stat!(chemin).size == byte_size(@png)
```
{% endraw %}

Une fois le fichier consommé, l'entrée quitte `@uploads`, le canal s'arrête et le temporaire est effacé, sans que nous ayons à y penser.

LiveView pose au passage une garantie que je trouve élégante, puisqu'il refuse de nous remettre un fichier à moitié reçu. Le test clique sur « Enregistrer » au milieu de l'envoi et récolte ceci :

{% raw %}
```elixir
render_upload(ticket, "ticket-taxi.png", 50)

Process.flag(:trap_exit, true)
assert {{%ArgumentError{message: message}, _}, _} = catch_exit(vue |> form("#note", %{}) |> render_submit())
assert message == "cannot consume uploaded files when entries are still in progress"
```
{% endraw %}

La règle est nette, et l'interface qui l'accompagne tient en un attribut, puisqu'il suffit de désactiver le bouton tant qu'une entrée n'est pas terminée :

{% raw %}
```elixir
<button disabled={Enum.any?(@uploads.justificatif.entries, &(not &1.done?))}>Enregistrer</button>
```
{% endraw %}

## Ce que l'on déclare est vérifié avant le premier octet

Revenons aux trois règles posées dans `allow_upload`, et à la question qui décide de leur valeur : un fichier de trois mégaoctets est-il transféré, puis rejeté ?

Il ne l'est pas, et c'est là que la déclaration se révèle payante. Au moment du choix, le hook annonce au serveur le nom, le type et la taille de chaque fichier, et le serveur répond entrée par entrée avant tout transfert. C'est ce que le champ `preflighted?` de l'entrée enregistre. Un fichier refusé ne consomme donc ni bande passante ni disque, et son message est déjà affiché.

Ces messages vivent à deux endroits, selon que la règle porte sur un fichier ou sur l'ensemble, et deux fonctions les lisent :

{% raw %}
```elixir
<.live_file_input upload={@uploads.justificatif} />
<p :for={err <- upload_errors(@uploads.justificatif)} class="erreur">{traduire(err)}</p>
<div :for={entry <- @uploads.justificatif.entries} id={"entree-#{entry.ref}"}>
  {entry.client_name} — {entry.progress}%
  <p :for={err <- upload_errors(@uploads.justificatif, entry)} class="erreur">{traduire(err)}</p>
</div>
```
{% endraw %}

LiveView rend des atomes, ce qui laisse la formulation à notre charge, et c'est tant mieux pour un site en français :

{% raw %}
```elixir
defp traduire(:too_large), do: "fichier trop volumineux (2 Mo au plus)"
defp traduire(:not_accepted), do: "format non accepté (jpg, png ou pdf)"
defp traduire(:too_many_files), do: "deux justificatifs au plus"
```
{% endraw %}

Le test met la promesse à l'épreuve avec un PDF de trois mégaoctets :

{% raw %}
```elixir
scan = file_input(vue, "#note", :justificatif, [%{name: "scan.pdf", content: :binary.copy(<<0>>, 3_000_000), type: "application/pdf"}])

assert {:error, [[_ref, :too_large]]} = render_upload(scan, "scan.pdf")
assert render(vue) =~ "fichier trop volumineux"
```
{% endraw %}

`render_upload` rend `{:error, ...}` au lieu du HTML, ce qui est la façon dont le navigateur simulé nous dit qu'il n'a rien eu à envoyer. L'entrée figure bien dans la liste, à 0 %, avec `valid?: false` et son message. Un tableur dont l'extension n'est pas dans `accept` donne `:not_accepted` de la même façon.

Le nombre de fichiers, lui, est une règle sur le champ plutôt que sur une entrée :

{% raw %}
```elixir
fichiers = for nom <- ~w(a.png b.png c.png), do: %{name: nom, content: @png, type: "image/png"}
trois = file_input(vue, "#note", :justificatif, fichiers)

assert {:error, [[_ref, :too_many_files]]} = render_upload(trois, "a.png")
assert render(vue) =~ "deux justificatifs au plus"
```
{% endraw %}

La référence renvoyée est celle du champ, et c'est `upload_errors/1` qui affiche le message, au-dessus de la liste.

Une précision sur `max_file_size`, pour qui se demande ce que vaut une annonce faite par le client. La taille déclarée sert au refus immédiat ; le canal, ensuite, n'accepte que le nombre d'octets annoncé, qu'il conserve dans son état. Un client qui mentirait sur la taille n'obtiendrait donc rien de plus.

## Trois gestes déjà prêts : retirer, montrer, déposer

Voici trois choses que le lecteur s'attend à trouver dans une page d'envoi de fichiers, et que LiveView offre chacune en une ligne.

Pour retirer un fichier choisi par erreur, avant ou pendant l'envoi, un bouton porte la référence de l'entrée et l'événement appelle `cancel_upload/3` :

{% raw %}
```elixir
<button type="button" phx-click="retirer" phx-value-ref={entry.ref}>Retirer</button>

def handle_event("retirer", %{"ref" => ref}, socket) do
  {:noreply, cancel_upload(socket, :justificatif, ref)}
end
```
{% endraw %}

Le canal de cette entrée s'arrête, son temporaire est effacé, et l'entrée quitte la liste. Le test retire un envoi arrêté à 30 % et retrouve un formulaire vierge.

Pour montrer la progression, `entry.progress` est déjà dans notre page, et une barre `<progress value={entry.progress} max="100">` suffit, puisque la LiveView est redessinée à chaque morceau reçu. Pour une image, `<.live_img_preview entry={entry} />` en affiche un aperçu lu directement dans le navigateur, sans rien demander au serveur.

Pour accepter le glisser-déposer, un conteneur porte `phx-drop-target={@uploads.justificatif.ref}`, et le hook y accroche les fichiers lâchés comme s'ils avaient été choisis dans l'input. Ces deux derniers points sont des comportements du navigateur, que le test ne couvre pas.

## Recevoir au fil de l'eau avec `auto_upload`

Jusqu'ici, l'envoi attend le clic sur « Enregistrer ». Sur un formulaire long, on préfère souvent que le fichier parte dès qu'il est choisi, pour que l'utilisateur le voie arrivé avant d'avoir fini le reste. Deux options suffisent à basculer :

{% raw %}
```elixir
allow_upload(socket, :justificatif,
  accept: ~w(.png .pdf),
  max_entries: 3,
  auto_upload: true,
  progress: &gerer_progression/3
)

# appelé à chaque morceau reçu, pour chaque entrée
defp gerer_progression(:justificatif, entry, socket) do
  if entry.done? do
    chemin =
      consume_uploaded_entry(socket, entry, fn %{path: path} ->
        dest = Path.join(dossier(), "#{entry.uuid}#{Path.extname(entry.client_name)}")
        File.cp!(path, dest)
        {:ok, dest}
      end)

    {:noreply, update(socket, :enregistres, &[chemin | &1])}
  else
    {:noreply, socket}
  end
end
```
{% endraw %}

`auto_upload: true` fait partir le fichier à la sélection, et `progress` désigne une fonction appelée à chaque morceau, avec l'entrée à jour. Quand `done?` devient vrai, on consomme cette entrée seule, avec `consume_uploaded_entry/3` au singulier.

Ce singulier n'est pas un détail de style, et la garantie de tout à l'heure explique pourquoi : la forme au pluriel exige que toutes les entrées soient terminées, si bien qu'une seconde entrée encore en cours la ferait lever. La version au singulier dit précisément de quelle entrée on parle, ce qui est exactement ce dont un envoi au fil de l'eau a besoin.

Dans le test, deux fichiers choisis l'un après l'autre donnent ce journal des appels : `a.png` à 50 %, puis à 100 % et consommé, puis `b.png` à 100 % et consommé. La liste des entrées finit vide.

## Quand le volume grandit, le serveur signe au lieu de recevoir

Une photo de ticket de deux mégaoctets peut traverser le serveur sans dommage. Une vidéo, ou mille photos par jour, méritent mieux, puisque chaque octet emprunterait le WebSocket, le processus et le disque avant de repartir vers le stockage définitif.

LiveView répond à ce besoin avec l'option `external`, et la bascule est plus douce qu'on ne le craint. Le serveur cesse de recevoir le fichier pour en signer l'envoi : à chaque entrée, une fonction rend au navigateur l'adresse où déposer le fichier et les champs signés qui l'y autorisent. Le hook envoie alors directement vers le stockage, et la LiveView n'apprend plus que la progression.

{% raw %}
```elixir
allow_upload(socket, :justificatif, accept: ~w(.png), max_entries: 2, external: &presigner/2)

# dans un vrai projet : une signature S3 ; ici l'URL que le navigateur utiliserait
defp presigner(entry, socket) do
  meta = %{uploader: "S3", url: "https://stockage.example/#{entry.uuid}", fields: %{}}
  {:ok, meta, socket}
end

def handle_event("enregistrer", _params, socket) do
  urls = consume_uploaded_entries(socket, :justificatif, fn meta, _entry -> {:ok, meta.url} end)
  {:noreply, assign(socket, enregistres: urls)}
end
```
{% endraw %}

Deux choses changent, et c'est tout. La fonction de consommation reçoit les métadonnées rendues par `presigner` au lieu d'un `path`, puisque le fichier n'est pas chez nous. Et le nom `uploader: "S3"` désigne un petit module JavaScript à fournir côté navigateur, qui sait parler à ce stockage ; la documentation en donne un pour S3, en une trentaine de lignes.

Ce qui ne change pas mérite d'être énuméré, parce que c'est là que se mesure la qualité du dessin : `@uploads`, les entrées, `done?`, les règles et leurs messages, `cancel_upload`, la progression, les tests. Tout le reste de cet article tient encore.

Le test rejoue ce flux avec un faux signataire, et vérifie que l'entrée passe bien à `done?` sans qu'un octet ait transité, puis que la consommation rend l'URL signée.

## Lundi matin, dans un vrai projet

Voici où je poserais les choses.

Le répertoire de destination se configure et ne se code pas en dur. `priv/static/uploads` est tentant en développement, mais dans une release le répertoire `priv` vit dans le paquet déployé, remplacé à chaque mise en production. Je lis donc le chemin dans `runtime.exs`, sur un disque qui survit aux déploiements, et je passe à un stockage externe dès que l'application tourne sur plus d'une machine, puisque deux serveurs ne partagent pas leur disque.

Pour servir les fichiers reçus, `Plug.Static` avec `from: {:mon_app, ...}` ne convient pas à un répertoire situé hors de `priv` ; un `Plug.Static` sur un chemin absolu fait l'affaire, et un contrôleur qui vérifie les droits avant d'appeler `send_file/3` s'impose dès que tout le monde ne doit pas voir tous les justificatifs.

Sur les noms et les types, je m'en tiens à une règle simple : `client_name` sert à l'affichage, `client_type` est une déclaration, et une application qui traite vraiment le contenu, redimensionne une image ou lit un PDF, gagne à vérifier les premiers octets elle-même.

Dans les tests, trois habitudes évitent de perdre une demi-heure. Les pourcentages de `render_upload` s'additionnent, donc 40 puis 60 et non 40 puis 100. Un fichier refusé fait rendre `{:error, ...}` à `render_upload` au lieu du HTML, et c'est précisément ce qu'on affirme. Pour un `auto_upload`, enfin, je choisis les fichiers un par un, avec un `file_input` chacun, comme le ferait un utilisateur.

Restent deux réglages qu'on découvre tard et qui valent le détour. `chunk_timeout`, dix secondes par défaut, ferme un canal qui ne reçoit plus rien, ce qui compte sur une connexion mobile. Et `max_entries_mode: :total` compte aussi les entrées déjà consommées, pour un formulaire qui enregistre au fil de l'eau et doit plafonner le nombre total.

## Vais-je l'essayer ?

Ce qui m'a plu ici, c'est la proportion entre ce que l'on écrit et ce que l'on obtient. Trois lignes déclarent ce que la page accepte, et en échange LiveView ouvre une route par fichier, applique les règles avant le premier octet, tient la progression à jour, fait le ménage tout seul quand la page se ferme, et refuse de nous remettre un fichier incomplet.

Le reste est du code ordinaire : une boucle sur `entries` dans le template, une fonction de consommation qui copie où l'on veut, trois traductions pour les messages. Et le jour où le volume l'exige, la même page apprend à signer au lieu de recevoir, sans que rien d'autre bouge.

Le notebook qui accompagne cet article rejoue toute l'histoire sans navigateur ni serveur HTTP, avec `Phoenix.LiveViewTest` en guise de navigateur, jusqu'à pousser un fichier de votre disque dans la même LiveView : [Les uploads LiveView à nu : déclarer, envoyer, consommer](https://github.com/nseaSeb/ElixirPhoenixRessources/blob/main/Tips/uploads_liveview_a_nu.livemd).

## À retenir

- Un formulaire LiveView voyage comme une chaîne de requête, dont le JavaScript retire les fichiers : avec un `<input type="file">` ordinaire, la clé du champ n'arrive pas dans les `params`. Sous `Phoenix.LiveViewTest`, elle arrive à `""`.
- `allow_upload` ouvre une route séparée par fichier, sur le même socket, par morceaux de 64 Ko ; `<.live_file_input>` la branche, et `phx-change` déclenche la validation dès la sélection.
- Ce que la LiveView sait des fichiers vit dans `@uploads`, sous forme d'entrées : `progress`, `done?`, `valid?`, et des champs `client_*` qui décrivent le point de vue du navigateur.
- Le contenu est dans un fichier temporaire tenu par un processus lié à la vue, donc il repart avec elle ; `consume_uploaded_entries` est le seul endroit qui en confie le chemin, et sa fonction rend `{:ok, valeur}`.
- Le nom du fichier sur le disque se compose de `entry.uuid` et de l'extension, jamais de `client_name`.
- LiveView refuse de remettre un fichier à moitié reçu, avec `cannot consume uploaded files when entries are still in progress` : on désactive le bouton tant qu'une entrée n'est pas `done?`.
- Les règles sont appliquées avant le premier octet : `:too_large` et `:not_accepted` sur l'entrée, `:too_many_files` sur le champ, lus par `upload_errors/2` et `upload_errors/1`.
- `cancel_upload/3` retire une entrée ; `auto_upload: true` avec `progress` consomme au fil de l'eau, une entrée à la fois avec `consume_uploaded_entry/3`.
- `external` fait signer l'envoi par le serveur au lieu de le recevoir, et seule la fonction de consommation change, puisqu'elle reçoit les métadonnées.
- Dans les tests, `render_upload` cumule ses pourcentages et rend `{:error, ...}` pour un fichier refusé.
