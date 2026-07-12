const currentPage = document.body.dataset.page;

document.querySelectorAll("[data-nav]").forEach((node) => {
  if (node.dataset.nav === currentPage) {
    node.classList.add("active");
  }
});

document.querySelectorAll("[data-now]").forEach((node) => {
  node.textContent = new Date().toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
});

document.querySelectorAll(".progress > span[data-fill]").forEach((node) => {
  requestAnimationFrame(() => {
    node.style.width = `${node.dataset.fill}%`;
  });
});
