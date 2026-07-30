export interface AutoAdvancePlan {
    pages: string[][];
    totalSearches: number;
}

/**
 * Preserve the canvas' visual pagination while omitting tiles that cannot
 * dispatch a search (for example, a tile whose catalogue stanza was removed).
 */
export const buildAutoAdvancePlan = (
    tileIds: string[],
    runnableTileIds: ReadonlySet<string>,
    pageSize: number
): AutoAdvancePlan => {
    const normalizedPageSize = Math.max(1, Math.floor(pageSize));
    const pageCount = Math.max(1, Math.ceil(tileIds.length / normalizedPageSize));
    const pages = Array.from({ length: pageCount }, (_, pageIndex) =>
        tileIds
            .slice(
                pageIndex * normalizedPageSize,
                (pageIndex + 1) * normalizedPageSize
            )
            .filter((tileId) => runnableTileIds.has(tileId))
    );

    return {
        pages,
        totalSearches: pages.reduce((total, page) => total + page.length, 0),
    };
};

export const settleAutoAdvanceTile = (
    pendingTileIds: string[],
    settledTileId: string
): string[] =>
    pendingTileIds.includes(settledTileId)
        ? pendingTileIds.filter((tileId) => tileId !== settledTileId)
        : pendingTileIds;
