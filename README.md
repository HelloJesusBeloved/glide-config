<div align="center">

# glide-config

### A maximalist, battle-tested [Glide Browser](https://glide-browser.app) configuration.

**Complete Vim motions 路 A full tab command suite 路 Mode-aware site profiles 路 Safe Enter for AI chats 路 A 121-keyword emoji snippet engine 路 A live text stash**

<br />

[![Glide Browser](https://img.shields.io/badge/Glide-Browser-7C3AED?style=for-the-badge&logoColor=white)](https://glide-browser.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-Config-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Built on Firefox](https://img.shields.io/badge/Built_on-Firefox-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://www.mozilla.org/firefox/)
[![Lines](https://img.shields.io/badge/glide.ts-4%2C189_lines-A855F7?style=for-the-badge)](./glide.ts)

<br />

*"One of the best things to grace mankind."*
*"Vim based, fully 鈥?and when I say fully I mean pretty stinkin' near 100% fully 鈥?customizable."*
*"Any key can do almost anything that is physically possible without writing your own browser."* 馃槑

</div>

> **AI disclosure:** This README was written by AI, and most of `glide.ts` was AI-assisted.
> Read the [full note on AI](#-a-note-on-ai) at the bottom before you install anything.

---

## Contents

- [Why this config](#why-this-config)
- [Headline features](#headline-features)
- [Install](#install)
- [Full feature list](#full-feature-list-as-of-the-current-commit)
- [Repository layout](#repository-layout)
- [A note on AI](#-a-note-on-ai)

---

## Why this config

Glide gives you a browser whose every keystroke is a TypeScript function. This repo is what happens
when you actually take that offer seriously.

It is not a themed starter or a handful of remaps. It is a single `glide.ts` that rebuilds the parts
of Vim that browsers normally get wrong, adds a real tab-management command language, and then layers
on the workflow tools 鈥?snippets, a live text stash, AI-chat guardrails, Outlook triage, phishing
link decoding 鈥?that make a browser feel like an editor you already know.

Everything here is in daily use. Comments in the source explain not just what each block does, but the
bug that made it necessary.

---

## Headline features

### Vim motions that actually finish the job

Browsers ship half a Vim. This config ships the rest. Operator-pending mode gets `dw`, `db`, `d$`,
`d0`, `dG` and `dd`. Yanking gets `yy` and `yG`. Normal mode gets working `p`, `u`, `<C-r>`, `gg`
and `G`, plus `O`/`o` for opening lines above and below.

Visual mode is rebuilt from the ground up: `j`/`k` extend line by line, `w`/`b` extend by word,
`0`/`$` reach the line edges, `gg`/`G` reach the document edges, and `d` cuts to the system
clipboard. Visual `w` even corrects for the one-character offset between Vim's block cursor and the
browser's real caret 鈥?measured live with DOM Ranges so it works across `<strong>` tags and
text-node boundaries.

### A tab command language, not a pile of shortcuts

Everything tab-related lives under a `t` prefix that reads like sentences. `tuu` switches to your
genuinely most-recently-used tab (via `lastAccessed`, not strip order) and unloads the one you left.
`tua` unloads everything else. `tuf` hints the tab strip and unloads whichever you pick. All three
use Firefox's native discard path, so unloaded tabs play the real fade-to-grey animation.

Beyond unloading: `ts` sends the tab to a Firefox Sync device through a verified picker, `tcc`
clears cookies and site data by driving Firefox's own trust panel, `tm` moves the tab to a new
window, `tb` sends it to the bottom, `th` focuses it in the sidebar, `tr` reopens the last closed
tab, and `tf` hints tabs, tab groups and the new-tab button at once.

### Sites that know what mode they want

A single `UrlEnter` handler owns every site-default mode, which kills an entire class of race
conditions. **Ignore sites** (SSH consoles, web Vim) pass every key through. **Insert-preferred
sites** start in Insert, drop to a *temporary* Normal on Escape, and slide back to Insert once an
ordinary command completes 鈥?while genuinely persistent Normal commands keep you in Normal until you
ask otherwise. Hints, search and the command line are tracked separately, so `f` 鈫?Escape returns you
exactly where you were.

The URL bar gets the same care: focusing it from anywhere drops you into Insert, and the "is it
focused?" question is answered live from Firefox's own `focused` attribute every single time rather
than cached in a variable that can get stuck.

### Safe Enter 鈥?stop sending half-written prompts

On ChatGPT, Claude, Grok, Duck.ai, Mistral, Arena and Lumo, `Enter` becomes a newline. Sending is
deliberate: `Ctrl+Enter` sends, drops to Normal, and focuses the largest scrollable element so
`j`/`k` immediately scroll the conversation. `Ctrl+Alt+Enter` sends and leaves you in Insert, cursor
untouched. Sites whose native `Ctrl+Enter` doesn't submit can be moved to an override list that
translates it to plain `Enter`, and the whole system steps aside entirely while the URL bar has
focus.

### Glide Snippet Engine 1.0 鈥?type a keyword, get an emoji

One of the most-used features in the config, and the one that most reliably makes people say "wait,
do that again." It runs entirely inside Insert mode and turns short keywords into emoji.

The flow:

1. **Press `F4`** 鈥?the engine activates. It only listens while a snippet mapping is active; there is
   no background keylogger sitting in your browser.
2. **Type a keyword.** Most are two or three letters: `ew`, `f`, `h`, `l`, `p`, `s`, `t`, `g`,
   `sk`, `c`. Longer descriptors exist where they read better: `check`, `party`, `robot`, `shrug`,
   `sparkle`, `wink`.
3. **Press `Space` or `.`** 鈥?the keyword expands instantly into its emoji.

A few real mappings:

| Type | Get |
|---|---|
| `ew` | 馃ス |
| `f` | 馃敟 |
| `h` | 鉂わ笍 |
| `p` | 馃檹 |
| `t` | 馃憤 |
| `g` | 馃悙 |
| `sk` | 馃拃 |
| `check` | 鉁?|
| `party` | 馃帀 |
| `robot` | 馃 |
| `shrug` | 馃し |

The `q` prefix you see in the source is internal; the engine supplies it for you, so `F4` 鈫?`f` 鈫?+`Space` becomes 馃敟 rather than requiring you to type `qf`.

**121 snippets ship in the config**, covering emoji (馃槑 馃敟 馃悙 鉂わ笍 馃く 馃コ 馃拃 馃帀 鉁?馃 馃 馃馃徔鈥嶁檪锔? and unicode
text like `炉\_(銉?_/炉`.

**Two preview modes** give you alternatives to memorizing keywords:

- **`Shift+F4`** 鈥?opens Glide's command line with a live preview picker. Every snippet is listed
  with its keyword as the label, so you can browse and `Enter` to insert, or keep typing to filter.
- **`Ctrl+Shift+F4`** 鈥?same preview picker, but instead of inserting, it copies the selected snippet
  to your clipboard.

The engine also remembers exactly where your caret was before the picker opened 鈥?DOM path,
selection range, everything 鈥?and restores it perfectly after you insert, so your cursor never jumps
around unexpectedly.

Note: `Caps Lock` is remapped to `F4` on the author's Windows work keyboard, so if you use `Alt +
Caps Lock` to close windows you may want to remap the trigger to something easier to hit.

### A local, private text snippet stash

A stash-and-retrieve system for text you want to keep close: snippets, addresses, error messages,
half-written replies. An `m`-prefixed family of mappings saves text to a JSON file inside your Glide
profile 鈥?deliberately outside the Git-backed config directory, and never sent anywhere. `Ctrl+m`
saves a selection, `myy` saves the current line, `mdd` saves and deletes it. `Ctrl+,` pastes the
newest entry, with the second and third a modifier away. `mo` and `mc` open an interactive, viewable
menu to paste or copy any of the last 100 entries, and all reads and writes are serialized so rapid
saves can't lose data.

### Security and OSINT built into normal mode

`ys` shows hints over every Outlook SafeLinks URL on the page and yanks the *decoded* destination.
`1u` validates your clipboard and opens it in VirusTotal. `1o` normalizes and opens a clipboard URL
in a new tab. A shared URL normalizer accepts `apple.com`, `localhost:3000` and bare IPs while
rejecting `ftp://`, junk text and empty strings 鈥?and fails loudly through Glide's error handling
rather than silently doing nothing.

---

## Install

There are three things to set up, in order: **Glide itself**, a **config directory**, and then **this
config**. Every step below has a command-line option and a GUI option 鈥?expand the one you prefer.

> Glide is in **alpha**. There will be missing features and bugs. Windows builds are experimental and
> not yet code-signed, so you will have to click through an "unknown publisher" warning.

### Step 0 鈥?Where `glide.ts` lives

Glide looks for a `glide.ts` file and **loads the first one it finds**, in this order:

1. The **current working directory** the browser was launched from
2. Glide's **profile directory**
3. `$XDG_CONFIG_HOME/glide/`, or `~/.config/glide/` when `XDG_CONFIG_HOME` is not set

That means a stray `glide.ts` in whatever folder you launched Glide from will silently shadow your
real config. When in doubt, ask Glide directly 鈥?press `:` to open the command line, then run:

```
config_path
```

It prints the exact file Glide resolved. From the same command line you can also run
`config_init home` (create the config directory), `config_reload` (reload it) and `config_edit`
(open it in your default editor).

| OS | Default location created by `:config_init home` |
|---|---|
| **macOS** | `~/.config/glide/glide.ts` |
| **Linux** | `${XDG_CONFIG_HOME:-~/.config}/glide/glide.ts` |
| **Windows** | `%USERPROFILE%\.config\glide\glide.ts` |

### Step 1 鈥?Install Glide

<details open>
<summary><b>macOS</b></summary>

<br />

<details>
<summary><b>Command line</b> 鈥?Homebrew</summary>

```bash
brew install --cask glide-browser
```

</details>

<details>
<summary><b>GUI</b> 鈥?download the app</summary>

1. Open **[glide-browser.app](https://glide-browser.app)**.
2. Choose **macOS** and download the `.dmg`.
3. Open the `.dmg` and drag **Glide** into your `Applications` folder.
4. Launch it. If Gatekeeper complains, right-click the app 鈫?**Open**, then approve it.

</details>

</details>

<details>
<summary><b>Linux</b></summary>

<br />

<details>
<summary><b>Command line</b> 鈥?AUR, or the tarball</summary>

Arch-based distributions:

```bash
paru -S glide-browser-bin
# or
yay -S glide-browser-bin
```

Everything else 鈥?download the release tarball from
[glide-browser.app](https://glide-browser.app), then unpack it:

```bash
tar -xzf glide-browser-*.tar.*
cd glide-browser
./glide
```

Optionally install it system-wide so it shows up in your launcher:

```bash
sudo mv glide-browser /opt/glide-browser
sudo ln -sf /opt/glide-browser/glide /usr/local/bin/glide
```

</details>

<details>
<summary><b>GUI</b> 鈥?download and unpack</summary>

1. Open **[glide-browser.app](https://glide-browser.app)**.
2. Choose **Linux** and download the archive.
3. Open your **Files** app, right-click the archive 鈫?**Extract Here**.
4. Open the extracted folder and double-click the **Glide** executable.
5. If nothing happens, right-click the file 鈫?**Properties 鈫?Permissions** and tick **Allow
   executing file as program**, then try again.

</details>

</details>

<details>
<summary><b>Windows</b> 鈥?experimental, unsigned</summary>

<br />

<details>
<summary><b>Command line</b> 鈥?PowerShell</summary>

There is no official package-manager entry yet, so grab the `.exe` from
**[glide-browser.app](https://glide-browser.app)** first. Then clear the "downloaded from the
internet" mark so SmartScreen is less likely to block it:

```powershell
# Clear the Mark-of-the-Web on the downloaded installer
Unblock-File -Path "$env:USERPROFILE\Downloads\glide-browser-*.exe"
```

Run the installer, or start it silently if it supports your installer flavour:

```powershell
Start-Process "$env:USERPROFILE\Downloads\glide-browser-*.exe" -Wait
```

</details>

<details>
<summary><b>GUI</b> 鈥?download the installer</summary>

1. Open **[glide-browser.app](https://glide-browser.app)**.
2. Choose **Windows** and download the `.exe`.
3. Run it and click **More info 鈫?Run anyway** on the SmartScreen dialog.
4. Follow the installer, then launch **Glide** from the Start menu.

</details>

</details>

> **Double-check:** if Glide is already installed, you can skip straight to Step 2. The rest assumes a
> working `glide` / **Glide Browser** install from **[glide-browser.app](https://glide-browser.app)**.

### Step 2 鈥?Initialize the config directory

Glide ships without a config file. **`:config_init home`** creates `glide.ts` (with a small starter
example) plus `glide.d.ts` 鈥?the auto-generated TypeScript definitions that give you autocomplete and
type checking in your editor in every supported location.

<details>
<summary><b>Command line</b> 鈥?do it from inside Glide</summary>

Open Glide, press `:` to open the command line, and run:

```
config_init home
```

Then confirm where it landed:

```
config_path
```

Open it in your editor without leaving the browser:

```
config_edit
```

</details>

<details>
<summary><b>GUI</b> 鈥?do it with your file manager</summary>

1. Launch Glide and press `:` to open the command line.
2. Type **`config_init home`** and press `Enter` 鈥?this is the only supported way to generate the
   boilerplate `glide.d.ts`, so even the GUI route uses it once.
3. Need to see the folder? Run **`config_path`** and copy the path it prints.
4. Paste that path into Finder (**Go 鈫?Go to Folder**), Explorer's address bar, or your Linux file
   manager's location bar to open it directly.

> Do **not** edit `glide.d.ts` by hand 鈥?Glide rewrites it on every start.

</details>

### Step 3 鈥?Install this config

<details open>
<summary><b>Command line</b> 鈥?git clone</summary>

```bash
# Back up anything you already have
mv ~/.config/glide/glide.ts ~/.config/glide/glide.ts.bak 2>/dev/null

# Clone and install
git clone https://github.com/HelloJesusBeloved/glide-config.git
cp glide-config/glide.ts ~/.config/glide/glide.ts
```

On Windows PowerShell the same idea, using the path from `:config_path`:

```powershell
git clone https://github.com/HelloJesusBeloved/glide-config.git
Copy-Item glide-config\glide.ts "$env:USERPROFILE\.config\glide\glide.ts" -Force
```

Then reload from inside Glide with `<leader>c` (this config's reload mapping, only works after the first manual reload after you have installed this config) or `:config_reload`.

</details>

<details open>
<summary><b>GUI</b> 鈥?download and copy</summary>

1. On the repo page, click **Code 鈫?Download ZIP**.
2. Extract the archive.
3. In Glide, press `:` 鈫?**`config_path`** and copy the path.
4. Open that folder in your file manager, then copy the downloaded **`glide.ts`** over the existing
   one (or drag it in and choose **Replace**).
5. Back in Glide, run **`:config_reload`** or press `<leader>c` (this config's reload mapping, only works after the first manual reload after you have installed this config).

</details>

> **Optional:** create a `local.ts` next to `glide.ts` for machine-specific settings. This config
> imports it with `glide.include("local.ts")` and swallows a missing-file error, so it is completely
> safe to leave out. `local.ts` is `.gitignore`d, which makes it the right place for API keys, work
> hostnames, or anything you don't want to publish.

---

## Full feature list (as of the current commit)

> Accurate as of commit **`c3883a1`** 鈥?*"feat: Save or delete current line into snippet history"*.
> `glide.ts` is 4,189 lines at this commit. Later commits may add or change mappings.
>
> Every **View in `glide.ts`** link opens the exact line that registers the feature, pinned to
> `c3883a1` so the line numbers stay correct forever.

<details open>
<summary><b>Preferences</b></summary>

| Preference | Value | Purpose | View in <code>glide.ts</code> |
|---|---|---|---|
| `browser.urlbar.trimURLs` | `false` | Keep `https://` and trailing slashes visible | [L27](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L27) |
| `browser.tabs.fadeOutUnloadedTabs` | `true` | Play the fade-to-grey animation on unloaded tabs | [L31](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L31) |

</details>

<details open>
<summary><b>Vim motions 鈥?operator-pending, normal and visual</b></summary>

| Key | Mode | Action | View in <code>glide.ts</code> |
|---|---|---|---|
| `dw` | op-pending | Cut to next word | [L653](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L653) |
| `db` | op-pending | Delete backward one word | [L671](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L671) |
| `d$` | op-pending | Delete to end of line | [L689](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L689) |
| `d0` | op-pending | Delete to start of line | [L707](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L707) |
| `dG` | op-pending | Delete current line through end of text | [L726](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L726) |
| `dd` | normal | Cut current line | [L746](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L746) |
| `yy` | normal | Yank current line | [L764](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L764) |
| `yG` | normal | Yank current line through end of text | [L777](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L777) |
| `p` | normal | Paste from clipboard | [L800](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L800) |
| `u` | normal | Undo | [L2094](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2094) |
| `<C-r>` | normal | Redo | [L807](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L807) |
| `gg` | normal | Move cursor to start of text | [L823](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L823) |
| `G` | normal | Move cursor to end of text | [L817](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L817) |
| `O` | normal | Open a new line above | [L921](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L921) |
| `o` | normal | Open a new line below (fixed for web editors) | [L944](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L944) |
| `e` | normal | Focus the largest scrollable element on the page | [L2029](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2029) |
| `z` | normal | Open the native context menu at keyboard focus (Linux) | [L2019](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2019) |
| `j` | visual | Extend selection down one line | [L832](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L832) |
| `k` | visual | Extend selection up one line | [L837](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L837) |
| `b` | visual | Extend selection backward one word | [L844](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L844) |
| `w` | visual | Correct the browser-caret offset, then extend forward one word | [L887](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L887) |
| `gg` | visual | Extend selection to start of text | [L856](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L856) |
| `G` | visual | Extend selection to end of text | [L851](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L851) |
| `0` | visual | Extend selection to start of line | [L868](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L868) |
| `$` | visual | Extend selection to end of line | [L863](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L863) |
| `d` | visual | Cut selected text to the system clipboard | [L905](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L905) |
| `<leader>v` | normal | Toggle caret browsing | [L875](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L875) |

</details>

<details open>
<summary><b>Tabs</b></summary>

| Key | Action | View in <code>glide.ts</code> |
|---|---|---|
| `tuu` | Switch to most recently used tab, unload the current one | [L1014](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1014) |
| `tua` | Unload every tab except the current one | [L1047](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1047) |
| `tuf` | Hint the tab strip and unload the chosen tab | [L1072](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1072) |
| `ts` | Send current tab to a Firefox Sync device | [L1497](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1497) |
| `tcc` | Clear cookies and site data for the current site | [L1743](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1743) |
| `tm` | Move current tab to a new window | [L996](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L996) |
| `tb` | Move current tab to the bottom of the list | [L1754](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1754) |
| `th` | Focus the current tab in the tab sidebar | [L1765](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1765) |
| `tr` | Reopen the last closed tab | [L1786](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1786) |
| `tf` | Hint tabs, tab groups and the new-tab button | [L1792](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1792) |
| `<leader>n` | Open a new tab | [L2102](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2102) |
| `<leader>N` | Pick a Firefox container and open a new tab in it | [L1804](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1804) |
| `<leader>p` | Toggle pin on current tab | [L2088](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2088) |
| `<leader>1` | Toggle screen wake lock for the current tab | [L968](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L968) |

</details>

<details open>
<summary><b>Navigation, search and the URL bar</b></summary>

| Key | Action | View in <code>glide.ts</code> |
|---|---|---|
| `<leader>h` / `<leader>l` | Go back / forward in history | [L2043](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2043) / [L2046](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2046) |
| `<leader>o` / `<leader>i` | Jump back / forward in the jumplist | [L2056](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2056) / [L2059](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2059) |
| `=` / `-` | Zoom in / out | [L2067](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2067) / [L2073](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2073) |
| `yl` | Yank the current tab URL | [L2081](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2081) |
| `<C-l>` | Focus the URL bar in Insert mode | [L2121](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2121) |
| `n` | Open a keyword-bookmark prompt in a new tab | [L610](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L610) |
| `~` | Search selected text with DuckDuckGo | [L562](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L562) |
| `` ` `` | Search the *meaning* of selected text with DuckDuckGo | [L584](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L584) |
| `2n` | Search full, first and last name sequentially in a text field | [L1840](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1840) |

</details>

<details open>
<summary><b>Glide Snippet Engine 1.0</b></summary>

| Key | Mode | Action | View in <code>glide.ts</code> |
|---|---|---|---|
| `<F4>` | insert | Activate the emoji engine; type a keyword, then `Space` or `.` to expand | [L3678](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3678) |
| `<S-F4>` | insert | Open the interactive command-line picker to browse and insert snippets | [L3729](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3729) |
| `<C-S-F4>` | insert | Open the picker and copy the selected snippet to clipboard | [L3735](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3735) |

**121 keyword snippets** ship in the config 鈥?emoji (`馃ス` `鉁卄 `馃槑` `馃敟` `馃悙` `鉂わ笍` `馃く` `馃帀` `鉁╜
`馃` `馃` `馃馃徔鈥嶁檪锔廯) and unicode text (`炉\_(銉?_/炉`). Snippets are stored with a leading `q`
internally, but you never type it.

- The engine only listens while a snippet mapping is active 鈥?**no background keylogger**.
- `Space` and `.` confirm exact matches directly without opening the picker.
- The picker remembers your caret position (DOM path, selection range) and restores it after
  insertion, so your cursor never jumps.

</details>

<details open>
<summary><b>Local text snippet stash</b></summary>

| Key | Action | View in <code>glide.ts</code> |
|---|---|---|
| `<C-m>` | Save the selection (or clipboard) to the local stash | [L3918](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3918) |
| `myy` | Save the current line | [L3927](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3927) |
| `mdd` | Save the current line, then delete it | [L3940](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3940) |
| `<C-,>` | Paste the newest stashed entry | [L3958](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3958) |
| `<C-A-,>` | Paste the second-newest entry | [L3958](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3958) |
| `<C-A-lt>` | Paste the third-newest entry | [L3958](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3958) |
| `mo` | Open the interactive, viewable stash menu and paste an entry | [L3979](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3979) |
| `mc` | Open the interactive, viewable stash menu and copy an entry | [L3983](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3983) |
| `mdm` | Delete the newest entry | [L3965](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3965) |
| `md1` 鈥?`md9` | Delete the N newest entries | [L3970](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3970) |
| `mdac` | Clear the entire stash | [L3975](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3975) |

Capped at 100 entries, stored at `<profile>/glide-text-snippets.json`, with serialized reads and
writes and schema validation that refuses to overwrite a malformed file.

</details>

<details open>
<summary><b>Security and link tools</b></summary>

| Key | Action | View in <code>glide.ts</code> |
|---|---|---|
| `ys` | Hint Outlook SafeLinks and yank the decoded destination URL | [L1874](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1874) |
| `1u` | Scan the clipboard URL with VirusTotal | [L1926](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1926) |
| `1o` | Open the clipboard URL in a new tab | [L1943](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L1943) |

Backed by a shared URL normalizer that upgrades bare hosts to `https://`, allows `localhost` and raw
IPs, and rejects non-HTTP schemes and junk text with a visible Glide error.

</details>

<details open>
<summary><b>AI chat 鈥?Safe Enter</b></summary>

| Key | Behavior | View in <code>glide.ts</code> |
|---|---|---|
| `<Enter>` | Insert a newline instead of sending | [L2968](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2968) |
| `<C-Enter>` | Send, enter Normal mode, focus the chat scroll area | [L2993](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2993) |
| `<C-A-Enter>` | Send and stay in Insert mode | [L3028](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3028) |

Active on `chatgpt.com`, `duck.ai`, `grok.com`, `claude.ai`, `mistral.ai`, `arena.ai` and
`lumo.proton.me`, with an override list for sites whose native `Ctrl+Enter` does not submit
([L2857](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2857)).

</details>

<details open>
<summary><b>Site-specific profiles</b></summary>

**Outlook** (`outlook.cloud.microsoft`, `outlook.office.com`) 鈥?mappings sync in and out on `UrlEnter`
so Which-Key shows every tag description on Outlook and nothing anywhere else ([L3129](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3129)).

| Key | Action | View in <code>glide.ts</code> |
|---|---|---|
| `)` / `(` | Focus the next / previous Outlook region | [L3134](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3134) / [L3140](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3140) |
| `J` | Select the autocorrected word from the Outlook menu | [L3148](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3148) |
| `!s` | Categories: Not Phishing, spam | [L3159](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3159) |
| `!k` | Categories: Not Phishing, KnowBe4 | [L3166](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3166) |
| `!f` | Categories: Not Phishing, Fairmount | [L3173](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3173) |
| `!n` | Category: Not Phishing | [L3180](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3180) |
| `!r` | Categories: Not Phishing, Returned | [L3186](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3186) |
| `@` | Clear two Outlook categories from an email | [L3194](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3194) |

**Super Productivity** (`app.super-productivity.com`) 鈥?after `Enter` in Insert mode, the next
`Escape` passes straight through so the task-entry UI closes without leaving Insert. Any other
`Escape` behaves normally ([L3224](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3224), [L3245](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3245)).

**Ignore sites** 鈥?`10.0.1.108`, `100.124.253.95`, `vim-editor-online.vercel.app`, and the Tailscale
SSH re-auth page pass every keystroke through untouched ([L2147](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2147)).

**Insert-preferred sites** 鈥?`app.super-productivity.com` and `youtube.com` ([L2155](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2155)).

</details>

<details open>
<summary><b>Config management</b></summary>

| Key | Action | View in <code>glide.ts</code> |
|---|---|---|
| `<leader>c` | Reload the Glide config | [L2108](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2108) |
| `<leader>C` | Edit the Glide config | [L2114](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2114) |

</details>

<details open>
<summary><b>Background processes</b></summary>

| Feature | What it does | View in <code>glide.ts</code> |
|---|---|---|
| URL bar 鈫?Insert mode | Any URL-bar focus (click, `<C-l>`, `<C-k>`, `F6`, `Alt+D`, new tab) switches to Insert. `Esc` remains a one-time exit, not a lock. | [L3994](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L3994) |
| Live URL-bar focus | Reads Firefox's live `focused` attribute and blur evidence rather than caching focus state. | [L4057](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L4057) |
| Config-load hook | Hooks the URL bar once the config loads. | [L4174](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L4174) |
| New-tab / tab-switch hook | Reasserts Insert for an already-focused URL bar after `UrlEnter`. | [L4179](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L4179) |
| Single-owner `UrlEnter` | Applies and undoes ignore/insert site modes with no cleanup-race. | [L2403](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2403) |
| Mode-change tracking | Distinguishes intentional `Esc` from a page focus/click and preserves transient mode state. | [L2483](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L2483) |

</details>

<details>
<summary><b>Internal helpers</b></summary>

| Helper | Purpose | View in <code>glide.ts</code> |
|---|---|---|
| `clickElement` | Click the first matching selector inside a tab | [L40](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L40) |
| `safeDel` | Idempotently remove mappings before replacing them | [L70](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L70) |
| `decodeSafeLinksURL` | Decode Outlook SafeLinks destinations | [L86](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L86) |
| `normalizeURL` | Validate and normalize HTTP(S), localhost and raw-IP URLs | [L116](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L116) |
| `glideError` | Raise visible Glide errors | [L150](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L150) |
| `readClipboardURL` | Read, validate and normalize a clipboard URL | [L160](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L160) |
| `getVisualWordCorrection` | Detect the browser-caret offset for visual `w` | [L203](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L203) |
| `focusLargestScrollable` | Put focus on the page's largest scroll area | [L453](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L453) |
| `mostRecentlyUsedTab` | Statelessly choose the highest `lastAccessed` tab | [L506](https://github.com/HelloJesusBeloved/glide-config/blob/c3883a1/glide.ts#L506) |

</details>

---

## Repository layout

```
glide-config/
鈹溾攢鈹€ glide.ts              # The config. 4,189 lines, heavily commented.
鈹溾攢鈹€ currently-inactive.ts # Working code kept for reference, not loaded.
鈹溾攢鈹€ README.md
鈹斺攢鈹€ local.ts              # Optional, gitignored, machine-specific overrides.
```

`currently-inactive.ts` holds a URLQuery API integration (OS command path resolution, a `runCommand`
wrapper around `glide.process.execute`, and the submission flow) that was retired once VirusTotal
proved to cover the same ground more reliably.

---

## 馃 A note on AI

**This README was written by AI, and so was most of `glide.ts`.**

Large portions of this configuration were generated with ChatGPT and Claude, then tested, corrected
and shaped by hand over many iterations. The per-block `//Source:` comments throughout `glide.ts`
credit whichever model or person produced that section 鈥?you will see `ChatGPT`, `claude-fable-5.1-max`,
`Me`, and plenty of `Me & ChatGPT`.

That said: **every feature here is manually verified and in real daily use.** The long comments
explaining *why* a block is written a certain way exist because the obvious version broke something
real 鈥?a stuck ignore mode, a `1u`/`1o` keymap collision, an AI prompt submitted by accident. The AI
wrote a lot of the code; the bug reports, the fixes and the judgement calls are mine.

Treat it the way you'd treat any config you found online: read it before you run it.

---

<div align="center">

**[glide-browser.app](https://glide-browser.app)** 路 [Config docs](https://glide-browser.app/config) 路 [API reference](https://glide-browser.app/api)

<sub>Ps. I am currently in a tornado watch lol 馃尓锔?/sub>

</div>
