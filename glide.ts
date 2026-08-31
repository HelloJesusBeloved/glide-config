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
    `tab_new about:blank`
	);

    await new Promise(resolve => setTimeout(resolve, 100));

    await glide.keys.send("<C-l>");
    await glide.keys.send(query);
    await glide.keys.send("<Enter>");
  },
);


//4. Hint Tabs, Tab Groups, and the New Tab button with <leader>n
//Source: ChatGPT and Me
glide.keymaps.set("normal", "<leader>n", () => {
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

//yy remapped to copy current line to clipboard in normal mode
glide.keymaps.del("normal", "yy");

glide.keymaps.set("normal", "yy", async () => {
    await glide.keys.send("<Home>");
    await glide.keys.send("<S-End>");
    await glide.keys.send("<C-c>");
    await glide.keys.send("<Right>");

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
glide.keymaps.del("normal", "<S-g>");
glide.keymaps.del("normal", "gg");

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

//b. Make gg and shift + g actually select to the bottom or top in visual mode
  glide.keymaps.set("visual", "<S-g>", async () => {
    await glide.keys.send("<C-S-End>");
  });

  glide.keymaps.set("visual", "gg", async () => {
    await glide.keys.send("<C-S-Home>");
  });

//c. Make <leader>v turn on caret browsing
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


//Search in a text field containing someone's first and last name for there full name, just their first and just their last
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



//General Keybind Mapping/Re-mapping

//Re-map Alt h and l to leader h and leader l
//Source: pretty much the official docs, since I gave them to ChatGPT and it just replaced what I wanted with what they had as an example
//1. Remove old Alt h and l mappings
glide.keymaps.del("normal", "<A-h>");
glide.keymaps.del("normal", "<A-l>");
//2. Add new leader h and l mappings
glide.keymaps.set("normal", "<leader>h", "back");
glide.keymaps.set("normal", "<leader>l", "forward");

//Re-map <C-o> and <C-i> to <leader>o and <leader>i
//Source: Me qc
//1. Remove og <C-o> and <C-i> mapping
glide.keymaps.del("normal", "<C-o>");
glide.keymaps.del("normal", "<C-i>");
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

//Set F4 to Esc so that caps lock at work on my Keycron C3 Pro it will act as Esc (since I have it set to F4 so I can use it with Alt to close windows)
//Source: Me
  glide.keymaps.set(["normal", "visual", "insert"], "<F4>", async () => {
	await glide.keys.send("<Esc>");
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




//Per Website Settings


//1. Websites to Ignore
const ignoreSites: string[] = [

    "10.0.1.108",
    "100.124.253.95",

    "vim-editor-online.vercel.app",
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


//2. Websites to enter insert mode when first visited
const insertSites: string[] = [

    "app.super-productivity.com",
    "youtube.com",

];

// Automatically enter Insert mode on these sites.
glide.autocmds.create(
    "UrlEnter",
    new RegExp(
        "^https?://([^/]*\\.)?(" +
        insertSites
            .map(site =>
                site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            )
            .join("|") +
        ")(/|:|$)"
    ),
    async () => {

        await glide.excmds.execute("mode_change insert");

        return () =>
            glide.excmds.execute("mode_change normal");

    }
);


//2. Custom Keybinds

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


//B. ChatGPT
//Aria Labels:
//aria-label="Send prompt" - Sends the prompt
//aria-label="Stop answering" - Stop the prompt mid response

glide.autocmds.create("UrlEnter", {
    hostname: "chatgpt.com",
}, async () => {

    glide.buf.keymaps.set(
        "normal",
        "<Enter>",
        async ({ tab_id }) => {

            await clickElement(
                tab_id,
                'button[aria-label="Send prompt"]',
                'button[aria-label="Stop answering"]',
                'div.flex.flex-wrap.justify-end button:last-child',
            );

            await focusLargestScrollable(tab_id);

        },
    );

});



//Applications


//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 2.0
// Keyword Expansion - type qew<space> -> Expands to crying emoji
// Note: Does not work everywhere yet, if it doesn't work use 
// Snippet Engine 1.0 (Mapped to <C-e> (Ctrl + e) in insert mode
// then qew<space>
//
// Configuration
//──────────────────────────────────────────────────────────────

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
        qshrugg: "¯\\_(ツ)_/¯",
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
    },

    // Keys that trigger snippet expansion.
    triggerKeys: [
        "<Space>",
        ".",
    ],

    // Cached lookup data.
    snippetKeys: [] as string[],
    triggerKeySet: new Set<string>(),

    // Length of the longest snippet trigger.
    maxSnippetLength: 0,

    // Rolling buffer of recently typed characters.
    buffer: "",

    // Prevent multiple listener loops.
    running: false,

};



//──────────────────────────────────────────────────────────────
// Initialization
//──────────────────────────────────────────────────────────────

// Initialize snippet lookup cache.
SnippetEngine.snippetKeys =
    Object.keys(SnippetEngine.snippets);

// Initialize trigger key lookup cache.
SnippetEngine.triggerKeySet =
    new Set(SnippetEngine.triggerKeys);

// Compute the maximum buffer length needed.
SnippetEngine.maxSnippetLength =
    Math.max(
        ...SnippetEngine.snippetKeys.map(k => k.length),
    );



//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 2.0
// Helper Functions
//──────────────────────────────────────────────────────────────

//1.
//Replace text in an INPUT or TEXTAREA element.
async function replaceInput(
    tab_id: number,
    deleteCount: number,
    replacement: string,
) {

    return await glide.content.execute(
        (deleteCount, replacement) => {

            const active = document.activeElement;

            if (
                !(active instanceof HTMLInputElement) &&
                !(active instanceof HTMLTextAreaElement)
            ) {
                return false;
            }

            const start = active.selectionStart ?? 0;
            const end = active.selectionEnd ?? start;

            active.setRangeText(
                replacement,
                Math.max(0, start - deleteCount),
                end,
                "end",
            );

            return true;

        },
        {
            tab_id,
            args: [deleteCount, replacement],
        },
    );

}


//2.
// Replace text in a contenteditable editor.
async function replaceContentEditable(
    tab_id: number,
    typedSnippet: string,
    replacement: string,
): Promise<boolean> {

    return await glide.content.execute(

        (typedSnippet, replacement) => {

            const selection = window.getSelection();

            if (!selection || selection.rangeCount === 0) {
                return false;
            }

            if (selection.rangeCount === 0) {
                return false;
            }

            const range = selection.getRangeAt(0);

            if (!(range.startContainer instanceof Text)) {
                return false;
            }

            const text = range.startContainer.data;

            // Find the last occurrence of the snippet before the cursor.
            const start = text.lastIndexOf(
                typedSnippet,
                range.startOffset,
            );

            if (start === -1) {
                return false;
            }

            range.setStart(
                range.startContainer,
                start,
            );

            range.deleteContents();

            document.execCommand(
                "insertText",
                false,
                replacement,
            );

            return true;

        },

        {
            tab_id,
            args: [typedSnippet, replacement],
        },

    );

}



//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 2.0
// Dispatcher
//──────────────────────────────────────────────────────────────

// Replace the previously typed text in the active editor.
async function replacePreviousText(
    tab_id: number,
    typedSnippet: string,
    replacement: string,
): Promise<boolean> {

    const editorType = await glide.content.execute(() => {

        const active = document.activeElement;

        if (
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement
        ) {
            return "input";
        }

        if (active?.isContentEditable) {
            return "contenteditable";
        }

        return "unknown";

    }, {
        tab_id,
    });

    switch (editorType) {

        case "input":
            return await replaceInput(
                tab_id,
                typedSnippet.length,
                replacement,
            );

        case "contenteditable":
            return await replaceContentEditable(
				tab_id,
				typedSnippet,
				replacement,
			);

        default:
            return false;

    }

}



//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 2.0
// Buffer Helpers
//──────────────────────────────────────────────────────────────

// Append a key to the rolling buffer.
function appendToBuffer(key: string): void {

    SnippetEngine.buffer += key;

    // Keep only the longest possible snippet.
    SnippetEngine.buffer =
        SnippetEngine.buffer.slice(
            -SnippetEngine.maxSnippetLength,
        );

}

// Clear the rolling buffer.
function clearBuffer(): void {

    SnippetEngine.buffer = "";

}

// Return the matching snippet, if one exists.
function findSnippet(): string | null {

    return SnippetEngine.snippets[
        SnippetEngine.buffer
    ] ?? null;

}

// Return true if the key should trigger expansion.
function isTriggerKey(key: string): boolean {

    return SnippetEngine.triggerKeySet.has(key);

}



//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 2.0
// Listener
//──────────────────────────────────────────────────────────────

// Start the snippet engine.
async function runSnippetEngine() {

    if (SnippetEngine.running) {
        return;
    }

    SnippetEngine.running = true;

    while (true) {

        const event = await glide.keys.next_passthrough();

		const key = event.glide_key;

        // Trigger key?
        if (isTriggerKey(key)) {

            const snippet = findSnippet();

            if (snippet) {

                const tab = await glide.tabs.active();

				await new Promise(resolve => setTimeout(resolve, 0));

                await replacePreviousText(
					tab.id,
					SnippetEngine.buffer,
					snippet,
				);
            }

            clearBuffer();
            continue;

        }

        // Ignore special keys.
        if (key.startsWith("<")) {
            continue;
        }

        appendToBuffer(key);

    }

}

runSnippetEngine();




//──────────────────────────────────────────────────────────────
// Glide Snippet Engine 1.0
// Manual snippet expansion (<C-e>)
//──────────────────────────────────────────────────────────────


// Insert text at the cursor without deleting anything.
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


glide.keymaps.set("insert", "<C-e>", async ({ tab_id }) => {

    let typed = "";

    while (true) {

        const key = (await glide.keys.next()).glide_key;

		// A configured trigger key confirms the snippet.
		if (
			SnippetEngine.triggerKeySet.has(key)
		) {

            const snippet =
                SnippetEngine.snippets[typed];

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
