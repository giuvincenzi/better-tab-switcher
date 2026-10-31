# Data and compatibility

- The settings are saved with WXT's storage (`storage.defineItem` with a version), which **migrates** them, and
  validated by `parseSettings` when they are read. When the settings format or a default changes for
  existing users, bump the settings' schema version and add the migration, with a test on old data. Never break existing
  user data. New installs get the defaults; existing settings keep theirs.
- A new setting's value for existing users is the user's decision: the new default (no migration) or the old behavior
  (a migration). The plan says which.
- A new meaning gets a new value, never a changed meaning of an existing one: an older version reading the data still
  understands what it knows.
- A value the extension does not know (a newer version's value, a damaged one) gives that setting its default instead of
  failing all the settings.
- **Each kind of data has its own keeping rule, written here; a new kind of data gets its rule decided with the user
  and written here in the same pull request.** Where a limit is a size, the oldest entries go first and the newest one
  always stays.

  | What | Where | Kept |
  |---|---|---|
  | Settings | the extension's storage | until the user changes them or removes the extension |
  | Previews of the tabs | `storage.session`: in memory, never on disk | until the tab closes, the grid shows icons, or Chrome closes; they always leave room in that memory for the switcher's state |
  | The switcher's state (where it is open, the pages it is in) | `storage.session`: in memory, never on disk | until Chrome closes |
