---
layout: page
title: Tags
permalink: /tags/
---

{% assign tags_tries = site.tags | sort %}

<p class="tag-index">
  {%- for t in tags_tries -%}
    <a class="tag tag--link" href="#{{ t[0] | slugify }}">{{ t[0] }} <span class="tag__compte">{{ t[1] | size }}</span></a>
  {%- endfor -%}
</p>

{% for t in tags_tries %}
<section class="tag-section" id="{{ t[0] | slugify }}">
  <h2>{{ t[0] }}</h2>
  <ul class="tag-liste">
    {%- for post in t[1] -%}
      <li>
        <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
        <span class="tag-liste__date">{% include date-fr.html date=post.date %}</span>
      </li>
    {%- endfor -%}
  </ul>
</section>
{% endfor %}
