import { combineRgb } from '@companion-module/base'
import * as C from './choices.js'

const MODULE = 'denon-dn-500bd-mkii'
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const GREEN = combineRgb(0, 204, 0)
const YELLOW = combineRgb(255, 255, 0)
const RED = combineRgb(255, 0, 0)
const SIZE = '18'

/** Feedbacks to add to particular command presets, keyed by `${actionId}:${sel_cmd}` */
const PRESET_FEEDBACKS = {
	'power:PW00': [{ feedbackId: 'power_state', options: { state: 'On' }, style: { bgcolor: GREEN, color: WHITE } }],
	'power:PW01': [{ feedbackId: 'power_state', options: { state: 'Off' }, style: { bgcolor: RED, color: BLACK } }],
	'disc_drive:PCDTRYOP': [{ feedbackId: 'tray_open', options: {}, style: { bgcolor: YELLOW, color: BLACK } }],
	'disc_tray:PCDTRYOP': [{ feedbackId: 'tray_open', options: {}, style: { bgcolor: YELLOW, color: BLACK } }],
	'track_playback:2353': [
		{ feedbackId: 'track_status', options: { status: 'PL' }, style: { bgcolor: GREEN, color: WHITE } },
	],
	'track_playback:2348': [
		{ feedbackId: 'track_status', options: { status: 'PP' }, style: { bgcolor: YELLOW, color: BLACK } },
	],
}

export function UpdatePresets(self) {
	const presets = {}
	/** @type {Map<string, string[]>} */
	const sections = new Map()

	const add = (category, id, preset) => {
		presets[id] = preset
		if (!sections.has(category)) sections.set(category, [])
		sections.get(category).push(id)
	}

	const button = (name, text, actionId, options, size = SIZE, feedbacks = []) => ({
		type: 'simple',
		name,
		style: { text, size, color: WHITE, bgcolor: BLACK },
		steps: [{ down: [{ actionId, options }], up: [] }],
		feedbacks,
	})

	const fromChoices = (category, actionId, choices, extra = {}) => {
		for (const choice of choices) {
			add(
				category,
				`${actionId}_${choice.id}`,
				button(
					choice.label,
					choice.label,
					actionId,
					{ sel_cmd: choice.id, ...extra },
					SIZE,
					PRESET_FEEDBACKS[`${actionId}:${choice.id}`] ?? [],
				),
			)
		}
	}

	const fixed = (category, actionId, label) => add(category, actionId, button(label, label, actionId, {}))

	fromChoices('System', 'power', C.CHOICES_POWER)
	fromChoices('System', 'disc_drive', C.CHOICES_DISC_DRIVE)
	fromChoices('Track/Title', 'track_playback', C.CHOICES_TRACK_PLAYBACK)
	fromChoices('Track/Title', 'track_selection', C.CHOICES_TRACK_SELECTION, { sel_val: 1 })
	fromChoices('Track/Title', 'title_selection', C.CHOICES_TITLE_SELECTION, { sel_val: 1 })
	fromChoices('Track/Title', 'track_searching', C.CHOICES_TRACK_SEARCHING)

	for (let x = 0; x < 10; x++) {
		add('Buttons', `number_${x}`, button(`Number ${x}`, `${x}`, 'number_buttons', { sel_val: x }, '44'))
	}

	fromChoices('System', 'ir_lock', C.CHOICES_IR_LOCK)
	fromChoices('System', 'panel_lock', C.CHOICES_PANEL_LOCK)
	fromChoices('System', 'time_display', C.CHOICES_TIME_DISPLAY)
	fromChoices('Repeat', 'repeat', C.CHOICES_REPEAT)
	fromChoices('Program Mode', 'program_mode', C.CHOICES_PROGRAM_MODE)

	for (const type of C.CHOICES_RANDOM_MODE_TYPE) {
		for (const mode of C.CHOICES_RANDOM_MODE_MODE) {
			const label = `${type.label} ${mode.label}`
			add(
				'Program Mode',
				`random_mode_${type.id}_${mode.id}`,
				button(label, label, 'random_mode', { sel_cmd: type.id, sel_val: mode.id }),
			)
		}
	}

	fromChoices('OSD', 'hide_osd', C.CHOICES_HIDE_OSD)
	fromChoices('DVD Menu', 'dvd_menu', C.CHOICES_DVD_MENU)
	fromChoices('Audio Dialog', 'audio_dialog', C.CHOICES_AUDIO_DIALOG)
	fixed('Buttons', 'subtitles', 'Subtitles Toggle')
	fixed('Buttons', 'angle', 'Adjust Video Angle')
	fromChoices('Cursor', 'cursor', C.CHOICES_CURSOR)
	fixed('Buttons', 'enter', 'Enter/Activate Menu')
	fromChoices('System', 'disc_tray', C.CHOICES_DISC_TRAY)
	fromChoices('Video Resolution', 'video_resolution', C.CHOICES_VIDEO_RESOLUTION)
	fixed('Buttons', 'display_info', 'Display Bit Rate/Media Info')
	fromChoices('Functions/Color', 'functions_color', C.CHOICES_FUNCTIONS_COLOR)
	fixed('Buttons', 'pip_mode', 'PIP Modes')
	fixed('Buttons', 'home_menu', 'Home Menu')
	fromChoices('Search Speed', 'search_speed', C.CHOICES_SEARCH_SPEED)
	fromChoices('DVD/CD Auto Play', 'dvd_auto', C.CHOICES_DVD_AUTO)
	fromChoices('Auto Resume', 'auto_resume', C.CHOICES_AUTO_RESUME)

	// Status display buttons (new in 2.0.0)
	const v = (id) => `$(${MODULE}:${id})`
	const status = (id, name, text, feedbacks = []) =>
		add('Status', `status_${id}`, {
			type: 'simple',
			name,
			style: { text, size: '14', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [], up: [] }],
			feedbacks,
		})

	status('power', 'Power status', `Power\\n${v('power')}`, [
		{ feedbackId: 'power_state', options: { state: 'On' }, style: { bgcolor: GREEN, color: WHITE } },
	])
	status('track_status', 'Track status', `${v('track_status')}`, [
		{ feedbackId: 'track_status', options: { status: 'PL' }, style: { bgcolor: GREEN, color: WHITE } },
		{ feedbackId: 'track_status', options: { status: 'PP' }, style: { bgcolor: YELLOW, color: BLACK } },
	])
	status('disc_status', 'Disc status', `Disc\\n${v('disc_status')}`, [
		{ feedbackId: 'tray_open', options: {}, style: { bgcolor: YELLOW, color: BLACK } },
	])
	status('track', 'Track x of y', `Track\\n${v('track_number')}/${v('track_count')}`)
	status('title', 'Title x of y', `Title\\n${v('group_number')}/${v('group_count')}`)
	status('elapsed', 'Elapsed time', `Elapsed\\n${v('elapsed_time')}`)
	status('remaining', 'Remaining time', `Remain\\n${v('remaining_time')}`)
	status('track_title', 'Track title', `${v('track_title')}`)
	status('media', 'Media / audio info', `${v('media_type')}\\n${v('audio_format')}\\n${v('audio_channels')}`)

	const structure = [...sections.entries()].map(([name, ids]) => ({
		id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
		name,
		definitions: ids,
	}))

	self.setPresetDefinitions(structure, presets)
}
