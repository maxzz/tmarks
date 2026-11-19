/** Identifier of a node inside one loaded bookmarks document. */
export type BookmarkId = string;

interface BookmarkNodeBase {
    id: BookmarkId;
    /** Id of the containing folder, or `null` for top-level items. */
    parentId: BookmarkId | null;
    title: string;
    /** `ADD_DATE`: Unix time in seconds. */
    addDate: number | null;
    /** `LAST_MODIFIED`: Unix time in seconds. */
    lastModified: number | null;
}

//---------------------------------------------------------------------------

export interface BookmarkFolder extends BookmarkNodeBase {
    kind: "folder";
    childIds: BookmarkId[];
    /** `PERSONAL_TOOLBAR_FOLDER="true"`: the "Bookmarks bar" folder in Chrome and Opera. */
    isToolbar: boolean;
}

export interface BookmarkLink extends BookmarkNodeBase {
    kind: "link";
    /** `HREF` */
    url: string;
    /** `ICON`: inline `data:image/...;base64,...` preview (the site's favicon) when the browser exported one. */
    icon: string | null;
}

//---------------------------------------------------------------------------

export type BookmarkNode = BookmarkFolder | BookmarkLink;

export type BookmarkNodes = Record<BookmarkId, BookmarkNode>;

//---------------------------------------------------------------------------

/** A whole bookmarks file: all nodes, plus the ids of the top-level items in file order. */
export interface BookmarkDocument {
    nodes: BookmarkNodes;
    rootIds: BookmarkId[];
}
