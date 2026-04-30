const SUPABASE_QUERY_LOGGER_ENABLED = process.env.NODE_ENV !== "production";
const LOGGER_STACK_IGNORE_PATTERNS = [
  "supabaseQueryLogger",
  "instrumentSupabaseClient",
  "node_modules",
];

function isThenable(value) {
  return Boolean(
    value &&
      (typeof value === "object" || typeof value === "function") &&
      typeof value.then === "function",
  );
}

function summarizeSupabaseError(error) {
  return {
    code: error?.code || "",
    message: error?.message || "",
    details: error?.details || "",
    hint: error?.hint || "",
  };
}

function getApproximateRowCount(result) {
  if (typeof result?.count === "number") {
    return result.count;
  }

  if (Array.isArray(result?.data)) {
    return result.data.length;
  }

  return result?.data == null ? 0 : 1;
}

function normalizeStackFrame(frame) {
  return String(frame || "")
    .trim()
    .replace(/^at\s+/, "");
}

function captureQuerySource() {
  try {
    throw new Error("supabase-query-source");
  } catch (error) {
    const stackLines = String(error?.stack || "")
      .split("\n")
      .map(normalizeStackFrame)
      .filter((line) => Boolean(line) && !line.startsWith("Error:"));

    const sourceLine = stackLines.find((line) =>
      LOGGER_STACK_IGNORE_PATTERNS.every((pattern) => !line.includes(pattern)),
    );

    return sourceLine || "unknown";
  }
}

function logQueryResult(meta, result) {
  if (!SUPABASE_QUERY_LOGGER_ENABLED || meta.logged) {
    return;
  }

  meta.logged = true;

  const label = meta.kind === "rpc" ? `rpc:${meta.rpcName}` : meta.tableName;
  console.info("[Supabase Query]", {
    client: meta.clientName,
    table: meta.kind === "table" ? meta.tableName : null,
    rpc: meta.kind === "rpc" ? meta.rpcName : null,
    target: label,
    selectedColumns: meta.selectedColumns || null,
    source: meta.source,
    timestamp: meta.startedAt,
    approximateRowCount: getApproximateRowCount(result),
    error: result?.error ? summarizeSupabaseError(result.error) : null,
  });
}

function wrapPostgrestBuilder(builder, meta) {
  if (!SUPABASE_QUERY_LOGGER_ENABLED || !isThenable(builder)) {
    return builder;
  }

  return new Proxy(builder, {
    get(target, property, receiver) {
      if (property === "__supabaseLoggerWrapped") {
        return true;
      }

      const value = Reflect.get(target, property, receiver);

      if (property === "then" && typeof value === "function") {
        return (onFulfilled, onRejected) =>
          value.call(
            target,
            (result) => {
              logQueryResult(meta, result);
              return typeof onFulfilled === "function" ? onFulfilled(result) : result;
            },
            (error) => {
              logQueryResult(meta, {
                data: null,
                count: null,
                error,
              });
              if (typeof onRejected === "function") {
                return onRejected(error);
              }

              throw error;
            },
          );
      }

      if (typeof value !== "function") {
        return value;
      }

      return (...args) => {
        const nextMeta = {
          ...meta,
        };

        if (property === "select" && typeof args[0] === "string") {
          nextMeta.selectedColumns = args[0];
        }

        const nextValue = value.apply(target, args);
        return isThenable(nextValue) && !nextValue?.__supabaseLoggerWrapped
          ? wrapPostgrestBuilder(nextValue, nextMeta)
          : nextValue;
      };
    },
  });
}

export function instrumentSupabaseClient(client, { clientName = "unknown" } = {}) {
  if (!SUPABASE_QUERY_LOGGER_ENABLED || !client || client.__supabaseLoggerWrappedClient) {
    return client;
  }

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "__supabaseLoggerWrappedClient") {
        return true;
      }

      const value = Reflect.get(target, property, receiver);

      if (property === "from" && typeof value === "function") {
        return (tableName) =>
          wrapPostgrestBuilder(value.call(target, tableName), {
            clientName,
            kind: "table",
            tableName,
            rpcName: null,
            selectedColumns: null,
            source: captureQuerySource(),
            startedAt: new Date().toISOString(),
            logged: false,
          });
      }

      if (property === "rpc" && typeof value === "function") {
        return (rpcName, ...args) =>
          wrapPostgrestBuilder(value.call(target, rpcName, ...args), {
            clientName,
            kind: "rpc",
            tableName: null,
            rpcName,
            selectedColumns: null,
            source: captureQuerySource(),
            startedAt: new Date().toISOString(),
            logged: false,
          });
      }

      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
