import TelegramBot from 'node-telegram-bot-api';
import schedule from 'node-schedule';
import dotenv from 'dotenv';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN!, { polling: true });
const channelId = process.env.CHANNEL_ID!;

console.log('Bot is starting...');
console.log('Bot token:', process.env.BOT_TOKEN?.slice(0, 5) + '...');
console.log('Channel ID:', channelId);

const sendMondayMessage = () => {
  const message = `*Kick off your week with purpose*

👉 What are your top 3 goals this week?
👉 Which goal excites you the most?
👉 What's one potential obstacle, and how will you overcome it?

Share below and let's crush this week together! 💪`;
  
  bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Monday message sent successfully'))
    .catch((error) => console.error('Error sending Monday message:', error));
};

const sendFridayMessage = () => {
  const message = `*Wrap up your week with reflection*

👉 How did you progress on your Monday goals?
👉 What was your biggest win this week?
👉 What's one lesson you learned?

Share your insights and let's celebrate our growth! 🎉`;
  
  bot.sendMessage(channelId, message, { parse_mode: 'Markdown' })
    .then(() => console.log('Friday message sent successfully'))
    .catch((error) => console.error('Error sending Friday message:', error));
};

// Schedule messages for NZT
const mondayJob = schedule.scheduleJob({ hour: 9, minute: 0, dayOfWeek: 1, tz: 'Pacific/Auckland' }, sendMondayMessage);
const fridayJob = schedule.scheduleJob({ hour: 16, minute: 0, dayOfWeek: 5, tz: 'Pacific/Auckland' }, sendFridayMessage);

console.log('Monday message scheduled for:', mondayJob.nextInvocation().toString());
console.log('Friday message scheduled for:', fridayJob.nextInvocation().toString());

// Handle incoming messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log('Received message:', msg);

  if (msg.text && msg.text === 'health-check:koruclub') {
    bot.sendMessage(channelId, 'pong')
    .catch((error) => console.error('Error sending pong:', error));
  }

  if (msg.text && msg.text === 'ping') {
    bot.sendMessage(chatId, 'pong')
      .then(() => console.log('Pong sent successfully'))
      .catch((error) => console.error('Error sending pong:', error));
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