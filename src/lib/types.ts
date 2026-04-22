export interface PostFrontmatter {
  title: string;
  date: string;
  description?: string;
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
