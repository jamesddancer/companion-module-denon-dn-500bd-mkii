// Choice lists carried over from the 1.x module. The ids are the protocol command bodies
// (sent as '@0' + id + '\r'), so they must stay stable for existing buttons.

export const CHOICES_POWER = [
	{ id: 'PW00', label: 'Power On' },
	{ id: 'PW01', label: 'Power Off' },
]

export const CHOICES_DISC_DRIVE = [
	{ id: 'PCDTRYOP', label: 'Eject Disk' },
	{ id: 'PCDTRYCL', label: 'Close Disk' },
]

export const CHOICES_DISC_TRAY = [
	{ id: 'PCDTRYOP', label: 'Open Disc Tray' },
	{ id: 'PCDTRYCL', label: 'Close Disc Tray' },
]

export const CHOICES_TRACK_PLAYBACK = [
	{ id: '2353', label: 'Play' },
	{ id: '2348', label: 'Pause' },
	{ id: '2354', label: 'Stop' },
	{ id: 'mt00', label: 'Turn Mute On' },
	{ id: 'mt01', label: 'Turn Mute Off' },
]

export const CHOICES_TRACK_SELECTION = [
	{ id: '2333', label: 'Restart/Previous Track' },
	{ id: '2332', label: 'Next Track' },
	{ id: 'Tr', label: 'Select Track' },
]

export const CHOICES_TITLE_SELECTION = [
	{ id: 'PCGPPV', label: 'Restart/Previous Title' },
	{ id: 'PCGPNX', label: 'Next Title' },
	{ id: 'PCGp', label: 'Select Title' },
]

export const CHOICES_TRACK_SEARCHING = [
	{ id: 'PCSLSR', label: 'Rewind' },
	// NOTE: the protocol guide lists the same code as "Restart/Previous Title" for Fast Forward.
	// Kept as documented for compatibility; use "Search Speed" for a forward search.
	{ id: 'PCGPPV', label: 'Fast Forward' },
]

export const CHOICES_IR_LOCK = [
	{ id: 'PCIRLK00', label: 'IR Lock' },
	{ id: 'PCIRLK01', label: 'IR Unlock' },
]

export const CHOICES_PANEL_LOCK = [
	{ id: '23KL', label: 'Panel Lock' },
	{ id: '23KU', label: 'Panel Unlock' },
]

export const CHOICES_TIME_DISPLAY = [
	{ id: 'PCTMDEL', label: 'Display Track Elapsed' },
	{ id: 'PCTMDRM', label: 'Display Track Remaining' },
	{ id: 'PCTMDTL', label: 'Display Total Elapsed' },
	{ id: 'PCTMDTR', label: 'Display Total Remaining' },
]

export const CHOICES_REPEAT = [
	{ id: 'PCRPAF', label: 'Set A for A-B Repeat' },
	{ id: 'PCRPBF', label: 'Set B and Start Repeat for A-B Repeat' },
	{ id: 'PCEXRP', label: 'Exit A-B Repeat' },
]

export const CHOICES_PROGRAM_MODE = [
	{ id: 'PCPMP00', label: 'On' },
	{ id: 'PCPMP01', label: 'Off' },
]

export const CHOICES_RANDOM_MODE_TYPE = [
	{ id: 'S', label: 'Shuffle' },
	{ id: 'R', label: 'Random' },
]

export const CHOICES_RANDOM_MODE_MODE = [
	{ id: 'OF', label: 'Off' },
	{ id: 'SI', label: 'Sub Item' },
	{ id: 'IT', label: 'Item' },
	{ id: 'AL', label: 'All' },
]

export const CHOICES_HIDE_OSD = [
	{ id: 'DVHOSD00', label: 'Hide OSD' },
	{ id: 'DVHOSD01', label: 'Show OSD' },
]

export const CHOICES_DVD_MENU = [
	{ id: 'PCSU', label: 'Setup Menu' },
	{ id: 'DVTP', label: 'Top Menu' },
	{ id: 'DVOP', label: 'Option Menu' },
	{ id: 'DVPU', label: 'Pop Up Menu' },
	{ id: 'PCRTN', label: 'Return' },
]

export const CHOICES_AUDIO_DIALOG = [
	{ id: 'DVADLG+', label: 'Primary Dialog' },
	{ id: 'DVADLG-', label: 'Secondary Dialog' },
]

export const CHOICES_CURSOR = [
	{ id: 'PCCUSR1', label: 'Cursor Left' },
	{ id: 'PCCUSR2', label: 'Cursor Right' },
	{ id: 'PCCUSR3', label: 'Cursor Up' },
	{ id: 'PCCUSR4', label: 'Cursor Down' },
]

export const CHOICES_VIDEO_RESOLUTION = [
	{ id: 'DVVR1', label: 'Auto' },
	{ id: 'DVVR2', label: '480/576i' },
	{ id: 'DVVR3', label: '480/576p' },
	{ id: 'DVVR4', label: '720p' },
	{ id: 'DVVR5', label: '1080i' },
	{ id: 'DVVR6', label: '1080p' },
]

export const CHOICES_FUNCTIONS_COLOR = [
	{ id: 'DVFCLR1', label: 'Red Function' },
	{ id: 'DVFCLR2', label: 'Green Function' },
	{ id: 'DVFCLR3', label: 'Blue Function' },
	{ id: 'DVFCLR4', label: 'Yellow Function' },
]

export const CHOICES_SEARCH_SPEED = [
	{ id: 'f', label: 'Fast Speed' },
	{ id: 's', label: 'Slow Speed' },
]

export const CHOICES_DVD_AUTO = [
	{ id: 'PCAP00', label: 'Auto Play On' },
	{ id: 'PCAP01', label: 'Auto Play Off' },
]

export const CHOICES_AUTO_RESUME = [
	{ id: 'PCAR00', label: 'Enable Auto Resume' },
	{ id: 'PCAR01', label: 'Disable Auto Resume' },
]
