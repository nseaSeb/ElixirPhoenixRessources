## Automatiser la liste du cast d'un schema Ecto :
[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

L'idée est donc de ne pas à avoir à ce soucier de mettre à jour la liste à inclure dans la pipe de cast et c'est applicablicable à la
validation etc.

Pour cela j'ajoute une liste des champs à ne pas inclure, typiquement les champs Postgres ID et timestamps().

` @optional_fields [:id, :inserted_at, :updated_at]`

Puis une fonction privé qui appel le **MODULE** (utile si toutefois vous renommez le module il sera toujours à jour) copiable de schema en
schema.

```
  defp allFields() do
    __MODULE__.__schema__(:fields)
  end

```

Ensuite je remplace la liste habituel par l'appel à la fonction en excluant la liste crée en amont.

```Elixir

 |> cast(attrs,[:label, :is_not_deletable, :is_deleted, :main])
# Est remplacé par :
 |> cast(attrs, allFields() -- @optional_fields)
```

Ce qui donne par exemple :

```

defmodule Labo.Tests.Test do
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  alias Labo.Repo

  @optional_fields [:id, :inserted_at, :updated_at]
  schema "tests" do
    field :is_deleted, :boolean, default: false
    field :is_not_deletable, :boolean, default: false
    field :label, :string
    field :main, :boolean, default: false

    timestamps()
  end

  defp allFields() do
    __MODULE__.__schema__(:fields)
  end

  @doc false
  def changeset(test, attrs) do
   test
    |> cast(attrs, allFields() -- @optional_fields)
    |> validate_required([:label, :is_not_deletable, :is_deleted, :main])
  end
```

Et voilà !
