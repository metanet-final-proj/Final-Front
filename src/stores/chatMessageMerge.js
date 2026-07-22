const hasMessageId = (message, targetId) => {
  if (!message || !targetId) return false

  return [message.id, message.messageId]
    .filter(Boolean)
    .some((messageId) => String(messageId) === String(targetId))
}

const normalizedText = (message) => String(
  message?.text ?? message?.content ?? '',
).trim()

const isEquivalentPersistedAssistant = (serverMessage, localMessage) => {
  if (serverMessage?.role !== 'assistant' || localMessage?.role !== 'assistant') {
    return false
  }

  const serverText = normalizedText(serverMessage)
  const localText = normalizedText(localMessage)

  return Boolean(serverText && localText && serverText === localText)
}

const mergePersistedAssistantWithInFlight = (serverMessage, inFlightAssistant) => ({
  ...serverMessage,
  id: inFlightAssistant.id,
  messageId: serverMessage.messageId ?? serverMessage.id,
  agentActivity: inFlightAssistant.agentActivity || serverMessage.agentActivity || null,
  isLocal: true,
  isLoading: inFlightAssistant.isLoading,
})

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

  const equivalentServerAssistant = serverMessages.find((message) =>
    isEquivalentPersistedAssistant(message, inFlightAssistant),
  )

  if (equivalentServerAssistant) {
    return serverMessages.map((message) => (
      message === equivalentServerAssistant
        ? mergePersistedAssistantWithInFlight(message, inFlightAssistant)
        : message
    ))
  }

  return [...serverMessages, inFlightAssistant]
}
