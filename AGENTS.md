# Documentation Contract

This repository is intentionally documented as a living configuration, not as a static snapshot.

**If you are an AI agent working in this repository:** documentation is part of the implementation.
Do not add a user-facing Glide feature without documenting it in `README.md` in the same change.

## Required When Changing `glide.ts`

Whenever you add, remove, rename, or materially change a user-facing feature in `glide.ts`, update
`README.md` in the same change.

- Add or revise the relevant entry in **Full feature list (as of the current commit)**.
- Keep the feature's keybinding, mode, and behaviour accurate.
- Add or update its **View in `glide.ts`** link, pinned to the commit documented by the README.
- Update the relevant headline-feature explanation when the change is important enough to affect how
  someone understands or uses the config.
- Update the snippet count, supported-site lists, storage limits, or other stated numbers whenever the
  implementation changes them.
- If a feature is removed, remove its README entry rather than leaving a historical claim behind.

## Required When Changing Setup

If a change affects installation, config location, `local.ts`, `config_init`, `config_path`, or reload
behaviour, update the **Install** section and keep the macOS, Linux, and Windows command/GUI paths in
sync.

## Verification

Before finishing a documentation change:

1. Check every source link against the referenced commit and line.
2. Confirm every command block is copyable in the README preview.
3. Build the preview application with `npm run build` from the project root.

Do not modify `glide.d.ts`: Glide generates it automatically.