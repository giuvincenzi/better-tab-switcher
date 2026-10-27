# Data and compatibility

- The settings are saved with WXT's storage (`storage.defineItem`), which validates and **migrates** them when they are
  read. When the settings format or a default changes for
  existing users, bump the settings' schema version and add the migration, with a test on old data. Never break existing
  user data. New installs get the defaults; existing settings keep theirs.
- A value the extension does not know (a newer version's value, a damaged one) gives that setting its default instead of
  failing all the settings.
- **Each kind of data has its own keeping rule, written here; a new kind of data gets its rule decided with the user
  and written here in the same pull request.** Where a limit is a size, the oldest entries go first and the newest one
  always stays.

  | What | Where | Kept |
  |---|---|---|
  | Settings | the extension's storage | until the user changes them or removes the extension |
  | Previews of the tabs | `storage.session`: in memory, never on disk | until the tab closes, Previews is turned off or Chrome closes |
