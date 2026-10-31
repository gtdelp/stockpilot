/** Producto del inventario. */
export interface Product {
  /** Identificador único. */
  id: number;
  /** Código de producto (SKU). */
  sku: string;
  /** Nombre. */
  name: string;
  /** Identificador de la categoría. */
  categoryId: number;
  /** Nombre de la categoría. */
  categoryName: string;
  /** Identificador del proveedor. */
  supplierId: number;
  /** Nombre del proveedor. */
  supplierName: string;
  /** Precio unitario en euros. */
  price: number;
  /** Unidades disponibles. */
  stock: number;
  /** Umbral a partir del cual se considera stock bajo. */
  minStock: number;
  /** Indica si está activo. */
  active: boolean;
  /** Última modificación (ISO 8601). */
  updatedAt: string;
}

/** Datos editables de un producto. */
export interface ProductInput {
  /** Código de producto (SKU). */
  sku: string;
  /** Nombre. */
  name: string;
  /** Identificador de la categoría. */
  categoryId: number;
  /** Identificador del proveedor. */
  supplierId: number;
  /** Precio unitario en euros. */
  price: number;
  /** Unidades disponibles. */
  stock: number;
  /** Stock mínimo antes de considerarse bajo. */
  minStock: number;
  /** Indica si está activo. */
  active: boolean;
}

/** Indica si un producto está por debajo de su stock mínimo. */
export function isLowStock(product: Pick<Product, 'stock' | 'minStock'>): boolean {
  return product.stock <= product.minStock;
}
