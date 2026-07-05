// Safe subset markdown → DOM (no innerHTML from raw model output).

export function renderMarkdown(container: HTMLElement, markdown: string): void {
  container.textContent = "";
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let list: HTMLUListElement | null = null;

  const flushList = (): void => {
    if (list) {
      container.appendChild(list);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!list) {
        list = document.createElement("ul");
        list.className = "avc-md-ul";
      }
      const li = document.createElement("li");
      appendInline(li, line.replace(/^[-*]\s+/, ""));
      list.appendChild(li);
      continue;
    }
    flushList();
    if (/^###\s+/.test(line)) {
      const h = document.createElement("div");
      h.className = "avc-md-h3";
      appendInline(h, line.replace(/^###\s+/, ""));
      container.appendChild(h);
      continue;
    }
    if (/^##\s+/.test(line)) {
      const h = document.createElement("div");
      h.className = "avc-md-h2";
      appendInline(h, line.replace(/^##\s+/, ""));
      container.appendChild(h);
      continue;
    }
    const p = document.createElement("p");
    p.className = "avc-md-p";
    appendInline(p, line);
    container.appendChild(p);
  }
  flushList();
}

function appendInline(parent: HTMLElement, text: string): void {
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const tok = m[0];
    if (tok.startsWith("`")) {
      const code = document.createElement("code");
      code.className = "avc-md-code";
      code.textContent = tok.slice(1, -1);
      parent.appendChild(code);
    } else if (tok.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = tok.slice(2, -2);
      parent.appendChild(strong);
    } else {
      const em = document.createElement("em");
      em.textContent = tok.slice(1, -1);
      parent.appendChild(em);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}
