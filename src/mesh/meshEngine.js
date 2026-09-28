import { decryptAesGcm, encryptAesGcm } from '../crypto/aesGcm.js'
import { buildNeighbourMap, cloneNodes, getDistance } from './nodes.js'

const MAX_TTL = 4

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function appendInbox(node, entry) {
  return {
    ...node,
    inbox: [
      {
        ...entry,
        at: timestamp(),
      },
      ...node.inbox,
    ].slice(0, 12),
  }
}

export async function sendMeshMessage(nodes, sourceId, text, targetId = 'all') {
  const nextNodes = cloneNodes(nodes)
  const source = nextNodes.find((node) => node.id === sourceId)

  if (!source) {
    return { nodes: nextNodes, log: 'Source node not found.' }
  }

  const packet = {
    id: `pkt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    from: sourceId,
    to: targetId,
    kind: 'message',
    ttl: MAX_TTL,
    path: [sourceId],
    encrypted: await encryptAesGcm(text),
  }

  const seen = new Set([sourceId])
  const queue = [sourceId]
  const relayLog = []
  const targetIds = targetId === 'all' ? nextNodes.map((node) => node.id).filter((id) => id !== sourceId) : [targetId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    const currentNode = nextNodes.find((node) => node.id === currentId)
    const neighbours = buildNeighbourMap(nextNodes)[currentId] || []

    for (const neighbourId of neighbours) {
      if (seen.has(neighbourId)) continue
      seen.add(neighbourId)
      queue.push(neighbourId)
      relayLog.push(`${currentId} → ${neighbourId} relay`)
    }
  }

  const recipients = targetId === 'all'
    ? nextNodes.filter((node) => node.id !== sourceId).map((node) => node.id)
    : [targetId]

  for (const recipientId of recipients) {
    const recipient = nextNodes.find((node) => node.id === recipientId)
    if (!recipient) continue

    recipient.alert = 'message'
    const decryptedBody = await decryptAesGcm(packet.encrypted)
    const messageEntry = {
      uuid: packet.id,
      from: sourceId,
      to: recipientId,
      type: 'message',
      content: decryptedBody,
      relay: relayLog.length > 0 ? relayLog[0] : 'direct',
      encrypted: packet.encrypted,
    }

    const index = nextNodes.findIndex((node) => node.id === recipientId)
    nextNodes[index] = appendInbox(recipient, messageEntry)
  }

  const sourceIndex = nextNodes.findIndex((node) => node.id === sourceId)
  nextNodes[sourceIndex] = appendInbox(source, {
    uuid: packet.id,
    from: sourceId,
    to: targetId,
    type: 'sent',
    content: text,
    relay: relayLog.length > 0 ? relayLog[0] : 'direct',
  })

  return {
    nodes: nextNodes,
    packet,
    log: `Message relayed from ${sourceId} to ${recipients.join(', ')}`,
  }
}

export async function relayMessage(nodes, sourceId, messageText) {
  const nextNodes = cloneNodes(nodes)
  const source = nextNodes.find((node) => node.id === sourceId)

  if (!source) {
    return { nodes: nextNodes, log: 'Relay source missing.' }
  }

  const encrypted = await encryptAesGcm(messageText)
  const finalTarget = nextNodes.find((node) => node.id !== sourceId)

  for (const node of nextNodes) {
    if (node.id === sourceId || node.id === finalTarget.id) {
      const entry = {
        uuid: `relay-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        from: sourceId,
        to: node.id,
        type: 'relay',
        content: messageText,
        relay: `${sourceId} forwarded payload`,
        encrypted,
      }
      const nodeIndex = nextNodes.findIndex((entryNode) => entryNode.id === node.id)
      nextNodes[nodeIndex] = appendInbox(node, entry)
      node.alert = 'relay'
    }
  }

  return {
    nodes: nextNodes,
    log: `Relay trigger sent from ${sourceId} across the mesh`,
  }
}

export function triggerSos(nodes, sourceId) {
  const nextNodes = cloneNodes(nodes)

  for (const node of nextNodes) {
    node.alert = node.id === sourceId ? 'sos' : 'warning'
    node.status = node.id === sourceId ? 'emergency' : node.status
    node.inbox = [
      {
        uuid: `sos-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        from: sourceId,
        to: node.id,
        type: 'sos',
        content: `SOS from ${sourceId}. Immediate extraction required.`,
        relay: 'emergency broadcast',
        at: timestamp(),
      },
      ...node.inbox,
    ].slice(0, 12)
  }

  return {
    nodes: nextNodes,
    log: `Emergency SOS broadcast initiated by ${sourceId}`,
  }
}

export function pulseGps(nodes, nodeId) {
  const nextNodes = cloneNodes(nodes)

  for (const node of nextNodes) {
    const driftX = (Math.random() - 0.5) * 6
    const driftY = (Math.random() - 0.5) * 6

    node.x = Math.min(100, Math.max(0, node.x + driftX))
    node.y = Math.min(100, Math.max(0, node.y + driftY))
    node.signal = Math.max(70, Math.min(100, node.signal + 2))
    node.gps = {
      lat: Number((node.gps.lat + (Math.random() - 0.5) * 0.0008).toFixed(5)),
      lng: Number((node.gps.lng + (Math.random() - 0.5) * 0.0008).toFixed(5)),
    }

    if (node.id === nodeId) {
      node.alert = 'gps'
      node.inbox = [{
        uuid: `gps-${Date.now()}`,
        from: nodeId,
        to: 'all',
        type: 'gps',
        content: `GPS pulse received: ${node.gps.lat}, ${node.gps.lng}`,
        relay: 'location update',
        at: timestamp(),
      }, ...node.inbox].slice(0, 12)
    }
  }

  return {
    nodes: nextNodes,
    log: `GPS refresh signal broadcast from ${nodeId}`,
  }
}

export function findReachableNodes(nodes, sourceId, maxDistance = 26) {
  const source = nodes.find((node) => node.id === sourceId)
  if (!source) return []

  const visited = new Set([sourceId])
  const queue = [source]

  while (queue.length > 0) {
    const current = queue.shift()
    for (const node of nodes) {
      if (visited.has(node.id)) continue
      if (getDistance(current, node) <= maxDistance) {
        visited.add(node.id)
        queue.push(node)
      }
    }
  }

  return Array.from(visited)
}
