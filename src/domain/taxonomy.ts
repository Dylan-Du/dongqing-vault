export interface Category {
  id: string;
  name: string;
  nameKey: string;
  color: string;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag extends Category {}

export interface CategoryListItem extends Category {
  siteCount: number;
}

export interface TagListItem extends Tag {
  siteCount: number;
}

export interface TaxonomySnapshot {
  categories: CategoryListItem[];
  tags: TagListItem[];
}
