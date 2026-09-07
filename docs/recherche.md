---
layout: page
title: Tous les articles
permalink: /recherche/
description: "Parcourir et chercher dans tous les articles du blog : titres, tags et contenu."
---

<form class="recherche" role="search" onsubmit="return false">
  <label class="recherche__label" for="recherche-champ">Chercher</label>
  <input class="recherche__champ" id="recherche-champ" type="search"
         placeholder="ecto, livebook, pattern matching…" autocomplete="off">
  <p class="recherche__aide">Sur le titre, les tags et le texte complet. Les accents sont ignorés.</p>
</form>

{%- comment -%}
  Seul le compte est annoncé aux lecteurs d'écran : mettre aria-live sur la
  liste entière la ferait relire à chaque touche frappée.
{%- endcomment -%}
<p id="recherche-annonce" class="recherche__compte" aria-live="polite" role="status"></p>

<div id="recherche-resultats"
     class="recherche__resultats"
     data-index="{{ '/recherche.json' | relative_url }}"
     data-par-page="6"></div>

{%- comment -%}
  Repli rendu par le serveur : la même liste en cartes, visible sans
  JavaScript. Le script la masque et prend la main.
{%- endcomment -%}
<div id="recherche-repli">
  <ul class="post-list">
    {%- for post in site.posts -%}
      <li class="post-card">
        <a class="post-card__link" href="{{ post.url | relative_url }}">
          <p class="post-card__meta">{% include date-fr.html date=post.date %}</p>
          <h3 class="post-card__title">{{ post.title | escape }}</h3>
          {%- if post.description -%}
            <div class="post-card__excerpt">{{ post.description | escape }}</div>
          {%- endif -%}
        </a>
        {%- if post.tags.size > 0 -%}
          <p class="tags">
            {%- for tag in post.tags -%}<span class="tag">{{ tag }}</span>{%- endfor -%}
          </p>
        {%- endif -%}
      </li>
    {%- endfor -%}
  </ul>
</div>
