import zhTWMessages from "./locales/zh-TW";

type LooseMessageTree = {
  [key: string]: string | LooseMessageTree;
};

type DeepPartialMessages<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartialMessages<T[K]>;
} & LooseMessageTree;

export type Messages = DeepPartialMessages<typeof zhTWMessages>;
