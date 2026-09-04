//Here I store valuable code blocks that I am not currently useing in my glide.ts, but want to keep for future use/reference
//
//The first 3 work together in creating the functions neccessary to curl Urlquery's api, then stitch together the curled queue id with urlquery.net and opening a new tab with that queued link to view the sandbox, since I was not able to discover a way to encode the submitted url into the urlquery.net address like you can with VirusTotal. I moved it to here, out of the glide.ts, because Urlquery hadn't been working super consistently recently, and I realized VT also runs the submitted link through a browser sandbox anyway.


//1. Operating System Command Paths
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


//2. Run a configured Operating System Command Path
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

//3. Submit URL to URLQuery.

            // Submit the URL to URLQuery.
            let result;

            try {
                result = await runCommand("curl", [
                    "-i",
//curl progress bar "-sS",
                    "-X", "POST",
                    "https://urlquery.net/api/htmx/submit/url",
                    "-H", "HX-Request: true",
                    "-H", "Referer: https://urlquery.net/",
                    "-H", "Origin: https://urlquery.net",
                    "--data-urlencode", `url=${url}`,
                ]);
            } catch (error) {
                glideError(
                    `Could not run curl for urlquery: ${error}`,
                );
            }

            if (result.exit_code !== 0) {
                const stderr = await result.stderr.text();

                glideError(
                    `Urlquery submission failed (curl exit code ${result.exit_code}).${
                        stderr.trim() ? ` ${stderr.trim()}` : ""
                    }`,
                );
            }

            const response = await result.stdout.text();

            const redirect = response.match(
                /^Hx-Redirect:\s*(.+)$/im,
            )?.[1]?.trim();

            if (!redirect) {
                glideError(
                    `Urlquery did not return a queue URL.\n\n${response.trim()}`,
                );
            }

            await browser.tabs.create({
                url: new URL(
                    redirect,
                    "https://urlquery.net",
                ).toString(),
            });
