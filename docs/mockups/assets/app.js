const bodyPage = document.body.dataset.page;

document.querySelectorAll("[data-nav]").forEach((link) => {
  if (link.dataset.nav === bodyPage) {
    link.classList.add("active");
  }
});

document.querySelectorAll(".progress > span[data-fill]").forEach((bar) => {
  requestAnimationFrame(() => {
    bar.style.width = `${bar.dataset.fill}%`;
  });
});

document.querySelectorAll("[data-now]").forEach((node) => {
  const value = new Date().toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });

  node.textContent = value;
});
