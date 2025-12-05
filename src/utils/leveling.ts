/**
 * Leveling System Utility
 * Handles XP calculation, level progression, and rank determination
 */

export interface LevelInfo {
    level: number;
    xp: number;
    totalXp: number;
    xpNeeded: number;
    xpToNextLevel: number;
    rank: string;
    rankEmoji: string;
}

/**
 * Calculate XP needed to reach a specific level
 * Formula: XP = 100 * level^2 + 50 * level
 */
export function getXPForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 2) + 50 * level);
}

/**
 * Calculate level from total XP
 */
export function getLevelFromXP(totalXp: number): number {
    let level = 1;
    let xpNeeded = getXPForLevel(level);
    
    while (totalXp >= xpNeeded) {
        totalXp -= xpNeeded;
        level++;
        xpNeeded = getXPForLevel(level);
    }
    
    return level;
}

/**
 * Calculate current XP in the current level
 */
export function getCurrentLevelXP(totalXp: number): number {
    let level = 1;
    let xpNeeded = getXPForLevel(level);
    
    while (totalXp >= xpNeeded) {
        totalXp -= xpNeeded;
        level++;
        xpNeeded = getXPForLevel(level);
    }
    
    return totalXp;
}

/**
 * Add XP to user and return updated level info
 */
export function addXP(currentLevel: number, currentXp: number, totalXp: number, xpToAdd: number): {
    newLevel: number;
    newXp: number;
    newTotalXp: number;
    leveledUp: boolean;
    levelsGained: number;
} {
    const newTotalXp = totalXp + xpToAdd;
    let newXp = currentXp + xpToAdd;
    let newLevel = currentLevel;
    let leveledUp = false;
    let levelsGained = 0;
    
    // Check for level up
    while (newXp >= getXPForLevel(newLevel)) {
        newXp -= getXPForLevel(newLevel);
        newLevel++;
        leveledUp = true;
        levelsGained++;
    }
    
    return {
        newLevel,
        newXp,
        newTotalXp,
        leveledUp,
        levelsGained
    };
}

/**
 * Get rank name based on level
 */
export function getRankInfo(level: number): { rank: string; emoji: string; color: string } {
    if (level >= 100) {
        return { rank: "Legendary", emoji: "👑", color: "#FFD700" };
    } else if (level >= 80) {
        return { rank: "Mythical", emoji: "🔮", color: "#9B59B6" };
    } else if (level >= 60) {
        return { rank: "Master", emoji: "⭐", color: "#E74C3C" };
    } else if (level >= 40) {
        return { rank: "Expert", emoji: "💎", color: "#3498DB" };
    } else if (level >= 25) {
        return { rank: "Advanced", emoji: "🎖️", color: "#1ABC9C" };
    } else if (level >= 15) {
        return { rank: "Intermediate", emoji: "🥉", color: "#95A5A6" };
    } else if (level >= 5) {
        return { rank: "Novice", emoji: "🎯", color: "#2ECC71" };
    } else {
        return { rank: "Beginner", emoji: "🌱", color: "#BDC3C7" };
    }
}

/**
 * Get complete level information
 */
export function getLevelInfo(level: number, xp: number, totalXp: number): LevelInfo {
    const xpNeeded = getXPForLevel(level);
    const xpToNextLevel = xpNeeded - xp;
    const { rank, emoji } = getRankInfo(level);
    
    return {
        level,
        xp,
        totalXp,
        xpNeeded,
        xpToNextLevel,
        rank,
        rankEmoji: emoji
    };
}

/**
 * Calculate XP reward based on command complexity
 */
export function calculateXPReward(commandCategory: string, isPremium: boolean = false): number {
    let baseXP = 10;
    
    // Category multipliers
    const categoryMultipliers: { [key: string]: number } = {
        "owner": 5,
        "premium": 3,
        "downloader": 2,
        "converter": 2,
        "search": 1.5,
        "anime": 1.5,
        "group": 1.3,
        "general": 1,
        "misc": 0.8
    };
    
    const multiplier = categoryMultipliers[commandCategory.toLowerCase()] || 1;
    baseXP *= multiplier;
    
    // Premium bonus
    if (isPremium) {
        baseXP *= 1.5;
    }
    
    // Add random bonus (0-20%)
    const randomBonus = Math.floor(Math.random() * 0.2 * baseXP);
    
    return Math.floor(baseXP + randomBonus);
}

/**
 * Format XP/Level display
 */
export function formatLevelDisplay(levelInfo: LevelInfo): string {
    const progress = (levelInfo.xp / levelInfo.xpNeeded) * 100;
    const progressBar = generateProgressBar(progress, 10);
    
    return `${levelInfo.rankEmoji} **${levelInfo.rank}** • Level ${levelInfo.level}\n` +
           `${progressBar} ${levelInfo.xp}/${levelInfo.xpNeeded} XP\n` +
           `Total XP: ${levelInfo.totalXp.toLocaleString()}`;
}

/**
 * Generate progress bar
 */
export function generateProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

/**
 * Get leaderboard position suffix (1st, 2nd, 3rd, etc.)
 */
export function getPositionSuffix(position: number): string {
    const j = position % 10;
    const k = position % 100;
    
    if (j === 1 && k !== 11) {
        return position + "st";
    }
    if (j === 2 && k !== 12) {
        return position + "nd";
    }
    if (j === 3 && k !== 13) {
        return position + "rd";
    }
    return position + "th";
}
