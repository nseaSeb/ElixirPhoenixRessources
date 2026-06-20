[Accueil](README.md)
[Mes notes Ecto (bases)](Ecto.md)

# Ecto — au-delà des migrations

Suite de [Ecto.md](Ecto.md) (migrations & seeds). On aborde ici le quotidien : changesets, associations, transactions et composition de requêtes.

## Changesets & validations

Un **changeset** est le sas par lequel passent les données avant d'atteindre la base : il caste les types, filtre les champs autorisés et valide.

```elixir
defmodule MonApp.Comptes.User do
  use Ecto.Schema
  import Ecto.Changeset

  schema "users" do
    field :email, :string
    field :age, :integer
    field :role, :string, default: "membre"
    timestamps()
  end

  def changeset(user, attrs) do
    user
    # cast = quels champs on accepte depuis l'extérieur (protège contre l'injection de masse)
    |> cast(attrs, [:email, :age, :role])
    |> validate_required([:email])
    |> validate_format(:email, ~r/@/)
    |> validate_number(:age, greater_than_or_equal_to: 0)
    |> validate_inclusion(:role, ["membre", "admin"])
    # contrainte vérifiée par la base (nécessite un index unique en migration)
    |> unique_constraint(:email)
  end
end
```

Différence clé :

- **validation** (`validate_*`) : vérifiée en Elixir, avant la requête.
- **constraint** (`unique_constraint`, `foreign_key_constraint`...) : déléguée à la base, transformée en erreur de changeset au lieu de faire planter la requête.

```elixir
%User{}
|> User.changeset(%{email: "a@b.com", age: 30})
|> MonApp.Repo.insert()
# => {:ok, %User{}} ou {:error, %Ecto.Changeset{}}
```

## Associations & preload

```elixir
schema "users" do
  field :email, :string
  has_many :articles, MonApp.Blog.Article
end

schema "articles" do
  field :titre, :string
  belongs_to :user, MonApp.Comptes.User
end
```

Ecto **ne charge pas** les associations automatiquement (pas de N+1 caché). On précharge explicitement :

```elixir
# Au moment de la requête (un seul aller-retour bien pensé)
import Ecto.Query

users =
  from(u in User, preload: [:articles])
  |> Repo.all()

# Ou après coup sur une structure déjà chargée
user = Repo.get!(User, id) |> Repo.preload(:articles)

# Préchargement imbriqué
Repo.preload(user, articles: [:commentaires])
```

Sans preload, accéder à `user.articles` renvoie `%Ecto.Association.NotLoaded{}` : c'est volontaire, ça vous oblige à maîtriser vos requêtes.

## Transactions avec Ecto.Multi

Quand plusieurs écritures doivent réussir ou échouer **ensemble**, `Ecto.Multi` enchaîne les opérations dans une transaction. Si une étape échoue, tout est annulé (rollback).

```elixir
alias Ecto.Multi

def inscrire_et_notifier(user_attrs) do
  Multi.new()
  |> Multi.insert(:user, User.changeset(%User{}, user_attrs))
  # les étapes suivantes reçoivent les résultats des précédentes
  |> Multi.insert(:profil, fn %{user: user} ->
    Ecto.build_assoc(user, :profil) |> Profil.changeset(%{})
  end)
  |> Multi.run(:email, fn _repo, %{user: user} ->
    case Mailer.envoyer_bienvenue(user) do
      :ok -> {:ok, user}
      err -> {:error, err}
    end
  end)
  |> Repo.transaction()
end

# Résultat :
# {:ok, %{user: user, profil: profil, email: user}}
# ou {:error, etape_en_echec, valeur_erreur, changements_deja_faits}
```

Bien plus lisible qu'une transaction imbriquée à la main, et le pattern matching sur l'étape en échec rend la gestion d'erreur explicite.

## Composer des requêtes

Les requêtes Ecto sont des **données composables** : on peut les construire morceau par morceau, ce qui rend les filtres réutilisables.

```elixir
import Ecto.Query

# Une requête de base
def base, do: from(a in Article)

# Des fragments réutilisables qui prennent une query et en renvoient une
def publies(query), do: from(a in query, where: a.publie == true)
def recents(query), do: from(a in query, order_by: [desc: a.inserted_at])
def de_user(query, user_id), do: from(a in query, where: a.user_id == ^user_id)

# On compose selon le contexte
def articles_publics(user_id) do
  base()
  |> publies()
  |> de_user(user_id)
  |> recents()
  |> Repo.all()
end
```

Quelques opérations courantes :

```elixir
Repo.aggregate(Article, :count)             # compter
Repo.exists?(from a in Article, where: ...)  # tester l'existence (pas de chargement)
from(a in Article, select: %{id: a.id, titre: a.titre}) |> Repo.all()  # ne charger que l'utile
```

> Pensez toujours au `^` (pin operator) pour injecter une variable : `where: a.id == ^id`. Ecto paramètre la requête, ce qui protège des injections SQL.

## À retenir

- Le **changeset** est le point de passage obligé : cast + validations + constraints.
- Pas de chargement implicite : **preload** explicite, au choix dans la requête ou après coup.
- **Ecto.Multi** pour « tout ou rien » et une gestion d'erreur lisible.
- Les requêtes se **composent** : isolez vos filtres en petites fonctions.
- Voir aussi le tip [Automatiser la liste du cast d'un schema Ecto](./Tips/schemaEctoAutoCast.md).
- Documentation : https://hexdocs.pm/ecto
