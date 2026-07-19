import { config } from "./config";

export function getFetchOptions(additionalOptions: RequestInit = {}): RequestInit {
  if (config.sslVerify) return additionalOptions;

  const bunOptions = additionalOptions as RequestInit & { tls?: { rejectUnauthorized?: boolean } };

  return {
    ...additionalOptions,
    tls: {
      rejectUnauthorized: false,
      ...bunOptions.tls,
    },
  } as RequestInit;
}
