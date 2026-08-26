/**
 * Resolves Dashboard Studio tokens for the "Open in Search" action.
 *
 * The destination is a SPL query, so URL values must never be treated as
 * generic token text.  Only values that can be validated against a static
 * dashboard input definition (or a constrained time-range grammar) may cross
 * this boundary.  Runtime and free-text tokens intentionally remain unresolved
 * when there is no trusted value.
 */

type DashboardInputOption = {
    defaultValue?: unknown;
    items?: unknown;
    token?: unknown;
};

export type DashboardInputDefinition = {
    options?: DashboardInputOption;
    type?: unknown;
};

export type DashboardInputDefinitions = Record<string, DashboardInputDefinition>;

const TOKEN_PATTERN = /\$([A-Za-z_][A-Za-z0-9_.-]*)\$/g;
const MAX_TIME_RANGE_LENGTH = 128;
const SAFE_TIME_RANGE_PATTERN = /^[A-Za-z0-9@._:+\-*/ ]+$/;

const findInput = (inputs: DashboardInputDefinitions, tokenName: string) =>
    Object.values(inputs).find((input) => input?.options?.token === tokenName);

const toTokenText = (value: unknown): string | undefined => {
    if (typeof value === 'string' || typeof value === 'number') {
        return `${value}`;
    }
    if (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === 'string' || typeof entry === 'number')
    ) {
        return value.map((entry) => `${entry}`).join(',');
    }
    return undefined;
};

const urlTokenValue = (searchParams: URLSearchParams, token: string) =>
    searchParams.get(token) ?? searchParams.get(`form.${token}`) ?? undefined;

const isSafeTimeRange = (value: string) =>
    value.length > 0 &&
    value.length <= MAX_TIME_RANGE_LENGTH &&
    SAFE_TIME_RANGE_PATTERN.test(value);

const staticItemValues = (input: DashboardInputDefinition) => {
    if (!Array.isArray(input.options?.items)) {
        return [];
    }

    return input.options.items
        .map((item) =>
            item && typeof item === 'object' && 'value' in item
                ? toTokenText((item as { value?: unknown }).value)
                : undefined,
        )
        .filter((value): value is string => value !== undefined);
};

const fixedChoiceValue = (input: DashboardInputDefinition, urlValue: string) => {
    const allowedValues = staticItemValues(input);
    if (allowedValues.length === 0) {
        return undefined;
    }

    if (input.type === 'input.dropdown') {
        return allowedValues.includes(urlValue) ? urlValue : undefined;
    }

    if (input.type === 'input.multiselect') {
        const values = urlValue
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        return values.length > 0 && values.every((value) => allowedValues.includes(value))
            ? values.join(',')
            : undefined;
    }

    return undefined;
};

const trustedDefaultValue = (input: DashboardInputDefinition, timePart?: string) => {
    const defaultValue = input.options?.defaultValue;
    if (timePart === 'earliest' || timePart === 'latest') {
        if (input.type !== 'input.timerange') {
            return undefined;
        }
        const [earliest, latest] = `${defaultValue ?? ''}`.split(',');
        return timePart === 'earliest' ? earliest || undefined : latest || undefined;
    }

    return toTokenText(defaultValue);
};

/**
 * Resolve a token in a SPL query without accepting arbitrary URL text.
 */
export const resolveOpenSearchToken = (
    token: string,
    inputs: DashboardInputDefinitions,
    searchParams: URLSearchParams,
) => {
    const [tokenName, timePart] = token.split('.');
    const input = findInput(inputs, tokenName);
    if (!input) {
        return undefined;
    }

    if (timePart && timePart !== 'earliest' && timePart !== 'latest') {
        return undefined;
    }

    const urlValue = urlTokenValue(searchParams, token);
    if (
        (timePart === 'earliest' || timePart === 'latest') &&
        input.type === 'input.timerange' &&
        urlValue &&
        isSafeTimeRange(urlValue)
    ) {
        return urlValue;
    }

    if (!timePart && urlValue) {
        const fixedChoice = fixedChoiceValue(input, urlValue);
        if (fixedChoice !== undefined) {
            return fixedChoice;
        }
    }

    return trustedDefaultValue(input, timePart);
};

/**
 * Replaces each source token once.  Values introduced by a replacement are
 * deliberately not resolved again, preventing nested token expansion.
 */
export const resolveOpenSearchQuery = (
    query: string | undefined,
    inputs: DashboardInputDefinitions,
    searchParams: URLSearchParams,
) => {
    if (!query) {
        return undefined;
    }

    return `${query}`.replace(TOKEN_PATTERN, (match, token) => {
        return resolveOpenSearchToken(token, inputs, searchParams) ?? match;
    });
};
