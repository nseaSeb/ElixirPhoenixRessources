---
layout: post
title: "Le HTML en base de données est un piège"
date: 2026-09-06 12:05:00 +0200
lang: fr
description: "Stocker la sortie d'un éditeur de texte riche paraît évident, jusqu'au jour où il faut interroger, migrer, ou signer une URL. Ce qui change quand on stocke l'arbre du document plutôt que son rendu."
tags: [phoenix, ecto, texte-riche, postgres]
categories: [phoenix]
---

Votre application a besoin d'un champ de texte riche. Du gras, des listes, des liens, quelques images. Vous branchez un éditeur, il vous rend du HTML, vous le passez dans un filtre à balises et vous le rangez dans une colonne `text`.

C'est ce que tout le monde fait, y compris Action Text du côté de Rails. Ça marche très bien — jusqu'à trois ou quatre demandes plus tard.

<!--more-->

## Ce que vous avez réellement rangé

Une colonne qui contient ceci :

{% raw %}
```html
<p>Bonjour <strong>Camille</strong>, voici le <a href="https://exemple.fr/devis.pdf">devis</a>.</p>
```
{% endraw %}

Ce n'est pas un document. C'est **le rendu d'un document**, à un instant donné, avec les décisions de présentation de ce jour-là soudées à l'intérieur. Quatre conséquences, dans l'ordre où on les rencontre.

### La liste blanche est une course d'armement

Vous filtrez les balises à l'entrée : `<p>`, `<strong>`, `<a>`, pas `<script>`. Puis quelqu'un signale `<a href="javascript:…">`. Vous ajoutez un contrôle sur les schémas d'URL. Puis les attributs `on*`. Puis `<img src=x onerror=…>`. Puis les entités HTML qui reconstituent tout ça après décodage.

Chaque correctif est raisonnable ; l'ensemble ne converge jamais, parce que vous validez du balisage **par exclusion**. Vous listez ce qui est interdit dans un langage dont la surface est immense.

### Vous ne pouvez pas interroger

« Combien d'articles contiennent une image ? » « Lesquels pointent vers l'ancien domaine ? » « Quels documents citent ce produit ? »

Chacune de ces questions devient une expression régulière sur du balisage. Elles fonctionnent presque, ce qui est pire que pas du tout : `LIKE '%<img%'` attrape aussi le mot `<img` écrit dans un bloc de code, et rate `< img`.

### Migrer, c'est réécrire du HTML

Le jour où les citations doivent porter une classe, où les liens externes doivent gagner un `rel`, où un composant change de balise — vous écrivez une migration qui **parse et régénère du HTML sur toute la table**. Pour un changement qui n'a rien à voir avec les données, seulement avec leur présentation.

### Le rendu est gelé

Celui-là est le plus coûteux, et le moins visible au départ.

Vous voulez des URL de pièces jointes **signées et expirantes** — une pratique standard pour un fichier privé. C'est impossible : l'URL a été figée dans le HTML au moment de l'enregistrement. Elle expirera, et le document gardera un lien mort pour toujours.

Même chose pour une mention `@camille` qui devrait pointer vers un profil renommé depuis, ou pour un bloc de code qu'on voudrait colorer maintenant qu'on a un colorateur. **Chaque décision de rendu a été prise une fois, à l'enregistrement, et vous ne pouvez plus revenir dessus.**

## L'alternative : stocker l'arbre

Un éditeur moderne comme ProseMirror ne produit pas d'abord du HTML : il maintient un **arbre de document**, et `toJSON()` vous le rend tel quel.

{% raw %}
```elixir
%{
  "type" => "doc",
  "content" => [
    %{
      "type" => "paragraph",
      "content" => [
        %{"type" => "text", "text" => "Bonjour "},
        %{"type" => "text", "text" => "Camille", "marks" => [%{"type" => "bold"}]}
      ]
    }
  ]
}
```
{% endraw %}

Rangez **ça** dans une colonne `jsonb`, validé contre un schéma qui déclare les nœuds et les marques autorisés. Le HTML n'est plus stocké : il est calculé au rendu.

Reprenons les quatre problèmes.

### La validation devient l'assainissement

C'est le renversement central, et il mérite qu'on s'y arrête.

Vous ne filtrez plus du balisage par exclusion. Vous validez une structure **par inclusion** : un nœud dont le type n'est pas au schéma, une marque inconnue, un attribut non déclaré, une URL au schéma `javascript:` — le document est rejeté en entier.

La différence n'est pas de degré. Avec une liste blanche de balises, ce qui n'a pas été prévu passe. Avec un schéma, ce qui n'a pas été prévu ne passe pas. Et le rendu n'a plus jamais à s'échapper d'un balisage hostile, puisqu'il ne reçoit que des nœuds connus.

### Le document est une donnée

`jsonb` s'interroge. « Les documents contenant une image » devient une condition sur le type de nœud, pas une expression régulière hasardeuse. L'extraction du texte brut pour un index de recherche devient une fonction qui parcourt un arbre, et non un décapage de balises.

### Migrer, c'est transformer une structure

Ajouter un attribut à toutes les citations, c'est parcourir un arbre et modifier les nœuds concernés. On peut le tester sur un document isolé, écrire des assertions dessus, le rejouer. Rien à voir avec une réécriture de HTML.

### Le rendu redevient une décision

C'est le gain le plus net. Le rendu s'exécute **maintenant**, avec ce que vous savez maintenant :

{% raw %}
```elixir
Coelho.to_html(document, Coelho.Schema.default(),
  nodes: %{paragraph: fn _node, inner -> Coelho.Render.tag("p", [{"class", "lead"}], inner) end}
)
```
{% endraw %}

L'URL d'une pièce jointe est **résolue au rendu**, donc elle peut être signée et expirante — elle n'a jamais été dans le document. La mention pointe vers le profil actuel. Le bloc de code est coloré parce que vous avez un colorateur aujourd'hui, sans qu'aucune ligne en base n'ait bougé.

### Un schéma, deux consommateurs

Dernier bénéfice, moins évident : le schéma est écrit une fois en Elixir et **exporté vers le navigateur** pour construire le schéma ProseMirror correspondant.

Ce n'est pas du confort, c'est une garantie : un document que le serveur refuse est un document que le client ne pouvait pas produire. Les deux moitiés ne peuvent pas diverger, parce qu'il n'y a qu'une source.

## Ce que ça coûte

Aucune approche n'est gratuite, et celle-ci a un prix réel.

**Il vous faut un éditeur qui produise un arbre.** ProseMirror, Tiptap, Lexical. Un `contenteditable` maison qui crache du HTML ne convient pas.

**Vous ne pouvez plus coller du HTML tel quel.** Importer du contenu existant suppose de le convertir en arbre, ce qui est un vrai travail — et c'est le principal frein à une migration depuis une base déjà pleine de balisage.

**Le rendu devient votre affaire.** C'était gratuit tant que vous stockiez du HTML : vous l'affichiez. Il faut maintenant une fonction de rendu, et la tenir à jour quand le schéma évolue.

**Le schéma se maintient des deux côtés.** L'export automatique évite la divergence, mais il faut penser à l'exporter.

Pour un champ de commentaire de trois lignes, ce prix ne se justifie pas. Pour un contenu éditorial qui vivra des années, se migrera, s'indexera et changera d'apparence, il est vite remboursé.

## L'implémentation

C'est le raisonnement derrière [**Coelho**](https://hexdocs.pm/coelho), une librairie qui fait exactement ça pour Phoenix : le schéma, la validation, le stockage Ecto, le rendu, l'extraction du texte brut, et l'éditeur LiveView côté navigateur.

Sa description tient en une ligne — « inspiré d'Action Text, sauf qu'il ne stocke pas de HTML » — et tout cet article n'est que le développement de cette exception.

Le cœur n'a **aucune dépendance** : Ecto est optionnel, et Elixir 1.18 suffit, pour son module `JSON` de la bibliothèque standard. Ce qui n'y est délibérément pas — le stockage des octets, le traitement d'images, l'édition collaborative — a un point d'accroche prévu pour chacun, et rester dehors est ce qui garde le reste assez petit pour en être sûr.

Le code est sur [GitHub](https://github.com/nseaSeb/coelho), sous licence MIT.
