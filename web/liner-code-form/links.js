import { websiteHref } from "./core.js";

export function linkedValue(container, name, value) {
  container.textContent = value || "Not provided";
  let href = "";
  if (name === "website") href = websiteHref(value);
  if (name === "contactEmail" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ?? "")) {
    href = `mailto:${encodeURIComponent(value.trim())}`;
  }
  if (href) {
    const link = document.createElement("a");
    link.textContent = value;
    link.href = href;
    if (name === "website") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    container.replaceChildren(link);
  }
  return container;
}

export function websiteShortcut(input) {
  const container = document.createElement("p");
  container.className = "hint";
  const update = () => {
    linkedValue(container, "website", input.value);
    const link = container.querySelector("a");
    container.hidden = !link;
    if (link) link.textContent = "Open website (new tab)";
  };
  input.insertAdjacentElement("afterend", container);
  input.addEventListener("input", update);
  update();
  return update;
}
