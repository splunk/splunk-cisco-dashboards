module.exports = {
    presets: [
        '@splunk/babel-preset',
        // TypeScript preset is listed last so it runs FIRST (Babel applies
        // presets in reverse order). It strips type annotations before
        // env/react transforms run.
        '@babel/preset-typescript',
    ],
    compact: true,
};
