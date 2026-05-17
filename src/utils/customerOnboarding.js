/** Where a customer should land after signup OTP verification. */
export function customerPostAuthPath(verifyResult, fallbackFrom) {
  const fromApi = verifyResult?.redirectPath;
  if (typeof fromApi === "string" && fromApi.trim()) return fromApi.trim();
  if (typeof fallbackFrom === "string" && fallbackFrom.trim()) return fallbackFrom.trim();
  return "/customer/dashboard";
}
