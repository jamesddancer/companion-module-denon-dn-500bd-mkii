import test from 'node:test'
import assert from 'node:assert/strict'
import { PacketSplitter, parseStatus, buildPacket } from '../src/protocol.js'

const p = (body) => parseStatus(body)

test('framing', () => {
	assert.equal(buildPacket('PW00'), '@0PW00\r')
	const out = []
	const s = new PacketSplitter((m) => out.push(m))
	s.push(Buffer.from('\x06@0STP'))
	s.push(Buffer.from('L\r\x15@0CDTO\r\n'))
	assert.deepEqual(
		out.map(({ type, body }) => (body === undefined ? { type } : { type, body })),
		[{ type: 'ack' }, { type: 'packet', body: 'STPL' }, { type: 'nack' }, { type: 'packet', body: 'CDTO' }],
	)
})

const split = (chunks, flush = false) => {
	const out = []
	const s = new PacketSplitter((m) => out.push(m.type === 'packet' ? `P:${m.body}` : m.type))
	for (const c of chunks) s.push(Buffer.from(c, 'latin1'))
	if (flush) s.flush()
	return out
}

test('tolerant framing: ASCII ack/nack text', () => {
	assert.deepEqual(split(['ack@0STPL\r', 'nack', 'AC', 'K\r\n@0CDCI\r\n']), ['ack', 'P:STPL', 'nack', 'ack', 'P:CDCI'])
})

test('tolerant framing: \\n, no @0 prefix, ACK byte as terminator, back-to-back packets', () => {
	assert.deepEqual(split(['STPL\n', '@0CDCI\x06', '@0Tr0001@0Tt0012\r', '@ 0ST PP\r']), [
		'P:STPL',
		'P:CDCI',
		'ack',
		'P:Tr0001',
		'P:Tt0012',
		'P:ST PP',
	])
})

test('tolerant framing: unterminated packet only emitted on flush', () => {
	assert.deepEqual(split(['@0STPL']), [])
	assert.deepEqual(split(['@0STPL'], true), ['P:STPL'])
	assert.deepEqual(split(['ac'], true), ['P:ac'])
})

test('answer with echoed "?"', () => {
	assert.equal(p('?STPL').values.track_status, 'Playing')
	assert.equal(p('?PCGp0003').values.group_number, 3)
})

test('latin1 text', () => {
	const out = []
	const s = new PacketSplitter((m) => out.push(m))
	s.push(Buffer.from('@0tiCaf\xe9 del Mar\r', 'latin1'))
	assert.equal(p(out[0].body).values.track_title, 'Café del Mar')
})

test('disc status', () => {
	assert.deepEqual(p('CDTO'), {
		key: 'disc',
		values: { disc_status: 'Tray Open', disc_status_code: 'TO', tray_open: true, disc_present: false },
	})
	assert.equal(p('CDNC').values.disc_status, 'No Disc')
	assert.equal(p('CDCI').values.disc_present, true)
	assert.equal(p('CDUF').values.disc_status, 'Unformatted')
	assert.equal(p('CDTC').values.disc_status, 'Tray Closed')
	assert.equal(p('CDTE').values.disc_status, 'Tray Error')
})

test('track status', () => {
	const cases = {
		STPL: 'Playing',
		STPP: 'Paused',
		STDVSF: 'Slow Play Forward',
		STDVSR: 'Slow Play Reverse',
		STDVFF: 'Fast Play Forward',
		STDVFR: 'Fast Play Reverse',
		STDVSP: 'Step Play',
		STED: 'Menu',
		STDVSU: 'Setup',
		STDVTR: 'Track Menu',
		STDVHM: 'Home',
		STXX: 'Unknown (XX)',
	}
	for (const [body, label] of Object.entries(cases)) assert.equal(p(body).values.track_status, label, body)
	assert.equal(p('STPL').values.playing, true)
	assert.equal(p('STPP').values.paused, true)
})

test('numbers and text', () => {
	assert.deepEqual(p('Tr0012'), { key: 'track_number', values: { track_number: 12 } })
	assert.equal(p('TrUNKN').values.track_number, 'Unknown')
	assert.deepEqual(p('Tt0020'), { key: 'track_count', values: { track_count: 20 } })
	assert.equal(p('tiMy Song').values.track_title, 'My Song')
	assert.equal(p('atThe Artist').values.track_artist, 'The Artist')
	assert.equal(p('alThe Album').values.album_title, 'The Album')
	assert.equal(p('?PCGp0003').values.group_number, 3)
	assert.equal(p('PCGp0004').values.group_number, 4)
	assert.equal(p('?PCTGUNKN').values.group_count, 'Unknown')
	assert.equal(p('PCTG0010').values.group_count, 10)
})

test('times', () => {
	assert.deepEqual(p('tl00325').values, { track_time: '03:25', track_time_seconds: 205, track_time_frames: null })
	assert.deepEqual(p('tl0032574').values, { track_time: '03:25', track_time_seconds: 205, track_time_frames: 74 })
	assert.deepEqual(p('ET0010203').values, { elapsed_time: '01:02:03', elapsed_mmss: '62:03', elapsed_seconds: 3723 })
	assert.deepEqual(p('RM0000059').values, {
		remaining_time: '00:00:59',
		remaining_mmss: '00:59',
		remaining_seconds: 59,
	})
	assert.equal(p('ET0000707').values.elapsed_mmss, '07:07')
	assert.equal(p('ET0011215').values.elapsed_mmss, '72:15')
	assert.equal(p('RM0004029').values.remaining_mmss, '40:29')
	assert.equal(p('ETUNKN').values.elapsed_mmss, '')
})

test('media / audio', () => {
	assert.equal(p('PCTYPBDM').values.media_type, 'BDMV')
	assert.equal(p('PCTYPEXT').values.media_type, 'External Memory')
	assert.equal(p('PCAFMTDHM').values.audio_format, 'DTS-HD MA')
	assert.equal(p('PCAFMTDD+').values.audio_format, 'Dolby Digital Plus')
	assert.equal(p('BDACH51C').values.audio_channels, '5.1ch')
	assert.equal(p('PCACHL/R').values.audio_channels, 'L/R (CD/VCD/MP3)')
	assert.deepEqual(p('PCDG+eng'), {
		key: 'audio_dialog_primary',
		values: { audio_dialog_primary: 'English', audio_dialog_primary_code: 'eng' },
	})
	assert.equal(p('PCDG-fre').values.audio_dialog_secondary, 'French')
	assert.equal(p('PCDG-UKN').values.audio_dialog_secondary, 'Unknown')
	assert.equal(p('DVSTCspa').values.subtitle, 'Spanish')
	assert.equal(p('Fs48').values.sample_rate, '48 kHz')
	assert.equal(p('Fs044.1').values.sample_rate, '44.1 kHz')
	assert.equal(p('FsUKN').values.sample_rate, 'Unknown')
})

test('misc', () => {
	assert.deepEqual(p('VN01.02.03DN-500BD'), {
		key: 'model',
		values: { firmware_version: '01.02.03', model_name: 'DN-500BD' },
	})
	assert.equal(p('PCCT00').values.network_connection, 'Connected')
	assert.equal(p('PCCT01').values.network_connection, 'Failed')
	assert.equal(p('PCPMRSAL').values.random_mode, 'Shuffle All')
	assert.equal(p('PCPMRROF').values.random_mode, 'Off')
	assert.equal(p('BDERBUSY').key, 'busy')
	assert.equal(p('ZZZ'), null)
})
