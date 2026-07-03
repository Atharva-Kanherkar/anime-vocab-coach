# Hero slide images

Anime-inspired atmospheric backgrounds for the scroll-driven hero. Each is a dark,
painterly scene with a calm center that holds the overlaid title text. Generated at
1536×1024 and optimized to JPEG (~75–230 KB).

| File | Slide |
|------|-------|
| `01-immersion.jpg` | 01 — Immersion (dusk tatami room) |
| `02-platform.jpg`  | 02 — Any platform (neon night street) |
| `03-beginners.jpg` | 03 — Beginners (misty torii at dawn) |
| `04-memory.jpg`    | 04 — Memory (cherry blossoms at dusk) |
| `05-private.jpg`   | 05 — Private (starry night, lone cabin) |

To swap an image: replace the JPG here (keep the filename) and re-optimize:

```bash
magick new.png -strip -interlace Plane -quality 82 0X-name.jpg
```

Each slide also has a CSS-gradient `tone` in `src/lib/slides.ts` used as the fallback
when no `image` is set. Generation prompts are in `PROMPTS.md`.
