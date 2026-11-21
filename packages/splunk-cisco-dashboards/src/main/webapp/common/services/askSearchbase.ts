import type { SearchbaseRecord } from './searchbaseCatalogue';

const QUESTION_WORDS = new Set(
    'a across an and are build by can chart create dashboard day days did do each find for from get give has have hour hours how i in is last me minute minutes monitor most of on over past please search show the time to top trend was week weeks were what when where which with workspace'.split(' '),
);

const normalize = (value: string): string =>
    value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const term = (word: string): string => word.replace(/(?<=\p{L}{3})s$/u, '');

const termsFor = (value: string): Set<string> =>
    new Set(normalize(value).split(' ').filter(Boolean).map(term));

export const ASK_SEARCHBASE_QUESTION_LIMIT = 500;

export const rankSearchbaseMatches = (
    records: readonly SearchbaseRecord[],
    question: string,
): SearchbaseRecord[] => {
    const terms = [...new Set(normalize(question).split(' ')
        .filter((word) => word && !QUESTION_WORDS.has(word) && !/^\d+([hmdw])?$/.test(word))
        .map(term))];
    if (!terms.length) return [];

    const phrase = terms.join(' ');
    const minimumMatches = Math.ceil(terms.length * 0.7);
    return records.flatMap((record) => {
        if (record.searchHidden || !record.id || !record.search?.trim()) return [];

        const name = termsFor(record.searchName);
        const metadata = termsFor([record.category, record.subCategory, ...record.tags].join(' '));
        const description = termsFor(record.description.replace(/<[^>]*>/g, ' '));
        const primaryMatches = terms.filter((word) => name.has(word) || metadata.has(word) || description.has(word));
        if (primaryMatches.length < Math.ceil(terms.length / 2)) return [];

        const searchTerms = termsFor(record.search.slice(0, 4096));
        const matched = terms.filter((word) => primaryMatches.includes(word) || searchTerms.has(word));
        if (matched.length < minimumMatches) return [];

        const titlePhrase = ` ${[...name].join(' ')} `.includes(` ${phrase} `);
        const score = matched.reduce((sum, word) => {
            if (name.has(word)) return sum + 6;
            if (metadata.has(word)) return sum + 3;
            return sum + (description.has(word) ? 2 : 1);
        }, 0);
        return [{ record, score: score + (titlePhrase ? 8 : 0), coverage: matched.length }];
    }).sort((first, second) =>
        second.score - first.score || second.coverage - first.coverage ||
        first.record.searchName.localeCompare(second.record.searchName) ||
        first.record.ownerApp.localeCompare(second.record.ownerApp) ||
        first.record.id.localeCompare(second.record.id),
    ).slice(0, 5).map(({ record }) => record);
};
