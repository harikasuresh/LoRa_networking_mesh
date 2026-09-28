export const DEFAULT_NODES = [
  {
    id: 'Node A',
    name: 'Node A',
    x: 22,
    y: 28,
    signal: 94,
    battery: 96,
    status: 'online',
    gps: { lat: 34.0837, lng: 74.7973 },
    role: 'Squad lead',
    inbox: [],
    alert: 'clear',
  },
  {
    id: 'Node B',
    name: 'Node B',
    x: 36,
    y: 45,
    signal: 91,
    battery: 92,
    status: 'online',
    gps: { lat: 34.0842, lng: 74.7989 },
    role: 'Recon',
    inbox: [],
    alert: 'clear',
  },
  {
    id: 'Node C',
    name: 'Node C',
    x: 50,
    y: 35,
    signal: 88,
    battery: 90,
    status: 'online',
    gps: { lat: 34.0848, lng: 74.7968 },
    role: 'Medic',
    inbox: [],
    alert: 'clear',
  },
  {
    id: 'Node D',
    name: 'Node D',
    x: 62,
    y: 60,
    signal: 86,
    battery: 89,
    status: 'online',
    gps: { lat: 34.0854, lng: 74.8002 },
    role: 'Logistics',
    inbox: [],
    alert: 'clear',
  },
  {
    id: 'Node E',
    name: 'Node E',
    x: 74,
    y: 52,
    signal: 82,
    battery: 87,
    status: 'online',
    gps: { lat: 34.086, lng: 74.7995 },
    role: 'Support',
    inbox: [],
    alert: 'clear',
  },
]

export function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function buildNeighbourMap(nodes, maxDistance = 24) {
  return nodes.reduce((acc, node) => {
    acc[node.id] = nodes
      .filter((candidate) => candidate.id !== node.id)
      .filter((candidate) => getDistance(node, candidate) <= maxDistance)
      .map((candidate) => candidate.id)
    return acc
  }, {})
}

export function cloneNodes(nodes) {
  return nodes.map((node) => ({
    ...node,
    gps: { ...node.gps },
    inbox: node.inbox.map((entry) => ({ ...entry })),
  }))
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
