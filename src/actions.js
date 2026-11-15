import * as C from './choices.js'

const TRACK_NOTE =
	'Note: “Track” refers to “Chapter” during DVD or BD playback. “Group” refers to “Title” during DVD or BD playback and “Folder” refers to USB and other media playback.'

function pad4(num) {
	return String(Math.max(0, Math.round(Number(num) || 0))).padStart(4, '0')
}

const info = () => ({ type: 'static-text', id: 'info', label: 'Information', width: 12, value: TRACK_NOTE })

const dropdown = (choices, def, label = 'Option') => ({
	type: 'dropdown',
	id: 'sel_cmd',
	label,
	default: def,
	choices,
})

export function UpdateActions(self) {
	const send = (body) => self.sendCommand(body)

	/** Simple action: a dropdown whose selected id is the command body */
	const simple = (name, choices, def, extraOptions = []) => ({
		name,
		options: [...extraOptions, dropdown(choices, def)],
		callback: async (action) => send(String(action.options.sel_cmd)),
	})

	/** Fixed command with no options */
	const fixed = (name, body) => ({
		name,
		options: [],
		callback: async () => send(body),
	})

	self.setActionDefinitions({
		power: simple('Power', C.CHOICES_POWER, 'PW00'),
		disc_drive: simple('Disc Drive', C.CHOICES_DISC_DRIVE, 'PCDTRYOP'),
		track_playback: simple('Track Playback', C.CHOICES_TRACK_PLAYBACK, '2353', [info()]),
		track_selection: {
			name: 'Track Selection',
			options: [
				info(),
				dropdown(C.CHOICES_TRACK_SELECTION, '2333'),
				{
					type: 'number',
					id: 'sel_val',
					label: 'Track Number (1-2000)',
					min: 1,
					max: 2000,
					default: 1,
					asInteger: true,
					isVisibleExpression: `$(options:sel_cmd) == 'Tr'`,
				},
			],
			callback: async (action) => {
				const cmd = String(action.options.sel_cmd)
				send(cmd === 'Tr' ? cmd + pad4(action.options.sel_val) : cmd)
			},
		},
		title_selection: {
			name: 'Group/Title Selection',
			options: [
				info(),
				dropdown(C.CHOICES_TITLE_SELECTION, 'PCGPPV'),
				{
					type: 'number',
					id: 'sel_val',
					label: 'Title Number (1-2000)',
					min: 1,
					max: 2000,
					default: 1,
					asInteger: true,
					isVisibleExpression: `$(options:sel_cmd) == 'PCGp'`,
				},
			],
			callback: async (action) => {
				const cmd = String(action.options.sel_cmd)
				send(cmd === 'PCGp' ? cmd + pad4(action.options.sel_val) : cmd)
			},
		},
		track_searching: simple('Track Searching', C.CHOICES_TRACK_SEARCHING, 'PCSLSR', [info()]),
		number_buttons: {
			name: 'Number Buttons',
			options: [
				{
					type: 'number',
					id: 'sel_val',
					label: 'Number (0-9)',
					min: 0,
					max: 9,
					default: 1,
					asInteger: true,
				},
			],
			callback: async (action) => {
				const n = Math.min(9, Math.max(0, Math.round(Number(action.options.sel_val) || 0)))
				send('PCTKEY' + n)
			},
		},
		ir_lock: simple('IR Lock/Unlock', C.CHOICES_IR_LOCK, 'PCIRLK00'),
		panel_lock: simple('Panel Lock/Unlock', C.CHOICES_PANEL_LOCK, '23KL'),
		time_display: simple('Time Display', C.CHOICES_TIME_DISPLAY, 'PCTMDEL'),
		repeat: simple('Repeat', C.CHOICES_REPEAT, 'PCRPAF'),
		program_mode: simple('Program Mode', C.CHOICES_PROGRAM_MODE, 'PCPMP00'),
		random_mode: {
			name: 'Random Mode',
			options: [
				dropdown(C.CHOICES_RANDOM_MODE_TYPE, 'S', 'Type'),
				{
					type: 'dropdown',
					id: 'sel_val',
					label: 'Mode',
					default: 'AL',
					choices: C.CHOICES_RANDOM_MODE_MODE,
				},
			],
			callback: async (action) => send('PCPMR' + action.options.sel_cmd + action.options.sel_val),
		},
		hide_osd: simple('Hide OSD', C.CHOICES_HIDE_OSD, 'DVHOSD00'),
		dvd_menu: simple('BD/DVD Disc Menu', C.CHOICES_DVD_MENU, 'PCSU'),
		audio_dialog: simple('Audio Dialog', C.CHOICES_AUDIO_DIALOG, 'DVADLG+'),
		subtitles: fixed('Subtitles Toggle', 'DVSBTL1'),
		angle: fixed('Adjust Video Angle', 'DVANGL+'),
		cursor: simple('Cursor', C.CHOICES_CURSOR, 'PCCUSR1'),
		enter: fixed('Enter/Activate Menu', 'PCENTR'),
		disc_tray: simple('Disc Tray', C.CHOICES_DISC_TRAY, 'PCDTRYOP'),
		video_resolution: simple('Video Resolution', C.CHOICES_VIDEO_RESOLUTION, 'DVVR1'),
		display_info: fixed('Display Bit Rate/Media Info', 'DVDSIF'),
		functions_color: simple('Functions/Color', C.CHOICES_FUNCTIONS_COLOR, 'DVFCLR1'),
		pip_mode: fixed('PIP Modes', 'DVMO'),
		home_menu: fixed('Home Menu', 'PCHM'),
		search_speed: {
			name: 'Search Speed',
			options: [dropdown(C.CHOICES_SEARCH_SPEED, 'f')],
			callback: async (action) => send('PCSLSF' + action.options.sel_cmd),
		},
		dvd_auto: simple('DVD/CD Auto Play', C.CHOICES_DVD_AUTO, 'PCAP00'),
		auto_resume: simple('Auto Resume', C.CHOICES_AUTO_RESUME, 'PCAR00'),
		refresh_status: {
			name: 'Refresh All Status Variables',
			description: 'Immediately request every status from the player',
			options: [],
			callback: async () => self.requestAllStatus(),
		},
		send_custom: {
			name: 'Send Custom Command',
			description: "Send a raw command body. '@0' and the carriage return are added automatically.",
			options: [
				{
					type: 'textinput',
					id: 'cmd',
					label: 'Command (without @0)',
					default: '',
				},
			],
			callback: async (action) => {
				const body = String(action.options.cmd ?? '').trim()
				if (body) send(body)
			},
		},
	})
}
