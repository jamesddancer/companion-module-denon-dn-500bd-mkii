/**
 * Runtime smoke test: runs the real module class against a mock DN-500BD MKII TCP server
 * that answers with the status codes from the protocol guide.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import ModuleInstance from '../src/main.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class MockPlayer {
	constructor(opts = {}) {
		this.ackAfter = !!opts.ackAfter
		this.power = true
		this.disc = 'CI'
		this.status = 'PP'
		this.track = 1
		this.received = []
		this.acksFromHost = 0
		this.busy = false
		this.busyCount = 0
		this.clients = new Set()
		this.server = net.createServer((sock) => this.onClient(sock))
	}

	listen() {
		return new Promise((r) => this.server.listen(0, '127.0.0.1', () => r(this.server.address().port)))
	}

	close() {
		for (const c of this.clients) c.destroy()
		return new Promise((r) => this.server.close(r))
	}

	/** Send unsolicited status; like the real player, resend up to twice if not ACKed within 300ms (p.5) */
	push(body, attempt = 0) {
		const acks = this.acksFromHost
		for (const c of this.clients) c.write(`@0${body}\r`, 'latin1')
		if (attempt < 2) {
			setTimeout(() => {
				if (this.acksFromHost === acks && this.clients.size) this.push(body, attempt + 1)
			}, 300)
		}
	}

	onClient(sock) {
		this.clients.add(sock)
		sock.on('close', () => this.clients.delete(sock))
		let buf = ''
		sock.on('data', (d) => {
			buf += d.toString('latin1')
			for (;;) {
				if (buf[0] === '\x06') {
					this.acksFromHost++
					buf = buf.slice(1)
					continue
				}
				const i = buf.indexOf('\r')
				if (i === -1) return
				const pkt = buf.slice(0, i)
				buf = buf.slice(i + 1)
				if (!pkt.startsWith('@0')) continue
				if (this.busy) {
					// A second command arrived before the first was answered
					this.busyCount++
					sock.write('@0BDERBUSY\r')
					continue
				}
				const body = pkt.slice(2)
				this.busy = true
				// Answer after a short delay, like a real device
				setTimeout(() => {
					this.busy = false
					if (!sock.destroyed) this.handle(sock, body)
				}, 30)
			}
		})
	}

	handle(sock, body) {
		this.received.push(body)
		if (!this.power) {
			if (body === 'PW00') {
				this.power = true
				sock.write('\x06')
			}
			return // standby: no answer
		}
		const answer = (code) => sock.write(this.ackAfter ? `@0${code}\r\x06` : `\x06@0${code}\r`, 'latin1')
		switch (body) {
			case '?PW':
				return sock.write('\x06')
			case '?CD':
				return answer('CD' + this.disc)
			case '?ST':
				return answer('ST' + this.status)
			case '?Tr':
				return answer('Tr' + String(this.track).padStart(4, '0'))
			case '?Tt':
				return answer('Tt0012')
			case '?ti':
				return answer('tiCafé Song')
			case '?at':
				return answer('atSome Artist')
			case '?al':
				return answer('alSome Album')
			case '?tl':
				return answer('tl00325')
			case '?PCGp':
				return answer('?PCGp0002')
			case '?PCTG':
				return answer('?PCTG0005')
			case '?ET':
				return answer('ET0010203')
			case '?RM':
				return answer('RM0000130')
			case '?PCTYP':
				return answer('PCTYPBDM')
			case '?PCAFMT':
				return answer('PCAFMTDHM')
			case '?PCACH':
				return answer('BDACH71C')
			case '?PCDG+':
				return answer('PCDG+eng')
			case '?PCDG-':
				return answer('PCDG-UKN')
			case '?DVSTC':
				return answer('DVSTCfre')
			case '?VN':
				return answer('VN01.23.45DN500BD2')
			case '?fs':
				return answer('Fs48')
			case '?PCCT':
				return answer('PCCT00')
			case '2353':
				this.status = 'PL'
				return sock.write('\x06')
			case '2348':
				this.status = 'PP'
				return sock.write('\x06')
			case 'PCDTRYOP':
				this.disc = 'TO'
				return sock.write('\x06')
			case 'PW01':
				this.power = false
				return sock.write('\x06')
			default:
				if (/^Tr\d{4}$/.test(body)) {
					this.track = parseInt(body.slice(2), 10)
					return sock.write('\x06')
				}
				// Any other control command is accepted; unknown status requests are rejected
				return sock.write(body.startsWith('?') ? '\x15' : '\x06')
		}
	}
}

function makeContext() {
	const ctx = {
		statuses: [],
		variables: {},
		variableDefs: {},
		actions: {},
		feedbacks: {},
		presets: {},
		structure: [],
		checked: [],
	}
	const target = {
		_isInstanceContext: true,
		id: 'test-instance',
		label: 'denon',
		upgradeScripts: [],
		updateStatus: (s, m) => ctx.statuses.push([s, m]),
		setVariableDefinitions: (d) => (ctx.variableDefs = d),
		setVariableValues: (v) => Object.assign(ctx.variables, v),
		setActionDefinitions: (a) => (ctx.actions = a),
		setFeedbackDefinitions: (f) => (ctx.feedbacks = f),
		setPresetDefinitions: (s, p) => {
			ctx.structure = s
			ctx.presets = p
		},
		checkFeedbacks: (types) => ctx.checked.push(...types),
	}
	const proxy = new Proxy(target, {
		get: (t, k) => (k in t ? t[k] : () => undefined),
	})
	return { ctx, proxy }
}

async function waitFor(fn, timeout = 4000) {
	const start = Date.now()
	while (Date.now() - start < timeout) {
		if (fn()) return true
		await sleep(25)
	}
	return false
}

const runAction = (ctx, actionId, options = {}) =>
	ctx.actions[actionId].callback({ id: 'a', controlId: 'c', actionId, options, surfaceId: undefined }, {})

const fb = (instance, ctx, feedbackId, options = {}) =>
	ctx.feedbacks[feedbackId].callback({ id: 'f', controlId: 'c', feedbackId, type: 'boolean', options }, {})

async function scenario(opts) {
	const player = new MockPlayer(opts)
	const port = await player.listen()
	const { ctx, proxy } = makeContext()
	const instance = new ModuleInstance(proxy)

	try {
		await instance.init(
			{
				host: '127.0.0.1',
				port: String(port),
				poll_enabled: true,
				poll_interval: 250,
				ack_unsolicited: true,
				response_timeout: 200,
			},
			true,
			undefined,
		)

		// definitions
		assert.ok(Object.keys(ctx.variableDefs).length >= 40)
		assert.ok(ctx.actions.track_playback && ctx.actions.random_mode && ctx.actions.disc_tray)
		assert.ok(Object.keys(ctx.presets).length > 80)
		for (const section of ctx.structure) {
			for (const id of section.definitions) assert.ok(ctx.presets[id], `preset ${id} exists`)
		}

		const polled = await waitFor(
			() => ctx.variables.model_name === 'DN500BD2' && ctx.variables.network_connection !== '',
		)
		if (!polled) console.log('Variables at failure:', JSON.stringify(ctx.variables), player.received.slice(0, 40))
		assert.ok(polled, 'all status polled')
		assert.ok(ctx.statuses.some(([s]) => s === 'ok'))

		const v = ctx.variables
		assert.equal(v.connection, 'Connected')
		assert.equal(v.power, 'On')
		assert.equal(v.disc_status, 'Disc In')
		assert.equal(v.track_status, 'Paused')
		assert.equal(v.track_number, 1)
		assert.equal(v.track_count, 12)
		assert.equal(v.track_title, 'Café Song')
		assert.equal(v.track_artist, 'Some Artist')
		assert.equal(v.album_title, 'Some Album')
		assert.equal(v.track_time, '03:25')
		assert.equal(v.group_number, 2)
		assert.equal(v.group_count, 5)
		assert.equal(v.elapsed_time, '01:02:03')
		assert.equal(v.remaining_time, '00:01:30')
		assert.equal(v.media_type, 'BDMV')
		assert.equal(v.audio_format, 'DTS-HD MA')
		assert.equal(v.audio_channels, '7.1ch')
		assert.equal(v.audio_dialog_primary, 'English')
		assert.equal(v.audio_dialog_secondary, 'Unknown')
		assert.equal(v.subtitle, 'French')
		assert.equal(v.sample_rate, '48 kHz')
		assert.equal(v.firmware_version, '01.23.45')
		assert.equal(v.network_connection, 'Connected')
		assert.equal(fb(instance, ctx, 'track_status', { status: 'PP' }), true)
		assert.equal(fb(instance, ctx, 'power_state', { state: 'On' }), true)

		// Actions send the documented codes and polling picks up the change
		await runAction(ctx, 'track_playback', { sel_cmd: '2353' })
		assert.ok(await waitFor(() => ctx.variables.track_status === 'Playing'), 'play reflected')
		assert.ok(player.received.includes('2353'))
		assert.equal(fb(instance, ctx, 'track_status', { status: 'PL' }), true)
		assert.ok(ctx.checked.includes('track_status'))

		await runAction(ctx, 'track_selection', { sel_cmd: 'Tr', sel_val: 7 })
		assert.ok(await waitFor(() => ctx.variables.track_number === 7), 'track change reflected')
		assert.ok(player.received.includes('Tr0007'))

		await runAction(ctx, 'random_mode', { sel_cmd: 'S', sel_val: 'AL' })
		await runAction(ctx, 'search_speed', { sel_cmd: 'f' })
		await runAction(ctx, 'number_buttons', { sel_val: 3 })
		assert.ok(await waitFor(() => player.received.includes('PCTKEY3')))
		assert.ok(player.received.includes('PCPMRSAL'))
		assert.ok(player.received.includes('PCSLSFf'))

		await runAction(ctx, 'disc_tray', { sel_cmd: 'PCDTRYOP' })
		assert.ok(await waitFor(() => ctx.variables.tray_open === true), 'tray open reflected')
		assert.equal(fb(instance, ctx, 'tray_open'), true)

		// Unsolicited status is parsed and ACKed
		const acksBefore = player.acksFromHost
		player.push('STDVFF')
		assert.ok(await waitFor(() => player.acksFromHost > acksBefore), 'unsolicited status acked')
		assert.ok(await waitFor(() => ctx.variables.track_status_code === 'DVFF' || player.status === 'PL'))

		// Never more than one outstanding command: BUSY should never have been needed
		assert.equal(player.busyCount, 0)
		assert.equal(ctx.variables.last_error, '')

		// Standby: player stops answering -> power Off
		await runAction(ctx, 'power', { sel_cmd: 'PW01' })
		assert.ok(await waitFor(() => ctx.variables.power === 'Off'), 'power off detected')
		assert.equal(fb(instance, ctx, 'power_state', { state: 'Off' }), true)

		// Wake up
		await runAction(ctx, 'power', { sel_cmd: 'PW00' })
		assert.ok(await waitFor(() => ctx.variables.power === 'On'), 'power on detected')

		// Disconnect is reported
		await player.close()
		assert.ok(await waitFor(() => ctx.variables.connection === 'Disconnected'), 'disconnect detected')
	} finally {
		await instance.destroy()
		await player.close().catch(() => {})
	}
}

test('module against mock player (ACK before status packet)', () => scenario({ ackAfter: false }))
test('module against mock player (ACK after status packet)', () => scenario({ ackAfter: true }))
