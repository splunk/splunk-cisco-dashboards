# Control app build profiles for Splunk App for Secure Networking

Keep app resources in source control and use the root `build.sh` to select the
resources for an installable package. This workflow lets you test unfinished
dashboards and Searchbase searches locally without including them in the
Splunkbase package.

## Daily commands

Use these commands from the repository root:

```bash
# Splunkbase package: excludes resources listed as developing
./build.sh

# Local package: released and developing resources
./build.sh --developer

# Fast local install from the current watcher-built stage
SPLUNK_HOME=/opt/10 ./build.sh --developer --fast --install --auth <user:password>
```

The commands shown in this topic do not restart Splunk Enterprise. If a
separate change requires a Splunk Enterprise restart, perform it manually
outside the Codex workflow.

The developer artifact is named
`dist/splunk-cisco-dashboards-<version>-developer.tar.gz`. The `-developer`
suffix distinguishes it from the Splunkbase artifact.

## Define developing resources

Developing resources are listed in
`packages/splunk-cisco-dashboards/config/build-profile-manifest.json`.
The manifest has two lists:

- `developing.views` contains dashboard view IDs.
- `developing.searchbaseStanzas` contains Searchbase stanza IDs.

Any resource not listed is released. Builds fail if a developing ID does not
match a source view or Searchbase stanza, or if an ID is listed more than once.

For example:

```json
{
    "developing": {
        "views": ["netops_catalyst_health"],
        "searchbaseStanzas": ["my_new_search"]
    }
}
```

Developing resources are included in the developer stage and package and
excluded from the Splunkbase package. Developing views are also excluded from
Splunkbase navigation.

Resources stay in their normal source locations for both profiles. Profile
filtering modifies only a temporary copy used to assemble a package, so source
files and the local development stage remain complete.

## Demote a released resource

To return a dashboard or Searchbase stanza to development, add its ID to the
matching list in `build-profile-manifest.json`:

```json
"views": ["netops_catalyst_health", "netops_health_monitoring"]
```

Do not move or delete its source, and do not edit navigation for a dashboard.
The build profile handles package and navigation filtering.

## Promote a resource to Splunkbase

1. Open
   `packages/splunk-cisco-dashboards/config/build-profile-manifest.json`.
2. Remove the resource ID from `developing.views` or
   `developing.searchbaseStanzas`. Its absence means released.
3. From `packages/splunk-cisco-dashboards`, run the app build profile test:

   ```bash
   yarn test:build-profile
   ```

4. From the repository root, run `./build.sh`.
5. Inspect the Splunkbase archive and confirm that it contains the promoted
   resource.

## Add a developing dashboard

1. Add the XML to
   `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views`.
2. Add its navigation entry to
   `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/nav/default.xml`.
3. Add the view ID to `developing.views`.
4. Run the profile test.

After adding the source and navigation entry, the manifest is the only file to
change when you demote or promote that dashboard.

## Add a developing Searchbase search

1. Add the search stanza to
   `packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf`.
2. Add the exact stanza ID to `developing.searchbaseStanzas` in
   `build-profile-manifest.json`.
3. Run `yarn test:build-profile`.
4. Use `./build.sh --developer` while you develop and test the search.

When the search is ready for Splunkbase, remove its ID from the manifest and
rerun the profile test. Its absence means released.

## Scope

Profiles currently control dashboard view XML, matching navigation entries,
and complete Searchbase stanzas. Macros, images, and other app resources remain
packaged. Before demoting a Searchbase stanza, confirm that a released view or
released Searchbase stanza does not require it.

Use the root `build.sh` or `yarn package:app` for release artifacts. The
lower-level `node bin/build.js pack` helper archives the raw development stage
and does not apply the Splunkbase app-resource filter.
