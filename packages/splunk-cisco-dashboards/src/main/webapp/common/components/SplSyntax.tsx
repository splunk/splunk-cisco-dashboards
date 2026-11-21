import React from 'react';
import { variables } from '@splunk/themes';
import styled from 'styled-components';

const SPL_COMMANDS = new Set([
    'append',
    'appendcols',
    'appendpipe',
    'bin',
    'chart',
    'collect',
    'dedup',
    'eval',
    'eventstats',
    'fields',
    'filldown',
    'fillnull',
    'head',
    'inputlookup',
    'join',
    'lookup',
    'makeresults',
    'makemv',
    'mvexpand',
    'outputlookup',
    'predict',
    'rename',
    'rex',
    'search',
    'sort',
    'spath',
    'stats',
    'streamstats',
    'table',
    'tail',
    'timechart',
    'tstats',
    'union',
    'where',
]);

const SPL_KEYWORDS = new Set([
    'and',
    'as',
    'by',
    'case',
    'coalesce',
    'earliest',
    'false',
    'if',
    'in',
    'isnotnull',
    'isnull',
    'latest',
    'like',
    'lower',
    'match',
    'max',
    'min',
    'not',
    'null',
    'or',
    'round',
    'sum',
    'tonumber',
    'tostring',
    'true',
    'values',
    'avg',
    'cidrmatch',
    'count',
    'first',
    'last',
    'len',
    'mvcount',
    'mvjoin',
    'relative_time',
    'replace',
    'split',
    'strftime',
    'strptime',
]);

const SPL_OPERATOR_KEYWORDS = new Set([
    'and',
    'as',
    'by',
    'from',
    'in',
    'or',
    'where',
]);

const Token = styled.span<{ $kind: keyof typeof colors }>`
    color: ${({ $kind }) => colors[$kind]};
`;

const colors = {
    command: variables.syntaxColorKeyword,
    keyword: variables.syntaxColorBuiltin,
    function: variables.syntaxColorCallable,
    string: variables.syntaxColorLiteral,
    macro: variables.syntaxColorReference,
    number: variables.syntaxColorConstant,
    operator: variables.syntaxColorOperator,
    comment: variables.syntaxColorComment,
};

const pattern =
    /(```[\s\S]*?```|`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\|[^\S\r\n]*[A-Za-z_][A-Za-z0-9_]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_.:{}-]*\b|!=|>=|<=|=|>|<|[+*\/-])/g;

function tokenKind(part: string): keyof typeof colors | undefined {
    if (part.startsWith('```') && part.endsWith('```')) return 'comment';
    if (part.startsWith('`') && part.endsWith('`')) return 'macro';
    if ((part.startsWith('"') && part.endsWith('"')) ||
        (part.startsWith("'") && part.endsWith("'"))) return 'string';
    if (part.startsWith('|')) return 'command';
    if (/^\d+(?:\.\d+)?$/.test(part)) return 'number';
    if (/^(?:!=|>=|<=|=|>|<|[+*\/-])$/.test(part)) return 'operator';
    const normalized = part.toLowerCase();
    if (SPL_OPERATOR_KEYWORDS.has(normalized)) return 'keyword';
    if (SPL_COMMANDS.has(normalized)) return 'command';
    if (SPL_KEYWORDS.has(normalized)) return 'function';
    return undefined;
}

/** Highlights a read-only SPL snippet while preserving the original copyable text. */
export const SplSyntax = React.memo(function SplSyntax({ spl }: { spl: string }) {
    return <>{spl.split(pattern).map((part, index) => {
        if (!part) return null;
        const kind = tokenKind(part);
        return kind ? <Token key={index} $kind={kind} data-spl-token={kind}>{part}</Token> : part;
    })}</>;
});
