# Splunk Cisco Dashboards

A Yarn-workspaces monorepo housing the **Splunk Cisco Dashboards** Splunk
app — a React-based set of dashboards (Overview, Devices, Network,
Security) that visualize Cisco fleet, network performance, and security
data inside Splunk Web.

## Layout

```
splunk-cisco-dashboards/
├── package.json          # workspace root
└── packages/
    └── splunk-cisco-dashboards/   # the actual Splunk app + React UI
```

The top-level scripts simply delegate into the package:

```bash
yarn install              # install workspace deps
yarn setup                # install + build everything
yarn start                # webpack --watch in the app package
yarn build                # production build of all packages
yarn lint                 # eslint + stylelint
yarn clean                # remove build artifacts
```

For more detail see [`packages/splunk-cisco-dashboards/README.md`](packages/splunk-cisco-dashboards/README.md).
