# Whale Jail

A Flappy Bird–style game based on the story of Jonah and the great fish. You play as the whale and swim through the deep, past pillars from five parts of the story, each drawn in its own art style:

| Zone | Scripture | Art style |
| --- | --- | --- |
| The Ship to Tarshish | Jonah 1:3 | Flat vector timbers |
| The Coral Reef | Jonah 2:3 | Pixel art |
| The Weeds of the Deep | Jonah 2:5 | Soft painted, animated kelp |
| The Roots of the Mountains | Jonah 2:6 | Low-poly faceted stone |
| The Great City of Nineveh | Jonah 3:3 | Ink-sketch columns |

The zone changes every six pillars. When you lose, the Share button opens your device's share sheet. If the browser has no share sheet, the score is copied to the clipboard.

**Play:** https://ryangano.github.io/whale-jail/

## Controls

Tap, click, or press Space, ↑ or W to swim up.

## Running locally

It's a static site with no build step:

```bash
python -m http.server 8123
```

Then open http://localhost:8123. Add `#debug` to the URL to get `window.whaleJail` (game state plus a manual `step(frames)` function).

## Link preview and icons

When the game's link is pasted into a message, the preview uses the Open Graph tags in `index.html` and shows `og.jpg`. The card and the app icons (`icon-*.png`, `apple-touch-icon.png`) are drawn from the game's own art by [tools/share-images.js](tools/share-images.js); the comment at the top explains how to run it. Link apps cache the image by its address, so a new card needs a new filename.

Scripture quotations are from the King James Version (public domain).
