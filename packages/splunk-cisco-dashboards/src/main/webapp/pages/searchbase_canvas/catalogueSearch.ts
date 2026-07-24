export interface CatalogueFastSearchRecord {
    id: string;
    searchName: string;
    description: string;
    search: string;
}

type PlainTextConverter = (value: string) => string;

const identity = (value: string): string => value;

const SPECIAL_CHARACTER_PATTERN = /[|()`_=+,.-]/;

const recordFastSearchFields = (
    record: CatalogueFastSearchRecord,
    descriptionToText: PlainTextConverter
): string[] => [
    record.id,
    record.searchName,
    descriptionToText(record.description),
    record.search,
];

const wordMatchFactor = (queryWords: string[], fieldValue: string): number => {
    const fieldWords = fieldValue
        .toLowerCase()
        .split(/[_\-\s]/)
        .filter(Boolean);
    const matchingWords = new Set(
        fieldWords.filter((fieldWord) => queryWords.includes(fieldWord))
    );

    return matchingWords.size / queryWords.length;
};

const fieldMatchesQuery = (fieldValue: string, normalizedQuery: string): boolean => {
    const normalizedField = fieldValue.toLowerCase();
    const quoted =
        normalizedQuery.length >= 2 &&
        normalizedQuery.startsWith('"') &&
        normalizedQuery.endsWith('"');
    const phrase = quoted ? normalizedQuery.slice(1, -1) : normalizedQuery;
    const queryWords = phrase.split(/\s+/).filter(Boolean);

    if (queryWords.length === 0) {
        return false;
    }

    // Searchbase treats a single word or a double-quoted value as a
    // case-insensitive substring search.
    if (quoted || queryWords.length === 1) {
        return normalizedField.includes(phrase);
    }

    // SPL-shaped input is matched as a contiguous string instead of
    // being tokenized. This preserves searches for macros, field=value,
    // function calls, and pipeline fragments.
    if (queryWords.some((word) => SPECIAL_CHARACTER_PATTERN.test(word))) {
        return normalizedField.includes(queryWords.join(' '));
    }

    // Searchbase requires every word for queries shorter than four words.
    // For longer queries, four matching words are sufficient.
    const acceptanceThreshold =
        queryWords.length < 4 ? 1 : 4 / queryWords.length;
    return wordMatchFactor(queryWords, fieldValue) >= acceptanceThreshold;
};

/**
 * Mirrors Searchbase's Fast filter field scope and matching behavior.
 *
 * Only stanza id, friendly search name, description, and SPL participate
 * in free-text search. Category, tags, remediation text, drilldowns, app
 * metadata, and visualization options remain available through their
 * dedicated filters and UI.
 */
export const recordMatchesCatalogueQuery = (
    record: CatalogueFastSearchRecord,
    rawQuery: string,
    descriptionToText: PlainTextConverter = identity
): boolean => {
    const normalizedQuery = rawQuery.trim().toLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    return recordFastSearchFields(record, descriptionToText).some((field) =>
        fieldMatchesQuery(field, normalizedQuery)
    );
};
