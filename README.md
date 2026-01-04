![distracted! - "block distracting websites! do mini tasks to get back on them..."](public/readme-banner.png)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ggimjhcfchbfdhpehdekdiblbfmijngf?label=chrome%20web%20store&style=for-the-badge)](https://chromewebstore.google.com/detail/distracted/ggimjhcfchbfdhpehdekdiblbfmijngf)
[![Firefox Add-ons](https://img.shields.io/amo/v/distracted?label=firefox%20add-ons&style=for-the-badge)](https://addons.mozilla.org/en-GB/firefox/addon/distracted/)

## what?

- blocks websites that distract you
- multiple unlock challenges (more soon):
  - timer
  - hold button
  - typing something random (no copy/paste)
  - solving a math problem
  - active blocking when Claude Code is inactive
- (optionally) track your visits and success rate
- all data stays local on your device

## how to install

**chrome/chromium:** install from the [chrome web store](https://chromewebstore.google.com/detail/distracted/ggimjhcfchbfdhpehdekdiblbfmijngf)

**firefox:** install from [firefox add-ons](https://addons.mozilla.org/en-GB/firefox/addon/distracted/)

**manual install (all browsers/dev builds):**

1. download the latest release from [releases](https://github.com/f1shy-dev/distracted/releases)
2. unzip the file
3. load it in your browser:
   - **chrome/chromium-based browsers:** go to `chrome://extensions/`, enable "developer mode", click "load unpacked", select the unzipped folder
   - **firefox/firefox-based browsers:** go to `about:debugging`, click "this firefox", click "load temporary add-on", select the `manifest.json` file from the unzipped folder
4. done! configure which sites to block in the extension popup

## why?

mindless visiting is more and more common. you end up idling, and then end up on a site you didn't want to be on in the first place.

the idea of this extension is to give you a boring, non-stimulating task. having to wait, hold the button or so on is like giving your mind time to think about what you're doing consciously, or making it annoying enough that you don't want to do it.

it's similar to not remembering/saving your payment details, so you have to find your physical card/wallet when doing online purchases; giving a second chance to rethink your purchase

### but... can't i just delete the extension?

yes! you could also just not install it! there is only so many layers of annoyance you can add<sup>[1]</sup>, after which it becomes more about your own self-control than what the technology can do for you.

...but if you do have an idea for how it could be more useful for you, [open an issue](https://github.com/f1shy-dev/distracted/issues) and let me know!

<details>
<summary>[1] ideas</summary>

- (for windows), add another step to the uninstall process [by using registry options](https://www.thewindowsclub.com/prevent-uninstallation-of-chrome-extensions)
</details>

## how to build

### environment

- **operating system:** Ubuntu 24.04 LTS (or compatible Linux distribution)
- **package manager:** Bun 1.3.6 or later
- **node.js:** v25.2.1 or later (required by Bun)

### instructions

1. install bun (if not already installed):

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

   or follow the official installation guide: https://bun.sh/docs/installation

2. verify bun installation:

   ```bash
   bun --version
   # should output: 1.3.6 or later
   ```

3. install project dependencies, and build the extension:

   ```bash
   bun install --frozen-lockfile
   bun run zip # for chrome
   bun run zip:firefox # for firefox
   ```

4. outputs (for release or inspection/review):
   - chrome:
     - `.output/chrome-mv3/`
     - `.output/distracted-<version>-chrome.zip`
   - firefox:
     - `.output/firefox-mv2/`
     - `.output/distracted-<version>-firefox.zip`
     - `.output/distracted-<version>-sources.zip`
