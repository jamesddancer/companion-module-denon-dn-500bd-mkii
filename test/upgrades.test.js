import test from 'node:test'
import assert from 'node:assert/strict'
import { UpgradeScripts } from '../src/upgrades.js'

test('v2.0.0 upgrade', () => {
	const res = UpgradeScripts[0](
		{ currentConfig: {} },
		{
			config: { host: '10.0.0.5', port: 9030 },
			secrets: null,
			actions: [
				{ id: '1', controlId: 'c', actionId: 'Random_mode', options: { sel_cmd: { isExpression: false, value: 'S' } } },
				{ id: '2', controlId: 'c', actionId: 'dvd_menu', options: { sel_cmd: { isExpression: false, value: 'DVPO' } } },
				{ id: '3', controlId: 'c', actionId: 'power', options: { sel_cmd: { isExpression: false, value: 'PW00' } } },
			],
			feedbacks: [],
		},
	)
	assert.deepEqual(res.updatedConfig, {
		host: '10.0.0.5',
		port: '9030',
		poll_enabled: true,
		poll_interval: 1000,
		ack_unsolicited: true,
		response_timeout: 500,
	})
	assert.equal(res.updatedActions.length, 2)
	assert.equal(res.updatedActions[0].actionId, 'random_mode')
	assert.deepEqual(res.updatedActions[1].options.sel_cmd, { isExpression: false, value: 'DVOP' })
})

test('v2.0.3 upgrade turns off ACKing unsolicited status', () => {
	const res = UpgradeScripts[1](
		{ currentConfig: {} },
		{ config: { host: 'x', ack_unsolicited: true }, actions: [], feedbacks: [] },
	)
	assert.equal(res.updatedConfig.ack_unsolicited, false)
	const none = UpgradeScripts[1](
		{ currentConfig: {} },
		{ config: { ack_unsolicited: false }, actions: [], feedbacks: [] },
	)
	assert.equal(none.updatedConfig, null)
})
