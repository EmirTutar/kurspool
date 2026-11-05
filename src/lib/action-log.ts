/** What a failed action writes to the server log. Database details are left out because they can contain personal data. */
export function describeActionError(action: string, error: unknown) {
  const { name, code, message } = (typeof error === "object" && error !== null ? error : {}) as {
    name?: string;
    code?: string;
    message?: string;
  };
  return { action, name: name ?? "unknown", code, message };
}
