/*
 * Upgrade scripts. Once added, a script must never be removed or reordered.
 */

function plain(opt) {
	return opt && opt.isExpression === false ? opt.value : undefined
}

export const UpgradeScripts = [
	/**
	 * v2.0.0: port from the Companion 2.x (instance_skel) module
	 *  - add the new status polling config fields
	 *  - "Option Menu" used the wrong code (DVPO), the protocol guide says DVOP
	 *  - preset buttons used the non-existent action id "Random_mode"
	 */
	function v2_0_0(_context, props) {
		let updatedConfig = null
		if (props.config) {
			const cfg = { ...props.config }
			if (cfg.port !== undefined && typeof cfg.port !== 'string') cfg.port = String(cfg.port)
			if (cfg.port === undefined || cfg.port === '') cfg.port = '9030'
			if (cfg.poll_enabled === undefined) cfg.poll_enabled = true
			if (cfg.poll_interval === undefined) cfg.poll_interval = 1000
			if (cfg.ack_unsolicited === undefined) cfg.ack_unsolicited = true
			if (cfg.response_timeout === undefined) cfg.response_timeout = 500
			updatedConfig = cfg
		}

		const updatedActions = []
		for (const action of props.actions) {
			let changed = false
			if (action.actionId === 'Random_mode') {
				action.actionId = 'random_mode'
				changed = true
			}
			if (action.actionId === 'dvd_menu' && plain(action.options.sel_cmd) === 'DVPO') {
				action.options.sel_cmd = { isExpression: false, value: 'DVOP' }
				changed = true
			}
			if (changed) updatedActions.push(action)
		}

		return { updatedConfig, updatedActions, updatedFeedbacks: [] }
	},

	/**
	 * v2.0.3: over the network the player NACKs the ACK byte we sent for unsolicited status,
	 * so stop sending it by default.
	 */
	function v2_0_3(_context, props) {
		let updatedConfig = null
		if (props.config && props.config.ack_unsolicited !== false) {
			updatedConfig = { ...props.config, ack_unsolicited: false }
		}
		return { updatedConfig, updatedActions: [], updatedFeedbacks: [] }
	},
]
