"""Remove cream outer plate from story-collage (torn-edge corners → alpha)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[1] / "public" / "home" / "story-collage.jpg"
DST = Path(__file__).resolve().parents[1] / "public" / "home" / "story-collage.png"


def is_plate(r: int, g: int, b: int, a: int = 255) -> bool:
    if a == 0:
        return True
    # Cream / off-white plate outside torn circle
    if min(r, g, b) >= 238 and max(r, g, b) - min(r, g, b) <= 22:
        return True
    # Warm paper (252,247,241)
    if r >= 245 and g >= 240 and b >= 230 and (r - b) <= 28 and (g - b) <= 20:
        return True
    return False


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

    # Soft fringe next to transparency (cream only)
    for _ in range(5):
        peel: list[tuple[int, int]] = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if not (min(r, g, b) >= 228 and max(r, g, b) - min(r, g, b) <= 28):
                    continue
                near = any(
                    0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
                )
                if near:
                    peel.append((x, y))
        if not peel:
            break
        for x, y in peel:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)
            removed += 1

    img.save(DST, "PNG", optimize=True)
    print(f"saved {DST.name} removed~{removed} {w}x{h} bbox={img.getbbox()}")


if __name__ == "__main__":
    main()
