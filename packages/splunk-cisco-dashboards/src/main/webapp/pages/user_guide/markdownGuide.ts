export type GuideHeading = { id: string; label: string; level: number };

const escapeHtml = (value: string): string => value
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const plainText = (value: string): string => value
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
  .replace(/[`*_]/g, "").trim();

export const slugifyHeading = (value: string): string => plainText(value)
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";

const renderInline = (value: string): string => {
  const code: string[] = [];
  let html = escapeHtml(value).replace(/`([^`]+)`/g, (_match, text) => {
    code.push(`<code>${text}</code>`);
    return `\u0000CODE${code.length - 1}\u0000`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html.replace(/\u0000CODE(\d+)\u0000/g, (_match, index) => code[Number(index)] || "");
};

const splitRow = (line: string): string[] => line.trim().replace(/^\||\|$/g, "")
  .split("|").map((cell) => cell.trim());

const releasePanel = (
  title: string,
  meta: string,
  body: string,
  open: boolean,
  id: string,
  label: string,
): string =>
  `<details class="scd-guide-release-panel" id="${id}" data-release-label="${escapeHtml(label)}"${open ? " open" : ""}><summary class="scd-guide-release-summary"><span class="scd-guide-release-indicator" aria-hidden="true">›</span><span class="scd-guide-release-title-block"><span class="scd-guide-release-title">${renderInline(title)}</span><span class="scd-guide-release-meta">${renderInline(meta)}</span></span></summary><div class="scd-guide-release-body">${body}</div></details>`;

export function parseGuideMarkdown(markdown: string): {
  headings: GuideHeading[]; html: string; sections: GuideHeading[];
} {
  const lines = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "")
    .replace(/\r\n?/g, "\n").split("\n");
  const headings: GuideHeading[] = [];
  const releases: Array<{ id: string; label: string; version: string }> = [];
  const used = new Set<string>();
  let releaseCount = 0;
  let releaseControlsRendered = false;
  const uniqueId = (label: string): string => {
    const base = slugifyHeading(label);
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  };
  const render = (blockLines: string[], wrapSections = false): string => {
    const out: string[] = [];
    let sectionOpen = false;
    let index = 0;
    while (index < blockLines.length) {
      const line = blockLines[index];
      if (!line.trim() || /^\s*<!--/.test(line)) { index += 1; continue; }
      const directive = line.match(/^:::\s*release\s+(.+?)\s*\|\s*(.+)$/);
      if (directive) {
        const body: string[] = [];
        index += 1;
        while (index < blockLines.length && blockLines[index].trim() !== ":::") body.push(blockLines[index++]);
        index += 1;
        if (!releaseControlsRendered) {
          out.push('<div class="scd-guide-release-controls scd-guide-no-print" aria-label="Release note controls"><button type="button" data-release-action="expand">Expand all</button><button type="button" data-release-action="collapse">Collapse all</button></div>');
          releaseControlsRendered = true;
          out.push('<!--scd-release-versions-->');
        }
        const version = directive[2].match(/\bVersion\s+(\d+(?:\.\d+)*)\b/i)?.[1];
        const label = version ? `Version ${version}` : plainText(directive[2]);
        const id = uniqueId(`release ${version || directive[2]}`);
        releases.push({ id, label, version: version || label });
        out.push(releasePanel(directive[1], directive[2], render(body), releaseCount === 0, id, label));
        releaseCount += 1;
        continue;
      }
      const heading = line.match(/^(#{2,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        const explicitId = heading[2].match(/\s+\{#([a-z0-9-]+)\}\s*$/i)?.[1];
        const headingText = heading[2].replace(/\s+\{#[a-z0-9-]+\}\s*$/i, "");
        const label = plainText(headingText);
        const id = explicitId || uniqueId(label);
        used.add(id);
        headings.push({ id, label, level });
        if (wrapSections && level === 2) {
          if (sectionOpen) out.push("</div></section>");
          out.push(`<section class="scd-guide-section" data-guide-section="${id}"><div class="scd-guide-section-header">`);
          sectionOpen = true;
        }
        out.push(`<h${level} id="${id}">${renderInline(headingText)}</h${level}>`);
        if (wrapSections && level === 2) out.push('</div><div class="scd-guide-section-body">');
        index += 1;
        continue;
      }
      if (/^```/.test(line)) {
        const language = line.slice(3).trim() || "text";
        const body: string[] = [];
        index += 1;
        while (index < blockLines.length && !/^```/.test(blockLines[index])) body.push(blockLines[index++]);
        index += 1;
        out.push(`<div class="scd-guide-code"><div class="scd-guide-code-label">${escapeHtml(language)}</div><pre><code>${escapeHtml(body.join("\n"))}</code></pre></div>`);
        continue;
      }
      if (/^\|.+\|$/.test(line) && /^\|?\s*:?-{3}/.test(blockLines[index + 1] || "")) {
        const header = splitRow(line);
        index += 2;
        const rows: string[][] = [];
        while (index < blockLines.length && /^\|.+\|$/.test(blockLines[index])) rows.push(splitRow(blockLines[index++]));
        out.push(`<div class="scd-guide-table-wrap"><table><thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const list = line.match(/^\s*([-*]|\d+\.)\s+(.+)$/);
      if (list) {
        const ordered = /\d+\./.test(list[1]);
        const items: string[] = [];
        while (index < blockLines.length) {
          const item = blockLines[index].match(/^\s*([-*]|\d+\.)\s+(.+)$/);
          if (!item || /\d+\./.test(item[1]) !== ordered) break;
          items.push(`<li>${renderInline(item[2])}</li>`);
          index += 1;
        }
        out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote: string[] = [];
        while (index < blockLines.length && /^>\s?/.test(blockLines[index])) quote.push(blockLines[index++].replace(/^>\s?/, ""));
        out.push(`<blockquote>${renderInline(quote.join(" "))}</blockquote>`);
        continue;
      }
      const paragraph: string[] = [];
      while (index < blockLines.length && blockLines[index].trim()
        && !/^(#{2,6})\s|^```|^:::\s|^\|.+\|$|^\s*([-*]|\d+\.)\s+|^>\s?/.test(blockLines[index])) {
        paragraph.push(blockLines[index++]);
      }
      if (paragraph.length) out.push(`<p>${renderInline(paragraph.join(" "))}</p>`); else index += 1;
    }
    if (sectionOpen) out.push("</div></section>");
    return out.join("\n");
  };
  const rendered = render(lines, true);
  const releaseNavigation = releases.length
    ? `<nav class="scd-guide-release-versions scd-guide-no-print" aria-label="Release versions"><span>Jump to a version</span>${releases.map(({ id, label, version }) => `<a href="#${id}" aria-label="Release notes for ${escapeHtml(label.toLowerCase())}">${escapeHtml(version)}</a>`).join('')}</nav>`
    : '';
  const html = rendered.replace('<!--scd-release-versions-->', releaseNavigation);
  return { headings, html, sections: headings.filter((heading) => heading.level === 2) };
}
