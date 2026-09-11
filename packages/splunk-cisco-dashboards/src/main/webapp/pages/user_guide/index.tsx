/* eslint-disable react/jsx-filename-extension */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "@splunk/react-ui/Button";
import Dropdown from "@splunk/react-ui/Dropdown";
import Menu from "@splunk/react-ui/Menu";
import {
    Download,
    ExternalLink,
    LifeBuoy,
    Moon,
    Search,
    SlidersHorizontal,
    Sun,
} from '@/common/icons/SuiIcon';
import AppearanceMenuItems from "@/common/components/AppearanceMenuItems";
import { APP_VERSION_LABEL } from "@/common/lib/buildInfo";
import { useAppThemeControls } from "@/common/theme/AppThemeProvider";
import guideMarkdown from "./userGuide.md";
import { parseGuideMarkdown } from "./markdownGuide";

import "./user-guide.css";

const APP_NAME = "splunk-cisco-dashboards";
const PARSED_GUIDE = parseGuideMarkdown(guideMarkdown);

const getSplunkLocale = (): string => {
  if (typeof window === "undefined") {
    return "en-US";
  }
  const localeMatch = window.location.pathname.match(
    /^\/([a-z]{2}-[A-Z]{2})\//,
  );
  return localeMatch ? localeMatch[1] : "en-US";
};

const appUrl = (view: string): string =>
  `/${getSplunkLocale()}/app/${APP_NAME}/${view}`;
const searchUrl = (q: string): string =>
  `/${getSplunkLocale()}/app/${APP_NAME}/search?q=${encodeURIComponent(q)}`;

const sectionLinkBase = "scd-guide-action-link";

const GUIDE_GROUPS = [
  {
    label: "Start",
    sections: [
      { id: "overview", label: "Overview" },
      { id: "prerequisites", label: "Prerequisites" },
      { id: "install", label: "Day-One Setup" },
    ],
  },
  {
    label: "Configure",
    sections: [
      { id: "macro-tuning", label: "Macro Tuning" },
      { id: "data-sources", label: "Data Sources" },
    ],
  },
  {
    label: "Explore",
    sections: [
      { id: "dashboards", label: "Dashboard Map" },
      { id: "workspaces", label: "Insights Workspaces" },
      { id: "site-connectivity", label: "Site Connectivity" },
      { id: "lookups", label: "Supporting Assets" },
    ],
  },
  {
    label: "Operate",
    sections: [
      { id: "operations", label: "Operations" },
      { id: "troubleshooting", label: "Troubleshooting" },
      { id: "release-notes", label: "Release Notes" },
    ],
  },
];

const GUIDE_SECTIONS = GUIDE_GROUPS.flatMap((group) =>
  group.sections.map((section) => ({ ...section, group: group.label })),
);


const SEARCHABLE_SELECTOR = "h2, h3, p, li, td, th";

const sectionNumber = (id: string): number =>
  GUIDE_SECTIONS.findIndex((section) => section.id === id) + 1;

const headingSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "heading";

function GuideLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={sectionLinkBase}
    >
      {children}
      <ExternalLink size={15} />
    </a>
  );
}

function GuideContents({
  activeSection,
  clearSearch,
  currentSearchIndex,
  goToSection,
  nextSearchMatch,
  searchMatches,
  searchQuery,
  searchStatus,
  setSearchQuery,
}: {
  activeSection: string;
  clearSearch: () => void;
  currentSearchIndex: number;
  goToSection: (id: string) => void;
  nextSearchMatch: () => void;
  searchMatches: number;
  searchQuery: string;
  searchStatus: string;
  setSearchQuery: (value: string) => void;
}): JSX.Element {
  return (
    <nav
      className="scd-guide-toc scd-guide-no-print"
      aria-label="User guide contents"
    >
      <div className="scd-guide-toc-header">
        <div className="scd-guide-toc-eyebrow">User Guide</div>
        <div className="scd-guide-toc-title">Contents</div>
      </div>

      <div className="scd-guide-search">
        <div className="scd-guide-search-input-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            id="scd-guide-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                nextSearchMatch();
              }
            }}
            placeholder="Search guide"
            aria-label="Search user guide"
            className="scd-guide-search-input"
          />
        </div>
        <div className="scd-guide-search-actions">
          <span className="scd-guide-search-status" aria-live="polite">
            {searchStatus}
            {searchMatches > 0 && (
              <span className="scd-guide-search-count">
                {currentSearchIndex + 1}/{searchMatches}
              </span>
            )}
          </span>
          <button
            type="button"
            disabled={searchMatches < 2}
            onClick={nextSearchMatch}
            className="scd-guide-search-button"
          >
            Next
          </button>
          <button
            type="button"
            disabled={!searchQuery}
            onClick={clearSearch}
            className="scd-guide-search-button"
          >
            Clear
          </button>
        </div>
      </div>

      <ol className="scd-guide-toc-list">
        {GUIDE_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <li className="scd-guide-toc-group" role="presentation">
              {group.label}
            </li>
            {group.sections.map((section) => {
              const number = sectionNumber(section.id);
              const active = section.id === activeSection;
              return (
                <li
                  key={section.id}
                  className={`scd-guide-toc-item${
                    active ? " scd-guide-toc-item-active" : ""
                  }`}
                >
                  <a
                    href={`#${section.id}`}
                    aria-current={active ? "location" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      goToSection(section.id);
                    }}
                    className="scd-guide-toc-link"
                  >
                    <span className="scd-guide-toc-chip">{number}</span>
                    <span className="scd-guide-toc-text">{section.label}</span>
                  </a>
                </li>
              );
            })}
          </React.Fragment>
        ))}
      </ol>

      <div className="scd-guide-toc-footer">
        <a
          href={`${appUrl("setup")}?setup=1#tune-indexes`}
          className="scd-guide-toc-quicklink"
        >
          Setup: Tune indexes →
        </a>
        <a href={appUrl("workspace_insights")} className="scd-guide-toc-quicklink">
          Insights Workspaces →
        </a>
      </div>
    </nav>
  );
}

function GuidePageToc({
  activeHeading,
  activeSection,
  entries,
  goToHeading,
}: {
  activeHeading: string;
  activeSection: string;
  entries: Array<{ id: string; label: string; level: number }>;
  goToHeading: (id: string) => void;
}): JSX.Element {
  return (
    <aside
      className="scd-guide-page-toc scd-guide-no-print"
      aria-label="On this page"
    >
      <div className="scd-guide-page-toc-kicker">This section</div>
      <div className="scd-guide-page-toc-title">On this page</div>
      <ol className="scd-guide-page-toc-list">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`scd-guide-page-toc-item scd-guide-page-toc-level-${entry.level}${
              activeHeading === entry.id
                ? " scd-guide-page-toc-item-active"
                : ""
            }`}
          >
            <a
              href={`#${entry.id}`}
              className="scd-guide-page-toc-link"
              onClick={(event) => {
                event.preventDefault();
                goToHeading(entry.id);
              }}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ol>
      <div className="scd-guide-page-toc-footer">
        Section {sectionNumber(activeSection)} of {GUIDE_SECTIONS.length}
      </div>
    </aside>
  );
}

export default function UserGuidePage(): JSX.Element {
  const { canChooseColorScheme, colorScheme } = useAppThemeControls();
  const setupTuningUrl = `${appUrl("setup")}?setup=1#tune-indexes`;
  const guideContentRef = useRef<HTMLDivElement | null>(null);
  const matchesRef = useRef<HTMLElement[]>([]);
  const currentSearchIndexRef = useRef(-1);
  const appearanceToggleRef = useRef<
    HTMLAnchorElement | HTMLButtonElement
  >(null);
  const [activeSection, setActiveSection] = useState<string>(
    GUIDE_SECTIONS[0].id,
  );
  const [activeHeading, setActiveHeading] = useState<string>(
    GUIDE_SECTIONS[0].id,
  );
  const [pageTocBySection, setPageTocBySection] = useState(() => new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchMatches, setSearchMatches] = useState(0);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState(false);
  const closeAppearanceMenu = useCallback(() => {
    setAppearanceMenuOpen(false);
    window.setTimeout(() => appearanceToggleRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("scd-overview-active");
    document.body.classList.add("scd-overview-active");
    return () => {
      document.documentElement.classList.remove("scd-overview-active");
      document.body.classList.remove("scd-overview-active");
    };
  }, []);

  const clearSearchClasses = useCallback(() => {
    matchesRef.current.forEach((node) => {
      node.classList.remove(
        "scd-guide-search-match",
        "scd-guide-search-current",
      );
    });
    matchesRef.current = [];
    currentSearchIndexRef.current = -1;
    setSearchMatches(0);
    setCurrentSearchIndex(-1);
  }, []);

  const showSearchMatch = useCallback(
    (index: number, shouldScroll = true) => {
      const matches = matchesRef.current;
      if (!matches.length) {
        setSearchStatus(searchQuery.trim() ? "No matches" : "");
        return;
      }

      const previous = matches[currentSearchIndexRef.current];
      previous?.classList.remove("scd-guide-search-current");

      const nextIndex = (index + matches.length) % matches.length;
      const match = matches[nextIndex];
      currentSearchIndexRef.current = nextIndex;
      match.classList.add("scd-guide-search-current");
      setCurrentSearchIndex(nextIndex);
      setSearchStatus(
        `${matches.length} ${matches.length === 1 ? "match" : "matches"}`,
      );

      const section = match.closest<HTMLElement>("[data-guide-section]");
      if (section?.dataset.guideSection) {
        setActiveSection(section.dataset.guideSection);
        setActiveHeading(
          match.closest<HTMLElement>("h3[id], h4[id]")?.id ||
            section.dataset.guideSection,
        );
      }
      if (shouldScroll) {
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        match.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "center",
        });
      }
    },
    [searchQuery],
  );

  const runSearch = useCallback(
    (query: string) => {
      clearSearchClasses();
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery || !guideContentRef.current) {
        setSearchStatus("");
        return;
      }

      const matches = Array.from(
        guideContentRef.current.querySelectorAll<HTMLElement>(
          SEARCHABLE_SELECTOR,
        ),
      ).filter((node) =>
        node.textContent?.toLowerCase().includes(normalizedQuery),
      );

      matches.forEach((node) => node.classList.add("scd-guide-search-match"));
      matchesRef.current = matches;
      setSearchMatches(matches.length);

      if (matches.length) {
        showSearchMatch(0);
      } else {
        setSearchStatus("No matches");
      }
    },
    [clearSearchClasses, showSearchMatch],
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchStatus("");
    clearSearchClasses();
  }, [clearSearchClasses]);

  const nextSearchMatch = useCallback(() => {
    if (!matchesRef.current.length) {
      runSearch(searchQuery);
      return;
    }
    showSearchMatch(currentSearchIndexRef.current + 1);
  }, [runSearch, searchQuery, showSearchMatch]);

  const goToSection = useCallback((id: string) => {
    const section = document.getElementById(id);
    if (!section) {
      return;
    }
    setActiveSection(id);
    setActiveHeading(id);
    section.scrollIntoView({ behavior: "auto", block: "start" });
    section.tabIndex = -1;
    section.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const goToHeading = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }
    const section = target.matches("[data-guide-section]")
      ? target
      : target.closest<HTMLElement>("[data-guide-section]");
    if (section?.dataset.guideSection) {
      setActiveSection(section.dataset.guideSection);
    }
    setActiveHeading(id);
    target.scrollIntoView({ behavior: "auto", block: "start" });
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const exportPdf = useCallback(() => {
    const previousTitle = document.title;
    const openedForPrint = Array.from(
      guideContentRef.current?.querySelectorAll<HTMLDetailsElement>("details") || [],
    ).filter((panel) => !panel.open);
    openedForPrint.forEach((panel) => {
      panel.setAttribute("open", "");
    });
    const cleanup = () => {
      document.body.classList.remove("scd-guide-printing");
      document.title = previousTitle;
      openedForPrint.forEach((panel) => {
        if (document.contains(panel)) {
          panel.removeAttribute("open");
        }
      });
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("scd-guide-printing");
    document.title = `Splunk Secure Networking Essentials User Guide ${APP_VERSION_LABEL}`;
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      window.print();
      cleanup();
    }, 50);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(searchQuery), 140);
    return () => window.clearTimeout(timer);
  }, [runSearch, searchQuery]);

  useEffect(() => () => clearSearchClasses(), [clearSearchClasses]);

  useEffect(() => {
    const guide = guideContentRef.current;
    if (!guide) {
      return undefined;
    }
    const handleReleaseControl = (event: MouseEvent) => {
      const { target } = event;
      if (!(target instanceof Element)) {
        return;
      }
      const control = target.closest<HTMLButtonElement>(
        "button[data-release-action]",
      );
      if (!control || !guide.contains(control)) {
        return;
      }
      const releaseSection = control.closest<HTMLElement>(
        '[data-guide-section="release-notes"]',
      );
      const { releaseAction } = control.dataset;
      const expand = releaseAction === "expand";
      releaseSection
        ?.querySelectorAll<HTMLDetailsElement>(".scd-guide-release-panel")
        .forEach((panel) => {
          panel.toggleAttribute("open", expand);
        });
    };
    guide.addEventListener("click", handleReleaseControl);
    return () => guide.removeEventListener("click", handleReleaseControl);
  }, []);

  useEffect(() => {
    const tocBySection = new Map();

    GUIDE_SECTIONS.forEach((sectionDefinition) => {
      const section = document.getElementById(sectionDefinition.id);
      if (!section) {
        return;
      }

      const sectionTitle =
        section.querySelector("h2")?.textContent?.trim() ||
        sectionDefinition.label;
      const entries: Array<{ id: string; label: string; level: number }> = [
        {
          id: sectionDefinition.id,
          label: sectionTitle,
          level: 2,
        },
      ];
      const seenIds = new Set<string>();

      section.querySelectorAll<HTMLElement>("h3, h4").forEach((heading) => {
        const label = heading.textContent?.trim();
        if (!label) {
          return;
        }
        const baseId = `${sectionDefinition.id}-${headingSlug(label)}`;
        let id = baseId;
        let suffix = 2;
        while (
          seenIds.has(id) ||
          (document.getElementById(id) && heading.id !== id)
        ) {
          id = `${baseId}-${suffix}`;
          suffix += 1;
        }
        seenIds.add(id);
        heading.setAttribute("id", id);
        heading.setAttribute("data-guide-page-heading", "true");
        entries.push({
          id,
          label,
          level: Number(heading.tagName.slice(1)),
        });
      });

      tocBySection.set(sectionDefinition.id, entries);
    });

    setPageTocBySection(tocBySection);
  }, []);

  useEffect(() => {
    const sections = GUIDE_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((section): section is HTMLElement => Boolean(section));

    let frame = 0;
    const updateActiveSection = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const active =
          [...sections]
            .reverse()
            .find((section) => section.getBoundingClientRect().top <= 220) ||
          sections[0];
        if (active) {
          setActiveSection(active.id);
          const headingNodes = [
            active,
            ...Array.from(
              active.querySelectorAll<HTMLElement>("[data-guide-page-heading]"),
            ),
          ];
          const visibleHeading =
            [...headingNodes]
              .reverse()
              .find((heading) => heading.getBoundingClientRect().top <= 220) ||
            active;
          setActiveHeading(visibleHeading.id);
        }
      });
    };

    updateActiveSection();
    document.addEventListener("scroll", updateActiveSection, true);
    window.addEventListener("resize", updateActiveSection);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("scroll", updateActiveSection, true);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  return (
    <main
      className={`scd-user-guide scd-overview-page scd-c3-surface min-h-screen${
        colorScheme === "dark" ? " scd-c3-atmosphere" : ""
      }`}
      data-color-scheme={colorScheme}
      style={{ colorScheme }}
    >
      <div className="scd-guide-layout">
        <GuideContents
          activeSection={activeSection}
          clearSearch={clearSearch}
          currentSearchIndex={currentSearchIndex}
          goToSection={goToSection}
          nextSearchMatch={nextSearchMatch}
          searchMatches={searchMatches}
          searchQuery={searchQuery}
          searchStatus={searchStatus}
          setSearchQuery={setSearchQuery}
        />

        <article className="scd-guide-document">
          <header className="scd-guide-hero">
            <div className="scd-guide-hero-heading-row">
              <div className="scd-guide-hero-heading-copy">
                <div className="scd-guide-hero-eyebrow">
                  <LifeBuoy size={15} />
                  User Guide
                </div>
                <h1>
                  Splunk Secure Networking Essentials
                </h1>
              </div>
              <div className="scd-guide-hero-actions scd-guide-no-print">
                {canChooseColorScheme ? (
                  <Dropdown
                    defaultPlacement="below"
                    focusToggleReasons={["escapeKey", "tabKey", "toggleClick"]}
                    open={appearanceMenuOpen}
                    onRequestClose={() => setAppearanceMenuOpen(false)}
                    onRequestOpen={() => setAppearanceMenuOpen(true)}
                    toggle={
                      <Button
                        appearance="secondary"
                        elementRef={appearanceToggleRef}
                        icon={
                          colorScheme === "light" ? (
                            <Sun aria-hidden="true" size={17} />
                          ) : (
                            <Moon aria-hidden="true" size={17} />
                          )
                        }
                        label="Appearance"
                      />
                    }
                  >
                    <Menu>
                      <AppearanceMenuItems onSelect={closeAppearanceMenu} />
                    </Menu>
                  </Dropdown>
                ) : null}
                <Button
                  appearance="secondary"
                  icon={<Download size={17} />}
                  label="Export PDF"
                  onClick={exportPdf}
                />
              </div>
            </div>

            <p className="scd-guide-hero-summary">
              Setup and operating guide for deploying the app, tuning macros,
              validating data sources, and keeping the executive dashboards
              useful after the first install.
            </p>
            <div className="scd-guide-hero-metadata">
              <span>
                <strong>Version:</strong> {APP_VERSION_LABEL}
              </span>
              <span>
                <strong>License:</strong> Apache-2.0
              </span>
            </div>
            <div className="scd-guide-hero-links scd-guide-no-print">
              <GuideLink href={setupTuningUrl}>
                <SlidersHorizontal size={15} />
                Setup: Tune indexes
              </GuideLink>
              <GuideLink
                href={searchUrl(
                  "| tstats count where index=* by index sourcetype",
                )}
              >
                <Search size={15} />
                Open Data Check
              </GuideLink>
            </div>
          </header>

          <div
            ref={guideContentRef}
            className="scd-guide-content scd-guide-markdown"
            dangerouslySetInnerHTML={{ __html: PARSED_GUIDE.html }}
          />
        </article>
        <GuidePageToc
          activeHeading={activeHeading}
          activeSection={activeSection}
          entries={pageTocBySection.get(activeSection) || []}
          goToHeading={goToHeading}
        />
      </div>
    </main>
  );
}
