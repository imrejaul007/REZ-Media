import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger';
import type { ShopifyProduct, ShopifyCustomer } from '../types';

// ── Storefront GraphQL Client ──────────────────────────────────────────────────

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string; locations?: unknown[]; path?: string[] }[];
}

export class ShopifyStorefrontClient {
  private readonly domain: string;
  private readonly accessToken: string;
  private readonly client: AxiosInstance;

  constructor(domain: string, accessToken: string) {
    this.domain = domain.toLowerCase();
    this.accessToken = accessToken;
    this.client = axios.create({
      baseURL: `https://${this.domain}/api/2024-01/graphql.json`,
      headers: {
        'X-Shopify-Storefront-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    });
  }

  // ── GraphQL Request ─────────────────────────────────────────────────────────

  async graphql<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    try {
      const response = await this.client.post<GraphQLResponse<T>>('', {
        query,
        variables,
      });

      if (response.data.errors?.length) {
        const errorMessages = response.data.errors.map((e) => e.message).join(', ');
        logger.error(`[StorefrontClient] GraphQL errors: ${errorMessages}`);
        throw new Error(`GraphQL error: ${errorMessages}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error(`[StorefrontClient] GraphQL request failed:`, error);
      throw error;
    }
  }

  // ── Products ────────────────────────────────────────────────────────────────

  async getProducts(first = 20, after?: string): Promise<{
    products: {
      edges: { node: StorefrontProduct; cursor: string }[];
      pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
    };
  }> {
    const query = `
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              description
              descriptionHtml
              handle
              tags
              vendor
              productType
              status
              createdAt
              updatedAt
              publishedAt
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                    inventoryQuantity
                    inventoryPolicy
                    weight
                    weightUnit
                    barcode
                    image { url altText }
                  }
                }
              }
              images(first: 10) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              options {
                name
                values
              }
              metafields(first: 50) {
                edges {
                  node {
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    return this.graphql(query, { first, after });
  }

  async getProductByHandle(handle: string): Promise<{
    product: StorefrontProduct | null;
  } | null> {
    const query = `
      query getProductByHandle($handle: String!) {
        product(handle: $handle) {
          id
          title
          description
          descriptionHtml
          handle
          tags
          vendor
          productType
          status
          createdAt
          updatedAt
          publishedAt
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price { amount currencyCode }
                compareAtPrice { amount currencyCode }
                inventoryQuantity
                inventoryPolicy
                weight
                weightUnit
                barcode
                image { url altText }
              }
            }
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
                width
                height
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    `;

    return this.graphql(query, { handle });
  }

  // ── Collections ───────────────────────────────────────────────────────────────

  async getCollections(first = 20): Promise<{
    collections: {
      edges: { node: StorefrontCollection; cursor: string }[];
      pageInfo: { hasNextPage: boolean };
    };
  }> {
    const query = `
      query getCollections($first: Int!) {
        collections(first: $first) {
          edges {
            node {
              id
              title
              handle
              description
              descriptionHtml
              image { url altText }
              products(first: 100) {
                edges {
                  node { id }
                  cursor
                }
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    return this.graphql(query, { first });
  }

  // ── Customers ───────────────────────────────────────────────────────────────

  async createCustomer(
    input: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      password?: string;
      acceptMarketing?: boolean;
    },
    accessToken?: string
  ): Promise<{ customer: StorefrontCustomer | null; customerUserErrors: unknown[] }> {
    const query = `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            createdAt
            updatedAt
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.graphql(query, { input });
  }

  async updateCustomer(
    customerAccessToken: string,
    input: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      acceptMarketing?: boolean;
    }
  ): Promise<{ customer: StorefrontCustomer | null; customerUserErrors: unknown[] }> {
    const query = `
      mutation customerUpdate($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
        customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
          customer {
            id
            email
            firstName
            lastName
            phone
            acceptsMarketing
            updatedAt
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    return this.graphql(query, { customerAccessToken, customer: input });
  }

  // ── Cart Operations ─────────────────────────────────────────────────────────

  async createCart(): Promise<{ cart: StorefrontCart }> {
    const query = `
      mutation cartCreate {
        cartCreate {
          cart {
            id
            checkoutUrl
            totalQuantity
            cost {
              subtotalAmount { amount currencyCode }
              totalAmount { amount currencyCode }
              totalTaxAmount { amount currencyCode }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    const result = await this.graphql<{
      cartCreate: { cart: StorefrontCart };
    }>(query);

    return result.cartCreate;
  }

  async addCartLines(
    cartId: string,
    lines: { merchandiseId: string; quantity: number }[]
  ): Promise<{ cart: StorefrontCart }> {
    const query = `
      mutation addCartLines($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            totalQuantity
            lines(first: 100) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price { amount currencyCode }
                      product { title }
                    }
                  }
                }
              }
            }
            cost {
              subtotalAmount { amount currencyCode }
              totalAmount { amount currencyCode }
              totalTaxAmount { amount currencyCode }
            }
          }
          userErrors {
            code
            field
            message
          }
        }
      }
    `;

    const result = await this.graphql<{
      cartLinesAdd: { cart: StorefrontCart };
    }>(query, { cartId, lines });

    return result.cartLinesAdd;
  }

  // ── Lookup ───────────────────────────────────────────────────────────────────

  async lookupCustomerByEmail(email: string): Promise<StorefrontCustomer | null> {
    const query = `
      query customerLookup($email: String!) {
        customer(email: $email) {
          id
          email
          firstName
          lastName
          phone
          acceptsMarketing
          createdAt
          updatedAt
          addresses(first: 10) {
            edges {
              node {
                id
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
                isDefault
              }
            }
          }
        }
      }
    `;

    const result = await this.graphql<{
      customer: StorefrontCustomer | null;
    }>(query, { email: email.toLowerCase() });

    return result.customer;
  }
}

// ── Storefront Types ───────────────────────────────────────────────────────────

interface StorefrontProduct {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  handle: string;
  tags: string;
  vendor: string;
  productType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  variants: {
    edges: {
      node: {
        id: string;
        title: string;
        sku: string;
        price: { amount: string; currencyCode: string };
        compareAtPrice: { amount: string; currencyCode: string } | null;
        inventoryQuantity: number;
        inventoryPolicy: string;
        weight: number;
        weightUnit: string;
        barcode: string;
        image: { url: string; altText: string | null } | null;
      };
    }[];
  };
  images: {
    edges: {
      node: {
        url: string;
        altText: string | null;
        width: number;
        height: number;
      };
    }[];
  };
  options: { name: string; values: string[] }[];
  metafields?: {
    edges: { node: { namespace: string; key: string; value: string; type: string } }[];
  };
}

interface StorefrontCollection {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  image: { url: string; altText: string | null } | null;
  products: {
    edges: { node: { id: string }; cursor: string }[];
  };
}

interface StorefrontCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  acceptsMarketing: boolean;
  createdAt: string;
  updatedAt: string;
  addresses?: {
    edges: {
      node: {
        id: string;
        firstName: string;
        lastName: string;
        address1: string;
        address2: string | null;
        city: string;
        province: string;
        country: string;
        zip: string;
        phone: string | null;
        isDefault: boolean;
      };
    }[];
  };
}

interface StorefrontCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines?: {
    edges: {
      node: {
        id: string;
        quantity: number;
        merchandise: {
          id: string;
          title: string;
          price: { amount: string; currencyCode: string };
          product: { title: string };
        };
      };
    }[];
  };
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
    totalTaxAmount: { amount: string; currencyCode: string } | null;
  };
}
