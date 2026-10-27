// Config docs:
//
//   https://glide-browser.app/config
//
// API reference:
//
//   https://glide-browser.app/api
//
// Default config files can be found here:
//
//   https://github.com/glide-browser/glide/tree/main/src/glide/browser/base/content/plugins
//
// Most default keymappings are defined here:
//
//   https://github.com/glide-browser/glide/blob/main/src/glide/browser/base/content/plugins/keymaps.mts
//
// Try typing `glide.` and see what you can do!

glide.o.hint_size = "14px";

//Imports (simply so I can add configuration I don't want in the repo, does nothing unless you have "local.ts" in the same folder as your glide.ts)
glide.include("local.ts").catch(() => {});

// Preferences (about:config)
// Glide runs these via Firefox Services.prefs on config reload / startup.
//1. Keep full URL protocol (https://) and trailing slashes visible in the address bar
glide.prefs.set("browser.urlbar.trimURLs", false);

//2. Enable Tab Fadeout When Unloaded
//Note: This is needed for unloading tabs to play the fade to grey animation when triggered (//6. Tabs section)
glide.prefs.set("browser.tabs.fadeOutUnloadedTabs", true);

//Functions

//1. clickElement - The function that raps the tab_id: number, selector: string for mapping keybinds to website elements
//Source: ChatGPT
// Click the first element matching any of the provided CSS selectors.
// Returns true if an element was clicked, false otherwise.
// Source: Me & ChatGPT
async function clickElement(tab_id: number, ...selectors: string[]): Promise<boolean> {
    return await glide.content.execute(
        (selectors) => {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    (element as HTMLElement).click();
                    return true;
                }
            }
            return false;
        },
        {
            tab_id,
            args: [selectors],
        },
    );
}

//2. safeDel - The function that makes sure a keybind is removed cleanly after the config is reloaded, reguardless of Glide's internal cleanup state
//Source: ChatGPT
//
// WARNING: glide.keymaps.del() deletes the key AND every mapping that starts
// with it. Glide normalizes shifted keys before matching, so write shifted
// symbols as the symbol itself ("!" or "<S-!>"), never "<S-1>": "<S-1>"
// becomes plain "1" and deletes 1u, 1o and anything else under "1".
// (That exact line in local.ts was the cause of the 1u/1o bug.)
//
// For site-specific mappings prefer glide.buf.keymaps.set() (or an idempotent
// UrlEnter sync when Which-Key descriptions are needed) instead of set + cleanup.
function safeDel(
    mode: GlideMode | GlideMode[],
    key: string,
) {
    try {
        glide.keymaps.del(mode, key);
    } catch {
        // Already removed.
    }
}

// 3. Outlook Safelinks Decoder that checks the SafeLinks hostname and returns the decoded "url" parameter.
// Based on/Inspired by the SafeLink decoder implementation from sharevb/it-tools,
// originally forked from CorentinTh/it-tools.
// https://github.com/sharevb/it-tools/blob/chore/all-my-stuffs/src/tools/safelink-decoder/safelink-decoder.service.ts
//Source: ChatGPT
function decodeSafeLinksURL(safeLinksUrl: string): string | null {
    try {
        const url = new URL(safeLinksUrl);

        if (!url.hostname.toLowerCase().endsWith(".safelinks.protection.outlook.com")) {
            return null;
        }

        return url.searchParams.get("url");
    } catch {
        return null;
    }
}


//4. Normalize and validate a web URL
//Source: ChatGPT (localhost tweak: Me (claude-fable-5.1-max))
//
//Examples:
// https://apple.com → valid
// http://apple.com → valid
// apple.com → becomes https://apple.com
// www.apple.com/foo → becomes https://www.apple.com/foo
// localhost:3000 → becomes https://localhost:3000
// 10.0.1.108 → becomes https://10.0.1.108
// sdfsdfsdjf → error
// random text → error
// ftp://... → error
// empty string → error

function normalizeURL(value: string): string | null {
    value = value.trim();

    if (!value) {
        return null;
    }

    // If there is no URL scheme, assume HTTPS.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
        value = `https://${value}`;
    }

    try {
        const url = new URL(value);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return null;
        }

        // Require a hostname that looks like a real domain (or localhost).
        if (!url.hostname.includes(".") && url.hostname !== "localhost") {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
}


//5. Show an error using Glide's built-in error handling
//Source: ChatGPT
function glideError(message: string): never {
    throw new Error(message);
}


//6. Read the clipboard and turn it into a validated URL.
// Shared by 1u / 1o so both validate the clipboard and fail visibly in Glide.
// Note: inside the Glide config `navigator.clipboard.readText()` runs with
// the system principal, so there is no permission prompt to worry about.
//Source: claude-fable-5.1-max
async function readClipboardURL(): Promise<string> {
    const clipboard = await navigator.clipboard.readText();
    const text = clipboard.trim();

    if (!text) {
        glideError("Clipboard is empty.");
    }

    const url = normalizeURL(text);

    if (!url) {
        glideError(`Clipboard does not contain a valid URL (got: "${text.slice(0, 40)}").`);
    }

    return url;
}


//7. Check whether the visual mode cursor is between the first and second
// characters of a word.
//
// This works across HTML text-node boundaries by using DOM Ranges to
// inspect the text immediately surrounding the actual selection focus.
//
// Examples:
//
//   hello
//   ^     → false
//
//   hello
//    ^    → true
//
//   <strong>he</strong>llo
//       ^              → true
//
//   hello <strong>world</strong>
//         ^                    → true
//
// The function deliberately checks the selection's FOCUS position,
// because that is the side of the selection where the Vim cursor is.
//Source: ChatGPT
// Returns the optional correction to send BEFORE Ctrl+Shift+Right.
// An existing selection uses Shift+Left so its anchor is preserved.
async function getVisualWordCorrection(
    tab_id: number,
): Promise<"" | "<Left>" | "<S-Left>"> {
    try {
        const results = await browser.scripting.executeScript({
            target: { tabId: tab_id, allFrames: true },
            func: (): "" | "<Left>" | "<S-Left>" => {
                // Parents of focused iframes can also report hasFocus().
                // Only the deepest focused frame should inspect its caret.
                if (!document.hasFocus()) return "";

                let active = document.activeElement;
                while (active?.shadowRoot?.activeElement) {
                    active = active.shadowRoot.activeElement;
                }
                if (active?.matches("iframe, frame")) return "";

                const segmenter = new Intl.Segmenter(undefined, {
                    granularity: "grapheme",
                });

                const isWord = (text: string) =>
                    /^[\p{L}\p{N}_][\p{L}\p{N}\p{M}_\u200c\u200d]*$/u.test(text);

                const check = (
                    before: string,
                    after: string,
                    collapsed: boolean,
                ): "" | "<Left>" | "<S-Left>" => {
                    const characters = Array.from(
                        segmenter.segment(before + after),
                    );
                    const index = characters.findIndex(
                        (part) => part.index === before.length,
                    );

                    // No boundary here means the caret is inside a grapheme,
                    // such as between a letter and its combining accent.
                    if (index < 1) return "";

                    const previous = characters[index - 1].segment;
                    const next = characters[index].segment;
                    const previousPrevious = characters[index - 2]?.segment;

                    if (
                        !isWord(previous) ||
                        !isWord(next) ||
                        (previousPrevious !== undefined &&
                            isWord(previousPrevious))
                    ) {
                        return "";
                    }

                    return collapsed ? "<Left>" : "<S-Left>";
                };

                // Firefox keeps native text-control selections separately
                // from window.getSelection(). Use the focus end, not always
                // selectionEnd, because a selection can run backwards.
                if (
                    active instanceof HTMLInputElement ||
                    active instanceof HTMLTextAreaElement
                ) {
                    const start = active.selectionStart;
                    const end = active.selectionEnd;
                    if (start === null || end === null) return "";

                    const focus =
                        active.selectionDirection === "backward"
                            ? start
                            : end;

                    return check(
                        active.value.slice(0, focus),
                        active.value.slice(focus),
                        start === end,
                    );
                }

                const selection = window.getSelection();
                if (!selection || selection.rangeCount !== 1) return "";

                const focusNode = selection.focusNode;
                const focusOffset = selection.focusOffset;
                if (!focusNode) return "";

                const styles = new Map<Element, CSSStyleDeclaration>();

                const styleOf = (element: Element) => {
                    let style = styles.get(element);
                    if (!style) {
                        style = getComputedStyle(element);
                        styles.set(element, style);
                    }
                    return style;
                };

                const isInline = (element: Element) => {
                    const display = styleOf(element).display;
                    return display === "inline" || display === "contents";
                };

                // Expand out of inline wrappers, but stay inside the nearest
                // block, editing host, or shadow root.
                let scope: Node =
                    focusNode.nodeType === Node.TEXT_NODE
                        ? focusNode.parentNode!
                        : focusNode;

                while (scope.parentNode) {
                    if (
                        scope instanceof Element &&
                        !isInline(scope)
                    ) break;

                    if (
                        scope instanceof HTMLElement &&
                        scope.isContentEditable &&
                        !scope.parentElement?.isContentEditable
                    ) break;

                    if (
                        scope.parentNode.nodeType === Node.DOCUMENT_NODE
                    ) break;

                    scope = scope.parentNode;
                    if (scope instanceof ShadowRoot) break;
                }

                let before = "";
                let after = "";
                let foundCaret = false;
                let visited = 0;
                let charactersRead = 0;
                let tooLarge = false;

                const append = (text: string) => {
                    charactersRead += text.length;
                    if (charactersRead > 100_000) {
                        tooLarge = true;
                        return;
                    }

                    if (foundCaret) after += text;
                    else before += text;
                };

                const visit = (node: Node): void => {
                    if (tooLarge) return;

                    if (++visited > 5_000) {
                        tooLarge = true;
                        return;
                    }

                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.nodeValue ?? "";

                        if (node === focusNode) {
                            append(text.slice(0, focusOffset));
                            foundCaret = true;
                            append(text.slice(focusOffset));
                        } else {
                            append(text);
                        }
                        return;
                    }

                    if (
                        !(node instanceof Element) &&
                        !(node instanceof ShadowRoot)
                    ) return;

                    let boundary = false;

                    if (node instanceof Element) {
                        if (
                            node.matches(
                                "script, style, template, noscript",
                            )
                        ) return;

                        const style = styleOf(node);
                        if (style.display === "none") return;

                        if (
                            style.visibility !== "visible" ||
                            style.contentVisibility === "hidden" ||
                            style.userSelect === "none" ||
                            node.matches(
                                "[inert], input, textarea, select, img, br, hr, iframe, frame, canvas, svg, slot",
                            ) ||
                            (node !== scope && node.shadowRoot !== null)
                        ) {
                            // Do not invent a joined word across a line break,
                            // non-text control, or an unsupported subtree.
                            append("\n");
                            return;
                        }

                        boundary = !isInline(node);
                    }

                    if (boundary) append("\n");

                    const children = node.childNodes;
                    for (let i = 0; i <= children.length; i++) {
                        // Element focus offsets count child nodes, not letters.
                        if (
                            node === focusNode &&
                            i === focusOffset
                        ) {
                            foundCaret = true;
                        }

                        if (i < children.length) visit(children[i]);
                        if (tooLarge) return;
                    }

                    if (boundary) append("\n");
                };

                visit(scope);

                if (!foundCaret || tooLarge) return "";
                return check(before, after, selection.isCollapsed);
            },
        });

        for (const result of results) {
            if (result.error) continue;

            if (
                result.result === "<Left>" ||
                result.result === "<S-Left>"
            ) {
                return result.result;
            }
        }
    } catch {
        // Restricted pages or inaccessible frames: use native movement
        // without guessing whether an extra correction is needed.
    }

    return "";
}


//8. Focus the largest scrollable element on the page
// Used by Safe Enter after sending a prompt so j/k scroll the chat view.
//Source: ChatGPT
async function focusLargestScrollable(
    tab_id: number,
): Promise<void> {
    await glide.content.execute(() => {
        const elements = Array.from(
            document.querySelectorAll<HTMLElement>("*"),
        );

        let best: HTMLElement | null = null;
        let bestArea = 0;

        for (const el of elements) {
            const style = getComputedStyle(el);

            if (
                (style.overflowY === "auto" ||
                 style.overflowY === "scroll") &&
                el.scrollHeight > el.clientHeight
            ) {
                const area =
                    el.clientWidth * el.clientHeight;

                if (area > bestArea) {
                    bestArea = area;
                    best = el;
                }
            }
        }

        if (best) {
            best.tabIndex ||= -1;
            best.focus();
        }
    }, {
        tab_id,
    });
}

//9. Most recently used tab
// browser.tabs.query() returns tabs in tab-strip order, so the old
// tabs.find(tab => tab.id !== tab_id) always picked the left-most ("top")
// tab. Firefox records when each tab was last activated in
// tabs.Tab.lastAccessed, so the other tab with the highest value is the
// one you were on before this one - no matter where it sits in the strip
// or when it was opened.
//
// This is deliberately stateless: Firefox is asked at the moment tu runs,
// so it stays correct across tab reordering, closed tabs, other windows,
// session restore and config reloads. (An MRU list kept in the config
// would forget everything on reload.)

type TabForMru = {
    id?: number;
    hidden?: boolean;
    lastAccessed?: number;
};

function mostRecentlyUsedTab(
    tabs: TabForMru[],
    currentTabId: number,
): TabForMru | undefined {
    const currentIndex = tabs.findIndex(tab => tab.id === currentTabId);

    const candidates = tabs
        .map((tab, index) => ({ tab, index }))
        .filter(({ tab }) =>
            tab.id !== undefined &&
            tab.id !== currentTabId &&
            !tab.hidden
        );

    if (candidates.length === 0) {
        return undefined;
    }

    // Tabs Firefox has actually recorded an activation for.
    const timed = candidates.filter(({ tab }) =>
        typeof tab.lastAccessed === "number" &&
        Number.isFinite(tab.lastAccessed) &&
        tab.lastAccessed > 0
    );

    if (timed.length > 0) {
        return timed.reduce((best, entry) =>
            entry.tab.lastAccessed! > best.tab.lastAccessed!
                ? entry
                : best
        ).tab;
    }

    // Fallback when no timestamps are available (e.g. a session restored
    // with zeroed lastAccessed values): the nearest tab, preferring the
    // one to the left, which is what :tabprevious would pick.
    const before = candidates
        .filter(({ index }) => index < currentIndex)
        .sort((a, b) => b.index - a.index)[0];

    const after = candidates
        .filter(({ index }) => index > currentIndex)
        .sort((a, b) => a.index - b.index)[0];

    return (before ?? after)?.tab;
}


//Custom Keybinds and Commands

//1. Search highlighted text with duckduckgo in normal and visual mode
//Source: ChatGPT
glide.keymaps.set(["normal", "visual"], "~", async ({ tab_id }) => {
  const selected = await glide.content.execute(
    () => window.getSelection()?.toString(),
    { tab_id },
  );

  if (!selected?.trim()) {
    return;
  }

  const query = encodeURIComponent(selected.trim());

  await glide.excmds.execute(
    `tab_new https://duckduckgo.com/?q=${query}`
  );
}, {
  description: "Search selected text with DuckDuckGo",
});


//2. Search highlighted text with duckduckgo with "meaning" appended in normal and visual mode
//Source: ChatGPT
glide.keymaps.set(["normal", "visual"], "`", async ({ tab_id }) => {
  const selected = await glide.content.execute(
    () => window.getSelection()?.toString(),
    { tab_id },
  );

  if (!selected?.trim()) {
    return;
  }

  const query = encodeURIComponent(selected.trim());

  await glide.excmds.execute(
    `tab_new https://duckduckgo.com/?q=${query}%20meaning`
  );
}, {
  description: "Search selected text meaning with DuckDuckGo",
});


//3. Open keyword bookmark in a new tab with <leader>N
// Opens a dedicated commandline prompt to enter a Firefox keyword bookmark or search query
// without needing to type :ne first.
//Source: ChatGPT & Me
safeDel("normal", "<leader>N");

glide.keymaps.set("normal", "<leader>N", async () => {
    await glide.commandline.show({
        title: "keyword",
        options: [
            {
                label: "Keyword bookmark",
                description: "Open keyword in a new tab",
                matches: () => true,
                async execute({ input }) {
                    const query = input.trim();
                    if (!query) {
                        return;
                    }

                    await glide.excmds.execute(
                        "tab_new about:blank",
                    );

                    await new Promise(resolve => setTimeout(resolve, 100));

                    await glide.excmds.execute(
                        "mode_change insert",
                    );

                    await glide.keys.send("<C-l>");
                    await glide.keys.send(query);
                    await glide.keys.send("<Enter>");
                },
            },
        ],
    });
}, {
    description: "Open keyword bookmark prompt in a new tab",
});


//4. Hint Tabs, Tab Groups, and the New Tab button with <leader>F
//Source: ChatGPT and Me
glide.keymaps.set("normal", "<leader>F", () => {
    glide.hints.show({
        location: "browser-ui",
        selector: ".tabbrowser-tab, .tab-group-label, #tabs-newtab-button.toolbarbutton-1",
    });
}, {
    description: "Hint tabs, tab groups, and new tab button",
});


//5. Adding more vim motions dw, db, d$, d0, yy, p
//Source: Me

//dw - Cut from the cursor through the next word
//Source: ChatGPT
safeDel("op-pending", "w");

glide.keymaps.set("op-pending", "w", async () => {
    try {
        await glide.keys.send(
            "<Left><C-S-Right><C-x><Right>",
            { skip_mappings: true },
        );
    } finally {
        await glide.excmds.execute(
            "mode_change normal",
        );
    }
}, {
    description: "Cut to next word",
});

//db - Delete backward one word and exit operator-pending mode
safeDel("op-pending", "b");

glide.keymaps.set("op-pending", "b", async () => {
    try {
        await glide.keys.send(
            "<C-S-Left><Backspace>",
            { skip_mappings: true },
        );
    } finally {
        await glide.excmds.execute(
            "mode_change normal",
        );
    }
}, {
    description: "Delete backward one word",
});

//d$ - Delete from cursor to end of line and exit operator-pending mode
safeDel("op-pending", "$");

glide.keymaps.set("op-pending", "$", async () => {
    try {
        await glide.keys.send(
            "<Left><S-End><Backspace>",
            { skip_mappings: true },
        );
    } finally {
        await glide.excmds.execute(
            "mode_change normal",
        );
    }
}, {
    description: "Delete to end of line",
});

//d0 - Delete from cursor to start of line and exit operator-pending mode
safeDel("op-pending", "0");

glide.keymaps.set("op-pending", "0", async () => {
    try {
        await glide.keys.send(
            "<S-Home><Backspace>",
            { skip_mappings: true },
        );
    } finally {
        await glide.excmds.execute(
            "mode_change normal",
        );
    }
}, {
    description: "Delete to start of line",
});

//dG - Delete the current line and everything below it
//Source: ChatGPT
safeDel("op-pending", "<S-g>");

glide.keymaps.set("op-pending", "<S-g>", async () => {
    try {
        await glide.keys.send(
            "<Home><Left><C-S-End><Backspace>",
            { skip_mappings: true },
        );
    } finally {
        await glide.excmds.execute(
            "mode_change normal",
        );
    }
}, {
    description: "Delete current line through end of text",
});

//dd - Cut the current line, then delete the newline
//Source: ChatGPT
safeDel("normal", "dd");
safeDel("op-pending", "d");

glide.keymaps.set("op-pending", "d", async () => {
    try {
        await glide.keys.send(
            "<Home><S-End><C-x><Delete>",
            { skip_mappings: true },
        );
    } finally {
        await glide.excmds.execute(
            "mode_change normal",
        );
    }
}, {
    description: "Cut current line",
});

//yy remapped to copy current line to clipboard in normal mode
safeDel("normal", "yy");

glide.keymaps.set("normal", "yy", async () => {
    await glide.keys.send("<Home>");
    await glide.keys.send("<S-End>");
    await glide.keys.send("<C-c>");
    await glide.keys.send("<Right>");
}, {
    description: "Yank current line",
});

//yG - Copy the current line and everything below it
//Source: ChatGPT
safeDel("normal", "yG");

glide.keymaps.set("normal", "yG", async () => {
    // Select the current line through the end of the text.
    await glide.keys.send(
        "<Home><C-S-End>",
        { skip_mappings: true },
    );

    // Copy the selected text.
    await glide.keys.send(
        "<C-c>",
        { skip_mappings: true },
    );

    // Collapse the selection without leaving the editor.
    await glide.keys.send(
        "<Left>",
        { skip_mappings: true },
    );
}, {
    description: "Yank current line through end of text",
});

//p to paste in normal mode
glide.keymaps.set("normal", "p", async () => {
    await glide.keys.send("<C-v>");
}, {
    description: "Paste from clipboard",
});

//ctrl + r to redo in normal mode
glide.keymaps.set("normal", "<C-r>", async () => {
    await glide.keys.send("<C-S-z>");
}, {
    description: "Redo",
});

//gg and shift + g from Page Home and End to the Bottom and Top of the Text Block
safeDel("normal", "<S-g>");
safeDel("normal", "gg");

glide.keymaps.set("normal", "<S-g>", async () => {
    await glide.keys.send("<C-End>");
}, {
    description: "Move cursor to end of text",
});

glide.keymaps.set("normal", "gg", async () => {
    await glide.keys.send("<C-Home>");
}, {
    description: "Move cursor to start of text",
});

//visual mode - Making Visual Mode better

//a. Make j and k actually select line by line
glide.keymaps.set("visual", "j", async () => {
    await glide.keys.send("<S-Down>");
}, {
    description: "Extend selection down one line",
});
glide.keymaps.set("visual", "k", async () => {
    await glide.keys.send("<S-Up>");
}, {
    description: "Extend selection up one line",
});

//b. Make w and b actually select forwards and backwards one word
glide.keymaps.set("visual", "b", async () => {
    await glide.keys.send("<C-S-Left>");
}, {
    description: "Extend selection backward one word",
});

//c. Make gg and shift + g actually select to the bottom or top in visual mode
glide.keymaps.set("visual", "<S-g>", async () => {
    await glide.keys.send("<C-S-End>");
}, {
    description: "Extend selection to end of text",
});
glide.keymaps.set("visual", "gg", async () => {
    await glide.keys.send("<C-S-Home>");
}, {
    description: "Extend selection to start of text",
});

//d. Make 0 and $ actually go to the beginning and end of the line
glide.keymaps.set("visual", "$", async () => {
    await glide.keys.send("<S-End>");
}, {
    description: "Extend selection to end of line",
});
glide.keymaps.set("visual", "0", async () => {
    await glide.keys.send("<S-Home>");
}, {
    description: "Extend selection to start of line",
});

//e. Make <leader>v turn on caret browsing
glide.keymaps.set("normal", "<leader>v", async () => {
    await glide.keys.send("<F7>");
}, {
    description: "Toggle caret browsing",
});

//f. Visual-mode w: correct the first-character offset, then extend by word.
// The actual browser cursor is effectively positioned to the right of the
// vim style cursor. That puts the cursor between the first and second letter
// of the word when using w in visual mode, so this moves back one character
// at the beggining of the word before extending the selection with Ctrl+Right.
safeDel("visual", "w");
glide.keymaps.set("visual", "w", async ({ tab_id }) => {
    const correction = await getVisualWordCorrection(tab_id);

    // Do not send delayed keys to a different tab or after leaving Visual mode.
    if (
        glide.ctx.mode !== "visual" ||
        (await glide.tabs.active()).id !== tab_id
    ) return;

    await glide.keys.send(`${correction}<C-S-Right>`, {
        skip_mappings: true,
    });
}, {
    description: "Extend selection forward one word",
});


//shift o to insert a line above in normal mode
safeDel("normal", "<S-o>");

glide.keymaps.set("normal", "<S-o>", async () => {
    await glide.excmds.execute("mode_change insert");
    await glide.keys.send("<Home><S-Enter><Up>", {
        skip_mappings: true,
    });
}, {
    description: "Open new line above",
});

// Fix open a new line below the current line.
//
// Glide's built-in `o` can split text at the current caret position
// on some web editors.
//
// Instead:
//   1. Enter Insert mode.
//   2. Move to the end of the current line.
//   3. Send Enter directly to the webpage.
//
// Source: ChatGPT

safeDel("normal", "o");

glide.keymaps.set(
    "normal", "o",
    async () => {
        await glide.excmds.execute(
            "mode_change insert",
        );

        await glide.keys.send(
            "<End><S-Enter>",
            {
                skip_mappings: true,
            },
        );
    },
    {
        description: "Open new line below",
    },
);


//6. Tabs

//A. Set the current tab's wake lock to on (make's so the computer doesn't sleep)
//Source: ChatGPT
glide.keymaps.set("normal", "<leader>1", async ({ tab_id }) => {
    const result = await glide.content.execute(
        async () => {
            const w = window as any;

            if (w.__wakeLock) {
                await w.__wakeLock.release();
                w.__wakeLock = undefined;
                return "released";
            }

            w.__wakeLock =
                await navigator.wakeLock.request("screen");

            return "acquired";
        },
        {
            tab_id,
        },
    );

    console.log(result);
}, {
    description: "Toggle screen wake lock for current tab",
});

//B. tm - Move current tab to a new window
// Source: ChatGPT
glide.keymaps.set("normal", "tm", async ({ tab_id }) => {
    await browser.windows.create({
        tabId: tab_id,
    });
}, {
    description: "Move tab to new window",
});

//C. Tab Unloading: tuu (MRU current), tua (all other tabs), tuf (hint to unload)
// Source: ChatGPT & Me (MRU selection: claude-fable-5.1-max)

// Clean up old two-key mappings so tu becomes a submenu prefix
safeDel("normal", "tu");
safeDel("normal", "tU");

// a. tuu - Unload current tab after switching to the most recently used tab
safeDel("normal", "tuu");

glide.keymaps.set("normal", "tuu", async ({ tab_id }) => {
    const tabs = await browser.tabs.query({
        currentWindow: true,
    });

    const current = tabs.find(tab => tab.id === tab_id);

    if (!current) {
        return;
    }

    // The tab that was active before this one, not the left-most tab.
    const nextTab = mostRecentlyUsedTab(tabs, tab_id);

    if (!nextTab?.id) {
        throw new Error(
            "Cannot unload the only tab in the window.",
        );
    }

    // Switch first, then unload the original.
    await browser.tabs.update(nextTab.id, {
        active: true,
    });

    await glide.tabs.unload(tab_id);
}, {
    description: "Switch to most recently used tab and unload current tab",
});

// b. tua - Unload all tabs except the current one
safeDel("normal", "tua");

glide.keymaps.set("normal", "tua", async ({ tab_id }) => {
    const tabs = await browser.tabs.query({
        currentWindow: true,
    });

    const unloadIds = tabs
        .filter(tab =>
            tab.id !== undefined &&
            tab.id !== tab_id &&
            !tab.discarded
        )
        .map(tab => tab.id!);

    if (unloadIds.length === 0) {
        return;
    }

    await browser.tabs.discard(unloadIds);
}, {
    description: "Unload all tabs except the current one",
});

// c. tuf - Hint all tabs and unload whichever is chosen from the hint
safeDel("normal", "tuf");

glide.keymaps.set("normal", "tuf", ({ tab_id }) => {
    glide.hints.show({
        location: "browser-ui",
        selector: ".tabbrowser-tab, .tab-group-label, #tabs-newtab-button.toolbarbutton-1",
        async action({ content }) {
            const tabInfo = await content.execute((element) => {
                const tab = (element as HTMLElement).closest(".tabbrowser-tab");
                if (!tab) return null;
                const allTabs = Array.from(document.querySelectorAll(".tabbrowser-tab"));
                return {
                    index: allTabs.indexOf(tab),
                };
            });

            if (!tabInfo || tabInfo.index === -1) {
                return;
            }

            const tabs = await browser.tabs.query({
                currentWindow: true,
            });

            const targetTab = tabs[tabInfo.index];
            if (!targetTab?.id) {
                return;
            }

            // If the user selected the currently active tab, switch to the
            // MRU tab first so it can be unloaded without throwing an error.
            if (targetTab.active || targetTab.id === tab_id) {
                const nextTab = mostRecentlyUsedTab(tabs, targetTab.id);
                if (!nextTab?.id) {
                    throw new Error("Cannot unload the only tab in the window.");
                }
                await browser.tabs.update(nextTab.id, { active: true });
            }

            await glide.tabs.unload(targetTab.id);
        },
    });
}, {
    description: "Hint tabs and unload chosen tab",
});

// E. ts — Send current tab to a Firefox Sync device.
// Uses supported Glide APIs and ordinary DOM operations only.

const sendTab = (() => {
    // Picker choices, in display order. Keep these names identical to Firefox.
    // A choice is checked against the live device list before anything is sent.
    const deviceOrder = [
        "iPhone 17 Pro",
        "Miniature Superman",
        "Metro Man",
        "deck’s Firefox on david",
        "Glide Kasm Ubuntu Jammy VPN",
    ];
    const aliases: Record<string, string> = {
        "iPhone 17 Pro": "i",
        "Miniature Superman": "ms",
        "Metro Man": "mm",
        "deck’s Firefox on david": "d",
        "Glide Kasm Ubuntu Jammy VPN": "k",
    };
    const dryRun = false; // true focuses the Send button without clicking it.
    const debug = true;
    const requestAttribute = "data-glide-send-tab-request";
    const runningAttribute = "data-glide-send-tab-running";
    const menuSelector = "#PanelUI-menu-button";
    let busy = false;

    // Reloading this section invalidates an older in-progress request.
    document.querySelector(menuSelector)?.removeAttribute(requestAttribute);
    document.querySelector(menuSelector)?.removeAttribute(runningAttribute);

    const pause = (ms: number) =>
        new Promise<void>(resolve => setTimeout(resolve, ms));
    const menuOpen = () =>
        document.getElementById("appMenu-popup")
            ?.getAttribute("panelopen") === "true";
    const key = (sequence: string) =>
        glide.keys.send(sequence, { skip_mappings: true });

    async function closeMenu(): Promise<void> {
        for (let i = 0; i < 3 && menuOpen(); i++) {
            await key("<Esc>");
            await pause(60);
        }
        if (menuOpen()) throw new Error("Firefox menu did not close.");
    }

    async function openMenu(): Promise<void> {
        // A known starting view prevents reusing an unrelated open submenu.
        await closeMenu();
        glide.hints.show({
            location: "browser-ui",
            selector: menuSelector,
            auto_activate: true,
        });
        const deadline = Date.now() + 2500;
        while (Date.now() < deadline) {
            if (menuOpen()) return;
            await pause(30);
        }
        throw new Error("Hamburger menu did not open.");
    }

    // This callback runs on the REAL browser UI through Glide's hint API.
    // It must be self-contained: it cannot capture variables from glide.ts.
    async function activateDevice(menuButton: HTMLElement) {
        const requestAttribute = "data-glide-send-tab-request";
        const runningAttribute = "data-glide-send-tab-running";
        const raw = menuButton.getAttribute(requestAttribute);
        if (!raw) throw new Error("Send Tab request expired or was cancelled.");

        const request = JSON.parse(raw) as {
            token: string;
            device: string;
            linkedPanel: string;
            expires: number;
            dryRun: boolean;
        };
        if (menuButton.hasAttribute(runningAttribute)) {
            throw new Error("A Send Tab request is already running.");
        }
        menuButton.setAttribute(runningAttribute, request.token);

        const doc = menuButton.ownerDocument;
        const win = doc.defaultView!;
        let cancelled = false;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") cancelled = true;
        };
        doc.addEventListener("keydown", onKey, true);

        const pause = (ms: number) =>
            new Promise<void>(resolve => setTimeout(resolve, ms));
        const guard = () => {
            if (
                cancelled ||
                menuButton.getAttribute(requestAttribute) !== raw ||
                Date.now() >= request.expires
            ) throw new Error("Send Tab cancelled or timed out.");

            const selected = doc.querySelector(
                '.tabbrowser-tab[selected]:not([selected="false"])',
            );
            if (
                !request.linkedPanel ||
                selected?.getAttribute("linkedpanel") !== request.linkedPanel
            ) throw new Error("Active tab changed. Send cancelled.");

            // Firefox's Send Current Page button sends ALL selected tabs
            // when the selected tab is part of a multi-selection.
            if (doc.querySelectorAll(
                '.tabbrowser-tab[multiselected]:not([multiselected="false"])',
            ).length > 1) {
                throw new Error("Multiple tabs are selected. Select just one tab first.");
            }
            if (doc.getElementById("appMenu-popup")
                ?.getAttribute("panelopen") !== "true") {
                throw new Error("Firefox menu was closed. Send cancelled.");
            }
        };

        const available = (element: Element | null): element is HTMLElement => {
            if (!element?.isConnected) return false;
            const style = win.getComputedStyle(element);
            return style.display !== "none" &&
                style.visibility === "visible" &&
                element.getClientRects().length > 0 &&
                !element.matches('[disabled="true"], [disabled=""], [aria-disabled="true"]');
        };

        async function waitFor<T>(read: () => T | null, message: string): Promise<T> {
            while (Date.now() < request.expires) {
                guard();
                const result = read();
                if (result !== null) return result;
                await pause(40);
            }
            throw new Error(message);
        }

        try {
            guard();
            const accountStatus = doc.documentElement.getAttribute("fxastatus");
            if (accountStatus && accountStatus !== "signedin") {
                throw new Error("Firefox Sync is not signed in and ready. Check your Mozilla account.");
            }
            const account = await waitFor(() => {
                for (const id of ["appMenu-fxa-label2", "appMenu-nova-fxa-label"]) {
                    const element = doc.getElementById(id);
                    if (available(element)) return element;
                }
                return null;
            }, "Mozilla account menu entry was not available.");
            account.click();

            await waitFor(() => {
                const view = doc.getElementById("PanelUI-fxa");
                const popup = doc.getElementById("appMenu-popup");
                return view?.getAttribute("visible") === "true" &&
                    popup?.contains(view) &&
                    !view.closest("panelmultiview")?.hasAttribute("transitioning")
                    ? view : null;
            }, "Mozilla account panel did not open. Check that Sync is signed in.");

            const getTarget = (): HTMLElement | null => {
                const list = doc.getElementById("PanelUI-fxa-menu-devices-list");
                if (!list || !available(list)) return null;
                const headers = [...list.querySelectorAll(
                    ".PanelUI-fxa-menu-device-header",
                )].filter(header => header.textContent?.trim() === request.device);

                if (headers.length > 1) {
                    throw new Error(`More than one device is named "${request.device}". Give them unique names in Firefox.`);
                }
                if (headers.length !== 1) return null;

                for (
                    let node = headers[0].nextElementSibling;
                    node && !node.classList.contains("PanelUI-fxa-menu-device-header");
                    node = node.nextElementSibling
                ) {
                    if (
                        node.matches('[data-l10n-id="fxa-menu-device-send-current-page"]') &&
                        available(node)
                    ) return node;
                }
                return null;
            };

            // Read current state; do not require an arbitrary number of mutations.
            // Only replacing the selected button resets this short settling period.
            let candidate: HTMLElement | null = null;
            let stableSince = 0;
            const target = await waitFor(() => {
                const current = getTarget();
                if (current !== candidate) {
                    candidate = current;
                    stableSince = Date.now();
                }
                return current && Date.now() - stableSince >= 180 ? current : null;
            }, `No ready Send button for "${request.device}". Check Firefox's device list and the current page's URL.`);

            guard();
            if (getTarget() !== target || !target.isConnected) {
                throw new Error("Device list changed at activation. Nothing was sent; try ts again.");
            }

            // Consume the request synchronously. Never automatically retry a send.
            menuButton.removeAttribute(requestAttribute);
            if (request.dryRun) {
                target.scrollIntoView({ block: "center" });
                target.focus();
                return { device: request.device, status: "dry-run" };
            }
            target.click();
            return { device: request.device, status: "activated" };
        } finally {
            doc.removeEventListener("keydown", onKey, true);
            if (menuButton.getAttribute(runningAttribute) === request.token) {
                menuButton.removeAttribute(runningAttribute);
            }
        }
    }

    async function send(device: string, origin: { id: number; url?: string }) {
        if (busy) return;
        busy = true;
        const started = Date.now();
        let button: Element | null = null;
        let raw = "";
        let finished = false;
        let ownedMenu = false;

        const sameTab = async () => {
            const current = await glide.tabs.active();
            if (current.id !== origin.id || current.url !== origin.url) {
                throw new Error("The selected tab or its URL changed. Reopen ts.");
            }
        };

        try {
            await glide.commandline.close();
            await sameTab();
            await openMenu();
            ownedMenu = true;
            await sameTab();

            button = document.querySelector(menuSelector);
            const linkedPanel = document.querySelector(
                '.tabbrowser-tab[selected]:not([selected="false"])',
            )?.getAttribute("linkedpanel");
            if (!button || !linkedPanel) {
                throw new Error("Could not identify the active browser tab.");
            }

            const token = crypto.randomUUID();
            raw = JSON.stringify({
                token, device, linkedPanel, dryRun,
                expires: Date.now() + 10_000,
            });
            button.setAttribute(requestAttribute, raw);
            // Allow Glide to mirror the request attribute to the browser UI.
            await pause(0);

            const result = await new Promise<{ device: string; status: string }>((resolve, reject) => {
                let done = false;
                const timer = setTimeout(() => {
                    if (done) return;
                    done = true;
                    if (button?.getAttribute(requestAttribute) === raw) {
                        button.removeAttribute(requestAttribute);
                    }
                    reject(new Error("Send Tab timed out. No automatic retry was made."));
                }, 11_000);

                try {
                    glide.hints.show({
                        location: "browser-ui",
                        selector: menuSelector,
                        auto_activate: true,
                        async action({ content }) {
                            try {
                                if (done) return;
                                await sameTab();
                                const result = await content.execute(activateDevice);
                                if (!done) {
                                    done = true;
                                    clearTimeout(timer);
                                    resolve(result);
                                }
                            } catch (error) {
                                if (!done) {
                                    done = true;
                                    clearTimeout(timer);
                                    reject(error);
                                }
                            }
                        },
                    });
                } catch (error) {
                    done = true;
                    clearTimeout(timer);
                    reject(error);
                }
            });

            finished = true;
            if (debug) console.log("[SendTab]", {
                ...result, elapsedMs: Date.now() - started,
            });
            // "activated" means Firefox's Send command was invoked.
            // Firefox handles delivery and its own confirmation.
        } catch (error) {
            console.error("[SendTab]", error);
            // Give the hint action time to finish its mode cleanup before
            // opening the error message in Glide's command line.
            await pause(0);
            throw error;
        } finally {
            try {
                if (button?.getAttribute(requestAttribute) === raw) {
                    button.removeAttribute(requestAttribute);
                }
                if (!finished && ownedMenu && (await glide.tabs.active()).id === origin.id) {
                    await closeMenu().catch(() => {});
                }
            } finally {
                busy = false;
            }
        }
    }

    async function showPicker(tab_id: number) {
        if (busy) return;
        const origin = await glide.tabs.active();
        if (origin.id !== tab_id) return;

        // Configured names make the picker immediate, including after startup.
        // Include additional device names if Firefox has already rendered them.
        const discovered = [...document.querySelectorAll(
            "#PanelUI-fxa-menu-devices-list .PanelUI-fxa-menu-device-header",
        )].map(element => element.textContent?.trim()).filter((name): name is string => !!name);
        const names = [...new Set([...deviceOrder, ...discovered])];
        const choices = names.map((name, index) => ({
            name, alias: aliases[name] ?? String(index + 1),
        }));

        await glide.commandline.show({
            title: "Send current tab to device",
            options: choices.map(choice => ({
                label: `${choice.alias} — ${choice.name}`,
                description: "Verify in Firefox and send current tab",
                matches({ input }) {
                    const query = input.trim().toLowerCase();
                    if (!query) return true;
                    if (choices.some(item => item.alias.toLowerCase() === query)) {
                        return choice.alias.toLowerCase() === query;
                    }
                    return choice.alias.toLowerCase().startsWith(query) ||
                        choice.name.toLowerCase().includes(query);
                },
                execute() {
                    void send(choice.name, origin).catch(async error => {
                        await glide.commandline.show({
                            title: "Send Tab stopped",
                            options: [{
                                label: error instanceof Error ? error.message : String(error),
                                description: "Press Escape to close. Details: [SendTab] in the Browser Console.",
                                execute() { void glide.commandline.close(); },
                            }],
                        });
                    });
                },
            })),
        });
    }

    return { showPicker };
})();

safeDel("normal", "ts");
glide.keymaps.set("normal", "ts", async ({ tab_id }) => {
    await sendTab.showPicker(tab_id);
}, {
    description: "Send current tab to Firefox Sync device",
});

// F. tcc — Clear cookies and site data for the current site in Firefox's
// native trust panel. Click named UI controls through Glide's browser UI hint.
const clearCurrentSiteData = (() => {
    const selector = "#trust-icon-container";
    const requestAttribute = "data-glide-clear-site-request";
    const runningAttribute = "data-glide-clear-site-running";
    let busy = false;

    // Invalidate a request left behind by a config reload.
    document.querySelector(selector)?.removeAttribute(requestAttribute);
    document.querySelector(selector)?.removeAttribute(runningAttribute);

    // Runs in the real browser UI and must not capture variables from glide.ts.
    async function activate(icon: HTMLElement): Promise<"cleared"> {
        const requestAttribute = "data-glide-clear-site-request";
        const runningAttribute = "data-glide-clear-site-running";
        const raw = icon.getAttribute(requestAttribute);
        if (!raw) throw new Error("tcc request expired or was cancelled.");
        const request = JSON.parse(raw) as {
            token: string;
            linkedPanel: string;
            expires: number;
        };
        if (icon.hasAttribute(runningAttribute)) {
            throw new Error("A tcc request is already running.");
        }
        icon.setAttribute(runningAttribute, request.token);

        const doc = icon.ownerDocument;
        const win = doc.defaultView!;
        let cancelled = false;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") cancelled = true;
        };
        doc.addEventListener("keydown", onKey, true);

        const panelIsOpen = (panel: Element | null) =>
            !!panel && (
                (panel as Element & { state?: string }).state === "open" ||
                panel.getAttribute("state") === "open" ||
                panel.getAttribute("panelopen") === "true"
            );
        const guard = (panel?: Element) => {
            if (cancelled || icon.getAttribute(requestAttribute) !== raw ||
                Date.now() >= request.expires) {
                throw new Error("tcc cancelled or timed out. Nothing was cleared.");
            }
            const selected = doc.querySelector(
                '.tabbrowser-tab[selected]:not([selected="false"])',
            );
            if (selected?.getAttribute("linkedpanel") !== request.linkedPanel) {
                throw new Error("Active tab changed. Nothing was cleared.");
            }
            if (panel && !panelIsOpen(panel)) {
                throw new Error("Trust panel closed. Nothing was cleared.");
            }
        };
        const visible = (element: Element | null): element is HTMLElement => {
            if (!element?.isConnected) return false;
            const css = win.getComputedStyle(element);
            return css.display !== "none" && css.visibility === "visible" &&
                element.getClientRects().length > 0;
        };
        const disabled = (element: HTMLElement) =>
            element.matches('[disabled]:not([disabled="false"]), [aria-disabled="true"]');
        const pause = (ms: number) =>
            new Promise<void>(resolve => setTimeout(resolve, ms));
        async function waitFor<T>(
            read: () => T | null, message: string, panel?: Element,
        ): Promise<T> {
            while (Date.now() < request.expires) {
                // Opening the trust panel can await Firefox's UI update. Do not
                // require it to be open on the very first polling pass.
                guard(panel);
                const value = read();
                if (value !== null) return value;
                await pause(35);
            }
            throw new Error(message);
        }

        try {
            guard();
            if (icon.id !== "trust-icon-container") {
                throw new Error("Unexpected browser UI target. Nothing was cleared.");
            }
            icon.click();
            const popup = await waitFor(() => {
                const panel = doc.getElementById("trustpanel-popup");
                return panelIsOpen(panel) ? panel : null;
            }, "Trust panel did not open.");

            const clear = await waitFor(() => {
                const button = doc.getElementById("trustpanel-clear-cookies-button");
                return button && popup.contains(button) && visible(button)
                    ? button : null;
            }, "Clear cookies and site data was not available.", popup);
            guard(popup);
            if (disabled(clear)) throw new Error("No site data available to clear.");
            // This is a XUL toolbarbutton. Firefox opens its subview from
            // `command`, so invoke that native command directly.
            const command = clear as HTMLElement & { doCommand?: () => void };
            if (typeof command.doCommand === "function") command.doCommand();
            else clear.click();

            const confirm = await waitFor(() => {
                const view = doc.getElementById("trustpanel-clearcookiesView");
                const button = doc.getElementById("trustpanel-clear-cookie-clear");
                const switching = view?.closest("panelmultiview")?.hasAttribute("transitioning");
                return view?.getAttribute("visible") === "true" &&
                    popup.contains(view) && !switching &&
                    button && view.contains(button) && visible(button)
                    ? button : null;
            }, "Clear site data confirmation did not become ready.", popup);

            guard(popup);
            if (!confirm.isConnected || disabled(confirm) || !visible(confirm)) {
                throw new Error("Clear confirmation changed. Nothing was cleared.");
            }
            // Consume before the irreversible click: never automatically retry.
            icon.removeAttribute(requestAttribute);
            confirm.click();
            return "cleared";
        } finally {
            doc.removeEventListener("keydown", onKey, true);
            if (icon.getAttribute(runningAttribute) === request.token) {
                icon.removeAttribute(runningAttribute);
            }
        }
    }

    async function run(tabId: number): Promise<void> {
        if (busy) return;
        const origin = await glide.tabs.active();
        busy = true;
        let icon: Element | null = null;
        let raw = "";
        let cleared = false;
        const pause = (ms: number) =>
            new Promise<void>(resolve => setTimeout(resolve, ms));
        const panelOpen = () => {
            const panel = document.getElementById("trustpanel-popup") as
                (Element & { state?: string }) | null;
            return panel?.state === "open" || panel?.state === "showing" ||
                panel?.getAttribute("state") === "open" ||
                panel?.getAttribute("state") === "showing" ||
                panel?.getAttribute("panelopen") === "true" ||
                document.getElementById("trust-icon-container")?.hasAttribute("open") ||
                document.getElementById("identity-icon-box")?.hasAttribute("open") || false;
        };

        try {
            if (origin.id !== tabId) return;
            if (panelOpen()) {
                await glide.keys.send("<Esc>", { skip_mappings: true });
                for (let i = 0; i < 20 && panelOpen(); i++) await pause(35);
                if (panelOpen()) throw new Error("Trust panel did not close before tcc.");
            }
            const linkedPanel = document.querySelector(
                '.tabbrowser-tab[selected]:not([selected="false"])',
            )?.getAttribute("linkedpanel");
            icon = document.querySelector(selector);
            if (!icon || !linkedPanel) throw new Error("Could not identify the active tab.");
            const token = crypto.randomUUID();
            raw = JSON.stringify({ token, linkedPanel, expires: Date.now() + 8000 });
            icon.setAttribute(requestAttribute, raw);
            await pause(0); // Let Glide mirror the request onto the actual browser UI.

            await new Promise<"cleared">((resolve, reject) => {
                let done = false;
                const timer = setTimeout(() => {
                    if (done) return;
                    done = true;
                    reject(new Error("tcc timed out. Check whether the confirmation is still open."));
                }, 9000);
                try {
                    glide.hints.show({
                        location: "browser-ui",
                        selector,
                        auto_activate: true,
                        async action({ content }) {
                            try {
                                if (done) return;
                                const current = await glide.tabs.active();
                                if (current.id !== origin.id || current.url !== origin.url) {
                                    throw new Error("Tab or URL changed. Nothing was cleared.");
                                }
                                const value = await content.execute(activate);
                                if (!done) {
                                    done = true;
                                    clearTimeout(timer);
                                    resolve(value);
                                }
                            } catch (error) {
                                if (!done) {
                                    done = true;
                                    clearTimeout(timer);
                                    reject(error);
                                }
                            }
                        },
                    });
                } catch (error) {
                    done = true;
                    clearTimeout(timer);
                    reject(error);
                }
            });
            cleared = true;

            // Confirmation was clicked. Reload as soon as Firefox dismisses
            // the panel, without an additional fixed delay.
            for (let i = 0; i < 125 && panelOpen(); i++) await pause(16);
            if (panelOpen()) {
                console.warn("[tcc] Clear was activated, but the panel stayed open. Reload manually if needed.");
                return;
            }
            const current = await glide.tabs.active();
            if (current.id === origin.id && current.url === origin.url) {
                await browser.tabs.reload(origin.id);
            }
            console.log("[tcc] Firefox's native Clear action activated.");
        } catch (error) {
            console.error("[tcc]", error);
            throw error;
        } finally {
            if (icon?.getAttribute(requestAttribute) === raw) {
                icon.removeAttribute(requestAttribute);
            }
            if (!cleared && panelOpen() &&
                (await glide.tabs.active().catch(() => null))?.id === origin.id) {
                await glide.keys.send("<Esc>", { skip_mappings: true }).catch(() => {});
            }
            busy = false;
        }
    }
    return { run };
})();

safeDel("normal", "tcc");
glide.keymaps.set("normal", "tcc", async ({ tab_id }) => {
    await clearCurrentSiteData.run(tab_id);
}, {
    description: "Clear current website cookies and site data",
});

//G. tb - Move current tab to bottom of tab list
//Source: ChatGPT

safeDel("normal", "tb");

glide.keymaps.set("normal", "tb", async ({ tab_id }) => {
    await browser.tabs.move(tab_id, { index: -1 });
}, {
    description: "Move current tab to bottom",
});

// th — Put keyboard focus on the selected tab in Firefox's tab strip.
// The config document is a mirror, so focus the real browser UI through a
// hint action. Hint a visible toolbar button rather than the tab itself:
// the selected tab may have scrolled outside the visible sidebar.
safeDel("normal", "th");
glide.keymaps.set("normal", "th", () => {
    glide.hints.show({
        location: "browser-ui",
        selector: "#PanelUI-menu-button",
        auto_activate: true,
        async action({ content }) {
            await content.execute((anchor) => {
                const tab = anchor.ownerDocument.querySelector<HTMLElement>(
                    '.tabbrowser-tab[selected]:not([selected="false"])',
                );
                if (!tab) throw new Error("No selected Firefox tab found.");
                tab.focus();
            });
        },
    });
}, {
    description: "Focus current tab in the tab sidebar",
});


//7. Search in a text field containing someone's first and last name for there full name, just their first and just their last
//Source: Me
glide.keymaps.set("normal", "<S-n>", async () => {
    const delay = 3000;

    await glide.excmds.execute("mode_change insert");

    await glide.keys.send("<C-a>");
    await glide.keys.send("<C-c>");
    await glide.keys.send("<Right>");


    await glide.keys.send("<Enter>");
    await new Promise(resolve => setTimeout(resolve, delay));

    await glide.keys.send("<C-Backspace>");
    await glide.keys.send("<Backspace>");
    await glide.keys.send("<Enter>");
    await new Promise(resolve => setTimeout(resolve, delay));

    await glide.keys.send("<C-Backspace>");
    await glide.keys.send("<C-v>");
    await glide.keys.send("<C-Left>");
    await glide.keys.send("<C-Backspace>");
    await glide.keys.send("<Enter>");
    await new Promise(resolve => setTimeout(resolve, delay));

    await glide.keys.send("<C-a>");
    await glide.keys.send("<C-v>");
    await glide.keys.send("<Enter>");
}, {
    description: "Search full, first, and last name sequentially",
});


//8. Show hints only for Outlook Safe Links and copy the decoded URL with ys in normal mode.
glide.keymaps.set("normal", "ys", () => {
    glide.hints.show({
        selector: "a[href]",

        async pick({ hints, content }) {
            const elements = await content.map((element) => {
                const anchor = element as HTMLAnchorElement;
                const style = getComputedStyle(anchor);
                const rect = anchor.getBoundingClientRect();

                return {
                    href: anchor.href,
                    visible:
                        style.display !== "none" &&
                        style.visibility !== "hidden" &&
                        style.opacity !== "0" &&
                        rect.width > 0 &&
                        rect.height > 0,
                };
            });

            return hints.filter((_, index) => {
                const element = elements[index];

                return (
                    element?.visible === true &&
                    decodeSafeLinksURL(element.href) !== null
                );
            });
        },

        async action({ content }) {
            const href = await content.execute(
                (element) => (element as HTMLAnchorElement).href,
            );

            const decoded = decodeSafeLinksURL(href);

            if (decoded) {
                await navigator.clipboard.writeText(decoded);
            }
        },
    });
}, {
    description: "Hint yankable decoded Safelinks",
});


//9. Open the copied url in virustotal.com
//Source: ChatGPT (hardening: Me (claude-fable-5.1-max))
safeDel("normal", "1u");

glide.keymaps.set("normal", "1u", async () => {
    const url = await readClipboardURL();

    // Open VirusTotal. The URL is a query *parameter*, so it has to be
    // encoded - otherwise any ?, & or # in it breaks the search.
    await browser.tabs.create({
        url: `https://www.virustotal.com/gui/search?query=${encodeURIComponent(url)}`,
    });
}, {
    description: "Scan clipboard URL with VirusTotal",
});


//10. Open clipboard contents in a new tab
//Source: ChatGPT (hardening: Me (claude-fable-5.1-max))
safeDel("normal", "1o");

glide.keymaps.set("normal", "1o", async () => {
    const url = await readClipboardURL();

    await browser.tabs.create({
        url,
    });
}, {
    description: "Open clipboard URL in a new tab",
});



//General Keybind Mapping/Re-mapping

//Re-map Alt h and l to leader h and leader l
//Source: pretty much the official docs, since I gave them to ChatGPT and it just replaced what I wanted with what they had as an example
//1. Remove old Alt h and l mappings
safeDel("normal", "<A-h>");
safeDel("normal", "<A-l>");
//2. Add new leader h and l mappings
glide.keymaps.set("normal", "<leader>h", "back", {
    description: "Go back in history",
});
glide.keymaps.set("normal", "<leader>l", "forward", {
    description: "Go forward in history",
});

//Re-map <C-o> and <C-i> to <leader>o and <leader>i
//Source: Me qc
//1. Remove og <C-o> and <C-i> mapping
safeDel("normal", "<C-o>");
safeDel("normal", "<C-i>");
//2. Add new <leader>o mapping
glide.keymaps.set("normal", "<leader>o", "jumplist_back", {
    description: "Jump back in jumplist",
});
glide.keymaps.set("normal", "<leader>i", "jumplist_forward", {
    description: "Jump forward in jumplist",
});

//Make so just + and - by themselves adjust zoom level in normal mode
//Source: Me
//1. Set = and - to Ctrl + and Ctrl Shift _ in normal mode
//Note: It apears that "-" cannot be used in <C-->, and there is not an alias listed in the docs that I could see. (<C-"-"> also does not work)
glide.keymaps.set("normal", "=", async () => {
    await glide.keys.send("<C-=>");
}, {
    description: "Zoom in",
});

glide.keymaps.set("normal", "-", async () => {
    await glide.keys.send("<C-S-_>");
}, {
    description: "Zoom out",
});

//Map yl to yank the current tab URL to clipboard
//Source: Me
glide.keymaps.set("normal", "yl", "url_yank", {
    description: "Yank current tab URL",
});

//Map <leader> + p in normal mode to toggle pin tab
//Source: Me
safeDel("normal", "<A-p>");
glide.keymaps.set("normal", "<leader>p", "tab_pin_toggle", {
    description: "Toggle pin on current tab",
});

//Map Leader s to Shift F10 to open the browser context/autocorrect spelling menu
//Note: Only works on my Keycron C3 Pro, where I have F3 mapped to the macro Shift + F10, since <S-F10> doesn't work in glide for some reason
//Note to the Note: When the Glide is sent F3 from glide.keys.send, it doesn't count the Keycrons keybindings, since the physical keyboard isn't actually whats sending the keys qd.
//So just use F3 from the keyboard for now
//Source: Me and ChatGPT (To find the keybind)
//    glide.keymaps.set("normal", "<leader>s", async () => {
//      await glide.keys.send("<Apps>");
//    });

//Map u in normal mode to Ctrl + z
safeDel("normal", "u");
glide.keymaps.set("normal", "u", async () => {
    await glide.keys.send("<C-z>");
}, {
    description: "Undo",
});

//Map leader + n to new tab
//Source: Me
glide.keymaps.set("normal", "<leader>n", "tab_new", {
    description: "Open a new tab",
});

//Map leader + c to reload config
//Source: Me
glide.keymaps.set("normal", "<leader>c", "config_reload", {
    description: "Reload Glide config",
});

//Map leader + C to edit config
//Source: Me
glide.keymaps.set("normal", "<leader>C", "config_edit", {
    description: "Edit Glide config",
});

// Ctrl+L focuses Firefox's URL bar and enters Glide insert mode.
// Make's sure insert mode is entered when the url bar is focused with C-l
safeDel("normal", "<C-l>");
glide.keymaps.set("normal", "<C-l>", async () => {
    await glide.keys.send("<C-l>", { skip_mappings: true });
    await glide.excmds.execute("mode_change insert");
}, {
    description: "Focus URL bar in Insert mode",
});



//Per Website Settings

//1. Websites to Ignore
//
// NOTE: the mode change for these now lives inside the Insert-Preferred
// UrlEnter handler below, which is the single owner of site-default modes.
//
// The old standalone autocmd here had two problems:
//   1. Its regex was unanchored, so ANY url merely *containing* one of these
//      strings (a search query, a Tailscale machine list...) switched the
//      whole window into ignore mode.
//   2. It relied on a cleanup function to restore normal mode. Glide only
//      registers an autocmd cleanup after the callback resolves and runs it
//      at the start of the *next* UrlEnter, so two quick URL changes could
//      attach the cleanup to the wrong buffer, leaving the window stuck in
//      ignore mode - and ignore mode is deliberately sticky (it survives tab
//      switches and focus changes) until <S-Esc> or a config reload.
const ignoreSites: string[] = [
    "10.0.1.108",
    "100.124.253.95",
    "vim-editor-online.vercel.app",
    "console.tailscale.com/admin/machines/ssh-reauth-complete"
];


//2. Websites to make Insert the default on
const insertSites: string[] = [
    "app.super-productivity.com",
    "youtube.com",
];


//──────────────────────────────────────────────────────────────
// Insert-Preferred Sites
//──────────────────────────────────────────────────────────────
//
// Websites where Insert is the preferred/default Glide mode.
//
// Behavior:
//
//     Enter site
//         → Insert
//
//     Insert → Esc
//         → Temporary Normal
//
//     Persistent Normal commands
//         → Persistent Normal
//
//     Other completed commands from Temporary Normal
//         → Insert
//
//     Persistent Normal
//         → remains Normal until Insert is entered again
//
//     Insert → Normal because of page focus/click/etc.
//         → immediately return to Insert
//
//     Temporary Normal → f → select hint
//         → Insert
//
//     Temporary Normal → f → Esc
//         → return to previous Normal state
//
// There is intentionally NO Esc Esc → Persistent Normal feature.
//
// Super Productivity-specific Enter/Esc behavior belongs in its
// own Custom Site section.
//──────────────────────────────────────────────────────────────


// These commands intentionally make Normal mode persistent.
const persistentNormalCommands = new Set([
    "b",
    "w",
    "h",
    "j",
    "k",
    "l",
    "e",
    "=",
    "-",
    "u",
]);


// These enter another Glide mode.
// Do not treat them as ordinary completed Normal commands.
const transientNormalCommands = new Set([
    "f",
    "/",
    "?",
    ":",
]);


type InsertPreferredState =
    | "insert"
    | "temporary-normal"
    | "persistent-normal";


let insertPreferredSite = false;

let insertPreferredState: InsertPreferredState =
    "insert";


// True only when WE intentionally asked Glide to leave Insert
// because the user pressed Escape.
//
// This lets ModeChanged distinguish:
//
//     intentional Esc
//
// from:
//
//     page focus/click/etc. causing Insert → Normal
//
let pendingInsertEscape = false;


// Remember which Normal state existed underneath a transient
// mode such as hints, search, or command line.
let transientReturnState:
    | "temporary-normal"
    | "persistent-normal"
    | null = null;


// Used to distinguish:
//
//     f → Esc
//
// from:
//
//     f → select hint
//
let hintEscapePressed = false;


// True only while the mode owner below has put the window into ignore mode
// for a matching ignore site. A *manual* <S-Esc> ignore leaves this false,
// so it is never undone by a tab switch (ignore is sticky by design).
let appliedIgnoreMode = false;


//──────────────────────────────────────────────────────────────
// URL helpers
//──────────────────────────────────────────────────────────────

function insertPreferredHostnameMatches(
    url: string,
): boolean {
    try {
        const hostname =
            new URL(url).hostname.toLowerCase();

        return insertSites.some((site) => {
            const host = site
                .replace(/^https?:\/\//, "")
                .replace(/\/.*$/, "")
                .toLowerCase();

            return (
                hostname === host ||
                hostname.endsWith(`.${host}`)
            );
        });
    } catch {
        return false;
    }
}


// Match either a hostname (including subdomains) or a hostname + path prefix.
// Examples:
//     10.0.1.108
//     console.tailscale.com/admin/machines/ssh-reauth-complete
//
// Anchored on the hostname, unlike the old `url.includes(site)`, so a URL
// that merely *mentions* one of these strings no longer matches.
function siteEntryMatches(
    urlString: string,
    entry: string,
): boolean {
    try {
        const url = new URL(urlString);
        const normalizedEntry = entry
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "")
            .toLowerCase();

        const slashIndex = normalizedEntry.indexOf("/");
        const entryHost =
            slashIndex === -1
                ? normalizedEntry
                : normalizedEntry.slice(0, slashIndex);
        const entryPath =
            slashIndex === -1
                ? ""
                : `/${normalizedEntry.slice(slashIndex + 1)}`;

        const hostname = url.hostname.toLowerCase();
        const hostMatches =
            hostname === entryHost ||
            hostname.endsWith(`.${entryHost}`);

        if (!hostMatches) {
            return false;
        }

        if (!entryPath) {
            return true;
        }

        return (
            url.pathname === entryPath ||
            url.pathname.startsWith(`${entryPath}/`)
        );
    } catch {
        return false;
    }
}


function ignoredSiteMatches(
    url: string,
): boolean {
    return ignoreSites.some((site) =>
        siteEntryMatches(url, site)
    );
}


//──────────────────────────────────────────────────────────────
// Intentional Insert → Temporary Normal
//──────────────────────────────────────────────────────────────
//
// Anything that intentionally wants Escape to leave Insert
// should call this helper.
//
// Super Productivity's site-specific Esc mapping also calls this
// for its ordinary Escape path.
//──────────────────────────────────────────────────────────────

async function insertPreferredEscape(): Promise<void> {
    if (insertPreferredSite) {
        pendingInsertEscape = true;
    }

    await glide.excmds.execute(
        "mode_change normal",
    );
}


// Ordinary Insert-mode Escape.
//
// Super Productivity overrides this with its buffer-local mapping
// on that site.
glide.keymaps.set(
    "insert",
    "<Esc>",
    async () => {
        await insertPreferredEscape();
    },
    {
        description: "Exit Insert mode to Normal mode",
    },
);


//──────────────────────────────────────────────────────────────
// URL changes - the single owner of site-default modes
//──────────────────────────────────────────────────────────────
//
// UrlEnter also fires when switching tabs, so this one handler is
// enough: it applies ignore/insert for matching sites and - crucially -
// undoes its OWN previous mode when you leave such a site. No cleanup
// functions, so there is no late-cleanup race to leave the window stuck.
//
// The pattern is /./ (not ^https?) so that leaving an insert/ignore site
// for e.g. about:newtab still restores normal mode.
//──────────────────────────────────────────────────────────────

glide.autocmds.create(
    "UrlEnter",
    /./,
    async ({ url }) => {
        const wasInsertPreferredSite = insertPreferredSite;

        pendingInsertEscape = false;
        transientReturnState = null;
        hintEscapePressed = false;
        insertPreferredState = "insert";

        // Ignore sites always take priority.
        if (ignoredSiteMatches(url)) {
            insertPreferredSite = false;
            appliedIgnoreMode = true;

            if (glide.ctx.mode !== "ignore") {
                await glide.excmds.execute(
                    "mode_change ignore",
                );
            }

            return;
        }

        // Leaving an ignore site WE switched into ignore mode:
        // restore normal. A manual <S-Esc> ignore has
        // appliedIgnoreMode === false and is deliberately left
        // alone - Glide keeps ignore sticky on purpose.
        if (appliedIgnoreMode) {
            appliedIgnoreMode = false;

            if (glide.ctx.mode === "ignore") {
                await glide.excmds.execute(
                    "mode_change normal",
                );
            }
        }

        insertPreferredSite =
            insertPreferredHostnameMatches(url);

        if (!insertPreferredSite) {
            // Leaving an Insert-Preferred site. Nothing else restores
            // Normal any more (the old cleanup autocmd is gone), so
            // same-tab navigation away from e.g. YouTube would otherwise
            // leave the window in Insert forever - which makes 1u / j / f
            // all silently dead on the new page.
            if (
                wasInsertPreferredSite &&
                glide.ctx.mode === "insert"
            ) {
                await glide.excmds.execute(
                    "mode_change normal",
                );
            }

            return;
        }

        await glide.excmds.execute(
            "mode_change insert",
        );
    },
);


//──────────────────────────────────────────────────────────────
// Mode changes
//──────────────────────────────────────────────────────────────

glide.autocmds.create(
    "ModeChanged",
    "*",
    async ({
        old_mode,
        new_mode,
    }) => {
        if (
            !insertPreferredSite ||
            old_mode === new_mode
        ) {
            return;
        }

        //──────────────────────────────────────────────────────
        // Insert → Normal
        //──────────────────────────────────────────────────────
        //
        // Intentional Esc:
        //     allow Temporary Normal.
        //
        // Anything else:
        //     Insert is preferred, so restore Insert.
        //──────────────────────────────────────────────────────

        if (
            old_mode === "insert" &&
            new_mode === "normal"
        ) {
            if (pendingInsertEscape) {
                pendingInsertEscape = false;

                insertPreferredState =
                    "temporary-normal";

                transientReturnState = null;
                hintEscapePressed = false;

                return;
            }

            // Focus/click/etc. knocked Glide out of Insert.
            // Insert is preferred, so restore it.
            insertPreferredState = "insert";

            await glide.excmds.execute(
                "mode_change insert",
            );

            return;
        }

        //──────────────────────────────────────────────────────
        // Normal → Insert
        //──────────────────────────────────────────────────────
        //
        // Actually entering Insert ends Persistent Normal.
        //──────────────────────────────────────────────────────

        if (
            old_mode === "normal" &&
            new_mode === "insert"
        ) {
            pendingInsertEscape = false;
            transientReturnState = null;
            hintEscapePressed = false;

            insertPreferredState = "insert";

            return;
        }

        //──────────────────────────────────────────────────────
        // Normal → Hint
        //──────────────────────────────────────────────────────

        if (
            old_mode === "normal" &&
            new_mode === "hint"
        ) {
            hintEscapePressed = false;

            transientReturnState =
                insertPreferredState ===
                    "persistent-normal"
                    ? "persistent-normal"
                    : "temporary-normal";

            return;
        }

        //──────────────────────────────────────────────────────
        // Hint → Normal
        //──────────────────────────────────────────────────────
        //
        // Hint cancelled:
        //     restore the Normal state underneath hints.
        //
        // Hint selected:
        //     action is complete → Insert.
        //──────────────────────────────────────────────────────

        if (
            old_mode === "hint" &&
            new_mode === "normal"
        ) {
            if (hintEscapePressed) {
                insertPreferredState =
                    transientReturnState ??
                    "temporary-normal";

                hintEscapePressed = false;
                transientReturnState = null;

                return;
            }

            hintEscapePressed = false;
            transientReturnState = null;

            insertPreferredState = "insert";

            await glide.excmds.execute(
                "mode_change insert",
            );

            return;
        }

        //──────────────────────────────────────────────────────
        // Normal → another transient mode
        //──────────────────────────────────────────────────────
        //
        // Examples:
        //
        //     /
        //     ?
        //     :
        //──────────────────────────────────────────────────────

        if (
            old_mode === "normal" &&
            new_mode !== "normal"
        ) {
            transientReturnState =
                insertPreferredState ===
                    "persistent-normal"
                    ? "persistent-normal"
                    : "temporary-normal";

            return;
        }

        //──────────────────────────────────────────────────────
        // Transient mode → Normal
        //──────────────────────────────────────────────────────

        if (
            old_mode !== "normal" &&
            old_mode !== "hint" &&
            new_mode === "normal"
        ) {
            if (
                transientReturnState !== null
            ) {
                insertPreferredState =
                    transientReturnState;

                transientReturnState = null;
            }

            return;
        }
    },
);


//──────────────────────────────────────────────────────────────
// Normal command handling
//──────────────────────────────────────────────────────────────

glide.autocmds.create(
    "KeyStateChanged",
    ({
        mode,
        sequence,
        partial,
    }) => {
        if (!insertPreferredSite) {
            return;
        }

        //──────────────────────────────────────────────────────
        // Hint Escape
        //──────────────────────────────────────────────────────

        if (
            mode === "hint" &&
            !partial &&
            sequence.length === 1 &&
            sequence[0] === "<Esc>"
        ) {
            hintEscapePressed = true;

            return;
        }

        if (mode !== "normal") {
            return;
        }

        //──────────────────────────────────────────────────────
        // Partial Normal command
        //──────────────────────────────────────────────────────
        //
        // Example:
        //
        //     d
        //
        // may still become:
        //
        //     dw
        //     db
        //     d$
        //
        // so remain in Normal until the command resolves.
        //──────────────────────────────────────────────────────

        if (partial) {
            return;
        }

        if (sequence.length === 0) {
            return;
        }

        // Escape is not used to enter Persistent Normal.
        //
        // If Glide happens to report it through KeyStateChanged,
        // simply leave Temporary Normal alone.
        if (
            sequence.length === 1 &&
            sequence[0] === "<Esc>"
        ) {
            return;
        }

        //──────────────────────────────────────────────────────
        // Transient Normal commands
        //──────────────────────────────────────────────────────
        //
        // These are handled by ModeChanged instead.
        //──────────────────────────────────────────────────────

        if (
            sequence.length === 1 &&
            transientNormalCommands.has(
                sequence[0],
            )
        ) {
            transientReturnState =
                insertPreferredState ===
                    "persistent-normal"
                    ? "persistent-normal"
                    : "temporary-normal";

            return;
        }

        //──────────────────────────────────────────────────────
        // Commands that make Normal persistent
        //──────────────────────────────────────────────────────

        if (
            sequence.length === 1 &&
            persistentNormalCommands.has(
                sequence[0],
            )
        ) {
            insertPreferredState =
                "persistent-normal";

            transientReturnState = null;

            return;
        }

        //──────────────────────────────────────────────────────
        // Persistent Normal
        //──────────────────────────────────────────────────────
        //
        // Once entered, ordinary Normal commands stay Normal.
        //
        // Actually entering Insert mode is what resets this.
        //──────────────────────────────────────────────────────

        if (
            insertPreferredState ===
            "persistent-normal"
        ) {
            return;
        }

        //──────────────────────────────────────────────────────
        // Ordinary completed Temporary-Normal command
        //──────────────────────────────────────────────────────
        //
        // Let Glide finish the command first.
        //
        // If the command left us in Normal, return to Insert.
        //──────────────────────────────────────────────────────

        Promise.resolve().then(
            async () => {
                if (
                    !insertPreferredSite ||
                    insertPreferredState !==
                        "temporary-normal" ||
                    transientReturnState !== null ||
                    glide.ctx.mode !== "normal"
                ) {
                    return;
                }

                insertPreferredState = "insert";

                await glide.excmds.execute(
                    "mode_change insert",
                );
            },
        );
    },
);


// 3. AI Chatbots - Safe Enter behavior
// Removes the fear of accidentally sending a prompt when you really meant to go down a line with return
//
// All configured sites:
//
//     Insert Enter
//         → Shift+Enter
//         → New line instead of accidentally sending.
//
//     Insert Ctrl+Enter
//         → Send prompt
//         → Enter Normal mode
//         → Focus the largest scrollable element.
//
//     Insert Ctrl+Alt+Enter
//         → Send prompt only.
//         → Stay in Insert mode.
//         → Do not change focus.
//
// Most sites:
//     Ctrl+Enter is sent directly to the website.
//
// Override sites:
//     Ctrl+Enter is converted to plain Enter.
//
//     Use this for sites where Ctrl+Enter does NOT natively send,
//     but regular Enter does.
//
// Source: Me & ChatGPT


//──────────────────────────────────────────────────────────────
// Sites with native Ctrl+Enter support
//──────────────────────────────────────────────────────────────

const safeEnterSites: string[] = [
    "chatgpt.com",
    "duck.ai",
    "grok.com",
    "claude.ai",
    "mistral.ai",
    "arena.ai",
	"lumo.proton.me"
];


//──────────────────────────────────────────────────────────────
// Sites without native Ctrl+Enter support
//──────────────────────────────────────────────────────────────
//
// These get:
//
//     Enter      → Shift+Enter
//     Ctrl+Enter → Enter
//
// Move a site from safeEnterSites into this list if its native
// Ctrl+Enter does not send the prompt.
//──────────────────────────────────────────────────────────────

const safeEnterCtrlOverrideSites: string[] = [
    // "example.ai",
];


//──────────────────────────────────────────────────────────────
// Helpers
//──────────────────────────────────────────────────────────────

const allSafeEnterSites = [
    ...safeEnterSites,
    ...safeEnterCtrlOverrideSites,
];


function safeEnterSiteMatches(
    hostname: string,
    sites: string[],
): boolean {
    hostname = hostname.toLowerCase();

    return sites.some((site) => {
        const host = site.toLowerCase();

        return (
            hostname === host ||
            hostname.endsWith(`.${host}`)
        );
    });
}


// Send using whichever key the current site expects.
//
// Native sites:
//     Ctrl+Enter
//
// Override sites:
//     Enter
async function safeEnterSend(
    hostname: string,
): Promise<void> {
    const key =
        safeEnterSiteMatches(
            hostname,
            safeEnterCtrlOverrideSites,
        )
            ? "<Enter>"
            : "<C-Enter>";

    await glide.keys.send(
        key,
        {
            skip_mappings: true,
        },
    );
}


//──────────────────────────────────────────────────────────────
// Safe Enter mappings
//──────────────────────────────────────────────────────────────

glide.autocmds.create(
    "UrlEnter",
    new RegExp(
        "^https?://([^/]*\\.)?(" +
        allSafeEnterSites
            .map(site =>
                site.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&",
                )
            )
            .join("|") +
        ")(/|:|$)"
    ),

    async ({ url }) => {
        const hostname =
            new URL(url).hostname.toLowerCase();


        //──────────────────────────────────────────────────────
        // Enter → Shift+Enter
        //──────────────────────────────────────────────────────

        glide.buf.keymaps.set("insert", "<Enter>", async () => {
            // While typing in the URL bar, Enter must navigate normally.
            // urlBarOwnsKey() reads Firefox's live focus state at this exact
            // moment - it never relies on remembered state (see the
            // "URL bar → Insert mode" section for why).
            if (urlBarOwnsKey("<Enter>")) {
                await glide.keys.send("<Enter>", { skip_mappings: true });
                return;
            }

            await glide.keys.send(
                "<S-Enter>",
                {
                    skip_mappings: true,
                },
            );
        }, {
            description: "Insert newline without sending prompt",
        });


        //──────────────────────────────────────────────────────
        // Ctrl+Enter → Send, then Normal + focus chat
        //──────────────────────────────────────────────────────

        glide.buf.keymaps.set("insert", "<C-Enter>", async ({ tab_id }) => {
            if (urlBarOwnsKey("<C-Enter>")) {
                await glide.keys.send("<C-Enter>", { skip_mappings: true });
                return;
            }

            await safeEnterSend(
                hostname,
            );

            await glide.excmds.execute(
                "mode_change normal",
            );

            await focusLargestScrollable(
                tab_id,
            );
        }, {
            description: "Send prompt, enter Normal mode, and focus chat",
        });


        //──────────────────────────────────────────────────────
        // Ctrl+Alt+Enter → Send only
        //──────────────────────────────────────────────────────
        //
        // Same send behavior as Ctrl+Enter, but:
        //
        //     Do NOT enter Normal mode.
        //     Do NOT change focus.
        //
        // Useful when sending something but immediately wanting
        // to continue typing in the same editor.
        //──────────────────────────────────────────────────────

        glide.buf.keymaps.set("insert", "<C-A-Enter>", async () => {
            if (urlBarOwnsKey("<C-A-Enter>")) {
                await glide.keys.send("<C-A-Enter>", { skip_mappings: true });
                return;
            }

            await safeEnterSend(
                hostname,
            );
        }, {
            description: "Send prompt and stay in Insert mode",
        });
    },
);


//3. Custom Keybinds

//A. Outlook (outlook.cloud.microsoft, outlook.office.com)
//
// Registered in the normal-mode keymap table via a synchronous, idempotent
// UrlEnter sync (no async cleanup callback, so zero late-cleanup race).
// Why global sync instead of glide.buf.keymaps here: Glide's Which-Key popup
// and :map only read glide.keymaps.list() (global mappings), so syncing them
// in/out on UrlEnter makes pressing "!" on Outlook show every tag description
// in Which-Key while keeping non-Outlook sites completely clean.

const OUTLOOK_URL_RE = /^https:\/\/outlook\.(office\.com|cloud\.microsoft)\//i;

// Set order tags are applied relative to their structure in the array.
const outlookReverseOrder = false;

async function applyOutlookCategories(tags: string[]): Promise<void> {
    await glide.excmds.execute("mode_change insert");

    // Open the Categories dialog.
    await glide.keys.send("q");
    await glide.keys.send("c");

    await new Promise(resolve => setTimeout(resolve, 100));

    // Choose the order in which the tags will be added.
    const tagsToAdd = outlookReverseOrder
        ? [...tags].reverse()
        : tags;

    // Add every tag.
    for (let i = 0; i < tagsToAdd.length; i++) {
        const tag = tagsToAdd[i];

        await glide.keys.send(tag);
        await glide.keys.send("<Enter>");

        // If there are more tags to enter, clear the search box.
        if (i < tagsToAdd.length - 1) {
            await glide.keys.send("<C-a>");
            await glide.keys.send("<Backspace>");
        }
    }

    await glide.keys.send("<Esc><Esc>");
}

const OUTLOOK_NORMAL_KEYS = [
    ")",
    "(",
    "<S-j>",
    "!s",
    "!k",
    "!f",
    "!n",
    "!r",
    "<S-@>",
] as const;

let outlookKeymapsActive = false;

glide.autocmds.create("UrlEnter", /./, ({ url }) => {
    let activeUrl = url;
    try {
        activeUrl = glide.ctx.url.href;
    } catch {
        // Fall back to the UrlEnter event URL.
    }

    const onOutlook = OUTLOOK_URL_RE.test(activeUrl);

    if (!onOutlook) {
        if (outlookKeymapsActive) {
            outlookKeymapsActive = false;
            for (const lhs of OUTLOOK_NORMAL_KEYS) {
                safeDel("normal", lhs);
            }
        }
        return;
    }

    if (outlookKeymapsActive) {
        return;
    }

    outlookKeymapsActive = true;

    // a. Toggle through area fields/regions with ( and )
    // Source: ChatGPT
    // Note: Best used when no regular tabbable field has focus.
    glide.keymaps.set("normal", ")", async () => {
        await glide.keys.send("<C-F6>");
    }, {
        description: "Focus next Outlook region",
    });

    glide.keymaps.set("normal", "(", async () => {
        await glide.keys.send("<C-S-F6>");
    }, {
        description: "Focus previous Outlook region",
    });

    // b. Select the autocorrected word from the Alt+Down menu with Shift+J
    // Source: Me
    glide.keymaps.set("normal", "<S-j>", async () => {
        await glide.keys.send("<A-Down>");
    }, {
        description: "Select autocorrected word from Outlook menu",
    });

    //──────────────────────────────────────────────────────────
    // Outlook Auto Add Categories (!s, !k, !f, !n, !r)
    // Direct multi-key mappings (no glide.keys.next() listener)
    //──────────────────────────────────────────────────────────

    glide.keymaps.set("normal", "!s", () => applyOutlookCategories([
        "Not Phishing",
        "spam",
    ]), {
        description: "Outlook categories: Not Phishing, spam",
    });

    glide.keymaps.set("normal", "!k", () => applyOutlookCategories([
        "Not Phishing",
        "KnowBe4",
    ]), {
        description: "Outlook categories: Not Phishing, KnowBe4",
    });

    glide.keymaps.set("normal", "!f", () => applyOutlookCategories([
        "Not Phishing",
        "Fairmount",
    ]), {
        description: "Outlook categories: Not Phishing, Fairmount",
    });

    glide.keymaps.set("normal", "!n", () => applyOutlookCategories([
        "Not Phishing",
    ]), {
        description: "Outlook category: Not Phishing",
    });

    glide.keymaps.set("normal", "!r", () => applyOutlookCategories([
        "Not Phishing",
        "Returned",
    ]), {
        description: "Outlook categories: Not Phishing, Returned",
    });

    // Let Shift + 2 (@) clear two categories from an email
    glide.keymaps.set("normal", "<S-@>", async () => {
        await glide.excmds.execute("mode_change insert");
        await glide.keys.send("c");
        await new Promise(resolve => setTimeout(resolve, 50));
        await glide.keys.send("<Esc>");
        await glide.keys.send("<Up>");
        await glide.keys.send("<Enter>");
    }, {
        description: "Clear two Outlook categories from email",
    });
});


//B. Super Productivity
//
// After Enter is pressed in Insert mode, pass the next Escape
// directly to Super Productivity so it can close its task-entry
// UI without taking Glide out of Insert.
//
// Any other Escape behaves normally and enters Temporary Normal.

glide.autocmds.create(
    "UrlEnter",
    {
        hostname: "app.super-productivity.com",
    },
    async () => {
        let enterPressed = false;


        glide.buf.keymaps.set(
            "insert",
            "<Enter>",
            async () => {
                if (!urlBarFocusedNow()) {
                    enterPressed = true;
                }

                await glide.keys.send(
                    "<Enter>",
                    {
                        skip_mappings: true,
                    },
                );
            },
            {
                description: "Confirm Super Productivity entry and arm Escape close",
            },
        );


        glide.buf.keymaps.set(
            "insert",
            "<Esc>",
            async () => {
                if (enterPressed) {
                    enterPressed = false;

                    await glide.keys.send(
                        "<Esc>",
                        {
                            skip_mappings: true,
                        },
                    );

                    return;
                }


                enterPressed = false;

                // Tell Insert-Preferred that this is an
                // intentional Escape, not a focus-driven
                // Insert → Normal transition.
                await insertPreferredEscape();
            },
            {
                description: "Close Super Productivity task entry or exit Insert mode",
            },
        );
    },
);


//Applications


//1.
//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 1.0
// Manual Keyword snippet expansion (Trigger Key: <F4>)
//──────────────────────────────────────────────────────────────
// Note: Caps Lock is remapped to F4 on my Windows work keyboard,
// so that I can use Alt + Caps Lock to close windows, so you may
// want to remap this to something easier to hit for you.
//
// Usage:
// <Trigger Key> + ew + <Space> -> 🥹
// <Trigger Key> + check + <Space> -> ✅
//
// Snippets are stored with a leading "q", but the "q" does not
// need to be typed when manually expanding a snippet.
//
// The snippet engine only runs while the F4 mapping is active.
// It does not maintain a background key listener.

const SnippetEngine = {

    snippets: {

        // Emoji
        q100: "💯",
        qa: "🫨",
        qa2: "🫨🫨",
        qa3: "🫨🫨🫨",
        qaca: "🫨🥳🫨",
        qand: "🦆",
        qanm: "🐒",
        qanp: "🐼",
        qarm: "💪",
        qbaby: "👶",
        qbike: "🚴‍♂️",
        qbox: "◽",
        qc: "😁",
        qc2: "😁😁",
        qc3: "😁😁😁",
        qca: "😆",
        qcb: "🤯",
        qcb2: "🤯🤯",
        qcb3: "🤯🤯🤯",
        qcc: "🥳",
        qcc2: "🥳🥳",
        qcc3: "🥳🥳🥳",
        qccac: "🥳🫨🥳",
        qce: "😃",
        qcf: "👊😎",
        qch: "😄",
        qcheck: "✅",
        qco: "😎",
        qcoa: "💪😎",
        qcof: "👊😎",
        qcok: "😎👌",
        qcot: "😎👍",
        qcow: "🐮",
        qcross: "✝️",
        qcs: "😅",
        qcst: "🗿",
        qct: "😎👍",
        qcw: "😱",
        qd: "😭",
        qdb: "🤧",
        qdc: "😔",
        qdis: "🥸",
        qdm: "🫠",
        qdowna: "⬇️",
        qdt: "🥲",
        qdtt: "😢",
        qe: "👀",
        qeb: "🤨",
        qeh: "🫣",
        qer: "🙄",
        qes: "🤩",
        qew: "🥹",
        qex: "😵",
        qf: "🔥",
        qg: "🐐",
        qh: "❤️",
        qh2: "❤️❤️",
        qh3: "❤️❤️❤️",
        qhaa: "🫡",
        qhac: "👏",
        qhach: "🤌",
        qhad: "👇",
        qhaf: "👊",
        qhah: "🫶",
        qhahf: "🫰",
        qhal: "🤟",
        qhap: "🤦",
        qhar: "🤘",
        qhas: "🤝",
        qhat: "🤔",
        qhau: "☝️",
        qhaw: "👋",
        qhb: "❤️‍🩹",
        qhe: "😍",
        qhf: "❤️‍🔥",
        qhk: "😘",
        qhl: "🥰",
        qhug: "🤗",
        qhuh: "🧐",
        ql: "😂",
        qll: "🤣",
        qls: "😅",
        qmist: "😶‍🌫️",
        qn: "🙂‍↕️",
        qnerd: "🤓",
        qo: "😯",
        qof: "😮‍💨",
        qok: "👌",
        qoo: "😦",
        qp: "🙏",
        qp2: "🙏🙏",
        qp3: "🙏🙏🙏",
        qparty: "🎉",
        qpeep: "🐥",
        qraise: "🙋",
        qrobot: "🤖",
        qs: "🙂",
        qsb: "☺️",
        qsbb: "😊",
        qsh: "😇",
        qshrug: "🤷",
        qsk: "💀",
        qsl: "😴",
        qsmirk: "😏",
        qsnail: "🐌",
        qsp: "😌",
        qsparkle: "✨",
        qt: "👍",
        qt2: "👍👍",
        qtee: "😬",
        qthrow: "🤮",
        qtr: "🚂",
        qturk: "🦃",
        qup: "⬆️",
        qwink: "😉",
        qwiz: "🧙🏿‍♂️",
        qwoozy: "😵‍💫",
        qx: "❌",
        qyawn: "🥱",

        //Unicode Characters
        qshrugg: "¯\\_(ツ)_/¯",
    },

    // Keys that confirm a snippet.
    triggerKeys: [
        "<Space>",
        ".",
    ],

};


//──────────────────────────────────────────────────────────────
// Insert text at the cursor without deleting anything.
//──────────────────────────────────────────────────────────────

async function insertText(
    tab_id: number,
    text: string,
): Promise<void> {

    await glide.content.execute(

        (text) => {

            document.execCommand(
                "insertText",
                false,
                text,
            );

        },

        {
            tab_id,
            args: [text],
        },

    );

}


//──────────────────────────────────────────────────────────────
// Manual snippet expansion
//──────────────────────────────────────────────────────────────

glide.keymaps.set("insert", "<F4>", async ({ tab_id }) => {

    let typed = "";

    while (true) {

        const key = (await glide.keys.next()).glide_key;

        // A configured trigger key confirms the snippet.
        if (SnippetEngine.triggerKeys.includes(key)) {

            const snippet =
                SnippetEngine.snippets[`q${typed}`];

            // Unknown snippet -> cancel.
            if (!snippet) {
                return;
            }

            await insertText(
                tab_id,
                snippet,
            );

            // Return to insert mode.
            await glide.excmds.execute(
                "mode_change insert",
            );

            return;
        }

        // ESC cancels.
        if (key === "<Esc>") {
            return;
        }

        // Otherwise keep building the snippet.
        typed += key;

    }

}, {
    description: "Expand keyword snippet",
});





//Background Processes

//──────────────────────────────────────────────────────────────
// 1. URL bar → Insert mode
//──────────────────────────────────────────────────────────────
//
// Whenever the URL bar gains focus (click, Ctrl+L, Ctrl+K, F6, Alt+D,
// opening a new tab with <leader>n / Ctrl+T / tab_new...), switch to
// Insert mode.
//
// This is a one-time switch upon entering/opening the URL bar, NOT a lock:
// pressing Esc leaves you in Normal mode for as long as you stay in the bar.
//
// When you open a new tab while the URL bar was already focused in Normal
// mode from a previous tab (after Esc), Firefox keeps the same chrome input
// focused without re-firing a DOM focus event. We catch that via the UrlEnter
// autocmd so new tabs always default to Insert mode ready for typing.
//
// Ignore mode is left alone. It is a deliberate pass-through mode, and
// Glide does not leave it on focus changes.
//
// IMPORTANT - there is deliberately NO long-lived "the URL bar is focused"
// variable in this section. An earlier version had one (urlBarFocused). It
// was set to true for every new-tab URL even when the URL bar was not
// focused, and only a blur event could clear it - which cannot fire for an
// input that never had focus. It then stayed true until the next time the
// URL bar was focused and left, and Safe Enter (which steps aside while the
// URL bar is focused) sent a plain Enter on AI sites, submitting the prompt.
//
// Now nothing is remembered. "Is the URL bar focused?" is answered at the
// moment it is needed, from Firefox's own state:
//
//   1. The `focused` attribute Firefox puts on #urlbar in focus handling and
//      removes in blur handling. Your tcc / ts code already reads live chrome
//      attributes the same way (#trust-icon-container[open], panelopen).
//   2. A blur event that arrived after the latest focus event vetoes (1).
//      Firefox skips removing the attribute while the URL bar's result
//      context menu is open, but the blur event still fires.
//   3. Only for the Insert switch (never for Safe Enter): a focus event in
//      the last 500 ms counts as focused. Firefox focuses the URL bar WITHOUT
//      the attribute for the new-tab page's search hand-off ("hidden focus").
//
// Source: claude-fable-5.1-max

// The text field inside Firefox's URL bar.
const URLBAR_INPUT_ID = "urlbar-input";

// The element that carries Firefox's own `focused` attribute.
const URLBAR_ID = "urlbar";

// Re-assert Insert at these delays (ms) after the URL bar gains focus, in
// case a late Normal request from the previously focused element lands
// after ours. Bounded on purpose, so you can leave Insert afterwards.
const URLBAR_INSERT_RECHECK_MS = [0, 50, 150];

// A real focus event counts as "focused" for the Insert re-checks for this
// long. Longer than the re-check delays above, short enough that it can
// never outlive them in any way that matters.
const URLBAR_FOCUS_EVENT_WINDOW_MS = 500;

// Time of the latest real focus event on the URL bar input.
let urlBarFocusEventAt = 0;

// True once a blur event has arrived after the latest focus event.
let urlBarBlurredAfterFocus = false;

// Is the URL bar focused RIGHT NOW? Strict and live: no memory, so it can
// not get stuck. Used wherever a wrong "yes" is harmful (Safe Enter).
function urlBarFocusedNow(): boolean {
    const urlbar = document.getElementById(URLBAR_ID);

    if (!urlbar || !urlbar.hasAttribute("focused")) {
        return false;
    }

    // Firefox keeps the attribute while its result context menu is open,
    // but the input's blur event still fires.
    return !urlBarBlurredAfterFocus;
}

// A genuine focus event happened a moment ago and focus has not left since.
function urlBarRecentlyFocusedByEvent(): boolean {
    return (
        !urlBarBlurredAfterFocus &&
        urlBarFocusEventAt > 0 &&
        Date.now() - urlBarFocusEventAt < URLBAR_FOCUS_EVENT_WINDOW_MS
    );
}

// For Safe Enter: true when this key belongs to Firefox's URL bar, so the
// mapping must step aside and let it through untouched.
function urlBarOwnsKey(key: string): boolean {
    if (!urlBarFocusedNow()) {
        return false;
    }

    console.log(`[safe-enter] URL bar is focused, passing ${key} through to Firefox.`);

    return true;
}

// Schedule the Insert re-checks. Remembers nothing: every check decides
// from live evidence when it runs.
function triggerUrlBarInsert(): void {
    for (const delay of URLBAR_INSERT_RECHECK_MS) {
        setTimeout(() => {
            urlBarEnterInsert().catch((error) => {
                console.error("[urlbar] Failed to enter Insert:", error);
            });
        }, delay);
    }
}

async function urlBarEnterInsert(): Promise<void> {
    // Focus already left, e.g. Enter was pressed and the page took over, or
    // the URL bar was never focused (a new tab whose page took focus).
    if (!urlBarFocusedNow() && !urlBarRecentlyFocusedByEvent()) {
        return;
    }

    const mode = glide.ctx.mode;

    // Already there, or deliberately in pass-through mode.
    if (mode === "insert" || mode === "ignore") {
        return;
    }

    await glide.excmds.execute("mode_change insert");
}

function isNewTabUrl(url: string): boolean {
    const lower = url.toLowerCase();
    const customNewTab = (glide.o as any)?.newtab_url?.toLowerCase?.();
    return (
        lower === "about:newtab" ||
        lower === "about:home" ||
        lower === "about:blank" ||
        lower === "about:privatebrowsing" ||
        lower.startsWith("about:newtab") ||
        lower.startsWith("about:home") ||
        (customNewTab && lower === customNewTab)
    );
}

function hookUrlBar(attempt: number = 0): void {
    const input = document.getElementById(URLBAR_INPUT_ID);

    if (!input) {
        // The browser UI may not be mirrored into the config document yet.
        if (attempt < 20) {
            setTimeout(() => hookUrlBar(attempt + 1), 250);
        } else {
            console.warn(
                `[urlbar] #${URLBAR_INPUT_ID} not found, URL bar → Insert is inactive.`,
            );
        }

        return;
    }

    input.addEventListener(
        "focus",
        () => {
            urlBarFocusEventAt = Date.now();
            urlBarBlurredAfterFocus = false;

            triggerUrlBarInsert();
        },
        true,
    );

    input.addEventListener(
        "blur",
        () => {
            urlBarBlurredAfterFocus = true;
            urlBarFocusEventAt = 0;
        },
        true,
    );

    console.log("[urlbar] URL bar → Insert mode is active.");
}

// 1. Initial hook when config loads
glide.autocmds.create("ConfigLoaded", () => {
    hookUrlBar();
});

// 2. Tab changes / new tabs (covers <leader>n, Ctrl+T, tab_new)
// When a new tab is opened while the URL bar was already focused in Normal mode,
// Firefox keeps the input focused without re-firing a DOM focus event. The
// URL bar's live `focused` attribute still says so, so we catch that here and
// new tabs start in Insert mode. A new-tab URL on its own schedules the
// checks but changes nothing unless the URL bar really is focused.
glide.autocmds.create("UrlEnter", /./, ({ url }) => {
    if (isNewTabUrl(url) || urlBarFocusedNow()) {
        triggerUrlBarInsert();
    }
});
