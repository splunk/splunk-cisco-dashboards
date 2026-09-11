/**
 * Preserve literal text inside an XML CDATA section.
 *
 * XML has no escaping mechanism inside CDATA: a literal `]]>` closes the
 * section. Splitting that sequence into adjacent CDATA sections keeps the
 * original text intact without allowing it to introduce XML markup.
 */
const CDATA_TERMINATOR_ESCAPE = "]]" + "]]><![CDATA[>";

export const escapeCdata = (value: unknown): string =>
  String(value ?? "").replace(/]]>/g, CDATA_TERMINATOR_ESCAPE);
