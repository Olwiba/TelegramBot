import fs from 'fs/promises';
import { ChatMember } from 'node-telegram-bot-api';

interface UserPoints {
  id: number;
  username?: string;
  points: number;
  lastDaily?: number;
  streak: number;
  lastActive?: number;
}

interface Challenge {
  createdBy: number;
  description: string;
  expiresAt: number;
}

class GoalDetector {
  private static readonly PATTERNS = {
    achievement: /^(?:(?:ticked|smashed|crushed|achieved|wrapped up|knocked out)\s+(?:all|some|most)?\s*(?:of\s+)?(?:the|my|our)?\s*(?:goals?|items?|milestones?|objectives?))/im,
    percentage: /(?:\b(?:about|around|approximately|~)?\s*(?:\d{2,3})%\s*(?:there|complete|done|finished|wrapped)(?:\s+now)?)/i,
    quality: /(?:(?:massive|big|solid|good|decent)\s+(?:progress|win|achievement|movement)(?:\s+(?:this|the)\s+week)?)/i,
    emoji: /[✅💪🎉]\s*(?:Done|Completed|Achieved|Smashed|Finished)\s*-?\s*(?:\d+\.)?\s*(.+?)(?=\n|$)/im,
    status: /^(?:status|update|progress):\s*(?:(?:completed|finished|done|achieved)|\d{1,3}%\s*(?:complete|done)|(?:good|great|solid)\s+progress)/im
  };

  static isGoalCompletion(text: string): boolean {
    return Object.values(this.PATTERNS).some(pattern => pattern.test(text));
  }

  static getMatchedPattern(text: string): string | undefined {
    for (const [key, pattern] of Object.entries(this.PATTERNS)) {
      if (pattern.test(text)) {
        return key;
      }
    }
    return undefined;
  }
}

export class PointsManager {
  private points: UserPoints[] = [];
  private readonly filePath = './data/points.json';
  private weeklyChallenge?: Challenge;
  private monthlyChallenge?: Challenge;

  async init(bot: any, channelId: string) {
    await this.ensureDataDir();
    await this.loadPoints();
    const members = await bot.getChatAdministrators(channelId);
    await this.syncMembers(members);
  }

  private async ensureDataDir() {
    try {
      await fs.mkdir('./data', { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  private async loadPoints() {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      this.points = JSON.parse(data);
    } catch {
      this.points = [];
      await this.savePoints();
    }
  }

  private async savePoints() {
    await fs.writeFile(this.filePath, JSON.stringify(this.points, null, 2));
  }

  private async syncMembers(members: ChatMember[]) {
    for (const member of members) {
      if (!this.points.find(p => p.id === member.user.id)) {
        this.points.push({
          id: member.user.id,
          username: member.user.username,
          points: 0,
          streak: 0
        });
      }
    }
    await this.savePoints();
  }

  async addPoints(userId: number, amount: number) {
    const user = this.points.find(p => p.id === userId);
    if (user) {
      user.points += amount;
      await this.savePoints();
      return user.points;
    }
    return null;
  }

  async getPoints(userId: number) {
    return this.points.find(p => p.id === userId)?.points ?? 0;
  }

  async getLeaderboard() {
    return [...this.points].sort((a, b) => b.points - a.points);
  }

  async checkStreak(userId: number): Promise<number> {
    const user = this.points.find(p => p.id === userId);
    if (!user) return 0;

    const now = new Date();
    const lastActive = user.lastActive ? new Date(user.lastActive) : new Date(0);

    // If last active was more than a day ago, reset streak
    if (!user.lastActive || 
        lastActive.getDate() !== now.getDate() || 
        lastActive.getMonth() !== now.getMonth() || 
        lastActive.getFullYear() !== now.getFullYear()) {
      
      if (lastActive.getTime() + 24 * 60 * 60 * 1000 >= now.getTime()) {
        // If within 24 hours and on a different day, increment streak
        user.streak++;
        await this.addPoints(userId, 5); // Streak bonus
      } else {
        // If more than 24 hours, reset streak
        user.streak = 1;
      }
      user.lastActive = now.getTime();
      await this.savePoints();
    }

    return user.streak;
  }

  async dailyCheckIn(userId: number): Promise<boolean> {
    const user = this.points.find(p => p.id === userId);
    if (!user) return false;

    const now = new Date();
    const lastDaily = user.lastDaily ? new Date(user.lastDaily) : new Date(0);

    // Check if the last check-in was on a different day
    if (lastDaily.getDate() !== now.getDate() || 
        lastDaily.getMonth() !== now.getMonth() || 
        lastDaily.getFullYear() !== now.getFullYear()) {
      user.lastDaily = now.getTime();
      await this.addPoints(userId, 5);
      return true;
    }

    return false;
  }

  async setWeeklyChallenge(userId: number, description: string): Promise<boolean> {
    const user = this.points.find(p => p.id === userId);
    if (!user || user.points < 10) return false;

    await this.addPoints(userId, -10);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    this.weeklyChallenge = {
      createdBy: userId,
      description,
      expiresAt: nextWeek.getTime()
    };

    return true;
  }

  async setMonthlyChallenge(userId: number, description: string): Promise<boolean> {
    const user = this.points.find(p => p.id === userId);
    if (!user || user.points < 30) return false;

    await this.addPoints(userId, -30);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    this.monthlyChallenge = {
      createdBy: userId,
      description,
      expiresAt: nextMonth.getTime()
    };

    return true;
  }

  async rewardHelp(userId: number): Promise<void> {
    await this.addPoints(userId, 10);
  }

  async completeWeeklyGoal(userId: number, text?: string): Promise<{ success: boolean; pattern?: string }> {
    const user = this.points.find(p => p.id === userId);
    if (!user) return { success: false };

    if (text && !GoalDetector.isGoalCompletion(text)) {
      return { success: false };
    }

    await this.addPoints(userId, 20);
    return { 
      success: true, 
      pattern: text ? GoalDetector.getMatchedPattern(text) : undefined 
    };
  }

  async completeMonthlyChallenge(userId: number, text?: string): Promise<{ success: boolean; challenge?: Challenge }> {
    const user = this.points.find(p => p.id === userId);
    if (!user) return { success: false };

    const now = Date.now();
    if (!this.monthlyChallenge || this.monthlyChallenge.expiresAt < now) {
      return { success: false };
    }

    // Check if the message indicates challenge completion
    if (text && !text.toLowerCase().includes('monthly challenge') && 
        !text.toLowerCase().includes('month challenge') &&
        !text.toLowerCase().includes('monthly goal')) {
      return { success: false };
    }

    await this.addPoints(userId, 50);
    const challenge = this.monthlyChallenge;
    this.monthlyChallenge = undefined; // Clear the challenge after completion
    await this.savePoints();
    
    return { 
      success: true,
      challenge
    };
  }

  getActiveChallenges(): { weekly?: Challenge; monthly?: Challenge } {
    const now = Date.now();
    return {
      weekly: this.weeklyChallenge && this.weeklyChallenge.expiresAt > now ? this.weeklyChallenge : undefined,
      monthly: this.monthlyChallenge && this.monthlyChallenge.expiresAt > now ? this.monthlyChallenge : undefined
    };
  }

  async setPoints(userId: number, points: number): Promise<boolean> {
    const user = this.points.find(p => p.id === userId);
    if (!user) return false;

    user.points = points;
    await this.savePoints();
    return true;
  }

  async isAdmin(userId: number): Promise<boolean> {
    const user = this.points.find(p => p.id === userId);
    return user?.username?.toLowerCase().includes('olwiba') || false;
  }
} 