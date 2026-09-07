// Liste paginée et recherche côté client, sur un index JSON généré par Jekyll.
// Aucune dépendance : à cette échelle, un filtre sur un tableau suffit, et le
// lecteur ne télécharge pas une librairie de recherche pour douze articles.
(function () {
  const zone = document.getElementById("recherche-resultats");
  const champ = document.getElementById("recherche-champ");
  const repli = document.getElementById("recherche-repli");
  const annonce = document.getElementById("recherche-annonce");
  if (!zone || !champ) return;

  // Le repli rendu par le serveur reste visible tant que l'index n'est pas
  // chargé : le masquer tout de suite laisserait une page blanche sur une
  // connexion lente, ce qui serait pire que de ne pas avoir de JavaScript.

  const PAR_PAGE = parseInt(zone.dataset.parPage, 10) || 6;

  let articles = null;
  let page = 1;

  // « immutabilité » et « immutabilite » doivent trouver la même chose.
  //
  // On retire les marques combinantes (\p{Mn}) et surtout PAS \p{Diacritic},
  // qui engloberait aussi le circonflexe et l'accent grave ASCII — deux
  // caractères bien présents dans du code Elixir (`^` est le pin operator).
  // Les supprimer raccourcirait la chaîne et décalerait toutes les positions
  // calculées ensuite, si bien que le surlignage tomberait à côté du terme.
  const normaliser = (s) =>
    (s || "").toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");

  const echapper = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function preparer(article) {
    // On force le NFC : les positions calculées sur la version normalisée
    // servent à découper la chaîne d'origine, ce qui n'est valable que si les
    // accents y sont précomposés. Une entrée déjà en NFD décalerait tout.
    article = Object.assign({}, article, {
      titre: (article.titre || "").normalize("NFC"),
      contenu: (article.contenu || "").normalize("NFC")
    });
    return Object.assign({}, article, {
      _titre: normaliser(article.titre),
      _description: normaliser(article.description),
      _tags: normaliser((article.tags || []).join(" ")),
      _contenu: normaliser(article.contenu)
    });
  }

  // Un terme vaut plus dans un titre que dans le corps du texte.
  function score(article, termes) {
    let total = 0;
    for (const terme of termes) {
      let trouve = 0;
      if (article._titre.includes(terme)) trouve += 10;
      if (article._tags.includes(terme)) trouve += 6;
      if (article._description.includes(terme)) trouve += 3;
      if (article._contenu.includes(terme)) trouve += 1;
      if (trouve === 0) return 0; // tous les termes doivent être présents
      total += trouve;
    }
    return total;
  }

  // Un extrait centré sur la première occurrence, terme mis en évidence.
  function extrait(article, terme) {
    const position = article._contenu.indexOf(terme);
    if (position === -1) return echapper((article.description || "").slice(0, 200));

    const debut = Math.max(0, position - 70);
    const brut = article.contenu.slice(debut, debut + 220);
    const relative = position - debut;

    return (
      (debut > 0 ? "…" : "") +
      echapper(brut.slice(0, relative)) +
      "<mark>" + echapper(brut.slice(relative, relative + terme.length)) + "</mark>" +
      echapper(brut.slice(relative + terme.length)) +
      (debut + 220 < article.contenu.length ? "…" : "")
    );
  }

  function carte(article, termes) {
    const tags = (article.tags || [])
      .map((t) => '<span class="tag">' + echapper(t) + "</span>")
      .join("");
    const corps = termes.length
      ? extrait(article, termes[0])
      : echapper(article.description || "");

    return (
      '<li class="post-card">' +
      '<a class="post-card__link" href="' + echapper(article.url) + '">' +
      '<p class="post-card__meta">' + echapper(article.date_fr) + "</p>" +
      '<h3 class="post-card__title">' + echapper(article.titre) + "</h3>" +
      '<div class="post-card__excerpt">' + corps + "</div>" +
      "</a>" +
      (tags ? '<p class="tags">' + tags + "</p>" : "") +
      "</li>"
    );
  }

  function pagination(total, pages) {
    if (pages <= 1) return "";
    const precedent = page > 1
      ? '<button class="button" data-page="' + (page - 1) + '">← Précédent</button>'
      : '<span class="button button--inactif">← Précédent</span>';
    const suivant = page < pages
      ? '<button class="button" data-page="' + (page + 1) + '">Suivant →</button>'
      : '<span class="button button--inactif">Suivant →</span>';

    return (
      '<nav class="pagination" aria-label="Pages de résultats">' +
      precedent +
      '<span class="pagination__position">page ' + page + " sur " + pages + "</span>" +
      suivant +
      "</nav>"
    );
  }

  function afficher(resultats, termes) {
    if (resultats.length === 0) {
      page = 1; // sinon un ?page=5 périmé resterait dans l'URL
      if (annonce) annonce.textContent = "Aucun article ne correspond.";
      zone.innerHTML = '<p class="recherche__vide">Aucun article ne correspond.</p>';
      return;
    }

    const pages = Math.ceil(resultats.length / PAR_PAGE);
    if (page > pages) page = pages;

    const debut = (page - 1) * PAR_PAGE;
    const tranche = resultats.slice(debut, debut + PAR_PAGE);

    const pluriel = resultats.length > 1 ? "s" : "";
    const entete = termes.length
      ? resultats.length + " article" + pluriel + " trouvé" + pluriel
      : resultats.length + " article" + pluriel;

    if (annonce) annonce.textContent = entete;

    zone.innerHTML =
      '<ul class="post-list">' + tranche.map((a) => carte(a, termes)).join("") + "</ul>" +
      pagination(resultats.length, pages);

    zone.querySelectorAll("[data-page]").forEach((bouton) => {
      bouton.addEventListener("click", () => {
        page = parseInt(bouton.dataset.page, 10);
        rendre();
        zone.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function filtrer() {
    const brut = champ.value.trim();
    if (!brut) return { resultats: articles, termes: [] };

    const termes = normaliser(brut).split(/\s+/).filter(Boolean);
    const resultats = articles
      .map((article) => ({ article, points: score(article, termes) }))
      .filter((r) => r.points > 0)
      .sort((a, b) =>
        b.points - a.points || b.article.date.localeCompare(a.article.date))
      .map((r) => r.article);

    return { resultats, termes };
  }

  function rendre() {
    if (!articles) return;
    const { resultats, termes } = filtrer();
    afficher(resultats, termes);

    // L'URL porte la requête et la page : un résultat se partage.
    const url = new URL(window.location);
    const q = champ.value.trim();
    q ? url.searchParams.set("q", q) : url.searchParams.delete("q");
    page > 1 ? url.searchParams.set("page", page) : url.searchParams.delete("page");
    window.history.replaceState({}, "", url);
  }

  fetch(zone.dataset.index)
    .then((r) => r.json())
    .then((donnees) => {
      articles = donnees.map(preparer);
      const params = new URLSearchParams(window.location.search);
      // L'utilisateur a pu commencer à taper pendant le chargement : sa saisie
      // prime sur le paramètre d'URL.
      if (!champ.value && params.get("q")) champ.value = params.get("q");
      page = Math.max(1, parseInt(params.get("page"), 10) || 1);
      if (repli) repli.hidden = true;
      rendre();
    })
    .catch(() => {
      zone.innerHTML =
        '<p class="recherche__vide">L\'index n\'a pas pu être chargé. ' +
        "La liste complète des articles reste accessible ci-dessous.</p>";
      if (repli) repli.hidden = false;
    });

  champ.addEventListener("input", () => { page = 1; rendre(); });
})();
