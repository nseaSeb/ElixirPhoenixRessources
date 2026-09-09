---
layout: post
title: "Pourquoi mes erreurs de formulaire ne s'affichent pas"
date: 2026-09-08 13:00:00 +0200
lang: fr
description: "Un changeset invalide, des erreurs bien présentes, et rien à l'écran. Il y a deux portes entre une erreur Ecto et son affichage, et la plupart des gens n'en connaissent qu'une."
tags: [phoenix, liveview, ecto, formulaires]
categories: [phoenix]
sources:
  - titre: "Phoenix.Component.to_form/2"
    url: https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#to_form/2
  - titre: "Phoenix.Component.used_input?/1"
    url: https://hexdocs.pm/phoenix_live_view/Phoenix.Component.html#used_input?/1
  - titre: "Phoenix.HTML.FormField"
    url: https://hexdocs.pm/phoenix_html/Phoenix.HTML.FormField.html
  - titre: "Ecto.Changeset — :action"
    url: https://hexdocs.pm/ecto/Ecto.Changeset.html
---

Le scénario est toujours le même. Le changeset est invalide, `changeset.errors` contient exactement ce qu'il faut, le formulaire s'affiche, et **aucun message n'apparaît**. Aucune erreur dans les logs, aucune exception : la page est simplement muette.

Il y a **deux portes** entre une erreur d'`Ecto.Changeset` et le texte rouge sous le champ. La plupart des articles n'en décrivent qu'une. Toutes les sorties ci-dessous viennent d'un projet Phoenix 1.8.13 généré pour l'occasion, sur Elixir 1.19.5.

<!--more-->

## La première porte : `changeset.action`

Voici un changeset parfaitement invalide :

{% raw %}
```elixir
cs = Post.changeset(%Post{}, %{"title" => "", "body" => ""})
```
{% endraw %}

{% raw %}
```
changeset.valid?  = false
changeset.action  = nil
changeset.errors  = [title: {"can't be blank", [validation: :required]},
                     body: {"can't be blank", [validation: :required]}]
```
{% endraw %}

Les erreurs sont là. Maintenant, on en fait un formulaire :

{% raw %}
```
to_form(cs).errors                      = []
to_form(cs, action: :validate).errors   = [title: {"can't be blank", ...},
                                           body: {"can't be blank", ...}]
```
{% endraw %}

**Le même changeset donne un formulaire sans aucune erreur, ou avec les deux, selon un seul mot.** Ce n'est pas un bug, c'est une décision de conception : tant que `action` vaut `nil`, le changeset est considéré comme « pas encore soumis ». Afficher « ce champ est obligatoire » sur un formulaire vierge que l'utilisateur vient d'ouvrir serait hostile.

Le champ lui-même le confirme :

{% raw %}
```
f[:title].errors sans action    = []
f[:title].errors avec :validate = [{"can't be blank", [validation: :required]}]
```
{% endraw %}

### Une précision qui compte

Cette porte n'appartient pas à `to_form`, elle appartient à **l'implémentation `Phoenix.HTML.FormData` pour `Ecto.Changeset`**. Avec une map comme source, la règle ne s'applique pas :

{% raw %}
```elixir
f = to_form(%{"email" => "", "mdp" => ""}, as: :connexion,
            errors: [email: {"est obligatoire", []}])
```
{% endraw %}

{% raw %}
```
f[:email].errors = [{"est obligatoire", []}]
```
{% endraw %}

`action` vaut toujours `nil`, et l'erreur est bien là. La porte est spécifique aux changesets — c'est la raison pour laquelle « il suffit de mettre une action » circule comme une recette magique sans que personne n'explique pourquoi.

## D'où vient l'action, et pourquoi LiveView est différent

C'est l'asymétrie qui explique la moitié des questions sur le sujet.

**Dans un contrôleur classique**, l'action arrive toute seule. `Repo.insert/2` qui échoue renvoie un changeset dont `action` vaut `:insert`. On repasse ce changeset au formulaire, et les erreurs s'affichent sans qu'on ait rien fait.

**En LiveView, sur `phx-change`, personne n'a rien inséré.** On construit un changeset à la main, il sort avec `action: nil`, et le formulaire est muet. C'est exactement pour ça que le générateur écrit ceci — code produit par `mix phx.gen.live`, non modifié :

{% raw %}
```elixir
def handle_event("validate", %{"post" => post_params}, socket) do
  changeset = Blog.change_post(socket.assigns.post, post_params)
  {:noreply, assign(socket, form: to_form(changeset, action: :validate))}
end
```
{% endraw %}

Et, quelques lignes plus bas, dans la sauvegarde :

{% raw %}
```elixir
{:error, %Ecto.Changeset{} = changeset} ->
  {:noreply, assign(socket, form: to_form(changeset))}
```
{% endraw %}

**Pas d'`action:` ici.** Ce n'est pas un oubli : `create_post/1` a appelé `Repo.insert/2`, qui a déjà posé `action: :insert`. Le générateur ajoute l'action là où elle manque, et seulement là. Si vous avez déjà recopié `to_form(changeset, action: :validate)` partout « pour être sûr », vous savez maintenant pourquoi ce n'était pas nécessaire.

## La seconde porte : `used_input?`

Passons la première porte. `action: :validate` est posée, les erreurs sont dans le formulaire. Et pourtant, sur un formulaire tout juste ouvert, l'utilisateur ne voit toujours rien — et c'est voulu.

Voici la ligne qui décide, dans le `core_components.ex` que Phoenix génère dans **tous** les projets :

{% raw %}
```elixir
def input(%{field: %Phoenix.HTML.FormField{} = field} = assigns) do
  errors = if Phoenix.Component.used_input?(field), do: field.errors, else: []
```
{% endraw %}

Traduction : **`<.input>` jette les erreurs des champs auxquels l'utilisateur n'a pas touché.** Le champ porte l'erreur, le composant refuse de l'afficher.

Comment LiveView sait-il qu'un champ n'a pas été touché ? Par un paramètre que le client envoie, préfixé `_unused_` :

{% raw %}
```elixir
# l'utilisateur a tapé dans « title » puis effacé ; il n'a jamais touché « body »
params = %{"title" => "", "body" => "", "_unused_body" => ""}
f = to_form(Post.changeset(%Post{}, params), action: :validate)
```
{% endraw %}

{% raw %}
```
title : used_input? = true   errors = [{"can't be blank", ...}]
        ce que <.input> affiche = [{"can't be blank", ...}]
body  : used_input? = false  errors = [{"can't be blank", ...}]
        ce que <.input> affiche = []
```
{% endraw %}

Les deux champs sont invalides, les deux portent la même erreur. Un seul l'affiche. C'est ce qui produit une validation en direct agréable : les messages apparaissent au fur et à mesure que l'utilisateur avance, jamais tous d'un coup sur un formulaire vierge — et tous à la soumission, puisque le formulaire entier est alors envoyé sans marqueur `_unused_`.

### Le résumé des deux portes

| | Ce qui la contrôle | Ce qu'elle décide |
|---|---|---|
| Porte 1 | `changeset.action` | le champ porte-t-il des erreurs ? |
| Porte 2 | `used_input?/1` | `<.input>` accepte-t-il de les rendre ? |

Un champ muet, c'est l'une des deux. Le test qui départage tient en une ligne dans `iex` : si `to_form(cs, action: :validate)` fait apparaître les erreurs, c'était la première ; sinon, c'est la seconde.

## Ce qu'est vraiment `@form[:title]`

Le crochet n'est pas un accès à une map. `Phoenix.HTML.Form` implémente `Access`, et renvoie une structure :

{% raw %}
```
%Phoenix.HTML.FormField{
  id: "connexion_email",
  name: "connexion[email]",
  errors: [{"est obligatoire", []}],
  field: :email,
  value: "",
  form: %Phoenix.HTML.Form{
    source: %{"email" => "", "mdp" => ""},
    impl: Phoenix.HTML.FormData.Map,
    action: nil,
    ...
  }
}
```
{% endraw %}

Tout ce dont un champ HTML a besoin — `id`, `name`, `value`, `errors` — est calculé là. C'est pourquoi `<.input field={@form[:title]} />` suffit : le composant reçoit un objet complet, pas trois attributs à recoller. Et `impl:` nomme l'implémentation choisie, ici `FormData.Map` parce que la source est une map, `FormData.Ecto.Changeset` dans le cas habituel.

## Un formulaire sans Ecto

Corollaire utile : un formulaire n'a **pas besoin** de schéma ni de base de données. Un écran de connexion, un filtre de recherche, un questionnaire jetable :

{% raw %}
```elixir
socket = assign(socket, form: to_form(%{"email" => "", "mdp" => ""}, as: :connexion))
```
{% endraw %}

Le `as:` donne le préfixe des noms de champs — d'où `connexion[email]` plus haut. Les erreurs se passent en option, sous la forme `[{champ, {message, opts}}]`. Aucun changeset, aucun `Repo`, et `<.input>` fonctionne exactement pareil.

## À retenir

- Un changeset avec `action: nil` produit un formulaire **sans erreurs**, même s'il en contient. C'est un choix, pas un bug.
- Cette règle vient de l'implémentation `FormData` pour `Ecto.Changeset`. Avec une map, les erreurs passent telles quelles.
- Dans un contrôleur, `Repo.insert/2` pose l'action lui-même ; en LiveView sur `phx-change`, personne ne le fait — d'où `to_form(changeset, action: :validate)` dans le code généré, et **seulement là**.
- Deuxième filtre, souvent ignoré : `<.input>` masque les erreurs des champs jamais touchés, via `used_input?/1` et les paramètres `_unused_*`.
- `@form[:champ]` renvoie un `%Phoenix.HTML.FormField{}` complet — `id`, `name`, `value`, `errors`.
- `to_form/2` accepte une map : un formulaire sans Ecto est un cas normal, pas un détournement.
