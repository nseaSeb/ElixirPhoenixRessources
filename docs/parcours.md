---
layout: page
title: Parcours d'apprentissage
permalink: /parcours/
description: "Toutes les notes du dépôt ordonnées du débutant à l'avancé : savoir par où commencer, et quoi lire ensuite."
---

Cette page ordonne **toutes les notes du dépôt** du débutant à l'avancé. L'objectif : savoir *par où commencer* et *quoi lire ensuite*, plutôt que de piocher au hasard.

<div class="encadre">
  <p class="encadre__titre">Exécuter les notebooks</p>
  <p>Les notes portant un bouton <span class="pastille pastille--livemd">▶ Exécuter dans Livebook</span> sont des <a href="https://livebook.dev/">Livebooks</a> : du texte et du code que vous pouvez modifier et lancer.</p>
  <p>Le bouton vous emmène sur <code>livebook.dev</code>, qui transmet le notebook à <em>votre</em> Livebook. La toute première fois, il faut lui dire où le joindre. La section est <strong>en bas de la page</strong>, sous l'aperçu du notebook — intitulée <em>« Have you already installed Livebook? »</em>, et le bouton <em>« ↓ Configure Livebook »</em> y descend directement.</p>

  <p>Trois cas, selon votre installation :</p>
  <dl class="cas">
    <dt>L'application Livebook, sur Mac ou Windows</dt>
    <dd>Cochez <em>« I use Livebook Desktop for Windows/Mac »</em>. Il n'y a alors <strong>aucune adresse à saisir</strong> : l'application est jointe directement.</dd>

    <dt>Un Livebook local lancé autrement (serveur, Docker…)</dt>
    <dd>Laissez la case décochée et donnez son adresse. Le champ est en général déjà pré-rempli, et le port n'est pas forcément 8080 — Livebook en choisit souvent un à lui.</dd>

    <dt>Un Livebook distant ou hébergé</dt>
    <dd>L'adresse de votre instance est obligatoire ; saisissez-la à la place de celle proposée.</dd>
  </dl>

  <p>Dans les deux cas où une adresse est nécessaire, un voyant vert <em>« ✓ Livebook up »</em> confirme que la connexion passe. Il ne reste qu'à cliquer <em>« Run notebook »</em>.</p>

  <figure class="capture">
    <img src="{{ '/assets/images/livebook-configuration.png' | relative_url }}"
         alt="Page livebook.dev. En haut, l'aperçu du notebook. En bas, la section « Have you already installed Livebook? » : un champ d'adresse pré-rempli avec http://localhost:32123/, désigné par une flèche ; en dessous la mention verte « Livebook up » ; puis la case à cocher « I use Livebook Desktop for Windows/Mac », désignée par une seconde flèche ; et le bouton « Run notebook »."
         loading="lazy" width="2436" height="1570">
    <figcaption>La section de configuration, tout en bas de la page livebook.dev. Les deux flèches désignent le champ d'adresse et la case à cocher.</figcaption>
  </figure>
  <p>Le réglage est mémorisé par votre navigateur : les fois suivantes, le notebook s'ouvre sans repasser par là.</p>
  <p class="encadre__note">Pas de Livebook ? <strong>Le titre de chaque note est un lien</strong> vers son fichier sur GitHub : tout le texte et tout le code y sont, seule l'exécution manque.</p>
</div>

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
