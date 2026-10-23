import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.import_map_assets import building_main  # noqa: E402


def main() -> int:
    return building_main(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())
