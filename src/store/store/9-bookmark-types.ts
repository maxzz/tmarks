/** Identifier of a node inside one loaded bookmarks document. */
export type BookmarkId = string;

/** Identifier of an icon in the icon cache. Derived from the icon's content, so equal icons share one id. */
export type IconId = string;

/** The icon cache: each distinct icon is stored once, as an inline `data:image/...;base64,...` URL. */
export type BookmarkIcons = Record<IconId, string>;

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
    /** The site's favicon, as a key of `BookmarkDocument.icons`. `null` when the browser exported no icon. */
    iconId: IconId | null;
}

//---------------------------------------------------------------------------

export type BookmarkNode = BookmarkFolder | BookmarkLink;

export type BookmarkNodes = Record<BookmarkId, BookmarkNode>;

//---------------------------------------------------------------------------

/** A whole bookmarks file: all nodes, plus the ids of the top-level items in file order. */
export interface BookmarkDocument {
    nodes: BookmarkNodes;
    rootIds: BookmarkId[];
    /** Icons referenced by the links in `nodes`. */
    icons: BookmarkIcons;
}
