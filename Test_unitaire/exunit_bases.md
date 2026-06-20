[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

# Tests avec ExUnit — les bases

ExUnit est le framework de test livré avec Elixir. Pas d'installation : il suffit de `mix test`.
Ce mémo complète le tip [Test unitaire dans les commentaires](./testUnitaireDansLeCommentaire.md) (doctests).

## Squelette d'un fichier de test

Les tests vivent dans `test/`, les fichiers se terminent par `_test.exs`.

```elixir
defmodule MathTest do
  # use ExUnit.Case rend les macros test/assert disponibles.
  # async: true => ce module tourne en parallèle des autres (gain de temps).
  # À n'activer que si le test ne partage pas d'état global (ex : pas la même DB sans sandbox).
  use ExUnit.Case, async: true

  # doctest exécute les exemples « iex> » de la doc du module (voir l'autre tip).
  doctest Math

  describe "add/2" do
    test "additionne deux entiers" do
      assert Math.add(2, 3) == 5
    end

    test "gère les négatifs" do
      assert Math.add(-1, 1) == 0
      refute Math.add(2, 2) == 5
    end
  end
end
```

## Les assertions utiles

```elixir
assert valeur == attendu          # égalité
refute condition                  # doit être faux/nil
assert_raise ArgumentError, fn -> ... end   # une exception est levée
assert_in_delta 3.14, 3.1, 0.05   # comparaison de flottants
assert {:ok, _} = MonModule.run() # pattern matching dans une assertion

# Pour les processus / messages :
assert_receive {:resultat, _}, 500   # un message arrive sous 500 ms
refute_receive :rien                  # aucun message
```

`assert` avec un `==` affiche un joli diff en cas d'échec : préférez-le aux comparaisons enfouies dans une variable booléenne.

## setup et fixtures

`setup` prépare un contexte avant chaque test. On retourne `{:ok, map}` et la map est injectée dans le test.

```elixir
defmodule PanierTest do
  use ExUnit.Case, async: true

  setup do
    panier = Panier.new()
    panier = Panier.ajouter(panier, %{nom: "Café", prix: 3})
    # tout ce qui est retourné ici est disponible via le paramètre du test
    {:ok, panier: panier}
  end

  test "le panier contient un article", %{panier: panier} do
    assert Panier.nb_articles(panier) == 1
  end
end
```

- `setup` : exécuté avant **chaque** test.
- `setup_all` : exécuté **une seule fois** pour tout le module (pour du setup coûteux et immuable).
- On peut nommer une fonction : `setup :creer_utilisateur` puis définir `defp creer_utilisateur(context)`.

## Mocking : Mox (la voie recommandée)

La philosophie Elixir : **mocker un comportement (behaviour), pas une fonction au hasard**. On définit un contrat, le vrai code et le mock l'implémentent tous les deux.

```elixir
# config/test.exs : on branche le mock à la place de l'implémentation réelle
config :mon_app, :paiement_api, PaiementApiMock

# test/test_helper.exs : on déclare le mock à partir du behaviour
Mox.defmock(PaiementApiMock, for: MonApp.PaiementApi)

# Dans le test :
import Mox
setup :verify_on_exit!   # vérifie que les attentes ont bien été appelées

test "facture un paiement" do
  expect(PaiementApiMock, :debiter, fn 100 -> {:ok, "tx_123"} end)
  assert {:ok, _} = MonApp.Caisse.encaisser(100)
end
```

Dépendance : `{:mox, "~> 1.1", only: :test}`.

## Données de test : ExMachina + Faker

Pour fabriquer des données réalistes sans répéter des `%{...}` partout :

- **Faker** (déjà dans [Librairie.md](../Librairie.md)) génère noms, emails, textes...
- **ExMachina** définit des « factories » réutilisables.

```elixir
defmodule MonApp.Factory do
  use ExMachina.Ecto, repo: MonApp.Repo

  def user_factory do
    %MonApp.Accounts.User{
      nom: Faker.Person.name(),
      email: Faker.Internet.email()
    }
  end
end

# Dans un test :
import MonApp.Factory
user = insert(:user)                       # insère en base
user = build(:user, nom: "Override")       # en mémoire, avec surcharge
users = insert_list(3, :user)              # plusieurs d'un coup
```

Dépendance : `{:ex_machina, "~> 2.7", only: :test}`.

## Tester avec Ecto (sandbox)

Pour que chaque test parte d'une base propre et puisse tourner en parallèle, on utilise la sandbox SQL : chaque test s'exécute dans une transaction annulée à la fin. C'est généré par défaut dans un projet Phoenix (`DataCase` / `Ecto.Adapters.SQL.Sandbox`).

## Lancer les tests

```bash
mix test                      # tout
mix test test/math_test.exs   # un fichier
mix test test/math_test.exs:12  # un test précis (ligne)
mix test --failed             # rejoue uniquement les derniers échecs
mix test --cover              # couverture de code
```

## À retenir

- `describe`/`test`/`assert`, `async: true` quand c'est sûr.
- `setup` pour les fixtures, `setup_all` pour le coûteux-immuable.
- Mocker un **behaviour** avec **Mox**, pas une fonction arbitraire.
- **ExMachina + Faker** pour des données lisibles ; **sandbox Ecto** pour l'isolation DB.
- Documentation : https://hexdocs.pm/ex_unit
