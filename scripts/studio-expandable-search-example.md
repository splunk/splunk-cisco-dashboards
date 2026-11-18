# Maintainer qualification: native Studio visibility and deferred searches

The experimental `studio_expandable_search_example` view is native Dashboard
Studio XML/JSON. It has no custom JavaScript bootstrap, React page, or Manager
route. Its direct native route is linked under More / Visual Labs in developer
installations and excluded from released/preview content by the profile manifest.
The earlier React example remains a separate prototype; it is not evidence that
native Studio implements the same lifecycle.

The first tab uses native buttons, token evaluation, and visibility conditions to
show/hide two grid panels. These are visual collapse controls, not a guaranteed
search-dispatch gate. Splunk's installed toolkit source
`@splunk/dashboard-ui/useBatchSubscribeToSearches` subscribes to the primary data
sources in the active layout regardless of the show/hide conditions. This is
source evidence for the caution, not a browser measurement on Forge.

The other two tabs own independent searches. Splunk documents that searches start
when the tab is selected, except searches needed by search-based tokens, and that
previously visited tabs can cache results. No automatic cancellation-on-leave or
fresh-search-on-reopen guarantee is made. Do not transfer the earlier React
example's lifecycle promises to this view or to Catalyst dashboards.

The four tiny `makeresults count=3` searches are explicitly synthetic, never
index events, and expose execution timestamps. In View mode, wait before opening
one of the collapsed panels, then inspect its timestamp and native job Inspector.
Compare with the first visit to each detail tab. Change the time range and repeat;
then revisit tabs to observe caching. Edit mode can reveal hidden panels and is
not the mode for testing visibility. Browser control was unavailable while
creating this prototype; visual reflow, clicks and actual job-start timing need
interactive acceptance. Schema, JSONata expressions, source ownership, packaging
filtering and native SPL can be checked independently.

References:

- [Native Studio visibility and token evaluation](https://help.splunk.com/en/splunk-enterprise/create-dashboards-and-reports/dashboard-studio/10.2/make-dashboards-dynamic-and-interactive/specify-visibility-conditions-for-panels-and-other-dashboard-elements)
- [Native Studio tab search execution and caching](https://help.splunk.com/en/splunk-enterprise/create-dashboards-and-reports/dashboard-studio/10.0/create-a-dashboard-in-dashboard-studio/create-a-dashboard-in-dashboard-studio/create-multiple-views-with-tabs)

Forge's installed version was read as 10.6.1.1 before implementation. The modern
button/eval/visibility JSON uses features documented for 10.2; do not silently
claim compatibility with older Studio versions. This prototype does not change
Catalyst dashboards or customer release notes.
