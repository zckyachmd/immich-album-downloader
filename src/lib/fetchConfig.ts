export function getFetchOptions(
  additionalOptions: RequestInit = {},
  sslVerify = true
): RequestInit {
  if (sslVerify) return additionalOptions;

  const bunOptions = additionalOptions as RequestInit & { tls?: { rejectUnauthorized?: boolean } };

  return {
    ...additionalOptions,
    tls: {
      rejectUnauthorized: false,
      ...bunOptions.tls,
    },
  } as RequestInit;
}
