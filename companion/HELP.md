## Denon DN-500BD MKII

This module controls a Denon DN-500BD MKII Blu-ray player over the network (TCP) and reads its status back into Companion variables and feedbacks.

### Configuration

- **Target IP**: IP address of the player
- **Target Port**: TCP control port (default `9030`)
- **Poll status**: periodically request the player's status (default on). Turn it off if you only want to send commands; variables will then only change when the player sends status on its own.
- **Poll interval**: how often to poll, in ms (default `1000`). Track/disc metadata (titles, audio format, etc.) is refreshed every 5 seconds and whenever the track, title or disc changes.
- **Send ACK byte for unsolicited status**: serial-port behaviour. Leave it off on the network: the player answers the ACK byte with `nack`. Upgrading to 2.0.3 turns it off.
- **Response timeout**: how long to wait for the player to answer each command (default `500` ms).
- **Debug log raw traffic**: logs every packet sent (TX) and every byte received (RX, as hex and text) plus each timeout at debug level. On by default; turn it off once everything works.

The player only answers one command at a time, so commands are queued. Button presses always go ahead of queued status requests.

When the player is in standby it doesn't answer, so the module reports `power` as `Off` and only polls the power status until it wakes up.

### Actions

Power, Disc Drive / Disc Tray, Track Playback (play, pause, stop, mute), Track Selection, Group/Title Selection, Track Searching, Number Buttons, IR Lock/Unlock, Panel Lock/Unlock, Time Display, Repeat, Program Mode, Random Mode, Hide OSD, BD/DVD Disc Menus, Audio Dialog, Subtitle, Angle, Cursor, Enter, Video Resolution, Display/Info, Function/Color, Mode/Option (PIP), Home, Slow/Search, DVD/CD Auto Play, Auto Resume, **Refresh All Status Variables**, and **Send Custom Command** (send any command from the protocol guide; `@0` and the carriage return are added for you).

### Feedbacks

- **Power State**: power is On / Off
- **Track Status**: Playing, Paused, Slow/Fast Play, Step Play, Menu, Setup, Track Menu, Home
- **Disc Status**: No Disc, Disc In, Unformatted, Tray Open, Tray Closed, Tray Error
- **Disc Tray Open**

### Variables

Use them as `$(<connection label>:<variable>)`, for example `$(denon:elapsed_time)`.

| Variable                      | Description                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `connection`                  | Connection state (Connected / Disconnected)                                                              |
| `power`                       | Power status (On / Off / Unknown)                                                                        |
| `disc_status`                 | Disc status (No Disc, Disc In, Unformatted, Tray Open, Tray Closed, Tray Error)                          |
| `disc_status_code`            | Disc status raw code (NC, CI, UF, TO, TC, TE)                                                            |
| `tray_open`                   | Disc tray is open/opening (true/false)                                                                   |
| `disc_present`                | A disc is loaded (true/false)                                                                            |
| `track_status`                | Track status (Playing, Paused, Slow/Fast Play Forward/Reverse, Step Play, Menu, Setup, Track Menu, Home) |
| `track_status_code`           | Track status raw code (PL, PP, DVSF, DVSR, DVFF, DVFR, DVSP, ED, DVSU, DVTR, DVHM)                       |
| `playing`                     | Currently playing (true/false)                                                                           |
| `paused`                      | Currently paused (true/false)                                                                            |
| `track_number`                | Current track/chapter number                                                                             |
| `track_count`                 | Total number of tracks/chapters in the tracklist                                                         |
| `track_title`                 | Title of the current track                                                                               |
| `track_artist`                | Artist of the current track                                                                              |
| `album_title`                 | Album of the current track                                                                               |
| `track_time`                  | Current track time position (MM:SS)                                                                      |
| `track_time_seconds`          | Current track time position in seconds                                                                   |
| `track_time_frames`           | Current track time frame (00-74), if reported                                                            |
| `group_number`                | Current group/title/folder number                                                                        |
| `group_count`                 | Total number of groups/titles/folders                                                                    |
| `elapsed_time`                | Elapsed track time (HH:MM:SS)                                                                            |
| `elapsed_seconds`             | Elapsed track time in seconds                                                                            |
| `remaining_time`              | Remaining track time (HH:MM:SS)                                                                          |
| `remaining_seconds`           | Remaining track time in seconds                                                                          |
| `media_type`                  | Media type (DVD Video, BDMV, CD-DA, ...)                                                                 |
| `media_type_code`             | Media type raw code (DVV, DVA, CDA, CDR, SAC, DVR, BDM, BDA, AVH, DLN, EXT, UKN)                         |
| `audio_format`                | Audio format (Dolby Digital, DTS, LPCM, DTS-HD MA, ...)                                                  |
| `audio_format_code`           | Audio format raw code (DBD, DTS, MPG, LPC, ...)                                                          |
| `audio_channels`              | Audio channels (2ch, 5.1ch, 7.1ch, ...)                                                                  |
| `audio_channels_code`         | Audio channels raw code (2CH, 51C, 71C, ...)                                                             |
| `audio_dialog_primary`        | Primary audio dialog language                                                                            |
| `audio_dialog_primary_code`   | Primary audio dialog ISO 639-2 code                                                                      |
| `audio_dialog_secondary`      | Secondary audio dialog language                                                                          |
| `audio_dialog_secondary_code` | Secondary audio dialog ISO 639-2 code                                                                    |
| `subtitle`                    | Subtitle language                                                                                        |
| `subtitle_code`               | Subtitle raw code                                                                                        |
| `sample_rate`                 | Current track sampling frequency (kHz)                                                                   |
| `firmware_version`            | Firmware version                                                                                         |
| `model_name`                  | Model name                                                                                               |
| `network_connection`          | Network connection test result (Connected / Failed)                                                      |
| `random_mode`                 | Random/shuffle mode (only updated when the player reports it)                                            |
| `last_error`                  | Last error reported by the player (Busy / NACK: <command>)                                               |

### Troubleshooting

Open the connection's log with debug messages shown:

- `Receiving status from the player (first reply: ...)` at info level means status is being read.
- Over the network the player answers status requests as `ack+<payload>` with no terminator. The payload is `@0<code><data>`, the bare data (e.g. `ack+0000707` for elapsed time), or `error` when the value isn't available. `error` shows the variable as `N/A`, and after 3 errors in a row that value is only re-checked every 30 s.
- `RX ... bytes: ...` lines show exactly what the player sent. ACK/NACK may arrive as the bytes 0x06/0x15 or as the text `ack`/`nack`; both are accepted.
- `No reply to @0?XX within N ms (0 bytes received meanwhile)` means the player said nothing to that request.
- A warning `... status requests in a row got no usable reply` or `No bytes at all received from the player` means status replies aren't arriving or are in a format the module doesn't recognise. The RX lines show what did arrive.

### Presets

Presets cover every action. The Play, Pause, Eject and Power buttons light up from the player's status, and a **Status** section has ready-made display buttons (power, track status, disc, track x/y, title x/y, elapsed, remaining, track title, media/audio info).

### Not implemented yet

- BD/DVD Ratings
- Menu Settings (whole category); you can use **Send Custom Command** for these
