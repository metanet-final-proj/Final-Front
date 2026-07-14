const hasMessageId = (message, targetId) => {
  if (!message || !targetId) return false

  return [message.id, message.messageId]
    .filter(Boolean)
    .some((messageId) => String(messageId) === String(targetId))
}

export const hasTrackedAssistantMessage = (
  messages = [],
  inFlight = null,
) => {
  const assistantMessageId = inFlight?.assistantMessageId

  if (!assistantMessageId) return false

  return messages.some((message) => hasMessageId(message, assistantMessageId))
}

export const mergeFetchedMessagesWithInFlight = (
  serverMessages = [],
  cachedMessages = [],
  inFlight = null,
) => {
  const assistantMessageId = inFlight?.assistantMessageId

  if (!assistantMessageId) return serverMessages

  const inFlightAssistant = cachedMessages.find((message) =>
    hasMessageId(message, assistantMessageId),
  )

  if (!inFlightAssistant) return serverMessages

  const serverAlreadyContainsAssistant = hasTrackedAssistantMessage(
    serverMessages,
    inFlight,
  )

  if (serverAlreadyContainsAssistant) return serverMessages

  return [...serverMessages, inFlightAssistant]
}
