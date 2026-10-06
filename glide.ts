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

interface SubMenuItem {A
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

    const hostname = glide.ctx.url.hostname.toLowerCase();

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
        glide.keymaps.set(
            "normal",
            `${prefix}${key}`,
            async () => {
                if (!websiteMatches(item.websites)) {
                    return;
                }

                await item.action();
            },
            {
                description: item.description,
            },
        );
    }
}


//5. Normalize and validate a web URL
//Source: ChatGPT
//
//Examples:
// https://apple.com → valid
// http://apple.com → valid
// apple.com → becomes https://apple.com
// www.apple.com/foo → becomes https://www.apple.com/foo
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

        // Require a hostname that looks like a real domain.
        if (!url.hostname.includes(".")) {
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


//7. Check whether the visual-mode cursor is between the first and second
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
async function isBetweenFirstTwoWordCharacters(
    tab_id: number,
): Promise<boolean> {
    return await glide.content.execute(
        () => {
            const selection = window.getSelection();

            if (!selection || selection.rangeCount === 0) {
                return false;
            }

            const focusNode = selection.focusNode;
            const focusOffset = selection.focusOffset;

            if (!focusNode) {
                return false;
            }

            // Find the nearest element containing the selection.
            //
            // Normally this will be the page body or an element inside it.
            // Using the common ancestor lets this work inside things such
            // as articles, contenteditable areas, etc.
            const container =
                focusNode.nodeType === Node.ELEMENT_NODE
                    ? (focusNode as Element)
                    : focusNode.parentElement;

            if (!container) {
                return false;
            }

            // Create a range representing everything before the actual
            // selection focus.
            const beforeRange = document.createRange();

            try {
                beforeRange.selectNodeContents(container);
                beforeRange.setEnd(focusNode, focusOffset);
            } catch {
                return false;
            }

            // Create a range representing everything after the actual
            // selection focus.
            const afterRange = document.createRange();

            try {
                afterRange.selectNodeContents(container);
                afterRange.setStart(focusNode, focusOffset);
            } catch {
                return false;
            }

            const beforeText = beforeRange.toString();
            const afterText = afterRange.toString();

            // We need at least two characters before the caret:
            //
            //   [word start][first letter][caret]
            //
            // However, because the container may begin immediately at the
            // caret, also handle the case where there is only one character
            // before the caret.
            const previous = beforeText.at(-1);
            const previousPrevious = beforeText.at(-2);
            const next = afterText.at(0);

            if (!previous || !next) {
                return false;
            }

            // Vim's normal "word" characters.
            const isWordCharacter = (char: string) =>
                /[A-Za-z0-9_]/.test(char);

            // We are looking for:
            //
            //   <word character> <word character>
            //   ^first            ^caret
            //
            // where the character before the first character is NOT a
            // word character.
            //
            // Example:
            //
            //   hello
            //    ^
            //
            // beforeText ends in "h"
            // previous = "h"
            // previousPrevious = whitespace/start
            // next = "e"
            return (
                isWordCharacter(previous) &&
                isWordCharacter(next) &&
                (!previousPrevious ||
                    !isWordCharacter(previousPrevious))
            );
        },
        { tab_id },
    );
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


//4. Hint Tabs, Tab Groups, and the New Tab button with <leader>n
//Source: ChatGPT and Me
glide.keymaps.set("normal", "<leader>F", () => {
    glide.hints.show({
        location: "browser-ui",
        selector: ".tabbrowser-tab, .tab-group-label, #tabs-newtab-button.toolbarbutton-1",
    });
});


//5. Adding more vim motions dw, db, d$, d0, yy, p
//Source: Me

//dw
glide.keymaps.set("op-pending", "w", async () => {
    await glide.keys.send("<Left>");
    await glide.keys.send("<C-Delete>");
	await glide.keys.send("<Right>");
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

//dd - Delete the current line, including the newline
//Source: ChatGPT
safeDel("normal", "dd");
safeDel("op-pending", "d");

glide.keymaps.set("op-pending", "d", async () => {
    try {
        await glide.keys.send(
            "<Home><S-End><Delete><Delete>",
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
// The actual browser cursor is effectively positioned to the right of the
// vim style cursor. That puts the cursor between the first and second letter
// of the word when using w in visual mode, so this moves back one character
// at the beggining of the word before extending the selection with Ctrl+Right.
safeDel("visual", "w");
glide.keymaps.set("visual", "w", async ({ tab_id }) => {
    if (await isBetweenFirstTwoWordCharacters(tab_id)) {
        await glide.keys.send("<Left>");
    }
    await glide.keys.send("<C-S-Right>");
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
            "<End><Enter>",
            {
                skip_mappings: true,
            },
        );
    },
    {
        description: "Open new line below",
    },
);


//6. Set the current tab's wake lock to on (make's so the computer doesn't sleep)
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


//7. Focus the largest scrollable element on the page
//Source: ChatGPT

glide.keymaps.set(
    "normal",
    "e",
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
//Source: ChatGPT
subMenu("1", {
    u: {
        description: "Scan clipboard URL with VirusTotal",

        action: async () => {
            const clipboard = await navigator.clipboard.readText();
            const url = normalizeURL(clipboard);

            if (!url) {
                glideError("Clipboard does not contain a valid URL.");
            }

            // Open VirusTotal.
            await browser.tabs.create({
                url: `https://www.virustotal.com/gui/search?query=${url}`,
            });
        },
    },
});


//11. Open clipboard contents in a new tab
//Source: ChatGPT
subMenu("1", {
    o: {
        description: "Open clipboard in a new tab",

        action: async () => {
            const clipboard = await navigator.clipboard.readText();

            await browser.tabs.create({
                url: clipboard,
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
const ignoreSites: string[] = [

    "10.0.1.108",
    "100.124.253.95",

    "vim-editor-online.vercel.app",

    "console.tailscale.com/admin/machines/ssh-reauth-complete"
];

// Turn on ignore mode for matching sites.
glide.autocmds.create(
    "UrlEnter",
    new RegExp(
        ignoreSites
            .map(site => site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|")
    ),
    async () => {

        await glide.excmds.execute("mode_change ignore");

        return () => glide.excmds.execute("mode_change normal");

    },
);


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


function ignoredSiteMatches(
    url: string,
): boolean {
    return ignoreSites.some((site) =>
        url.includes(site)
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
// URL changes
//──────────────────────────────────────────────────────────────

glide.autocmds.create(
    "UrlEnter",
    /^https?:\/\/.+/,
    async ({ url }) => {
        pendingInsertEscape = false;
        transientReturnState = null;
        hintEscapePressed = false;

        insertPreferredState = "insert";


        // Ignore sites always take priority.
        if (ignoredSiteMatches(url)) {
            insertPreferredSite = false;

            return;
        }


        insertPreferredSite =
            insertPreferredHostnameMatches(url);


        if (!insertPreferredSite) {
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
//
// All configured sites:
//
//     Insert Enter
//         → Shift+Enter
//         → New line instead of accidentally sending.
//
// Most sites:
//     Ctrl+Enter is left untouched so the website can use its
//     native Ctrl+Enter send behavior.
//
// Override sites:
//     Ctrl+Enter
//         → Enter
//
//     Use this for sites where Ctrl+Enter does NOT natively send,
//     but regular Enter does.
//
// Source: Me & ChatGPT


//──────────────────────────────────────────────────────────────
// Sites with native Ctrl+Enter support
//──────────────────────────────────────────────────────────────
//
// These only need:
//
//     Enter → Shift+Enter
//
// Ctrl+Enter passes through untouched.
//──────────────────────────────────────────────────────────────

const safeEnterSites: string[] = [
    "chatgpt.com",
    "duck.ai",
    "grok.com",
    "claude.ai",
    "mistral.ai",
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
        // Optional Ctrl+Enter → Enter override
        //──────────────────────────────────────────────────────

        if (
            safeEnterSiteMatches(
                hostname,
                safeEnterCtrlOverrideSites,
            )
        ) {
            glide.buf.keymaps.set("insert", "<C-Enter>", async () => {
                await glide.keys.send(
                    "<Enter>",
                    {
                        skip_mappings: true,
                    },
                );
            });
        }
    },
);


//3. Custom Keybinds

//A. Outlook (outlook.cloud.microsoft, outlook.office.com)
glide.autocmds.create(
  "UrlEnter",
  /^https:\/\/outlook\.(office\.com|cloud\.microsoft)\//,

//a. Toggle through area fields/reagions with ( and )
//Source: ChatGPT
//Note: Gets messed up when your regular tab field is on something (resting state is not on anything, and that is what you want to have for this command to successfully change your focus
  async () => {

  glide.keymaps.set("normal", ")", async () => {
    await glide.keys.send("<C-F6>");
  });

  glide.keymaps.set("normal", "(", async () => {
    await glide.keys.send("<C-S-F6>");
  });

//b. Select the autocorrected word from the Alt Down Arrow menu with Shift J in normal mode
//Source: Me
  glide.keymaps.set("normal", "<S-j>", async () => {
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

};

glide.keymaps.set("normal", "<S-!>", async () => {

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
  glide.keymaps.set("normal", "<S-@>", async () => {
    await glide.excmds.execute("mode_change insert");
    await glide.keys.send("c");
	await new Promise(resolve => setTimeout(resolve, 50));
    await glide.keys.send("<Esc>");
    await glide.keys.send("<Up>");
    await glide.keys.send("<Enter>");
  });


//Set keybinds back to normal
  return () => {
    safeDel("normal", ")");
    safeDel("normal", "(");

	safeDel("normal", "<S-j>");

	safeDel("normal", "<S-!>");
	safeDel("normal", "<S-@>");
  };
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
