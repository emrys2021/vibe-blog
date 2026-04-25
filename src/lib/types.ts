export interface PostFrontmatter {
  title: string;
  date: string;
  description?: string;
  category?: string;
  tags?: string[];
  draft?: boolean;
  cover?: string;
}

export interface PostMeta extends PostFrontmatter {
  slug: string;
  readingTime: string;
  wordCount: number;
}

export interface Post extends PostMeta {
  raw: string;
  html: string;
  toc: TocItem[];
}

export interface TocItem {
  depth: number;
  value: string;
  id: string;
}

export interface TagBucket {
  tag: string;
  count: number;
  posts: PostMeta[];
}

export interface CategoryBucket {
  category: string;
  label: string;
  segments: string[];
  count: number;
  posts: PostMeta[];
}

export interface CommandMenuPost {
  slug: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  searchText: string;
}

export interface CommandMenuFullTextPost {
  slug: string;
  searchText: string;
}

export interface CommandMenuTag {
  tag: string;
  count: number;
}

export interface CommandMenuCategory {
  category: string;
  label: string;
  count: number;
}

export interface CommandMenuData {
  posts: CommandMenuPost[];
  tags: CommandMenuTag[];
  categories: CommandMenuCategory[];
}

export interface CommandMenuFullTextData {
  posts: CommandMenuFullTextPost[];
}
