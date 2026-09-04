//Here I store valuable code blocks that I am not currently useing in my glide.ts, but want to keep for future use/reference

// Operating System Command Paths
const commands = {
    curl: {
        windows: "C:\\Windows\\System32\\curl.exe",
        linux: "/usr/bin/curl",
        macos: "/usr/bin/curl",
    },

    // Add more commands here as we need them.
    //
    // git: {
    //     windows: "C:\\Program Files\\Git\\cmd\\git.exe",
    //     linux: "/usr/bin/git",
    //     macos: "/usr/bin/git",
    // },
};


//Run a configured Operating System Command Path
//Source: ChatGPT
//
//Examples: runCommand("git", ["fetch"]);
// await runCommand("curl", [
//                     "-i",
//                     "-X", "POST",
//                     "https://urlquery.net/api/htmx/submit/url",
//                     "-H", "HX-Request: true",
//                     "-H", "Referer: https://urlquery.net/",
//                     "-H", "Origin: https://urlquery.net",
//                     "--data-urlencode", `url=${url}`,
//                 ]);
				
async function runCommand(
    command: keyof typeof commands,
    args: string[],
) {
    const os = String(glide.ctx.os).toLowerCase();

    let executable: string;

    if (os.includes("win")) {
        executable = commands[command].windows;
    } else if (os.includes("mac")) {
        executable = commands[command].macos;
    } else {
        executable = commands[command].linux;
    }

    return await glide.process.execute(executable, args);
}