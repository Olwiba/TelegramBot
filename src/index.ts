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

// Handle direct messages
bot.on('message', (msg) => {
  console.log('Received direct message:', msg);
  if (msg.text && msg.text.toLowerCase() === '/ping') {
    console.log('Sending pong response to direct message');
    bot.sendMessage(msg.chat.id, 'pong')
      .then(() => console.log('Pong sent successfully to direct message'))
      .catch((error) => console.error('Error sending pong to direct message:', error));
  }
});

// Handle channel posts
bot.on('channel_post', (msg) => {
  console.log('Received channel post:', msg);
  if (msg.chat.id.toString() === channelId && msg.text && msg.text.toLowerCase() === 'ping') {
    console.log('Sending pong response to channel');
    bot.sendMessage(channelId, 'pong')
      .then(() => console.log('Pong sent successfully to channel'))
      .catch((error) => console.error('Error sending pong to channel:', error));
  }
});

console.log('Bot is running...');
console.log('Monday message scheduled for:', mondayJob.nextInvocation().toString());
console.log('Friday message scheduled for:', fridayJob.nextInvocation().toString());