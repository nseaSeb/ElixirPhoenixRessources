---
layout: page
title: Projets
permalink: /projets/
description: "Les projets Elixir open source de l'auteur : texte riche structuré, recherche plein texte multilingue, cartes LiveView, éphémérides, formats bancaires français."
---

Des projets nés de besoins réels, extraits d'applications puis publiés — pas un portfolio.

En tête, le dépôt qui porte ce site. Les huit autres sont des **librairies publiées sur [Hex](https://hex.pm/)**, sous licence MIT, qui se posent avec `mix deps.get`.

Plusieurs feront l'objet d'un article : l'idée qu'elles portent se raconte mieux qu'une liste de fonctions.

{% for p in site.data.projets.projets %}{% include projet.html projet=p %}{% endfor %}

## Contribuer

Un bug, une idée, un cas d'usage inattendu : chaque dépôt a ses issues ouvertes. Et si l'une de ces librairies vous a servi, [dites-le]({{ "/contribuer/" | relative_url }}) — ça oriente ce qui sera travaillé ensuite.
