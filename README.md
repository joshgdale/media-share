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

## Distribute

Run these commands on the OS you want to install on. Native installers (DMG, Squirrel, deb, rpm) have to be built on that platform.

```bash
npm run package
npm run make
```

**`package`** produces a runnable app folder in `out/` — the Electron binary plus your UI. Copy or run that if you’re installing on the same machine.

**`make`** runs `package` first, then wraps that build in installers and a zip under `out/make/`. Use this when you’re handing the app to someone else. The zip is the same program, compressed; it is not an installer.

By default the CPU architecture matches the machine you’re building on.

### macOS

`package` leaves `Media Share.app` in `out/Media Share-darwin-arm64/` (or `…-x64/` / `…-universal/`). That’s the same thing you’d find inside `/Applications`. Copy it there, or run it from `out/`.

`make` also builds:

- `out/make/Media Share.dmg` — a disk image. Open it and drag the app into Applications, the usual way Mac software is handed to someone else.
- a zip under `out/make/zip/` — the same `.app`, compressed.

The `.app` and the `.dmg` contain the same program. The `.app` is the app; the `.dmg` is just a wrapper that makes it obvious where to put it. You don’t need the DMG to run Media Share yourself.

Apple Silicon is `arm64`. For an Intel Mac, or a single binary that runs on both:

```bash
npm run package -- --arch=x64
npm run make -- --arch=x64
npm run package -- --arch=universal
npm run make -- --arch=universal
```

This build is not signed with an Apple Developer ID. First launch: right-click the app, choose **Open**, then confirm. After that, it opens normally.

### Windows

`package` leaves a folder in `out/Media Share-win32-x64/` (or `…-arm64/`). Run `Media Share.exe` from that folder, or copy the whole folder wherever you want it.

`make` also builds:

- `Media Share Setup.exe` under `out/make/squirrel.windows/` — the installer. Run it; it puts the app in the user profile and adds a Start Menu shortcut. No admin prompt.
- a zip under `out/make/zip/` — the same folder as `package`, compressed.

The `.exe` in the packaged folder and the Setup installer launch the same program. Setup is for giving the app to someone else; you don’t need it to run Media Share yourself.

x64 is typical. For ARM Windows:

```bash
npm run package -- --arch=arm64
npm run make -- --arch=arm64
```

An unsigned build may show a SmartScreen warning. Choose **More info** → **Run anyway**.

### Linux

`package` leaves a folder in `out/Media Share-linux-x64/` (or `…-arm64/`). Run the `Media Share` binary from that folder, or copy the folder wherever you want it.

`make` also builds:

- a `.deb` under `out/make/deb/` — Debian, Ubuntu, and derivatives. `sudo dpkg -i <file.deb>`
- a `.rpm` under `out/make/rpm/` — Fedora, RHEL, and derivatives. `sudo rpm -i <file.rpm>`
- a zip under `out/make/zip/` — the same folder as `package`, compressed.

The packaged folder and the distro packages contain the same program. The folder is enough to run it; the `.deb` / `.rpm` are for installing system-wide.

`.deb` needs `fakeroot` and `dpkg` on the build machine; `.rpm` needs `rpm` or `rpm-build`. The zip does not.

x64 is typical. For ARM Linux:

```bash
npm run package -- --arch=arm64
npm run make -- --arch=arm64
```

## Stack

Electron, React, Vite, and Tailwind. Colours are [Flexoki](https://stephango.com/flexoki).
