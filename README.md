# Media Share

Media Share is a desktop app for presenting a playlist of videos and images. You run it from a control panel; a separate 16:9 window is what you share or put on a second screen.

## What it’s for

Putting a sequence of local clips and stills on a call, a projector, or a spare display — without dragging files around in a browser or firing up an editor. Build the playlist once, save it, and run it again later.

## How it works

There are two windows:

- **Control panel** — the playlist and transport. Add videos and images, rename and reorder cues, and set what happens when each one ends. Play, pause, stop, skip, seek, and volume live here. The current cue, timecode, and remaining time come back from the output window.
- **Output** — a frameless 16:9 window that only shows the media. If a second display is connected, it opens there.

Click a cue to put it on the output. Playlists save as `.msplaylist` files.

### Cues

A cue is one video or image, with a title and an end action:

| End action | When the cue finishes |
| --- | --- |
| **Continue** | Play the next cue |
| **Stop** | Go to standby |
| **Freeze** | Hold the still (images only) |

Videos default to Stop, images to Freeze. If an image continues or stops, it uses a duration you can edit (5 seconds unless you change it).

### Standby

When nothing is playing, the output shows whatever you’ve set as blank: a solid colour, a still, or centred text.

## Getting started

```bash
npm install
npm run dev
```

Drag files onto the queue, or use **Add media**.

- **Video:** mp4, mov, webm, mkv, m4v, avi
- **Image:** png, jpg, jpeg, webp, gif, bmp

Save and open playlists from Settings. You can also open a `.msplaylist` file directly.

```bash
npm run build
```

## Stack

Electron, React, Vite, and Tailwind. Colours are [Flexoki](https://stephango.com/flexoki).
