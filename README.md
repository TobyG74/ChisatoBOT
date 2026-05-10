<p align="center">
    <img src="public/images/icon.jpg" width="160" style="border-radius:50%" alt="ChisatoBOT">
</p>
<h1 align="center">ChisatoBOT</h1>
<h3 align="center">WhatsApp Multi-Device Bot powered by Baileys</h3>
<h3 align="center">Give this repository a ⭐ if you like it</h3>

<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![GPL3 License][license-shield]][license-url]

</div>

<div align="center">

[![JOIN WITH OUT COMMUNITY][community-shield]][community-url]

</div>

## Author

<table align="center">
    <tr>
        <td align="center" valign="top" width="50%">
            <a href="https://github.com/TobyG74">
                <img src="https://avatars.githubusercontent.com/u/32604979?v=4?s=100" width="100px"/>
                <br>
                <strong>TobyG74</strong>
            </a>
        </td>
        <td align="center" valign="top" width="50%">
            <a href="https://github.com/nugraizy">
                <img src="https://avatars.githubusercontent.com/u/69896924?v=4?s=100" width="100px"/>
                <br>
                <strong>Nugraizy</strong>
            </a>
        </td>
    </tr>
</table>

## Description

-   ChisatoBOT is a WhatsApp Multi-Device bot built with TypeScript and Baileys
-   Features 14 command categories covering downloaders, converters, group management, games, anime, search, and more
-   Real-time web dashboard with SSE streaming, system monitoring, and group management
-   MongoDB database via Prisma for users, groups, leveling, and premium system
-   Beautiful terminal logger with colored output and multiple log levels

## Table of Contents

-   [Getting Started](#getting-started)
-   [Built With](#built-with)
-   [Installation](#installation)
-   [Configuration](#configuration)
-   [Features](#features)
-   [Dashboard](#dashboard)
-   [Community](#community)

## Getting Started

Requirements to run this project:

-   [Node.js v18+](https://nodejs.org/en/)
-   [pnpm](https://pnpm.io/) — `npm install -g pnpm`
-   [GIT](https://git-scm.com/downloads)
-   [FFMPEG](https://ffmpeg.org/download.html)
-   [MongoDB](https://www.mongodb.com/cloud/atlas) — local or Atlas
-   [OCR Space API Key](https://ocr.space) — for OCR feature (optional)

### Setup MongoDB

-   Create a MongoDB database (local or [Atlas](https://www.mongodb.com/cloud/atlas))
-   Get your connection string, e.g.: `mongodb+srv://user:pass@cluster.mongodb.net/chisato`
-   Paste it into `DATABASE_URL` in your `.env` file

### Setup `.env`

```env
DATABASE_URL=
DASHBOARD_PORT=3333
JWT_SECRET=
PROXY=
OCR_APIKEY=
```

Rename `.env.example` to `.env`, then fill in the values.

## Built With

![TypeScript](https://img.shields.io/badge/TypeScript-2F6BA3?style=for-the-badge&logo=typescript&logoColor=FFFFFF)
![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-29245c?style=for-the-badge&logo=prisma&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-FFFFFF?style=for-the-badge&logo=mongodb&logoColor=2FA331)

## Installation

### Quick Installation (Recommended)

**Windows:**
```powershell
.\install.ps1
```

**Linux / macOS:**
```bash
chmod +x install.sh && ./install.sh
```

The installer will automatically:
- Check prerequisites (Git, Node.js, FFmpeg)
- Install pnpm dependencies
- Set up environment variables
- Configure Prisma and push the database schema
- Build the TypeScript project

### Manual Installation

```bash
# 1. Clone
git clone https://github.com/TobyG74/ChisatoBOT
cd ChisatoBOT

# 2. Install dependencies (uses pnpm workspaces)
pnpm install

# 3. Push database schema
pnpm prisma:push

# 4. Build
pnpm build

# 5. Run
pnpm start           # plain Node
pnpm pm2:start       # with PM2 (recommended for production)
```

---

## Configuration

### `config.json`

```json
{
    "ownerNumber": ["628xxxxxxxxxx"],
    "teamNumber": [],
    "timeZone": "Asia/Jakarta",
    "prefix": ".",
    "maintenance": [],
    "stickers": {
        "author": "Your Name",
        "packname": "Made by ChisatoBOT"
    },
    "settings": {
        "ownerNotifyOnline": false,
        "useLimit": false,
        "useCooldown": true,
        "selfbot": false,
        "autoReadMessage": false,
        "autoReadStatus": false,
        "autoCorrect": true
    },
    "call": {
        "status": "reject"
    },
    "limit": {
        "command": 30
    }
}
```

| Field | Description |
|---|---|
| `ownerNumber` | Bot owner numbers (international format, no `+`) |
| `teamNumber` | Team/admin numbers with elevated permissions |
| `prefix` | Command prefix (default `.`) |
| `maintenance` | List of commands currently in maintenance mode |
| `ownerNotifyOnline` | Notify owner when bot connects |
| `useLimit` | Enable per-user command limits |
| `useCooldown` | Enable per-command cooldowns |
| `selfbot` | Only respond to owner number |
| `autoReadMessage` | Automatically mark messages as read |
| `autoReadStatus` | Automatically view status updates |
| `autoCorrect` | Suggest correct command on typo |

### Command Config Type

```ts
type ConfigCommands = {
    name: string;
    alias: string[];
    usage?: string;
    category: string;
    description: string;
    cooldown?: number;       // seconds
    limit?: number;
    example?: string;
    isOwner?: boolean;
    isTeam?: boolean;
    isPrivate?: boolean;
    isPremium?: boolean;
    isGroup?: boolean;
    isGroupAdmin?: boolean;
    isGroupOwner?: boolean;
    isBotAdmin?: boolean;
    run: (args: CommandsObject) => unknown;
};
```

---

## Features

### 📥 Downloader
| Command | Description |
|---|---|
| `tiktok` | Download TikTok video |
| `tiktokaudio` | Download TikTok audio |
| `tiktokimage` | Download TikTok slideshow images |
| `instagram` | Download Instagram Reels / photos |
| `facebook` | Download Facebook video |
| `threads` | Download Threads video / photos |
| `xdl` | Download X (Twitter) video |

### 🎨 Converter
| Command | Description |
|---|---|
| `sticker` | Convert image/video to sticker |
| `toimage` | Convert sticker to image |
| `stickerwm` | Create sticker with watermark |
| `textsticker` | Create sticker from text |
| `animatedtext` | Animated text sticker |
| `replysticker` | Reply-based text sticker |
| `meme` | Generate meme from image |
| `emojimix` | Mix two emojis |
| `ocr` | Extract text from image (OCR) |

### 👥 Group Management
| Command | Description |
|---|---|
| `tagall` | Tag all group members |
| `hidetag` | Hidden tag all members |
| `kick` | Remove member from group |
| `add` | Add member to group |
| `promote` / `demote` | Manage admin roles |
| `link` / `revoke` | Get / reset group invite link |
| `groupinfo` | Show group information |
| `groupname` | Change group name |
| `groupdesc` | Change group description |
| `grouppic` | Change group profile picture |
| `leave` | Bot leaves the group |
| `afk` | Set AFK status |
| `fakereply` | Send a fake quoted reply |
| `getpp` | Get profile picture |

### ⚙️ Group Settings
| Command | Description |
|---|---|
| `antilink` | Toggle anti-link protection |
| `antibot` | Toggle anti-bot protection |
| `welcome` | Toggle welcome message |
| `notify` | Toggle member leave notification |
| `mute` | Toggle group mute |
| `announce` / `restrict` | Toggle group lock modes |
| `groupsetting` | View all group settings |
| `banned` / `unbanned` | Ban / unban user from commands |
| `setwelcome` | Set custom welcome message |
| `setleave` | Set custom leave message |

### 🔍 Search & Lookup
| Command | Description |
|---|---|
| `youtube` | YouTube search |
| `bingimage` | Bing image search |
| `ddgimage` | DuckDuckGo image search |
| `pexels` | Search high-quality photos on Pexels |

### 🎌 Anime
| Command | Description |
|---|---|
| `animeranking` | MyAnimeList anime ranking |
| `mangaranking` | MyAnimeList manga ranking |
| `tracemoe` | Reverse image search for anime scenes |

### 📰 News
| Command | Description |
|---|---|
| `earthquake` | Latest earthquake news (BMKG) |

### 🖼️ Wallpaper
| Command | Description |
|---|---|
| `zerochan` | Search wallpapers on Zerochan |

### ℹ️ General
| Command | Description |
|---|---|
| `menu` | Show command menu |
| `about` | About the bot |
| `me` | Your profile info |
| `level` | Your current XP level |
| `leaderboard` | Top users leaderboard |
| `stats` | Bot statistics |
| `owner` | Contact the bot owner |

### 🔧 Misc
| Command | Description |
|---|---|
| `ping` | Bot latency |
| `runtime` | Bot uptime |
| `status` | Quick status check |
| `statistics` | Detailed statistics |

### 🎮 Games

Multiplayer games playable directly in WhatsApp groups.

#### 🐺 Werewolf (`!ww`)

A full Werewolf / Mafia game for groups (4–12+ players) with role card images, EN/ID language voting, and automatic day/night phase management.

| Subcommand | Description |
|---|---|
| `!ww start` | Create a lobby in the group |
| `!ww join` | Join the lobby |
| `!ww leave` | Leave the lobby |
| `!ww lang en\|id` | Vote for game language (EN or ID) |
| `!ww players` | Show current player list |
| `!ww begin` | Host starts the game (min. 4 players) |
| `!ww kill [no]` | 🐺 Werewolf: choose a kill target |
| `!ww check [no]` | 🔮 Seer: investigate a player |
| `!ww save [no]` | 🩺 Doctor: protect a player |
| `!ww heal [no]` | 🧪 Witch: use healing potion |
| `!ww poison [no]` | 🧪 Witch: use poison potion |
| `!ww protect [no]` | 🛡️ Bodyguard: shield a player (1×) |
| `!ww shoot [no]` | 🏹 Hunter: shoot on death |
| `!ww vote [no]` | Vote to execute a player (day phase) |
| `!ww status` | Show current game status |
| `!ww end` | Force-end the game (host / owner) |
| `!ww help` | Show help and role list |

**Roles:** Villager, Werewolf, Alpha Werewolf, Seer, Doctor, Witch, Hunter, Bodyguard, Mayor, Minion, Cursed, Kid

#### 💬 Anonymous Chat (`anonchat`)

Anonymous 1-on-1 chat between random group members.

| Command | Description |
|---|---|
| `anonchat` | Start anonymous chat |
| `anonchat next` | Find a new partner |
| `anonchat stop` | End the session |

### 👑 Owner
Full owner commands: add/delete premium/team, broadcast, approve dashboard access, change bot name/status/picture, config, mode, sync-database, block/unblock, and more.

### Maintenance Toggle

Put any command into maintenance mode without restarting the bot:
```
.commandname -m    → enable maintenance
.commandname -m    → toggle back off
```

---

## Dashboard

Access the web dashboard at `http://localhost:3333` (or the port set in `DASHBOARD_PORT`).

**Features:**
- **Overview** — real-time stat cards (users, groups, uptime, banned)
- **User Distribution** — breakdown by role (owner, team, premium, regular)
- **Group Settings** — aggregated anti-link / anti-bot / welcome / notify / mute counts
- **System Monitor** — CPU, RAM, OS memory with live SSE stream (1s refresh)
- **Groups** — table with settings icons, bot admin indicator, kick/settings actions
- **Commands** — list all commands with maintenance toggle
- **Logs** — live log viewer with level filter
- **Settings** — bot configuration panel

**First login:**
1. Make sure your number is in `ownerNumber` or `teamNumber` in `config.json`
2. Chat the bot and send `.adminpanel` to register your dashboard account
3. Go to `http://localhost:3333` and log in

### Login Page

<p align="center">
    <img src="media/login.png" width="700" alt="ChisatoBOT Login Page">
</p>

### Dashboard Overview

<p align="center">
    <img src="media/dashboard.png" width="700" alt="ChisatoBOT Dashboard">
</p>

---

## Community

-   Special thanks to the bot community below who helped develop ChisatoBOT

<table>
    <tr>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/arugaz">
                <img src="https://avatars.githubusercontent.com/u/53950128?v=4?s=100" width="100px">
                <br>
                <bold>Arugaz</bold>
            </a>
        </td>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/zennn08">
                <img src="https://avatars.githubusercontent.com/u/75623219?v=4?s=100" width="100px">
                <br>
                <bold>Zennn08 (Aqul)</bold>
            </a>
        </td>
    </tr>
    <tr>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/mrhrtz">
                <img src="https://avatars.githubusercontent.com/u/52845610?v=4?s=100" width="100px">
                <br>
                <bold>MRHRTZ</bold>
            </a>
        </td>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/mhankbarbar">
                <img src="https://avatars.githubusercontent.com/u/55822959?v=4?s=100" width="100px">
                <br>
                <bold>Mhankbarbar</bold>
            </a>
        </td>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/itzngga">
                <img src="https://avatars.githubusercontent.com/u/29621457?v=4?s=100" width="100px">
                <br>
                <bold>ItzNgga</bold>
            </a>
        </td>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/itzngga">
                <img src="https://avatars.githubusercontent.com/u/88994722?v=4?s=100" width="100px">
                <br>
                <bold>xbnfz01</bold>
            </a>
        </td>
    </tr>
    <tr>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/faizbastomi">
                <img src="https://avatars.githubusercontent.com/u/64179402?v=4?s=100" width="100px">
                <br>
                <bold>Faiz Bastomi</bold>
            </a>
        </td>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/alphanum404">
                <img src="https://avatars.githubusercontent.com/u/50858033?v=4?s=100" width="100px">
                <br>
                <bold>Alphanum404</bold>
            </a>
        </td>
        <td align="center" valign="top" width="14.28%">
            <a href="https://github.com/dutakey">
                <img src="https://avatars.githubusercontent.com/u/85216552?v=4?s=100" width="100px">
                <br>
                <bold>DutaKey</bold>
            </a>
        </td>
    </tr>
</table>

-   Special Thanks for My Teams

<table>
  <tr>
    <td align="center">
        <img src="https://avatars.githubusercontent.com/u/114492712?s=100&v=4" width="100px" height="100px"/>
        <br>
        <a href="https://github.com/Hidden-Finder">
            <bold>Hidden-Finder</bold>
        </a>
    </td>
    <td align="center">
        <img src="https://avatars.githubusercontent.com/u/123545858?s=100&v=4" width="100px" height="100px">
        <br>
        <a href="https://github.com/botw3a">
            <bold>BOTWEA</bold>
        </a>
    </td>
   </tr> 
  </tr>
</table>

[contributors-shield]: https://img.shields.io/github/contributors/TobyG74/ChisatoBOT.svg?style=for-the-badge
[contributors-url]: https://github.com/TobyG74/ChisatoBOT/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/TobyG74/ChisatoBOT.svg?style=for-the-badge
[forks-url]: https://github.com/TobyG74/ChisatoBOT/network/members
[stars-shield]: https://img.shields.io/github/stars/TobyG74/ChisatoBOT.svg?style=for-the-badge
[stars-url]: https://github.com/TobyG74/ChisatoBOT/stargazers
[issues-shield]: https://img.shields.io/github/issues/TobyG74/ChisatoBOT.svg?style=for-the-badge
[issues-url]: https://github.com/TobyG74/ChisatoBOT/issues
[license-shield]: https://img.shields.io/github/license/TobyG74/ChisatoBOT.svg?style=for-the-badge
[license-url]: https://github.com/TobyG74/ChisatoBOT/blob/main/LICENSE
[community-shield]: https://img.shields.io/badge/JOIN%20WITH%20OUR%20COMMUNITY-FFFFFF?style=for-the-badge&logo=whatsapp&logoColor=0FB830
[community-url]: https://whatsapp.com/channel/0029VaGQpAOKAwEfkKNh6Z0X
