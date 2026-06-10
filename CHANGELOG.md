# Changelog

All notable changes to ChisatoBOT are documented in this file.

## 2026-06-10

- refactor: Rebuild the entire dashboard as a Svelte 5 + Tailwind v4 SPA (Vite), replacing the hand-written HTML/JS pages
- refactor: Source lives in web/ and builds into public/ via `npm run web:build`; Fastify still serves it (hash-based routing, no SPA fallback needed)
- feat: Unified design system (Toggle/Modal/Toaster components, shared api/auth/ui/format libs) and a single session store for owner/team and group admins
- feat: Reusable success/error popup + toast notifications across all dashboard actions
- chore: Add web:dev (Vite dev server proxying /api to :3000) and fold web:build into the main build script
- feat: Add group-admin dashboard so group admins can log in and manage groups they administer
- feat: Implement reverse-OTP group-admin login — the website generates a code, the admin sends it to the bot, and the bot validates both the sender number and the code
- feat: Add group-admin controls — change name/description, kick/promote/demote members, get/revoke invite link, update group picture
- feat: Add per-group bot settings and WhatsApp settings (announce, restrict, join approval) from the dashboard
- feat: Add drag-and-drop welcome/leave image builder with live preview, custom background, colors, and element positions
- feat: Make welcome/leave images config-driven per group (defaults preserve the original design)
- feat: Add a per-group audit log of admin actions (who renamed, kicked, toggled settings)
- feat: Notify the group when an admin toggles a bot/WhatsApp feature from the dashboard
- feat: Redesign the group-admin login to match the owner/team login (animated background, particles, glass card)
- feat: Add success popups for group name/description, picture, and layout changes
- fix: Prevent reconnect storms with exponential backoff + jitter and a single pending reconnect
- fix: Halt auto-reconnect on 403 Forbidden (account block) instead of hammering the connection and clearing the session
- fix: Robustly detect when the bot itself is removed so it never sends a leave image to a group that kicked it (a primary ban cause)
- fix: Throttle and batch welcome/leave sends, skip them when the socket is closing, and cap event-media uploads
- fix: Skip group metadata refresh when the connection is closing

## 2026-05-16

- feat: Add leave message configuration and update related dashboard settings
- feat: Add leave/welcome message configuration commands and improve JID resolution caching
- feat: Implement LID-to-phone JID resolution for mentions and quoted senders
- feat: Enhance dashboard login approval with IP whitelisting/blacklisting
- feat: Add cache-control headers for dashboard JS/CSS assets
- feat: Enhance sync database command with better error handling and summary output
- feat: Update mute command response to include unmute instructions
- feat: Rename werewolf command and alias for consistency
- fix: Normalize IP entry handling in dashboard IP security
- fix: Restrict mobile menu navigation to data-view links only

## 2026-05-14

- feat: Allow team role to view Commands and Settings pages (read-only)
- feat: Hide Phone Numbers section and save/reset buttons from team users
- feat: Disable maintenance toggle and command edit button for team in Commands table
- feat: Add /api/changelog public endpoint that parses CHANGELOG.md
- feat: Add changelog popup modal with "What's New" button on login page
- feat: Display parsed changelog in dashboard Overview section
- fix: Reject login approval request if no owner number is configured
- fix: Allow /api/changelog without authentication (public path)

## 2026-05-13

- feat: Add Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero lookup commands (character card with canvas, artifacts/relics, skills, profile picture)
- feat: Add character list and weapon list commands for HSR & ZZZ
- feat: Enhance menu command to include owner and team visibility for debugging category
- refactor: Move GithubUser and MLPlayer types to separate type files

## 2026-05-12

- feat: Implement IP security service with whitelist/blacklist management

## 2026-05-11

- refactor: Replace file system config access with configService in Client and User classes
- refactor: Replace file system operations with configService for team management
- feat: Send greeting message upon joining a group
- feat: Enhance bot stats display with user and group counts
- refactor: Suppress verbose libsignal noise in console output
- refactor: Streamline task handling in useMultiAuthState for improved performance
- feat: Implement caching for group settings and metadata to reduce database hits
- feat: Enhance participant update handling with logging and profile picture resolution
- feat: Implement real-time participant updates and improve group handling logic

## 2026-05-10

- feat: Add GitHub profile lookup command and scraper
- feat: Update game commands and messages to English
- feat: Implement Pexels image search command and scraper
- feat: Add Bing and DuckDuckGo image search commands with caching support
- feat: Implement caching and retry logic for anime and manga ranking fetch
- feat: Add AFK checks to ignore bot messages and mentions
- feat: Implement in-memory cache for session data to optimize DB reads
- feat: Add Werewolf game with internationalization support
- docs: Update README with new game features and command details

## 2026-05-09

- feat: Update project structure for ES module support and improve import handling
- feat: Add loading spinner to refresh buttons and improve error handling
- feat: Add phone number management and group joining functionality

## 2026-05-08

- feat: Add Mobile Legends player checker command and scraper
- feat: Add dashboard IP whitelist and blacklist with new device login notification
- feat: Add IP security page to dashboard
- fix: Handle missing message type in serialization
- fix: Update threads downloader
- fix: Correct regex patterns for helper and maintenance flags
- perf: Cache blocklist, botJid, user and group metadata to reduce per-message latency

## 2026-05-07

- feat: Anti-bot detection (on-join + message type), anonymous chat, menu redesign

## 2026-05-05

- feat: Add Threads media downloader command
- feat: Add config readiness check for login functionality
- feat: Update dashboard and terminal images; add login image

## 2026-05-04

- refactor: Update existing commands across all categories
- feat: Add stickerwm, dashboard-approve, and dashboard-reject commands
- feat: Update pairing and connection flow
- feat: Add dashboard config route, login page UI
- feat: Realtime SSE monitor, groups settings icons, bot admin badge
- feat: Add OS memory metrics and SSE real-time stream endpoint
- fix: Prevent WASocket from overriding LoggerService

## 2025-12-05

- feat: Add emoji support and video sticker validation
- feat: Merge level and stats into me command
- feat: Integrate XP tracking on command execution
- feat: Implement complete user leveling system
- feat: Add user leveling and statistics system
- refactor: Rename stats command to avoid conflict

## 2025-12-02

- feat: Add owner group list and invite link commands
- feat: Add TikTok user stalker/lookup command
- feat: Add custom welcome and leave message commands
- feat: Add emoji support and WhatsApp bubble chat sticker
- feat: Implement custom welcome/leave messages with variable support
- feat: Add reply-text-to-sticker and emoji-mix commands
- fix: Update phone number parsing to use awesome-phonenumber v7 API

## 2025-12-01

- feat: Add centralized template variable system for command examples
- feat: Add automated installation scripts for Windows and Linux
- feat: Add welcome/leave image greeting with profile picture and group info
- feat: Add session timeout management for dashboard
- feat: Add support for interactive response message parsing
- refactor: Reorganize text converter utilities
- refactor: Update all command categories to use template system

## 2025-11-28

- refactor: Project restructure

## 2024-04-17

- fix: TikTok downloader

## 2024-02-07

- fix: Forbidden when get groupMetadata
- fix: Catch error not logging

## 2024-01-22

- feat: ChisatoBOT v1.0.0 — Initial release
- docs: Update community link
- deps: Add TypeScript dependency
