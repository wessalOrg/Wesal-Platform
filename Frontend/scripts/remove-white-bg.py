"""Remove studio plate from appointment-saved art — keep shirt/bow/flower."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[1] / "public" / "assistant" / "appointment-saved-mabrouk.jpg"
DST = Path(__file__).resolve().parents[1] / "public" / "assistant" / "appointment-saved-mabrouk.png"
PREVIEW = DST.with_name("appointment-saved-mabrouk-preview.jpg")


def is_plate(r: int, g: int, b: int, a: int = 255) -> bool:
    """Studio white / warm pink plate only — not shirt (~242,228,228)."""
    if a == 0:
        return True
    mn = min(r, g, b)
    mx = max(r, g, b)
    # Pure white plate
    if mn >= 248 and (mx - mn) <= 10:
        return True
    # Warm pink plate (255,240,233) — shirt is more neutral (r≈b)
    if (
        r >= 250
        and 228 <= g <= 246
        and 218 <= b <= 240
        and (r - b) >= 14
        and (r - g) >= 8
        and (g - b) <= 18
    ):
        return True
    return False


def is_soft_splash(r: int, g: int, b: int) -> bool:
    """Pale pink splash behind figure — stricter than shirt (sum≈698)."""
    mx, mn = max(r, g, b), min(r, g, b)
    return mx >= 248 and (mx - mn) <= 26 and (r + g + b) >= 705


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if is_plate(r, g, b, a):
            visited[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    removed = 0
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if is_plate(r, g, b, a):
            px[x, y] = (r, g, b, 0)
            removed += 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                nr, ng, nb, na = px[nx, ny]
                if is_plate(nr, ng, nb, na):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    # Enclosed plate pockets + soft splash (no edge-peel — that eats the shirt)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and (is_plate(r, g, b, a) or is_soft_splash(r, g, b)):
                px[x, y] = (r, g, b, 0)
                removed += 1

    img.save(DST, "PNG", optimize=True)
    preview = Image.new("RGBA", (w, h), (36, 28, 27, 255))
    preview.alpha_composite(img)
    preview.convert("RGB").save(PREVIEW, quality=90)
    print(f"saved {DST.name} removed~{removed} {w}x{h}")


if __name__ == "__main__":
    main()
