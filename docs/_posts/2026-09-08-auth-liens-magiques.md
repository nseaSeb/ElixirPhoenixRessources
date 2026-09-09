---
layout: post
title: "phx.gen.auth en 1.8 : le lien magique d'abord, et pourquoi le mot de passe devient optionnel"
date: 2026-09-08 13:20:00 +0200
lang: fr
description: "Le générateur d'authentification de Phoenix 1.8 ne demande plus de mot de passe à l'inscription. Ce que ça change dans le schéma, dans les jetons, et dans une clause de code qui refuse de s'exécuter pour une raison de sécurité précise."
tags: [phoenix, liveview, authentification, securite]
categories: [phoenix]
sources:
  - titre: "mix phx.gen.auth — guide Phoenix"
    url: https://hexdocs.pm/phoenix/mix_phx_gen_auth.html
  - titre: "Swoosh.Adapters.Local"
    url: https://hexdocs.pm/swoosh/Swoosh.Adapters.Local.html
    note: "la boîte aux lettres de développement"
  - titre: "Phoenix.LiveView.on_mount/1"
    url: https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html#on_mount/1
---

Le générateur d'authentification de Phoenix a changé de philosophie avec la 1.8, et la plupart des tutoriels en ligne décrivent encore l'ancienne. L'inscription ne demande **plus de mot de passe**. On saisit une adresse, on reçoit un lien, on clique, on est connecté. Le mot de passe existe toujours, mais il devient une option qu'on active après coup.

Ce n'est pas un détail d'interface. Il modifie le schéma, les jetons, et il oblige le générateur à écrire une clause de code qui lève une exception plutôt que de laisser passer un cas précis. Tout ce qui suit est lu dans le code produit par Phoenix 1.8.13 sur Elixir 1.19.5, et les 144 tests générés passent.

<!--more-->

## Ce que la commande produit

{% raw %}
```bash
mix phx.gen.auth Accounts User users --live
```
{% endraw %}

`--live` ou `--no-live` est obligatoire — le générateur vous le demande sinon. Avec `--live`, les écrans d'inscription, de connexion et de réglages sont des LiveViews ; avec `--no-live`, des contrôleurs classiques. Le générateur recommande `--live` dès que LiveView est utilisé ailleurs dans le projet, pour ne pas mélanger deux façons de gérer la session.

Deux points d'attention si le projet a été créé avec des options minimalistes :

- Généré `--no-mailer`, le projet n'a pas de module `Mailer`. Le générateur s'arrête sur des instructions précises — ajouter `{:swoosh, "~> 1.4"}`, créer `lib/mon_app/mailer.ex` avec `use Swoosh.Mailer, otp_app: :mon_app`, configurer `adapter: Swoosh.Adapters.Local`. Rien de plus, mais rien de moins : sans mail, pas de lien magique.
- Généré `--no-assets`, il avertit que le lien de déconnexion s'appuie sur le JavaScript de `phoenix_html` pour envoyer un `DELETE`, et demande confirmation.

## Le schéma : un mot de passe qui peut être `nil`

La migration des utilisateurs dit tout :

{% raw %}
```elixir
add :email, :citext, null: false
add :hashed_password, :string
add :confirmed_at, :utc_datetime
```
{% endraw %}

`hashed_password` **n'a pas de `null: false`**. Un utilisateur peut exister sans mot de passe, et c'est le cas normal après une inscription par lien magique. Dans le schéma, `password` est un champ virtuel, `redact: true` pour ne jamais apparaître dans un `inspect`, et un second champ virtuel `authenticated_at` porte le moment de la dernière authentification effective.

La table des jetons a une colonne qui n'existait pas avant :

{% raw %}
```elixir
add :token, :binary, null: false
add :context, :string, null: false
add :sent_to, :string
add :authenticated_at, :utc_datetime
```
{% endraw %}

Trois durées de validité sont posées dans `UserToken`, et elles valent la peine d'être connues avant de les changer :

{% raw %}
```elixir
@magic_link_validity_in_minutes 15
@change_email_validity_in_days 7
@session_validity_in_days 14
```
{% endraw %}

Un lien magique vit **quinze minutes**. Une session, quatorze jours.

## La clause qui refuse de s'exécuter

C'est le morceau de code le plus intéressant du générateur. Dans `Accounts.login_user_by_magic_link/1` :

{% raw %}
```elixir
case Repo.one(query) do
  # Prevent session fixation attacks by disallowing magic links for unconfirmed users with password
  {%User{confirmed_at: nil, hashed_password: hash}, _token} when not is_nil(hash) ->
    raise """
    magic link log in is not allowed for unconfirmed users with a password set!
    ...
    """

  {%User{confirmed_at: nil} = user, _token} ->
    user
    |> User.confirm_changeset()
    |> update_user_and_delete_all_tokens()

  {user, token} ->
    Repo.delete!(token)
    {:ok, {user, []}}

  nil ->
    {:error, :not_found}
end
```
{% endraw %}

Quatre cas, dans l'ordre :

1. **Utilisateur non confirmé, mais avec un mot de passe** : exception. Le message dit lui-même que ce cas *ne peut pas se produire* avec le code généré tel quel — il ne se produit que si vous avez ajouté une inscription par mot de passe sans lire la suite.
2. Non confirmé, sans mot de passe : c'est la première connexion. On confirme le compte et on **supprime tous les jetons** de cet utilisateur.
3. Confirmé : on supprime ce jeton-là (usage unique), et on connecte.
4. Jeton inconnu ou expiré : `{:error, :not_found}`.

Pourquoi le premier cas est-il une exception et pas une erreur douce ? La réponse est dans `mix help phx.gen.auth`, section « Mixing magic link and password registration ». Le scénario : un attaquant s'inscrit avec l'adresse de sa cible et **choisit un mot de passe**. Le compte n'est pas confirmé. La cible reçoit plus tard un lien magique, clique, et confirme sans le savoir un compte dont l'attaquant connaît le mot de passe. L'attaquant conserve l'accès. La clause au sommet du `case` rend ce chemin impossible : un compte non confirmé qui a un mot de passe ne se confirme jamais par lien magique.

Si vous ajoutez une inscription par mot de passe, la documentation est explicite : la confirmation doit alors exiger que l'utilisateur soit connecté.

## Le mail, et la boîte aux lettres de développement

`UserNotifier` expose deux fonctions : `deliver_login_instructions/2` pour le lien magique, `deliver_update_email_instructions/2` pour le changement d'adresse. Rien pour un « mot de passe oublié » — il n'y en a pas besoin, puisque le lien magique *est* la récupération de compte.

En développement, avec `Swoosh.Adapters.Local`, aucun mail ne part. Ils s'accumulent dans une boîte consultable dans le navigateur, sur `/dev/mailbox`, activée par cette ligne de `config/dev.exs` :

{% raw %}
```elixir
config :mon_app, dev_routes: true
```
{% endraw %}

Le message de fin du générateur donne le parcours : ouvrir `/users/register`, s'inscrire, puis ouvrir `/dev/mailbox` pour cliquer sur le lien. Il n'y a pas de serveur SMTP à configurer pour développer.

## Ce que le routeur reçoit

Trois modifications, toutes dans `router.ex`.

Une ligne ajoutée au pipeline `:browser` :

{% raw %}
```elixir
plug :fetch_current_scope_for_user
```
{% endraw %}

Elle ne bloque rien. Elle lit la session et assigne l'utilisateur courant s'il y en a un — pour toutes les pages, connecté ou pas. Notez qu'elle n'est ajoutée **qu'au pipeline `:browser`** : le pipeline `:api` reste tel quel, avec son seul `plug :accepts, ["json"]`. Une API JSON ne bénéficie de rien de tout ça, et il faudra écrire son propre plug de jeton.

Et deux `live_session`, qui font le vrai travail pour LiveView :

{% raw %}
```elixir
live_session :require_authenticated_user,
  on_mount: [{MonAppWeb.UserAuth, :require_authenticated}] do
  # les LiveViews qui exigent une connexion
end

live_session :current_user,
  on_mount: [{MonAppWeb.UserAuth, :mount_current_scope}] do
  # les LiveViews publiques, qui veulent savoir qui regarde
end
```
{% endraw %}

`on_mount` est le mécanisme par lequel LiveView vérifie la session **avant** `mount/3`, y compris quand on navigue d'une LiveView à l'autre sans rechargement — là où un plug de pipeline ne verrait jamais passer la requête. Une LiveView protégée qu'on placerait hors du bon `live_session` n'est pas protégée, quel que soit le pipeline au-dessus.

## Le mot de passe, en option

Il n'a pas disparu. `User.password_changeset/3` existe, avec les règles par défaut — longueur minimale 12, maximale 72 — et le hachage bcrypt. L'utilisateur peut en définir un depuis ses réglages une fois connecté. Ce qui a changé, c'est l'ordre : la preuve de possession de l'adresse vient d'abord, le mot de passe ensuite, s'il en veut un.

## À retenir

- En 1.8, `phx.gen.auth` inscrit par **lien magique** ; le mot de passe est une option activée après coup, et `hashed_password` peut être `nil`.
- Un lien magique vaut **15 minutes**, une session 14 jours, un jeton de changement d'adresse 7 jours.
- Une clause lève volontairement une exception : un compte non confirmé qui possède un mot de passe ne se confirme jamais par lien magique — c'est la parade à une fixation de session décrite dans `mix help phx.gen.auth`.
- Sans module `Mailer`, pas de lien magique : sur un projet `--no-mailer`, il faut ajouter Swoosh à la main. En développement, les mails vont dans `/dev/mailbox`.
- La protection des LiveViews passe par `on_mount` dans un `live_session`, pas par le pipeline. Le pipeline `:api` n'est pas touché.
