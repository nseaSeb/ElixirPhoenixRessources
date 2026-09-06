---
---
// Bascule clair / sombre. Le thème est appliqué très tôt par le script inline
// de <head> ; ce fichier ne gère que le bouton et la persistance.
(function () {
  var bouton = document.querySelector(".theme-toggle");
  if (!bouton) return;

  function themeCourant() {
    if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  bouton.addEventListener("click", function () {
    var suivant = themeCourant() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = suivant;
    try { localStorage.setItem("theme", suivant); } catch (e) {}
  });
})();
