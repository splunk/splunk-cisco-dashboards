// Keep Executive as the legacy unscoped persistence profile so existing
// localStorage keys and Splunk config stanzas remain compatible. The
// user-facing landing/default profile is defined separately below.
export const DEFAULT_OVERVIEW_PROFILE_ID = 'executive' as const;
export const SECURE_NETWORKING_PROFILE_ID = 'secure_networking' as const;
export const DEFAULT_OVERVIEW_LANDING_PROFILE_ID =
    SECURE_NETWORKING_PROFILE_ID;

export const OVERVIEW_PROFILE_IDS = [
    SECURE_NETWORKING_PROFILE_ID,
    DEFAULT_OVERVIEW_PROFILE_ID,
] as const;

export type OverviewProfileId = (typeof OVERVIEW_PROFILE_IDS)[number];

export const ALL_OVERVIEW_SECTION_IDS = [
    'it_health',
    'security',
    'building',
    'custom',
    'zta',
    'secure_infrastructure',
    'scalable_network_segmentation',
    'hybrid_mesh_firewalling',
    'agentic_ops',
] as const;

export type SectionId = (typeof ALL_OVERVIEW_SECTION_IDS)[number];

export interface OverviewSectionMeta {
    id: SectionId;
    title: string;
    linkText: string;
    href?: string;
    icon: OverviewSectionIcon;
    /** Optional packaged SVG used as a color-aware mask over the Lucide fallback. */
    iconSrc?: string;
}

export type OverviewSectionIcon =
    | 'activity'
    | 'shield'
    | 'building'
    | 'sparkles'
    | 'shield-check'
    | 'server-cog'
    | 'network'
    | 'firewall'
    | 'bot';

interface OverviewAutoDiscoveryConfig {
    stanzaPrefix?: string;
    requiredTag?: string;
    subCategoryToSection: Record<string, SectionId>;
}

export interface OverviewProfile {
    id: OverviewProfileId;
    /** Short user-facing name shown in the Overview profile switcher. */
    label: string;
    /**
     * Splunk views that render this profile. The first entry is canonical and
     * is used by the profile switcher; later entries may be legacy aliases.
     */
    viewNames: readonly [string, ...string[]];
    headerTitle?: string;
    headerSubtitle?: string;
    /** Packaged default logo used when the user has not uploaded one. */
    defaultLogoSrc?: string;
    /** Suppress the built-in logo while still allowing a user-uploaded override. */
    hideDefaultLogo?: boolean;
    sections: readonly OverviewSectionMeta[];
    defaultVisibleSections: readonly SectionId[];
    maxVisibleSections: number;
    minTileCount: number;
    maxTileCount: number;
    fallbackTileCount: number;
    autoDiscovery?: OverviewAutoDiscoveryConfig;
}

const SECURE_NETWORKING_IMAGE_ROOT =
    '/static/app/splunk-cisco-dashboards/images/overview/secure-networking';

const EXECUTIVE_SECTIONS: readonly OverviewSectionMeta[] = [
    {
        id: 'it_health',
        title: 'IT Health',
        linkText: 'Open IT health',
        href: 'it_health_v1',
        icon: 'activity',
    },
    {
        id: 'security',
        title: 'Security',
        linkText: 'Open security',
        href: 'security_v1',
        icon: 'shield',
    },
    {
        id: 'building',
        title: 'Building Intelligence',
        linkText: 'Open building intelligence',
        href: 'building_v1',
        icon: 'building',
    },
    {
        id: 'custom',
        title: 'Executive Signals',
        linkText: 'Open dashboard builder',
        href: 'dashboardbuilder',
        icon: 'sparkles',
    },
] as const;

const SECURE_NETWORKING_SECTIONS: readonly OverviewSectionMeta[] = [
    {
        id: 'zta',
        title: 'Zero Trust Access',
        linkText: 'Open Zero Trust Access',
        href: 'dashboardbuilder#/secure_networking_zta',
        icon: 'shield-check',
        iconSrc: `${SECURE_NETWORKING_IMAGE_ROOT}/zero-trust-access.svg`,
    },
    {
        id: 'secure_infrastructure',
        title: 'Secure Infrastructure',
        linkText: 'Open Secure Infrastructure',
        href: 'secure_networking_secure_infrastructure',
        icon: 'server-cog',
        iconSrc: `${SECURE_NETWORKING_IMAGE_ROOT}/secure-infrastructure.svg`,
    },
    {
        id: 'scalable_network_segmentation',
        title: 'Scalable Network Segmentation',
        linkText: 'Open Scalable Network Segmentation',
        href: 'secure_networking_scalable_network_segmentation',
        icon: 'network',
        iconSrc: `${SECURE_NETWORKING_IMAGE_ROOT}/segmentation.svg`,
    },
    {
        id: 'hybrid_mesh_firewalling',
        title: 'Hybrid Mesh Firewalling',
        linkText: 'Open Hybrid Mesh Firewalling',
        href: 'secure_networking_hybrid_mesh_firewalling',
        icon: 'firewall',
        iconSrc: `${SECURE_NETWORKING_IMAGE_ROOT}/hybrid-mesh-firewalling.svg`,
    },
    {
        id: 'agentic_ops',
        title: 'Agentic Ops',
        linkText: 'Open Agentic Ops',
        href: 'secure_networking_agentic_ops',
        icon: 'bot',
        iconSrc: `${SECURE_NETWORKING_IMAGE_ROOT}/agentic-ops.svg`,
    },
] as const;

export const OVERVIEW_PROFILES: Record<OverviewProfileId, OverviewProfile> = {
    executive: {
        id: DEFAULT_OVERVIEW_PROFILE_ID,
        label: 'Executive Briefing',
        viewNames: ['overview'],
        sections: EXECUTIVE_SECTIONS,
        defaultVisibleSections: ['it_health', 'security', 'building'],
        maxVisibleSections: 4,
        minTileCount: 3,
        maxTileCount: 9,
        fallbackTileCount: 3,
    },
    secure_networking: {
        id: SECURE_NETWORKING_PROFILE_ID,
        label: 'Secure Networking',
        viewNames: ['secure_networking_overview'],
        headerTitle: 'Splunk for Secure Networking',
        headerSubtitle: 'Secure Networking Executive Insights',
        hideDefaultLogo: true,
        sections: SECURE_NETWORKING_SECTIONS,
        defaultVisibleSections: [
            'zta',
            'secure_infrastructure',
            'scalable_network_segmentation',
            'hybrid_mesh_firewalling',
            'agentic_ops',
        ],
        maxVisibleSections: 5,
        minTileCount: 1,
        maxTileCount: 9,
        fallbackTileCount: 3,
        autoDiscovery: {
            stanzaPrefix: 'secure_networking_',
            requiredTag: 'Secure Networking',
            subCategoryToSection: {
                'Zero Trust Access': 'zta',
                'Secure Infrastructure': 'secure_infrastructure',
                'Scalable Network Segmentation': 'scalable_network_segmentation',
                'Hybrid Mesh Firewalling': 'hybrid_mesh_firewalling',
                'Agentic Ops': 'agentic_ops',
                'Agentic Operations': 'agentic_ops',
            },
        },
    },
};

export const isOverviewProfileId = (raw: unknown): raw is OverviewProfileId =>
    typeof raw === 'string' &&
    (OVERVIEW_PROFILE_IDS as readonly string[]).includes(raw);

export const isOverviewSectionId = (raw: unknown): raw is SectionId =>
    typeof raw === 'string' &&
    (ALL_OVERVIEW_SECTION_IDS as readonly string[]).includes(raw);

export const getOverviewProfile = (
    profileId: OverviewProfileId
): OverviewProfile => OVERVIEW_PROFILES[profileId];

export const getOverviewProfileViewName = (
    profileId: OverviewProfileId
): string => OVERVIEW_PROFILES[profileId].viewNames[0];

export const getOverviewProfileForViewName = (
    rawViewName: string | undefined
): OverviewProfile => {
    const viewName = rawViewName?.trim();
    if (viewName) {
        for (const profile of Object.values(OVERVIEW_PROFILES)) {
            if (profile.viewNames.includes(viewName)) return profile;
        }
    }
    return OVERVIEW_PROFILES[DEFAULT_OVERVIEW_LANDING_PROFILE_ID];
};

export const getOverviewProfileFromLocation = (): OverviewProfile => {
    if (typeof window === 'undefined') {
        return OVERVIEW_PROFILES[DEFAULT_OVERVIEW_LANDING_PROFILE_ID];
    }
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('overview_profile');
    if (isOverviewProfileId(explicit)) return OVERVIEW_PROFILES[explicit];

    const parts = window.location.pathname.split('/').filter(Boolean);
    const viewName = parts.length > 0 ? decodeURIComponent(parts[parts.length - 1]) : '';
    return getOverviewProfileForViewName(viewName);
};

export const sectionIdsForProfile = (
    profile: OverviewProfile
): readonly SectionId[] => profile.sections.map((section) => section.id);

export const sectionIdSetForProfile = (profile: OverviewProfile): Set<SectionId> =>
    new Set(sectionIdsForProfile(profile));

export const profileStorageKey = (
    baseKey: string,
    profileId: OverviewProfileId
): string => {
    if (profileId === DEFAULT_OVERVIEW_PROFILE_ID) return baseKey;
    const versionMatch = baseKey.match(/\.v\d+$/);
    if (!versionMatch) return `${baseKey}.${profileId}`;
    return `${baseKey.slice(0, versionMatch.index)}.${profileId}${versionMatch[0]}`;
};
