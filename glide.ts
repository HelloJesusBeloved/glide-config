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
// For site-specific mappings prefer glide.buf.keymaps.set() instead of
// set + cleanup: Glide clears buffer mappings itself on every URL change.
function safeDel(
    mode: string,
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


//4. SubMenu Structure Definition
//Creates the structure for making your own multi key submenu structures
//Source: ChatGPT
//Example:
// subMenu("1", {
//     u: {
//         description: "URL scanners",
//         action: async () => {
//             // whatever you want
//         },
//     },
//
//     n: {
//         description: "Search person",
//         websites: [
//             "outlook.office.com",
//             "outlook.cloud.microsoft",
//         ],
//         action: async () => {
//             // whatever you want
//         },
//     },
// });

type SubMenuAction = () => void | Promise<void>;

interface SubMenuItem {
    description: string;
    action: SubMenuAction;

    // Leave blank/undefined for global.
    // Add one or more hostnames to restrict the mapping.
    websites?: string[];
}

function websiteMatches(websites?: string[]): boolean {
    if (!websites || websites.length === 0) {
        return true;
    }

    // glide.ctx.url throws if there is no current URL (e.g. very early in
    // startup) - treat that as "no match" instead of failing the mapping.
    let hostname: string;
    try {
        hostname = glide.ctx.url.hostname.toLowerCase();
    } catch {
        return false;
    }

    return websites.some((website) => {
        const host = website
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .toLowerCase();

        return hostname === host || hostname.endsWith(`.${host}`);
    });
}

function subMenu(
    prefix: string,
    items: Record<string, SubMenuItem>,
) {
    for (const [key, item] of Object.entries(items)) {
        const lhs = `${prefix}${key}`;

        glide.keymaps.set(
            "normal",
            lhs,
            async () => {
                if (!websiteMatches(item.websites)) {
                    return;
                }

                try {
                    await item.action();
                } catch (error) {
                    // Glide turns an error thrown from a keymap callback into
                    // a red notification bar (browser-excmds.mts:
                    // GlideExcmds.execute() ->
                    // add_notification("glide-excmd-error")). That bar is the
                    // one on-screen signal that separates "the key dispatched
                    // but the action failed" from "the key never dispatched".
                    // We only add context to the message, then rethrow.
                    const message =
                        error instanceof Error ? error.message : String(error);

                    throw new Error(`[${lhs}] ${item.description}: ${message}`);
                }
            },
            {
                description: item.description,
            },
        );
    }
}


//5. Normalize and validate a web URL
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


//6. Show an error using Glide's built-in error handling
//Source: ChatGPT
function glideError(message: string): never {
    throw new Error(message);
}


//6b. Read the clipboard and turn it into a validated URL.
// Shared by 1u / 1o so both fail the same, *visible* way (see subMenu()).
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
});


//3. Open keyword bookmark (or any other text typed after "ne" in the command line) in a new tab
//Source: ChatGPT
glide.excmds.create(
  {
    name: "ne",
    description: "Open keyword bookmark in a new tab",
  },
  async ({ args_arr }) => {
    const query = args_arr.join(" ");

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
);


//4. Hint Tabs, Tab Groups, and the New Tab button with <leader>F
//Source: ChatGPT and Me
glide.keymaps.set("normal", "<leader>F", () => {
    glide.hints.show({
        location: "browser-ui",
        selector: ".tabbrowser-tab, .tab-group-label, #tabs-newtab-button.toolbarbutton-1",
    });
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
});

//db
glide.keymaps.set("op-pending", "b", async () => {
    await glide.keys.send("<C-S-Left>");
    await glide.keys.send("<Backspace>");
});

//d$
glide.keymaps.set("op-pending", "$", async () => {
    await glide.keys.send("<Left>");
    await glide.keys.send("<S-End>");
    await glide.keys.send("<Backspace>");
});

//d0
glide.keymaps.set("op-pending", "0", async () => {
    await glide.keys.send("<S-Home>");
    await glide.keys.send("<Backspace>");
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
});

//p to paste in normal mode
glide.keymaps.set("normal", "p", async () => {
    await glide.keys.send("<C-v>");
});

//ctrl + r to redo in normal mode
  glide.keymaps.set("normal", "<C-r>", async () => {
    await glide.keys.send("<C-S-z>");
  });

//gg and shift + g from Page Home and End to the Bottom and Top of the Text Block
safeDel("normal", "<S-g>");
safeDel("normal", "gg");

  glide.keymaps.set("normal", "<S-g>", async () => {
    await glide.keys.send("<C-End>");
  });

  glide.keymaps.set("normal", "gg", async () => {
    await glide.keys.send("<C-Home>");
  });

//visual mode - Making Visual Mode better

//a. Make j and k actually select line by line
glide.keymaps.set("visual", "j", async () => {
    await glide.keys.send("<S-Down>");
});
glide.keymaps.set("visual", "k", async () => {
    await glide.keys.send("<S-Up>");
});

//b. Make w and b actually select forwards and backwards one word
glide.keymaps.set("visual", "b", async () => {
    await glide.keys.send("<C-S-Left>");
});

//c. Make gg and shift + g actually select to the bottom or top in visual mode
  glide.keymaps.set("visual", "<S-g>", async () => {
    await glide.keys.send("<C-S-End>");
  });
  glide.keymaps.set("visual", "gg", async () => {
    await glide.keys.send("<C-S-Home>");
  });

//d. Make 0 and $ actually go to the beginning and end of the line
glide.keymaps.set("visual", "$", async () => {
    await glide.keys.send("<S-End>");
});
glide.keymaps.set("visual", "0", async () => {
    await glide.keys.send("<S-Home>");
});

//e. Make <leader>v turn on caret browsing
glide.keymaps.set("normal", "<leader>v", async () => {
    await glide.keys.send("<F7>");
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
});


//shift o to insert a line above in normal mode
  glide.keymaps.set("normal", "<S-o>", async () => {
    await glide.excmds.execute("mode_change insert");
    await glide.keys.send("<Home>");
    await glide.keys.send("<Enter>");
    await glide.keys.send("<Up>");
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
let wakeLock: WakeLockSentinel | undefined;

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

//C. tu - Unload current tab after switching to another tab
// Source: ChatGPT
glide.keymaps.set("normal", "tu", async ({ tab_id }) => {
    const tabs = await browser.tabs.query({
        currentWindow: true,
    });

    const current = tabs.find(tab => tab.id === tab_id);

    if (!current) {
        return;
    }

    // Find another tab in the same window.
    const nextTab = tabs.find(
        tab => tab.id !== tab_id && !tab.hidden,
    );

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
    description: "Unload current tab",
});

//D. tU - Unload all tabs except the current one
//Source: ChatGPT
glide.keymaps.set("normal", "tU", async ({ tab_id }) => {
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
    description: "Unload all other tabs",
});

 //E. ts — Send current tab to a Firefox Sync device.
 // Source: Me & ChatGPT
 //
 // Uses Glide's mirrored browser DOM and Firefox's
 // native keyboard navigation.
 // No privileged Firefox APIs or additional permissions.


 //─────────────────────────────────────────────────────────────
 // Configuration
 //─────────────────────────────────────────────────────────────

 // Controls the order shown in Glide's device picker.
 // The first device is selected by default.
 const sendTabDeviceOrder = [
     "iPhone 17 Pro",
     "Miniature Superman",
     "Metro Man",
     "deck’s Firefox on david",
     "Glide Kasm Ubuntu Jammy VPN",
 ];

 // Shortcuts for searching the picker.
 const sendTabAliases: Record<string, string> = {
     "iPhone 17 Pro": "i",
     "Miniature Superman": "ms",
     "Metro Man": "mm",
     "deck’s Firefox on david": "d",
     "Glide Kasm Ubuntu Jammy VPN": "k",
 };

 // Leave true until you have tested the new navigation.
 const sendTabDryRun = false;
 const sendTabDebug = true;


 //─────────────────────────────────────────────────────────────
 // Device discovery
 //─────────────────────────────────────────────────────────────

 type SendTabDevice = {
     name: string;
     occurrence: number;
     index: number;
     button: Element;
 };

 function sendTabGetDevices(): SendTabDevice[] {
     const list = document.getElementById(
         "PanelUI-fxa-menu-devices-list",
     );

     const counts = new Map<string, number>();
     const found: SendTabDevice[] = [];

     const buttons = list?.querySelectorAll(
         '[data-l10n-id="fxa-menu-device-send-current-page"]',
     ) ?? [];

     for (const button of buttons) {
         let header = button.previousElementSibling;

         while (
             header &&
             !header.classList.contains(
                 "PanelUI-fxa-menu-device-header",
             )
         ) {
             header = header.previousElementSibling;
         }

         const name = header?.textContent?.trim();

         if (!name) continue;

         const occurrence =
             (counts.get(name) ?? 0) + 1;

         counts.set(name, occurrence);

         found.push({
             name,
             occurrence,
             index: found.length,
             button,
         });
     }

     return found;
 }

 function sendTabResolve(
     selected: SendTabDevice,
 ): SendTabDevice | null {
     const current = sendTabGetDevices();

     const match = current.find(device =>
         device.name === selected.name &&
         device.occurrence === selected.occurrence
     );

     if (!match) return null;

     // Identically named devices cannot be safely identified
     // if their displayed ordering changes.
     if (
         current.some(device =>
             device !== match &&
             device.name === selected.name
         ) &&
         match.index !== selected.index
     ) {
         throw new Error(
             "Duplicate device order changed. Reopen ts.",
         );
     }

     return match;
 }


 //─────────────────────────────────────────────────────────────
 // Observe application menu open/closed state
 //─────────────────────────────────────────────────────────────

 const sendTabPopup =
     document.getElementById("appMenu-popup");

 const sendTabDeviceList =
     document.getElementById(
         "PanelUI-fxa-menu-devices-list",
     );

 let sendTabPopupEventOpen = false;

 sendTabPopup?.addEventListener("popupshown", () => {
     sendTabPopupEventOpen = true;
 });

 sendTabPopup?.addEventListener("popuphidden", () => {
     sendTabPopupEventOpen = false;
 });

 function sendTabMenuOpen(): boolean {
     const panel =
         document.getElementById("appMenu-popup");

     return !!panel && (
         panel.getAttribute("panelopen") === "true" ||
         panel.getAttribute("state") === "open" ||
         sendTabPopupEventOpen
     );
 }


 //─────────────────────────────────────────────────────────────
 // Observe actual Firefox menu focus
 //─────────────────────────────────────────────────────────────

 let sendTabFocused: Element | null = null;
 let sendTabFocusSerial = 0;

 const sendTabWatched = new WeakSet<Element>();

 function sendTabWatchFocus(): void {
     const popup =
         document.getElementById("appMenu-popup");

     if (!popup) return;

     for (
         const element of
         popup.querySelectorAll("toolbarbutton")
     ) {
         if (sendTabWatched.has(element)) {
             continue;
         }

         sendTabWatched.add(element);

         element.addEventListener("focus", () => {
             sendTabFocused = element;
             sendTabFocusSerial++;

             if (sendTabDebug) {
                 console.log(
                     "[SendTab Focus]",
                     element.id ||
                     element.getAttribute("label") ||
                     element.textContent?.trim() ||
                     "(unlabelled)",
                 );
             }
         }, true);
     }
 }

 if (sendTabPopup) {
     new MutationObserver(
         sendTabWatchFocus,
     ).observe(sendTabPopup, {
         childList: true,
         subtree: true,
     });
 }

 sendTabWatchFocus();


 //─────────────────────────────────────────────────────────────
 // Watch nested device-list changes
 //─────────────────────────────────────────────────────────────

 // Unlike the previous version, mutations alone will
 // NEVER restart the keyboard navigation.
 //
 // They're only used to determine when the menu has
 // become sufficiently quiet to begin scanning.

 let sendTabListRevision = 0;
 let sendTabLastListChange = 0;

 if (sendTabDeviceList) {
     new MutationObserver(records => {
         if (
             records.some(record =>
                 record.type === "childList"
             )
         ) {
             sendTabListRevision++;
             sendTabLastListChange = Date.now();
         }
     }).observe(sendTabDeviceList, {
         childList: true,
         subtree: true,
     });
 }


 //─────────────────────────────────────────────────────────────
 // Keyboard helpers
 //─────────────────────────────────────────────────────────────

 const sendTabPause = (
     ms: number,
 ): Promise<void> =>
     new Promise(resolve => setTimeout(resolve, ms));

 async function sendTabKey(
     key: string,
 ): Promise<void> {
     await glide.keys.send(
         key,
         { skip_mappings: true },
     );
 }

 async function sendTabCloseMenu(): Promise<void> {
     for (
         let i = 0;
         i < 3 && sendTabMenuOpen();
         i++
     ) {
         await sendTabKey("<Esc>");
         await sendTabPause(100);
     }
 }


 //─────────────────────────────────────────────────────────────
 // Open the hamburger menu and VERIFY it opened
 //─────────────────────────────────────────────────────────────

 async function sendTabOpenMenu(): Promise<void> {
     if (sendTabMenuOpen()) {
         return;
     }

     for (
         let attempt = 1;
         attempt <= 3;
         attempt++
     ) {
         try {
             glide.hints.show({
                 location: "browser-ui",
                 selector: "#PanelUI-menu-button",
                 auto_activate: true,
             });
         } catch (error) {
             if (sendTabDebug) {
                 console.warn(
                     "[SendTab] Hint error",
                     error,
                 );
             }
         }

         // Do not send any keyboard navigation until
         // Firefox confirms the popup is open.
         for (let i = 0; i < 32; i++) {
             if (sendTabMenuOpen()) {
                 await sendTabPause(90);
                 return;
             }

             await sendTabPause(35);
         }

         if (sendTabDebug) {
             console.warn(
                 "[SendTab] Menu not open; retry",
                 attempt,
             );
         }
     }

     throw new Error(
         "Hamburger menu did not open (panelopen=" +
         sendTabPopup?.getAttribute("panelopen") +
         ", state=" +
         sendTabPopup?.getAttribute("state") +
         "). No arrow keys were sent."
     );
 }


 //─────────────────────────────────────────────────────────────
 // Move Down and observe the real focused element
 //─────────────────────────────────────────────────────────────

 async function sendTabDown(): Promise<Element | null> {
     for (let attempt = 0; attempt < 2; attempt++) {
         if (!sendTabMenuOpen()) {
             throw new Error(
                 "Firefox menu closed; keyboard navigation stopped.",
             );
         }

         const before = sendTabFocusSerial;

         await sendTabKey("<Down>");

         for (let tick = 0; tick < 16; tick++) {
             if (
                 sendTabFocusSerial > before
             ) {
                 await sendTabPause(35);
                 return sendTabFocused;
             }

             await sendTabPause(35);
         }
     }

     return null;
 }


 //─────────────────────────────────────────────────────────────
 // Open the Mozilla account panel
 //─────────────────────────────────────────────────────────────

 function sendTabInAccountView(
     element: Element | null,
 ): boolean {
     return !!element?.closest("#PanelUI-fxa");
 }

 async function sendTabOpenAccountMenu(): Promise<void> {
     await sendTabOpenMenu();

     for (let step = 0; step < 35; step++) {
         const focused = await sendTabDown();

         if (!focused) {
             throw new Error(
                 "Menu open, but focus did not advance.",
             );
         }

         if (sendTabInAccountView(focused)) {
             return;
         }

         if (
             focused.id === "appMenu-fxa-label2"
         ) {
             const view =
                 document.getElementById("PanelUI-fxa");

             let viewShown = false;

             const onShown = () => {
                 viewShown = true;
             };

             view?.addEventListener(
                 "ViewShown",
                 onShown,
             );

             try {
                 await sendTabKey("<Enter>");

                 // Prefer Firefox's ViewShown readiness
                 // signal. Use a bounded fallback if Glide
                 // does not forward the event.
                 for (
                     let i = 0;
                     i < 16 && !viewShown;
                     i++
                 ) {
                     await sendTabPause(25);
                 }

                 if (sendTabDebug) {
                     console.log(
                         "[SendTab] Account view",
                         viewShown
                             ? "ViewShown"
                             : "event unavailable",
                     );
                 }
             } finally {
                 view?.removeEventListener(
                     "ViewShown",
                     onShown,
                 );
             }

             return;
         }
     }

     throw new Error(
         "Mozilla account entry was not reached.",
     );
 }


 //─────────────────────────────────────────────────────────────
 // Cold and warm readiness profiles
 //─────────────────────────────────────────────────────────────

 let sendTabLastSuccessAt = 0;

// Wait for Firefox's device list to become ready.
// Fast on warm runs; watch for the second refresh on cold runs.
// Source: Me & ChatGPT

async function sendTabWaitForList(
    selected: SendTabDevice,
    revisionBeforeOpen: number,
): Promise<void> {
    const started = Date.now();

    const warm =
        started - sendTabLastSuccessAt < 20000;

    const quietNeeded = warm ? 150 : 250;

    // Cold runs without a second update use a fallback.
    const coldFallback = 1200;
    const maxWait = 9000;

    if (sendTabDebug) {
        console.log(
            "[SendTab] Readiness:",
            warm ? "warm" : "cold",
        );
    }

    while (Date.now() - started < maxWait) {
        const now = Date.now();

        const updates =
            Math.max(
                0,
                sendTabListRevision - revisionBeforeOpen,
            );

        const target = sendTabResolve(selected);

        const quietFor =
            now - Math.max(
                started,
                sendTabLastListChange,
            );

        // Cold: prefer observing the second refresh.
        // Warm: one fresh update is normally sufficient.
        const refreshReady =
            warm
                ? updates >= 1
                : updates >= 2 ||
                  (updates >= 1 &&
                   now - started >= coldFallback);

        if (
            target &&
            refreshReady &&
            quietFor >= quietNeeded
        ) {
            if (sendTabDebug) {
                console.log(
                    "[SendTab] Device list ready:",
                    {
                        mode: warm ? "warm" : "cold",
                        elapsed: now - started,
                        updates,
                        quietFor,
                    },
                );
            }

            return;
        }

        await sendTabPause(30);
    }

    throw new Error(
        "Firefox device list did not become ready.",
    );
}


 //─────────────────────────────────────────────────────────────
 // Navigate to the selected device and send
 //─────────────────────────────────────────────────────────────

 let sendTabBusy = false;

 async function sendTabSend(
     selected: SendTabDevice,
     tabId: number,
 ): Promise<void> {
     if (sendTabBusy) return;

     sendTabBusy = true;

     let sent = false;

     try {
         await glide.commandline.close();

         if (
             (await glide.tabs.active()).id !== tabId
         ) {
             throw new Error(
                 "Active tab changed. Send cancelled.",
             );
         }

         // Capture the revision before Firefox starts refreshing.
		 const revisionBeforeOpen = sendTabListRevision;

		 await sendTabOpenAccountMenu();
		 await sendTabWaitForList(selected, revisionBeforeOpen);

         let currentButton: Element | null = null;
         let seen = new Map<Element, number>();

         const started = Date.now();

         // The old implementation restarted on every
         // device-list revision.
         //
         // This version continues navigating through
         // unrelated UI changes.
         //
         // If the selected device's Send button itself is
         // replaced, update its reference and continue.
         for (
             let step = 0;
             step < 220 &&
             Date.now() - started < 18000;
             step++
         ) {
             if (!sendTabMenuOpen()) {
                 throw new Error(
                     "Firefox closed the account menu.",
                 );
             }

             const targetBefore =
                 sendTabResolve(selected);

             if (!targetBefore) {
                 await sendTabPause(90);
                 continue;
             }

             if (
                 currentButton !== targetBefore.button
             ) {
                 currentButton = targetBefore.button;
                 seen = new Map<Element, number>();

                 if (sendTabDebug) {
                     console.log(
                         "[SendTab] Target refreshed; continuing scan",
                     );
                 }
             }

             const focused = await sendTabDown();

             if (!focused) {
                 await sendTabPause(100);
                 continue;
             }

             const targetAfter =
                 sendTabResolve(selected);

             if (
                 !targetAfter ||
                 targetAfter.button !== currentButton
             ) {
                 // UI was rebuilt. Keep navigating rather
                 // than restarting the entire scan.
                 continue;
             }

             if (
                 focused === targetAfter.button
             ) {
                 // Ensure the target hasn't been replaced
                 // immediately after receiving focus.
                 await sendTabPause(110);

                 const confirmed =
                     sendTabResolve(selected);

                 if (
                     !confirmed ||
                     confirmed.button !== focused ||
                     sendTabFocused !== focused ||
                     !sendTabMenuOpen() ||
                     (await glide.tabs.active()).id !== tabId
                 ) {
                     continue;
                 }

                 sendTabLastSuccessAt = Date.now();

                 console.log(
                     "[SendTab] Found:",
                     selected.name,
                     selected.occurrence,
                     sendTabDryRun
                         ? "(dry run)"
                         : "",
                 );

                 if (!sendTabDryRun) {
                     await sendTabKey("<Enter>");
                     sent = true;
                 }

                 return;
             }

             // Detect repeated complete cycles.
             // Allow a few repetitions because Firefox
             // may reset focus during a device refresh.
             const visits =
                 (seen.get(focused) ?? 0) + 1;

             seen.set(focused, visits);

             if (visits >= 4) {
                 throw new Error(
                     "Send button exists but is not keyboard-reachable.",
                 );
             }
         }

         throw new Error(
             "Timed out navigating to the selected Send button.",
         );
     } finally {
         if (!sent) {
             await sendTabCloseMenu();
         }

         sendTabBusy = false;
     }
 }


 //─────────────────────────────────────────────────────────────
 // ts — Show Glide's native device picker
 //─────────────────────────────────────────────────────────────

 safeDel("normal", "ts");

 glide.keymaps.set("normal", "ts", async ({ tab_id }) => {
     let devices = sendTabGetDevices();

     // On first startup Firefox may not have generated
     // its device list yet.
     if (!devices.length) {
         try {
             await sendTabOpenAccountMenu();

             for (
                 let i = 0;
                 i < 100 && !devices.length;
                 i++
             ) {
                 await sendTabPause(50);
                 devices = sendTabGetDevices();
             }
         } finally {
             await sendTabCloseMenu();
         }
     }

     if (!devices.length) {
         throw new Error(
             "No Firefox Sync Send Tab devices found.",
         );
     }

     const rank = (name: string): number => {
         const index =
             sendTabDeviceOrder.indexOf(name);

         return index < 0
             ? Number.MAX_SAFE_INTEGER
             : index;
     };

     const ordered = [...devices].sort(
         (a, b) =>
             rank(a.name) - rank(b.name) ||
             a.index - b.index
     );

     const counts = new Map<string, number>();

     for (const device of devices) {
         counts.set(
             device.name,
             (counts.get(device.name) ?? 0) + 1,
         );
     }

     const choices = ordered.map(device => {
         const base =
             sendTabAliases[device.name] ??
             String(device.index + 1);

         const alias =
             (counts.get(device.name) ?? 0) > 1
                 ? `${base}${device.occurrence}`
                 : base;

         return {
             device,
             alias,
         };
     });

     await glide.commandline.show({
         title: "Send current tab to device",

         options: choices.map(choice => ({
             label:
                 `${choice.alias} — ${choice.device.name}`,

             description:
                 `Firefox device ${choice.device.index + 1}`,

             matches({ input }) {
                 const query =
                     input.trim().toLowerCase();

                 if (!query) {
                     return true;
                 }

                 // Exact shorthand takes priority.
                 if (
                     choices.some(item =>
                         item.alias.toLowerCase() === query
                     )
                 ) {
                     return (
                         choice.alias.toLowerCase() ===
                         query
                     );
                 }

                 return (
                     choice.alias
                         .toLowerCase()
                         .startsWith(query) ||
                     choice.device.name
                         .toLowerCase()
                         .includes(query)
                 );
             },

             execute() {
                 void sendTabSend(
                     choice.device,
                     tab_id,
                 ).catch(error => {
                     console.error(
                         "[SendTab]",
                         error,
                     );
                 });
             },
         })),
     });
 }, {
     description: "Send current tab to Firefox Sync device",
 });


//F. tcc - Clear current site cookies and data using Firefox's native UI
//Source: Me & ChatGPT

safeDel("normal", "tcc");

glide.keymaps.set("normal", "tcc", async ({ tab_id }) => {
    const pause = (ms: number) =>
        new Promise<void>(resolve => setTimeout(resolve, ms));

    const press = (key: string) =>
        glide.keys.send(key, { skip_mappings: true });

    const panelIsOpen = () =>
        document.getElementById(
            "trust-icon-container",
        )?.hasAttribute("open") ?? false;

    const isDisabled = (element: Element) =>
        element.hasAttribute("disabled") &&
        element.getAttribute("disabled") !== "false";

    let completed = false;

    try {
        //──────────────────────────────────────────────────────
        // 1. Open Firefox's shield panel
        //──────────────────────────────────────────────────────

        glide.hints.show({
            location: "browser-ui",
            selector: "#trust-icon-container",
            auto_activate: true,
        });

        let panelReady = false;

        for (let i = 0; i < 50; i++) {
            const popup = document.getElementById(
                "trustpanel-popup",
            );

            if (panelIsOpen() && popup) {
                panelReady = true;
                break;
            }

            await pause(40);
        }

        if (!panelReady) {
            console.warn(
                "[tcc] Trust panel did not open.",
            );
            return;
        }

        await pause(120);

        //──────────────────────────────────────────────────────
        // 2. Locate the Clear Cookies button
        //──────────────────────────────────────────────────────

        const clearButton = document.getElementById(
            "trustpanel-clear-cookies-button",
        );

        if (!clearButton) {
            console.warn(
                "[tcc] Clear Cookies button not found.",
            );
            return;
        }

        if (isDisabled(clearButton)) {
            console.log(
                "[tcc] No site data available to clear.",
            );
            return;
        }

        let clearFocused = false;

        const onClearFocus = () => {
            clearFocused = true;
        };

        clearButton.addEventListener(
            "focus",
            onClearFocus,
            true,
        );

        try {
            // Navigate by button identity, not position.
            for (let i = 0; i < 15; i++) {
                if (!panelIsOpen()) {
                    console.warn(
                        "[tcc] Trust panel closed.",
                    );
                    return;
                }

                clearFocused = false;

                await press("<Down>");
                await pause(80);

                if (clearFocused) {
                    console.log(
                        `[tcc] Found Clear Cookies after ${i + 1} Down presses.`,
                    );
                    break;
                }
            }

            if (!clearFocused || isDisabled(clearButton)) {
                console.warn(
                    "[tcc] Clear Cookies could not be selected.",
                );
                return;
            }

            //──────────────────────────────────────────────────
            // 3. Prepare to observe the final Clear button
            //──────────────────────────────────────────────────

            const confirmView = document.getElementById(
                "trustpanel-clearcookiesView",
            );

            const confirmButton = document.getElementById(
                "trustpanel-clear-cookie-clear",
            );

            if (!confirmView || !confirmButton) {
                console.warn(
                    "[tcc] Confirmation controls not found.",
                );
                return;
            }

            let confirmFocused = false;

            const onConfirmFocus = () => {
                confirmFocused = true;
                console.log(
                    "[tcc] Final Clear button focused!",
                );
            };

            // Register before opening the confirmation
            // so we don't miss an initial focus event.
            confirmButton.addEventListener(
                "focus",
                onConfirmFocus,
                true,
            );

            try {
                //──────────────────────────────────────────────
                // 4. Open the confirmation screen
                //──────────────────────────────────────────────

                await press("<Enter>");
                await pause(200);

                if (!panelIsOpen()) {
                    console.warn(
                        "[tcc] Confirmation panel closed unexpectedly.",
                    );
                    return;
                }

                //──────────────────────────────────────────────
                // 5. Find the final Clear button
                //──────────────────────────────────────────────

                for (
                    let i = 0;
                    i < 6 && !confirmFocused;
                    i++
                ) {
                    if (!panelIsOpen()) {
                        console.warn(
                            "[tcc] Trust panel closed.",
                        );
                        return;
                    }

                    await press("<Down>");
                    await pause(80);
                }

                if (!confirmFocused) {
                    console.warn(
                        "[tcc] Final Clear button was not reached.",
                    );
                    return;
                }

                if (isDisabled(confirmButton)) {
                    console.warn(
                        "[tcc] Final Clear button is disabled.",
                    );
                    return;
                }

                //──────────────────────────────────────────────
                // 6. Execute Firefox's native Clear action
                //──────────────────────────────────────────────

                // Make sure we're still on the original tab.
                const active = await glide.tabs.active();

                if (active.id !== tab_id) {
                    console.warn(
                        "[tcc] Active tab changed. Cancelled.",
                    );
                    return;
                }

                await press("<Enter>");

                // Wait until Firefox dismisses the panel.
                let panelClosed = false;

                for (let i = 0; i < 50; i++) {
                    if (!panelIsOpen()) {
                        panelClosed = true;
                        break;
                    }

                    await pause(40);
                }

                if (!panelClosed) {
                    console.warn(
                        "[tcc] Clear action did not close the panel.",
                    );
                    return;
                }

                completed = true;

                console.log(
                    "[tcc] Firefox's native Clear action activated.",
                );

                //──────────────────────────────────────────────
                // 7. Reload the original tab
                //──────────────────────────────────────────────

                // Give Firefox's asynchronous site-data
                // removal a chance to proceed.
                await pause(700);

                if ((await glide.tabs.active()).id === tab_id) {
                    await browser.tabs.reload(tab_id);

                    console.log(
                        "[tcc] Reloaded current tab.",
                    );
                }

            } finally {
                confirmButton.removeEventListener(
                    "focus",
                    onConfirmFocus,
                    true,
                );
            }

        } finally {
            clearButton.removeEventListener(
                "focus",
                onClearFocus,
                true,
            );
        }

    } catch (error) {
        console.error("[tcc] Failed:", error);

    } finally {
        //──────────────────────────────────────────────────────
        // 8. Close the panel if anything failed
        //──────────────────────────────────────────────────────

        if (!completed && panelIsOpen()) {
            try {
                await press("<Esc>");

                console.log(
                    "[tcc] Cancelled. Closed panel with Esc.",
                );
            } catch (error) {
                console.warn(
                    "[tcc] Could not close panel:",
                    error,
                );
            }
        }
    }
}, {
    description: "Clear current website cookies and site data",
});

//E. tb - Move current tab to bottom of tab list
//Source: ChatGPT

safeDel("normal", "tb");

glide.keymaps.set("normal", "tb", async ({ tab_id }) => {
    await browser.tabs.move(tab_id, { index: -1 });
}, {
    description: "Move current tab to bottom",
});


//7. Focus the largest scrollable element on the page
//Source: ChatGPT

glide.keymaps.set(
    "normal",
    "u",
    ({ tab_id }) =>
        focusLargestScrollable(tab_id),
);

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


//8. Search in a text field containing someone's first and last name for there full name, just their first and just their last
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

  });


//9. Show hints only for Outlook Safe Links and copy the decoded URL with ys in normal mode.
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


//10. Open the copied url in virustotal.com
//Source: ChatGPT (hardening: Me (claude-fable-5.1-max))
subMenu("1", {
    u: {
        description: "Scan clipboard URL with VirusTotal",

        action: async () => {
            const url = await readClipboardURL();

            // Open VirusTotal. The URL is a query *parameter*, so it has to be
            // encoded - otherwise any ?, & or # in it breaks the search.
            await browser.tabs.create({
                url: `https://www.virustotal.com/gui/search?query=${encodeURIComponent(url)}`,
            });
        },
    },
});


//11. Open clipboard contents in a new tab
//Source: ChatGPT (hardening: Me (claude-fable-5.1-max))
subMenu("1", {
    o: {
        description: "Open clipboard in a new tab",

        action: async () => {
            const url = await readClipboardURL();

            await browser.tabs.create({
                url,
            });
        },
    },
});



//General Keybind Mapping/Re-mapping

//Re-map Alt h and l to leader h and leader l
//Source: pretty much the official docs, since I gave them to ChatGPT and it just replaced what I wanted with what they had as an example
//1. Remove old Alt h and l mappings
safeDel("normal", "<A-h>");
safeDel("normal", "<A-l>");
//2. Add new leader h and l mappings
glide.keymaps.set("normal", "<leader>h", "back");
glide.keymaps.set("normal", "<leader>l", "forward");

//Re-map <C-o> and <C-i> to <leader>o and <leader>i
//Source: Me qc
//1. Remove og <C-o> and <C-i> mapping
safeDel("normal", "<C-o>");
safeDel("normal", "<C-i>");
//2. Add new <leader>o mapping
glide.keymaps.set("normal", "<leader>o", "jumplist_back");
glide.keymaps.set("normal", "<leader>i", "jumplist_forward");

//Make so just + and - by themselves adjust zoom level in normal mode
//Source: Me
//1. Set = and - to Ctrl + and Ctrl Shift _ in normal mode
//Note: It apears that "-" cannot be used in <C-->, and there is not an alias listed in the docs that I could see. (<C-"-"> also does not work)
  glide.keymaps.set("normal", "=", async () => {
    await glide.keys.send("<C-=>");
  });

  glide.keymaps.set("normal", "-", async () => {
    await glide.keys.send("<C-S-_>");
  });

//Map yl to yank the current tab URL to clipboard
//Source: Me
glide.keymaps.set("normal", "yl", "url_yank");

//Map <leader> + p in normal mode to toggle pin tab
//Source: Me
safeDel("normal", "<A-p>");
glide.keymaps.set("normal", "<leader>p", "tab_pin_toggle");

//Map Leader s to Shift F10 to open the browser context/autocorrect spelling menu
//Note: Only works on my Keycron C3 Pro, where I have F3 mapped to the macro Shift + F10, since <S-F10> doesn't work in glide for some reason
//Note to the Note: When the Glide is sent F3 from glide.keys.send, it doesn't count the Keycrons keybindings, since the physical keyboard isn't actually whats sending the keys qd.
//So just use F3 from the keyboard for now
//Source: Me and ChatGPT (To find the keybind)
//    glide.keymaps.set("normal", "<leader>s", async () => {
//      await glide.keys.send("<Apps>");
//    });

//Map Shift + u to Ctrl + z in normal mode
//For when simple u in normal mode doesn't undo
  glide.keymaps.set("normal", "U", async () => {
    await glide.keys.send("<C-z>");
  });

//Map leader + n to new tab
//Source: Me
glide.keymaps.set("normal", "<leader>n", "tab_new");

//Map leader + c to reload config
//Source: Me
glide.keymaps.set("normal", "<leader>c", "config_reload");

//Map leader + C to edit config
//Source: Me
glide.keymaps.set("normal", "<leader>C", "config_edit");




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
    "*",
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
            await glide.keys.send(
                "<S-Enter>",
                {
                    skip_mappings: true,
                },
            );
        });


        //──────────────────────────────────────────────────────
        // Ctrl+Enter → Send, then Normal + focus chat
        //──────────────────────────────────────────────────────

        glide.buf.keymaps.set("insert", "<C-Enter>", async ({ tab_id }) => {
            await safeEnterSend(
                hostname,
            );

            await glide.excmds.execute(
                "mode_change normal",
            );

            await focusLargestScrollable(
                tab_id,
            );
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
            await safeEnterSend(
                hostname,
            );
        });
    },
);


//3. Custom Keybinds

//A. Outlook (outlook.cloud.microsoft, outlook.office.com)
//
// These are buffer-local mappings (glide.buf.keymaps). Glide clears them
// itself on every URL change, so no cleanup function is needed and there is
// no window in which a late cleanup can delete freshly re-registered mappings.
glide.autocmds.create(
  "UrlEnter",
  /^https:\/\/outlook\.(office\.com|cloud\.microsoft)\//,

//a. Toggle through area fields/reagions with ( and )
//Source: ChatGPT
//Note: Gets messed up when your regular tab field is on something (resting state is not on anything, and that is what you want to have for this command to successfully change your focus
  async () => {

  glide.buf.keymaps.set("normal", ")", async () => {
    await glide.keys.send("<C-F6>");
  });

  glide.buf.keymaps.set("normal", "(", async () => {
    await glide.keys.send("<C-S-F6>");
  });

//b. Select the autocorrected word from the Alt Down Arrow menu with Shift J in normal mode
//Source: Me
  glide.buf.keymaps.set("normal", "<S-j>", async () => {
    await glide.keys.send("<A-Down>");
  });


//──────────────────────────────────────────────────────────────
// Outlook Auto Add Categories Engine
//──────────────────────────────────────────────────────────────

// Set order tags are applied relative to their structure in the string
const reverse = false;

const outlookCategories: Record<string, string[]> = {

    // Spam
    s: [
        "Not Phishing",
        "spam",
    ],

    // KnowBe4
    k: [
        "Not Phishing",
        "KnowBe4",
    ],

    // Fairmount
    f: [
        "Not Phishing",
        "Fairmount",
    ],

    // Not Phishing
    n: [
        "Not Phishing",
    ],

	// Not Phishing, Returned
    r: [
        "Not Phishing",
		"Returned",
    ],

};

glide.buf.keymaps.set("normal", "<S-!>", async () => {

    // Wait for the category key.
    const key = (await glide.keys.next()).glide_key;

    const tags = outlookCategories[key];

    // Unknown shortcut.
    if (!tags) {
        return;
    }

    await glide.excmds.execute("mode_change insert");

    // Open the Categories dialog.
    await glide.keys.send("q");
    await glide.keys.send("c");

    await new Promise(resolve => setTimeout(resolve, 100));

    // Choose the order in which the tags will be added.
    const tagsToAdd = reverse
        ? [...tags].reverse()
        : tags;

    // Add every tag.
    for (let i = 0; i < tagsToAdd.length; i++) {

        const tag = tagsToAdd[i];

        await glide.keys.send(tag);
        await glide.keys.send("<Enter>");

        // If there are more tags to enter,
        // clear the search box.
        if (i < tagsToAdd.length - 1) {
            await glide.keys.send("<C-a>");
            await glide.keys.send("<Backspace>");
        }

    }

    await glide.keys.send("<Esc><Esc>");
});


//Let Shift + 2 clear two categorys from an email
  glide.buf.keymaps.set("normal", "<S-@>", async () => {
    await glide.excmds.execute("mode_change insert");
    await glide.keys.send("c");
    await new Promise(resolve => setTimeout(resolve, 50));
    await glide.keys.send("<Esc>");
    await glide.keys.send("<Up>");
    await glide.keys.send("<Enter>");
  });
});


//C. Super Productivity
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
                enterPressed = true;

                await glide.keys.send(
                    "<Enter>",
                    {
                        skip_mappings: true,
                    },
                );
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

});
