# companion-module-denon-dn-500bd-mkii

[Bitfocus Companion](https://bitfocus.io/companion) module for the Denon DN-500BD MKII Blu-ray player. It controls the player over TCP (port 9030 by default) and reads its status into Companion variables and feedbacks.

Built on `@companion-module/base` 2.1 for Companion 4.3 / 5.x. See [companion/HELP.md](companion/HELP.md) for the configuration, actions, feedbacks and the full variable list.

## Development

```sh
corepack enable
yarn install
yarn test        # protocol parser + mock-player tests
yarn check       # companion-module-check
yarn package     # builds denon-dn-500bd-mkii-<version>.tgz
```

To try it in Companion, set **Settings → Developer modules path** to the folder that contains this repo (after `yarn install`), or import the built `.tgz` from the Modules page.

## Variables

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

## Changelog

**V2.0.0**

- Ported to the modern Companion module API (`@companion-module/base` 2.1, Companion 4.3/5.x)
- Added status variables for everything on pages 16-19 of the protocol guide (power, disc, track status, track/title numbers, track metadata, elapsed/remaining time, media type, audio format/channels/dialog, subtitle, sample rate, model/firmware)
- Added configurable status polling, and ACKs for status the player sends on its own
- Added feedbacks: Power State, Track Status, Disc Status, Disc Tray Open
- Added Status presets, plus feedback on the Play/Pause/Eject/Power presets
- Added "Refresh All Status Variables" and "Send Custom Command" actions
- Fixed: Random Mode action never fired and sent the wrong command (now `@0PCPMR<type><mode>`)
- Fixed: Search Speed sent `@0f` / `@0s` instead of `@0PCSLSFf` / `@0PCSLSFs`
- Fixed: Option Menu sent `@0DVPO` instead of `@0DVOP` (existing buttons are upgraded automatically)
- Fixed: Track Searching dropdown listed the Disc Drive options; Disc Tray action had no options
- Fixed spelling in labels ("Mute", "Previous", "Hide OSD", "576")

**V1.0.1**

- Fixed some spelling errors

**V1.0.0**

- Added Presets for all commands

**V0.0.2**

- Indent fixes / Cleanup before adding presets

**V0.0.1**

- Added all commands except the two listed in HELP.MD
