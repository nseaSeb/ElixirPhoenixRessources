[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

# Jobs en arrière-plan avec Oban

Envoyer un courriel, générer un PDF, appeler une API tierce : ces tâches n'ont rien à faire dans le cycle d'une requête HTTP. Il faut une file d'attente. Deux familles existent — celles qui gardent la file dans un service à part (Redis, RabbitMQ) et celles qui la gardent **dans la base de données déjà présente**. Oban est de la seconde.

La conséquence se mesure à l'usage : chaque question qu'on se pose sur un job (« pourquoi le mail de Bob n'est pas parti ? ») a une réponse dans une ligne SQL, pas dans des logs. **Les versions utilisées ici : Oban 2.24.1, Elixir 1.19.5, PostgreSQL 15.**

## 1. Installer

Quatre points de branchement : une dépendance, une migration, une entrée dans l'arbre de supervision, un bloc de configuration.

```elixir
# mix.exs
{:oban, "~> 2.24"}
```

```elixir
# priv/repo/migrations/..._add_oban.exs
def up, do: Oban.Migration.up(version: 12)
def down, do: Oban.Migration.down(version: 1)
```

```elixir
# lib/mon_app/application.ex — après le Repo, qui doit être démarré avant
{Oban, Application.fetch_env!(:mon_app, Oban)}
```

```elixir
# config/config.exs
config :mon_app, Oban,
  repo: MonApp.Repo,
  # nomme les files ET fixe leur concurrence : 5 courriels à la fois, 10 par défaut
  queues: [default: 10, courriels: 5],
  # sans le Pruner, la table ne rétrécit jamais
  plugins: [{Oban.Plugins.Pruner, max_age: 60 * 60 * 24 * 7}]
```

La migration crée la table `oban_jobs`. C'est une table Ecto ordinaire : on peut la lire au `psql`, la joindre, l'inspecter dans une console.

## 2. Un worker

```elixir
defmodule MonApp.Workers.EnvoiCourriel do
  use Oban.Worker,
    queue: :courriels,
    max_attempts: 3,
    # un seul job par destinataire pendant 60 secondes
    unique: [period: 60, keys: [:destinataire]]

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"destinataire" => _dest}}) do
    # l'envoi réel irait ici ; :ok marque le job « completed »
    :ok
  end
end
```

Deux détails qui coûtent du temps quand on les découvre à l'exécution :

- les `args` arrivent avec des **clés en chaînes**, jamais en atomes — ils ont fait l'aller-retour par une colonne JSON, et `%{"destinataire" => ...}` est la seule forme qui matche ;
- la structure `%Oban.Job{}` porte aussi `attempt` et `max_attempts` : le worker sait à quelle tentative il en est, et peut s'en servir (message d'erreur, dernier essai traité autrement).

Ce que renvoie `perform/1` décide de la suite : `:ok` (ou `{:ok, _}`) marque le job terminé, `{:error, raison}` déclenche une nouvelle tentative, `{:cancel, raison}` l'abandonne définitivement sans consommer les tentatives restantes.

## 3. Insérer un job

```elixir
{:ok, job} =
  %{destinataire: "alice@example.com"}
  |> MonApp.Workers.EnvoiCourriel.new()   # construit un changeset Ecto — c'en est un
  |> Oban.insert()
```

Le job est écrit dans `oban_jobs` à l'état `available` : prêt, pas encore pris par un exécutant.

Et parce que c'est une insertion Ecto ordinaire, elle se met dans une transaction avec l'écriture métier :

```elixir
Ecto.Multi.new()
|> Ecto.Multi.insert(:facture, Facture.changeset(%Facture{}, params))
|> Oban.insert(:courriel, fn %{facture: facture} ->
  MonApp.Workers.EnvoiCourriel.new(%{facture_id: facture.id})
end)
|> Repo.transaction()
```

Si la facture n'est pas créée, le courriel n'est pas planifié. **C'est l'argument principal de cette approche** : aucune coordination entre deux systèmes n'est nécessaire, la base garantit l'atomicité des deux écritures.

## 4. Les états d'un job

Un job traverse une colonne `state` :

| État | Signification |
|---|---|
| `available` | prêt, en attente qu'un exécutant le prenne |
| `scheduled` | planifié pour plus tard (`schedule_in:` / `scheduled_at:`) |
| `executing` | en cours |
| `retryable` | a échoué, une nouvelle tentative est planifiée |
| `completed` | terminé avec succès |
| `discarded` | tentatives épuisées, abandonné |
| `cancelled` | annulé (par `{:cancel, _}` ou `Oban.cancel_job/1`) |

Un job qui renvoie `{:error, _}` passe en `retryable`, **pas** en `discarded` tant qu'il reste des tentatives. La ligne conserve alors tout ce qu'il faut pour comprendre :

```
#2  retryable  tentative 1/3  planifié 2026-09-08 19:28:48  erreurs=1
    -> ** (Oban.PerformError) MonApp.Workers.EnvoiCourriel failed with {:error, "SMTP indisponible pour bob@example.com (tentative 1)"}
```

`scheduled_at` porte la date de la prochaine tentative — le délai croît à chaque échec — et la colonne `errors` **conserve chaque erreur** successive en JSON, avec son numéro de tentative. La question « pourquoi ce mail n'est pas parti ? » devient donc :

```sql
SELECT state, attempt, scheduled_at, errors
FROM oban_jobs
WHERE args->>'destinataire' = 'bob@example.com';
```

Après la dernière tentative, l'état passe à `discarded` et la ligne **reste** — jusqu'à ce que le `Pruner` la retire.

## 5. Refuser les doublons

Un bouton cliqué deux fois, un webhook rejoué, un cron qui se chevauche : sans garde-fou, deux courriels partent. L'option `unique:` du worker règle ça au niveau de la base.

En réinsérant le même job dans la fenêtre de 60 secondes :

```elixir
%{id: 1, state: "available", conflict?: true}
```

L'identifiant renvoyé est celui du job **déjà présent**, et `conflict?` vaut `true`. À noter : `Oban.insert/1` répond `{:ok, job}`, pas une erreur — du point de vue de l'appelant, le job existe, ce qui est vrai. Un code qui veut distinguer les deux cas doit tester `conflict?`.

L'unicité est garantie par la base, pas par un verrou en mémoire qui disparaîtrait au redémarrage.

## 6. Tester

```elixir
# config/test.exs
config :mon_app, Oban, testing: :manual
```

En mode `:manual`, aucun job ne s'exécute tout seul : on insère, on vérifie la présence en file, on exécute à la main quand on veut vraiment tester le worker. Les tests restent déterministes.

```elixir
use Oban.Testing, repo: MonApp.Repo

test "l'inscription planifie le courriel de bienvenue" do
  {:ok, _utilisateur} = Comptes.inscrire(%{courriel: "alice@example.com"})

  assert_enqueued worker: MonApp.Workers.EnvoiCourriel,
                  args: %{"destinataire" => "alice@example.com"}
end

test "le worker envoie le courriel" do
  # exécute perform/1 directement, sans passer par la file
  assert :ok = perform_job(MonApp.Workers.EnvoiCourriel, %{destinataire: "alice@example.com"})
end
```

## 7. Le prix à payer

Chaque job est une ligne écrite, mise à jour, puis supprimée : c'est de la charge sur PostgreSQL. Pour quelques milliers de jobs par minute, c'est indolore. Pour des centaines de milliers, il faut mesurer — et c'est le cas où un service dédié redevient un choix défendable.

En contrepartie, il n'y a rien de plus à déployer, surveiller ou sauvegarder : la base l'est déjà. Et un redémarrage ne perd rien, les jobs `available` et `retryable` sont repris là où ils étaient.

## À retenir

- Oban stocke la file dans `oban_jobs`, une table Ecto ordinaire : chaque question sur un job est un `SELECT`.
- Les `args` reviennent avec des **clés en chaînes** (aller-retour JSON) ; `attempt` est fourni dans `%Oban.Job{}`.
- `{:error, _}` fait passer le job en `retryable`, avec la prochaine tentative dans `scheduled_at` et **chaque erreur conservée** dans `errors`. `{:cancel, _}` abandonne sans réessayer.
- `Oban.insert/1` s'intègre à un `Ecto.Multi` : le job est atomique avec l'écriture métier.
- `unique:` refuse les doublons **au niveau de la base** ; l'insertion répond quand même `{:ok, job}`, avec `conflict?: true` et l'identifiant du job existant.
- En test, `testing: :manual` : rien ne s'exécute tout seul, puis `assert_enqueued` et `perform_job`.
- Le `Pruner` est nécessaire, sinon la table grossit indéfiniment.
- Version longue, avec trois expériences et les lignes de la table observées : [Oban : la file d'attente est une table](https://nseaseb.github.io/ElixirPhoenixRessources/articles/oban-jobs/).
- Documentation officielle : https://hexdocs.pm/oban/Oban.html
