import { InstanceBase, InstanceStatus, Regex, TCPHelper } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UpdateVariableDefinitions, INITIAL_VALUES } from './variables.js'
import {
	ACK,
	formatHMS,
	formatMS,
	FAST_POLL,
	ONCE_POLL,
	PacketSplitter,
	SLOW_POLL,
	STATUS_REQUESTS,
	buildPacket,
	describeBytes,
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
/** Treat a buffered, unterminated packet as complete after this much silence */
const IDLE_FLUSH_MS = 80
/** Warn when this many status requests in a row get no reply */
const NO_REPLY_WARN_COUNT = 5
/** After this many consecutive "error" replies, a status request is only polled every ERROR_BACKOFF_MS */
/** track_length only follows elapsed+remaining when it moves by more than this many seconds */
const LENGTH_TOLERANCE_S = 2
const ERROR_LIMIT = 3
const ERROR_BACKOFF_MS = 30000

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
		this.flushTimer = undefined
		this.lastRxAt = 0
		this.rxBytes = 0
		this.gotFirstStatus = false
		this.noReplyStreak = 0
		this.noReplyWarned = false
		this.requestErrors = {}
		this.requestBackoffUntil = {}
		this.acksSent = 0
		this.pollCycle = 0
		this.timeSamples = {}

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
				label: 'Send ACK byte for unsolicited status (serial behaviour; the network port NACKs it)',
				width: 6,
				default: false,
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
			{
				type: 'checkbox',
				id: 'verbose_log',
				label: 'Debug log raw traffic (TX/RX bytes, timeouts)',
				width: 6,
				default: true,
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
			this.gotFirstStatus = false
			this.noReplyStreak = 0
			this.noReplyWarned = false
			this.rxBytes = 0
			this.requestErrors = {}
			this.requestBackoffUntil = {}
			this.acksSent = 0
			this.updateState({ connection: 'Connected' })
			this.requestAllStatus(true)
			this.startPolling()
		})

		this.socket.on('end', () => this.onDisconnect())

		this.socket.on('data', (data) => this.onData(data))
	}

	onDisconnect() {
		this.stopPolling()
		this.clearQueue()
		this.timeSamples = {}
		this.updateState({ connection: 'Disconnected' })
	}

	get verbose() {
		return this.config.verbose_log !== false
	}

	onData(data) {
		this.lastRxAt = Date.now()
		this.rxBytes += data.length
		if (this.verbose) this.log('debug', `RX ${data.length} bytes: ${describeBytes(data)}`)
		this.splitter.push(data)
		if (this.flushTimer) clearTimeout(this.flushTimer)
		this.flushTimer = undefined
		if (this.splitter.hasPending) {
			this.flushTimer = setTimeout(() => {
				this.flushTimer = undefined
				if (this.splitter.hasPending) {
					if (this.verbose) this.log('debug', 'RX idle: treating unterminated data as a complete packet')
					this.splitter.flush()
				}
			}, IDLE_FLUSH_MS)
		}
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
	requestStatus(name, force = false) {
		const req = STATUS_REQUESTS[name]
		if (!req || !this.isConnected) return
		if (!force && (this.requestBackoffUntil[name] ?? 0) > Date.now()) return
		if (this.queue.some((q) => q.body === req.body)) return
		if (this.pending && this.pending.body === req.body) return
		this.queue.push({ body: req.body, kind: 'status', poll: true, req, name, cycle: this.pollCycle })
		this.processQueue()
	}

	requestAllStatus(includeOnce = false) {
		this.pollCycle++
		const list = [...FAST_POLL, ...SLOW_POLL, ...(includeOnce ? ONCE_POLL : [])]
		for (const name of list) this.requestStatus(name)
		this.lastSlowPoll = Date.now()
	}

	clearQueue() {
		this.queue = []
		if (this.flushTimer) clearTimeout(this.flushTimer)
		this.flushTimer = undefined
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

		item.sentAt = Date.now()
		item.rxAtSend = this.rxBytes
		const packet = buildPacket(item.body)
		if (this.verbose) this.log('debug', `TX ${describeBytes(packet)}`)
		this.socket.send(packet)
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

		const timeout = Number(this.config.response_timeout) || 500
		const rxDuring = this.rxBytes - (item.rxAtSend ?? this.rxBytes)
		if (item.req && item.req.ackIsAnswer) {
			// Power status: "No answer" means the power is off (p.16). Only count it as a miss if
			// the player sent nothing at all, so an unrecognised ACK format can't fake standby.
			if (rxDuring === 0) {
				this.powerMisses++
				// Nothing else will be answered either; skip the rest of this poll cycle
				this.queue = this.queue.filter((q) => !q.poll)
				this.noReplyStreak = 0
				if (this.powerMisses >= POWER_OFF_MISSES) {
					if (this.state.power !== 'Off' && this.rxBytes === 0) {
						this.log(
							'warn',
							'No bytes at all received from the player since connecting. It is in standby, ' +
								'or it is not sending replies on this TCP connection.',
						)
					}
					this.setPower('Off')
				}
			} else {
				this.setPower('On')
			}
			if (this.verbose)
				this.log('debug', `No ACK to @0${item.body} within ${timeout} ms (${rxDuring} bytes received meanwhile)`)
		} else if (item.kind === 'control') {
			this.log('debug', `No response to @0${item.body} within ${timeout} ms (${rxDuring} bytes received meanwhile)`)
		} else {
			if (this.verbose)
				this.log('debug', `No reply to @0${item.body} within ${timeout} ms (${rxDuring} bytes received meanwhile)`)
			this.noReplyStreak++
			if (rxDuring === 0) {
				// Total silence: probably gone to standby. Skip the rest of this cycle and check power.
				this.queue = this.queue.filter((q) => !q.poll)
				this.requestStatus('power', true)
			}
			if (this.noReplyStreak >= NO_REPLY_WARN_COUNT && !this.noReplyWarned) {
				this.noReplyWarned = true
				this.log(
					'warn',
					`${this.noReplyStreak} status requests in a row got no usable reply ` +
						`(${this.rxBytes} bytes received since connecting). ` +
						(this.rxBytes === 0
							? 'The player is sending nothing back on this connection.'
							: 'The player is replying in an unexpected format; see the RX debug lines.'),
				)
			}
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
			if (this.acksSent > 0) {
				// The player NACKs the ACK bytes we send it over the network; not about a command
				this.acksSent--
				if (this.verbose) this.log('debug', 'Ignoring NACK of our own ACK')
				return
			}
			if (!pending) {
				if (this.verbose) this.log('debug', 'Ignoring stray NACK (nothing pending)')
				return
			}
			if (pending.kind === 'status' && pending.gotAck) {
				if (this.verbose) this.log('debug', `Ignoring stray NACK after ACK of @0${pending.body}`)
				return
			}
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
		if (pending && msg.body === pending.body) {
			// Our own command echoed back; not an answer
			if (this.verbose) this.log('debug', `Ignoring echo of @0${msg.body}`)
			return
		}
		const raw = msg.raw ?? msg.body
		const framed = raw.startsWith('@')
		const pendingReq =
			pending && pending.kind === 'status' && pending.req && !pending.req.ackIsAnswer ? pending.req : null

		// "ack+error": the player can't answer this request right now (eg not available for this disc)
		if (pendingReq && msg.body.trim().toLowerCase() === 'error') {
			this.onRequestError(pending)
			this.completePending()
			return
		}

		let parsed = null
		if (pendingReq) {
			// Over TCP the payload often comes without its '@0<code>' prefix ("ack+0000707" for ?ET).
			// Attribute bare payloads to the request we're waiting on.
			const code = pendingReq.body.replace(/^\?/, '')
			const asAnswer = parseStatus(code + msg.body)
			const direct = parseStatus(msg.body)
			if (direct && direct.key === pendingReq.key)
				parsed = direct // "@0CDCI", or "CDCI" without '@0'
			else if (!framed && msg.inReply)
				parsed = asAnswer // bare data after "ack+", eg "0000707" for ?ET
			else parsed = direct // something else (eg an unsolicited update)
		} else {
			parsed = parseStatus(msg.body)
		}
		const solicited = !!(pendingReq && parsed && parsed.key === pendingReq.key)
		if (solicited && pending.name) {
			this.requestErrors[pending.name] = 0
			delete this.requestBackoffUntil[pending.name]
		}

		if (!parsed) {
			this.log('debug', `Unrecognised message: ${describeBytes(msg.raw ?? msg.body)}`)
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
			if (!this.gotFirstStatus) {
				this.gotFirstStatus = true
				this.log('info', `Receiving status from the player (first reply: ${JSON.stringify(msg.raw ?? msg.body)})`)
			}
			this.noReplyStreak = 0
			if (this.noReplyWarned) {
				this.noReplyWarned = false
				this.log('info', 'Status replies are arriving again')
			}
			this.setPower('On')
			this.applyStatus(parsed, solicited ? pending.cycle : undefined)
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
		} else if (parsed && this.config.ack_unsolicited === true && this.isConnected) {
			// Serial protocol: unsolicited status information should be acknowledged (p.5).
			// The network port answers this byte with "nack", so it is off by default.
			this.acksSent++
			// Expect the player's "nack" for it shortly; don't let the count linger
			setTimeout(() => {
				if (this.acksSent > 0) this.acksSent--
			}, 500)
			if (this.verbose) this.log('debug', 'TX 06 | <ACK> (unsolicited status)')
			this.socket.send(Buffer.from([ACK]))
		}
	}

	/** The player answered "error" to a status request */
	onRequestError(item) {
		const name = item.name
		if (this.verbose) this.log('debug', `Player answered "error" to @0${item.body}`)
		if (!name) return
		const count = (this.requestErrors[name] ?? 0) + 1
		this.requestErrors[name] = count
		// Mark the affected variables unavailable
		const sample = parseStatus(item.req.body.replace(/^\?/, '') + 'UNKN')
		if (sample) {
			const values = {}
			for (const k of Object.keys(sample.values)) {
				const init = INITIAL_VALUES[k]
				values[k] = typeof init === 'string' ? 'N/A' : init
			}
			this.updateState(values)
			if (sample.key === 'elapsed' || sample.key === 'remaining') {
				this.timeSamples = {}
				this.resetTrackLength()
			}
		}
		if (count === ERROR_LIMIT) {
			this.log(
				'info',
				`Player answers "error" to @0${item.body} (not available right now); polling it every ${ERROR_BACKOFF_MS / 1000} s`,
			)
		}
		if (count >= ERROR_LIMIT) this.requestBackoffUntil[name] = Date.now() + ERROR_BACKOFF_MS
	}

	applyStatus(parsed, cycle) {
		// Snapshot: updateState() mutates this.state in place
		const prev = { ...this.state }
		this.updateState(parsed.values)

		// Refresh metadata (and forget the track length) when the track, title or disc changes
		const changed = (k) => k in parsed.values && parsed.values[k] !== prev[k]
		if (changed('track_number') || changed('group_number') || changed('disc_status_code')) {
			this.resetTrackLength()
			for (const name of SLOW_POLL) this.requestStatus(name)
			this.lastSlowPoll = Date.now()
		}

		if (parsed.key === 'elapsed' || parsed.key === 'remaining') {
			const secs = parsed.values[parsed.key === 'elapsed' ? 'elapsed_seconds' : 'remaining_seconds']
			this.onTimeSample(parsed.key, secs, cycle)
		}
	}

	/**
	 * track_length = elapsed + remaining, using an elapsed and a remaining answer from the same poll
	 * cycle (so they were read ~0.1 s apart). The value is held unless it moves by more than
	 * LENGTH_TOLERANCE_S, or the track/title/disc changes.
	 */
	onTimeSample(key, secs, cycle) {
		if (secs === null || secs === undefined || isNaN(secs)) {
			// Unknown time: the length is unknown too
			this.timeSamples = {}
			this.resetTrackLength()
			return
		}
		if (cycle === undefined) return // unsolicited update: can't pair it reliably
		this.timeSamples[key] = { secs, cycle }
		const e = this.timeSamples.elapsed
		const r = this.timeSamples.remaining
		if (!e || !r || e.cycle !== r.cycle) return

		const total = e.secs + r.secs
		const current = this.state.track_length_seconds
		if (current === null || current === undefined || Math.abs(total - current) > LENGTH_TOLERANCE_S) {
			this.updateState({
				track_length: formatHMS(total),
				track_length_mmss: formatMS(total),
				track_length_seconds: total,
			})
		}
	}

	resetTrackLength() {
		this.timeSamples = {}
		this.updateState({ track_length: '', track_length_mmss: '', track_length_seconds: null })
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

		this.pollCycle++
		for (const name of FAST_POLL) this.requestStatus(name)

		if (Date.now() - this.lastSlowPoll >= SLOW_POLL_MS) {
			this.lastSlowPoll = Date.now()
			for (const name of SLOW_POLL) this.requestStatus(name)
			if (!this.state.model_name) this.requestStatus('model')
		}
	}
}
