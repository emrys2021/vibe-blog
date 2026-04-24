import 'server-only';
import type { CommandMenuData } from './types';
import { getAllCategories, getAllTags, getSearchDocuments } from './posts';

export function getCommandMenuData(): CommandMenuData {
  return {
    posts: getSearchDocuments(),
    tags: getAllTags().map(({ tag, count }) => ({ tag, count })),
    categories: getAllCategories().map(({ category, label, count }) => ({
      category,
      label,
      count,
    })),
  };
}
