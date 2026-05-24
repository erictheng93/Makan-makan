/**
 * Ambient module declarations for packages whose types aren't resolved
 * under `moduleResolution: "bundler"`.
 *
 * Both packages are installed with proper type declarations, but the bundler
 * resolution mode requires a CJS-compatible exports map that these older
 * packages don't expose correctly in their package.json.
 */

// qrcode — @types/qrcode is installed but its package.json has an empty "main"
// field which breaks bundler-mode type resolution.
declare module "qrcode" {
  interface QRCodeOptions {
    version?: number;
    errorCorrectionLevel?:
      | "L"
      | "M"
      | "Q"
      | "H"
      | "low"
      | "medium"
      | "quartile"
      | "high";
    type?: string;
    quality?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    width?: number;
    scale?: number;
  }
  function toString(text: string, options?: QRCodeOptions): Promise<string>;
  function toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>;
  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  function toCanvas(
    canvas: unknown,
    text: string,
    options?: QRCodeOptions,
  ): Promise<void>;
  function toFile(
    path: string,
    text: string,
    options?: QRCodeOptions,
  ): Promise<void>;
}

// fflate — ships bundled types, but its nested exports map isn't resolved
// correctly by tsc under bundler mode.
declare module "fflate" {
  interface ZipOptions {
    level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    mem?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
    mtime?: Date | string | number;
    comment?: string;
    filename?: string;
    consume?: boolean;
  }
  function strToU8(str: string, latin1?: boolean): Uint8Array;
  function zipSync(
    files: Record<string, Uint8Array | [Uint8Array, ZipOptions]>,
    opts?: ZipOptions,
  ): Uint8Array;
}

/**
 * Shared loose response shape for API tests that inspect JSON payloads.
 * The runtime contract is still validated by assertions in each test; this
 * type only replaces historical loose response casts.
 */
type ApiTestJsonPrimitive = string | number | boolean | null | undefined;
type ApiTestJsonValue =
  | ApiTestJsonPrimitive
  | ApiTestJsonObject
  | ApiTestJsonValue[];

interface ApiTestJsonObject {
  [key: string]: ApiTestJsonValue;
}

interface ApiTestEntity {
  [key: string]: ApiTestJsonValue | ApiTestEntity | ApiTestEntity[];
  [key: number]: ApiTestEntity;
  id: never;
  name: string;
  username: string;
  role: string | number;
  profile: ApiTestEntity;
  restaurantId: string;
  restaurantName: string;
  groupOrderId: string;
  shareCode: string;
  memberId: string;
  memberName: string;
  itemId: string;
  isHost: boolean;
  price: number;
  timestamp: string;
  payload: ApiTestEntity;
  host: ApiTestEntity;
  member: ApiTestEntity;
  groupOrder: ApiTestEntity;
  user: ApiTestEntity;
  session: ApiTestEntity;
  categories: ApiTestEntity[];
  menuItems: ApiTestEntity[];
  members: ApiTestEntity[];
  cartItems: ApiTestEntity[];
  results: ApiTestEntity[];
  items: (ApiTestEntity & string)[];
  rules: ApiTestEntity[];
  connections: ApiTestEntity[];
  pagination: ApiTestPagination;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  scope: string;
  orderId: string | number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  token: string;
}

interface ApiTestPagination {
  [key: string]: number;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ApiTestData = ApiTestEntity & ApiTestEntity[];

interface ApiTestResponse<TData = ApiTestData> {
  success: boolean;
  data: TData;
  error: {
    code: string;
    message: string;
    details: ApiTestEntity[];
  };
  message: string;
  pagination: ApiTestPagination;
  user: ApiTestEntity;
  session: ApiTestEntity;
  items: (ApiTestEntity & string)[];
  results: ApiTestEntity[];
  connections: ApiTestEntity[];
  [key: string]: ApiTestJsonValue | TData | ApiTestEntity | ApiTestEntity[];
}

type ApiTestEnv = import("./env").Env;
type ApiTestRequestInit = RequestInit & { env: unknown };
type ApiTestContextWithEnv = {
  env: ApiTestEnv;
  set(key: string, value: unknown): void;
  get<T = unknown>(key: string): T;
};
type ApiTestContextWithTestData = ApiTestContextWithEnv & {
  testBody?: unknown;
  testQuery?: unknown;
  testParams?: unknown;
};
type ApiTestAppWithEnv = {
  env?: {};
};
