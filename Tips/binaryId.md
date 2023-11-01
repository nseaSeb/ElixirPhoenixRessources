## --binary_id
[Retour vers le sommaire des tips](../TipsSommaire.md)
[Accueil](../README.md)

Vous avez oubliez de passer l'option --binary-id lors de la création de votre nouveau projet ?
Pas de panique !

1/ Ouvrez le fichier config.exs

Recherchez Ecto vous trouverez normalement quelque chose comme ça :

```
config :monprojet,
  ecto_repos: [Gestiup.Repo]
```

Il suffit donc d'ajouter --binary-id à la config :

```
config :monprojet,
  ecto_repos: [Gestiup.Repo]
  generators: [binary_id: true]
```

Lorsque vous allez générer un nouveau schema il sera désormais configuré en tenant compte de cela.

Voilà !