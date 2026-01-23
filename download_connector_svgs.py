import os
import sys
from urllib import request, error


BASE_URL = "https://cdn.pluggy.ai/assets/connector-icons/{id}.svg"
OUTPUT_DIR = "connector-icons"


def download_svg(icon_id: int, output_dir: str) -> bool:
    url = BASE_URL.format(id=icon_id)
    output_path = os.path.join(output_dir, f"{icon_id}.svg")

    try:
        with request.urlopen(url) as response:
            if response.status != 200:
                return False
            content = response.read()
    except error.HTTPError:
        return False
    except error.URLError as exc:
        print(f"Network error while fetching {url}: {exc}")
        return False

    with open(output_path, "wb") as file_handle:
        file_handle.write(content)
    return True


def main() -> int:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    icon_id = 201
    while True:
        success = download_svg(icon_id, OUTPUT_DIR)
        if not success:
            print(f"Stopped on id {icon_id} (download failed).")
            break
        print(f"Downloaded {icon_id}.svg")
        icon_id += 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
