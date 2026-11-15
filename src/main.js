import { InstanceBase, InstanceStatus, Regex, TCPHelper } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UpdateVariableDefinitions, INITIAL_VALUES } from './variables.js'
import {
	ACK,
	FAST_POLL,
	ONCE_POLL,
	PacketSplitter,
	SLOW_POLL,
	STATUS_REQUESTS,
	buildPacket,
	parseStatus,
} from './protocol.js'

export { UpgradeScripts }

const DEFAULT_PORT = 9030
/** Gap between the end of one exchange and the next command (lets a trailing ACK arrive) */
const INTER_COMMAND_GAP_MS = 20
/** Slow (metadata) poll period */
const SLOW_POLL_MS = 5000
/** How long to wait for the ACK after a matching status packet arrived without one */
const ACK_GRACE_MS = 60
/** Number of unanswered power requests before reporting the player as off */
const POWER_OFF_MISSES = 2

export default class DenonDN500BDInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.config = {}
		this.socket = undefined
		this.state = { ...INITIAL_VALUES }

		this.queue = []
		this.pending = undefined
		this.pendingTimer = undefined
		this.gapTimer = undefined
		this.pollTimer = undefined
		this.lastSlowPoll = 0
		this.powerMisses = 0
		this.lastNetworkError = undefined

		this.splitter = new PacketSplitter((msg) => this.handleMessage(msg))
	}

	// ----------------------------------------------------------------------------------
	// Lifecycle
	// ----------------------------------------------------------------------------------

	async init(config) {
		this.config = config

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
		this.setVariableValues(this.state)

		this.initTcp()
	}

	async destroy() {
		this.stopPolling()
		this.clearQueue()
		if (this.socket) {
			this.socket.destroy()
			this.socket = undefined
		}
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		const reconnect = this.config.host !== config.host || String(this.config.port) !== String(config.port)
		this.config = config

		if (reconnect || !this.socket) {
			this.initTcp()
		} else {
			this.startPolling()
		}
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port (Default: 9030)',
				width: 4,
				default: String(DEFAULT_PORT),
				regex: Regex.PORT,
			},
			{
				type: 'checkbox',
				id: 'poll_enabled',
				label: 'Poll status for variables/feedbacks',
				width: 6,
				default: true,
			},
			{
				type: 'number',
				id: 'poll_interval',
				label: 'Poll interval (ms)',
				width: 6,
				min: 250,
				max: 60000,
				default: 1000,
				isVisibleExpression: '$(options:poll_enabled)',
			},
			{
				type: 'checkbox',
				id: 'ack_unsolicited',
				label: 'Acknowledge unsolicited status messages (recommended)',
				width: 6,
				default: true,
			},
			{
				type: 'number',
				id: 'response_timeout',
				label: 'Response timeout (ms)',
				width: 6,
				min: 100,
				max: 5000,
				default: 500,
			},
		]
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updatePresets() {
		UpdatePresets(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}

	// ----------------------------------------------------------------------------------
	// TCP
	// ----------------------------------------------------------------------------------

	initTcp() {
		this.stopPolling()
		this.clearQueue()
		this.splitter.reset()

		if (this.socket) {
			this.socket.destroy()
			this.socket = undefined
		}

		const host = this.config.host
		const port = parseInt(this.config.port, 10) || DEFAULT_PORT

		if (!host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No host configured')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.socket = new TCPHelper(host, port)

		this.socket.on('status_change', (status, message) => {
			// Only forward non-ok states; Ok is reported once we have actually connected
			if (status !== InstanceStatus.Ok) {
				this.updateStatus(status, message)
				this.onDisconnect()
			}
		})

		this.socket.on('error', (err) => {
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			// TCPHelper retries every 2s; only log when the error changes
			if (this.lastNetworkError !== err.message) {
				this.lastNetworkError = err.message
				this.log('error', 'Network error: ' + err.message)
			}
		})

		this.socket.on('connect', () => {
			this.log('info', `Connected to ${host}:${port}`)
			this.lastNetworkError = undefined
			this.updateStatus(InstanceStatus.Ok)
			this.splitter.reset()
			this.powerMisses = 0
			this.updateState({ connection: 'Connected' })
			this.requestAllStatus(true)
			this.startPolling()
		})

		this.socket.on('end', () => this.onDisconnect())

		this.socket.on('data', (data) => this.splitter.push(data))
	}

	onDisconnect() {
		this.stopPolling()
		this.clearQueue()
		this.updateState({ connection: 'Disconnected' })
	}

	get isConnected() {
		return !!this.socket && this.socket.isConnected
	}

	// ----------------------------------------------------------------------------------
	// Command queue
	// The player must answer each command (ACK/NACK, plus a status packet for status
	// requests) before the next one is sent, otherwise it replies "@0BDERBUSY".
	// ----------------------------------------------------------------------------------

	/** Send a control command (from an action). Jumps ahead of queued polls. */
	sendCommand(body) {
		if (!this.isConnected) {
			this.log('warn', `Not connected, unable to send @0${body}`)
			return
		}
		this.log('debug', `Queue control @0${body}`)
		const firstPoll = this.queue.findIndex((q) => q.poll)
		const item = { body, kind: 'control', poll: false }
		if (firstPoll === -1) this.queue.push(item)
		else this.queue.splice(firstPoll, 0, item)
		this.processQueue()
	}

	/** Queue a status request by name (see STATUS_REQUESTS). Skips duplicates. */
	requestStatus(name) {
		const req = STATUS_REQUESTS[name]
		if (!req || !this.isConnected) return
		if (this.queue.some((q) => q.body === req.body)) return
		if (this.pending && this.pending.body === req.body) return
		this.queue.push({ body: req.body, kind: 'status', poll: true, req })
		this.processQueue()
	}

	requestAllStatus(includeOnce = false) {
		const list = [...FAST_POLL, ...SLOW_POLL, ...(includeOnce ? ONCE_POLL : [])]
		for (const name of list) this.requestStatus(name)
		this.lastSlowPoll = Date.now()
	}

	clearQueue() {
		this.queue = []
		this.pending = undefined
		if (this.pendingTimer) clearTimeout(this.pendingTimer)
		if (this.gapTimer) clearTimeout(this.gapTimer)
		this.pendingTimer = undefined
		this.gapTimer = undefined
	}

	processQueue() {
		if (this.pending || this.gapTimer || this.queue.length === 0) return
		if (!this.isConnected) {
			this.queue = []
			return
		}

		const item = this.queue.shift()
		this.pending = item
		item.gotAck = false
		item.gotPacket = false

		const timeout = Number(this.config.response_timeout) || 500
		this.pendingTimer = setTimeout(() => this.onPendingTimeout(item), timeout)

		this.socket.send(buildPacket(item.body))
	}

	completePending() {
		if (this.pendingTimer) clearTimeout(this.pendingTimer)
		this.pendingTimer = undefined
		this.pending = undefined
		this.gapTimer = setTimeout(() => {
			this.gapTimer = undefined
			this.processQueue()
		}, INTER_COMMAND_GAP_MS)
	}

	onPendingTimeout(item) {
		if (this.pending !== item) return

		if (item.req && item.req.ackIsAnswer) {
			// Power status: "No answer" means the power is off (p.16)
			this.powerMisses++
			if (this.powerMisses >= POWER_OFF_MISSES) this.setPower('Off')
		} else if (item.kind === 'control') {
			this.log('debug', `No response to @0${item.body}`)
		}
		this.completePending()
	}

	setPower(power) {
		if (power === 'On') this.powerMisses = 0
		const prev = this.state.power
		if (prev === power) return
		this.updateState({ power })
		if (power === 'On' && prev === 'Off') {
			// Woke up from standby: refresh everything
			this.requestAllStatus()
		} else if (power === 'Off') {
			// Nothing else will answer while in standby
			this.queue = this.queue.filter((q) => !q.poll)
		}
	}

	// ----------------------------------------------------------------------------------
	// Incoming data
	// ----------------------------------------------------------------------------------

	handleMessage(msg) {
		const pending = this.pending

		if (msg.type === 'ack') {
			if (!pending) return
			if (pending.kind === 'control') {
				this.completePending()
			} else if (pending.req && pending.req.ackIsAnswer) {
				this.setPower('On')
				this.completePending()
			} else {
				// Status request: ACK plus a status packet, in either order.
				pending.gotAck = true
				this.setPower('On')
				if (pending.gotPacket) this.completePending()
			}
			return
		}

		if (msg.type === 'nack') {
			if (!pending) return
			if (pending.kind === 'control') {
				this.log('warn', `Player rejected command @0${pending.body}`)
				this.updateState({ last_error: `NACK: @0${pending.body}` })
			} else if (pending.req && pending.req.ackIsAnswer) {
				this.setPower('On')
			}
			this.completePending()
			return
		}

		// Status information packet
		const parsed = parseStatus(msg.body)
		const solicited = !!(pending && pending.req && parsed && parsed.key === pending.req.key)

		if (!parsed) {
			this.log('debug', `Unrecognised message: @0${msg.body}`)
		} else if (parsed.key === 'busy') {
			this.log('debug', 'Player busy')
			this.updateState(parsed.values)
			if (pending) {
				// Retry the same command once the player is free
				this.queue.unshift({ ...pending, gotAck: false, gotPacket: false })
				this.completePending()
			}
			return
		} else {
			this.setPower('On')
			this.applyStatus(parsed)
		}

		if (solicited && pending.gotAck) {
			this.completePending()
		} else if (solicited) {
			// Matching packet but no ACK yet. It may be the answer (ACK still to come) or an
			// unsolicited update of the same status; give the ACK a moment before moving on.
			pending.gotPacket = true
			if (this.pendingTimer) clearTimeout(this.pendingTimer)
			this.pendingTimer = setTimeout(() => {
				if (this.pending === pending) this.completePending()
			}, ACK_GRACE_MS)
		} else if (this.config.ack_unsolicited !== false && this.isConnected) {
			// Unsolicited status information must be acknowledged (p.5)
			this.socket.send(Buffer.from([ACK]))
		}
	}

	applyStatus(parsed) {
		const prev = this.state
		this.updateState(parsed.values)

		// Refresh metadata when the track, title or disc changes
		const changed = (k) => k in parsed.values && parsed.values[k] !== prev[k]
		if (changed('track_number') || changed('group_number') || changed('disc_status_code')) {
			for (const name of SLOW_POLL) this.requestStatus(name)
			this.lastSlowPoll = Date.now()
		}
	}

	/** Merge values into state, push changed variables and re-check affected feedbacks */
	updateState(values) {
		const changed = {}
		for (const [k, v] of Object.entries(values)) {
			if (this.state[k] !== v) {
				this.state[k] = v
				changed[k] = v
			}
		}
		const keys = Object.keys(changed)
		if (keys.length === 0) return

		this.setVariableValues(changed)

		const feedbacks = []
		if ('power' in changed) feedbacks.push('power_state')
		if ('track_status_code' in changed) feedbacks.push('track_status')
		if ('disc_status_code' in changed) feedbacks.push('disc_status', 'tray_open')
		if (feedbacks.length) this.checkFeedbacks(...feedbacks)
	}

	// ----------------------------------------------------------------------------------
	// Polling
	// ----------------------------------------------------------------------------------

	startPolling() {
		this.stopPolling()
		if (this.config.poll_enabled === false) return

		const interval = Math.max(250, Number(this.config.poll_interval) || 1000)
		this.pollTimer = setInterval(() => this.poll(), interval)
	}

	stopPolling() {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = undefined
	}

	poll() {
		if (!this.isConnected) return
		// Don't pile up requests if the previous cycle hasn't finished
		if (this.queue.some((q) => q.poll)) return

		if (this.state.power === 'Off') {
			this.requestStatus('power')
			return
		}

		for (const name of FAST_POLL) this.requestStatus(name)

		if (Date.now() - this.lastSlowPoll >= SLOW_POLL_MS) {
			this.lastSlowPoll = Date.now()
			for (const name of SLOW_POLL) this.requestStatus(name)
			if (!this.state.model_name) this.requestStatus('model')
		}
	}
}
