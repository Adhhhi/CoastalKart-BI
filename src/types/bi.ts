export type PageId =
  | 'executive'
  | 'sales'
  | 'customers'
  | 'inventory'
  | 'logistics'
  | 'products'
  | 'insights'
  | 'sql'
  | 'quality';

export interface GlobalFilters {
  startDate: string;
  endDate: string;
  city: string;
  branchId: string;
  category: string;
  paymentMethod: string;
  search: string;
}

export interface BranchOption {
  branch_id: string;
  branch_name: string;
  city: string;
  state: string;
  region: string;
}

export interface FilterMetadata {
  branches: BranchOption[];
  cities: string[];
  categories: string[];
  paymentMethods: string[];
  minDate: string;
  maxDate: string;
}

export interface SqlCatalogItem {
  id: string;
  file: string;
  domain: string;
  title: string;
  question: string;
  explanation: string;
  recommendation: string;
  sql: string;
}
