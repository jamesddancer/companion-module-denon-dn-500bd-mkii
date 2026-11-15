import { combineRgb } from '@companion-module/base'
import { DISC_STATUS, TRACK_STATUS } from './protocol.js'

const toChoices = (table) => Object.entries(table).map(([id, label]) => ({ id, label }))

export function UpdateFeedbacks(self) {
	self.setFeedbackDefinitions({
		power_state: {
			type: 'boolean',
			name: 'Power State',
			description: 'True when the power state matches',
			defaultStyle: { bgcolor: combineRgb(0, 204, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					type: 'dropdown',
					id: 'state',
					label: 'State',
					default: 'On',
					choices: [
						{ id: 'On', label: 'On' },
						{ id: 'Off', label: 'Off' },
					],
				},
			],
			callback: (fb) => self.state.power === fb.options.state,
		},
		track_status: {
			type: 'boolean',
			name: 'Track Status',
			description: 'True when the track status (Playing, Paused, ...) matches',
			defaultStyle: { bgcolor: combineRgb(0, 204, 0), color: combineRgb(255, 255, 255) },
			options: [
				{
					type: 'dropdown',
					id: 'status',
					label: 'Status',
					default: 'PL',
					choices: toChoices(TRACK_STATUS),
				},
			],
			callback: (fb) => self.state.track_status_code === fb.options.status,
		},
		disc_status: {
			type: 'boolean',
			name: 'Disc Status',
			description: 'True when the disc status (No Disc, Tray Open, ...) matches',
			defaultStyle: { bgcolor: combineRgb(255, 255, 0), color: combineRgb(0, 0, 0) },
			options: [
				{
					type: 'dropdown',
					id: 'status',
					label: 'Status',
					default: 'TO',
					choices: toChoices(DISC_STATUS),
				},
			],
			callback: (fb) => self.state.disc_status_code === fb.options.status,
		},
		tray_open: {
			type: 'boolean',
			name: 'Disc Tray Open',
			description: 'True while the disc tray is opening or open',
			defaultStyle: { bgcolor: combineRgb(255, 255, 0), color: combineRgb(0, 0, 0) },
			options: [],
			callback: () => self.state.disc_status_code === 'TO',
		},
	})
}
