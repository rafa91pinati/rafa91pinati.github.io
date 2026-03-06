import re
from pathlib import Path

# ========= CONFIG =========
JS_FILE = "app.js"
CSS_FILE = "style.css"
HTML_FILE = "index.html"
OUT_FILE = "esqueleto_projeto.txt"
# ==========================


def read_file(path):
    p = Path(path)
    if not p.exists():
        return None
    return p.read_text(encoding="utf-8", errors="ignore")


def extract_js(text):
    results = []
    if not text:
        return results

    lines = text.splitlines()

    section_re_1 = re.compile(r'^\s*//\s*-{2,}\s*(.*?)\s*-{2,}\s*$')
    section_re_2 = re.compile(r'^\s*//\s*(.+?)\s*$')

    patterns = [
        re.compile(r'^\s*window\.([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{'),
        re.compile(r'^\s*window\.([A-Za-z_]\w*)\s*=\s*function\s*\(([^)]*)\)\s*\{'),
        re.compile(r'^\s*function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{'),
        re.compile(r'^\s*(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{'),
        re.compile(r'^\s*([A-Za-z_]\w*)\s*:\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{'),
    ]

    current_section = None

    for i, line in enumerate(lines, start=1):
        msec = section_re_1.match(line)
        if msec:
            current_section = msec.group(1).strip()
            results.append(("section", current_section, i))
            continue

        for pat in patterns:
            m = pat.match(line)
            if m:
                name = m.group(1).strip()
                params = m.group(2).strip()
                results.append(("function", name, params, current_section, i))
                break

    return results


def extract_css(text):
    results = []
    if not text:
        return results

    lines = text.splitlines()
    comment_section_re = re.compile(r'^\s*/\*\s*-{2,}\s*(.*?)\s*-{2,}\s*\*/\s*$')
    selector_re = re.compile(r'^\s*([^{}/][^{]+?)\s*\{\s*$')

    current_section = None

    for i, line in enumerate(lines, start=1):
        msec = comment_section_re.match(line)
        if msec:
            current_section = msec.group(1).strip()
            results.append(("section", current_section, i))
            continue

        msel = selector_re.match(line)
        if msel:
            selector = msel.group(1).strip()
            if selector and not selector.startswith("/*"):
                results.append(("selector", selector, current_section, i))

    return results


def extract_html(text):
    results = []
    if not text:
        return results

    lines = text.splitlines()

    comment_re = re.compile(r'<!--\s*(.*?)\s*-->')
    tag_re = re.compile(r'<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>')
    id_re = re.compile(r'\bid\s*=\s*"([^"]+)"')
    class_re = re.compile(r'\bclass\s*=\s*"([^"]+)"')

    for i, line in enumerate(lines, start=1):
        for c in comment_re.finditer(line):
            comment = c.group(1).strip()
            if comment:
                results.append(("section", comment, i))

        for m in tag_re.finditer(line):
            tag = m.group(1)
            attrs = m.group(2)

            if tag.lower() in {"html", "head", "meta", "link", "script", "br"}:
                continue

            tag_id = None
            tag_class = None

            mid = id_re.search(attrs)
            if mid:
                tag_id = mid.group(1).strip()

            mclass = class_re.search(attrs)
            if mclass:
                tag_class = mclass.group(1).strip()

            if tag_id or tag_class or tag.lower() in {"header", "main", "section", "footer", "nav", "form", "button", "input"}:
                results.append(("tag", tag, tag_id, tag_class, i))

    return results


def format_js(items):
    out = []
    out.append("========== JAVASCRIPT ==========\n")

    last_section = None
    for item in items:
        if item[0] == "section":
            sec = item[1]
            out.append(f"\n--- {sec} ---\n")
            last_section = sec
        elif item[0] == "function":
            _, name, params, section, line = item
            params_clean = ", ".join([p.strip() for p in params.split(",") if p.strip()])
            out.append(f"[L{line}] {name}({params_clean})")
    out.append("")
    return "\n".join(out)


def format_css(items):
    out = []
    out.append("========== CSS ==========\n")

    for item in items:
        if item[0] == "section":
            sec = item[1]
            out.append(f"\n--- {sec} ---\n")
        elif item[0] == "selector":
            _, selector, section, line = item
            out.append(f"[L{line}] {selector}")
    out.append("")
    return "\n".join(out)


def format_html(items):
    out = []
    out.append("========== HTML ==========\n")

    for item in items:
        if item[0] == "section":
            sec = item[1]
            out.append(f"\n--- {sec} ---\n")
        elif item[0] == "tag":
            _, tag, tag_id, tag_class, line = item
            extra = []
            if tag_id:
                extra.append(f'id="{tag_id}"')
            if tag_class:
                extra.append(f'class="{tag_class}"')
            extra_txt = " ".join(extra).strip()
            if extra_txt:
                out.append(f"[L{line}] <{tag} {extra_txt}>")
            else:
                out.append(f"[L{line}] <{tag}>")
    out.append("")
    return "\n".join(out)


def main():
    js_text = read_file(JS_FILE)
    css_text = read_file(CSS_FILE)
    html_text = read_file(HTML_FILE)

    js_items = extract_js(js_text)
    css_items = extract_css(css_text)
    html_items = extract_html(html_text)

    output = []
    output.append("ESQUELETO DO PROJETO\n")
    output.append(format_js(js_items))
    output.append(format_css(css_items))
    output.append(format_html(html_items))

    Path(OUT_FILE).write_text("\n".join(output), encoding="utf-8")
    print(f"Arquivo gerado com sucesso: {OUT_FILE}")


if __name__ == "__main__":
    main()