export const getConversationId = (userA, userB) =>
  [userA, userB]
    .filter(Boolean)
    .map((value) => String(value))
    .sort()
    .join("-");
