/**
 * Denon DN-500BD MKII protocol helpers.
 *
 * Packet framing (Protocol Guide v1.1, p.5):
 *   '@' + '0' (ID) + command + '\r'
 * The player answers every command with ACK (0x06) or NACK (0x15). Status requests are
 * additionally answered with a status information packet using the same framing.
 * Status information is also sent unsolicited when something changes on the player; the
 * host is expected to answer those with an ACK.
 *
 * Everything in this file is pure (no Companion dependencies) so it can be unit tested.
 */

export const START = '@0'
export const END = '\r'
export const ACK = 0x06
export const NACK = 0x15

/** Build a full packet for a command body, eg 'PW00' -> '@0PW00\r' */
export function buildPacket(body) {
	return START + body + END
}

// ---------------------------------------------------------------------------------------
// Lookup tables (pages 16-19)
// ---------------------------------------------------------------------------------------

export const DISC_STATUS = {
	NC: 'No Disc',
	CI: 'Disc In',
	UF: 'Unformatted',
	TO: 'Tray Open',
	TC: 'Tray Closed',
	TE: 'Tray Error',
}

export const TRACK_STATUS = {
	PL: 'Playing',
	PP: 'Paused',
	DVSF: 'Slow Play Forward',
	DVSR: 'Slow Play Reverse',
	DVFF: 'Fast Play Forward',
	DVFR: 'Fast Play Reverse',
	DVSP: 'Step Play',
	ED: 'Menu',
	DVSU: 'Setup',
	DVTR: 'Track Menu',
	DVHM: 'Home',
}

export const MEDIA_TYPE = {
	DVV: 'DVD Video',
	DVA: 'DVD Audio',
	CDA: 'CD-DA',
	CDR: 'CD-ROM',
	UKN: 'Unknown',
	SAC: 'SACD',
	DVR: 'DVD-VR',
	BDM: 'BDMV',
	BDA: 'BDAV',
	AVH: 'AVCHD',
	DLN: 'DLNA',
	EXT: 'External Memory',
}

export const AUDIO_FORMAT = {
	DBD: 'Dolby Digital',
	DTS: 'DTS',
	MPG: 'MPEG',
	LPC: 'LPCM',
	PPC: 'PPCM',
	UKN: 'Unknown',
	DSD: 'DSD',
	'DD+': 'Dolby Digital Plus',
	DTH: 'DTS-HD',
	DHM: 'DTS-HD MA',
	DLH: 'Dolby TrueHD',
	MP3: 'MP3',
	AAC: 'AAC',
	WMA: 'WMA',
}

export const AUDIO_CHANNEL = {
	'1CH': '1ch',
	'2CH': '2ch',
	'21C': '2.1ch',
	'3CH': '3ch',
	'31C': '3.1ch',
	'4CH': '4ch',
	'41C': '4.1ch',
	'5CH': '5ch',
	'51C': '5.1ch',
	'6CH': '6ch',
	'61C': '6.1ch',
	'7CH': '7ch',
	'71C': '7.1ch',
	'8CH': '8ch',
	'L/R': 'L/R (CD/VCD/MP3)',
	RCH: 'Right (CD/VCD)',
	LCH: 'Left (CD/VCD)',
	UKN: 'Unknown',
}

export const RANDOM_TYPE = { S: 'Shuffle', R: 'Random' }
export const RANDOM_MODE = { OF: 'Off', SI: 'Sub Item', IT: 'Item', AL: 'All' }

/** Common ISO 639-2 (B and T forms) language codes used on discs */
export const LANGUAGES = {
	ara: 'Arabic',
	chi: 'Chinese',
	zho: 'Chinese',
	cze: 'Czech',
	ces: 'Czech',
	dan: 'Danish',
	dut: 'Dutch',
	nld: 'Dutch',
	eng: 'English',
	fin: 'Finnish',
	fre: 'French',
	fra: 'French',
	ger: 'German',
	deu: 'German',
	gre: 'Greek',
	ell: 'Greek',
	heb: 'Hebrew',
	hin: 'Hindi',
	hun: 'Hungarian',
	ice: 'Icelandic',
	isl: 'Icelandic',
	ind: 'Indonesian',
	ita: 'Italian',
	jpn: 'Japanese',
	kor: 'Korean',
	nor: 'Norwegian',
	pol: 'Polish',
	por: 'Portuguese',
	rum: 'Romanian',
	ron: 'Romanian',
	rus: 'Russian',
	spa: 'Spanish',
	swe: 'Swedish',
	tha: 'Thai',
	tur: 'Turkish',
	ukr: 'Ukrainian',
	vie: 'Vietnamese',
	und: 'Undetermined',
	UKN: 'Unknown',
}

// ---------------------------------------------------------------------------------------
// Status requests (Host -> player). `key` is the parser key of the expected answer.
// ---------------------------------------------------------------------------------------

export const STATUS_REQUESTS = {
	power: { body: '?PW', key: 'power', ackIsAnswer: true },
	disc: { body: '?CD', key: 'disc' },
	track_status: { body: '?ST', key: 'track_status' },
	track_number: { body: '?Tr', key: 'track_number' },
	track_count: { body: '?Tt', key: 'track_count' },
	track_title: { body: '?ti', key: 'track_title' },
	track_artist: { body: '?at', key: 'track_artist' },
	album_title: { body: '?al', key: 'album_title' },
	track_time: { body: '?tl', key: 'track_time' },
	group_number: { body: '?PCGp', key: 'group_number' },
	group_count: { body: '?PCTG', key: 'group_count' },
	elapsed: { body: '?ET', key: 'elapsed' },
	remaining: { body: '?RM', key: 'remaining' },
	media_type: { body: '?PCTYP', key: 'media_type' },
	audio_format: { body: '?PCAFMT', key: 'audio_format' },
	audio_channels: { body: '?PCACH', key: 'audio_channels' },
	audio_dialog_primary: { body: '?PCDG+', key: 'audio_dialog_primary' },
	audio_dialog_secondary: { body: '?PCDG-', key: 'audio_dialog_secondary' },
	subtitle: { body: '?DVSTC', key: 'subtitle' },
	model: { body: '?VN', key: 'model' },
	sample_rate: { body: '?fs', key: 'sample_rate' },
	network: { body: '?PCCT', key: 'network' },
}

/** Requested every poll cycle */
export const FAST_POLL = [
	'power',
	'disc',
	'track_status',
	'track_number',
	'track_count',
	'group_number',
	'elapsed',
	'remaining',
	'track_time',
]

/** Requested less often, and whenever the track/disc changes */
export const SLOW_POLL = [
	'group_count',
	'track_title',
	'track_artist',
	'album_title',
	'media_type',
	'audio_format',
	'audio_channels',
	'audio_dialog_primary',
	'audio_dialog_secondary',
	'subtitle',
	'sample_rate',
]

/** Requested once after connecting */
export const ONCE_POLL = ['model', 'network']

// ---------------------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------------------

function lookup(table, code) {
	if (code in table) return table[code]
	return code === '' ? '' : `Unknown (${code})`
}

function pad2(n) {
	return String(n).padStart(2, '0')
}

/** Parse a 4 digit count. Returns null for UNKN / unparseable. */
function parseCount(raw) {
	const v = raw.trim()
	if (!/^\d+$/.test(v)) return null
	return parseInt(v, 10)
}

/** seconds -> 'HH:MM:SS' */
export function formatHMS(total) {
	if (total === null || total === undefined || isNaN(total)) return ''
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
}

/** seconds -> 'MM:SS' (minutes may exceed 59) */
export function formatMS(total) {
	if (total === null || total === undefined || isNaN(total)) return ''
	return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`
}

/** 'hhhmmss' -> seconds */
function parseHHHMMSS(raw) {
	const m = /^(\d{1,3})(\d{2})(\d{2})$/.exec(raw.trim())
	if (!m) return null
	return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10)
}

function language(code) {
	const c = code.trim()
	if (c === '') return ''
	return LANGUAGES[c] ?? LANGUAGES[c.toLowerCase()] ?? c
}

// ---------------------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------------------

/**
 * Parsers, checked in order (longest / most specific prefix first).
 * Each returns { key, values } where values is a partial variable-values object.
 */
const PARSERS = [
	{
		prefix: 'BDERBUSY',
		parse: () => ({ key: 'busy', values: { last_error: 'Busy' } }),
	},
	{
		// The guide shows the answer as "@0?PCGpXXXX"; accept with or without the '?'
		prefix: '?PCGp',
		parse: (v) => groupNumber(v),
	},
	{ prefix: 'PCGp', parse: (v) => groupNumber(v) },
	{ prefix: '?PCTG', parse: (v) => groupCount(v) },
	{ prefix: 'PCTG', parse: (v) => groupCount(v) },
	{
		prefix: 'PCTYP',
		parse: (v) => {
			const code = v.trim()
			return { key: 'media_type', values: { media_type: lookup(MEDIA_TYPE, code), media_type_code: code } }
		},
	},
	{
		prefix: 'PCAFMT',
		parse: (v) => {
			const code = v.trim()
			return {
				key: 'audio_format',
				values: { audio_format: lookup(AUDIO_FORMAT, code), audio_format_code: code },
			}
		},
	},
	// The guide requests with @0?PCACH but documents the answer as @0BDACHXXX; accept both
	{ prefix: 'BDACH', parse: (v) => audioChannels(v) },
	{ prefix: 'PCACH', parse: (v) => audioChannels(v) },
	{
		prefix: 'PCDG',
		parse: (v) => {
			const which = v.charAt(0)
			const code = v.slice(1).trim()
			if (which === '-') {
				return {
					key: 'audio_dialog_secondary',
					values: { audio_dialog_secondary: language(code), audio_dialog_secondary_code: code },
				}
			}
			return {
				key: 'audio_dialog_primary',
				values: { audio_dialog_primary: language(code), audio_dialog_primary_code: code },
			}
		},
	},
	{
		prefix: 'DVSTC',
		parse: (v) => {
			const code = v.trim()
			return { key: 'subtitle', values: { subtitle: language(code), subtitle_code: code } }
		},
	},
	{
		prefix: 'PCPMR',
		parse: (v) => {
			const type = v.charAt(0)
			const mode = v.slice(1, 3)
			const text = mode === 'OF' ? 'Off' : `${lookup(RANDOM_TYPE, type)} ${lookup(RANDOM_MODE, mode)}`
			return { key: 'random_mode', values: { random_mode: text } }
		},
	},
	{
		prefix: 'PCCT',
		parse: (v) => {
			const c = v.trim()
			const text = c === '00' ? 'Connected' : c === '01' ? 'Failed' : `Unknown (${c})`
			return { key: 'network', values: { network_connection: text } }
		},
	},
	{
		prefix: 'VN',
		parse: (v) => ({
			key: 'model',
			values: { firmware_version: v.slice(0, 8).trim(), model_name: v.slice(8).trim() },
		}),
	},
	{
		prefix: 'PW',
		// Not documented as an answer, but handle an echoed power state just in case
		parse: (v) => ({
			key: 'power',
			values: { power: v.startsWith('00') ? 'On' : v.startsWith('01') ? 'Off' : 'Unknown' },
		}),
	},
	{
		prefix: 'CD',
		parse: (v) => {
			const code = v.trim()
			return {
				key: 'disc',
				values: {
					disc_status: lookup(DISC_STATUS, code),
					disc_status_code: code,
					tray_open: code === 'TO',
					disc_present: code === 'CI',
				},
			}
		},
	},
	{
		prefix: 'ST',
		parse: (v) => {
			const code = v.trim()
			return {
				key: 'track_status',
				values: {
					track_status: lookup(TRACK_STATUS, code),
					track_status_code: code,
					playing: code === 'PL',
					paused: code === 'PP',
				},
			}
		},
	},
	{
		prefix: 'Tr',
		parse: (v) => ({ key: 'track_number', values: { track_number: parseCount(v) ?? 'Unknown' } }),
	},
	{
		prefix: 'Tt',
		parse: (v) => ({ key: 'track_count', values: { track_count: parseCount(v) ?? 'Unknown' } }),
	},
	{ prefix: 'ti', parse: (v) => ({ key: 'track_title', values: { track_title: v.trim() } }) },
	{ prefix: 'at', parse: (v) => ({ key: 'track_artist', values: { track_artist: v.trim() } }) },
	{ prefix: 'al', parse: (v) => ({ key: 'album_title', values: { album_title: v.trim() } }) },
	{
		prefix: 'tl',
		parse: (v) => {
			// MMMSS (p.17) or MMMSSFF (p.19, FF = frame 00-74)
			const m = /^(\d{3})(\d{2})(\d{2})?$/.exec(v.trim())
			if (!m)
				return { key: 'track_time', values: { track_time: '', track_time_seconds: null, track_time_frames: null } }
			const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
			return {
				key: 'track_time',
				values: {
					track_time: formatMS(secs),
					track_time_seconds: secs,
					track_time_frames: m[3] !== undefined ? parseInt(m[3], 10) : null,
				},
			}
		},
	},
	{
		prefix: 'ET',
		parse: (v) => {
			const secs = parseHHHMMSS(v)
			return { key: 'elapsed', values: { elapsed_time: formatHMS(secs), elapsed_seconds: secs } }
		},
	},
	{
		prefix: 'RM',
		parse: (v) => {
			const secs = parseHHHMMSS(v)
			return { key: 'remaining', values: { remaining_time: formatHMS(secs), remaining_seconds: secs } }
		},
	},
	{
		// The guide uses both "?fs" (request) and "Fs" (answer)
		prefix: 'Fs',
		parse: (v) => sampleRate(v),
	},
	{ prefix: 'fs', parse: (v) => sampleRate(v) },
]

function groupNumber(v) {
	return { key: 'group_number', values: { group_number: parseCount(v) ?? 'Unknown' } }
}
function groupCount(v) {
	return { key: 'group_count', values: { group_count: parseCount(v) ?? 'Unknown' } }
}
function audioChannels(v) {
	const code = v.trim()
	return {
		key: 'audio_channels',
		values: { audio_channels: lookup(AUDIO_CHANNEL, code), audio_channels_code: code },
	}
}
function sampleRate(v) {
	const code = v.trim()
	if (/^\d+(\.\d+)?$/.test(code)) {
		return { key: 'sample_rate', values: { sample_rate: `${parseFloat(code)} kHz` } }
	}
	return { key: 'sample_rate', values: { sample_rate: code === 'UKN' ? 'Unknown' : code } }
}

/**
 * Parse the body of a status information packet (everything after '@0', without '\r').
 * Returns { key, values } or null if the packet is not recognised.
 */
export function parseStatus(body) {
	for (const p of PARSERS) {
		if (body.startsWith(p.prefix)) {
			return p.parse(body.slice(p.prefix.length))
		}
	}
	return null
}

/**
 * Incremental stream splitter. Feed it Buffers; it calls back with
 *   { type: 'ack' } | { type: 'nack' } | { type: 'packet', body }
 * Text is decoded as latin1 (ISO/IEC 8859-1, p.20).
 */
export class PacketSplitter {
	constructor(onMessage) {
		this.onMessage = onMessage
		this.buffer = ''
	}

	push(data) {
		this.buffer += Buffer.isBuffer(data) ? data.toString('latin1') : String(data)

		for (;;) {
			if (this.buffer.length === 0) return

			const ch = this.buffer.charCodeAt(0)
			if (ch === ACK) {
				this.buffer = this.buffer.slice(1)
				this.onMessage({ type: 'ack' })
				continue
			}
			if (ch === NACK) {
				this.buffer = this.buffer.slice(1)
				this.onMessage({ type: 'nack' })
				continue
			}
			if (ch === 0x40 /* @ */) {
				const end = this.buffer.indexOf(END)
				if (end === -1) {
					// wait for more data, but don't grow forever
					if (this.buffer.length > 1024) this.buffer = ''
					return
				}
				const packet = this.buffer.slice(0, end)
				this.buffer = this.buffer.slice(end + 1)
				// strip '@' + ID character
				const body = packet.length >= 2 ? packet.slice(2) : ''
				this.onMessage({ type: 'packet', body })
				continue
			}
			// Anything else (stray \r, \n, noise) is dropped
			this.buffer = this.buffer.slice(1)
		}
	}

	reset() {
		this.buffer = ''
	}
}
