import html
import os
import re
import sys
import time
import unicodedata
from urllib import parse, request


CONNECTOR_DIR = "connector-icons"
SEARCH_URL = "https://duckduckgo.com/html/?q={query}"

STOP_PHRASES = {
    "pluggy",
    "connector",
    "connector icons",
    "connector-icons",
    "svg",
    "icon",
    "logo",
    "vector",
    "brand",
}


def extract_hints(svg_content: str) -> list[str]:
    hints = []
    for pattern in (r"<title>(.*?)</title>", r"<desc>(.*?)</desc>"):
        for match in re.findall(pattern, svg_content, flags=re.IGNORECASE | re.DOTALL):
            cleaned = re.sub(r"\s+", " ", match).strip()
            if cleaned:
                hints.append(cleaned)
    return hints


def fetch_search_results(query: str) -> list[str]:
    url = SEARCH_URL.format(query=parse.quote_plus(query))
    req = request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with request.urlopen(req, timeout=20) as response:
        content = response.read().decode("utf-8", errors="ignore")

    titles = re.findall(r'class="result__a"[^>]*>(.*?)</a>', content)
    cleaned_titles = []
    for title in titles:
        text = html.unescape(re.sub(r"<.*?>", "", title))
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            cleaned_titles.append(text)
    return cleaned_titles


def normalize_name(raw_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", raw_name)
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = normalized.lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return normalized


def pick_name_from_titles(titles: list[str]) -> str | None:
    for title in titles:
        candidate = re.split(r"\s[-|:—]\s", title)[0].strip()
        lower = candidate.lower()
        if any(phrase in lower for phrase in STOP_PHRASES):
            continue
        if re.search(r"\d", candidate):
            continue
        if len(candidate) < 3 or len(candidate) > 60:
            continue
        return candidate
    return None


def identify_institution(icon_id: str, hints: list[str]) -> str | None:
    queries = [f"pluggy connector {icon_id} svg bank"]
    if hints:
        queries.append(f"{hints[0]} logo")

    for query in queries:
        titles = fetch_search_results(query)
        candidate = pick_name_from_titles(titles)
        if candidate:
            normalized = normalize_name(candidate)
            if normalized:
                return normalized
        time.sleep(1)

    return None


def main() -> int:
    if not os.path.isdir(CONNECTOR_DIR):
        print(f"Directory '{CONNECTOR_DIR}' not found.")
        return 1

    svg_files = [
        name for name in os.listdir(CONNECTOR_DIR) if re.match(r"^\d+\.svg$", name)
    ]
    if not svg_files:
        print("No SVG files found to rename.")
        return 0

    for filename in sorted(svg_files, key=lambda name: int(name.split(".")[0])):
        icon_id = filename.split(".")[0]
        path = os.path.join(CONNECTOR_DIR, filename)
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            hints = extract_hints(handle.read())

        institution = identify_institution(icon_id, hints)
        if not institution:
            print(f"Skipped {filename}: no confident match.")
            continue

        new_name = f"{icon_id}_{institution}.svg"
        new_path = os.path.join(CONNECTOR_DIR, new_name)
        if os.path.exists(new_path):
            print(f"Skipped {filename}: target exists ({new_name}).")
            continue

        os.rename(path, new_path)
        print(f"Renamed {filename} -> {new_name}")
        time.sleep(1)

    return 0


if __name__ == "__main__":
    sys.exit(main())
