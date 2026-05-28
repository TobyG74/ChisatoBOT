import type { Lang } from "./index";

// Messages for different languages
const M = {
    // English translations
    en: {
        // General
        onlyGroup: "❌ This command can only be used in a group!",
        invalidTarget:
            "❌ Invalid target. Use the player's list index (e.g. *1*), phone number (e.g. *6281xxxxxxxx*), or @mention.",
        noActiveGame: "❌ No active game.",
        noLobby: "❌ No active lobby.",
        notHost: "❌ Only the host or owner can do that!",
        deadCannotAct: "❌ Dead players cannot use this action.",
        wrongPhaseNight: "❌ This action can only be used during the night phase!",
        wrongPhaseDay: "❌ Voting can only be done during the day phase!",
        unknownSub: (sub: string) => `❌ Unknown subcommand: *${sub}*\nType */ww help* for help.`,

        // Language vote
        langVoteOk: (name: string, lang: string, en: number, id: number) =>
            `🌐 ${name} voted for *${lang.toUpperCase()}*. [EN: ${en} | ID: ${id}]`,
        langInvalid: "❌ Invalid language. Use: */ww lang en* or */ww lang id*",
        langFinal: (lang: string) => `🌐 Game language set to: *${lang.toUpperCase()}*`,
        langNotInLobby: "❌ Language vote only available during lobby!",

        // Lobby
        gameCreated: (host: string) =>
            `🐺 *Werewolf game created by ${host}!*\n\n` +
            `📋 */ww join* — join\n` +
            `🌐 */ww lang en/id* — vote for language\n` +
            `👀 */ww players* — see player list\n` +
            `🎮 */ww begin* — host starts game (min. 4 players)\n\n` +
            `Waiting for players...`,
        gameAlreadyActive: "❌ There is already an active Werewolf game in this group!",
        alreadyInOtherGame: "❌ You are already active in another game!",
        joinOk: (name: string) => `✅ ${name} joined the Werewolf game!`,
        joinNoGame: "❌ No active lobby. Type */ww start* to create one!",
        joinAlreadyJoined: "ℹ️ You are already in the lobby!",
        joinStarted: "❌ Game has already started, cannot join!",
        joinOtherGame: "❌ You are already active in another game!",
        leaveOk: (name: string) => `👋 ${name} left the lobby.`,
        leaveStarted: "❌ Cannot leave after the game has started!",
        leaveNotIn: "ℹ️ You are not in this lobby.",
        playersHeader: (count: number) => `👥 *Werewolf Players (${count}):*`,
        beginAlreadyStarted: "❌ Game has already started!",
        beginNotHost: "❌ Only the host or owner can start the game!",
        beginMinPlayers: (current: number) => `❌ Need at least 4 players! Current: ${current}`,
        gameStarting: (count: number) => `🎮 *WEREWOLF GAME STARTS!*\n\n👥 *Players (${count}):*\n`,
        rolesDelivered: "📨 Your role card has been sent to each player's DM!",
        roleCardCaption: (emoji: string, title: string, team: string, desc: string, groupId: string) =>
            `🎭 *Your Role: ${emoji} ${title}*\n🏳️ Team: ${team}\n\n📖 ${desc}\n\nGame running in: ${groupId}`,
        teamVillage: "🟢 Village",
        teamWerewolf: "🔴 Werewolf",
        wolfTeammates: (names: string) => `🐺 *Your wolf teammates:*\n${names}`,
        minionWolves: (names: string) => `😈 *The wolves you serve:*\n${names}`,

        // Night — phase start
        nightStart: (round: number, count: number, list: string) =>
            `🌙 *Night ${round} begins...*\n\nThe village sleeps. Night players act in silence.\n\n*Alive (${count}):*\n${list}\n\n⏰ Night lasts 90 seconds.`,
        wolfInstruction: (teammates: string, list: string) =>
            `🐺${teammates}\nType */ww kill [number]* to choose a kill target:\n${list}`,
        wolfTeammatesInline: (names: string) => ` Your wolf teammates: ${names}\n`,
        seerInstruction: (list: string) =>
            `🔮 Type */ww check [number]* to investigate someone:\n${list}`,
        doctorInstruction: (selfNote: string, list: string) =>
            `🩺 Type */ww save [number]* to protect someone${selfNote}:\n${list}`,
        doctorSelfNote: " (including yourself)",
        witchInstruction: (potions: string, list: string) =>
            `🧪 Your remaining potions:\n${potions}\n\nYou may skip.\n\n${list}`,
        witchHealPotion: "💊 Heal: */ww heal [number]*",
        witchPoisonPotion: "☠️ Poison: */ww poison [number]*",
        bodyguardInstruction: (list: string) =>
            `🛡️ Type */ww protect [number]* to shield someone (1× only, not yourself):\n${list}`,

        // Night — actions
        wolfVote: (target: string, submitted: number, total: number) =>
            `✅ Your vote: ${target} [${submitted}/${total} wolves]`,
        wolfVoteSingle: (target: string) => `✅ Night target locked: ${target}`,
        wolfConsensus: (target: string) => `🤝 Consensus reached! Night target: ${target}`,
        wolfSelf: "❌ Cannot kill a fellow wolf!",
        seerAlreadyDone: "ℹ️ You already investigated someone tonight.",
        seerSelf: "❌ Cannot investigate yourself!",
        seerResultWolf: (name: string) =>
            `🔮 *Investigation Result:*\n${name} is...\n\n🔴 *A WEREWOLF!* They are dangerous!`,
        seerResultSafe: (name: string) =>
            `🔮 *Investigation Result:*\n${name} is...\n\n🟢 *A Villager.* They are safe.`,
        doctorAlreadySaved: "ℹ️ You already chose a protection target tonight.",
        doctorSamePerson: "❌ Cannot protect the same person two nights in a row!",
        doctorSaved: (name: string) => `💊 You will protect ${name} tonight.`,
        witchHealUsed: "❌ Your healing potion is depleted!",
        witchHealOk: (name: string) => `💊 You healed ${name} with your potion!`,
        witchPoisonUsed: "❌ Your poison potion is depleted!",
        witchPoisonOk: (name: string) => `☠️ You poisoned ${name}!`,
        bodyguardUsed: "❌ Your shield has already been used!",
        bodyguardSelf: "❌ Cannot protect yourself!",
        bodyguardOk: (name: string) => `🛡️ You will protect ${name} tonight. If they are attacked, you die instead!`,

        // Night — dawn resolution
        dawnSafe: "☀️ *Dawn breaks!*\n\nNo one died last night. The village is safe!\n",
        dawnProtected: "☀️ *Dawn breaks!*\n\nThere was an attack last night, but it was repelled!\n",
        dawnBodyguardTrade: (name: string, emoji: string, title: string) =>
            `☀️ *Dawn breaks!*\n\n🛡️ *${name}* (Bodyguard) died protecting someone!\nTheir role: ${emoji} *${title}*\n`,
        dawnKilled: (name: string, emoji: string, title: string) =>
            `☀️ *Dawn breaks!*\n\n💀 *${name}* was found dead last night.\nTheir role: ${emoji} *${title}*\n`,
        cursedTurned: (name: string) =>
            `🌑 *${name}* was attacked... and transformed into a Werewolf! 💀`,
        hunterPrompt: (name: string, list: string) =>
            `🏹 ${name} You are dying! But you can shoot one last person.\nType */ww shoot [number]* within 60 seconds.\n\n${list}`,
        hunterShot: (hunter: string, target: string, emoji: string, title: string) =>
            `🏹 *${hunter} shoots ${target} before dying!*\nTheir role: ${emoji} ${title}`,

        // Day — voting
        dayStart: (round: number, count: number, list: string) =>
            `☀️ *Day Phase — Round ${round}*\n\nDiscuss who the werewolf is!\n\n*Alive (${count}):*\n${list}\n\nType */ww vote [number]* to vote for execution.\n⏰ Voting closes in 120 seconds.`,
        voteOk: (voter: string, target: string, mayorNote: string, submitted: number, total: number) =>
            `🗳️ ${voter} voted for ${target}${mayorNote}. [${submitted}/${total}]`,
        mayorNote: " (×2 Mayor vote)",
        voteSelf: "❌ Cannot vote for yourself!",
        voteDeadPlayer: "❌ Dead players cannot vote.",
        voteResultHeader: "🗳️ *Vote Results:*\n",
        noVotes: "🗳️ No one voted! No execution today.\n\nNight falls...",
        voteTie: "⚖️ Tied vote! No execution.",
        eliminated: (name: string, emoji: string, title: string) =>
            `☠️ *${name}* is executed by the village.\nTheir role: ${emoji} *${title}*`,
        kidEliminated: (name: string) =>
            `☠️ *${name}* is executed by the village.\nTheir role: 👶 *Kid*\n\n😱 *THE VILLAGE KILLED THE KID!*\n🐺 *WEREWOLVES WIN!*`,

        // Win
        winVillage: "🏆 *VILLAGE WINS!* All werewolves have been eliminated!",
        winWolf: "🐺 *WEREWOLVES WIN!* They have dominated the village!",
        roleRevealHeader: "\n\n*All Roles:*\n",
        thankYou: "\n\nThank you for playing! 🎉",

        // Status / misc
        statusHeader: (phase: string, round: number) =>
            `📊 *Werewolf Game Status*\nPhase: ${phase} | Round: ${round}\n\n`,
        statusAlive: (count: number) => `*Alive (${count}):*\n`,
        statusDead: (count: number) => `\n*Dead (${count}):*\n`,
        statusNone: "None.",
        phaseNames: { lobby: "🏠 Lobby", night: "🌙 Night", day: "☀️ Day", ended: "🏁 Ended" } as Record<string, string>,
        gameEndedBy: (name: string) => `🏁 Werewolf game ended by ${name}.`,

        // Help
        helpText:
            `🐺 *WEREWOLF GAME*\n\n` +
            `*📋 Lobby:*\n` +
            `• */ww start* — Create lobby in group\n` +
            `• */ww join* — Join lobby\n` +
            `• */ww leave* — Leave lobby\n` +
            `• */ww lang en/id* — Vote for game language\n` +
            `• */ww players* — See player list\n` +
            `• */ww begin* — Host starts game (min. 4 players)\n\n` +
            `*🌙 Night Actions (group or DM):*\n` +
            `• */ww kill [no]* — 🐺 Werewolf: kill target\n` +
            `• */ww check [no]* — 🔮 Seer: investigate target\n` +
            `• */ww save [no]* — 🩺 Doctor: protect target\n` +
            `• */ww heal [no]* — 🧪 Witch: healing potion\n` +
            `• */ww poison [no]* — 🧪 Witch: poison potion\n` +
            `• */ww protect [no]* — 🛡️ Bodyguard: shield target\n` +
            `• */ww shoot [no]* — 🏹 Hunter: shoot when dying\n\n` +
            `*☀️ Day:*\n` +
            `• */ww vote [no]* — Vote for execution\n\n` +
            `*🔧 Other:*\n` +
            `• */ww status* — Game status\n` +
            `• */ww end* — Force end game (host/owner)\n` +
            `• */ww help* — Show this help\n\n` +
            `*🎭 Roles:* Villager, Werewolf, Alpha Werewolf, Seer, Doctor, Witch, Hunter, Bodyguard, Mayor, Minion, Cursed, Kid`,
    },

    // Indonesian translations by @TobyG74
    id: {
        // General
        onlyGroup: "❌ Perintah ini hanya bisa digunakan di grup!",
        invalidTarget:
            "❌ Target tidak valid. Gunakan nomor urut pemain (mis. *1*), nomor HP (mis. *6281xxxxxxxx*), atau @mention.",
        noActiveGame: "❌ Tidak ada game aktif.",
        noLobby: "❌ Tidak ada lobby aktif.",
        notHost: "❌ Hanya host atau owner yang bisa melakukan ini!",
        deadCannotAct: "❌ Pemain yang sudah mati tidak bisa beraksi.",
        wrongPhaseNight: "❌ Aksi ini hanya bisa dilakukan saat fase malam!",
        wrongPhaseDay: "❌ Voting hanya bisa dilakukan saat fase siang!",
        unknownSub: (sub: string) => `❌ Subcommand tidak dikenal: *${sub}*\nKetik */ww help* untuk bantuan.`,

        // Language vote
        langVoteOk: (name: string, lang: string, en: number, id: number) =>
            `🌐 ${name} memilih bahasa *${lang.toUpperCase()}*. [EN: ${en} | ID: ${id}]`,
        langInvalid: "❌ Bahasa tidak valid. Gunakan: */ww lang en* atau */ww lang id*",
        langFinal: (lang: string) => `🌐 Bahasa game ditetapkan: *${lang.toUpperCase()}*`,
        langNotInLobby: "❌ Vote bahasa hanya tersedia saat lobby!",

        // Lobby
        gameCreated: (host: string) =>
            `🐺 *Game Werewolf dibuat oleh ${host}!*\n\n` +
            `📋 */ww join* — bergabung\n` +
            `🌐 */ww lang en/id* — vote bahasa game\n` +
            `👀 */ww players* — lihat daftar pemain\n` +
            `🎮 */ww begin* — host mulai game (min. 4 pemain)\n\n` +
            `Menunggu pemain bergabung...`,
        gameAlreadyActive: "❌ Sudah ada game Werewolf aktif di grup ini!",
        alreadyInOtherGame: "❌ Kamu sedang aktif di game lain!",
        joinOk: (name: string) => `✅ ${name} bergabung ke game Werewolf!`,
        joinNoGame: "❌ Tidak ada lobby aktif. Ketik */ww start* untuk membuat!",
        joinAlreadyJoined: "ℹ️ Kamu sudah bergabung di lobby ini!",
        joinStarted: "❌ Game sudah dimulai, tidak bisa bergabung!",
        joinOtherGame: "❌ Kamu sedang aktif di game lain!",
        leaveOk: (name: string) => `👋 ${name} meninggalkan lobby.`,
        leaveStarted: "❌ Tidak bisa keluar setelah game dimulai!",
        leaveNotIn: "ℹ️ Kamu tidak ada di lobby ini.",
        playersHeader: (count: number) => `👥 *Pemain Werewolf (${count}):*`,
        beginAlreadyStarted: "❌ Game sudah dimulai!",
        beginNotHost: "❌ Hanya host atau owner yang bisa memulai game!",
        beginMinPlayers: (current: number) => `❌ Butuh minimal 4 pemain! Saat ini: ${current}`,
        gameStarting: (count: number) => `🎮 *GAME WEREWOLF DIMULAI!*\n\n👥 *Pemain (${count}):*\n`,
        rolesDelivered: "📨 Kartu peran sudah dikirim ke DM masing-masing pemain!",
        roleCardCaption: (emoji: string, title: string, team: string, desc: string, groupId: string) =>
            `🎭 *Peranmu: ${emoji} ${title}*\n🏳️ Tim: ${team}\n\n📖 ${desc}\n\nGame berjalan di: ${groupId}`,
        teamVillage: "🟢 Desa",
        teamWerewolf: "🔴 Serigala",
        wolfTeammates: (names: string) => `🐺 *Teman serigalamu:*\n${names}`,
        minionWolves: (names: string) => `😈 *Para serigala yang kamu dukung:*\n${names}`,

        // Night — phase start
        nightStart: (round: number, count: number, list: string) =>
            `🌙 *Malam ${round} dimulai...*\n\nDesa tertidur. Para pemain malam beraksi dalam sunyi.\n\n*Hidup (${count}):*\n${list}\n\n⏰ Malam berlangsung 90 detik.`,
        wolfInstruction: (teammates: string, list: string) =>
            `🐺${teammates}\nKetik */ww kill [nomor]* untuk memilih target:\n${list}`,
        wolfTeammatesInline: (names: string) => ` Teman serigalamu: ${names}\n`,
        seerInstruction: (list: string) =>
            `🔮 Ketik */ww check [nomor]* untuk mengecek seseorang:\n${list}`,
        doctorInstruction: (selfNote: string, list: string) =>
            `🩺 Ketik */ww save [nomor]* untuk menyelamatkan seseorang${selfNote}:\n${list}`,
        doctorSelfNote: " (termasuk diri sendiri)",
        witchInstruction: (potions: string, list: string) =>
            `🧪 Ramuan yang tersisa:\n${potions}\n\nKamu bisa skip.\n\n${list}`,
        witchHealPotion: "💊 Sembuhkan: */ww heal [nomor]*",
        witchPoisonPotion: "☠️ Racuni: */ww poison [nomor]*",
        bodyguardInstruction: (list: string) =>
            `🛡️ Ketik */ww protect [nomor]* untuk melindungi seseorang (hanya 1×, tidak bisa diri sendiri):\n${list}`,

        // Night — actions
        wolfVote: (target: string, submitted: number, total: number) =>
            `✅ Vote kamu: ${target} [${submitted}/${total} serigala]`,
        wolfVoteSingle: (target: string) => `✅ Target malam dikunci: ${target}`,
        wolfConsensus: (target: string) => `🤝 Konsensus! Target malam: ${target}`,
        wolfSelf: "❌ Tidak bisa membunuh sesama serigala!",
        seerAlreadyDone: "ℹ️ Kamu sudah melakukan pengecekan malam ini.",
        seerSelf: "❌ Tidak bisa mengecek diri sendiri!",
        seerResultWolf: (name: string) =>
            `🔮 *Hasil Pengecekan:*\n${name} adalah...\n\n🔴 *SERIGALA!* Dia berbahaya!`,
        seerResultSafe: (name: string) =>
            `🔮 *Hasil Pengecekan:*\n${name} adalah...\n\n🟢 *Warga Desa.* Dia aman.`,
        doctorAlreadySaved: "ℹ️ Kamu sudah memilih target penyelamatan malam ini.",
        doctorSamePerson: "❌ Tidak bisa menyelamatkan orang yang sama 2 malam berturut-turut!",
        doctorSaved: (name: string) => `💊 Kamu akan menyelamatkan ${name} malam ini.`,
        witchHealUsed: "❌ Ramuan penyembuhmu sudah habis!",
        witchHealOk: (name: string) => `💊 Kamu menyembuhkan ${name} dengan ramuan penyembuh!`,
        witchPoisonUsed: "❌ Ramuan racunmu sudah habis!",
        witchPoisonOk: (name: string) => `☠️ Kamu meracuni ${name}!`,
        bodyguardUsed: "❌ Perisaimu sudah terpakai!",
        bodyguardSelf: "❌ Tidak bisa melindungi diri sendiri!",
        bodyguardOk: (name: string) => `🛡️ Kamu melindungi ${name} malam ini. Jika mereka diserang, kamu yang mati!`,

        // Night — dawn resolution
        dawnSafe: "☀️ *Fajar tiba!*\n\nTidak ada yang mati semalam. Desa aman!\n",
        dawnProtected: "☀️ *Fajar tiba!*\n\nAda serangan malam ini, tapi berhasil digagalkan!\n",
        dawnBodyguardTrade: (name: string, emoji: string, title: string) =>
            `☀️ *Fajar tiba!*\n\n🛡️ *${name}* (Pengawal) mati melindungi temannya!\nPerannya: ${emoji} *${title}*\n`,
        dawnKilled: (name: string, emoji: string, title: string) =>
            `☀️ *Fajar tiba!*\n\n💀 *${name}* ditemukan tewas semalam.\nPerannya: ${emoji} *${title}*\n`,
        cursedTurned: (name: string) =>
            `🌑 *${name}* diserang... dan berubah menjadi Serigala! 💀`,
        hunterPrompt: (name: string, list: string) =>
            `🏹 ${name} Kamu mati! Tapi kamu bisa menembak satu orang terakhir.\nKetik */ww shoot [nomor]* dalam 60 detik.\n\n${list}`,
        hunterShot: (hunter: string, target: string, emoji: string, title: string) =>
            `🏹 *${hunter} menembak ${target} sebelum pergi!*\nPerannya: ${emoji} ${title}`,

        // Day — voting
        dayStart: (round: number, count: number, list: string) =>
            `☀️ *Fase Siang — Ronde ${round}*\n\nDiskusikan siapa serigala di antara kalian!\n\n*Hidup (${count}):*\n${list}\n\nKetik */ww vote [nomor]* untuk memilih yang dieksekusi.\n⏰ Voting ditutup dalam 120 detik.`,
        voteOk: (voter: string, target: string, mayorNote: string, submitted: number, total: number) =>
            `🗳️ ${voter} memilih ${target}${mayorNote}. [${submitted}/${total}]`,
        mayorNote: " (×2 suara Walikota)",
        voteSelf: "❌ Tidak bisa memilih diri sendiri!",
        voteDeadPlayer: "❌ Pemain yang mati tidak bisa voting.",
        voteResultHeader: "🗳️ *Hasil Voting:*\n",
        noVotes: "🗳️ Tidak ada yang voting! Tidak ada eksekusi hari ini.\n\nMalam menjelang...",
        voteTie: "⚖️ Hasil voting seri! Tidak ada eksekusi.",
        eliminated: (name: string, emoji: string, title: string) =>
            `☠️ *${name}* dihukum mati oleh desa.\nPerannya: ${emoji} *${title}*`,
        kidEliminated: (name: string) =>
            `☠️ *${name}* dihukum mati oleh desa.\nPerannya: 👶 *Anak Kecil*\n\n😱 *TIDAK! Desa membunuh Anak Kecil!*\n🐺 *SERIGALA MENANG!*`,

        // Win
        winVillage: "🏆 *DESA MENANG!* Semua serigala telah dieliminasi!",
        winWolf: "🐺 *SERIGALA MENANG!* Mereka telah menguasai desa!",
        roleRevealHeader: "\n\n*Semua Peran:*\n",
        thankYou: "\n\nTerima kasih sudah bermain! 🎉",

        // Status / misc
        statusHeader: (phase: string, round: number) =>
            `📊 *Status Game Werewolf*\nFase: ${phase} | Ronde: ${round}\n\n`,
        statusAlive: (count: number) => `*Hidup (${count}):*\n`,
        statusDead: (count: number) => `\n*Mati (${count}):*\n`,
        statusNone: "Tidak ada.",
        phaseNames: { lobby: "🏠 Lobby", night: "🌙 Malam", day: "☀️ Siang", ended: "🏁 Selesai" } as Record<string, string>,
        gameEndedBy: (name: string) => `🏁 Game Werewolf diakhiri oleh ${name}.`,

        // Help
        helpText:
            `🐺 *GAME WEREWOLF*\n\n` +
            `*📋 Lobby:*\n` +
            `• */ww start* — Buat lobby di grup\n` +
            `• */ww join* — Bergabung ke lobby\n` +
            `• */ww leave* — Keluar dari lobby\n` +
            `• */ww lang en/id* — Vote bahasa game\n` +
            `• */ww players* — Lihat daftar pemain\n` +
            `• */ww begin* — Host mulai game (min. 4 pemain)\n\n` +
            `*🌙 Aksi Malam (grup atau DM):*\n` +
            `• */ww kill [no]* — 🐺 Serigala: bunuh target\n` +
            `• */ww check [no]* — 🔮 Peramal: cek target\n` +
            `• */ww save [no]* — 🩺 Dokter: selamatkan target\n` +
            `• */ww heal [no]* — 🧪 Penyihir: ramuan sembuh\n` +
            `• */ww poison [no]* — 🧪 Penyihir: ramuan racun\n` +
            `• */ww protect [no]* — 🛡️ Pengawal: lindungi target\n` +
            `• */ww shoot [no]* — 🏹 Pemburu: tembak saat mati\n\n` +
            `*☀️ Siang:*\n` +
            `• */ww vote [no]* — Voting siapa yang dieksekusi\n\n` +
            `*🔧 Lain-lain:*\n` +
            `• */ww status* — Lihat status game\n` +
            `• */ww end* — Paksa akhiri game (host/owner)\n` +
            `• */ww help* — Tampilkan bantuan ini\n\n` +
            `*🎭 Peran:* Warga, Serigala, Alpha Serigala, Peramal, Dokter, Penyihir, Pemburu, Pengawal, Walikota, Antek, Terkutuk, Anak Kecil`,
    },
};

export type Messages = typeof M.en;

export function messages(lang: Lang): Messages {
    return M[lang] as Messages;
}
