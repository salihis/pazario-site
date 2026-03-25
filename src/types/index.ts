export enum SyncStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum Marketplace {
  TRENDYOL = 'TRENDYOL',
  HEPSIBURADA = 'HEPSIBURADA',
  N11 = 'N11',
  PAZARAMA = 'PAZARAMA',
  AMAZON = 'AMAZON',
}

export enum ListingStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
  DELISTED = 'DELISTED',
}

export enum ScopeType {
  GLOBAL = 'GLOBAL',
  MARKETPLACE = 'MARKETPLACE',
  CATEGORY = 'CATEGORY',
  BRAND = 'BRAND',
  PRODUCT = 'PRODUCT',
}

export enum MappingStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum OrderStatus {
  NEW = 'NEW',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PREPARING = 'PREPARING',
  LABEL_CREATED = 'LABEL_CREATED',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED',
  CANCELLED = 'CANCELLED',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURN_APPROVED = 'RETURN_APPROVED',
  RETURN_REJECTED = 'RETURN_REJECTED',
  RETURNED = 'RETURNED',
  REFUNDED = 'REFUNDED',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
}

export interface Product {
  id: string;
  sourceId: string;
  externalId: string;
  sku: string;
  barcode?: string | null;
  title: string;
  description?: string | null;
  brand?: string | null;
  categoryRaw?: string | null;
  price: number;
  listPrice?: number | null;
  currency: string;
  stock: number;
  images: string[];
  contentHash: string;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryMapping {
  id: string;
  sourceId: string;
  sourceCategory: string;
  marketplace: Marketplace;
  marketplaceCategoryId?: string | null;
  marketplaceCategoryPath?: string | null;
  status: MappingStatus;
  aiSuggested: boolean;
  aiConfidence?: number | null;
}

export interface PriceRule {
  id: string;
  name: string;
  marketplace: string;
  scopeType: ScopeType;
  scopeValue?: string | null;
  ekTutar: number;
  karOrani: number;
  kargo: number;
  komisyonOrani: number;
  priority: number;
  active: boolean;
}

export interface SyncJob {
  id: string;
  sourceId: string;
  status: SyncStatus;
  totalProducts?: number | null;
  changedProducts?: number | null;
  publishedCount?: number | null;
  failedCount?: number | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface Order {
  id: string;
  marketplace: Marketplace;
  marketplaceOrderId: string;
  status: OrderStatus;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  billingAddress?: string | null;
  totalAmount: number;
  currency: string;
  cargoCompany?: string | null;
  trackingNumber?: string | null;
  cargoLabelUrl?: string | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId?: string | null;
  marketplaceProductId?: string | null;
  sku?: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
