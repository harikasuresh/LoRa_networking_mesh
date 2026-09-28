import { useMemo, useState } from 'react'
import './App.css'
import { DEFAULT_NODES } from './mesh/nodes'
import { buildNeighbourMap, findReachableNodes } from './mesh/nodes.js'
import { pulseGps, relayMessage, sendMeshMessage, triggerSos } from './mesh/meshEngine.js'

const initialLogs = [
  'Mesh uplink stable. Secure tunnel verified.',
  'Node A heartbeat acknowledged by relay backbone.',
  'GPS frame refresh synchronized across squad.',
]

function App() {
  const [nodes, setNodes] = useState(DEFAULT_NODES)
  const [sourceId, setSourceId] = useState('Node A')
  const [targetId, setTargetId] = useState('Node B')
  const [message, setMessage] = useState('Ridge movement detected. Hold the fallback route and maintain silent relay.')
  const [selectedNodeId, setSelectedNodeId] = useState('Node A')
  const [logs, setLogs] = useState(initialLogs)

  const neighbourMap = useMemo(() => buildNeighbourMap(nodes), [nodes])
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0]
  const reachableNodes = useMemo(
    () => findReachableNodes(nodes, selectedNodeId),
    [nodes, selectedNodeId],
  )

  const stats = useMemo(() => {
    const online = nodes.filter((node) => node.status !== 'offline').length
    const emergency = nodes.filter((node) => node.status === 'emergency').length
    const avgBattery = Math.round(
      nodes.reduce((sum, node) => sum + node.battery, 0) / nodes.length,
    )
    const avgSignal = Math.round(
      nodes.reduce((sum, node) => sum + node.signal, 0) / nodes.length,
    )

    return { online, emergency, avgBattery, avgSignal }
  }, [nodes])

  const addLog = (entry) => {
    setLogs((current) => [entry, ...current].slice(0, 8))
  }

  const applyResult = (result) => {
    if (result?.nodes) {
      setNodes(result.nodes)
    }

    if (result?.log) {
      addLog(result.log)
    }
  }

  const handleSend = async () => {
    if (!message.trim()) return

    const result = await sendMeshMessage(nodes, sourceId, message, targetId)
    applyResult(result)
  }

  const handleRelay = async () => {
    const result = await relayMessage(nodes, sourceId, message || 'Relay packet forwarded to neighbouring node')
    applyResult(result)
  }

  const triggerEmergency = () => {
    const result = triggerSos(nodes, sourceId)
    applyResult(result)
  }

  const refreshGps = () => {
    const result = pulseGps(nodes, sourceId)
    applyResult(result)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Secure LoRa Mesh</p>
          <h1>Field Ops Communications System</h1>
        </div>
        <div className="system-pill">AES-128-GCM active</div>
      </header>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Nodes online</span>
          <strong>{stats.online}/5</strong>
        </article>
        <article className="stat-card">
          <span>Avg signal</span>
          <strong>{stats.avgSignal}%</strong>
        </article>
        <article className="stat-card">
          <span>Avg battery</span>
          <strong>{stats.avgBattery}%</strong>
        </article>
        <article className="stat-card">
          <span>Emergency</span>
          <strong>{stats.emergency}</strong>
        </article>
      </section>

      <main className="dashboard-grid">
        <section className="panel battlefield-panel">
          <div className="panel-header">
            <h2>Mesh topology</h2>
            <span className="chip chip-live">Live relay</span>
          </div>

          <div className="battlefield">
            <svg className="link-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              {Object.entries(neighbourMap).flatMap(([from, neighbours]) =>
                neighbours.map((to) => {
                  const fromNode = nodes.find((node) => node.id === from)
                  const toNode = nodes.find((node) => node.id === to)
                  if (!fromNode || !toNode) return null
                  return (
                    <line
                      key={`${from}-${to}`}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke="rgba(72, 255, 200, 0.42)"
                      strokeWidth="0.8"
                    />
                  )
                }),
              )}
            </svg>

            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`node ${selectedNodeId === node.id ? 'selected' : ''} ${node.alert}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <span className="node-dot" />
                {node.id}
                <small>{node.signal}%</small>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel inspector-panel">
          <div className="panel-header">
            <h2>Node inspector</h2>
            <span className="chip">{selectedNode?.status}</span>
          </div>

          <div className="node-card">
            <h3>{selectedNode?.id}</h3>
            <p>{selectedNode?.role}</p>
            <ul>
              <li>
                <span>Battery</span>
                <strong>{selectedNode?.battery}%</strong>
              </li>
              <li>
                <span>Signal</span>
                <strong>{selectedNode?.signal}%</strong>
              </li>
              <li>
                <span>GPS</span>
                <strong>
                  {selectedNode?.gps?.lat}, {selectedNode?.gps?.lng}
                </strong>
              </li>
              <li>
                <span>Reachable</span>
                <strong>{reachableNodes.length}</strong>
              </li>
            </ul>
          </div>

          <div className="mini-matrix">
            <h4>Active links</h4>
            <div className="chip-list">
              {(neighbourMap[selectedNode?.id] || []).map((neighbour) => (
                <span key={`${selectedNode?.id}-${neighbour}`} className="chip chip-link">
                  {neighbour}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel command-panel">
          <div className="panel-header">
            <h2>Secure command</h2>
            <span className="chip chip-alert">Encrypted</span>
          </div>

          <div className="control-grid">
            <label>
              Source node
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.id}</option>
                ))}
              </select>
            </label>

            <label>
              Destination
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                {nodes
                  .filter((node) => node.id !== sourceId)
                  .map((node) => (
                    <option key={node.id} value={node.id}>{node.id}</option>
                  ))}
                <option value="all">Broadcast to all</option>
              </select>
            </label>
          </div>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows="5"
            placeholder="Type secure field message..."
          />

          <div className="action-row">
            <button type="button" className="primary" onClick={handleSend}>Send message</button>
            <button type="button" className="secondary" onClick={handleRelay}>Relay</button>
            <button type="button" className="warning" onClick={triggerEmergency}>SOS alert</button>
            <button type="button" className="ghost" onClick={refreshGps}>GPS pulse</button>
          </div>
        </section>

        <section className="panel inbox-panel">
          <div className="panel-header">
            <h2>{selectedNode?.id} inbox</h2>
            <span className="chip">{selectedNode?.inbox?.length ?? 0} packets</span>
          </div>

          <div className="inbox-list">
            {(selectedNode?.inbox ?? []).map((entry) => (
              <div key={entry.uuid || `${entry.type}-${entry.at}`} className="inbox-item">
                <div className="inbox-head">
                  <span className={`status-dot ${entry.type}`}></span>
                  <strong>{entry.type.toUpperCase()}</strong>
                  <small>{entry.at}</small>
                </div>
                <p>{entry.content}</p>
                <div className="meta-row">
                  <span>From: {entry.from}</span>
                  <span>{entry.relay}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel log-panel">
          <div className="panel-header">
            <h2>Packet log</h2>
            <span className="chip chip-live">Live</span>
          </div>

          <ul className="log-list">
            {logs.map((log, index) => (
              <li key={`${log}-${index}`}>
                <span className="time">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span>{log}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
