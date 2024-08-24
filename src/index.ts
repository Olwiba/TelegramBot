import TelegramBot from 'node-telegram-bot-api';
import schedule from 'node-schedule';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
const channelId = process.env.CHANNEL_ID!;

const sendMondayMessage = () => {
  const message = `*Kick off your week with purpose*

👉 What are your top 3 goals this week?
👉 Which goal excites you the most?
👉 What's one potential obstacle, and how will you overcome it?

Share below and let's crush this week together! 💪`;
  
  bot.sendMessage(channelId, message);
};

const sendFridayMessage = () => {
  const message = `*Wrap up your week with reflection*

👉 How did you progress on your Monday goals?
👉 What was your biggest win this week?
👉 What's one lesson you learned?

Share your insights and let's celebrate our growth! 🎉`;
  
  bot.sendMessage(channelId, message);
};

// Schedule messages for NZT
const mondayJob = schedule.scheduleJob({ hour: 9, minute: 0, dayOfWeek: 1, tz: 'Pacific/Auckland' }, sendMondayMessage);
const fridayJob = schedule.scheduleJob({ hour: 16, minute: 0, dayOfWeek: 5, tz: 'Pacific/Auckland' }, sendFridayMessage);

// Add ping/pong functionality for the channel
bot.on('channel_post', (msg) => {
  if (msg.chat.id.toString() === channelId && msg.text && msg.text.toLowerCase() === 'ping') {
    bot.sendMessage(channelId, 'pong');
  }
});

console.log('Bot is running...');
console.log('Monday message scheduled for:', mondayJob.nextInvocation().toString());
console.log('Friday message scheduled for:', fridayJob.nextInvocation().toString());