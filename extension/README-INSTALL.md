# Install Anime Vocab Coach (unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `extension/` folder inside this repository (the folder that contains `manifest.json`).
5. Open YouTube, play any video, click the **CC** button, and choose **Japanese** captions. Within a minute or two of dialogue, the extension should pause and show a vocabulary card.

## Tips

- Use **Pause mode** (default) for interactive cards. Switch to **Notify** or **Off** from the toolbar popup.
- Click the extension icon to see today's stats, streak, and recent words.
- Open **Settings** from the popup footer for cooldown, level targeting, word list, export, and reset.

## Supported sites

- YouTube (Japanese subtitles / auto-generated Japanese CC)
- Netflix (Japanese subtitles selected in the player menu)
- Other sites with HTML5 `<track>` subtitles require adding host permissions to `manifest.json` manually in v1
