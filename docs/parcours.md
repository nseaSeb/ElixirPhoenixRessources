---
layout: page
title: Parcours d'apprentissage
permalink: /parcours/
description: "Toutes les notes du dépôt ordonnées du débutant à l'avancé : savoir par où commencer, et quoi lire ensuite."
---

Cette page ordonne **toutes les notes du dépôt** du débutant à l'avancé. L'objectif : savoir *par où commencer* et *quoi lire ensuite*, plutôt que de piocher au hasard.

Les étapes marquées <span class="pastille pastille--livemd">▶</span> sont des [Livebooks](https://livebook.dev/) **exécutables** : un clic les ouvre dans votre Livebook, prêts à tourner.

## Avant de commencer

<ol class="prealables">
{%- for p in site.data.parcours.avant_de_commencer -%}
  <li><a href="{{ p.url }}">{{ p.texte }}</a></li>
{%- endfor -%}
</ol>

{% for etape in site.data.parcours.etapes %}
<section class="etape etape--{{ etape.niveau }}">
  <p class="etape__niveau">
    {%- case etape.niveau -%}
      {%- when "debutant" -%}🟢 Débutant
      {%- when "intermediaire" -%}🟡 Intermédiaire
      {%- when "avance" -%}🔴 Avancé
      {%- else -%}🏁 Mise en pratique
    {%- endcase -%}
    <span class="etape__compteur">étape {{ forloop.index }} / {{ forloop.length }}</span>
  </p>

  <h2 class="etape__titre">{{ etape.titre }}</h2>
  <p class="etape__intro">{{ etape.intro }}</p>

  <ul class="items">
    {%- for item in etape.items -%}{% include item-parcours.html item=item %}{%- endfor -%}
  </ul>

  {%- if etape.tips -%}
    <p class="etape__tips-titre">À garder sous la main</p>
    <ul class="items items--tips">
      {%- for item in etape.tips -%}{% include item-parcours.html item=item %}{%- endfor -%}
    </ul>
  {%- endif -%}

  <p class="etape__objectif"><span aria-hidden="true">✓</span> Objectif atteint : {{ etape.objectif }}</p>
</section>
{% endfor %}

## Parcours par objectif

Pressé, ou déjà à l'aise ? Entrez par le besoin plutôt que par l'ordre.

<dl class="objectifs">
{%- for o in site.data.parcours.par_objectif -%}
  <dt>{{ o.but }}</dt><dd>{{ o.reponse }}</dd>
{%- endfor -%}
</dl>

## Boîte à outils

À consulter au besoin, hors parcours.

<ul class="items items--outils">
{%- for item in site.data.parcours.outils -%}{% include item-parcours.html item=item %}{%- endfor -%}
</ul>

## À venir

Pistes pour enrichir le parcours — [les contributions sont bienvenues]({{ "/contribuer/" | relative_url }}).

<ul class="a-venir">
{%- for a in site.data.parcours.a_venir -%}
  <li>{{ a | markdownify | remove: "<p>" | remove: "</p>" }}</li>
{%- endfor -%}
</ul>
