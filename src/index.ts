import TelegramBot from 'node-telegram-bot-api';
import schedule from 'node-schedule';
import dotenv from 'dotenv';
import { PointsManager } from './points';

let bot: TelegramBot;
let channelId: string;
let pointsManager: PointsManager;

const sendMondayMessage = () => {
  const message = `*Kick off your week with purpose*

👉 What are your main goals this week?

Share below and let's crush this week together! 💪`;
  
  bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Monday message sent successfully'))
    .catch((error) => console.error('Error sending Monday message:', error));
};

const sendWednesdayMessage = async () => {
  const challenges = pointsManager.getActiveChallenges();
  let message = '*Mid-Week Challenge Check* 💫\n\n';
  
  if (challenges.weekly || challenges.monthly) {
    message += 'Here are our active challenges:\n\n';
    
    if (challenges.weekly) {
      message += `*Weekly Challenge*\n${challenges.weekly.description}\n\n`;
    }
    
    if (challenges.monthly) {
      message += `*Monthly Challenge*\n${challenges.monthly.description}\n\n`;
    }

    message += 'How\'s everyone tracking? Share your progress! 🎯';
  } else {
    message += 'No active challenges right now!\n\n';
    message += 'Want to set one? Use:\n';
    message += '/setchallenge weekly [description] (10 points)\n';
    message += '/setchallenge monthly [description] (30 points)\n\n';
    message += 'Let\'s make this week count! 💪';
  }
  
  bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Wednesday message sent successfully'))
    .catch((error) => console.error('Error sending Wednesday message:', error));
};

const sendFridayMessage = () => {
  const message = `*Wrap up your week with reflection*

👉 How did you do on your goals this week?

Share your insights and let's celebrate our growth! 🎉`;
  
  bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Friday message sent successfully'))
    .catch((error) => console.error('Error sending Friday message:', error));
};

async function main() {
  dotenv.config();

  bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
  channelId = process.env.CHANNEL_ID!;
  pointsManager = new PointsManager();

  console.log('Bot is starting...');
  console.log('Bot token:', process.env.BOT_TOKEN?.slice(0, 5) + '...');
  console.log('Channel ID:', channelId);

  await pointsManager.init(bot, channelId);

  bot.sendMessage(channelId, '*Bot Update* 🚀\nI\'ve just been restarted & am back online!', { parse_mode: 'Markdown' })
    .then(() => console.log('Startup message sent'))
    .catch((error) => console.error('Error sending startup message:', error));

  // Schedule messages for NZT
  const mondayJob = schedule.scheduleJob({ hour: 9, minute: 0, dayOfWeek: 1, tz: 'Pacific/Auckland' }, sendMondayMessage);
  const wednesdayJob = schedule.scheduleJob({ hour: 14, minute: 0, dayOfWeek: 3, tz: 'Pacific/Auckland' }, sendWednesdayMessage);
  const fridayJob = schedule.scheduleJob({ hour: 16, minute: 0, dayOfWeek: 5, tz: 'Pacific/Auckland' }, sendFridayMessage);

  console.log('Monday message scheduled for:', mondayJob.nextInvocation().toString());
  console.log('Wednesday message scheduled for:', wednesdayJob.nextInvocation().toString());
  console.log('Friday message scheduled for:', fridayJob.nextInvocation().toString());

  // Handle incoming messages
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    console.log('Received message:', msg);

    // Daily check-in detection
    if (msg.text && chatId.toString() === channelId) {
      await pointsManager.checkStreak(msg.from!.id);
      
      // Check for daily check-in (first message of the day)
      const success = await pointsManager.dailyCheckIn(msg.from!.id);
      if (success) {
        bot.sendMessage(chatId, `🌟 +5 points`);
      }

      // Check for weekly goal completion pattern
      const goalResult = await pointsManager.completeWeeklyGoal(msg.from!.id, msg.text);
      if (goalResult.success) {
        type MessageType = 'achievement' | 'percentage' | 'quality' | 'emoji' | 'status';
        const messages: Record<MessageType, string> = {
          achievement: '🎯 Epic achievement @${username}! Smashing those goals! +20 points',
          percentage: '📊 Solid progress @${username}! Keep pushing! +20 points',
          quality: '💪 Great work @${username}! That\'s what we like to see! +20 points',
          emoji: '✨ Well done @${username}! Goals crushed! +20 points',
          status: '📈 Excellent update @${username}! Keep that momentum! +20 points'
        };
        
        const pattern = (goalResult.pattern || 'achievement') as MessageType;
        const message = messages[pattern].replace('${username}', msg.from!.username!);
        bot.sendMessage(chatId, message);
      }

      // Check for monthly challenge completion
      const monthlyResult = await pointsManager.completeMonthlyChallenge(msg.from!.id, msg.text);
      if (monthlyResult.success && monthlyResult.challenge) {
        const message = `🏆 INCREDIBLE @${msg.from!.username}! You've completed the monthly challenge:\n` +
                       `"${monthlyResult.challenge.description}"\n\n` +
                       `+50 points awarded! Keep crushing it! 💪`;
        bot.sendMessage(chatId, message);
      }
    }

    // Handle reactions for helping others
    if (msg.reply_to_message && msg.text === '❤️') {
      await pointsManager.rewardHelp(msg.reply_to_message.from!.id);
      bot.sendMessage(chatId, `💖 @${msg.reply_to_message.from!.username} earned +10 points for helping!`);
    }

    // Commands
    if (msg.text?.startsWith('/points')) {
      const points = await pointsManager.getPoints(msg.from!.id);
      const streak = await pointsManager.checkStreak(msg.from!.id);
      bot.sendMessage(chatId, `You have ${points} Koru points! 🌟\nCurrent streak: ${streak} days 🔥`);
    }

    if (msg.text?.startsWith('/leaderboard')) {
      const leaders = await pointsManager.getLeaderboard();
      const message = leaders.slice(0, 5)
        .map((user: any, i: number) => `${i + 1}. ${user.username || 'Anonymous'}: ${user.points}`)
        .join('\n');
      bot.sendMessage(chatId, `*Top Koru Points* 🏆\n\n${message}`, { parse_mode: 'Markdown' });
    }

    if (msg.text?.startsWith('/setchallenge')) {
      const args = msg.text.split(' ');
      const type = args[1]?.toLowerCase();
      const description = args.slice(2).join(' ');

      if (!type || !description) {
        bot.sendMessage(chatId, 'Usage: /setchallenge [weekly|monthly] [challenge description]');
        return;
      }

      let success = false;
      if (type === 'weekly') {
        success = await pointsManager.setWeeklyChallenge(msg.from!.id, description);
      } else if (type === 'monthly') {
        success = await pointsManager.setMonthlyChallenge(msg.from!.id, description);
      }

      if (success) {
        bot.sendMessage(chatId, `✨ New ${type} challenge set!\n\n${description}`);
      } else {
        bot.sendMessage(chatId, `You need more points to set a ${type} challenge.`);
      }
    }

    if (msg.text?.startsWith('/challenges')) {
      const challenges = pointsManager.getActiveChallenges();
      let message = '*Active Challenges* 🎯\n\n';
      
      if (challenges.weekly) {
        message += `*Weekly Challenge*\n${challenges.weekly.description}\n\n`;
      }
      
      if (challenges.monthly) {
        message += `*Monthly Challenge*\n${challenges.monthly.description}\n\n`;
      }

      if (!challenges.weekly && !challenges.monthly) {
        message += 'No active challenges right now!\n';
        message += 'Set one with /setchallenge [weekly|monthly] [description]\n';
        message += 'Weekly Challenge Cost: 10 points\n';
        message += 'Monthly Challenge Cost: 30 points';
      }

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  });

  // Error handling
  bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
  });

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('Bot is shutting down...');
    bot.stopPolling();
    process.exit();
  });

  console.log('Bot is running...');
}

main().catch(console.error);