function removeTopSpacing(target) {
  if (!target || !target.classList) return;
  ["mt-16", "mt-20", "mt-24", "pt-16", "pt-20", "pt-24"].forEach((className) => {
    target.classList.remove(className);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const header = document.getElementById("app-header");
  if (header) {
    header.remove();
  }

  const main = document.querySelector("main");
  if (main) {
    removeTopSpacing(main);
    removeTopSpacing(main.firstElementChild);
  }
});
